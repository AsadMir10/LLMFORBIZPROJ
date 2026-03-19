"""
MCP Server — Enterprise RAG Copilot
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Exposes the RAG pipeline, PDF ingestion, and document listing as MCP tools
using the Model Context Protocol Python SDK.

Run with:
    venv/bin/python mcp_server.py
"""

import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Bootstrap Django
# ---------------------------------------------------------------------------
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "enterprise_rag.settings")

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

import django
django.setup()

from mcp.server.fastmcp import FastMCP

from chat.ingest_service import ingest_pdf as _ingest_pdf
from chat.models import ChatSession, DocumentMetadata
from chat.rag_service import RAGOrchestrator

# ---------------------------------------------------------------------------
# Server setup
# ---------------------------------------------------------------------------

mcp = FastMCP("Enterprise RAG Copilot")

_rag: RAGOrchestrator | None = None


def _get_rag() -> RAGOrchestrator:
    global _rag
    if _rag is None:
        _rag = RAGOrchestrator()
    return _rag


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


@mcp.tool()
def rag_query(session_id: str, message: str, model: str = "kimi-k2.5:cloud") -> str:
    """Query the knowledge base via the RAG pipeline.

    Args:
        session_id: UUID of the chat session (creates a new one if empty).
        message: The user's question. PII is automatically scrubbed.
        model: Ollama model to use for generation.

    Returns:
        The assistant's answer grounded in the knowledge base.
    """
    # Resolve or create session
    session = None
    if session_id:
        try:
            session = ChatSession.objects.get(session_id=session_id)
        except ChatSession.DoesNotExist:
            pass

    if session is None:
        session = ChatSession.objects.create()

    # Scrub PII (lazy import to avoid loading spaCy at startup)
    from chat.middleware import scrub_pii
    clean_message = scrub_pii(message)["scrubbed"]

    # Run the RAG pipeline
    rag = _get_rag()
    result = rag.ask(session, clean_message, model_name=model)

    return (
        f"Session: {session.session_id}\n"
        f"Answer: {result['answer']}\n"
        f"Sources: {len(result['source_documents'])}"
    )


@mcp.tool()
def ingest_pdf(file_path: str) -> str:
    """Ingest a PDF document into the knowledge base.

    Args:
        file_path: Absolute path to the PDF file on disk.

    Returns:
        Ingestion statistics (pages extracted, chunks created, vectors upserted).
    """
    result = _ingest_pdf(file_path)
    return (
        f"Filename: {result['filename']}\n"
        f"Pages: {result['pages']}\n"
        f"Chunks: {result['chunks']}\n"
        f"Vectors: {result['vectors']}"
    )


@mcp.tool()
def list_documents() -> str:
    """List all documents currently in the knowledge base.

    Returns:
        A formatted list of ingested documents with their titles and sources.
    """
    docs = DocumentMetadata.objects.all().order_by("-last_updated")

    if not docs.exists():
        return "No documents in the knowledge base."

    lines = []
    for doc in docs:
        lines.append(
            f"- [{doc.id}] {doc.title} | source: {doc.source_url} | updated: {doc.last_updated:%Y-%m-%d %H:%M}"
        )
    return "\n".join(lines)


@mcp.tool()
def delete_document(document_id: int) -> str:
    """Delete a document from the knowledge base by its database ID.

    Args:
        document_id: The ID of the document to delete (can be obtained via list_documents).

    Returns:
        A success or error message.
    """
    try:
        doc = DocumentMetadata.objects.get(id=document_id)
        source_url = doc.source_url
    except DocumentMetadata.DoesNotExist:
        return f"Error: Document with ID {document_id} not found."

    from pinecone import Pinecone
    index_name = os.environ.get("PINECONE_INDEX_NAME", "enterprise-rag")
    api_key = os.environ.get("PINECONE_API_KEY")
    
    try:
        pc = Pinecone(api_key=api_key)
        index = pc.Index(index_name)
        index.delete(filter={"source": {"$eq": source_url}})
        doc.delete()
        return f"Success: Document '{source_url}' (ID: {document_id}) has been deleted."
    except Exception as e:
        return f"Error deleting document: {e}"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run(transport="stdio")
