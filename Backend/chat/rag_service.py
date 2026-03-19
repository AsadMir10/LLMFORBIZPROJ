"""
Enterprise RAG Orchestrator — Full Async
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Stream protocol: Newline-Delimited JSON (NDJSON)
  {"type": "think",  "content": "..."}   ← Kimi reasoning tokens (Ollama)
  {"type": "text",   "content": "..."}   ← Answer tokens
  {"type": "error",  "content": "..."}   ← Pipeline errors
"""

import asyncio
import json
import logging
import os
import warnings
from functools import lru_cache
from typing import AsyncGenerator, List, Union

warnings.filterwarnings("ignore", category=UserWarning, module="transformers")

import torch
from langchain_core.documents import Document
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_ollama import ChatOllama
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from ollama import AsyncClient as AsyncOllama

from .models import ChatMessage, ChatSession

logger = logging.getLogger(__name__)

os.environ["TOKENIZERS_PARALLELISM"] = "false"


# ---------------------------------------------------------------------------
# Configs
# ---------------------------------------------------------------------------

EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
MEMORY_WINDOW_K      = 5
CONTEXT_K_MIN        = 1
CONTEXT_K_MAX        = 20
CONTEXT_K_DEFAULT    = 5

KIMI_MODEL_PREFIXES = ("kimi", "moonshot")

SYSTEM_TEMPLATE = """\
You are a premium Tier-1 Security Copilot.
Keep your tone sophisticated, professional, and helpful.

GUIDELINES:
1. GREETINGS: If the user says "hello", "how can you help", or similar,
   introduce yourself as the Enterprise Guard AI and list your capabilities
   (Account Recovery, Identity Verification, Troubleshooting).
2. RAG DATA: For technical queries, use the CONTEXT below.
3. FALLBACK: If the context is insufficient, answer as best you can
   from what is available. Only mention missing context if you truly
   have nothing relevant. Never reference page numbers, metadata,
   or document structure visible in the context.

--- CONTEXT ---
{context}
--- END CONTEXT ---
"""


# ---------------------------------------------------------------------------
# NDJSON helpers
# ---------------------------------------------------------------------------

def _think_chunk(content: str) -> str:
    return json.dumps({"type": "think", "content": content}) + "\n"

def _text_chunk(content: str) -> str:
    return json.dumps({"type": "text", "content": content}) + "\n"

def _error_chunk(content: str) -> str:
    return json.dumps({"type": "error", "content": content}) + "\n"


# ---------------------------------------------------------------------------
# Singletons
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_embeddings() -> HuggingFaceEmbeddings:
    if torch.backends.mps.is_available():
        device = "mps"
    elif torch.cuda.is_available():
        device = "cuda"
    else:
        device = "cpu"

    logger.info("Embedding device selected: %s", device)
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL_NAME,
        model_kwargs={"device": device},
        encode_kwargs={"normalize_embeddings": True},
    )


@lru_cache(maxsize=1)
def get_vectorstore() -> PineconeVectorStore:
    from pinecone import Pinecone, ServerlessSpec

    index_name = os.environ.get("PINECONE_INDEX_NAME", "enterprise-rag")
    api_key    = os.environ.get("PINECONE_API_KEY")

    if not api_key:
        raise ValueError("PINECONE_API_KEY environment variable is critically missing.")

    pc = Pinecone(api_key=api_key)

    if index_name not in [idx.name for idx in pc.list_indexes()]:
        logger.info("Creating missing Pinecone index: %s", index_name)
        pc.create_index(
            name=index_name,
            dimension=384,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )

    return PineconeVectorStore(
        index_name=index_name,
        embedding=get_embeddings(),
        pinecone_api_key=api_key,
    )


@lru_cache(maxsize=8)
def get_ollama_llm(model_name: str) -> ChatOllama:
    logger.info("Initializing ChatOllama for model: %s", model_name)
    return ChatOllama(model=model_name, temperature=0.1)


# ---------------------------------------------------------------------------
# RAG Orchestrator
# ---------------------------------------------------------------------------

