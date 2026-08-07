# Config-driven branching graph (with loop-back)

llm = dict(type="FakeLLM")

graph = dict(
    type="StateGraph",
    entry="route",
    terminals=["end"],
    max_node_visits=5,
    max_steps=20,
    nodes=dict(
        route=dict(
            type="LLMNode",
            llm=dict(
                type="FakeLLM",
                # Force a keyword the KeywordRouter understands
                script=["need search tools please"],
            ),
        ),
        search=dict(type="ToolNode", tool="EchoTool", arg_key="input", result_key="tool_result"),
        answer=dict(
            type="LLMNode",
            llm=dict(
                type="FakeLLM",
                script=["FINAL_ANSWER: done via graph"],
            ),
            final=True,
        ),
        end=dict(type="PassThroughNode"),
    ),
    edges=[
        dict(
            source="route",
            router=dict(
                type="KeywordRouter",
                routes={"search": "search", "done": "answer"},
                default="answer",
            ),
        ),
        dict(source="search", target="answer"),
        dict(source="answer", target="end"),
    ],
)

runner = dict(type="GraphRunner")

callbacks = [dict(type="LoggingCallback")]

work_dir = "./work_dir/branch_graph"
