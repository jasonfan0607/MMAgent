# 🛠️ 开发指南

> 给想给这个项目提 PR / 二次开发 / 在本地深度调试的人看的。

---

## 1. 项目脚本一览

### 1.1 后端

```bash
cd backend
uv sync                                    # 同步依赖

# 启动开发服务器（需 Redis 在跑）
$env:ENV="DEV"; $env:REDIS_URL="redis://localhost:6379/0"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Lint
.\.venv\Scripts\python.exe -m ruff check app/
.\.venv\Scripts\python.exe -m ruff format app/

# 类型检查
npx pyright app/
```

### 1.2 前端

```bash
cd frontend
pnpm i
pnpm run dev                # 开发服务器
pnpm run build              # 类型检查 + 生产构建
pnpm run preview            # 预览产物

npx biome check src/
npx biome check --write src/    # 自动修复
```

---

## 2. 代码风格

### 2.1 Python（来自 CLAUDE.md）

- **Docstring**：模块级 / 类级 / 公共方法 Google 风格，中文，含 Args / Returns / Raises
- **类型**：`str | None`，不要 `Optional[str]`；FastAPI 路由用 `async def`
- **注释**：解释 **Why**，不重复 **What**
- 现有 `# type: ignore` 注释**不要乱删**，是经过验证的抑制

示例：

```python
"""模块级 docstring：描述模块用途。"""

class ExampleAgent:
    """类级 docstring：简述职责。"""

    async def run(self, prompt: str, system_prompt: str) -> str:
        """执行任务并返回结果。

        Args:
            prompt: 用户输入。
            system_prompt: 系统提示词。

        Returns:
            处理结果文本。
        """
```

### 2.2 Vue / TypeScript

- SFC：`<script setup lang="ts">`
- 用注释分组：`// ---- Props ----` / `// ---- State ----` / `// ---- Computed ----` / `// ---- Methods ----`
- 接口 / API 函数加 JSDoc `/** */`
- **不要修改** `components/ui/`（shadcn-vue 复制式代码）
- Tab 缩进 + 双引号（Biome 默认）

---

## 3. Git Workflow

提交信息格式（来自 CLAUDE.md）：`<type>: <描述>`

| type | 用于 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `refactor` | 重构 |
| `chore` | 杂项 / 依赖更新 |
| `enhance` | 增强已有功能 |
| `docs` | 文档 |

例：`feat: 添加 OpenAlex API Key 支持并更新相关配置`

PR 描述请包含：

1. **Why**：解决什么问题 / 出于什么动机
2. **What**：改了哪些模块（指名文件）
3. **How to verify**：本地如何复现 / 验证

---

## 4. 自动化 Lint Hook

`.claude/settings.json` 配置 PostToolUse hook：

- `backend/**/*.py` → `ruff check app/`
- `frontend/src/**/*.{vue,ts}` → `biome check <file>`

Hook 脚本：`.claude/hook_lint.sh`

---

## 5. 调试技巧

### 5.1 后端

```python
# 1. 调高日志级别
$env:LOG_LEVEL="DEBUG"

# 2. 单 Agent 测试：在 workflow.py 注释后续步骤，跑前面 N 步即可
# 3. 复现某次失败任务：把 logs/messages/{tid}.json 当作 fixture，写脚本 replay
# 4. 强制触发记忆压缩：把 agent.py 里 _DEFAULT_TOKEN_THRESHOLD_RATIO 调到 0.3
# 5. 看真实 LLM 请求 body：在 LLM.chat 内打 logger.debug(json.dumps(messages))
# 6. ic() 大法：项目已引入 icecream，print 变量随手 ic(x)
```

### 5.2 前端

```ts
// 1. 看 WebSocket 原始流：在 TaskWebSocket.onmessage 里 console.log(data)
// 2. 看 Pinia 状态：装 Vue DevTools，selecting useTaskStore.messages
// 3. UI bug：先看 components/ui/ 是不是被改了（不应该）
// 4. 路由跳转：router.currentRoute 直接 console.log
```

### 5.3 协议层

```bash
# 直接订阅 Redis Pub/Sub 看 message 原貌
redis-cli psubscribe 'task:*:messages'

# 不用前端，curl 跑全套
TID=$(curl -F "ques_all=求解..." -F "comp_template=CHINA" -F "format_output=Markdown" \
      http://localhost:8000/modeling | jq -r .task_id)
echo $TID
redis-cli psubscribe "task:$TID:messages"
```

---

## 6. 测试

后端测试位于 `backend/app/tests/`：

```bash
cd backend
pytest                          # 跑全部
pytest app/tests/test_e2b.py    # 跑指定文件
```

