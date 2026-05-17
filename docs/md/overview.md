# 🤖 MathModelAgent 项目总览

> 一个把「3 天数学建模比赛」压缩成「1 小时全自动产出可提交论文」的多 Agent 系统。

---

## 🌟 产品定位

MathModelAgent 是一套**专为数学建模竞赛设计的 Agentless 工作流系统**：用户输入题目和数据，系统自动完成「问题拆解 → 建模方案 → 代码求解 → 论文撰写」全流程，最终产出一份排版完整、可直接提交的 Markdown / DOCX 论文。

它不是又一个通用对话机器人，而是一支**虚拟数学建模队**：

| 角色 | 真实队员对应 | 在系统中负责 |
| --- | --- | --- |
| `CoordinatorAgent` | 队长 | 读题、判断是否是建模题、拆问题 |
| `ModelerAgent` | 建模手 | 选模型、设计求解思路、可视化方案 |
| `CoderAgent` | 编程手 | 写 Python、跑 Jupyter、画图、调 Bug |
| `WriterAgent` | 论文手 | 按章节模板写论文、查文献、插图 |

---

## ✨ 核心能力

| 能力 | 说明 |
| --- | --- |
| 🔍 自动建模全流程 | 题目识别 → 拆解 → 建模 → 编码 → 调错 → 写论文，一气呵成 |
| 💻 双解释器 | 本地 Jupyter（保存为 ipynb，可二次编辑）或云端 E2B 沙箱 |
| 📝 排版完整论文 | 摘要 / 问题重述 / 问题分析 / 模型假设 / 符号 / EDA / 求解 / 敏感性 / 评价 |
| 🤝 多 Agent 协同 | 四个 Agent 各司其职，通过结构化 A2A 数据传棒 |
| 🔄 多模型路由 | 每个 Agent 可独立配置模型（思考用 o-series，写代码用 Claude，写文用 GPT） |
| 🤖 全模型适配 | 内置 OpenAI Chat / OpenAI Responses / Anthropic 三种 Provider，兼容 LiteLLM 全部模型 |
| 💰 低成本 | Agentless 直连工作流，不依赖 LangGraph / AutoGen 等重框架，token 利用最大化 |
| 🧩 自定义模板 | 通过 Prompt Inject 为每个 subtask 单独注入需求 |
| 🌐 联网搜索 | 内置 Tavily API（可选），让 Agent 自主联网取真实数据 |
| 📚 RAG 知识库 | ChromaDB + Rerank 检索建模方法、代码模板与论文写作参考（可选） |
| 🤝 HIL 人机协作 | 关键节点暂停审批，支持 `confirm / edit / regenerate / ask / skip / abort` 六种动作（可选） |
| 🛡️ 四层容错 | 有限重试 → Fallback Hand Off → Evaluator Shadow Mode → Feedback Rerun |

---

## 🧱 技术架构（一张图看懂）

