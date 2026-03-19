"""
Async Ollama HTTP Client for kimi-k2.5:cloud
Bypasses sync LangChain for true async performance
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


class AsyncOllamaClient:
    """High-performance async client for local Ollama (kimi-k2.5:cloud)."""
    
    def __init__(
        self,
        host: str = "http://localhost:11434",
        model: str = "kimi-k2.5:cloud",
    ):
        self.host = host
        self.model = model
        self._client: Optional[httpx.AsyncClient] = None
    
    async def initialize(self) -> None:
        """Initialize persistent connection pool."""
        if self._client is not None:
            return
        
        limits = httpx.Limits(
            max_keepalive_connections=10,
            max_connections=20,
        )
        timeout = httpx.Timeout(300.0, connect=5.0)
        
        self._client = httpx.AsyncClient(
            limits=limits,
            timeout=timeout,
            headers={"Content-Type": "application/json"},
        )
        logger.info(f"AsyncOllamaClient initialized for {self.model}")
    
    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        num_ctx: int = 4096,
        num_predict: int = 512,
    ) -> str:
        """Non-streaming chat completion."""
        if not self._client:
            raise RuntimeError("Client not initialized")
        
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_ctx": num_ctx,
                "num_predict": num_predict,
            },
        }
        
        response = await self._client.post(
            f"{self.host}/api/chat",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data["message"]["content"]
    
    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        num_ctx: int = 4096,
        num_predict: int = 1024,
    ) -> AsyncGenerator[str, None]:
        """Streaming chat for kimi-k2.5:cloud."""
        if not self._client:
            raise RuntimeError("Client not initialized")
        
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_ctx": num_ctx,
                "num_predict": num_predict,
            },
        }
        
        async with self._client.stream(
            "POST",
            f"{self.host}/api/chat",
            json=payload,
        ) as response:
            response.raise_for_status()
            
            async for line in response.aiter_lines():
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                    if data.get("done", False):
                        break
                    
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield content
                        
                except json.JSONDecodeError:
                    continue


# Global singleton
_ollama_client: Optional[AsyncOllamaClient] = None


async def get_ollama_client() -> AsyncOllamaClient:
    global _ollama_client
    if _ollama_client is None:
        _ollama_client = AsyncOllamaClient(
            host=getattr(settings, 'OLLAMA_HOST', 'http://localhost:11434'),
            model=getattr(settings, 'OLLAMA_MODEL', 'kimi-k2.5:cloud'),
        )
        await _ollama_client.initialize()
    return _ollama_client


async def initialize_ollama() -> None:
    await get_ollama_client()


async def close_ollama() -> None:
    global _ollama_client
    if _ollama_client:
        await _ollama_client.close()
        _ollama_client = None
