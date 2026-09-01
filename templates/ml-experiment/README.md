# Experiment: {{name}}

Collaborative ML experiment workspace. Edit configs, run training scripts, and track metrics with your team.

## Structure

- `config/` — hyperparameters and experiment settings
- `src/` — training, evaluation, and model code
- `notebooks/` — exploratory analysis
- `experiments/` — run outputs, checkpoints, logs
- `data/` — dataset references (not stored in git)

## Quick start

```bash
python scripts/validate_config.py
python scripts/train.py --dry-run
python scripts/train.py
python scripts/evaluate.py
```

## Team workflow

Discuss changes in the session chat before training. Use `@forge` to ask the agent to modify configs or training code based on team discussion.
