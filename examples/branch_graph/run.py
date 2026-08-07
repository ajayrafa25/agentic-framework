"""Run a config-driven branching graph."""

from pathlib import Path

from lightmm import Config, Runner


def main() -> None:
    cfg = Config.fromfile(Path(__file__).parent / "config.py")
    runner = Runner.from_cfg(cfg)
    state = runner.run(input="please search for something")
    print("output:", state.output)
    print("stop_reason:", state.stop_reason)
    print("visit_counts:", state.visit_counts)
    print("tool_results:", state.tool_results)


if __name__ == "__main__":
    main()
