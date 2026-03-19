# Responsible AI (RAI)

## Where AI is Used

- Query classification
- Response generation (LLM)
- Safety classification
- Semantic retrieval (embeddings)

---

## Model Selection

| Component  | Model     | Reason                    |
| ---------- | --------- | ------------------------- |
| LLM        | kimi-k2.5 | High-quality responses    |
| Embeddings | MiniLM    | Lightweight, efficient    |
| Safety     | phi3:mini | Fast, low-cost classifier |

---

## Trade-offs

- Kimi chosen for quality over full local control
- MiniLM chosen for speed and cost efficiency
- Low temperature for deterministic responses

---

## Guardrails

### Input

- PII detection and anonymization
- Prompt injection detection

### Output

- Context grounding via RAG
- Controlled generation
- Fallback responses

---

## Cost Control

- Small embedding model (MiniLM)
- Limited context window (`context_k`)
- Token limits enforced
- Async execution reduces compute waste

---

## Risk Mitigation

| Risk           | Mitigation             |
| -------------- | ---------------------- |
| Hallucination  | RAG grounding          |
| Unsafe prompts | Safety classifier      |
| PII leakage    | Presidio anonymization |
| Model misuse   | Input filtering        |

---

## Evaluation

- Manual testing with:

  - Safe prompts
  - Injection attempts
  - PII-containing inputs
- Observed:

  - Safe rejection of malicious prompts
  - Correct anonymization of sensitive data
  - Grounded responses when context available

---

## Limitations

- No automated evaluation metrics (PoC)
- Safety classifier depends on LLM behavior
- Partial reliance on external infrastructure (Pinecone)

---

## Ethical Considerations

- System refuses unsafe or harmful requests
- Sensitive data is never passed raw to LLM
- Designed for enterprise-safe usage only
