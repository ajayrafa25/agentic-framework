# Tiny train example (no CIFAR download required)

model = dict(type="TinyClassifier", num_features=8, num_classes=3, lr=0.05)

train_dataloader = dict(
    batch_size=16,
    shuffle=True,
    num_workers=0,
    dataset=dict(type="TinyTensorDataset", num_samples=64, num_features=8, num_classes=3),
)

val_dataloader = dict(
    batch_size=16,
    shuffle=False,
    num_workers=0,
    dataset=dict(type="TinyTensorDataset", num_samples=32, num_features=8, num_classes=3, seed=1),
)

runner = dict(type="TrainRunner", max_epochs=2, accelerator="cpu")

callbacks = [dict(type="LoggingCallback")]

work_dir = "./work_dir/tiny_train"
