# LightMM

Unified **mmengine + lightning**-style framework for:

- **Agents** — first-class **loops** and **graphs** (config-driven, no LangChain/LangGraph)
- **Deep learning** — same registries, configs, Module hooks, and `Runner.from_cfg`

One mental model: register components → declare a config → `Runner.from_cfg(cfg).run(...)`.

## Install

```bash
pip install -e .
# optional
pip install -e ".[dev]"      # pytest
pip install -e ".[openai]"   # OpenAILLM
pip install -e ".[torch]"    # TrainRunner
```

## Quick starts

### 1) ReAct loop

```bash
python examples/react_loop/run.py
```

```python
from lightmm import Config, Runner

cfg = Config.fromfile("examples/react_loop/config.py")
state = Runner.from_cfg(cfg).run(input="What is 2 + 3 * 4?")
print(state.output)
```

### 2) Branching graph

```bash
python examples/branch_graph/run.py
```

Graphs support conditional routers, loop-back edges, and `AgentNode` (embed a loop inside a graph).

### 3) Training (Lightning-style hooks, pure PyTorch)

```bash
pip install -e ".[torch]"
python examples/cifar10/run.py --config examples/cifar10/config_tiny.py
# full CIFAR (needs torchvision):
# python examples/cifar10/run.py --config examples/cifar10/config.py
```

## Core concepts

| Piece | Role |
|---|---|
| **Registry** | `@TOOLS.register_module()`, `@LOOPS.register_module()`, … |
| **Config** | Python/YAML dicts with `type=` fields |
| **BaseModule** | Hooks: `step` (agents) / `training_step` (DL) |
| **LoopRunner** | Iterative control (`ReActLoop`, `WhileLoop`, `MaxStepsLoop`) |
| **GraphRunner** | Nodes + edges + routers (`StateGraph`) |
| **TrainRunner** | Epoch loop calling module hooks |
| **Callbacks** | Logging, checkpointing, budgets |

```python
from lightmm.registry import TOOLS, LLMS, LOOPS
from lightmm.agent.tools import BaseTool

@TOOLS.register_module()
class MyTool(BaseTool):
    name = "my_tool"
    description = "does a thing"
    def run(self, query: str = "", **kwargs):
        return query.upper()
```

## Layout

```
lightmm/
  registry.py config.py module.py
  agent/          # messages, tools, llms, memory, loops/, graphs/
  runner/         # LoopRunner, GraphRunner, TrainRunner
  callbacks/
  train/          # TinyClassifier, CIFAR helpers
examples/
  react_loop/
  branch_graph/
  cifar10/
tests/
```

## Design notes

- **Loops and graphs are both first-class** — not optional add-ons.
- Prefer `LoopRunner` for simple iterative agents; `GraphRunner` for branching / multi-stage / multi-agent handoff.
- Hybrid: put a `ReActLoop` inside an `AgentNode`.
- No LangChain/LangGraph dependency.

## Tests

```bash
pip install -e ".[dev]"
pytest -q
```
