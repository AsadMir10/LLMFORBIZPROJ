import json
import logging
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor

from ollama import AsyncClient as AsyncOllama

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.http import JsonResponse, StreamingHttpResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from asgiref.sync import sync_to_async

from .ingest_service import ingest_pdf
from .models import ChatSession, DocumentMetadata, PromptSuggestion
from .rag_service import RAGOrchestrator, CONTEXT_K_DEFAULT, CONTEXT_K_MIN, CONTEXT_K_MAX
from .prompt_service import regenerate_prompts

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level singletons
# ---------------------------------------------------------------------------

_scrub_executor = ThreadPoolExecutor(
    max_workers=2,
    thread_name_prefix="pii_scrub",
)

_rag: RAGOrchestrator | None = None

def _get_rag() -> RAGOrchestrator:
    global _rag
    if _rag is None:
        _rag = RAGOrchestrator()
    return _rag

_ollama_client: AsyncOllama | None = None

def _get_ollama() -> AsyncOllama:
    global _ollama_client
    if _ollama_client is None:
        _ollama_client = AsyncOllama()
    return _ollama_client


# ---------------------------------------------------------------------------
# Deterministic router
# ---------------------------------------------------------------------------

def _classify_route(message: str) -> str:
    msg = message.lower()
    if any(k in msg for k in (
        "how many documents", "what's indexed", "vault status",
        "documents indexed", "count documents", "how many files",
    )):
        return "db_lookup"
    if any(k in msg for k in (
        "hello", "hi ", "hey ", "how are you",
        "what can you do", "who are you", "introduce yourself",
    )):
        return "general"
    return "rag"


# ---------------------------------------------------------------------------
# Chat page
# ---------------------------------------------------------------------------

async def chat_page(request):
    return await sync_to_async(render)(request, "chat/chat.html")


# ---------------------------------------------------------------------------
# Ollama Models
# ---------------------------------------------------------------------------

async def list_models(request):
    try:
        client   = _get_ollama()
        response = await client.list()
        models   = [m.model for m in response.models]
        return JsonResponse({"models": models})
    except Exception as exc:
        logger.error("Error listing ollama models: %s", exc)
        return JsonResponse({"error": "Ollama service unreachable", "details": str(exc)}, status=503)


# ---------------------------------------------------------------------------
# Streaming Chat Endpoint
# ---------------------------------------------------------------------------

