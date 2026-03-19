# Security

## Secrets Management

- No credentials are stored in the repository
- All secrets are managed via `.env` file

---

## Authentication & Authorization

- Session-based identification using Django sessions
- No external authentication implemented (PoC scope)

---

## PII Handling

- Input is processed through Presidio before any AI call
- Detected entities:

  - Email
  - Phone number
  - Credit card
  - IBAN
  - Sensitive numeric patterns
- PII is anonymized before reaching the LLM

---

## Prompt Injection Protection

- LLM-based safety classifier checks user input
- Blocks:
  - Attempts to override system instructions
  - Attempts to extract hidden prompts
  - Harmful or unsafe instructions

---

## Data Residency

- LLM inference via Ollama (cloud)
- Embeddings processed locally
- Vector data stored in Pinecone (AWS region)

---

## Data Storage

- Chat sessions stored in Django DB
- Vector embeddings stored in Pinecone
- Uploaded files temporarily stored and deleted after ingestion

---

## Network Security

- No external API exposure beyond defined endpoints
- Controlled request flow through middleware

---

## Limitations

- No role-based access control (PoC)
- No encryption at rest implemented manually (relies on providers)
