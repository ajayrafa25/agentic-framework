# Experiment: {{name}}

Plain **PyTorch** workspace. Config in `config/experiment.yaml`. Each epoch writes `experiments/logs/metrics.json` so Forge Charts update live.

## Setup

```bash
pip install -r requirements.txt
# CPU-only machines:
# pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

## Train

```bash
python scripts/validate_config.py
python scripts/train.py --dry-run
python scripts/train.py --fast          # 1 epoch, 2 batches (smoke test)
python scripts/train.py                 # full run from yaml
python scripts/evaluate.py              # test split, loads experiments/checkpoints/best.pt
```

Default: **ResNet-18** on **CIFAR-10**, CIFAR stem (3×3 conv, no max-pool). Switch `model.architecture` to `resnet50` or `vit-b16` (ViT resizes to 224). Add datasets in `src/data.py`.

Device is `training.device: auto` (CUDA if present, else CPU).
