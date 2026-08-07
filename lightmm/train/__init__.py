"""Training helpers and demo datasets/models."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from lightmm.module import BaseModule
from lightmm.registry import DATASETS, MODELS


@DATASETS.register_module()
class TinyTensorDataset:
    """Small synthetic classification dataset for smoke tests (no torchvision)."""

    def __init__(
        self,
        num_samples: int = 64,
        num_features: int = 8,
        num_classes: int = 3,
        seed: int = 0,
        **kwargs: Any,
    ) -> None:
        import torch

        g = torch.Generator().manual_seed(seed)
        self.x = torch.randn(num_samples, num_features, generator=g)
        self.y = torch.randint(0, num_classes, (num_samples,), generator=g)

    def __len__(self) -> int:
        return int(self.x.shape[0])

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        return {"inputs": self.x[idx], "data_sample": self.y[idx]}


@MODELS.register_module()
class TinyClassifier(BaseModule):
    """Minimal MLP classifier for TrainRunner smoke tests."""

    def __init__(
        self,
        num_features: int = 8,
        num_classes: int = 3,
        lr: float = 1e-2,
        **kwargs: Any,
    ) -> None:
        super().__init__(num_features=num_features, num_classes=num_classes, lr=lr, **kwargs)
        import torch
        import torch.nn as nn

        self.lr = lr
        self.net = nn.Sequential(
            nn.Linear(num_features, 16),
            nn.ReLU(),
            nn.Linear(16, num_classes),
        )
        self._torch = torch
        self._nn = nn

    def to(self, device: str) -> "TinyClassifier":
        super().to(device)
        self.net.to(device)
        return self

    def forward(self, x):
        return self.net(x)

    def _unpack(self, batch):
        if isinstance(batch, dict):
            return batch["inputs"], batch["data_sample"]
        return batch[0], batch[1]

    def training_step(self, batch, batch_idx: int):
        import torch.nn.functional as F

        x, y = self._unpack(batch)
        logits = self.forward(x)
        return F.cross_entropy(logits, y)

    def validation_step(self, batch, batch_idx: int):
        return self.training_step(batch, batch_idx)

    def configure_optimizers(self):
        import torch.optim as optim

        optimizer = optim.SGD(self.net.parameters(), lr=self.lr)
        return {"optimizer": optimizer}


@DATASETS.register_module()
class CIFAR10Dataset:
    """CIFAR10 via torchvision (optional dependency)."""

    def __init__(
        self,
        root: str = "./data",
        train: bool = True,
        download: bool = True,
        pipeline: Optional[list] = None,
        **kwargs: Any,
    ) -> None:
        from torchvision import datasets, transforms

        if pipeline is None:
            if train:
                pipeline = [
                    dict(type="RandomCrop", size=32, padding=4),
                    dict(type="RandomHorizontalFlip"),
                    dict(type="ToTensor"),
                    dict(
                        type="Normalize",
                        mean=[0.4914, 0.4822, 0.4465],
                        std=[0.2023, 0.1994, 0.2010],
                    ),
                ]
            else:
                pipeline = [
                    dict(type="ToTensor"),
                    dict(
                        type="Normalize",
                        mean=[0.4914, 0.4822, 0.4465],
                        std=[0.2023, 0.1994, 0.2010],
                    ),
                ]

        transform_list = []
        for t in pipeline:
            t = dict(t)
            t_type = t.pop("type")
            if not hasattr(transforms, t_type):
                raise ValueError(f"Transform {t_type} not found in torchvision.transforms")
            transform_list.append(getattr(transforms, t_type)(**t))
        transform = transforms.Compose(transform_list)
        self.dataset = datasets.CIFAR10(
            root=root, train=train, download=download, transform=transform
        )

    def __len__(self) -> int:
        return len(self.dataset)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        img, label = self.dataset[idx]
        return {"inputs": img, "data_sample": label}


@MODELS.register_module()
class CIFARResNetClassifier(BaseModule):
    """ResNet18 classifier for CIFAR (optional torchvision)."""

    def __init__(self, num_classes: int = 10, lr: float = 0.1, **kwargs: Any) -> None:
        super().__init__(num_classes=num_classes, lr=lr, **kwargs)
        import torch.nn as nn
        from torchvision.models import resnet18

        self.lr = lr
        self.model = resnet18(weights=None, num_classes=num_classes)
        self._nn = nn

    def to(self, device: str) -> "CIFARResNetClassifier":
        super().to(device)
        self.model.to(device)
        return self

    def forward(self, x):
        return self.model(x)

    def _unpack(self, batch):
        if isinstance(batch, dict):
            return batch["inputs"], batch["data_sample"]
        return batch[0], batch[1]

    def training_step(self, batch, batch_idx: int):
        import torch.nn.functional as F

        x, y = self._unpack(batch)
        logits = self.forward(x)
        return F.cross_entropy(logits, y)

    def validation_step(self, batch, batch_idx: int):
        return self.training_step(batch, batch_idx)

    def configure_optimizers(self):
        import torch.optim as optim

        optimizer = optim.SGD(
            self.model.parameters(), lr=self.lr, momentum=0.9, weight_decay=5e-4
        )
        scheduler = optim.lr_scheduler.MultiStepLR(
            optimizer, milestones=[100, 150], gamma=0.1
        )
        return {"optimizer": optimizer, "lr_scheduler": scheduler}
