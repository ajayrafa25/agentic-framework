"""Tool base class and demo tools."""

from __future__ import annotations

import ast
import operator
import urllib.request
from typing import Any, Dict, Optional

from lightmm.registry import TOOLS


class BaseTool:
    """Callable tool with a name and description for LLM prompting."""

    name: str = "base_tool"
    description: str = ""

    def __init__(self, name: Optional[str] = None, description: Optional[str] = None, **kwargs: Any) -> None:
        if name:
            self.name = name
        if description:
            self.description = description
        self.kwargs = kwargs

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        return self.run(*args, **kwargs)

    def run(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError

    def schema(self) -> Dict[str, Any]:
        return {"name": self.name, "description": self.description}


@TOOLS.register_module()
class EchoTool(BaseTool):
    name = "echo"
    description = "Echo back the provided text."

    def run(self, text: str = "", **kwargs: Any) -> str:
        return str(text)


@TOOLS.register_module()
class CalculatorTool(BaseTool):
    name = "calculator"
    description = "Evaluate a basic arithmetic expression, e.g. '2 + 3 * 4'."

    _OPS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.USub: operator.neg,
        ast.UAdd: operator.pos,
    }

    def run(self, expression: str = "", **kwargs: Any) -> str:
        expr = expression or kwargs.get("query") or kwargs.get("text") or ""
        try:
            value = self._eval(ast.parse(expr, mode="eval").body)
            if isinstance(value, float) and value.is_integer():
                return str(int(value))
            return str(value)
        except Exception as exc:  # noqa: BLE001 - surface tool errors to agent
            return f"calculator_error: {exc}"

    def _eval(self, node: ast.AST) -> float:
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.BinOp):
            op = self._OPS.get(type(node.op))
            if op is None:
                raise ValueError("unsupported operator")
            return op(self._eval(node.left), self._eval(node.right))
        if isinstance(node, ast.UnaryOp):
            op = self._OPS.get(type(node.op))
            if op is None:
                raise ValueError("unsupported unary operator")
            return op(self._eval(node.operand))
        raise ValueError("unsupported expression")


@TOOLS.register_module()
class HttpGetTool(BaseTool):
    name = "http_get"
    description = "HTTP GET a URL and return up to max_chars of response text."

    def __init__(self, max_chars: int = 2000, timeout: float = 10.0, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.max_chars = max_chars
        self.timeout = timeout

    def run(self, url: str = "", **kwargs: Any) -> str:
        target = url or kwargs.get("query") or ""
        if not target:
            return "http_get_error: url required"
        try:
            with urllib.request.urlopen(target, timeout=self.timeout) as resp:  # noqa: S310
                data = resp.read().decode("utf-8", errors="replace")
            return data[: self.max_chars]
        except Exception as exc:  # noqa: BLE001
            return f"http_get_error: {exc}"


def build_tools(tool_cfgs: list) -> Dict[str, BaseTool]:
    """Build a name->tool map from a list of configs or instances."""
    tools: Dict[str, BaseTool] = {}
    for cfg in tool_cfgs or []:
        if isinstance(cfg, BaseTool):
            tool = cfg
        elif isinstance(cfg, dict):
            tool = TOOLS.build(cfg)
        elif isinstance(cfg, str):
            tool = TOOLS.build({"type": cfg})
        else:
            raise TypeError(f"Invalid tool config: {cfg!r}")
        tools[tool.name] = tool
    return tools
