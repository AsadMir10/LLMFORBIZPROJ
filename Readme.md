# COGNITIVE SUPPORT ENGINE — Secure GenAI Knowledge Copilot

## Overview

CSE is a secure, real-time Generative AI assistant designed for organizations to interact with internal knowledge safely and efficiently.

The system combines Retrieval-Augmented Generation (RAG), real-time streaming, and multiple layers of guardrails to ensure responses are accurate, grounded, and compliant with enterprise requirements.

---

## Problem

Organizations adopting AI systems face several risks:

* Unreliable responses due to hallucination
* Exposure of sensitive information (PII leakage)
* Lack of control over unsafe or adversarial inputs
* Poor user experience due to slow responses

---

## Solution

This system addresses these challenges through:

* Retrieval-Augmented Generation (RAG) for grounded responses
* Multi-layer guardrails (PII detection and prompt injection filtering)
* Real-time streaming responses for responsive UX
* Intelligent query routing (RAG vs general vs system queries)

---

## Target Users

* Enterprise internal teams
* Customer support systems
* Compliance and security environments
* Knowledge workers and analysts

---

## Demo

> 🎥 Demo video / live link: *coming soon*

---

## Project Structure

```
LLMFORBIZPROJ/
├── Backend/                                      # Django ASGI backend
│   ├── enterprise_rag/                           # Django project package
│   │   ├── settings.py                           # App configuration
│   │   ├── urls.py                               # Root URL routing
│   │   ├── asgi.py                               # ASGI entry point (async support)
│   │   └── wsgi.py                               # WSGI entry point (fallback)
│   ├── chat/                                     # Core application
│   │   ├── models.py                             # Session and message models (Django ORM)
│   │   ├── views.py                              # API views (chat, upload, stream)
│   │   ├── urls.py                               # App-level URL routing
│   │   ├── middleware.py                         # Security middleware (PII + safety)
│   │   ├── query_router.py                       # RAG / general / DB route classifier
│   │   ├── rag_service.py                        # RAG pipeline (retrieval + generation)
│   │   ├── ingest_service.py                     # PDF ingestion and semantic chunking
│   │   ├── ollama_client.py                      # Ollama (Kimi K2.5) streaming client
│   │   ├── prompt_service.py                     # Prompt construction and management
│   │   ├── tools.py                              # Utility/helper functions
│   │   ├── admin.py                              # Django admin registration
│   │   ├── apps.py                               # App config
│   │   ├── tests.py                              # Smoke tests
│   │   ├── migrations/                           # Django ORM migrations
│   │   │   ├── 0001_initial.py
│   │   │   └── 0002_promptsuggestion.py
│   │   ├── management/commands/
│   │   │   └── ingest_knowledge_base.py          # CLI command to ingest PDFs
│   │   └── templates/chat/
│   │       ├── chat.html                         # Chat UI template (Django-rendered)
│   │       └── upload.html                       # PDF upload template
│   ├── mcp_server.py                             # MCP server entry point
│   ├── manage.py                                 # Django management CLI
│   ├── requirements.txt                          # Pinned Python dependencies
│   ├── .env.example                              # Environment variable placeholders
│   └── media/uploads/                            # Uploaded PDF storage (gitignored)
│
├── Frontend/                                     # Next.js (React) frontend
│   ├── src/
│   │   ├── app/                                  # Next.js App Router
│   │   │   ├── page.tsx                          # Root page (chat UI entry)
│   │   │   ├── layout.tsx                        # Global layout wrapper
│   │   │   ├── globals.css                       # Global styles
│   │   │   └── favicon.ico
│   │   └── components/                           # React components
│   │       ├── chat/
│   │       │   └── ChatWindow.tsx                # Main streaming chat interface
│   │       ├── layout/
│   │       │   ├── Sidebar.tsx                   # Navigation sidebar
│   │       │   └── DebugPanel.tsx                # Developer debug panel
│   │       ├── logger/
│   │       │   └── PIILogger.tsx                 # PII detection log viewer
│   │       ├── vault/
│   │       │   └── DocumentVault.tsx             # PDF upload and management UI
│   │       ├── ModelSwitcher.tsx                 # LLM model selector
│   │       └── Themeswitcher.tsx                 # Light/dark mode toggle
│   ├── public/                                   # Static assets (SVGs)
│   ├── package.json                              # Pinned Node dependencies
│   ├── next.config.ts                            # Next.js configuration
│   ├── tsconfig.json                             # TypeScript configuration
│   ├── postcss.config.mjs                        # PostCSS / Tailwind config
│   └── eslint.config.mjs                         # ESLint configuration
│
├── ARCHITECTURE.md                               # Layered diagram + data/LLM flow
├── SECURITY.md                                   # Secrets, authN/Z, PII, data residency
├── RAI.md                                        # Responsible AI choices and guardrails
├── CHANGELOG.md                                  # Version history
├── LICENSE                                       # Apache-2.0
├── .gitignore                                    # Excluded files
└── Readme.md                                     # This file
```

---

## Quick Start

### Prerequisites

* Python 3.11+
* Node.js 18+
* [Ollama](https://ollama.com/) running locally or via cloud
* Pinecone account (free tier works)

### 1. Clone the repository

```bash
git clone https://github.com/AsadMir10/LLMFORBIZPROJ.git
cd LLMFORBIZPROJ
```

### 2. Pull required Ollama models

```bash
ollama pull kimi-k2.5
ollama pull phi3:mini
```

### 3. Set up the Backend

```bash
cd Backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # Fill in your API keys
python manage.py migrate
python manage.py runserver
```

### 4. Ingest your knowledge base (optional)

```bash
python manage.py ingest_knowledge_base
```

### 5. Set up the Frontend

```bash
cd ../Frontend
npm install
npm run dev
```

### 6. Open the app

Visit [http://localhost:3000](http://localhost:3000/) in your browser.

---

## Key Features

* PDF ingestion and semantic indexing
* Context-aware question answering
* Token-level streaming responses
* PII detection and anonymization (Presidio)
* Prompt injection detection (LLM-based classifier)
* Query routing for optimized handling
* Session-based conversational memory

---

## AI Components

### Where AI is Used

* Query classification and routing
* Response generation via LLM
* Semantic retrieval using embeddings
* Safety classification for input filtering

### Models Used

| Component    | Model                                  |
| ------------ | -------------------------------------- |
| LLM          | kimi-k2.5 (Ollama cloud)               |
| Embeddings   | sentence-transformers/all-MiniLM-L6-v2 |
| Safety Model | phi3:mini                              |

### Inference Location

* LLM: Ollama (cloud-based inference)
* Embeddings: Local (HuggingFace)

---

## Guardrails

### Input Protection

* PII detection and anonymization using Presidio
* Prompt injection detection using LLM-based classification

### Output Control

* Context-grounded generation via RAG
* Controlled generation parameters
* Fallback handling for incomplete responses

### System Controls

* Context window limits (`context_k`)
* Token limits
* Async processing to prevent blocking

---

## Quality and Observability

* Structured logging of system behavior
* Sanitized prompt and response tracking
* Timeout handling for retrieval failures
* Streaming fallback mechanisms

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


## Documentation

- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Security: [SECURITY.md](./SECURITY.md)
- Responsible AI: [RAI.md](./RAI.md)

---

## Team

| Name     | Role                        |
| -------- | --------------------------- |
| Asad Mir | Full-stack & AI Integration |

---

## License

[Apache-2.0](https://claude.ai/chat/LICENSE)
