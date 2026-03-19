"""
ingest_knowledge_base – Django management command
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Modular ingestion pipeline that loads documents from external knowledge
sources, chunks them semantically, generates embeddings with HuggingFace
``all-MiniLM-L6-v2``, upserts the vectors into Pinecone Serverless, and
tracks every ingested document in the Django ``DocumentMetadata`` model.

Supported sources (toggled via CLI flags):
    --zendesk       Fetch help-centre articles from Zendesk
    --notion        Load exported Notion pages from a local directory
    --confluence    Pull pages from Confluence Cloud / Server

Usage examples::

    python manage.py ingest_knowledge_base --zendesk --confluence
    python manage.py ingest_knowledge_base --notion --notion-path ./notion_export
    python manage.py ingest_knowledge_base --all

Environment variables (read from ``.env`` at project root)::

    ZENDESK_SUBDOMAIN      e.g.  mycompany
    ZENDESK_EMAIL          e.g.  admin@mycompany.com
    ZENDESK_TOKEN          Zendesk API token

    NOTION_EXPORT_PATH     Path to an unzipped Notion export directory

    CONFLUENCE_URL         e.g.  https://mycompany.atlassian.net/wiki
    CONFLUENCE_USERNAME     Atlassian account email
    CONFLUENCE_API_TOKEN   Atlassian API token
    CONFLUENCE_SPACE_KEY   Space key to ingest (e.g. ``ENG``)

    PINECONE_API_KEY       Pinecone serverless API key
    PINECONE_INDEX_NAME    Name of the Pinecone index (default: enterprise-rag)
"""

from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone as dj_tz
from dotenv import load_dotenv

from langchain_core.documents import Document
from langchain_community.document_loaders import (
    ConfluenceLoader,
    NotionDirectoryLoader,
)
from langchain_experimental.text_splitter import SemanticChunker
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore

from chat.models import DocumentMetadata

logger = logging.getLogger(__name__)

# Load .env from project root
load_dotenv(Path(__file__).resolve().parents[3] / ".env")

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"


# ======================================================================
# LOADERS – each returns list[Document] and can be toggled independently
# ======================================================================