> 当前测试覆盖较弱（项目处于探索阶段），欢迎贡献单元测试，特别是：
> - `Agent.compress_if_needed` 的边界条件
> - `LLM._validate_and_fix_tool_calls` 的损坏序列修复
> - `Flows` 的子任务 / 章节生成

---

## 7. 新功能开发清单

### 7.1 添加新 Agent

- [ ] 在 `backend/app/core/agents/{role}_agent.py` 写新类，继承 `Agent`
- [ ] 在 `__init__.py` 导出
- [ ] 在 `LLMFactory` 增加配置字段（`COORDINATOR_*` 同款）
- [ ] 在 `core/prompts/` 新增 prompt 文件
- [ ] 在 `core/workflow.py` 串入调用
- [ ] 在 `schemas/A2A.py` 加新数据契约
- [ ] 在 `schemas/response.py` 加 `{Role}Message`
- [ ] 在 `core/llm/llm.py::send_message` 加 case
- [ ] 在 `schemas/enums.py::AgentType` 加成员
- [ ] 前端 `src/utils/enum.ts::AgentType` 同步
- [ ] 前端 `stores/task.ts` 加 computed view
- [ ] 在 `frontend/src/components/AgentEditor/` 加可视化 Tab

### 7.2 添加新 LLM Provider

- [ ] `core/llm/providers/{name}.py` 实现 `BaseProvider.call`
- [ ] 在 `app/config/setting.py::ApiType` 加成员
- [ ] 在 `LLM._create_provider` 加 case
- [ ] 在 `modeling_router.validate_api_key` 加分支
- [ ] 前端 `utils/enum.ts::ApiType` 同步
- [ ] 在 `ApiDialog.vue` 的下拉选项加新值

### 7.3 添加新工具

- [ ] `core/functions.py` 加 OpenAI / Anthropic 双 schema
- [ ] 在对应 Agent 的 `tool_calls` 分支中 dispatch
- [ ] 在 `schemas/response.py` 加对应 `{Name}Message`（如需要前端可视化）
- [ ] 前端 `utils/response.ts` 同步类型

### 7.4 添加新沙箱

- [ ] `tools/{name}_interpreter.py` 实现 `BaseCodeInterpreter`
- [ ] 在 `tools/interpreter_factory.py::create_interpreter` 加分支
- [ ] 必要时在 `setting.py` 加环境变量

---

## 8. 性能调优

| 关注点 | 看哪里 |
| --- | --- |
| LLM token 浪费 | `Agent.compress_if_needed` 频率 / `chat_history` 长度 |
| LLM 响应慢 | 切到流式：`provider.call` 实现 SSE（当前为一次性返回） |
| 代码执行慢 | 大数据用 chunksize；本地内核改 ipykernel 配置 |
| WebSocket 阻塞 | 推送高频时考虑 batching；当前 `sleep(0.1)` 轮询 |
| 内存爆 | 监控 `chat_history` + interpreter section_output 大小 |

---

## 9. 安全注意

| 风险 | 缓解 |
| --- | --- |
| 任意代码执行 | 生产环境必须 E2B；本地 Jupyter 仅供个人使用 |
| Path Traversal | `ensure_safe_task_id` 限制 task_id 字符集；`work_dir` 用 task_id 拼接 |
| LLM Key 泄漏 | 不要把 `.env.dev` 提交；Docker volume 隔离配置 |
| 文献假造 | WriterAgent 强约束「只引用 search_papers 实际返回」 |
| 题目注入 | 当前未做 prompt injection 防护；不要把不受信任的用户 prompt 直连 |

---

## 10. 推荐 IDE 插件

- **VS Code / Cursor**：Python、Pylance、Pyright、Vue (Volar)、Tailwind CSS IntelliSense
- **Todo Tree**：定位代码中的 `TODO:` 注释
- **Pretty TypeScript Errors**：可读化 TS 报错
- **Better Comments**：高亮 `! / ? / *` 类注释

`.cursor/` 目录内已包含项目结构、rules、mcp 配置，使用 Cursor 时可直接复用。

---

## 11. 文档协同

- 改 Agent 行为 → 同步 `docs/md/multi-agent.md` + `prompts.md`
- 改路由 / WebSocket 协议 → 同步 `docs/md/api.md`
- 改目录结构 → 同步 `docs/md/architecture.md` 与本 README

> 文档与代码是同等公民。PR 漏改文档我们会请你补上。

---

## 12. 想加入但不知道做什么？

看 README 中的「后期计划」，挑一个 `[ ]` 未完成的项；或在 [Issues](https://github.com/jihe520/MathModelAgent/issues) 找 `good first issue`。

加群 779159301 / 腾讯频道 / Discord（README 末尾），先问后做最高效。

---

> 想跑跑示例先体验？[tutorial.md](./tutorial.md)。
