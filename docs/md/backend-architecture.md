# 🔧 后端架构文档

> Python 3.12 + FastAPI + 异步多 Agent 编排 + Redis 消息总线 + 双解释器。
>
> 适合：要改后端逻辑的人、要加新 Agent / Provider / 工具的人、要排查任务失败的人。

---

## 1. 设计理念

| 关键词 | 解释 |
| --- | --- |
| **Agentless** | 工作流只是一段 `async def`，没有图状态机、没有 actor 模型 |
| **Provider 解耦** | LLM 通过 `BaseProvider` 抽象，三种实现可插拔 |
| **角色配置独立** | 每个 Agent 都从 `settings.{ROLE}_*` 读取自己的 API Key / Model / BaseURL / API Type / Context Window / MaxTokens |
| **消息即事实** | 一切对外可见状态都是「发布到 Redis 的消息」，落盘后即可重放 |
| **失败可恢复** | LLM 调用三层重试 + Agent 内反思重试 + 后台任务超时兜底 |

---

## 2. 进程视图

```
                          ┌─────────────────────────┐
                          │   Browser (Vue 3)       │
                          └────────────┬────────────┘
        REST (axios)                   │     WebSocket
        ───────────────────────────────┴────────────────────────
                          ▼                          ▼
   ┌──────────────────────────────────────────────────────────┐
   │                   FastAPI (uvicorn)                       │
   │   ┌────────────┐ ┌────────┐ ┌────────┐ ┌──────────┐      │
   │   │ modeling   │ │  ws    │ │ common │ │  files   │      │
   │   └────┬───────┘ └────┬───┘ └────┬───┘ └────┬─────┘      │
   │        │              │          │          │             │
   │        │      ┌───────▼───────┐  │          │             │
   │        │      │ ws_manager    │  │          │             │
   │        │      └───────────────┘  │          │             │
   │        ▼                                                  │
   │  BackgroundTask: run_modeling_task_async                  │
   │        │                                                  │
   │        ▼                                                  │
   │  MathModelWorkFlow.execute  (core/workflow.py)            │
   │        │                                                  │
   │        ▼                                                  │
   │  4 Agents × LLM × CodeInterpreter × OpenAlex              │
   │        │                                                  │
   │        ▼                                                  │
   │  Redis Pub/Sub  ◀─── publish_message                      │
   │        │                                                  │
   │        └───▶ ws_router → 前端                              │
   └──────────────────────────────────────────────────────────┘
                          ▲
                          │ async client
              ┌───────────┴────────────┐
              │      Redis             │
              │  • task_id:{tid} (KV)  │
              │  • task:{tid}:messages │
              └────────────────────────┘
```

---

## 3. 目录结构

