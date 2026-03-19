# Changelog

## v1.0.0

- Initial release
- Implemented RAG pipeline with Pinecone
- Added PDF ingestion and semantic chunking
- Integrated Ollama (Kimi K2.5) for LLM inference
- Implemented security middleware:
  - PII detection (Presidio)
  - Prompt injection filtering
- Added streaming responses (NDJSON)
- Built frontend chat interface (Next.js)
- Added query routing (RAG / general / DB)
