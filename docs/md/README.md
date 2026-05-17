# 📚 MathModelAgent 文档中心

> 把 3 天的数学建模比赛压缩进 1 小时——这是 MathModelAgent 想做的事情。
>
> 本目录是项目的「使用手册 + 设计白皮书」，无论你是想跑通一份论文的参赛选手，还是想读懂代码的贡献者，都能在这里找到对应的入口。

---

## 🧭 文档地图

```
docs/md/
├── README.md                         # 你正在看的文档导览（本文件）
├── overview.md                       # 项目总览：愿景、能力、技术栈、定位
├── architecture.md                   # 总体架构：分层、模块、数据流、关键设计
├── frontend-architecture.md          # 前端架构：Vue 3 + shadcn-vue 工程详解
├── backend-architecture.md           # 后端架构：FastAPI + Agentless Workflow
├── multi-agent.md                    # 多 Agent 协同：四个 Agent 的分工与传棒
├── workflow.md                       # 端到端工作流：从提交题目到生成论文
├── api.md                            # REST + WebSocket 接口规范
├── prompts.md                        # Prompt 工程：四个 Agent 的系统提示词
├── deployment.md                     # 部署手册：Docker / 本地 / 云端
├── development.md                    # 开发指南：约定、目录、调试技巧
├── tutorial.md                       # 入门教程（已有）
├── License.md                        # 许可证（已有）
├── sponser.md                        # 赞助说明（已有）
└── 网络环境极差时的MathModelAgent配置过程.md   # 弱网环境配置（已有）
```

---

## 🚀 快速导航

| 我想…… | 跳转到 |
| --- | --- |
| 5 分钟了解这个项目 | [overview.md](./overview.md) |
| 看懂系统全貌 | [architecture.md](./architecture.md) |
| 改前端 UI / 添加页面 | [frontend-architecture.md](./frontend-architecture.md) |
| 改后端逻辑 / 加一个 Agent | [backend-architecture.md](./backend-architecture.md) |
| 理解四个 Agent 怎么传棒 | [multi-agent.md](./multi-agent.md) |
| 知道从提交题目到出论文每一步发生了什么 | [workflow.md](./workflow.md) |
| 接入 API / 写第三方客户端 | [api.md](./api.md) |
| 微调 Prompt / 自己写 Prompt 模板 | [prompts.md](./prompts.md) |
| 用 Docker 起服务 | [deployment.md](./deployment.md) |
| 参与贡献 / 本地调试 | [development.md](./development.md) |

---

## 🏷️ 文档约定

- 所有架构文档使用 **Mermaid / ASCII** 双绘图，方便在 GitHub 与本地编辑器中都能正常预览。
- 文中出现的 **代码引用** 会附带源文件路径，例如 `backend/app/core/workflow.py`。
- **配置项** 统一用大写蛇形命名，对应 `backend/app/config/setting.py` 中的字段。
- **Agent 名称** 全文统一使用四个角色：`CoordinatorAgent`、`ModelerAgent`、`CoderAgent`、`WriterAgent`。

---

## 🛠️ 文档维护

- 修改 Agent 行为时，请同步更新 [multi-agent.md](./multi-agent.md) 与 [prompts.md](./prompts.md)。
- 修改路由 / WebSocket 协议时，请同步更新 [api.md](./api.md)。
- 修改目录结构时，请同步更新本文件以及 [architecture.md](./architecture.md) 中的「项目结构」一节。

> 这些文档随项目代码一起演进，欢迎通过 PR 修正错漏。