```
backend/
├── pyproject.toml / uv.lock         # uv 包管理
├── Dockerfile
├── .env.example                     # 环境变量模板（实际用 .env.dev）
├── conftest.py                      # pytest 入口
└── app/
    ├── main.py                      # FastAPI app + 路由注册 + 静态文件 + lifespan
    │
    ├── config/
    │   ├── setting.py               # Pydantic-Settings 全局配置
    │   ├── model_config.toml        # 各模型 max_tokens 默认值
    │   └── md_template.toml         # 论文章节模板（可自定义）
    │
    ├── routers/                     # FastAPI 路由
    │   ├── modeling_router.py       # /modeling, /example, /validate-api-key, /save-api-config
    │   ├── ws_router.py             # /task/{task_id}  WebSocket
    │   ├── common_router.py         # /, /messages, /writer_seque, /status, /config
    │   └── files_router.py          # /files, /download_url, /open_folder
    │
    ├── core/
    │   ├── workflow.py              # MathModelWorkFlow 主编排
    │   ├── flows.py                 # 子任务 / 章节流定义
    │   ├── functions.py             # 工具 schema（execute_code / search_papers）
    │   ├── agents/
    │   │   ├── __init__.py          # 统一导出
    │   │   ├── agent.py             # Agent 基类（chat 历史 + 记忆压缩）
    │   │   ├── coordinator_agent.py
    │   │   ├── modeler_agent.py
    │   │   ├── coder_agent.py
    │   │   └── writer_agent.py
    │   ├── llm/
    │   │   ├── llm.py               # LLM Facade：chat / retry / send_message
    │   │   ├── llm_factory.py       # 4 个角色一次性构造
    │   │   ├── types.py             # StandardResponse / ToolCall / Usage
    │   │   └── providers/
    │   │       ├── base.py          # BaseProvider 抽象
    │   │       ├── openai_chat.py
    │   │       ├── openai_responses.py
    │   │       └── anthropic.py
    │   └── prompts/                 # 各 Agent 的系统提示词
    │       ├── coordinator.py
    │       ├── modeler.py
    │       ├── coder.py
    │       ├── writer.py
    │       └── shared.py            # 反思 / 完成检查 prompt
    │
    ├── schemas/                     # Pydantic 模型
    │   ├── request.py               # Problem / ExampleRequest
    │   ├── response.py              # SystemMessage / AgentMessage / ToolMessage ...
    │   ├── A2A.py                   # Agent 间数据契约
    │   ├── tool_result.py
    │   └── enums.py                 # CompTemplate / FormatOutPut / AgentType / AgentStatus
    │
    ├── services/
    │   ├── redis_manager.py         # Pub/Sub + 消息落盘到 logs/messages/
    │   └── ws_manager.py            # 活跃 WebSocket 连接池
    │
    ├── tools/
    │   ├── base_interpreter.py      # 解释器抽象
    │   ├── local_interpreter.py     # jupyter_client 本地内核
    │   ├── e2b_interpreter.py       # E2B 云沙箱
    │   ├── interpreter_factory.py   # 按 E2B_API_KEY 自动选择
    │   ├── notebook_serializer.py   # 把代码 / 输出落 ipynb
    │   ├── openalex_scholar.py      # OpenAlex 文献搜索
    │   └── base.py
    │
    ├── utils/
    │   ├── common_utils.py          # create_task_id / create_work_dir / md_2_docx ...
    │   ├── log_util.py              # loguru 日志
    │   ├── cli.py                   # ASCII Banner
    │   ├── RichPrinter.py
    │   ├── data_recorder.py
    │   └── track.py
    │
    ├── models/
    │   └── user_output.py           # 任务输出累积与持久化
    │
    └── example/example/2023华数杯C题/...  # 内置示例数据
```

---

## 4. 启动流程

```python
# app/main.py
@asynccontextmanager
async def lifespan(app: FastAPI):
    print(ASCII_BANNER)
    os.makedirs("./project", exist_ok=True)  # 工作目录
    yield

app = FastAPI(lifespan=lifespan, ...)
app.include_router(modeling_router.router)
app.include_router(ws_router.router)
app.include_router(common_router.router)
app.include_router(files_router.router)
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)
app.mount("/static", StaticFiles(directory="project/work_dir"), name="static")
```

启动命令（已在 README）：

```powershell
$env:ENV = "DEV"; $env:REDIS_URL = "redis://localhost:6379/0"
.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 `
    --ws-ping-interval 60 --ws-ping-timeout 120 --reload
