"""Callback / hook base classes."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


class Callback:
    """Lifecycle hooks shared by Loop / Graph / Train runners."""

    def on_run_start(self, runner: Any, **kwargs: Any) -> None:
        pass

    def on_run_end(self, runner: Any, result: Any = None, **kwargs: Any) -> None:
        pass

    def on_loop_start(self, runner: Any, state: Any, **kwargs: Any) -> None:
        pass

    def on_step_end(self, runner: Any, state: Any, step: int, **kwargs: Any) -> None:
        pass

    def on_loop_end(self, runner: Any, state: Any, **kwargs: Any) -> None:
        pass

    def on_node_start(self, runner: Any, node_name: str, state: Any, **kwargs: Any) -> None:
        pass

    def on_node_end(self, runner: Any, node_name: str, state: Any, **kwargs: Any) -> None:
        pass

    def on_edge(self, runner: Any, source: str, target: str, state: Any, **kwargs: Any) -> None:
        pass

    def on_train_epoch_start(self, runner: Any, epoch: int, **kwargs: Any) -> None:
        pass

    def on_train_epoch_end(self, runner: Any, epoch: int, metrics: Dict[str, Any], **kwargs: Any) -> None:
        pass

    def on_val_epoch_end(self, runner: Any, epoch: int, metrics: Dict[str, Any], **kwargs: Any) -> None:
        pass


class LoggingCallback(Callback):
    def __init__(self, verbose: bool = True) -> None:
        self.verbose = verbose

    def _print(self, msg: str) -> None:
        if self.verbose:
            print(msg)

    def on_run_start(self, runner: Any, **kwargs: Any) -> None:
        self._print(f"[LightMM] run start: {type(runner).__name__}")

    def on_run_end(self, runner: Any, result: Any = None, **kwargs: Any) -> None:
        self._print(f"[LightMM] run end: {type(runner).__name__}")

    def on_step_end(self, runner: Any, state: Any, step: int, **kwargs: Any) -> None:
        stop = getattr(state, "stop", False)
        self._print(f"[LightMM] loop step={step} stop={stop}")

    def on_node_start(self, runner: Any, node_name: str, state: Any, **kwargs: Any) -> None:
        self._print(f"[LightMM] node start: {node_name}")

    def on_node_end(self, runner: Any, node_name: str, state: Any, **kwargs: Any) -> None:
        self._print(f"[LightMM] node end: {node_name}")

    def on_train_epoch_end(self, runner: Any, epoch: int, metrics: Dict[str, Any], **kwargs: Any) -> None:
        self._print(f"[LightMM] epoch {epoch} train {metrics}")

    def on_val_epoch_end(self, runner: Any, epoch: int, metrics: Dict[str, Any], **kwargs: Any) -> None:
        self._print(f"[LightMM] epoch {epoch} val {metrics}")


class CheckpointCallback(Callback):
    """Persist agent state or model checkpoint metadata to work_dir."""

    def __init__(self, work_dir: str = "./work_dir", filename: str = "state.json") -> None:
        self.work_dir = work_dir
        self.filename = filename

    def on_run_end(self, runner: Any, result: Any = None, **kwargs: Any) -> None:
        import json
        import os
        from pathlib import Path

        Path(self.work_dir).mkdir(parents=True, exist_ok=True)
        path = Path(self.work_dir) / self.filename
        payload: Dict[str, Any]
        if result is None:
            payload = {"status": "ok"}
        elif hasattr(result, "to_dict"):
            payload = result.to_dict()
        elif isinstance(result, dict):
            payload = result
        else:
            payload = {"result": str(result)}
        path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


def call_callbacks(callbacks: Optional[List[Callback]], method: str, *args: Any, **kwargs: Any) -> None:
    if not callbacks:
        return
    for cb in callbacks:
        getattr(cb, method)(*args, **kwargs)
