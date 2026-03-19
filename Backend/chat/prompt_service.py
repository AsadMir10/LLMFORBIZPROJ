import os
import re
import logging
from ollama import AsyncClient as AsyncOllama
from pinecone import Pinecone
from .models import PromptSuggestion

logger = logging.getLogger(__name__)


async def regenerate_prompts() -> None:
    try:
        index_name = os.environ.get("PINECONE_INDEX_NAME", "enterprise-rag")
        api_key = os.environ.get("PINECONE_API_KEY")

        if not api_key:
            return

        # ----------------------------------------------------------
        # Sync Pinecone client to resolve host (no async context needed)
        # Then pc.IndexAsyncio(host=...) for async data ops
        # This is the exact pattern from official SDK docs
        # ----------------------------------------------------------
        pc = Pinecone(api_key=api_key)

        # sync call — resolves immediately, no await needed
        description = pc.describe_index(index_name)
        index_host = description.host

        query_vector = [0.0] * 384
        texts = []

        async with pc.IndexAsyncio(host=index_host) as idx:
            results = await idx.query(
                vector=query_vector,
                top_k=10,
                include_metadata=True,
            )

        for match in results.get("matches", []):
            meta = match.get("metadata", {})
            text = meta.get("text") or meta.get("chunk")
            if text:
                texts.append(text[:400])

        if not texts:
            await PromptSuggestion.objects.all().adelete()
            return

        # ----------------------------------------------------------
        # Async Ollama call
        # ----------------------------------------------------------
        context = "\n\n".join(texts)
        prompt = f"""Based on the following context, write 4 distinct, short questions a user might ask.
Do not use numbers, bullets, or intro text. Put each question on a completely new line.

Context:
{context}
"""

        client = AsyncOllama()
        response = await client.chat(
            model="phi3:mini",
            messages=[{"role": "user", "content": prompt}],
            options={"num_predict": 150, "temperature": 0.2},
        )

        content = response["message"]["content"]
        logger.info("Raw LLM Output:\n%s", content)

        suggestions = []
        for line in content.split("\n"):
            clean_line = re.sub(r"^[\d\.\-\*\s]+", "", line).strip()
            if len(clean_line) > 10 and "?" in clean_line:
                suggestions.append(clean_line)

        if suggestions:
            await PromptSuggestion.objects.all().adelete()
            for s in suggestions[:4]:
                logger.info("Saving prompt suggestion: %s", s)
                await PromptSuggestion.objects.acreate(text=s)
        else:
            logger.warning("Failed to extract any valid questions from LLM output.")

    except Exception as e:
        logger.error("Failed to regenerate prompts: %s", e)
