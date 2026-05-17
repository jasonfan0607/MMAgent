# 🚀 部署文档

> 三种部署方式任选一种：Docker（最简单）、本地（最灵活）、自动脚本（社区贡献）。

---

## 1. 前置依赖

| 组件 | 版本要求 |
| --- | --- |
| Python | ≥ 3.12 |
| Node.js | ≥ 18 |
| pnpm | 10.6.3（由 `package.json:packageManager` 锁定） |
| Redis | ≥ 6（任意版本均可，alpine 镜像最方便） |
| Git | 任意 |
| Docker（可选） | 20+ |

LLM API Key（至少一个）：

- OpenAI / Anthropic 官方，或任意 LiteLLM 兼容中转
- 强烈建议**给四个 Agent 配置 ≥ 2 个不同模型**以达成成本/质量优化

---

## 2. 方案一：Docker（推荐）

### 2.1 一键启动

```bash
git clone https://github.com/jihe520/MathModelAgent.git
cd MathModelAgent
docker-compose up -d
```

容器列表：

| 容器 | 端口 | 用途 |
| --- | --- | --- |
| `mathmodelagent_redis` | `6379` | 任务队列 / 消息总线 |
| `mathmodelagent_backend` | `8000` | FastAPI |
| `mathmodelagent_frontend` | `5173` | Vite Dev Server |

访问入口：

- 前端：<http://localhost:5173>
- 后端 API：<http://localhost:8000>
- API 文档：<http://localhost:8000/docs>

### 2.2 配置 API Key

进入前端 → 侧边栏 → 头像 → `API Key` 弹窗，填好提交即可。

> 这种方式只保存在后端内存中，**容器重启会丢失**，需要重新填。

### 2.3 持久化数据

`docker-compose.yml` 已配置：

| 卷 | 路径 | 用途 |
| --- | --- | --- |
| `redis_data` | 容器内 `/data` | Redis 持久化 |
| 主机 → 容器 | `./backend/project/work_dir → /app/project/work_dir` | 任务工作目录 |
| 主机 → 容器 | `./backend/.env.dev → 内部 env_file` | 后端配置 |
| 主机 → 容器 | `./frontend/.env.development` | 前端配置（`VITE_API_URL` / `VITE_WS_URL`） |
| `backend_venv` | 容器内 `/app/.venv` | uv 虚拟环境，缩短重建时间 |

### 2.4 关闭 / 重启

```bash
docker-compose down                 # 关闭并删除容器
docker-compose down -v              # 同时删除数据卷
docker-compose up -d --build        # 强制重建镜像
docker-compose logs -f backend      # 看后端日志
```

---

## 3. 方案二：本地部署

### 3.1 启动 Redis

任选一种：

```bash
# macOS
brew install redis && brew services start redis

# Windows
choco install redis-64 ; redis-server

# Docker
docker run -d -p 6379:6379 --name mma-redis redis:alpine
```

确认能 ping 通：`redis-cli ping  ⇒  PONG`

### 3.2 启动后端

```bash
cd backend
pip install uv             # 推荐用 uv
uv sync                    # 同步依赖到 .venv

cp .env.example .env.dev   # 复制配置模板
# 编辑 .env.dev，至少填四个 Agent 的 *_API_KEY / *_MODEL
```

**macOS / Linux**：

```bash
export ENV=DEV
export REDIS_URL=redis://localhost:6379/0
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 \
        --ws-ping-interval 60 --ws-ping-timeout 120 --reload
```

**Windows PowerShell**：

```powershell
$env:ENV = "DEV"
$env:REDIS_URL = "redis://localhost:6379/0"
. .\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000 `
        --ws-ping-interval 60 --ws-ping-timeout 120 --reload
```

启动成功会看到 ASCII Banner + `Application startup complete`。

### 3.3 启动前端

```bash
cd frontend
npm install -g pnpm        # 已装可跳过
pnpm i
pnpm run dev               # 默认 http://localhost:5173
```

`.env.development` 默认指向本机 8000 端口，如改后端端口需同步修改：

```
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### 3.4 配置 API Key

两种方式二选一：

1. **前端配置**：侧边栏 → 头像 → API Key（**不持久化**）
2. **环境变量配置**（推荐）：编辑 `backend/.env.dev`：

