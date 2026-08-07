"""First-class agent graphs: nodes, edges, routers, executor."""

from __future__ import annotations

import re
from copy import deepcopy
from typing import Any, Callable, Dict, List, Optional, Union

from lightmm.agent.llm import BaseLLM
from lightmm.agent.loops.base import BaseLoop, ReActLoop
from lightmm.agent.message import AgentState, Message
from lightmm.agent.tools import BaseTool, build_tools
from lightmm.registry import FUNCTIONS, GRAPHS, LLMS, LOOPS, NODES, TOOLS


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------


class BaseNode:
    def __init__(self, name: Optional[str] = None, **kwargs: Any) -> None:
        self.name = name or type(self).__name__
        self.kwargs = kwargs

    def __call__(self, state: AgentState) -> AgentState:
        return self.run(state)

    def run(self, state: AgentState) -> AgentState:
        raise NotImplementedError


@NODES.register_module()
class PassThroughNode(BaseNode):
    """No-op / terminal-friendly node."""

    def run(self, state: AgentState) -> AgentState:
        return state


@NODES.register_module()
class LLMNode(BaseNode):
    def __init__(self, llm: Any = None, prompt: Optional[str] = None, final: bool = False, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.llm = self._build_llm(llm)
        self.prompt = prompt
        self.final = final

    @staticmethod
    def _build_llm(llm: Any) -> BaseLLM:
        if llm is None:
            return LLMS.build({"type": "FakeLLM"})
        if isinstance(llm, BaseLLM):
            return llm
        if isinstance(llm, dict):
            return LLMS.build(llm)
        if isinstance(llm, str):
            # Allow referencing a shared object key later; treat as type for v1
            return LLMS.build({"type": llm})
        raise TypeError(f"Invalid llm: {llm!r}")

    def run(self, state: AgentState) -> AgentState:
        if self.prompt:
            state.add_message("system", self.prompt)
        text = self.llm.generate(state.messages)
        state.add_message("assistant", text)
        state.scratch["last_llm"] = text
        if self.final:
            state.mark_stop("llm_final", output=text)
        return state


@NODES.register_module()
class ToolNode(BaseNode):
    def __init__(
        self,
        tool: Any = None,
        arg_key: str = "input",
        result_key: str = "tool_result",
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self.tool = self._build_tool(tool)
        self.arg_key = arg_key
        self.result_key = result_key

    @staticmethod
    def _build_tool(tool: Any) -> BaseTool:
        if isinstance(tool, BaseTool):
            return tool
        if isinstance(tool, dict):
            return TOOLS.build(tool)
        if isinstance(tool, str):
            return TOOLS.build({"type": tool})
        raise TypeError(f"Invalid tool: {tool!r}")

    def run(self, state: AgentState) -> AgentState:
        # Prefer scratch override, else user input
        arg = state.scratch.get(self.arg_key, state.input)
        # Map common tool signatures
        if self.tool.name == "calculator":
            result = self.tool(expression=str(arg))
        elif self.tool.name == "echo":
            result = self.tool(text=str(arg))
        elif self.tool.name == "http_get":
            result = self.tool(url=str(arg))
        else:
            result = self.tool(arg)
        state.tool_results.append({"tool": self.tool.name, "result": result})
        state.scratch[self.result_key] = result
        state.add_message("tool", str(result), name=self.tool.name)
        return state


@NODES.register_module()
class AgentNode(BaseNode):
    """Embed a Loop (e.g. ReActLoop) as a single graph node."""

    def __init__(self, loop: Any = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.loop = self._build_loop(loop)

    @staticmethod
    def _build_loop(loop: Any) -> BaseLoop:
        if loop is None:
            return LOOPS.build({"type": "ReActLoop"})
        if isinstance(loop, BaseLoop):
            return loop
        if isinstance(loop, dict):
            return LOOPS.build(loop)
        if isinstance(loop, str):
            return LOOPS.build({"type": loop})
        raise TypeError(f"Invalid loop: {loop!r}")

    def run(self, state: AgentState) -> AgentState:
        # Run nested loop starting from current step count without resetting stop unless needed
        nested = AgentState(
            input=state.input,
            messages=list(state.messages),
            scratch=dict(state.scratch),
            tool_results=list(state.tool_results),
            output=state.output,
            stop=False,
            metadata=dict(state.metadata),
        )
        nested = self.loop.run(nested)
        state.messages = nested.messages
        state.scratch = nested.scratch
        state.tool_results = nested.tool_results
        state.output = nested.output
        if nested.stop:
            state.scratch["agent_node_stop_reason"] = nested.stop_reason
        return state


# ---------------------------------------------------------------------------
# Routers / edges
# ---------------------------------------------------------------------------


class BaseRouter:
    def __call__(self, state: AgentState) -> str:
        return self.route(state)

    def route(self, state: AgentState) -> str:
        raise NotImplementedError


@FUNCTIONS.register_module()
class KeywordRouter(BaseRouter):
    """Route based on keywords found in last assistant message / scratch."""

    def __init__(
        self,
        routes: Optional[Dict[str, str]] = None,
        default: Optional[str] = None,
        source_key: str = "last_llm",
        **kwargs: Any,
    ) -> None:
        self.routes = routes or {}
        self.default = default
        self.source_key = source_key

    def route(self, state: AgentState) -> str:
        text = str(state.scratch.get(self.source_key, ""))
        if not text and state.messages:
            text = state.messages[-1].content
        lower = text.lower()
        for keyword, target in self.routes.items():
            if keyword.lower() in lower:
                return target
        if self.default:
            return self.default
        raise ValueError(f"KeywordRouter could not route text={text!r}")


@FUNCTIONS.register_module()
class CallableRouter(BaseRouter):
    def __init__(self, fn: Optional[Callable[[AgentState], str]] = None, **kwargs: Any) -> None:
        if fn is None:
            raise ValueError("CallableRouter requires fn")
        self.fn = fn

    def route(self, state: AgentState) -> str:
        return self.fn(state)


@FUNCTIONS.register_module()
class FixedRouter(BaseRouter):
    def __init__(self, target: str, **kwargs: Any) -> None:
        self.target = target

    def route(self, state: AgentState) -> str:
        return self.target


def _build_router(spec: Any) -> Optional[BaseRouter]:
    if spec is None:
        return None
    if isinstance(spec, BaseRouter):
        return spec
    if callable(spec) and not isinstance(spec, dict):
        return CallableRouter(fn=spec)
    if isinstance(spec, str):
        return FixedRouter(target=spec)
    if isinstance(spec, dict):
        if "type" in spec:
            obj = FUNCTIONS.build(spec)
            if isinstance(obj, BaseRouter):
                return obj
            if callable(obj):
                return CallableRouter(fn=obj)
            raise TypeError(f"Router build returned non-router: {obj!r}")
        if "target" in spec:
            return FixedRouter(target=spec["target"])
        if "routes" in spec:
            return KeywordRouter(**spec)
    raise TypeError(f"Invalid router spec: {spec!r}")


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------


@GRAPHS.register_module()
class StateGraph:
    """Config-driven state graph with named nodes and routers."""

    def __init__(
        self,
        nodes: Optional[Dict[str, Any]] = None,
        edges: Optional[List[Dict[str, Any]]] = None,
        entry: Optional[str] = None,
        terminals: Optional[List[str]] = None,
        max_node_visits: int = 20,
        max_steps: int = 50,
        **kwargs: Any,
    ) -> None:
        self.raw_nodes = nodes or {}
        self.nodes: Dict[str, BaseNode] = {
            name: self._build_node(name, cfg) for name, cfg in self.raw_nodes.items()
        }
        self.edges = edges or []
        self.entry = entry or (next(iter(self.nodes)) if self.nodes else None)
        self.terminals = set(terminals or [])
        self.max_node_visits = max_node_visits
        self.max_steps = max_steps
        self._edge_map = self._compile_edges(self.edges)

    @staticmethod
    def _build_node(name: str, cfg: Any) -> BaseNode:
        if isinstance(cfg, BaseNode):
            cfg.name = name
            return cfg
        if isinstance(cfg, dict):
            node_cfg = deepcopy(cfg)
            node_cfg.setdefault("name", name)
            return NODES.build(node_cfg)
        if isinstance(cfg, str):
            return NODES.build({"type": cfg, "name": name})
        raise TypeError(f"Invalid node config for {name}: {cfg!r}")

    def _compile_edges(self, edges: List[Dict[str, Any]]) -> Dict[str, Any]:
        mapping: Dict[str, Any] = {}
        for edge in edges:
            source = edge["source"]
            if "router" in edge:
                mapping[source] = _build_router(edge["router"])
            elif "target" in edge:
                mapping[source] = FixedRouter(target=edge["target"])
            else:
                raise KeyError(f"Edge for {source} needs target or router")
        return mapping

    def next_node(self, source: str, state: AgentState) -> Optional[str]:
        if source in self.terminals:
            return None
        router = self._edge_map.get(source)
        if router is None:
            return None
        target = router.route(state)
        if target in {"__end__", "END", "end"} and target not in self.nodes:
            return None
        return target

    def run(self, state: AgentState) -> AgentState:
        if not self.entry:
            raise RuntimeError("StateGraph has no entry node")
        node_name: Optional[str] = self.entry
        steps = 0
        while node_name is not None:
            if steps >= self.max_steps:
                state.mark_stop("graph_max_steps", output=state.output)
                break
            visits = state.visit_counts.get(node_name, 0) + 1
            state.visit_counts[node_name] = visits
            if visits > self.max_node_visits:
                state.mark_stop("max_node_visits", output=state.output)
                break

            state.current_node = node_name
            node = self.nodes[node_name]
            state = node.run(state)
            steps += 1

            if state.stop:
                break
            if node_name in self.terminals:
                state.mark_stop("terminal_node", output=state.output)
                break

            node_name = self.next_node(node_name, state)

        if not state.stop:
            state.mark_stop("graph_complete", output=state.output)
        return state
