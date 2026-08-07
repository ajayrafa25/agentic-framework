"""Agent messages and shared mutable state."""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional


@dataclass
class Message:
    role: str
    content: str
    name: Optional[str] = None
    tool_call_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        return {k: v for k, v in data.items() if v is not None}


@dataclass
class AgentState:
    """Shared state for LoopRunner and GraphRunner."""

    input: str = ""
    messages: List[Message] = field(default_factory=list)
    scratch: Dict[str, Any] = field(default_factory=dict)
    tool_results: List[Dict[str, Any]] = field(default_factory=list)
    output: Optional[str] = None
    stop: bool = False
    stop_reason: Optional[str] = None
    step: int = 0
    current_node: Optional[str] = None
    visit_counts: Dict[str, int] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_message(self, role: str, content: str, **kwargs: Any) -> None:
        self.messages.append(Message(role=role, content=content, **kwargs))

    def mark_stop(self, reason: str = "done", output: Optional[str] = None) -> None:
        self.stop = True
        self.stop_reason = reason
        if output is not None:
            self.output = output

    def to_dict(self) -> Dict[str, Any]:
        return {
            "input": self.input,
            "messages": [m.to_dict() for m in self.messages],
            "scratch": self.scratch,
            "tool_results": self.tool_results,
            "output": self.output,
            "stop": self.stop,
            "stop_reason": self.stop_reason,
            "step": self.step,
            "current_node": self.current_node,
            "visit_counts": self.visit_counts,
            "metadata": self.metadata,
        }

    @classmethod
    def from_input(cls, user_input: str, **kwargs: Any) -> "AgentState":
        state = cls(input=user_input, **kwargs)
        state.add_message("user", user_input)
        return state
