# Enterprise Guard AI — Secure GenAI Knowledge Copilot

## Overview

Enterprise Guard AI is a secure, real-time Generative AI assistant designed for organizations to interact with internal knowledge safely and efficiently.

The system combines Retrieval-Augmented Generation (RAG), real-time streaming, and multiple layers of guardrails to ensure responses are accurate, grounded, and compliant with enterprise requirements.

---

## Problem

Organizations adopting AI systems face several risks:

- Unreliable responses due to hallucination
- Exposure of sensitive information (PII leakage)
- Lack of control over unsafe or adversarial inputs
- Poor user experience due to slow responses

---

## Solution

This system addresses these challenges through:

- Retrieval-Augmented Generation (RAG) for grounded responses
- Multi-layer guardrails (PII detection and prompt injection filtering)
- Real-time streaming responses for responsive UX
- Intelligent query routing (RAG vs general vs system queries)

---

## Target Users

- Enterprise internal teams
- Customer support systems
- Compliance and security environments
- Knowledge workers and analysts

---

## Key Features

- PDF ingestion and semantic indexing
- Context-aware question answering
- Token-level streaming responses
- PII detection and anonymization (Presidio)
- Prompt injection detection (LLM-based classifier)
- Query routing for optimized handling
- Session-based conversational memory

---

## AI Components

### Where AI is Used

- Query classification and routing
- Response generation via LLM
- Semantic retrieval using embeddings
- Safety classification for input filtering

---

### Models Used

| Component    | Model                                  |
| ------------ | -------------------------------------- |
| LLM          | kimi-k2.5 (Ollama cloud)               |
| Embeddings   | sentence-transformers/all-MiniLM-L6-v2 |
| Safety Model | phi3:mini                              |

---

### Inference Location

- LLM: Ollama (cloud-based inference)
- Embeddings: Local (HuggingFace)

---

## Guardrails

### Input Protection

- PII detection and anonymization using Presidio
- Prompt injection detection using LLM-based classification

### Output Control

- Context-grounded generation via RAG
- Controlled generation parameters
- Fallback handling for incomplete responses

### System Controls

- Context window limits (`context_k`)
- Token limits
- Async processing to prevent blocking

---

## Quality and Observability

- Structured logging of system behavior
- Sanitized prompt and response tracking
- Timeout handling for retrieval failures
- Streaming fallback mechanisms

---

## Known Risks and Mitigations

| Risk             | Mitigation                  |
| ---------------- | --------------------------- |
| Hallucination    | Retrieval grounding (RAG)   |
| Prompt injection | Safety classifier           |
| PII leakage      | Presidio anonymization      |
| Empty responses  | Fallback generation         |
| Latency spikes   | Streaming + async execution |

---

## Architecture Overview

The system follows a layered architecture:

1. Frontend (Next.js chat interface with streaming UI)
2. Django ASGI API layer
3. Security middleware (PII + safety filtering)
4. Query routing layer
5. RAG system (retrieval + embeddings + Pinecone)
6. LLM inference (Ollama Kimi model)
7. Data layer (Django ORM + vector database)
