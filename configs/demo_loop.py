llm = dict(type="FakeLLM")
tools = [dict(type="CalculatorTool")]
loop = dict(type="ReActLoop", max_steps=3)
runner = dict(type="LoopRunner")
work_dir = "./work_dir"
