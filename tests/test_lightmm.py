"""Unit and smoke tests for LightMM v1."""

from __future__ import annotations

from pathlib import Path

import pytest

from lightmm import Config, Runner
from lightmm.agent.message import AgentState
from lightmm.registry import LOOPS, LLMS, MODELS, TOOLS, GRAPHS, NODES, RUNNERS


ROOT = Path(__file__).resolve().parents[1]


def test_registry_build_tool():
    tool = TOOLS.build({"type": "CalculatorTool"})
    assert tool(expression="2+3*4") == "14"


def test_config_from_py(tmp_path: Path):
    cfg_path = tmp_path / "demo.py"
    cfg_path.write_text(
        'runner = dict(type="LoopRunner")\nwork_dir = "./w"\n',
        encoding="utf-8",
    )
    cfg = Config.fromfile(cfg_path)
    assert cfg.runner["type"] == "LoopRunner"
    assert cfg.work_dir == "./w"


def test_react_loop_with_fake_llm():
    import lightmm.agent  # noqa: F401

    loop = LOOPS.build(
        {
            "type": "ReActLoop",
            "max_steps": 5,
            "llm": {
                "type": "FakeLLM",
                "script": [
                    'TOOL_CALL: calculator\nARGS: {"expression": "1+2"}',
                    "FINAL_ANSWER: 3",
                ],
            },
            "tools": [{"type": "CalculatorTool"}],
        }
    )
    state = AgentState.from_input("calc")
    state = loop.run(state)
    assert state.stop is True
    assert state.output == "3"
    assert state.tool_results[0]["result"] == "3"


def test_loop_runner_from_cfg():
    cfg = Config.fromdict(
        {
            "llm": {
                "type": "FakeLLM",
                "script": [
                    'TOOL_CALL: echo\nARGS: {"text": "hi"}',
                    "FINAL_ANSWER: hi",
                ],
            },
            "tools": [{"type": "EchoTool"}],
            "loop": {"type": "ReActLoop", "max_steps": 4},
            "runner": {"type": "LoopRunner"},
            "callbacks": [{"type": "LoggingCallback", "verbose": False}],
            "work_dir": "./work_dir/test_loop",
        }
    )
    runner = Runner.from_cfg(cfg)
    state = runner.run(input="say hi")
    assert state.output == "hi"
    assert state.stop_reason in {"final_answer", "max_steps"}


def test_graph_runner_branch_and_tool():
    cfg = Config.fromdict(
        {
            "graph": {
                "type": "StateGraph",
                "entry": "route",
                "terminals": ["end"],
                "nodes": {
                    "route": {
                        "type": "LLMNode",
                        "llm": {"type": "FakeLLM", "script": ["please search now"]},
                    },
                    "search": {"type": "ToolNode", "tool": "EchoTool"},
                    "answer": {
                        "type": "LLMNode",
                        "llm": {"type": "FakeLLM", "script": ["FINAL_ANSWER: ok"]},
                        "final": True,
                    },
                    "end": {"type": "PassThroughNode"},
                },
                "edges": [
                    {
                        "source": "route",
                        "router": {
                            "type": "KeywordRouter",
                            "routes": {"search": "search"},
                            "default": "answer",
                        },
                    },
                    {"source": "search", "target": "answer"},
                    {"source": "answer", "target": "end"},
                ],
            },
            "runner": {"type": "GraphRunner"},
            "callbacks": [{"type": "LoggingCallback", "verbose": False}],
        }
    )
    state = Runner.from_cfg(cfg).run(input="hello")
    assert "search" in state.visit_counts
    assert state.tool_results
    assert state.stop is True


def test_hybrid_agent_node_wraps_loop():
    cfg = Config.fromdict(
        {
            "graph": {
                "type": "StateGraph",
                "entry": "agent",
                "terminals": ["end"],
                "nodes": {
                    "agent": {
                        "type": "AgentNode",
                        "loop": {
                            "type": "ReActLoop",
                            "max_steps": 3,
                            "llm": {
                                "type": "FakeLLM",
                                "script": ["FINAL_ANSWER: nested"],
                            },
                            "tools": [],
                        },
                    },
                    "end": {"type": "PassThroughNode"},
                },
                "edges": [{"source": "agent", "target": "end"}],
            },
            "runner": {"type": "GraphRunner"},
            "callbacks": [{"type": "LoggingCallback", "verbose": False}],
        }
    )
    state = Runner.from_cfg(cfg).run(input="nested please")
    assert state.output == "nested"
    assert state.scratch.get("agent_node_stop_reason") == "final_answer"


def test_example_configs_load():
    for rel in [
        "examples/react_loop/config.py",
        "examples/branch_graph/config.py",
        "examples/cifar10/config_tiny.py",
    ]:
        cfg = Config.fromfile(ROOT / rel)
        assert "runner" in cfg


@pytest.mark.skipif(
    __import__("importlib").util.find_spec("torch") is None,
    reason="torch not installed",
)
def test_train_runner_tiny():
    import lightmm.train  # noqa: F401

    cfg = Config.fromfile(ROOT / "examples/cifar10/config_tiny.py")
    cfg.callbacks = [{"type": "LoggingCallback", "verbose": False}]
    result = Runner.from_cfg(cfg).run()
    assert "history" in result
    assert len(result["history"]) == 2
    assert "loss" in result["history"][0]["train"]
