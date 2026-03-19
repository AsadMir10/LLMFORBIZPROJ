
"""
PDF Ingestion Service
~~~~~~~~~~~~~~~~~~~~~
"""

from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_experimental.text_splitter import SemanticChunker
from langchain_pinecone import PineconeVectorStore

# Re-use the singleton from rag_service — no duplicate model loading
from .rag_service import get_embeddings
from .models import DocumentMetadata

logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _stable_id(text: str, source: str) -> str:
    return hashlib.sha256(f"{source}::{text[:512]}".encode()).hexdigest()[:32]


# ------------------------------------------------------------------
# Public API — intentionally sync (called via run_in_executor)
# ------------------------------------------------------------------

def ingest_pdf(file_path: str) -> dict:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")

    filename = path.name
    logger.info("Ingesting PDF: %s", filename)

    # Step 1: Extract text
    loader = PyPDFLoader(str(path))
    pages: list[Document] = loader.load()
    logger.info("  Extracted %d pages from %s", len(pages), filename)

    if not pages:
        logger.warning("  No content extracted – skipping.")
        return {"filename": filename, "pages": 0, "chunks": 0, "vectors": 0}

    for page in pages:
        page.metadata["source"] = filename
        page.metadata["title"] = path.stem

    # Step 2: Semantic chunking — uses shared MPS-aware singleton
    embeddings = get_embeddings()
    chunker = SemanticChunker(
        embeddings=embeddings,
        breakpoint_threshold_type="percentile",
    )
    chunks: list[Document] = chunker.split_documents(pages)
    logger.info("  %d pages → %d semantic chunks", len(pages), len(chunks))

    # Step 3: Upsert to Pinecone
    from pinecone import Pinecone, ServerlessSpec

    index_name = os.environ.get("PINECONE_INDEX_NAME", "enterprise-rag")
    api_key = os.environ.get("PINECONE_API_KEY")
    ids = [_stable_id(c.page_content, filename) for c in chunks]

    pc = Pinecone(api_key=api_key)
    if index_name not in [idx.name for idx in pc.list_indexes()]:
        logger.info("  Pinecone index '%s' not found — creating it.", index_name)
        pc.create_index(
            name=index_name,
            dimension=384,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )

    PineconeVectorStore.from_documents(
        documents=chunks,
        embedding=embeddings,
        index_name=index_name,
        ids=ids,
    )
    logger.info("  Upserted %d vectors into '%s'", len(ids), index_name)

    # Step 4: Track in DocumentMetadata — sync ORM fine here (in executor thread)
    DocumentMetadata.objects.update_or_create(
        source_url=filename,
        defaults={"title": path.stem},
    )
    logger.info("  Tracked '%s' in DocumentMetadata", filename)

    return {
        "filename": filename,
        "pages": len(pages),
        "chunks": len(chunks),
        "vectors": len(ids),
    }
