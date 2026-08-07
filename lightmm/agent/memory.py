"""Conversation memory backends."""

from __future__ import annotations

from typing import Any, List, Optional, Sequence

from lightmm.agent.message import Message
from lightmm.registry import MEMORY


class BaseMemory:
    def add(self, message: Message) -> None:
        raise NotImplementedError

    def get(self) -> List[Message]:
        raise NotImplementedError

    def clear(self) -> None:
        raise NotImplementedError


@MEMORY.register_module()
class BufferMemory(BaseMemory):
    """Simple in-memory message buffer with optional max length."""

    def __init__(self, max_messages: Optional[int] = None, **kwargs: Any) -> None:
        self.max_messages = max_messages
        self._messages: List[Message] = []

    def add(self, message: Message) -> None:
        self._messages.append(message)
        if self.max_messages is not None and len(self._messages) > self.max_messages:
            self._messages = self._messages[-self.max_messages :]

    def extend(self, messages: Sequence[Message]) -> None:
        for m in messages:
            self.add(m)

    def get(self) -> List[Message]:
        return list(self._messages)

    def clear(self) -> None:
        self._messages.clear()
