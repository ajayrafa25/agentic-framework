# Config-driven ReAct loop example (offline FakeLLM)

llm = dict(
    type="FakeLLM",
    script=[
        'TOOL_CALL: calculator\nARGS: {"expression": "2 + 3 * 4"}',
        "FINAL_ANSWER: 14",
    ],
)

tools = [
    dict(type="CalculatorTool"),
    dict(type="EchoTool"),
]

loop = dict(type="ReActLoop", max_steps=5)

runner = dict(type="LoopRunner")

callbacks = [
    dict(type="LoggingCallback"),
    dict(type="CheckpointCallback", work_dir="./work_dir/react_loop", filename="state.json"),
]

work_dir = "./work_dir/react_loop"
