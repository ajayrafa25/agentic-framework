"""LLM providers via registry."""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional, Sequence, Union

from lightmm.agent.message import Message
from lightmm.registry import LLMS


class BaseLLM:
    """Minimal chat LLM interface."""

    def __init__(self, model: str = "default", **kwargs: Any) -> None:
        self.model = model
        self.kwargs = kwargs

    def generate(
        self,
        messages: Sequence[Union[Message, Dict[str, Any]]],
        **kwargs: Any,
    ) -> str:
        raise NotImplementedError

    @staticmethod
    def _normalize(messages: Sequence[Union[Message, Dict[str, Any]]]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for m in messages:
            if isinstance(m, Message):
                out.append(m.to_dict())
            else:
                out.append(dict(m))
        return out


@LLMS.register_module()
class FakeLLM(BaseLLM):
    """Deterministic LLM for tests and offline demos.

    Behavior:
      - If the last user/system content contains ``FINAL:`` → return that answer
      - If it contains ``CALC:expr`` → emit a calculator tool call
      - If it contains ``ECHO:text`` → emit an echo tool call
      - Else → return a final answer echoing the last user message
    """

    def __init__(self, model: str = "fake", script: Optional[List[str]] = None, **kwargs: Any) -> None:
        super().__init__(model=model, **kwargs)
        self.script = list(script or [])
        self._i = 0

    def generate(self, messages: Sequence[Union[Message, Dict[str, Any]]], **kwargs: Any) -> str:
        if self.script:
            if self._i >= len(self.script):
                return "FINAL_ANSWER: done"
            text = self.script[self._i]
            self._i += 1
            return text

        normalized = self._normalize(messages)
        last = normalized[-1]["content"] if normalized else ""
        if "FINAL:" in last:
            return "FINAL_ANSWER: " + last.split("FINAL:", 1)[1].strip()
        calc = re.search(r"CALC:(.+)$", last, flags=re.MULTILINE)
        if calc:
            expr = calc.group(1).strip()
            return f"TOOL_CALL: calculator\nARGS: {json.dumps({'expression': expr})}"
        echo = re.search(r"ECHO:(.+)$", last, flags=re.MULTILINE)
        if echo:
            text = echo.group(1).strip()
            return f"TOOL_CALL: echo\nARGS: {json.dumps({'text': text})}"
        # After a tool result, finalize.
        if any(m.get("role") == "tool" for m in normalized):
            tool_msgs = [m["content"] for m in normalized if m.get("role") == "tool"]
            return f"FINAL_ANSWER: {tool_msgs[-1]}"
        user_msgs = [m["content"] for m in normalized if m.get("role") == "user"]
        return f"FINAL_ANSWER: {user_msgs[-1] if user_msgs else last}"


@LLMS.register_module()
class OpenAILLM(BaseLLM):
    """OpenAI-compatible chat completions client (optional dependency)."""

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        temperature: float = 0.0,
        **kwargs: Any,
    ) -> None:
        super().__init__(model=model, **kwargs)
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.base_url = base_url
        self.temperature = temperature

    def generate(self, messages: Sequence[Union[Message, Dict[str, Any]]], **kwargs: Any) -> str:
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "openai is required for OpenAILLM. Install with: pip install lightmm[openai]"
            ) from exc
        client_kwargs: Dict[str, Any] = {}
        if self.api_key:
            client_kwargs["api_key"] = self.api_key
        if self.base_url:
            client_kwargs["base_url"] = self.base_url
        client = OpenAI(**client_kwargs)
        resp = client.chat.completions.create(
            model=self.model,
            messages=self._normalize(messages),
            temperature=kwargs.get("temperature", self.temperature),
        )
        return resp.choices[0].message.content or ""
