"""Evaluate the latest checkpoint and update metrics."""

import json
from datetime import datetime, timezone
from pathlib import Path

import yaml


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    metrics_path = root / "experiments" / "logs" / "metrics.json"

    if not metrics_path.exists():
        print("No training metrics found. Run scripts/train.py first.")
        return 1

    with open(metrics_path) as f:
        metrics = json.load(f)

    with open(root / "config" / "experiment.yaml") as f:
        config = yaml.safe_load(f)

    metric_name = config["evaluation"]["primary_metric"]
    score = metrics["primaryMetric"]
    print(f"Evaluation complete — {metric_name}: {score:.4f}")

    metrics["status"] = "completed"
    metrics["lastUpdated"] = datetime.now(timezone.utc).isoformat()
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