```

---

## 5. 配置中心

文件：`app/config/setting.py`

基于 `pydantic-settings`，按 `ENV` 自动加载 `.env.{env}`（默认 `.env.dev`）。

### 5.1 四个 Agent 的可独立配置项

```
COORDINATOR_API_TYPE   COORDINATOR_API_KEY   COORDINATOR_MODEL
COORDINATOR_BASE_URL   COORDINATOR_MAX_TOKENS COORDINATOR_CONTEXT_WINDOW
（MODELER / CODER / WRITER 同名，前缀替换即可）
```

### 5.2 全局开关

| 配置 | 默认 | 含义 |
| --- | --- | --- |
| `MAX_CHAT_TURNS` | None | CoderAgent 单子任务最大轮次 |
| `MAX_RETRIES` | None | 全局重试上限 |
| `E2B_API_KEY` | None | 设置后自动切换为云沙箱 |
| `REDIS_URL` | `redis://redis:6379/0` | Docker 默认 `redis`，本地用 `localhost` |
| `REDIS_MAX_CONNECTIONS` | 10 | 连接池大小 |
| `CORS_ALLOW_ORIGINS` | `*` | 生产建议白名单 |
| `OPENALEX_EMAIL` / `OPENALEX_API_KEY` | None | 文献搜索 |
| `SEARCH_ENABLED` + `TAVILY_API_KEY` | False | Web 搜索 |
| `RAG_ENABLED` + `RAG_DB_PATH` + `RAG_TOP_K` | False / `data/chromadb` / 5 | 本地知识库 |
| `HIL_ENABLED` / `HIL_TIMEOUT` / `HIL_CHECKPOINTS` | True / 300s / dict | 人机协作开关 |

### 5.3 加载顺序

```
.env.{ENV}  →  环境变量覆盖  →  /save-api-config 运行时覆盖
```

`/save-api-config` 路由直接改 `settings` 内存对象，**不会回写 .env 文件**，所以是「会话级」配置。

---

## 6. 路由层

### 6.1 modeling_router

| 路由 | 方法 | 描述 |
| --- | --- | --- |
| `/validate-api-key` | POST | 用一条 `Hi` 触发 1 token 的请求，按状态码判断 Key 是否可用 |
| `/save-api-config` | POST | 写入 settings 内存（4 个 Agent + OpenAlex email） |
| `/validate-openalex-email` | POST | 调 OpenAlex API 检查 mailto |
| `/example` | POST | 一键启动内置示例（如 2023 华数杯 C 题） |
| `/modeling` | POST | **主入口**：multipart/form-data 接收题目 + 文件，BackgroundTask 异步建模 |

关键逻辑：

```python
def _ensure_model_configured():
    """启动前阻断未配齐的请求，避免后台任务进入无限重试。"""
    missing = _missing_model_config()
    if missing:
        raise HTTPException(400, f"请先配置：{', '.join(missing)}")
```

后台任务：

```python
background_tasks.add_task(run_modeling_task_async, task_id, ques_all, comp_template, format_output)
return {"task_id": task_id, "status": "processing"}
```

`run_modeling_task_async` 内部：

```python
task = asyncio.create_task(MathModelWorkFlow().execute(problem))
await asyncio.wait_for(task, timeout=3600 * 5)   # 5h 兜底
md_2_docx(task_id)                                # 论文转 docx
```

### 6.2 ws_router

`/task/{task_id}` WebSocket：

1. `ensure_safe_task_id` 防注入
2. Redis 检查 `task_id:{task_id}` 是否存在，不存在则关闭 1008
3. `subscribe_to_task` 订阅 `task:{tid}:messages`
4. `while True` 循环 `pubsub.get_message`，反序列化后 `send_personal_message_json`
5. 处理三类异常：`WebSocketDisconnect`、send-after-close、解析失败

### 6.3 common_router / files_router

| 路由 | 用途 |
| --- | --- |
| `/` | 健康检查 |
| `/config` | 返回非敏感配置（环境、当前模型、限流） |
| `/writer_seque` | 论文章节顺序 |
| `/messages?task_id=` | 从 `logs/messages/{tid}.json` 拉历史 |
| `/status` | 后端 + Redis 双联通检查 |
| `/files?task_id=` | 列工作目录文件 |
| `/download_url` / `/download_all_url` | 单文件 / 全包下载链接 |
| `/open_folder` | 仅本地：调 `explorer` / `open` 打开工作目录 |

---

## 7. 工作流层

文件：`app/core/workflow.py`

