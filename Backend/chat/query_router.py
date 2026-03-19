import ollama
import json

def route_query(message: str) -> str:
    prompt = f"""
You are a routing classifier for a knowledge system.

Classify the user request into ONE of these categories:

db_lookup  -> question about system state (documents, counts, files)
rag        -> question about information inside uploaded documents
general    -> general conversation not tied to documents

Return ONLY JSON:
{{"route":"db_lookup"}}

User question:
{message}
"""
    
    try:
        resp = ollama.chat(
            model="phi3:mini",
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0}
        )

        content = resp["message"]["content"]
        data = json.loads(content)
        print("Routing classifier output:", data)
        return data.get("route", "rag")

    except Exception:
        return "rag"