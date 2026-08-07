from lightmm.callbacks.base import Callback, CheckpointCallback, LoggingCallback, call_callbacks
from lightmm.registry import HOOKS

HOOKS.register_module(module=LoggingCallback, force=True)
HOOKS.register_module(module=CheckpointCallback, force=True)

__all__ = [
    "Callback",
    "LoggingCallback",
    "CheckpointCallback",
    "call_callbacks",
]
