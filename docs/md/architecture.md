# 🏛️ 总体架构文档

> 本文回答一个问题：**MathModelAgent 是怎么从「一段题目文本」变成「一份完整的数学建模论文」的？**
>
> 适合：第一次接触本项目、想做整体设计 review、要写技术 PPT 的人。

---

## 1. 设计目标与不变式

MathModelAgent 的所有架构决策都围绕以下几条不变式：

1. **Agentless 优先**：不引入 LangGraph / AutoGen 等重 Agent 框架，工作流由纯 Python `async` 函数 + 简单 for 循环编排，token 与延迟最优。
2. **四 Agent 分工固定，但模型可换**：四个角色是产品语义的一部分（队长/建模/编程/写作），不应被随意合并；但每个 Agent 背后的 LLM 可以独立切换。
3. **实时可视化**：任务进度通过 Redis Pub/Sub + WebSocket 实时推送，前端能看到每一步的思考、代码、运行结果。
4. **可重放**：所有消息按 task_id 落盘（`logs/messages/{task_id}.json`），刷新页面 / 重新进入仍能恢复完整对话。
5. **本地优先 + 云端可选**：默认本地 Jupyter 内核执行代码，配置 `E2B_API_KEY` 后自动切换为 E2B 云沙箱。

---

## 2. 系统分层

```
┌───────────────────────────────────────────────────────────────────┐
│  Presentation Layer       (浏览器 / 前端)                          │
│    Vue 3 + Vite + shadcn-vue + Pinia                              │
│    • index / chat / task / login 四个页面                         │
│    • Markdown / Notebook / 图片渲染                                │
└─────────────────┬───────────────────────────────▲─────────────────┘
                  │ Axios (REST)                  │ WebSocket
                  ▼                               │
┌───────────────────────────────────────────────────────────────────┐
│  Application Layer        (Routers, FastAPI)                       │
│    modeling_router  ws_router  common_router  files_router         │
│    • 校验 / 鉴权 / 文件接收                                        │
│    • 启动 BackgroundTask，立即返回 task_id                          │
└─────────────────┬─────────────────────────────────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────────────────────────────────┐
│  Workflow Layer           (core/workflow.py + core/flows.py)       │
│    MathModelWorkFlow                                              │
│      ├── Coordinator → Modeler → for-each-subtask(Coder→Writer)   │
│      └── 论文章节写作（首页 / 重述 / 假设 / 评价 ...）             │
└─────────────────┬─────────────────────────────────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────────────────────────────────┐
│  Agent Layer              (core/agents/*)                          │
│    CoordinatorAgent  ModelerAgent  CoderAgent  WriterAgent         │
│    • 继承 Agent 基类：历史对话 / Token 估算 / 记忆压缩              │
└─────────────────┬─────────────────────────────────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────────────────────────────────┐
│  LLM Layer                (core/llm/*)                             │
│    LLM Facade ─▶ BaseProvider                                      │
│        ├── OpenAIChatProvider                                      │
│        ├── OpenAIResponsesProvider                                 │
│        └── AnthropicProvider                                       │
│    LLMFactory 按 Agent 角色注入不同模型                            │
└─────────────────┬───────────────┬─────────────────────────────────┘
                  │               │
                  ▼               ▼
┌─────────────────────┐  ┌────────────────────────────────────────┐
│  Tooling Layer      │  │  Infrastructure                        │
│  • LocalCodeInterp  │  │  • Redis (Pub/Sub + 任务存活)          │
│  • E2BCodeInterp    │  │  • 文件系统 (project/work_dir/{tid}/)  │
│  • OpenAlexScholar  │  │  • 日志 (loguru → logs/)               │
│  • NotebookSerializer│ │                                        │
└─────────────────────┘  └────────────────────────────────────────┘
```

---

## 3. 关键组件一览

| 组件 | 路径 | 一句话职责 |
| --- | --- | --- |
| `FastAPI app` | `backend/app/main.py` | 注册 4 个 Router、CORS、静态文件、lifespan |
| `MathModelWorkFlow` | `backend/app/core/workflow.py` | **多 Agent 主编排**：串起 4 个 Agent + 解释器 + 文献工具 |
| `Flows` | `backend/app/core/flows.py` | 子任务生成器：把题目拆成 eda / ques1..N / 敏感性分析 / 论文章节 |
| `Agent` 基类 | `backend/app/core/agents/agent.py` | 对话历史、Token 估算、记忆压缩（>75% 触发 LLM 总结） |
| `CoordinatorAgent` | `…/agents/coordinator_agent.py` | 意图判别 + 拆题为结构化 JSON |
| `ModelerAgent` | `…/agents/modeler_agent.py` | 给出每个 ques 的建模方案 |
| `CoderAgent` | `…/agents/coder_agent.py` | 在 Jupyter / E2B 里跑 Python，错了反思重试 |
| `WriterAgent` | `…/agents/writer_agent.py` | 写各章节，可调用 `search_papers` 找文献 |
| `LLM` Facade | `…/core/llm/llm.py` | 三种 Provider 的统一入口、重试、消息推送 |
| `LLMFactory` | `…/core/llm/llm_factory.py` | 按角色构造 4 个 LLM 实例 |
| `redis_manager` | `…/services/redis_manager.py` | 任务消息发布订阅 + 持久化到 `logs/messages/` |
| `ws_manager` | `…/services/ws_manager.py` | 维护活跃 WebSocket 连接 |
| `BaseCodeInterpreter` | `…/tools/base_interpreter.py` | 解释器抽象基类 |
| `LocalCodeInterpreter` | `…/tools/local_interpreter.py` | 本地 Jupyter 内核 |
| `E2BCodeInterpreter` | `…/tools/e2b_interpreter.py` | 云端 E2B 沙箱 |
| `OpenAlexScholar` | `…/tools/openalex_scholar.py` | OpenAlex 文献搜索 |
| `NotebookSerializer` | `…/tools/notebook_serializer.py` | 把代码 / 输出落盘成 `.ipynb` |

