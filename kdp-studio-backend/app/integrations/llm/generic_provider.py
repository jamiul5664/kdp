import json
import time
from collections.abc import AsyncIterator
from typing import Any, Dict, List, Optional
import httpx
from app.integrations.llm.base import LLMMessage, LLMProvider, LLMResponse, ModelConfiguration


class GenericCompatibleProvider(LLMProvider):
    """Provider for any OpenAI-compatible endpoint (Gemini OpenAI compat, Groq, Together, Ollama, vLLM)."""

    name = "generic_compatible"

    def __init__(self, api_key: str, base_url: str, provider_label: str = "generic_compatible") -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self.name = provider_label

    def _headers(self) -> Dict[str, str]:
        if not self._api_key:
            raise RuntimeError(f"API key for provider '{self.name}' is not configured.")
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def generate_text(
        self,
        messages: List[LLMMessage],
        config: ModelConfiguration,
    ) -> LLMResponse:
        started = time.perf_counter()
        payload = {
            "model": config.model_name,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
        }
        async with httpx.AsyncClient(timeout=config.timeout_seconds) as client:
            resp = await client.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        usage = data.get("usage", {})
        content = data["choices"][0]["message"]["content"]
        return LLMResponse(
            text=content,
            provider=self.name,
            model=config.model_name,
            prompt_tokens=int(usage.get("prompt_tokens", 0)),
            completion_tokens=int(usage.get("completion_tokens", 0)),
            total_tokens=int(usage.get("total_tokens", 0)),
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
        )

    async def generate_json(
        self,
        messages: List[LLMMessage],
        config: ModelConfiguration,
        json_schema: Optional[Dict[str, Any]] = None,
    ) -> LLMResponse:
        started = time.perf_counter()
        payload: Dict[str, Any] = {
            "model": config.model_name,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient(timeout=config.timeout_seconds) as client:
            resp = await client.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        usage = data.get("usage", {})
        raw = data["choices"][0]["message"]["content"]
        parsed = json.loads(raw)
        return LLMResponse(
            text=raw,
            provider=self.name,
            model=config.model_name,
            prompt_tokens=int(usage.get("prompt_tokens", 0)),
            completion_tokens=int(usage.get("completion_tokens", 0)),
            total_tokens=int(usage.get("total_tokens", 0)),
            parsed_json=parsed,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
        )

    async def stream_text(
        self,
        messages: List[LLMMessage],
        config: ModelConfiguration,
    ) -> AsyncIterator[str]:
        payload = {
            "model": config.model_name,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=config.timeout_seconds) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    if data_str == "[DONE]":
                        break
                    chunk = json.loads(data_str)
                    delta = chunk["choices"][0].get("delta", {}).get("content")
                    if delta:
                        yield delta