```python
class MathModelWorkFlow(WorkFlow):
    async def execute(self, problem: Problem):
        self.task_id = problem.task_id
        self.work_dir = create_work_dir(self.task_id)

        # 1. 准备四个 LLM
        coordinator_llm, modeler_llm, coder_llm, writer_llm = \
            LLMFactory(self.task_id).get_all_llms()

        # 2. Coordinator 拆题
        coordinator = CoordinatorAgent(self.task_id, coordinator_llm,
                                       context_window=settings.COORDINATOR_CONTEXT_WINDOW)
        coordinator_response = await coordinator.run(problem.ques_all)
        self.questions = coordinator_response.questions
        self.ques_count = coordinator_response.ques_count

        # 3. Modeler 出方案
        modeler = ModelerAgent(self.task_id, modeler_llm, ...)
        modeler_response = await modeler.run(coordinator_response)

        # 4. 创建解释器（local / e2b 自动选）
        notebook_serializer = NotebookSerializer(work_dir=self.work_dir)
        code_interpreter = await create_interpreter(...)
        scholar = OpenAlexScholar(task_id=self.task_id, email=..., api_key=...)

        # 5. 求解阶段：eda → ques1..N → sensitivity_analysis
        coder = CoderAgent(..., code_interpreter=code_interpreter, ...)
        writer = WriterAgent(..., scholar=scholar, ...)
        flows = Flows(self.questions)
        solution_flows = flows.get_solution_flows(self.questions, modeler_response)

        for key, value in solution_flows.items():
            coder_response = await coder.run(prompt=value["coder_prompt"], subtask_title=key)
            writer_prompt = flows.get_writer_prompt(key, coder_response.code_response or "",
                                                    code_interpreter, config_template)
            writer_response = await writer.run(writer_prompt,
                                               available_images=coder_response.created_images,
                                               sub_title=key)
            user_output.set_res(key, writer_response)

        await code_interpreter.cleanup()

        # 6. 写作阶段：摘要 / 重述 / 假设 / 符号 / 评价
        write_flows = flows.get_write_flows(user_output, config_template, problem.ques_all)
        for key, value in write_flows.items():
            writer_response = await writer.run(prompt=value, sub_title=key)
            user_output.set_res(key, writer_response)

        user_output.save_result()
```

> 这就是「Agentless」的具体含义：**没有图、没有状态机、就是普通的 for 循环**。

---

## 8. Agent 层

详见 [multi-agent.md](./multi-agent.md)。这里只列出基类：

```python
class Agent:
    def __init__(self, task_id, model: LLM, context_window=128000,
                 token_threshold_ratio=0.75):
        self.task_id = task_id
        self.model = model
        self.chat_history: list[dict] = []
        self.context_window = context_window
        self.current_token_count = 0

    async def append_chat_history(self, msg)
    async def compress_if_needed()          # 超过 75% 触发 LLM 总结
    def _find_safe_preserve_point()         # 不切断 tool_call ↔ tool 消息序列
    def _get_safe_fallback_history()        # 压缩失败时的回退
```

---

## 9. LLM 层

### 9.1 三个 Provider 的统一抽象

`app/core/llm/providers/base.py`

```python
class BaseProvider(abc.ABC):
    async def call(self, *, messages, model, api_key, base_url=None,
                   tools=None, tool_choice=None, max_tokens=None, top_p=None
                   ) -> StandardResponse: ...
```

`StandardResponse` 统一字段（`types.py`）：

```
content: str | None
reasoning_content: str | None   # o-series / Claude 推理可见模型才有
tool_calls: list[ToolCall]
usage: Usage(prompt_tokens, completion_tokens, total_tokens)
```

### 9.2 LLM Facade

`app/core/llm/llm.py` 主要做四件事：

1. **配置校验**（缺 Key / Model 立即报 `LLMConfigError`）
2. **工具调用完整性修复**：清理孤立的 `tool_calls` 或孤立的 `role: tool` 消息（避免 OpenAI 400）
3. **指数退避重试**：默认 3 次，重试间隔 `retry_delay * min(attempt, 10)`
4. **发布消息到前端**：根据 `agent_name` 把 LLM 返回的 content 包装为对应的 `*Message` 模型推到 Redis