---

## 4. 数据流：从「提交题目」到「论文落盘」

```
┌────────────┐  POST /modeling     ┌──────────────────────┐
│ 用户提交   │ ────────────────▶ │ modeling_router      │
│ 题目+数据  │                   │  - create task_id    │
└────────────┘                   │  - save uploaded files│
                                 │  - BackgroundTask     │
                                 └──────────┬───────────┘
                                            │
                                            ▼
                              ┌──────────────────────────────┐
                              │ run_modeling_task_async()    │
                              │  • SystemMessage("任务开始") │
                              │  • MathModelWorkFlow.execute │
                              └──────────────┬───────────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              ▼                              ▼                              ▼
   ┌────────────────────┐       ┌──────────────────────┐         ┌────────────────────┐
   │ CoordinatorAgent   │  →    │ ModelerAgent         │   →     │ Flows.solution()   │
   │ 拆题 → JSON        │       │ 建模方案 → JSON      │         │ 生成子任务流       │
   └────────────────────┘       └──────────────────────┘         └─────────┬──────────┘
                                                                           │ for each subtask
                                                                           ▼
                                                          ┌────────────────────────────┐
                                                          │ CoderAgent.run             │
                                                          │  ├ LLM 生成 Python         │
                                                          │  ├ execute_code 工具调用   │
                                                          │  ├ 报错 → 反思 prompt 重试 │
                                                          │  └ 收集生成的图片          │
                                                          └────────────┬───────────────┘
                                                                       ▼
                                                          ┌────────────────────────────┐
                                                          │ WriterAgent.run            │
                                                          │  ├ 按章节模板写正文        │
                                                          │  ├ 必要时 search_papers    │
                                                          │  └ 插图 + 解读             │
                                                          └────────────┬───────────────┘
                                                                       │
                                       (重复 N 个 ques + EDA + 敏感性)  │
                                                                       ▼
                                                          ┌────────────────────────────┐
                                                          │ Flows.write_flows()        │
                                                          │ 摘要 / 重述 / 假设 / 评价  │
                                                          │ → WriterAgent 再写         │
                                                          └────────────┬───────────────┘
                                                                       ▼
                                                          ┌────────────────────────────┐
                                                          │ UserOutput.save_result()   │
                                                          │  + md_2_docx               │
                                                          │  落盘 project/work_dir/    │
                                                          │   ├ notebook.ipynb         │
                                                          │   └ res.md / res.docx      │
                                                          └────────────────────────────┘

   ※ 整条链路上，每个 Agent / 工具都会通过 redis_manager.publish_message
     把消息推到 task:{task_id}:messages 频道，被 WebSocket 实时转发到前端
```

---

## 5. 关键设计决策与权衡

### 5.1 为什么选 Agentless 而不是 LangGraph？

| 维度 | LangGraph / AutoGen | 本项目 Agentless |
| --- | --- | --- |
| 学习成本 | 高，需要理解 graph state | 低，纯 `async` for 循环 |
| 调试 | DAG 状态机难追踪 | 直接看 `workflow.py` 一目了然 |
| Token 利用 | 框架附带大量元 prompt | 100% 由我们控制 |
| 灵活性 | 强（动态分支） | 当前业务**线性**，足够 |

**结论**：建模流程是高度结构化的线性 pipeline，不需要状态机。Agentless 让代码更短、更便宜、更易改。

### 5.2 为什么按 Agent 分别配置 LLM？

不同任务对模型的需求差异显著：

| Agent | 推荐模型特性 |
| --- | --- |
| Coordinator | 便宜的小模型即可（只做 JSON 拆解） |
| Modeler | 强推理（o-series / Claude Sonnet） |
| Coder | 长上下文 + 强代码（Claude / GPT-4o / DeepSeek-V3） |
| Writer | 长文笔流畅（Claude / GPT-4.1） |

`LLMFactory` 读取 `*_API_KEY / *_MODEL / *_API_TYPE / *_BASE_URL` 四组配置，构造四个独立的 `LLM` 实例。

