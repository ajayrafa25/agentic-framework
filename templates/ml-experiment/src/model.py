"""Build torchvision models; CIFAR-sized inputs get an adapted ResNet stem."""

from __future__ import annotations

import torch.nn as nn
from torchvision import models


RESNETS = {
    "resnet18": models.resnet18,
    "resnet34": models.resnet34,
    "resnet50": models.resnet50,
    "resnet101": models.resnet101,
}


class SmallCNN(nn.Module):
    """Fallback when the architecture name is not in torchvision."""

    def __init__(self, num_classes: int) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d(1),
        )
        self.fc = nn.Linear(128, num_classes)

    def forward(self, x):
        x = self.features(x)
        return self.fc(x.flatten(1))


def build_model(architecture: str, num_classes: int, pretrained: bool, small_input: bool) -> nn.Module:
    name = architecture.lower().replace("-", "").replace("_", "")
    weights = "DEFAULT" if pretrained else None

    if name in RESNETS:
        model = RESNETS[name](weights=weights)
        if small_input:
            model.conv1 = nn.Conv2d(3, model.conv1.out_channels, kernel_size=3, stride=1, padding=1, bias=False)
            model.maxpool = nn.Identity()
        model.fc = nn.Linear(model.fc.in_features, num_classes)
        return model

    if name in {"vitb16", "vitl16"}:
        ctor = models.vit_b_16 if name == "vitb16" else models.vit_l_16
        model = ctor(weights=weights)
        model.heads.head = nn.Linear(model.heads.head.in_features, num_classes)
        return model

    print(f"Unknown architecture '{architecture}', using SmallCNN")
    return SmallCNN(num_classes)