```python
match agent_name:
    case AgentType.CODER:   agent_msg = CoderMessage(content=content)
    case AgentType.WRITER:  agent_msg = WriterMessage(content=content, sub_title=sub_title)
    case AgentType.MODELER: agent_msg = ModelerMessage(content=content)
    case AgentType.COORDINATOR: agent_msg = CoordinatorMessage(content=content)
    ...
await redis_manager.publish_message(self.task_id, agent_msg)
```

### 9.3 LLMFactory

按角色读 settings 字段一次性构造 4 个 `LLM` 实例。**未来想给某个 Agent 切别的模型，改 .env 即可，不动代码。**

---

## 10. 工具与解释器

### 10.1 代码解释器

```
BaseCodeInterpreter
├─ initialize()
├─ _pre_execute_code()         # 注入中文字体 / 切换工作目录 / matplotlib 配置
├─ execute_code(code)
│      └─ 返回 (text_to_gpt, error_occurred, error_message)
├─ get_created_images(section) # 按 subtask 归档生成的图片
├─ section_output dict          # {section: {"content": [...], "images": [...]}}
└─ cleanup()
```

**LocalCodeInterpreter**：

- 用 `jupyter_client.manager.start_new_kernel(kernel_name="python3", env=...)` 起新内核
- 强制 `PYTHONIOENCODING=utf-8 PYTHONUTF8=1`，解决 Windows GBK 乱码
- 预热代码：清字体缓存 → 加载工作目录字体 → 设置 matplotlib

**E2BCodeInterpreter**：

- 通过 `E2B_API_KEY` 起远程 sandbox
- 文件需要上传/下载，初始化耗时但隔离性好

### 10.2 NotebookSerializer

每次 `execute_code` 调用后，把 (code, outputs) 追加到 `notebook.ipynb`：

- 用户最后能拿到一份**完整的、可重跑的 Notebook**
- 也是评审 / 复现的「黑匣子」

### 10.3 OpenAlexScholar

`writer_agent` 调用 `search_papers(query)` 时：

```python
papers = await scholar.search_papers(query)
papers_str = scholar.papers_to_str(papers)  # 拼成 LLM 友好文本
# 作为 tool 响应继续对话
```

---

## 11. 实时消息总线

文件：`app/services/redis_manager.py`

```python
class RedisManager:
    async def publish_message(self, task_id: str, message: Message):
        client = await self.get_client()
        channel = f"task:{task_id}:messages"
        await client.publish(channel, message.model_dump_json())
        await self._save_message_to_file(task_id, message)   # logs/messages/{tid}.json

    async def subscribe_to_task(self, task_id: str):
        client = await self.get_client()
        pubsub = client.pubsub()
        await pubsub.subscribe(f"task:{task_id}:messages")
        return pubsub
```

特点：

- **双写**：Redis Pub/Sub（实时） + 本地文件（重放）
- **任务存活校验**：`task_id:{tid}` Key TTL 36000s，WebSocket 接入前会校验
- **不阻塞主流程**：文件写失败只记日志，不抛异常

---

## 12. 失败 / 重试 / 兜底矩阵

| 层级 | 触发条件 | 行为 |
| --- | --- | --- |
| LLM 调用 | HTTP 异常 / 超时 | `effective_max_retries`（默认 3）次指数退避 |
| LLM Tool Call | `tool_calls` 与 `role: tool` 配对损坏 | `_validate_and_fix_tool_calls` 自动修剪 |
| CoderAgent | 代码运行错误 | `get_reflection_prompt` 注入反思，重试 `MAX_RETRIES` 次 |
| CoderAgent | 超过 `MAX_CHAT_TURNS` | 抛 Exception，主流程发 error SystemMessage |
| CoordinatorAgent | JSON 解析失败 | 注入「严格 JSON」错误反馈再请求 |
| ModelerAgent | JSON 解析失败 | `repair_json` 三层修复（直接 / 转义 / 正则提取） |
| Agent 内存压缩 | `current_token_count > 0.75 * context_window` | LLM 总结早期对话，保留系统消息 + 末尾安全段 |
| Workflow | 总耗时 > 5h | `asyncio.wait_for` 超时取消 |
| WebSocket | 客户端断开 / send-after-close | 跳出循环，unsubscribe，cleanup |

