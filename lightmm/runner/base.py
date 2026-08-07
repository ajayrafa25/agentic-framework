"""Runner orchestration: LoopRunner, GraphRunner, TrainRunner."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

from lightmm.callbacks import Callback, LoggingCallback, call_callbacks
from lightmm.config import Config
from lightmm.registry import GRAPHS, HOOKS, LOOPS, LLMS, MEMORY, MODELS, RUNNERS, TOOLS, build_from_cfg


class Runner:
    """Base runner. Use Runner.from_cfg(cfg) to dispatch."""

    def __init__(
        self,
        callbacks: Optional[List[Any]] = None,
        work_dir: str = "./work_dir",
        **kwargs: Any,
    ) -> None:
        self.work_dir = work_dir
        self.callbacks = self._build_callbacks(callbacks)
        self.kwargs = kwargs

    @staticmethod
    def _build_callbacks(callbacks: Optional[List[Any]]) -> List[Callback]:
        if not callbacks:
            return [LoggingCallback()]
        out: List[Callback] = []
        for cb in callbacks:
            if isinstance(cb, Callback):
                out.append(cb)
            elif isinstance(cb, dict):
                out.append(HOOKS.build(cb))
            elif isinstance(cb, str):
                out.append(HOOKS.build({"type": cb}))
            else:
                raise TypeError(f"Invalid callback: {cb!r}")
        return out

    def run(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError

    @classmethod
    def from_cfg(cls, cfg: Union[Config, Dict[str, Any]]) -> "Runner":
        if not isinstance(cfg, Config):
            cfg = Config.fromdict(cfg)
        # Import side-effects: register built-ins
        import lightmm.agent  # noqa: F401
        import lightmm.train  # noqa: F401
        import lightmm.runner.loop  # noqa: F401
        import lightmm.runner.graph  # noqa: F401
        import lightmm.runner.train  # noqa: F401

        runner_cfg = cfg.get("runner")
        if runner_cfg is None:
            raise KeyError("Config must define 'runner'")
        if isinstance(runner_cfg, str):
            runner_cfg = {"type": runner_cfg}
        else:
            runner_cfg = dict(runner_cfg)

        # Inject top-level sections as default args when not already present
        defaults = {
            "work_dir": cfg.get("work_dir", "./work_dir"),
            "callbacks": cfg.get("callbacks"),
            "llm": cfg.get("llm"),
            "tools": cfg.get("tools"),
            "loop": cfg.get("loop"),
            "graph": cfg.get("graph"),
            "memory": cfg.get("memory"),
            "model": cfg.get("model"),
            "train_dataloader": cfg.get("train_dataloader"),
            "val_dataloader": cfg.get("val_dataloader"),
            "max_epochs": cfg.get("max_epochs"),
            "accelerator": cfg.get("accelerator"),
        }
        for k, v in defaults.items():
            if v is not None:
                runner_cfg.setdefault(k, v)

        return RUNNERS.build(runner_cfg)


@RUNNERS.register_module()
class LoopRunner(Runner):
    """Drive a first-class Loop (ReAct / while / max-steps)."""

    def __init__(
        self,
        loop: Any = None,
        llm: Any = None,
        tools: Any = None,
        memory: Any = None,
        max_turns: Optional[int] = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self.llm = self._maybe_build(llm, LLMS)
        self.tools = tools
        self.memory = self._maybe_build(memory, MEMORY) if memory else None
        self.loop = self._build_loop(loop, max_turns)

    @staticmethod
    def _maybe_build(obj: Any, registry: Any) -> Any:
        if obj is None:
            return None
        if isinstance(obj, dict):
            return registry.build(obj)
        if isinstance(obj, str):
            return registry.build({"type": obj})
        return obj

    def _build_loop(self, loop: Any, max_turns: Optional[int]) -> Any:
        if loop is None:
            loop = {"type": "ReActLoop"}
        if isinstance(loop, dict):
            loop_cfg = dict(loop)
            if self.llm is not None:
                loop_cfg.setdefault("llm", self.llm)
            if self.tools is not None:
                loop_cfg.setdefault("tools", self.tools)
            if max_turns is not None:
                loop_cfg.setdefault("max_steps", max_turns)
            return LOOPS.build(loop_cfg)
        if isinstance(loop, str):
            return self._build_loop({"type": loop}, max_turns)
        return loop

    def run(self, input: str = "", state: Any = None, **kwargs: Any) -> Any:
        from lightmm.agent.message import AgentState

        if state is None:
            state = AgentState.from_input(input)
        call_callbacks(self.callbacks, "on_run_start", self)
        call_callbacks(self.callbacks, "on_loop_start", self, state)
        self.loop.setup(state)
        while not self.loop.should_stop(state):
            state = self.loop.step(state)
            state.step += 1
            call_callbacks(self.callbacks, "on_step_end", self, state, state.step)
            if state.step >= self.loop.max_steps and not state.stop:
                state.mark_stop("max_steps")
        call_callbacks(self.callbacks, "on_loop_end", self, state)
        call_callbacks(self.callbacks, "on_run_end", self, state)
        return state


@RUNNERS.register_module()
class GraphRunner(Runner):
    """Execute a first-class StateGraph."""

    def __init__(self, graph: Any = None, llm: Any = None, tools: Any = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.llm = llm
        self.tools = tools
        self.graph = self._build_graph(graph)

    def _build_graph(self, graph: Any) -> Any:
        if graph is None:
            raise ValueError("GraphRunner requires a graph config")
        if isinstance(graph, dict):
            # Optionally inject shared llm into LLMNodes lacking one
            gcfg = dict(graph)
            if self.llm is not None and "nodes" in gcfg:
                nodes = {}
                for name, ncfg in gcfg["nodes"].items():
                    ncfg = dict(ncfg) if isinstance(ncfg, dict) else ncfg
                    if isinstance(ncfg, dict) and ncfg.get("type") == "LLMNode":
                        ncfg.setdefault("llm", self.llm)
                    nodes[name] = ncfg
                gcfg["nodes"] = nodes
            return GRAPHS.build(gcfg)
        if isinstance(graph, str):
            return GRAPHS.build({"type": graph})
        return graph

    def run(self, input: str = "", state: Any = None, **kwargs: Any) -> Any:
        from lightmm.agent.message import AgentState

        if state is None:
            state = AgentState.from_input(input)
        call_callbacks(self.callbacks, "on_run_start", self)

        # Manual execution to fire node callbacks
        if not self.graph.entry:
            raise RuntimeError("graph has no entry")
        node_name = self.graph.entry
        steps = 0
        while node_name is not None:
            if steps >= self.graph.max_steps:
                state.mark_stop("graph_max_steps", output=state.output)
                break
            visits = state.visit_counts.get(node_name, 0) + 1
            state.visit_counts[node_name] = visits
            if visits > self.graph.max_node_visits:
                state.mark_stop("max_node_visits", output=state.output)
                break

            state.current_node = node_name
            call_callbacks(self.callbacks, "on_node_start", self, node_name, state)
            state = self.graph.nodes[node_name].run(state)
            call_callbacks(self.callbacks, "on_node_end", self, node_name, state)
            steps += 1

            if state.stop or node_name in self.graph.terminals:
                if not state.stop:
                    state.mark_stop("terminal_node", output=state.output)
                break

            nxt = self.graph.next_node(node_name, state)
            if nxt is not None:
                call_callbacks(self.callbacks, "on_edge", self, node_name, nxt, state)
            node_name = nxt

        if not state.stop:
            state.mark_stop("graph_complete", output=state.output)
        call_callbacks(self.callbacks, "on_run_end", self, state)
        return state
