"""MMEngine-style registries for config-driven construction."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Callable, Dict, Optional, Type, TypeVar

T = TypeVar("T")


class Registry:
    """Simple name -> class/function registry with build_from_cfg support."""

    def __init__(self, name: str, parent: Optional["Registry"] = None) -> None:
        self.name = name
        self._module_dict: Dict[str, Any] = {}
        self.parent = parent

    def register_module(
        self,
        name: Optional[str] = None,
        force: bool = False,
        module: Any = None,
    ) -> Callable[[T], T] | T:
        """Register a module class or function.

        Usage:
            @MODELS.register_module()
            class Foo: ...

            @MODELS.register_module(name="Bar", force=True)
            class Baz: ...
        """

        def _register(obj: T) -> T:
            key = name or getattr(obj, "__name__", None)
            if key is None:
                raise ValueError("Cannot infer registry name for object")
            if key in self._module_dict and not force:
                raise KeyError(
                    f"{key} is already registered in {self.name}. "
                    "Use force=True to override."
                )
            self._module_dict[key] = obj
            return obj

        if module is not None:
            return _register(module)
        return _register

    def get(self, key: str) -> Any:
        if key in self._module_dict:
            return self._module_dict[key]
        if self.parent is not None:
            return self.parent.get(key)
        raise KeyError(f"{key!r} is not registered in {self.name}")

    def build(self, cfg: Dict[str, Any], default_args: Optional[Dict[str, Any]] = None) -> Any:
        return build_from_cfg(cfg, self, default_args=default_args)

    def __contains__(self, key: str) -> bool:
        if key in self._module_dict:
            return True
        if self.parent is not None:
            return key in self.parent
        return False

    def __repr__(self) -> str:
        return f"Registry(name={self.name}, items={list(self._module_dict)})"


def build_from_cfg(
    cfg: Dict[str, Any],
    registry: Registry,
    default_args: Optional[Dict[str, Any]] = None,
) -> Any:
    """Build an object from a dict config with a ``type`` field."""
    if not isinstance(cfg, dict):
        raise TypeError(f"cfg must be a dict, got {type(cfg)}")
    if "type" not in cfg:
        raise KeyError(f"cfg must contain 'type', got keys={list(cfg)}")

    args = deepcopy(cfg)
    obj_type = args.pop("type")
    if default_args:
        for k, v in default_args.items():
            args.setdefault(k, v)

    if isinstance(obj_type, str):
        obj_cls = registry.get(obj_type)
    elif isinstance(obj_type, type) or callable(obj_type):
        obj_cls = obj_type
    else:
        raise TypeError(f"Invalid type field: {obj_type!r}")

    try:
        return obj_cls(**args)
    except TypeError as exc:
        raise TypeError(f"Failed to build {obj_cls} with args={args}: {exc}") from exc


# Global registries (mmengine-like)
MODELS = Registry("models")
DATASETS = Registry("datasets")
FUNCTIONS = Registry("functions")
HOOKS = Registry("hooks")
RUNNERS = Registry("runners")

# Agent registries
AGENTS = Registry("agents")
TOOLS = Registry("tools")
LLMS = Registry("llms")
MEMORY = Registry("memory")
LOOPS = Registry("loops")
GRAPHS = Registry("graphs")
NODES = Registry("nodes")
EDGES = Registry("edges")