### 5.3 为什么用 Redis Pub/Sub 而不是直接 WebSocket 推？

```
┌──────────┐ publish ┌────────┐ subscribe ┌────────────┐ send ┌────────┐
│ Agent /  │────────▶│ Redis  │──────────▶│ ws_router  │─────▶│ 前端   │
│ Workflow │         │ Pub/Sub│           │            │      │        │
└──────────┘         └────────┘           └────────────┘      └────────┘
```

- **解耦**：Workflow / Agent 不感知 WebSocket 存在，只 publish。
- **可重放**：所有消息同时被持久化到 `logs/messages/{task_id}.json`，前端刷新可恢复。
- **跨进程**：未来支持多 worker 时，任意 worker 推送都能到达任意 WebSocket。

### 5.4 为什么有「记忆压缩」？

`Agent` 基类按 `context_window * 0.75` 作为阈值，超过后用 `simple_chat` 让 LLM 把早期对话总结成一条 `assistant` 消息。要点：

- **保留 system prompt** 和**最后 N 条消息**（不破坏 tool_call ↔ tool_result 的配对）
- 切割点必须是「安全点」：不会留下孤立的 `role: tool`
- 失败时回退到「保留 system + 最后 3 条」的策略

### 5.5 双解释器（Local / E2B）的统一抽象

```
BaseCodeInterpreter
   ├─ async initialize()
   ├─ async _pre_execute_code()      # 注入中文字体、切换工作目录
   ├─ async execute_code(code)       # 返回 (text_to_gpt, error_occurred, error_message)
   ├─ async cleanup()
   ├─ async get_created_images(section)
   └─ section_output: dict           # 按 subtask 分段归档
        │
        ├── LocalCodeInterpreter   (jupyter_client.start_new_kernel)
        └── E2BCodeInterpreter     (E2B Sandbox)
```

`interpreter_factory.create_interpreter()` 自动根据 `E2B_API_KEY` 是否存在选择实现，调用方完全无感知。

---

## 6. 状态与消息模型

### 6.1 任务状态

任务以 `task_id`（19 位时间戳 + 8 位 UUID）为主键，存活信息存于 Redis：

```
key: task_id:{task_id}    value: task_id    TTL: 36000s
```

### 6.2 消息类型（前后端共享语义）

| msg_type | 子类型 | 含义 |
| --- | --- | --- |
| `system` | info/warning/success/error | 工作流状态广播（如「代码手开始求解 ques1」） |
| `agent` | coordinator/modeler/coder/writer | 各 Agent 的输出文本 |
| `tool` | execute_code / search_scholar | 工具调用的输入输出（代码 + 运行结果 / 检索词 + 文献列表） |
| `user` | — | 用户输入（HIL 场景） |
| `approval` | — | HIL 审批请求 |

详细字段见 `backend/app/schemas/response.py`。

### 6.3 A2A（Agent-to-Agent）数据契约

为了让 Agent 之间「按结构传棒」，所有交接都用 Pydantic 模型（`backend/app/schemas/A2A.py`）：

```python
CoordinatorToModeler  →  questions: dict, ques_count: int
ModelerToCoder        →  questions_solution: dict[str, str]
CoderToWriter         →  code_response: str, created_images: list[str]
WriterResponse        →  response_content: Any, footnotes: list
```

---

## 7. 安全与边界

| 风险 | 现状 / 缓解 |
| --- | --- |
| 任意代码执行 | 默认本地 Jupyter 内核（信任用户机器），生产建议用 E2B 沙箱 |
| `task_id` 注入 | `ensure_safe_task_id` 严格白名单校验 |
| CORS | 默认 `*`，生产应通过 `CORS_ALLOW_ORIGINS` 收敛 |
| LLM Key 泄漏 | 前端只把 Key 通过 `/save-api-config` 提交，存于后端 `settings`；亦可改用环境变量 |
| 长任务挂死 | `asyncio.wait_for(task, timeout=3600*5)` 兜底 5 小时 |

---

## 8. 扩展方向

| 扩展点 | 如何动 |
| --- | --- |
| 加一个新 Agent（如 ReviewerAgent） | 1) 在 `core/agents/` 新增类继承 `Agent` 2) 在 `LLMFactory` 加配置 3) 在 `workflow.py` 串入 |
| 接入新模型供应商 | 实现 `BaseProvider`，在 `LLM._create_provider` 加 case |
| 替换沙箱（如 Daytona） | 实现 `BaseCodeInterpreter`，在 `interpreter_factory` 加分支 |
| 替换论文模板（如美赛 / LaTeX） | 改 `backend/app/config/md_template.toml` + Flows 章节 key |
| 加新工具（如代码 lint） | 在 `core/functions.py` 加 schema，在对应 Agent 的 tool_call 分支里 dispatch |

---

> 下一步：
> - 想看前端怎么搭：[frontend-architecture.md](./frontend-architecture.md)
> - 想看后端模块细节：[backend-architecture.md](./backend-architecture.md)
> - 想看 Agent 之间怎么传棒：[multi-agent.md](./multi-agent.md)