---

## 13. 输出物 (artifacts) 落盘

```
backend/project/work_dir/{task_id}/
├── notebook.ipynb         # 完整代码 + 输出
├── res.md                 # 论文 Markdown
├── res.docx               # md_2_docx 转换的 docx
├── *.png                  # CoderAgent 生成的图
├── 数据集.{csv|xlsx}      # 用户上传的原始数据
└── ...

backend/logs/messages/{task_id}.json    # 所有消息持久化
backend/logs/{date}.log                 # loguru 滚动日志
```

`/static/{task_id}/{filename}` 通过 `StaticFiles` 直接暴露给前端下载。

---

## 14. 代码风格速查

来自 `CLAUDE.md`：

- 模块 / 类 / 公共方法都要 Google 风格 docstring（中文）
- 类型注解用 `str | None`，不要 `Optional[str]`
- FastAPI 路由 / 工具方法一律 `async def`
- 注释**解释 Why**，不重复 What

示例：

```python
"""协调者 Agent 模块，负责识别用户意图并拆解数学建模问题。"""

class CoordinatorAgent(Agent):
    """协调者 Agent，判断用户输入是否为数学建模问题并拆解为结构化问题列表。"""

    async def run(self, ques_all: str) -> CoordinatorToModeler:
        """解析用户输入的问题并格式化为结构化 JSON。

        Args:
            ques_all: 用户输入的完整题目信息。

        Returns:
            CoordinatorToModeler 对象，包含结构化问题和问题数量。
        """
```

---

## 15. 扩展指南

| 我想做什么 | 怎么做 |
| --- | --- |
| 加一个新 Provider（如 Gemini 原生 API） | 实现 `BaseProvider`，在 `LLM._create_provider` 注册新 `ApiType` |
| 加一个新工具（如 SymPy 求解、SQL 查询） | 在 `core/functions.py` 加 schema，在对应 Agent 的 `tool_calls` 分支中 dispatch |
| 加一个新 Agent | 1) `core/agents/xxx_agent.py` 继承 `Agent` 2) `LLMFactory` 增配置 3) `workflow.py` 串入；4) 加 `XxxMessage` 类型；5) `LLM.send_message` 加 case |
| 自定义论文模板 | 改 `backend/app/config/md_template.toml`，注意保持章节 key |
| 接入新沙箱（如 Daytona） | 实现 `BaseCodeInterpreter`，在 `interpreter_factory` 加分支 |
| 让某些消息不推前端 | 直接调用 `LLM.provider.call`（绕过 `LLM.chat`），或者用 `simple_chat` |

---

## 16. 调试技巧

```python
# 全局开 DEBUG
$env:LOG_LEVEL="DEBUG"

# 单 Agent 调试：在 workflow.py 注释掉后续步骤，只跑前面
# 复现某次任务：复制 logs/messages/{tid}.json 到一个 Python 脚本，逐条消息 replay
# 内存压缩排查：把 _DEFAULT_TOKEN_THRESHOLD_RATIO 调到 0.3 强制触发
# LLM 调用排查：在 LLM.chat 里把 messages 整体 dump 到本地 .json
```

---

> 下一步：
> - 看四个 Agent 怎么协同：[multi-agent.md](./multi-agent.md)
> - 看端到端工作流时序：[workflow.md](./workflow.md)
> - 看接口字段：[api.md](./api.md)
