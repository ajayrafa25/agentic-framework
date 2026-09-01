# Forge

Collaborative AI environment for **ML model development** — inspired by the ACE talk's multiplayer alignment model, but built for experiment workflows (configs, training, metrics, evaluation) instead of web app demos.

## What this is

A research prototype where your team shares:

- **Experiment sessions** — isolated workspaces per training run (config, code, logs)
- **Multiplayer chat** — discuss hyperparameters and architecture before you train
- **Shared terminal** — everyone runs the same `train.py` / `evaluate.py` on one workspace
- **Live metrics** — loss curves and primary metric from training logs
- **Collaborative plan** — align on hypothesis and changes before `@forge` acts
- **Dashboard** — pick back up experiments and see team activity

The agent **Forge** reads team chat and applies agreed config changes (learning rate, epochs, augmentation). It is not tied to any single ML framework.

## Quick start

```bash
pnpm install
pip install -r templates/ml-experiment/requirements.txt
pnpm dev
```

- Web UI: http://localhost:3000
- API / WebSocket server: http://localhost:3001

## Workspace layout (per session)

```
config/experiment.yaml    # hyperparameters
src/                      # model & training code
scripts/train.py          # training (demo simulator)
scripts/evaluate.py       # evaluation
experiments/logs/         # metrics.json written during training
```

## Team workflow

1. Create an experiment session
2. Discuss in chat — PMs, researchers, and engineers in the same room
3. Edit the **plan** and **config** together
4. `@forge set learning rate to 3e-4` — agent applies team-agreed changes
5. Run training in the **shared terminal**
6. Watch **metrics** update live for the whole team

## Monorepo

| Package | Description |
|---------|-------------|
| `apps/web` | Next.js UI |
| `apps/server` | Express + Socket.io + sessions + terminal |
| `packages/shared` | Shared TypeScript types |
| `templates/ml-experiment` | Generic ML experiment template |

## Roadmap

- Git worktrees / PR export to GitHub
- Real GPU training integration (PyTorch, JAX, etc.)
- Checkpoint browser and inference previews
- Optional LLM-backed Forge agent (OpenAI / Anthropic)
