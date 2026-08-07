"""Pure-PyTorch TrainRunner with Lightning-style module hooks."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from lightmm.callbacks import call_callbacks
from lightmm.module import BaseModule
from lightmm.registry import DATASETS, MODELS, RUNNERS
from lightmm.runner.base import Runner


def _try_import_torch():
    try:
        import torch
        from torch.utils.data import DataLoader, Dataset
    except ImportError as exc:  # pragma: no cover
        raise ImportError(
            "TrainRunner requires torch. Install with: pip install lightmm[torch]"
        ) from exc
    return torch, DataLoader, Dataset


@RUNNERS.register_module()
class TrainRunner(Runner):
    """Epoch-based training loop calling BaseModule training/validation hooks."""

    def __init__(
        self,
        model: Any = None,
        train_dataloader: Any = None,
        val_dataloader: Any = None,
        max_epochs: int = 1,
        accelerator: str = "cpu",
        log_every_n_steps: int = 50,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self.torch, self.DataLoader, self.Dataset = _try_import_torch()
        self.max_epochs = max_epochs
        self.accelerator = accelerator
        self.log_every_n_steps = log_every_n_steps
        self.device = self._resolve_device(accelerator)
        self.model = self._build_model(model)
        self.train_loader = self._build_dataloader(train_dataloader, shuffle=True)
        self.val_loader = (
            self._build_dataloader(val_dataloader, shuffle=False)
            if val_dataloader is not None
            else None
        )
        opt_cfg = self.model.configure_optimizers()
        self.optimizer, self.scheduler = self._parse_optimizers(opt_cfg)

    def _resolve_device(self, accelerator: str) -> str:
        torch = self.torch
        if accelerator in {"gpu", "cuda"} and torch.cuda.is_available():
            return "cuda"
        return "cpu"

    def _build_model(self, model: Any) -> BaseModule:
        if model is None:
            raise ValueError("TrainRunner requires model")
        if isinstance(model, BaseModule):
            mod = model
        elif isinstance(model, dict):
            mod = MODELS.build(model)
        elif isinstance(model, str):
            mod = MODELS.build({"type": model})
        else:
            mod = model
        if hasattr(mod, "to"):
            mod.to(self.device)
        if hasattr(mod, "model") and hasattr(mod.model, "to"):
            mod.model.to(self.device)
        return mod

    def _build_dataloader(self, cfg: Any, shuffle: bool = False) -> Any:
        if cfg is None:
            raise ValueError("dataloader config required")
        if hasattr(cfg, "__iter__") and not isinstance(cfg, dict):
            return cfg
        cfg = dict(cfg)
        dataset_cfg = cfg.pop("dataset")
        batch_size = cfg.pop("batch_size", 32)
        num_workers = cfg.pop("num_workers", 0)
        shuffle = cfg.pop("shuffle", shuffle)
        collate_fn = cfg.pop("collate_fn", None)
        if isinstance(dataset_cfg, dict):
            dataset = DATASETS.build(dataset_cfg)
        else:
            dataset = dataset_cfg
        return self.DataLoader(
            dataset,
            batch_size=batch_size,
            shuffle=shuffle,
            num_workers=num_workers,
            collate_fn=collate_fn,
            **cfg,
        )

    def _parse_optimizers(self, opt_cfg: Any) -> Tuple[Any, Any]:
        if opt_cfg is None:
            return None, None
        if isinstance(opt_cfg, dict):
            return opt_cfg.get("optimizer"), opt_cfg.get("lr_scheduler")
        if isinstance(opt_cfg, (list, tuple)):
            return opt_cfg[0], opt_cfg[1] if len(opt_cfg) > 1 else None
        return opt_cfg, None

    def _move_batch(self, batch: Any) -> Any:
        if isinstance(batch, dict):
            return {
                k: (v.to(self.device) if hasattr(v, "to") else v)
                for k, v in batch.items()
            }
        if isinstance(batch, (list, tuple)):
            return type(batch)(
                v.to(self.device) if hasattr(v, "to") else v for v in batch
            )
        if hasattr(batch, "to"):
            return batch.to(self.device)
        return batch

    def run(self, **kwargs: Any) -> Dict[str, Any]:
        call_callbacks(self.callbacks, "on_run_start", self)
        history: List[Dict[str, Any]] = []
        for epoch in range(1, self.max_epochs + 1):
            call_callbacks(self.callbacks, "on_train_epoch_start", self, epoch)
            train_metrics = self._train_one_epoch(epoch)
            call_callbacks(self.callbacks, "on_train_epoch_end", self, epoch, train_metrics)
            val_metrics: Dict[str, Any] = {}
            if self.val_loader is not None:
                val_metrics = self._validate_one_epoch(epoch)
                call_callbacks(self.callbacks, "on_val_epoch_end", self, epoch, val_metrics)
            if self.scheduler is not None:
                self.scheduler.step()
            history.append({"epoch": epoch, "train": train_metrics, "val": val_metrics})
        result = {"history": history}
        call_callbacks(self.callbacks, "on_run_end", self, result)
        return result

    def _train_one_epoch(self, epoch: int) -> Dict[str, Any]:
        model = self.model
        if hasattr(model, "model") and hasattr(model.model, "train"):
            model.model.train()
        total_loss = 0.0
        n = 0
        for batch_idx, batch in enumerate(self.train_loader):
            batch = self._move_batch(batch)
            if self.optimizer is not None:
                self.optimizer.zero_grad()
            loss = model.training_step(batch, batch_idx)
            if hasattr(loss, "backward"):
                loss.backward()
                if self.optimizer is not None:
                    self.optimizer.step()
                total_loss += float(loss.detach().item())
            else:
                total_loss += float(loss)
            n += 1
        return {"loss": total_loss / max(n, 1)}

    def _validate_one_epoch(self, epoch: int) -> Dict[str, Any]:
        torch = self.torch
        model = self.model
        if hasattr(model, "model") and hasattr(model.model, "eval"):
            model.model.eval()
        total_loss = 0.0
        n = 0
        with torch.no_grad():
            for batch_idx, batch in enumerate(self.val_loader):
                batch = self._move_batch(batch)
                loss = model.validation_step(batch, batch_idx)
                if hasattr(loss, "detach"):
                    total_loss += float(loss.detach().item())
                elif loss is not None:
                    total_loss += float(loss)
                n += 1
        return {"loss": total_loss / max(n, 1)}