def load_zendesk() -> list[Document]:
    """Fetch Zendesk help-centre articles via the REST API.

    Requires env vars: ``ZENDESK_SUBDOMAIN``, ``ZENDESK_EMAIL``,
    ``ZENDESK_TOKEN``.
    """
    subdomain = os.environ.get("ZENDESK_SUBDOMAIN", "")
    email = os.environ.get("ZENDESK_EMAIL", "")
    token = os.environ.get("ZENDESK_TOKEN", "")

    if not all([subdomain, email, token]):
        raise CommandError(
            "Zendesk credentials missing. Set ZENDESK_SUBDOMAIN, "
            "ZENDESK_EMAIL, and ZENDESK_TOKEN in your .env file."
        )

    url = f"https://{subdomain}.zendesk.com/api/v2/help_center/en-us/articles.json"
    auth = (f"{email}/token", token)
    documents: list[Document] = []

    while url:
        resp = requests.get(url, auth=auth, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        for article in data.get("articles", []):
            documents.append(
                Document(
                    page_content=article.get("body", "") or "",
                    metadata={
                        "source": article.get("html_url", ""),
                        "title": article.get("title", "Untitled"),
                        "updated_at": article.get("updated_at", ""),
                        "loader": "zendesk",
                    },
                )
            )

        url = data.get("next_page")  # pagination

    logger.info("Zendesk: loaded %d articles", len(documents))
    return documents


def load_notion(export_path: str | None = None) -> list[Document]:
    """Load pages from a local Notion export directory.

    Uses the LangChain ``NotionDirectoryLoader``.

    Parameters
    ----------
    export_path:
        Path to the unzipped Notion export.  Falls back to the env var
        ``NOTION_EXPORT_PATH``.
    """
    path = export_path or os.environ.get("NOTION_EXPORT_PATH", "")
    if not path or not Path(path).is_dir():
        raise CommandError(
            f"Notion export path does not exist: {path!r}. "
            "Set NOTION_EXPORT_PATH or pass --notion-path."
        )

    loader = NotionDirectoryLoader(path)
    docs = loader.load()

    # Enrich metadata
    for doc in docs:
        doc.metadata.setdefault("loader", "notion")
        doc.metadata.setdefault("title", Path(doc.metadata.get("source", "Untitled")).stem)
        doc.metadata.setdefault("source", path)

    logger.info("Notion: loaded %d pages from %s", len(docs), path)
    return docs


def load_confluence() -> list[Document]:
    """Fetch pages from Confluence Cloud/Server.

    Uses the LangChain ``ConfluenceLoader``.

    Requires env vars: ``CONFLUENCE_URL``, ``CONFLUENCE_USERNAME``,
    ``CONFLUENCE_API_TOKEN``, ``CONFLUENCE_SPACE_KEY``.
    """
    url = os.environ.get("CONFLUENCE_URL", "")
    username = os.environ.get("CONFLUENCE_USERNAME", "")
    token = os.environ.get("CONFLUENCE_API_TOKEN", "")
    space_key = os.environ.get("CONFLUENCE_SPACE_KEY", "")

    if not all([url, username, token, space_key]):
        raise CommandError(
            "Confluence credentials missing. Set CONFLUENCE_URL, "
            "CONFLUENCE_USERNAME, CONFLUENCE_API_TOKEN, and "
            "CONFLUENCE_SPACE_KEY in your .env file."
        )

    loader = ConfluenceLoader(
        url=url,
        username=username,
        api_key=token,
    )
    docs = loader.load(space_key=space_key, limit=100, max_pages=500)

    for doc in docs:
        doc.metadata.setdefault("loader", "confluence")
        doc.metadata.setdefault("title", "Untitled")
        doc.metadata.setdefault("source", url)

    logger.info("Confluence: loaded %d pages", len(docs))
    return docs


# ======================================================================
# PROCESSING UTILITIES
# ======================================================================


def build_embeddings() -> HuggingFaceEmbeddings:
    """Instantiate the shared HuggingFace embedding model."""
    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL_NAME,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


def chunk_documents(
    documents: list[Document],
    embeddings: HuggingFaceEmbeddings,
) -> list[Document]:
    """Split documents into semantically coherent chunks."""
    if not documents:
        return []

    chunker = SemanticChunker(
        embeddings=embeddings,
        breakpoint_threshold_type="percentile",
    )
    chunks = chunker.split_documents(documents)
    logger.info(
        "Chunking: %d documents → %d chunks", len(documents), len(chunks)
    )
    return chunks


def _stable_id(text: str, source: str) -> str:
    """Generate a deterministic vector ID from content + source."""
    return hashlib.sha256(f"{source}::{text[:512]}".encode()).hexdigest()[:32]


def upsert_to_pinecone(
    chunks: list[Document],
    embeddings: HuggingFaceEmbeddings,
) -> int:
    """Upsert chunks into Pinecone Serverless via the LangChain wrapper.

    Returns the number of vectors upserted.
    """
    if not chunks:
        return 0

    index_name = os.environ.get("PINECONE_INDEX_NAME", "enterprise-rag")

    # Assign deterministic IDs to allow idempotent re-ingestion
    ids = [
        _stable_id(c.page_content, c.metadata.get("source", ""))
        for c in chunks
    ]

    PineconeVectorStore.from_documents(
        documents=chunks,
        embedding=embeddings,
        index_name=index_name,
        ids=ids,
    )

    logger.info("Pinecone: upserted %d vectors into '%s'", len(ids), index_name)
    return len(ids)


def track_in_database(documents: list[Document]) -> int:
    """Create or update a ``DocumentMetadata`` row for each unique source.

    Returns the number of rows created/updated.
    """
    seen: set[str] = set()
    count = 0

    for doc in documents:
        source = doc.metadata.get("source", "")
        if not source or source in seen:
            continue
        seen.add(source)

        title = doc.metadata.get("title", "Untitled")[:512]
        DocumentMetadata.objects.update_or_create(
            source_url=source,
            defaults={
                "title": title,
                # last_updated is auto_now, so it refreshes on every save
            },
        )
        count += 1

    logger.info("Database: tracked %d unique source documents", count)
    return count


# ======================================================================
# MANAGEMENT COMMAND
# ======================================================================


class Command(BaseCommand):
    help = (
        "Ingest documents from Zendesk, Notion, and/or Confluence into "
        "the Pinecone vector store and track them in DocumentMetadata."
    )

    # ---- CLI arguments ---------------------------------------------------

    def add_arguments(self, parser):
        parser.add_argument(
            "--zendesk",
            action="store_true",
            default=False,
            help="Enable the Zendesk help-centre loader.",
        )
        parser.add_argument(
            "--notion",
            action="store_true",
            default=False,
            help="Enable the Notion directory loader.",
        )
        parser.add_argument(
            "--notion-path",
            type=str,
            default=None,
            help="Override NOTION_EXPORT_PATH for this run.",
        )
        parser.add_argument(
            "--confluence",
            action="store_true",
            default=False,
            help="Enable the Confluence loader.",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            default=False,
            dest="all_sources",
            help="Enable ALL loaders at once.",
        )

    # ---- Main entry point ------------------------------------------------

    def handle(self, *args: Any, **options: Any) -> None:
        enable_zendesk = options["zendesk"] or options["all_sources"]
        enable_notion = options["notion"] or options["all_sources"]
        enable_confluence = options["confluence"] or options["all_sources"]

        if not any([enable_zendesk, enable_notion, enable_confluence]):
            raise CommandError(
                "No sources enabled. Use --zendesk, --notion, --confluence, "
                "or --all to select at least one source."
            )

        # -- Step 1: Load documents ----------------------------------------
        self.stdout.write(self.style.MIGRATE_HEADING("Step 1/4  Loading documents …"))
        all_docs: list[Document] = []

        if enable_zendesk:
            self.stdout.write("  → Zendesk …")
            all_docs.extend(load_zendesk())

        if enable_notion:
            self.stdout.write("  → Notion …")
            all_docs.extend(load_notion(options.get("notion_path")))

        if enable_confluence:
            self.stdout.write("  → Confluence …")
            all_docs.extend(load_confluence())

        if not all_docs:
            self.stdout.write(self.style.WARNING("No documents loaded. Exiting."))
            return

        self.stdout.write(self.style.SUCCESS(f"  ✓ {len(all_docs)} documents loaded"))

        # -- Step 2: Chunk ---------------------------------------------------
        self.stdout.write(self.style.MIGRATE_HEADING("Step 2/4  Semantic chunking …"))
        embeddings = build_embeddings()
        chunks = chunk_documents(all_docs, embeddings)
        self.stdout.write(self.style.SUCCESS(f"  ✓ {len(chunks)} chunks created"))

        # -- Step 3: Upsert to Pinecone --------------------------------------
        self.stdout.write(self.style.MIGRATE_HEADING("Step 3/4  Upserting to Pinecone …"))
        n_vectors = upsert_to_pinecone(chunks, embeddings)
        self.stdout.write(self.style.SUCCESS(f"  ✓ {n_vectors} vectors upserted"))

        # -- Step 4: Track in SQLite -----------------------------------------
        self.stdout.write(self.style.MIGRATE_HEADING("Step 4/4  Updating DocumentMetadata …"))
        n_tracked = track_in_database(all_docs)
        self.stdout.write(self.style.SUCCESS(f"  ✓ {n_tracked} source documents tracked"))

        self.stdout.write(self.style.SUCCESS("\n✅  Ingestion complete."))
