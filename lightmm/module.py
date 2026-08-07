"""Lightning-style BaseModule shared by agents and DL models."""

from __future__ import annotations

from typing import Any, Dict, Optional


class BaseModule:
    """Minimal Lightning-inspired module.

    Subclass and implement the hooks you need:
      - DL: forward, training_step, validation_step, configure_optimizers
      - Agent: step(state) -> state
    """

    def __init__(self, **hparams: Any) -> None:
        self.hparams: Dict[str, Any] = dict(hparams)
        self._device = "cpu"

    def save_hyperparameters(self, **kwargs: Any) -> None:
        self.hparams.update(kwargs)

    @property
    def device(self) -> str:
        return self._device

    def to(self, device: str) -> "BaseModule":
        self._device = device
        return self

    # ----- shared -----
    def setup(self) -> None:
        """Called once before run."""

    def teardown(self) -> None:
        """Called once after run."""

    # ----- agent hooks -----
    def step(self, state: Any) -> Any:
        raise NotImplementedError(f"{type(self).__name__}.step is not implemented")

    # ----- DL hooks -----
    def forward(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError(f"{type(self).__name__}.forward is not implemented")

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        return self.forward(*args, **kwargs)

    def training_step(self, batch: Any, batch_idx: int) -> Any:
        raise NotImplementedError

    def validation_step(self, batch: Any, batch_idx: int) -> Any:
        raise NotImplementedError

    def test_step(self, batch: Any, batch_idx: int) -> Any:
        raise NotImplementedError

    def configure_optimizers(self) -> Any:
        raise NotImplementedError

    def log(self, name: str, value: Any, **kwargs: Any) -> None:
        """Lightweight log hook; runners/callbacks may override behavior."""
        print(f"[log] {name}={value}")
