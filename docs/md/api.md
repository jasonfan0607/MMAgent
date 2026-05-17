# 📡 API 接口规范

> 所有 REST 接口走 FastAPI，所有实时消息走 WebSocket + Redis Pub/Sub。本文档列出对外可见的全部接口字段。

---

## 1. 全局

| 项 | 默认值 |
| --- | --- |
| HTTP 基地址 | `http://localhost:8000` |
| WebSocket 基地址 | `ws://localhost:8000` |
| CORS | 开发期 `*` |
| 编码 | UTF-8 |

错误响应统一为 FastAPI 默认：

```json
{ "detail": "错误描述" }
```

---

## 2. 建模任务相关

### 2.1 POST `/modeling` —— 提交建模任务

`multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ques_all` | string | ✅ | 完整题目文本（含背景与子问题） |
| `comp_template` | enum `CHINA` / `AMERICAN` | ✅ | 论文模板（目前主用 CHINA） |
| `format_output` | enum `Markdown` / `LaTeX` | ✅ | 输出格式 |
| `files` | UploadFile[] | ❌ | 数据集文件，多个 |

**响应**：

```json
{ "task_id": "20260517-152033-abcdef12", "status": "processing" }
```

**前置条件**：服务器内 settings 中四个 Agent 的 `API_KEY / MODEL` 都已配齐，否则 400：

```json
{ "detail": "请先在设置中完整配置模型参数：协调者 API Key, ..." }
```

### 2.2 POST `/example` —— 一键跑内置示例

```jsonc
// Request
{ "example_id": "001", "source": "2023华数杯C题" }

// Response
{ "task_id": "...", "status": "processing" }
```

后端会自动从 `backend/app/example/example/{source}/` 拷贝题目与数据到工作目录。

---

## 3. API Key 管理

### 3.1 POST `/validate-api-key`

```jsonc
// Request
{
  "api_key": "sk-...",
  "base_url": "https://api.openai.com/v1",
  "model_id": "gpt-4o-mini",
  "api_type": "openai-chat"      // openai-chat / openai-responses / anthropic
}
```

```jsonc
// Response
{ "valid": true,  "message": "✓ 模型 API 验证成功" }
{ "valid": false, "message": "✗ API Key 无效或已过期" }
```

会用 `messages=[{"role":"user","content":"Hi"}]`、`max_tokens=1` 触发最小调用，按 401/404/429/403 给出友好提示。

### 3.2 POST `/save-api-config`

```jsonc
{
  "coordinator": { "apiKey":"...", "modelId":"...", "baseUrl":"...", "apiType":"...", "contextWindow": 128000 },
  "modeler":     { ... },
  "coder":       { ... },
  "writer":      { ... },
  "openalex_email": "you@example.com"
}
```

成功：`{ "success": true, "message": "配置保存成功" }`

> 注意：仅写入 settings 内存对象，**不持久化**到 `.env.dev`。重启后端会重置。

### 3.3 POST `/validate-openalex-email`

```jsonc
// Request
{ "email": "you@example.com" }

// Response
{ "valid": true, "message": "✓ OpenAlex Email 验证成功" }
```

---

## 4. 任务历史与文件

### 4.1 GET `/messages?task_id={tid}`

返回该任务的全部历史消息（从 `logs/messages/{tid}.json`）。

```jsonc
[
  { "id": "...", "msg_type": "system", "type": "info", "content": "任务开始处理" },
  { "id": "...", "msg_type": "agent",  "agent_type": "CoordinatorAgent", "content": "..." },
  { "id": "...", "msg_type": "tool",   "tool_name": "execute_code", "input": {...}, "output": [...] },
  ...
]
```

### 4.2 GET `/files?task_id={tid}`

```jsonc
[
  { "filename": "notebook.ipynb", "file_type": "ipynb" },
  { "filename": "res.md",         "file_type": "md" },
  { "filename": "data.csv",       "file_type": "csv" }
]
```

### 4.3 GET `/download_url?task_id={tid}&filename={fn}`

```jsonc
{ "download_url": "http://localhost:8000/static/{tid}/{fn}" }
```

### 4.4 GET `/download_all_url?task_id={tid}`

```jsonc
{ "download_url": "http://localhost:8000/static/{tid}/all.zip" }
```

### 4.5 GET `/open_folder?task_id={tid}` *(仅本地部署)*

在服务器上调用 `explorer` / `open` 弹出工作目录。

---

## 5. 元信息

| 路由 | 说明 |
| --- | --- |
| `GET /` | 健康检查：`{ "message": "Hello World" }` |
| `GET /config` | 返回非敏感配置（env / max_chat_turns / cors） |
| `GET /writer_seque` | 返回论文章节顺序 keys |
| `GET /status` | 返回 backend + redis 健康 |

