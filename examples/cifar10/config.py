# CIFAR10 + ResNet18 (requires torch + torchvision)

model = dict(type="CIFARResNetClassifier", num_classes=10, lr=0.1)

train_pipeline = [
    dict(type="RandomCrop", size=32, padding=4),
    dict(type="RandomHorizontalFlip"),
    dict(type="ToTensor"),
    dict(type="Normalize", mean=[0.4914, 0.4822, 0.4465], std=[0.2023, 0.1994, 0.2010]),
]

test_pipeline = [
    dict(type="ToTensor"),
    dict(type="Normalize", mean=[0.4914, 0.4822, 0.4465], std=[0.2023, 0.1994, 0.2010]),
]

train_dataloader = dict(
    batch_size=128,
    shuffle=True,
    num_workers=2,
    dataset=dict(
        type="CIFAR10Dataset",
        root="./data",
        train=True,
        download=True,
        pipeline=train_pipeline,
    ),
)

val_dataloader = dict(
    batch_size=100,
    shuffle=False,
    num_workers=2,
    dataset=dict(
        type="CIFAR10Dataset",
        root="./data",
        train=False,
        download=True,
        pipeline=test_pipeline,
    ),
)

runner = dict(type="TrainRunner", max_epochs=1, accelerator="gpu")

callbacks = [dict(type="LoggingCallback")]

work_dir = "./work_dir/cifar10"