```
            ┌─────────────────────────────────────────────────────┐
            │                     用户 / 选手                     │
            └───────────────┬─────────────────────────────────────┘
                            │ 题目文本 + 数据集
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│                Vue 3 前端  (Vite + shadcn-vue + Pinia)            │
│   提交表单 ─▶ 任务页（Chat 区 + Modeler/Coder/Writer Tabs）        │
└───────────────┬────────────────────────────────▲──────────────────┘
                │ HTTP /modeling (multipart)     │ WebSocket
                │                                │ /task/{task_id}
                ▼                                │
┌───────────────────────────────────────────────────────────────────┐
│              FastAPI 后端 (Python 3.12, asyncio)                   │
│                                                                   │
│   Routers (modeling / ws / common / files)                        │
│       │                                                           │
│       ▼                                                           │
│   MathModelWorkFlow  ──编排──▶  Coordinator → Modeler             │
│                                                  ↓                │
│                              ┌──── Coder ◀── Flows 子任务 ─┐      │
│                              │                            │      │
│                              ▼                            │      │
│                           Writer ◀────────────────────────┘      │
│       │                                                           │
│       ▼                                                           │
│   Code Interpreter (Local Jupyter / E2B Cloud)                    │
│   Redis Pub/Sub  ──实时消息──▶  WebSocket  ──▶  前端              │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🛠 技术栈

### 前端

- **Vue 3** + **TypeScript** + **Vite**
- **shadcn-vue / Reka UI** —— 复制式 UI 库（位于 `src/components/ui/`，不要修改）
- **Tailwind CSS 3** —— 原子化样式
- **Pinia** + `pinia-plugin-persistedstate` —— 状态管理（任务消息、API Key 持久化）
- **vue-router 4** —— 路由
- **marked / katex / highlight.js / md-editor-v3** —— Markdown + LaTeX + 代码高亮
- **render-jupyter-notebook-vue** —— 在浏览器内渲染 Notebook
- **Biome** —— Lint + Format

### 后端

- **Python 3.12** + **uv** 包管理
- **FastAPI** + **uvicorn** —— REST + WebSocket
- **pydantic-settings** —— `.env.dev` 驱动的配置中心
- **redis.asyncio** —— Pub/Sub 实时消息广播
- **jupyter_client** —— 本地 Jupyter 内核
- **E2B SDK**（可选）—— 云端沙箱
- **aiofile / requests / icecream / Pydantic v2** 等

### LLM 接入

- **三套原生 Provider**（在 `backend/app/core/llm/providers/`）：
  - `openai_chat` —— OpenAI Chat Completions / 中转 / DeepSeek / Qwen 等
  - `openai_responses` —— OpenAI Responses API（o-series 思考模型）
  - `anthropic` —— Anthropic Claude
- **LiteLLM 兼容**：通过 `provider/model` 命名约定可直接连接任意供应商

### 工具与基建

- **Redis** —— 任务消息发布订阅 + 任务 ID 存活校验
- **OpenAlex** —— 学术文献检索（用于 `search_papers` 工具）
- **Tavily**（可选）—— Web Search
- **ChromaDB + bge-m3 / bge-reranker-v2-m3**（可选）—— RAG

---

## 📁 项目结构

```
MathModelAgent/
├── backend/                       # Python 后端
│   ├── app/
│   │   ├── main.py                # FastAPI 入口
│   │   ├── config/                # pydantic-settings 配置
│   │   ├── core/
│   │   │   ├── agents/            # 四个 Agent 实现 + Agent 基类
│   │   │   ├── llm/               # LLM 抽象 + Provider 实现
│   │   │   ├── prompts/           # 各 Agent 的系统提示词
│   │   │   ├── flows.py           # 任务拆分与子任务编排
│   │   │   ├── workflow.py        # 多 Agent 主工作流
│   │   │   └── functions.py       # 工具 schema 定义
│   │   ├── routers/               # FastAPI 路由（modeling / ws / common / files）
│   │   ├── schemas/               # Pydantic 模型（请求 / 响应 / A2A / 枚举）
│   │   ├── services/              # Redis Manager + WebSocket Manager
│   │   ├── tools/                 # 代码解释器（本地 / E2B）+ OpenAlex
│   │   ├── utils/                 # 通用工具（日志 / cli / 数据记录）
│   │   └── example/               # 内置测试题目（如 2023 华数杯 C 题）
│   ├── pyproject.toml             # uv 依赖声明
│   └── Dockerfile
├── frontend/                      # Vue 3 前端
│   ├── src/
│   │   ├── main.ts / App.vue
│   │   ├── router/                # 路由配置
│   │   ├── stores/                # Pinia store（task / apiKeys）
│   │   ├── apis/                  # 后端 API 封装（axios）
│   │   ├── pages/                 # 路由页面（index / chat / login / task）
│   │   ├── components/            # 通用组件 + shadcn-vue（components/ui/）
│   │   ├── utils/                 # markdown / websocket / 类型 / 枚举
│   │   └── assets/                # 样式 + 静态资源
│   ├── package.json
│   └── Dockerfile
├── docs/                          # 文档（你正在读的目录的上一级）
├── docker-compose.yml             # 一键编排
└── README.md
```

---

## 🎯 适合谁

| 场景 | 适配度 |
| --- | --- |
| 想用 AI 跑一份「能看」的建模草稿，节省 80% 体力活 | ⭐⭐⭐⭐⭐ |
| 想学多 Agent 工程实践、Prompt 设计 | ⭐⭐⭐⭐⭐ |
| 想 Hack 一个属于自己的领域 Agent 流水线 | ⭐⭐⭐⭐ |
| 想直接拿来打国赛拿奖 | ⭐⭐（请把 AI 输出当草稿，不要当答卷） |

---

## ⚠️ 项目状态

- 处于 **实验探索 / 持续迭代 demo 阶段**，存在 bug 与待优化项
- AI 生成内容**仅供参考**，不能直接当作正式参赛答卷
- 欢迎通过 Issues / PR 贡献代码、文档、案例

> 下一步推荐阅读：[architecture.md](./architecture.md) 了解系统全貌。
