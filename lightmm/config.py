"""Config loading and merging (MMEngine-style .py / .yaml / dict)."""

from __future__ import annotations

import ast
import importlib.util
import os
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, Mapping, MutableMapping, Optional, Union

import yaml


def _merge_dict(base: MutableMapping[str, Any], override: Mapping[str, Any]) -> MutableMapping[str, Any]:
    for key, value in override.items():
        if (
            key in base
            and isinstance(base[key], dict)
            and isinstance(value, Mapping)
        ):
            _merge_dict(base[key], value)
        else:
            base[key] = deepcopy(value)
    return base


class Config(dict):
    """Dict-like config with attribute access and file loading."""

    def __getattr__(self, item: str) -> Any:
        try:
            return self[item]
        except KeyError as exc:
            raise AttributeError(item) from exc

    def __setattr__(self, key: str, value: Any) -> None:
        self[key] = value

    def __delattr__(self, item: str) -> None:
        try:
            del self[item]
        except KeyError as exc:
            raise AttributeError(item) from exc

    def merge_from_dict(self, options: Mapping[str, Any]) -> "Config":
        _merge_dict(self, options)
        return self

    def copy(self) -> "Config":  # type: ignore[override]
        return Config(deepcopy(dict(self)))

    def to_dict(self) -> Dict[str, Any]:
        return deepcopy(dict(self))

    @classmethod
    def fromfile(cls, filename: Union[str, Path]) -> "Config":
        path = Path(filename)
        if not path.exists():
            raise FileNotFoundError(path)
        suffix = path.suffix.lower()
        if suffix == ".py":
            data = cls._load_py(path)
        elif suffix in {".yaml", ".yml"}:
            with path.open("r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
        elif suffix == ".json":
            import json

            with path.open("r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            raise ValueError(f"Unsupported config format: {suffix}")
        if not isinstance(data, dict):
            raise TypeError(f"Config root must be a dict, got {type(data)}")
        cfg = cls(data)
        cfg["_filename"] = str(path.resolve())
        return cfg

    @classmethod
    def fromdict(cls, data: Mapping[str, Any]) -> "Config":
        return cls(deepcopy(dict(data)))

    @staticmethod
    def _load_py(path: Path) -> Dict[str, Any]:
        # Execute as a module so users can use normal Python in configs.
        module_name = f"lightmm_cfg_{path.stem}_{abs(hash(str(path)))}"
        spec = importlib.util.spec_from_file_location(module_name, path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load config module from {path}")
        module = importlib.util.module_from_spec(spec)
        # Provide a clean namespace; disallow relative imports surprises.
        module.__dict__["__file__"] = str(path)
        spec.loader.exec_module(module)
        data: Dict[str, Any] = {}
        for key, value in module.__dict__.items():
            if key.startswith("_"):
                continue
            # Skip imported modules/functions/classes by default unless assigned
            # at module level as config values (dicts/lists/primitives/etc.).
            if callable(value) and not isinstance(value, type):
                # Allow registered type strings only via dict configs.
                continue
            if isinstance(value, type):
                continue
            data[key] = value
        return data

    def dump(self, filename: Optional[Union[str, Path]] = None) -> Optional[str]:
        text = yaml.safe_dump(self.to_dict(), sort_keys=False)
        if filename is None:
            return text
        path = Path(filename)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return None
