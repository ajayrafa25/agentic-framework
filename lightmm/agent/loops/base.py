"""First-class agent loops."""

from __future__ import annotations

import json
import re
from typing import Any, Callable, Dict, List, Optional, Sequence

from lightmm.agent.llm import BaseLLM
from lightmm.agent.message import AgentState
from lightmm.agent.tools import BaseTool, build_tools
from lightmm.registry import FUNCTIONS, LOOPS, LLMS, TOOLS


class BaseLoop:
    """Iterative control until should_stop."""

    def __init__(self, max_steps: int = 8, **kwargs: Any) -> None:
        self.max_steps = max_steps
        self.kwargs = kwargs

    def setup(self, state: AgentState) -> None:
        pass

    def step(self, state: AgentState) -> AgentState:
        raise NotImplementedError

    def should_stop(self, state: AgentState) -> bool:
        if state.stop:
            return True
        return state.step >= self.max_steps

    def run(self, state: AgentState) -> AgentState:
        self.setup(state)
        while not self.should_stop(state):
            state = self.step(state)
            state.step += 1
            if state.step >= self.max_steps and not state.stop:
                state.mark_stop("max_steps")
        return state


def _parse_tool_call(text: str) -> Optional[Dict[str, Any]]:
    """Parse a simple TOOL_CALL protocol from LLM text."""
    if "TOOL_CALL:" not in text:
        return None
    name_match = re.search(r"TOOL_CALL:\s*(\S+)", text)
    if not name_match:
        return None
    name = name_match.group(1).strip()
    args: Dict[str, Any] = {}
    args_match = re.search(r"ARGS:\s*(\{.*\})", text, flags=re.DOTALL)
    if args_match:
        try:
            args = json.loads(args_match.group(1))
        except json.JSONDecodeError:
            args = {"raw": args_match.group(1)}
    else:
        # Fallback: rest of line after tool name as query
        rest = text.split("TOOL_CALL:", 1)[1]
        parts = rest.split("\n", 1)
        if len(parts) > 1:
            args = {"query": parts[1].strip()}
    return {"name": name, "args": args}


def _parse_final(text: str) -> Optional[str]:
    if "FINAL_ANSWER:" in text:
        return text.split("FINAL_ANSWER:", 1)[1].strip()
    if text.strip().startswith("FINAL:"):
        return text.split("FINAL:", 1)[1].strip()
    return None


@LOOPS.register_module()
class MaxStepsLoop(BaseLoop):
    """Call a provided step_fn each iteration until max_steps or state.stop."""

    def __init__(
        self,
        step_fn: Optional[Callable[[AgentState], AgentState]] = None,
        max_steps: int = 8,
        **kwargs: Any,
    ) -> None:
        super().__init__(max_steps=max_steps, **kwargs)
        self.step_fn = step_fn

    def step(self, state: AgentState) -> AgentState:
        if self.step_fn is None:
            state.mark_stop("no_step_fn", output=state.output or state.input)
            return state
        return self.step_fn(state)


@LOOPS.register_module()
class WhileLoop(BaseLoop):
    """Loop while a registered/callable predicate returns True."""

    def __init__(
        self,
        predicate: Any = None,
        step_fn: Optional[Callable[[AgentState], AgentState]] = None,
        max_steps: int = 8,
        **kwargs: Any,
    ) -> None:
        super().__init__(max_steps=max_steps, **kwargs)
        self.predicate = self._resolve_predicate(predicate)
        self.step_fn = step_fn

    @staticmethod
    def _resolve_predicate(predicate: Any) -> Callable[[AgentState], bool]:
        if predicate is None:
            return lambda state: not state.stop
        if callable(predicate) and not isinstance(predicate, dict):
            return predicate
        if isinstance(predicate, str):
            fn = FUNCTIONS.get(predicate)
            return fn
        if isinstance(predicate, dict):
            fn = FUNCTIONS.build(predicate)
            return fn
        raise TypeError(f"Invalid predicate: {predicate!r}")

    def should_stop(self, state: AgentState) -> bool:
        if state.stop or state.step >= self.max_steps:
            return True
        return not bool(self.predicate(state))

    def step(self, state: AgentState) -> AgentState:
        if self.step_fn is None:
            state.mark_stop("no_step_fn")
            return state
        return self.step_fn(state)


@LOOPS.register_module()
class ReActLoop(BaseLoop):
    """Thought -> tool/act -> observe loop driven by an LLM + tools."""

    SYSTEM_PROMPT = (
        "You are a ReAct agent. On each turn respond with EITHER:\n"
        "TOOL_CALL: <tool_name>\nARGS: {{json}}\n"
        "OR\n"
        "FINAL_ANSWER: <answer>\n"
        "Available tools:\n{tool_list}"
    )

    def __init__(
        self,
        llm: Any = None,
        tools: Optional[Sequence[Any]] = None,
        max_steps: int = 8,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(max_steps=max_steps, **kwargs)
        self.llm = self._build_llm(llm)
        if isinstance(tools, dict):
            self.tools = tools
        else:
            self.tools = build_tools(list(tools or []))
        self.system_prompt = system_prompt or self.SYSTEM_PROMPT

    @staticmethod
    def _build_llm(llm: Any) -> BaseLLM:
        if llm is None:
            return LLMS.build({"type": "FakeLLM"})
        if isinstance(llm, BaseLLM):
            return llm
        if isinstance(llm, dict):
            return LLMS.build(llm)
        if isinstance(llm, str):
            return LLMS.build({"type": llm})
        raise TypeError(f"Invalid llm config: {llm!r}")

    def setup(self, state: AgentState) -> None:
        from lightmm.agent.message import Message

        tool_list = "\n".join(
            f"- {t.name}: {t.description}" for t in self.tools.values()
        ) or "- (none)"
        prompt = self.system_prompt.format(tool_list=tool_list)
        if state.messages and state.messages[0].role == "system":
            state.messages[0] = Message(role="system", content=prompt)
        else:
            state.messages.insert(0, Message(role="system", content=prompt))

    def step(self, state: AgentState) -> AgentState:
        text = self.llm.generate(state.messages)
        state.add_message("assistant", text)

        final = _parse_final(text)
        if final is not None:
            state.mark_stop("final_answer", output=final)
            return state

        call = _parse_tool_call(text)
        if call is None:
            # Treat free-form assistant text as final answer
            state.mark_stop("final_answer", output=text.strip())
            return state

        tool_name = call["name"]
        args = call.get("args") or {}
        tool = self.tools.get(tool_name)
        if tool is None:
            result = f"unknown_tool: {tool_name}"
        else:
            try:
                result = tool(**args) if isinstance(args, dict) else tool(args)
            except Exception as exc:  # noqa: BLE001
                result = f"tool_error: {exc}"
        state.tool_results.append({"tool": tool_name, "args": args, "result": result})
        state.add_message("tool", str(result), name=tool_name)
        return state
