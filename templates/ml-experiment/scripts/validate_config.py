"""Validate experiment configuration before training."""

import sys
from pathlib import Path

import yaml

REQUIRED_SECTIONS = ("experiment", "model", "data", "training", "evaluation", "output")


def main() -> int:
    config_path = Path(__file__).resolve().parents[1] / "config" / "experiment.yaml"
    with open(config_path) as f:
        config = yaml.safe_load(f)

    missing = [s for s in REQUIRED_SECTIONS if s not in config]
    if missing:
        print(f"Missing sections: {', '.join(missing)}")
        return 1

    epochs = config["training"]["epochs"]
    batch_size = config["data"]["batch_size"]
    lr = config["training"]["learning_rate"]

    print("Configuration valid.")
    print(f"  Model: {config['model']['architecture']}")
    print(f"  Dataset: {config['data']['dataset']}")
    print(f"  Epochs: {epochs}, batch_size: {batch_size}, lr: {lr}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