class RAGOrchestrator:

    @property
    def vectorstore(self) -> PineconeVectorStore:
        return get_vectorstore()

    _session_locks: dict[int, asyncio.Lock] = {}

    @classmethod
    def _get_session_lock(cls, session_id: int) -> asyncio.Lock:
        if session_id not in cls._session_locks:
            cls._session_locks[session_id] = asyncio.Lock()
        return cls._session_locks[session_id]

    @staticmethod
    async def _load_chat_history(session: ChatSession) -> List[Union[HumanMessage, AIMessage]]:
        limit    = 2 * MEMORY_WINDOW_K
        messages = []
        qs = ChatMessage.objects.filter(session=session).order_by("-timestamp")[:limit]
        async for msg in qs:
            messages.append(msg)
        messages.reverse()
        return [
            HumanMessage(content=msg.content)
            if msg.role == ChatMessage.Role.USER
            else AIMessage(content=msg.content)
            for msg in messages
        ]

    @staticmethod
    def _format_docs(docs: List[Document]) -> str:
        return "\n\n".join(doc.page_content for doc in docs)

    @staticmethod
    def _build_messages(
        context: str,
        question: str,
        history: List[Union[HumanMessage, AIMessage]],
    ) -> list:
        msgs = [{"role": "system", "content": SYSTEM_TEMPLATE.format(context=context)}]
        for h in history:
            msgs.append({
                "role": "user" if isinstance(h, HumanMessage) else "assistant",
                "content": h.content,
            })
        msgs.append({"role": "user", "content": question})
        return msgs

    # ------------------------------------------------------------------
    # Kimi stream
    # ------------------------------------------------------------------

    async def _kimi_stream(
        self,
        model_name: str,
        context: str,
        question: str,
        history: List[Union[HumanMessage, AIMessage]],
    ) -> AsyncGenerator[str, None]:
        messages = self._build_messages(context, question, history)
        client   = AsyncOllama()

        async for chunk in await client.chat(
            model=model_name,
            messages=messages,
            stream=True,
            options={"temperature": 0.6},
        ):
            msg = chunk.get("message", {})
            if thinking := msg.get("thinking"):
                yield _think_chunk(thinking)
            if content := msg.get("content"):
                yield _text_chunk(content)

    # ------------------------------------------------------------------
    # Ollama stream (non-Kimi)
    # ------------------------------------------------------------------

    async def _ollama_stream(
        self,
        model_name: str,
        context: str,
        question: str,
        history: List[Union[HumanMessage, AIMessage]],
    ) -> AsyncGenerator[str, None]:
        prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_TEMPLATE),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
        ])
        chain = prompt | get_ollama_llm(model_name) | StrOutputParser()

        async for chunk in chain.astream({
            "context":      context,
            "question":     question,
            "chat_history": history,
        }):
            if chunk:
                yield _text_chunk(chunk)

    # ------------------------------------------------------------------
    # Public entry point — context_k controls retrieval depth
    # ------------------------------------------------------------------

    async def ask_stream(
        self,
        session: ChatSession,
        user_question: str,
        model_name: str,
        context_k: int = CONTEXT_K_DEFAULT,
    ) -> AsyncGenerator[str, None]:
        """
        Async streaming RAG pipeline.

        context_k — number of chunks to retrieve from Pinecone.
                     Clamped to [CONTEXT_K_MIN, CONTEXT_K_MAX].
                     Higher values give broader coverage at the cost of
                     slightly more latency and a larger prompt.
        """
        # Clamp to safe range so the frontend can't send arbitrary values
        k = max(CONTEXT_K_MIN, min(context_k, CONTEXT_K_MAX))
        logger.info("Context depth k=%d for model %s", k, model_name)

        retriever = self.vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": k},
        )

        lock = self._get_session_lock(session.pk)
        async with lock:
            chat_history = await self._load_chat_history(session)
            await ChatMessage.objects.acreate(
                session=session,
                role=ChatMessage.Role.USER,
                content=user_question,
            )

        answer_parts: list[str] = []
        stream_failed = False

        try:
            try:
                retrieved_docs = await asyncio.wait_for(
                    retriever.ainvoke(user_question), timeout=3.0
                )
                logger.info("RAG: Retrieved %d context chunks (k=%d).", len(retrieved_docs), k)
            except asyncio.TimeoutError:
                logger.warning("Pinecone retrieval timed out — proceeding without context.")
                retrieved_docs = []
            except Exception as e:
                logger.error("Vector Retrieval Failure: %s", e)
                retrieved_docs = []

            context_text = self._format_docs(retrieved_docs)

            is_kimi   = any(p in model_name.lower() for p in KIMI_MODEL_PREFIXES)
            stream_fn = self._kimi_stream if is_kimi else self._ollama_stream
            logger.info("Using %s pipeline for model: %s", "Kimi" if is_kimi else "Ollama", model_name)

            async for ndjson_line in stream_fn(model_name, context_text, user_question, chat_history):
                try:
                    parsed = json.loads(ndjson_line)
                    if parsed.get("type") == "text":
                        answer_parts.append(parsed["content"])
                except (json.JSONDecodeError, KeyError):
                    pass
                yield ndjson_line

        except Exception as exc:
            logger.exception("RAG Engine Streaming Failure: %s", exc)
            stream_failed = True
            yield _error_chunk("Response was cut short due to an internal failure.")

        # Fallback — prevents stuck empty bubble when model only thinks, no text
        if not answer_parts and not stream_failed:
            fallback = "You're welcome! Feel free to ask anything else."
            answer_parts.append(fallback)
            yield _text_chunk(fallback)
            logger.info("Empty answer fallback triggered for session %s.", session.pk)

        answer_text = "".join(answer_parts)
        if answer_text:
            await ChatMessage.objects.acreate(
                session=session,
                role=ChatMessage.Role.ASSISTANT,
                content=answer_text,
            )

        if stream_failed:
            logger.warning(
                "Partial answer (%d chars) persisted for session %s after stream failure.",
                len(answer_text),
                session.pk,
            )