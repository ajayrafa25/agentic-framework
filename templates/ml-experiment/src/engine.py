"""Shared training helpers."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import torch
import yaml
from torch import nn
from torch.optim.lr_scheduler import CosineAnnealingLR, StepLR


def load_config(root: Path) -> dict:
    with open(root / "config" / "experiment.yaml") as f:
        return yaml.safe_load(f)


def pick_device(requested: str) -> torch.device:
    if requested == "cpu":
        return torch.device("cpu")
    if requested == "cuda":
        if not torch.cuda.is_available():
            print("CUDA requested but not available; using CPU")
            return torch.device("cpu")
        return torch.device("cuda")
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def build_optimizer(model: nn.Module, config: dict):
    t = config["training"]
    name = str(t.get("optimizer", "adamw")).lower()
    lr = float(t["learning_rate"])
    wd = float(t.get("weight_decay", 0.0))
    if name == "sgd":
        return torch.optim.SGD(model.parameters(), lr=lr, momentum=0.9, weight_decay=wd)
    if name == "adam":
        return torch.optim.Adam(model.parameters(), lr=lr, weight_decay=wd)
    return torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=wd)


def build_scheduler(optimizer, config: dict, epochs: int):
    name = str(config["training"].get("scheduler", "cosine")).lower()
    if name == "step":
        return StepLR(optimizer, step_size=max(epochs // 3, 1), gamma=0.1)
    if name in {"none", "off"}:
        return None
    return CosineAnnealingLR(optimizer, T_max=epochs)


def current_lr(optimizer) -> float:
    return float(optimizer.param_groups[0]["lr"])


@torch.no_grad()
def evaluate(model: nn.Module, loader, device: torch.device, criterion, limit_batches: int | None = None) -> tuple[float, float]:
    model.eval()
    total_loss = 0.0
    correct = 0
    n = 0
    for i, (images, labels) in enumerate(loader):
        if limit_batches is not None and i >= limit_batches:
            break
        images = images.to(device)
        labels = labels.to(device)
        logits = model(images)
        loss = criterion(logits, labels)
        total_loss += loss.item() * labels.size(0)
        correct += (logits.argmax(1) == labels).sum().item()
        n += labels.size(0)
    if n == 0:
        return 0.0, 0.0
    return total_loss / n, correct / n


def train_one_epoch(model, loader, device, criterion, optimizer, limit_batches: int | None):
    model.train()
    total_loss = 0.0
    n = 0
    for i, (images, labels) in enumerate(loader):
        if limit_batches is not None and i >= limit_batches:
            break
        images = images.to(device)
        labels = labels.to(device)
        optimizer.zero_grad(set_to_none=True)
        logits = model(images)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * labels.size(0)
        n += labels.size(0)
    return total_loss / max(n, 1)


def write_metrics(root: Path, metrics: dict) -> None:
    log_dir = root / "experiments" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    with open(log_dir / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()
