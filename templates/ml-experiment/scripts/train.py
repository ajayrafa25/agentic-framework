"""Train a plain PyTorch model from config/experiment.yaml.

Writes experiments/logs/metrics.json after every epoch so the Forge Charts pane updates live.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.data import build_dataloaders
from src.engine import (
    build_optimizer,
    build_scheduler,
    current_lr,
    evaluate,
    load_config,
    pick_device,
    train_one_epoch,
    utcnow,
    write_metrics,
)
from src.model import build_model


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--fast", action="store_true", help="1 epoch, few batches — CPU smoke test")
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--limit-batches", type=int, default=None)
    args = parser.parse_args()

    config = load_config(ROOT)
    training = config["training"]
    epochs = args.epochs or int(training["epochs"])
    if args.fast:
        epochs = 1
        args.limit_batches = args.limit_batches or 2

    dataset = config["data"]["dataset"]
    architecture = config["model"]["architecture"]
    small_input = not str(architecture).lower().startswith("vit")

    if args.dry_run:
        device = pick_device(str(training.get("device", "auto")))
        print(f"Dry run: {architecture} on {dataset} for {epochs} epochs on {device}")
        print(f"  lr={training['learning_rate']} optimizer={training.get('optimizer')} batch={config['data']['batch_size']}")
        return 0

    torch.manual_seed(int(config["experiment"]["seed"]))
    device = pick_device(str(training.get("device", "auto")))
    print(f"Device: {device}")
    print(f"Training {architecture} on {dataset} ({epochs} epochs)")

    train_loader, val_loader, _ = build_dataloaders(ROOT, config)
    model = build_model(
        architecture,
        int(config["model"]["num_classes"]),
        bool(config["model"].get("pretrained", False)),
        small_input=small_input,
    ).to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = build_optimizer(model, config)
    scheduler = build_scheduler(optimizer, config, epochs)

    ckpt_dir = ROOT / config["output"]["checkpoint_dir"]
    ckpt_dir.mkdir(parents=True, exist_ok=True)

    history = []
    best_acc = -1.0
    metric_name = config["evaluation"]["primary_metric"]
    patience = int(training.get("early_stopping_patience") or 0)
    stale = 0

    for epoch in range(1, epochs + 1):
        train_loss = train_one_epoch(
            model, train_loader, device, criterion, optimizer, args.limit_batches
        )
        val_loss, val_acc = evaluate(
            model, val_loader, device, criterion, limit_batches=args.limit_batches
        )
        if scheduler is not None:
            scheduler.step()

        history.append(
            {
                "epoch": epoch,
                "trainLoss": round(train_loss, 4),
                "valLoss": round(val_loss, 4),
                "primaryMetric": round(val_acc, 4),
            }
        )
        write_metrics(
            ROOT,
            {
                "epoch": epoch,
                "totalEpochs": epochs,
                "trainLoss": round(train_loss, 4),
                "valLoss": round(val_loss, 4),
                "primaryMetric": round(val_acc, 4),
                "primaryMetricName": metric_name,
                "learningRate": current_lr(optimizer),
                "status": "running" if epoch < epochs else "completed",
                "lastUpdated": utcnow(),
                "history": history,
            },
        )
        print(
            f"Epoch {epoch}/{epochs} — train {train_loss:.4f}  val {val_loss:.4f}  "
            f"{metric_name} {val_acc:.4f}  lr {current_lr(optimizer):.2e}"
        )

        if val_acc >= best_acc:
            best_acc = val_acc
            stale = 0
            torch.save(
                {
                    "epoch": epoch,
                    "model": model.state_dict(),
                    "accuracy": val_acc,
                    "config": config,
                },
                ckpt_dir / "best.pt",
            )
        else:
            stale += 1
            if patience and stale >= patience:
                print(f"Early stopping after {patience} epochs without improvement")
                break

    last_path = ckpt_dir / "last.pt"
    torch.save({"epoch": epoch, "model": model.state_dict(), "config": config}, last_path)
    print(f"Saved {ckpt_dir / 'best.pt'} (val {metric_name} {best_acc:.4f})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
