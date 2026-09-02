"""Evaluate the best checkpoint on the CIFAR-10 test split."""

from __future__ import annotations

import sys
from pathlib import Path

import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.data import build_dataloaders
from src.engine import evaluate, load_config, pick_device, utcnow, write_metrics
from src.model import build_model


def main() -> int:
    config = load_config(ROOT)
    ckpt_path = ROOT / config["output"]["checkpoint_dir"] / "best.pt"
    if not ckpt_path.exists():
        print("No checkpoint at experiments/checkpoints/best.pt — train first.")
        return 1

    device = pick_device(str(config["training"].get("device", "auto")))
    architecture = config["model"]["architecture"]
    small_input = not str(architecture).lower().startswith("vit")
    model = build_model(
        architecture,
        int(config["model"]["num_classes"]),
        pretrained=False,
        small_input=small_input,
    ).to(device)

    blob = torch.load(ckpt_path, map_location=device, weights_only=False)
    model.load_state_dict(blob["model"])

    _, _, test_loader = build_dataloaders(ROOT, config)
    criterion = nn.CrossEntropyLoss()
    loss, acc = evaluate(model, test_loader, device, criterion)
    metric_name = config["evaluation"]["primary_metric"]
    print(f"Test {metric_name}: {acc:.4f}  loss: {loss:.4f}")

    metrics_path = ROOT / config["output"]["log_dir"] / "metrics.json"
    metrics = {}
    if metrics_path.exists():
        import json

        metrics = json.loads(metrics_path.read_text())
    metrics.update(
        {
            "primaryMetric": round(acc, 4),
            "primaryMetricName": metric_name,
            "valLoss": round(loss, 4),
            "status": "completed",
            "lastUpdated": utcnow(),
        }
    )
    write_metrics(ROOT, metrics)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