```jsonc
// GET /status
{
  "backend": { "status": "running", "message": "Backend service is running" },
  "redis":   { "status": "running", "message": "Redis connection is healthy" }
}
```

---

## 6. WebSocket `/task/{task_id}`

| 项 | 值 |
| --- | --- |
| URL | `ws://{host}:{port}/task/{task_id}` |
| 协议 | 文本 JSON，逐条 |
| 心跳 | 由 uvicorn `--ws-ping-interval 60 --ws-ping-timeout 120` 控制 |

### 6.1 接入握手

1. 服务端从路径取 `task_id` → `ensure_safe_task_id` 校验
2. 校验 `redis.exists("task_id:{tid}")`；不存在则 `close(1008, "Task not found")`
3. 订阅 `task:{tid}:messages` 频道，开始向客户端转发

### 6.2 消息载荷

所有载荷遵循 `backend/app/schemas/response.py` 中定义的 `Message` 与子类。共同字段：

```typescript
interface Message {
    id: string;            // uuid4
    msg_type: "system" | "agent" | "user" | "tool" | "approval";
    content: string | null;
}
```

#### `SystemMessage`

```jsonc
{
  "id": "...",
  "msg_type": "system",
  "content": "代码手开始求解 ques1",
  "type": "info"      // info | warning | success | error
}
```

#### `AgentMessage`（4 个角色复用）

```jsonc
{
  "id": "...",
  "msg_type": "agent",
  "content": "建模思路：...",
  "agent_type": "ModelerAgent"   // CoordinatorAgent | ModelerAgent | CoderAgent | WriterAgent
}
```

`WriterMessage` 额外携带 `sub_title`：

```jsonc
{ "msg_type":"agent", "agent_type":"WriterAgent", "content":"...", "sub_title":"ques1" }
```

#### `ToolMessage`

```jsonc
// execute_code 工具
{
  "id": "...",
  "msg_type": "tool",
  "tool_name": "execute_code",
  "input":  { "code": "import pandas as pd\\n..." },
  "output": [
    { "res_type": "stdout", "msg": "..." },
    { "res_type": "result", "msg": "...", "format": "png" }
  ]
}

// search_scholar 工具
{
  "msg_type": "tool",
  "tool_name": "search_scholar",
  "input":  { "query": "TOPSIS evaluation" },
  "output": [ "Paper A ...", "Paper B ..." ]
}
```

#### `ApprovalMessage`（HIL）

```jsonc
{
  "msg_type": "approval",
  "checkpoint_id": "model_selection",
  "prompt": { ... },
  "options": ["confirm","edit","regenerate","ask","skip","abort"],
  "timeout": 300
}
```

### 6.3 客户端最小实现

```ts
const ws = new WebSocket(`ws://localhost:8000/task/${taskId}`);
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  // 按 msg_type / agent_type 分发到 UI
};
ws.onclose = () => { /* 指数退避重连 */ };
```

> 推荐使用本项目前端的 `TaskWebSocket`（`frontend/src/utils/websocket.ts`），自带重连与状态回调。

---

## 7. 类型映射速查（前后端）

| 后端类 | 前端类型（`src/utils/response.ts`） |
| --- | --- |
| `Message` | `Message` |
| `SystemMessage` | `SystemMessage` |
| `AgentMessage` | `AgentMessage` |
| `CoordinatorMessage` | `CoordinatorMessage` |
| `ModelerMessage` | `ModelerMessage` |
| `CoderMessage` | `CoderMessage` |
| `WriterMessage` | `WriterMessage` |
| `ToolMessage` | `ToolMessage` |
| `InterpreterMessage` | `InterpreterMessage` |
| `ScholarMessage` | `ScholarMessage` |
| `ApprovalMessage` | `ApprovalMessage` |

---

## 8. `task_id` 命名规则

```
20260517-152033-abcdef12
└─年月日─┘ └时分秒┘ └─uuid8─┘
```

正则：`^\d{8}-\d{6}-[0-9a-f]{8}$`（详见 `ensure_safe_task_id`）。

---

## 9. curl 速测

```bash
# 1. 提交任务
curl -F 'ques_all=求解...' \
     -F 'comp_template=CHINA' \
     -F 'format_output=Markdown' \
     -F 'files=@data.csv' \
     http://localhost:8000/modeling

# 2. 拉历史消息
curl 'http://localhost:8000/messages?task_id=20260517-152033-abcdef12'

# 3. 健康检查
curl http://localhost:8000/status
```

---

> 下一步：[prompts.md](./prompts.md) 看每个 Agent 的 system prompt 细节。
