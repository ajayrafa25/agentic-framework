"""Simulated training loop for collaborative demo workspaces."""

import argparse
import json
import math
import random
import time
from datetime import datetime, timezone
from pathlib import Path

import yaml


def load_config(root: Path) -> dict:
    with open(root / "config" / "experiment.yaml") as f:
        return yaml.safe_load(f)


def write_metrics(root: Path, metrics: dict) -> None:
    log_dir = root / "experiments" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    with open(log_dir / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)


def simulate_epoch(epoch: int, total: int, seed: int) -> dict:
    rng = random.Random(seed + epoch)
    progress = epoch / total
    train_loss = max(0.05, 2.5 * math.exp(-3 * progress) + rng.uniform(-0.05, 0.05))
    val_loss = train_loss + rng.uniform(0.02, 0.15)
    accuracy = min(0.99, 0.4 + 0.55 * progress + rng.uniform(-0.02, 0.02))
    return {
        "epoch": epoch,
        "trainLoss": round(train_loss, 4),
        "valLoss": round(val_loss, 4),
        "primaryMetric": round(accuracy, 4),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    config = load_config(root)
    epochs = int(config["training"]["epochs"])
    seed = int(config["experiment"]["seed"])
    metric_name = config["evaluation"]["primary_metric"]

    if args.dry_run:
        print(f"Dry run: would train {epochs} epochs on {config['data']['dataset']}")
        return 0

    history = []
    print(f"Training {config['model']['architecture']} on {config['data']['dataset']}...")

    for epoch in range(1, epochs + 1):
        point = simulate_epoch(epoch, epochs, seed)
        history.append(point)
        metrics = {
            "epoch": epoch,
            "totalEpochs": epochs,
            "trainLoss": point["trainLoss"],
            "valLoss": point["valLoss"],
            "primaryMetric": point["primaryMetric"],
            "primaryMetricName": metric_name,
            "learningRate": float(config["training"]["learning_rate"]),
            "status": "running" if epoch < epochs else "completed",
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
            "history": history,
        }
        write_metrics(root, metrics)
        print(
            f"Epoch {epoch}/{epochs} — loss: {point['trainLoss']:.4f}, "
            f"{metric_name}: {point['primaryMetric']:.4f}"
        )
        time.sleep(0.3)

    print("Training complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
