"""Train with LightMM TrainRunner (tiny by default; CIFAR via config.py)."""

import argparse
from pathlib import Path

from lightmm import Config, Runner


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--config",
        default=str(Path(__file__).parent / "config_tiny.py"),
        help="Path to config (.py). Use config.py for full CIFAR.",
    )
    args = parser.parse_args()
    cfg = Config.fromfile(args.config)
    runner = Runner.from_cfg(cfg)
    result = runner.run()
    print(result)


if __name__ == "__main__":
    main()