@csrf_exempt
@require_http_methods(["POST"])
async def chat_stream(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    user_message = body.get("message", "").strip()
    model_name   = body.get("model", "phi3:mini")

    if not user_message:
        return JsonResponse({"error": "Empty message."}, status=400)

    # Parse and clamp context_k from the request body
    try:
        context_k = int(body.get("context_k", CONTEXT_K_DEFAULT))
        context_k = max(CONTEXT_K_MIN, min(context_k, CONTEXT_K_MAX))
    except (TypeError, ValueError):
        context_k = CONTEXT_K_DEFAULT

    logger.info("chat_stream: model=%s context_k=%d", model_name, context_k)

    # -------------------------------------------------
    # Session resolution
    # -------------------------------------------------
    session_id = body.get("session_id") or request.session.get("chat_session_id")
    session    = None

    if session_id:
        try:
            session = await ChatSession.objects.aget(session_id=session_id)
        except ChatSession.DoesNotExist:
            session = None

    if session is None:
        session = await ChatSession.objects.acreate()
        request.session["chat_session_id"] = str(session.session_id)

    # -------------------------------------------------
    # PII scrubbing — dedicated thread pool
    # -------------------------------------------------
    loop = asyncio.get_running_loop()
    from .middleware import scrub_pii

    pii_result      = await loop.run_in_executor(_scrub_executor, scrub_pii, user_message)
    original_prompt = user_message
    clean_message   = pii_result["scrubbed"]

    # -------------------------------------------------
    # Route
    # -------------------------------------------------
    route = _classify_route(clean_message)
    logger.info("Route='%s' for: %.60s", route, clean_message)

    # -------------------------------------------------
    # Stream generator
    # -------------------------------------------------
    async def token_generator():
        yielded_anything = False
        try:
            if route == "db_lookup":
                count = await DocumentMetadata.objects.acount()
                yield json.dumps({"type": "text", "content": f"Secure Vault Status: {count} document(s) currently indexed."}) + "\n"
                return

            if route == "general":
                client = _get_ollama()
                # Fix: AsyncOllama.chat(..., stream=True) returns a coroutine
                # that resolves to an async generator — must await it first.
                async for part in await client.chat(
                    model=model_name,
                    messages=[{"role": "user", "content": clean_message}],
                    stream=True,
                ):
                    chunk = part["message"]["content"]
                    if chunk:
                        yielded_anything = True
                        yield json.dumps({"type": "text", "content": chunk}) + "\n"
                return

            # RAG pipeline — pass context_k through
            rag = _get_rag()
            async for ndjson_line in rag.ask_stream(
                session,
                clean_message,
                model_name=model_name,
                context_k=context_k,
            ):
                if ndjson_line:
                    yielded_anything = True
                    yield ndjson_line

        except Exception as exc:
            logger.exception("Streaming error for session %s", session.session_id)
            yield json.dumps({"type": "error", "content": str(exc)}) + "\n"
            yielded_anything = True

        if not yielded_anything:
            yield json.dumps({"type": "text", "content": "I searched the knowledge base but couldn't find relevant context."}) + "\n"

    # -------------------------------------------------
    # HTTP response
    # -------------------------------------------------
    response = StreamingHttpResponse(
        token_generator(),
        content_type="text/plain; charset=utf-8",
    )

    response["X-Session-ID"] = str(session.session_id)

    pii_data = {
        "original": original_prompt.replace("\n", " "),
        "scrubbed": clean_message.replace("\n", " "),
        "entities": pii_result.get("entities_found", []),
        "count":    pii_result.get("count", 0),
    }
    response["X-PII-Data"]                    = json.dumps(pii_data)
    response["Access-Control-Expose-Headers"] = "X-Session-ID, X-PII-Data"

    return response


# ---------------------------------------------------------------------------
# Upload PDF
# ---------------------------------------------------------------------------

@csrf_exempt
@require_http_methods(["POST"])
async def upload_pdf_api(request):
    try:
        if "pdf_file" not in request.FILES:
            return JsonResponse({"error": "Missing pdf_file"}, status=400)

        pdf_file = request.FILES["pdf_file"]
        if not pdf_file.name.lower().endswith(".pdf"):
            return JsonResponse({"error": "Only PDF allowed"}, status=400)

        loop    = asyncio.get_running_loop()
        content = await loop.run_in_executor(None, pdf_file.read)

        path = await loop.run_in_executor(None, lambda: default_storage.save(
            f"tmp/{pdf_file.name}",
            ContentFile(content),
        ))

        full_path = os.path.join(settings.MEDIA_ROOT, path)
        logger.info("Starting ingestion: %s", pdf_file.name)

        result = await loop.run_in_executor(None, ingest_pdf, full_path)
        await regenerate_prompts()

        if os.path.exists(full_path):
            os.remove(full_path)

        return JsonResponse({"status": "success", "filename": pdf_file.name, "stats": result})

    except Exception as e:
        logger.exception("Upload failed")
        return JsonResponse({"error": str(e)}, status=500)


# ---------------------------------------------------------------------------
# List Documents
# ---------------------------------------------------------------------------

@require_http_methods(["GET"])
async def list_documents(request):
    docs_list = []
    async for d in DocumentMetadata.objects.all().order_by("-last_updated"):
        docs_list.append({
            "id":      d.id,
            "title":   d.title,
            "source":  d.source_url,
            "updated": d.last_updated.isoformat(),
        })
    return JsonResponse({"documents": docs_list})


# ---------------------------------------------------------------------------
# Delete Document
# ---------------------------------------------------------------------------

# @csrf_exempt
# @require_http_methods(["DELETE"])
# async def delete_document(request, doc_id):
#     try:
#         doc        = await DocumentMetadata.objects.aget(id=doc_id)
#         index_name = os.environ.get("PINECONE_INDEX_NAME", "enterprise-rag")
#         api_key    = os.environ.get("PINECONE_API_KEY")
        
#         from pinecone import PineconeAsyncio
        
#         async with PineconeAsyncio(api_key=api_key) as pc:
#             index_host = None
#             indexes    = await pc.list_indexes()
#             for index_info in indexes:
#                 if index_info.name == index_name:
#                     index_host = index_info.host
#                     break
            
#             if index_host:
#                 async with pc.IndexAsyncio(host=index_host) as idx:
#                     await idx.delete(filter={"source": {"$eq": doc.source_url}})
        
#         await doc.adelete()
#         await regenerate_prompts()

#         return JsonResponse({"status": "success"})
    
#     except Exception as exc:
#         logger.exception("Delete failed")
#         return JsonResponse({"error": str(exc)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
async def delete_document(request, doc_id):
    try:
        doc = await DocumentMetadata.objects.aget(id=doc_id)
    except DocumentMetadata.DoesNotExist:
        return JsonResponse({"error": "Document not found"}, status=404)

    try:
        await asyncio.get_event_loop().run_in_executor(
            None, _delete_from_pinecone, doc.source_url
        )
    except Exception as exc:
        logger.exception("Pinecone delete failed for %s", doc.source_url)
        return JsonResponse({"error": f"Pinecone error: {exc}"}, status=500)

    await doc.adelete()
    await regenerate_prompts()

    return JsonResponse({"status": "success"})

import json
import logging
import os
from pathlib import Path
def _delete_from_pinecone(source_url: str) -> None:
    """
    Sync helper — runs in executor thread.
    Deletes all vectors for a document by targeting its namespace directly.
    Namespace is the filename stem, matching how ingest_pdf stores it.
    """
    from pinecone import Pinecone

    index_name = os.environ.get("PINECONE_INDEX_NAME", "enterprise-rag")
    api_key    = os.environ.get("PINECONE_API_KEY")
    namespace  = Path(source_url).stem      # e.g. "Customer_Support_Guide_v7_0_4"

    pc  = Pinecone(api_key=api_key)
    idx = pc.Index(index_name)              # no host lookup needed — SDK resolves it

    # Verify the namespace actually exists before attempting delete
    stats = idx.describe_index_stats()
    if namespace not in (stats.namespaces or {}):
        logger.warning(
            "Namespace '%s' not found in index '%s' — nothing to delete.",
            namespace, index_name,
        )
        return

    # delete_all=True on a namespace is atomic and doesn't require metadata filtering
    idx.delete(delete_all=True, namespace=namespace)
    logger.info("Deleted namespace '%s' from index '%s'", namespace, index_name)


# ---------------------------------------------------------------------------
# Prompt Suggestions
# ---------------------------------------------------------------------------

@require_http_methods(["GET"])
async def kb_prompt_suggestions(request):
    suggestions = [p.text async for p in PromptSuggestion.objects.all()]

    if not suggestions and await DocumentMetadata.objects.aexists():
        logger.info("Auto-regenerating prompt suggestions...")
        try:
            await regenerate_prompts()
            suggestions = [p.text async for p in PromptSuggestion.objects.all()]
        except Exception as e:
            logger.error("Failed auto-regeneration: %s", e)

    return JsonResponse({"suggestions": suggestions})


# ---------------------------------------------------------------------------
# Context K config endpoint
# ---------------------------------------------------------------------------

@require_http_methods(["GET"])
async def context_k_config(request):
    return JsonResponse({
        "min":     CONTEXT_K_MIN,
        "max":     CONTEXT_K_MAX,
        "default": CONTEXT_K_DEFAULT,
    })