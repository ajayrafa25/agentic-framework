"""Datasets and loaders from experiment.yaml."""

from __future__ import annotations

from pathlib import Path

import torch
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms


CIFAR_MEAN = (0.4914, 0.4822, 0.4465)
CIFAR_STD = (0.2470, 0.2435, 0.2616)
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def _transforms(config: dict, train: bool) -> transforms.Compose:
    arch = str(config["model"]["architecture"]).lower()
    aug = config["data"].get("augmentation") or {}
    needs_224 = arch.startswith("vit")

    ops = []
    if needs_224:
        ops.append(transforms.Resize(224))
        if train and aug.get("random_flip"):
            ops.append(transforms.RandomHorizontalFlip())
        mean, std = IMAGENET_MEAN, IMAGENET_STD
    else:
        if train:
            ops.append(transforms.RandomCrop(32, padding=4))
            if aug.get("random_flip"):
                ops.append(transforms.RandomHorizontalFlip())
        mean, std = CIFAR_MEAN, CIFAR_STD

    ops.append(transforms.ToTensor())
    if aug.get("normalize", True):
        ops.append(transforms.Normalize(mean, std))
    return transforms.Compose(ops)


def build_dataloaders(root: Path, config: dict):
    data_dir = root / config["data"].get("data_dir", "data")
    data_dir.mkdir(parents=True, exist_ok=True)
    dataset_name = str(config["data"]["dataset"]).lower()
    batch_size = int(config["data"]["batch_size"])
    workers = int(config["data"].get("num_workers", 0))
    seed = int(config["experiment"]["seed"])
    train_split = float(config["data"].get("train_split", 0.9))

    if dataset_name != "cifar10":
        raise ValueError(f"Unsupported dataset '{dataset_name}'. Add a loader in src/data.py.")

    train_ds = datasets.CIFAR10(
        root=str(data_dir), train=True, download=True, transform=_transforms(config, True)
    )
    val_ds = datasets.CIFAR10(
        root=str(data_dir), train=True, download=True, transform=_transforms(config, False)
    )
    test_set = datasets.CIFAR10(
        root=str(data_dir), train=False, download=True, transform=_transforms(config, False)
    )

    n = len(train_ds)
    n_train = int(n * train_split)
    g = torch.Generator().manual_seed(seed)
    perm = torch.randperm(n, generator=g).tolist()
    train_idx, val_idx = perm[:n_train], perm[n_train:]

    max_train = config["data"].get("max_train_samples")
    if max_train:
        train_idx = train_idx[: int(max_train)]
    max_val = config["data"].get("max_val_samples")
    if max_val:
        val_idx = val_idx[: int(max_val)]

    train_loader = DataLoader(Subset(train_ds, train_idx), batch_size=batch_size, shuffle=True, num_workers=workers)
    val_loader = DataLoader(Subset(val_ds, val_idx), batch_size=batch_size, shuffle=False, num_workers=workers)
    test_loader = DataLoader(test_set, batch_size=batch_size, shuffle=False, num_workers=workers)
    return train_loader, val_loader, test_loader