```
COORDINATOR_API_TYPE=openai-chat
COORDINATOR_API_KEY=sk-xxx
COORDINATOR_MODEL=openai/gpt-4o-mini
COORDINATOR_BASE_URL=                # 留空 = 走官方

MODELER_API_TYPE=anthropic
MODELER_API_KEY=sk-ant-xxx
MODELER_MODEL=claude-sonnet-4

CODER_API_TYPE=openai-chat
CODER_API_KEY=sk-xxx
CODER_MODEL=openai/deepseek-v3
CODER_BASE_URL=https://api.deepseek.com

WRITER_API_TYPE=openai-chat
WRITER_API_KEY=sk-xxx
WRITER_MODEL=openai/gpt-4.1

# 可选：文献检索
OPENALEX_EMAIL=you@example.com
```

模型命名遵守 `provider/model` 约定（兼容 LiteLLM 生态）。

---

## 4. 方案三：社区脚本

由社区提供：[mmaAutoSetupRun](https://github.com/Fitia-UCAS/mmaAutoSetupRun)

> 适合**完全没装过环境**的人，但脚本随社区维护节奏走，可能滞后。

---

## 5. 可选能力开关

详见 `backend/app/config/setting.py`。默认关闭，开启前请装好对应外部依赖。

### 5.1 Web Search（Tavily）

```env
SEARCH_ENABLED=true
TAVILY_API_KEY=tvly-xxx
SEARCH_CACHE_TTL=86400
```

获取 Key：注册 <https://tavily.com>

### 5.2 RAG 本地知识库

```env
RAG_ENABLED=true
RAG_DB_PATH=data/chromadb
RAG_TOP_K=5
RAG_EMBEDDING_MODEL=BAAI/bge-m3
RAG_RERANKER_MODEL=BAAI/bge-reranker-v2-m3
```

首次启用会下载嵌入模型（占用 ~3 GB 显存或大内存）。

### 5.3 HIL 人机协作

```env
HIL_ENABLED=true
HIL_TIMEOUT=300
# 见 setting.py 中 HIL_CHECKPOINTS dict
```

### 5.4 云端代码沙箱（E2B）

```env
E2B_API_KEY=e2b_xxx
```

设置后 `interpreter_factory` 自动切换为远程沙箱；不设置则使用本地 Jupyter。

---

## 6. 生产部署建议

| 项 | 建议 |
| --- | --- |
| CORS | 收敛白名单：`CORS_ALLOW_ORIGINS=https://your.domain` |
| Redis | 独立 instance，开启密码 `REDIS_URL=redis://:passwd@host:6379/0` |
| 反向代理 | Nginx 把 `/api/*` → 8000，`/ws/*` → 8000，前端走 CDN |
| 代码沙箱 | 必须用 E2B / 类似云沙箱，禁止本地 Jupyter（容易被注入恶意代码） |
| 速率限制 | 在网关层加 rate-limit；后端目前无内置限流 |
| 日志 | 把 `logs/` 挂到外部存储；定期清理 `project/work_dir/` |
| 监控 | 暴露 `/status` 给探针；Pub/Sub 频道可订阅做 metrics |

---

## 7. 常见问题

### Q1：前端打不开 / WebSocket 连不上？

检查：

1. `.env.development` 的 `VITE_API_URL / VITE_WS_URL` 端口是否对
2. 后端是否启动（curl `http://localhost:8000/`）
3. 浏览器 console 是否有 CORS 报错（开发模式 CORS 默认 `*`，如不为 `*` 见上）

### Q2：任务一直卡在「任务开始处理」？

最可能原因：

1. Redis 没启动 / 连接失败 → `/status` 接口可立刻发现
2. LLM Key 错误 → 看 `backend/logs/{date}.log` 中的 `第 N 次重试` 报错
3. Coordinator 解析失败（题目格式过于自由）→ 改题目重提交

### Q3：本地 Jupyter 启动失败？

确保 backend 虚拟环境里安装了 `ipykernel`：

```bash
python -m ipykernel install --user --name python3
```

### Q4：Windows 下中文乱码？

LocalCodeInterpreter 已强制 `PYTHONUTF8=1 / PYTHONIOENCODING=utf-8`。如果仍乱码：

- 终端用 PowerShell 7+ 或 Windows Terminal
- 把数据集另存为 UTF-8 编码

### Q5：网络极差怎么办？

参考 [网络环境极差时的 MathModelAgent 配置过程](./网络环境极差时的MathModelAgent配置过程.md)。

---

> 部署完成？回到 [tutorial.md](./tutorial.md) 跑你的第一个示例题。
