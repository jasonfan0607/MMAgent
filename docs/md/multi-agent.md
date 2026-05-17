# 🤝 多 Agent 协同合作文档

> MathModelAgent 把一支「数学建模队」搬进了计算机：四个 Agent 各自有清晰的职责、独立的模型、明确的输入输出契约。本文讲清楚他们怎么传棒。

---

## 1. 整体编队

```
                          ┌────────────────────────────────┐
                          │           用户题目              │
                          └───────────────┬────────────────┘
                                          │
                                          ▼
                          ┌────────────────────────────────┐
                          │   CoordinatorAgent  (队长)      │
                          │   • 是否是建模题？               │
                          │   • 拆题：title/background/quesN │
                          └───────────────┬────────────────┘
                                          │ CoordinatorToModeler
                                          ▼
                          ┌────────────────────────────────┐
                          │   ModelerAgent      (建模手)    │
                          │   • 选模型、决策树              │
                          │   • 每个 ques 给思路 + 可视化方案 │
                          │   • EDA / 敏感性方案             │
                          └───────────────┬────────────────┘
                                          │ ModelerToCoder
                                          ▼
                ┌─────────────────────────┴──────────────────────────┐
                │                  Flows 子任务编排                   │
                │   eda → ques1 → ques2 → ... → sensitivity_analysis  │
                └─────────┬─────────────────────────┬────────────────┘
                          │                         │
                          ▼                         ▼
            ┌────────────────────────┐   ┌────────────────────────┐
            │ CoderAgent (编程手)     │   │ WriterAgent (论文手)    │
            │ • LLM 生成 Python       │   │ • 按章节模板写正文      │
            │ • execute_code 工具调用 │──▶│ • 必要时 search_papers  │
            │ • 报错 → 反思 → 重试    │   │ • 插入代码手生成的图    │
            │ • 收集生成的图片        │   │ • 输出 Markdown / LaTeX │
            └────────────────────────┘   └────────────────────────┘
                                                   │
                                                   │ for each subtask
                                                   ▼
                              ┌──────────────────────────────────────┐
                              │  写作章节阶段（首页 / 重述 / 假设 / 评价）│
                              │  WriterAgent 再次串行生成              │
                              └──────────────────────────────────────┘
                                                   │
                                                   ▼
                                  UserOutput.save_result()  →  res.md / res.docx
```

---

## 2. 四个 Agent 一览

| 角色 | 类 | Prompt | 推荐模型类型 | 关键输出 |
| --- | --- | --- | --- | --- |
| 队长 | `CoordinatorAgent` | `COORDINATOR_PROMPT` | 便宜 + 稳定 JSON | `{title, background, ques_count, ques1..N}` |
| 建模手 | `ModelerAgent` | `MODELER_PROMPT` | 强推理（o-series / Claude） | `{eda, ques1..N, sensitivity_analysis}` |
| 编程手 | `CoderAgent` | `CODER_PROMPT` | 长上下文 + 代码强 | 文本结论 + `notebook.ipynb` + 图片列表 |
| 论文手 | `WriterAgent` | `get_writer_prompt(format)` | 长文笔流畅 | 章节 Markdown / LaTeX |

> 这四个角色**不应被合并**。例如把建模 + 编程合成一个 Agent，会出现「跳过方案直接写代码」的盲跑现象；分开后建模手承担「为什么这么做」的责任，编程手只关心「怎么实现」。

---

## 3. Agent 间的数据契约（A2A）

每次传棒都用 Pydantic 类型强约束（`backend/app/schemas/A2A.py`）：

```python
class CoordinatorToModeler(BaseModel):
    questions: dict           # {"title": ..., "background": ..., "ques1": ..., ...}
    ques_count: int

class ModelerToCoder(BaseModel):
    questions_solution: dict[str, str]
    # key ∈ {"eda", "ques1", "ques2", ..., "sensitivity_analysis"}

class CoderToWriter(BaseModel):
    code_response: str | None
    code_output: str | None
    created_images: list[str] | None

class WriterResponse(BaseModel):
    response_content: Any
    footnotes: list[tuple[str, str]] | None
```

**好处**：

1. Pydantic 在解析阶段就会暴露格式错误，比 dict-of-dict 早一步发现问题。
2. 任意两个 Agent 之间的接口可以独立测试 / mock。
3. 文档同步成本低：改了字段，PR diff 一眼可见。

---

## 4. Agent 基类：所有 Agent 的共同能力

文件：`app/core/agents/agent.py`

```python
class Agent:
    def __init__(self, task_id, model: LLM, context_window=128000,
                 token_threshold_ratio=0.75): ...

    async def run(self, prompt, system_prompt, sub_title) -> Any: ...
    async def append_chat_history(self, msg) -> None: ...
    async def compress_if_needed(self) -> None: ...
```

提供：

| 能力 | 实现要点 |
| --- | --- |
| 对话历史管理 | `chat_history: list[dict]`，支持 system / user / assistant / tool / tool_calls 五种 role |
| Token 估算 | 中英混合保守取 `len / 3`；优先使用 API 返回的 `prompt_tokens` |
| 记忆压缩 | 超 `0.75 * context_window` 时用 `simple_chat` 让 LLM 总结早期对话 |
| 切割安全点 | `_find_safe_preserve_point`：从尾部往前找，不切断 `tool_call ↔ role: tool` 配对 |
| 失败回退 | `_get_safe_fallback_history`：压缩失败时保留 system + 末尾安全段 |

> **为什么不用 LLM 框架自带的 memory？**
> 我们要严格保证 `tool_calls` 与 `role: tool` 的配对完整性（否则 OpenAI 直接 400）；框架的通用 memory 经常忽略这点。

---

## 5. 角色一：CoordinatorAgent（队长）

### 5.1 任务

读用户输入，判断「这是不是数学建模题」：

- 是 → 输出 JSON：`title / background / ques_count / quesN`
- 不是 → 输出拒绝文案

### 5.2 实现亮点

`coordinator_agent.py`：

```python
while True:
    response = await self.model.chat(history=self.chat_history, agent_name=...)
    json_str = response.content.replace("```json", "").replace("```", "").strip()
    json_str = re.sub(r"[\x00-\x1F\x7F]", "", json_str)   # 去控制字符

    questions = json.loads(json_str)
    return CoordinatorToModeler(questions=questions, ques_count=questions["ques_count"])
```

失败时把错误反馈注入到下一轮 system prompt：

```python
error_prompt = f"⚠️ 上次响应格式错误: {e}。请严格输出JSON格式"
await self.append_chat_history({"role": "system", "content": SYS + "\n" + error_prompt})
```

### 5.3 Prompt 主旨

```
判断用户输入的信息是否是数学建模问题
如果是 → 按 FORMAT_QUESTIONS_PROMPT JSON 模板整理
如果不是 → 拒绝
```

完整 prompt 见 `app/core/prompts/coordinator.py`。

---

## 6. 角色二：ModelerAgent（建模手）

### 6.1 任务

把队长拆好的每个 `quesN` 转成：

1. **问题类型判断**（预测/评价/分类/优化/统计/文本/仿真）
2. **模型选择理由**（为何选它、对比备选）
3. **求解思路**（数据→构建→参数→求解→验证）
4. **验证策略**（误差指标、交叉验证、基线对比）
5. **可视化方案**（图表类型、敏感性曲线、特征重要性）

**不写代码**，只画蓝图。

### 6.2 决策树（部分摘录）

```
预测类
  ├─ 多影响因素      → 回归 / XGBoost
  ├─ 单时间序列      → ARIMA / Prophet / LSTM
  ├─ <15 数据点      → 灰色 GM(1,1)
  └─ 需不确定性      → MCMC / Bootstrap

评价决策类
  ├─ 主观权重        → AHP
  ├─ 客观权重        → 熵权法
  ├─ 方案排序        → TOPSIS / PCA-TOPSIS
  └─ 模糊指标        → 模糊综合评价

优化类
  ├─ 线性约束        → 线性规划
  ├─ 非线性          → GA / 模拟退火 / 网格
  └─ 多目标          → NSGA-II / 加权和
...
```

「工程优化铁律」是建模手 Prompt 的精髓——明确告诉 LLM「优化变量必须有物理上下界」，避免无约束最优解给出物理上不存在的答案。

### 6.3 输出规范

```json
{
  "eda": "...",
  "ques1": "...",
  "quesN": "...",
  "sensitivity_analysis": "..."
}
```

严格单层字符串字典；ModelerAgent 内置 `repair_json` 容错三连：直接解析 → 转义引号 → 正则提取键值对。

### 6.4 信号传递

```python
# workflow.py
modeler_response = await modeler_agent.run(coordinator_response)
# Flows 用它来生成每个子任务的 coder_prompt
solution_flows = flows.get_solution_flows(self.questions, modeler_response)
```

> **建模手的方案是 CoderAgent 子任务 Prompt 的「上文」**。`Flows.get_solution_flows` 把每个 `quesN` 的方案与原题目拼成一段 coder prompt。

---

## 7. 角色三：CoderAgent（编程手）

### 7.1 任务

按子任务跑代码：

1. 接收 `coder_prompt = "参考建模手方案 X，完成 quesN"`
2. 调用 LLM，**强制要求带 `execute_code` 工具调用**
3. 解释器实际执行代码，拿到 stdout / stderr / 图片
4. 失败 → `get_reflection_prompt(error_message, code)` 注入反思 → 重试
5. 成功后 LLM 决定「继续写代码」还是「输出最终结论」（没有 tool_call 即视为完成）

### 7.2 核心循环（简化）

```python
while True:
    if retry_count >= MAX_RETRIES: break          # 失败兜底
    if chat_turns >= MAX_CHAT_TURNS: raise        # 死循环兜底

    response = await self.model.chat(history=self.chat_history,
                                     tools=coder_tools, tool_choice="auto")
    if response.tool_calls:                       # 模型要跑代码
        code = json.loads(tool_call.arguments)["code"]
        await publish(InterpreterMessage(input={"code": code}))   # 推前端
        text, err, err_msg = await code_interpreter.execute_code(code)
        if err:
            await append("tool", err_msg)
            await append("user", get_reflection_prompt(err_msg, code))   # 反思
            continue
        else:
            await append("tool", text)
            continue                              # 继续等下一轮
    else:                                         # 没工具调用 = 任务结束
        return CoderToWriter(code_response=response.content,
                             created_images=await ci.get_created_images(subtask_title))
```

### 7.3 工具协议

`app/core/functions.py` 定义两种格式（OpenAI / Anthropic）：

```jsonc
{
  "type": "function",
  "function": {
    "name": "execute_code",
    "description": "Execute Python and get terminal output. '[image]' for images. Kernel persists.",
    "parameters": {
      "type": "object",
      "properties": { "code": { "type": "string" } },
      "required": ["code"]
    }
  }
}
```

`CoderAgent.run` 中根据 `self.model.api_type` 自动选择对应 schema。

### 7.4 Prompt 精髓

`CODER_PROMPT`（`app/core/prompts/coder.py`）核心几条：

- **文件处理**：所有数据已预上传，**不要检查文件存在**，直接读相对路径
- **大 CSV**：>1GB 用 `chunksize` + dtype 优化
- **中文**：直接写中文字符串，禁止 `\\u....` 转义
- **数据预处理分两类**：物理/力学机理题不画分布图；数据驱动题才走 EDA
- **数据泄露铁律**：`shift(1)` 而不是 `shift(-1)`，标准化只 fit 训练集
- **可视化全局配置**：matplotlib rcParams 中英文字体、tight_layout、保存路径

---

## 8. 角色四：WriterAgent（论文手）

### 8.1 任务

把 CoderAgent 的执行结果和原题目，按章节模板写成竞赛论文。

- 求解阶段被 Workflow 调用：每个子任务 (`eda / quesN / sensitivity_analysis`) 写一节
- 写作阶段被再次调用：写 `firstPage / RepeatQues / analysisQues / modelAssumption / symbol / judge`

### 8.2 关键工具

```jsonc
{
  "name": "search_papers",
  "description": "Search for papers using a query string.",
  "parameters": {
    "type": "object",
    "properties": { "query": { "type": "string" } },
    "required": ["query"]
  }
}
```

实现走 `OpenAlexScholar.search_papers`，把检索结果格式化后塞回 `role: tool`，让 LLM 继续生成。

### 8.3 图片强制插入

工作流把 CoderAgent 收集的 `created_images` 传给 WriterAgent：

```python
image_prompt = (
    f"\n\n【必须插入的图片列表】\n"
    f"以下图片是代码手生成的，你必须在论文相关段落后用 Markdown 格式逐一插入：\n"
    f"{image_lines}\n"
    f"插入格式为独占一行的 ![描述](文件名)，每张图片后需配3行以上的分析解读。\n"
)
prompt = prompt + image_prompt
```

> 这是「让 AI 真正使用素材」的关键约束——不主动暗示，LLM 经常会忘记插图。

### 8.4 Prompt 精髓

`get_writer_prompt(format)`（`app/core/prompts/writer.py`）核心：

- **段落式写作**：禁止 bullet point 出现在正文（建模论文评审标准）
- **章节篇幅比例表**（摘要 1 页、求解 50-60%、其余 4-12% 各章节）
- **公式规范**：`$...$` / `$$...$$` 与 LaTeX 模式自动切换

---

## 9. 数据流（一次完整任务的传棒）

```
ques_all  ──┐
            ▼
       Coordinator ──▶ {questions, ques_count}                ───┐
                                                                  │
                       Modeler ──▶ {eda, ques1..N, sens}          │  这两个对象
                                                                  │  几乎贯穿全程
       (work_dir created, interpreter started, scholar ready)     │
            │                                                     │
            ▼                                                     │
       Flows.get_solution_flows(questions, modeler_response)  ◀──┘
            │
            ▼
   for subtask in [eda, ques1..N, sensitivity_analysis]:
       coder_prompt   = build(coder_prompt_template, modeler_response[key], questions[key])
       coder_response = Coder.run(coder_prompt, subtask_title=key)
       writer_prompt  = build(writer_prompt_template, coder_response, code_output, config_template[key])
       writer_response = Writer.run(writer_prompt,
                                    available_images=coder_response.created_images,
                                    sub_title=key)
       user_output.set_res(key, writer_response)

   cleanup interpreter
       │
       ▼
   Flows.get_write_flows(user_output, config_template, ques_all)
       │
       ▼
   for chapter in [firstPage, RepeatQues, analysisQues, modelAssumption, symbol, judge]:
       writer_response = Writer.run(chapter_prompt, sub_title=chapter)
       user_output.set_res(chapter, writer_response)

   user_output.save_result()
   md_2_docx(task_id)
```

---

## 10. 实时观察（前端怎么看到这一切？）

每个 Agent 都通过 `LLM.send_message` 把响应发到 Redis：

| Agent | 消息类型 |
| --- | --- |
| Coordinator | `CoordinatorMessage` |
| Modeler | `ModelerMessage` |
| Coder | `CoderMessage`（文本）+ `InterpreterMessage`（代码输入/输出） |
| Writer | `WriterMessage`（携带 `sub_title`，前端按章节分组渲染） |
| Workflow | `SystemMessage`（状态广播） |

前端 `useTaskStore` 把它们 filter 成不同 computed view：

- `chatMessages` —— 整体进度（左侧聊天区）
- `modelerMessages / coderMessages / writerMessages` —— 三个 Tab 的对应视图
- `interpreterMessage` —— Notebook 渲染

---

## 11. 多模型路由策略

不同 Agent 用不同模型是这个项目的**核心成本/质量优化**：

| 角色 | 任务特征 | 推荐 |
| --- | --- | --- |
| Coordinator | 单轮 JSON 化，无需推理 | DeepSeek-Chat / Qwen-Plus / GPT-4o-mini |
| Modeler | 需要复杂决策树推理 | o4-mini / o3-mini / Claude Sonnet 4 |
| Coder | 长上下文 + 代码 + tool_use | Claude Sonnet 4 / GPT-4.1 / DeepSeek-V3 |
| Writer | 长输出 + 学术风格 | Claude Sonnet 4 / GPT-4.1 / Qwen-Max |

切换方法：在前端 `ApiDialog` 里给四个 Agent 分别填不同的 `apiKey / modelId / baseUrl / apiType`，提交到 `/save-api-config` 即可生效。

---

## 12. 容错与恢复

| 故障 | 责任方 | 应对 |
| --- | --- | --- |
| Coordinator 输出非法 JSON | Coordinator 自循环 | 注入错误反馈，重新生成 |
| Modeler 输出非法 JSON | Modeler 自循环 + `repair_json` | 三层修复：直接 / 转义 / 正则 |
| Coder 代码运行报错 | Coder 反思 | `get_reflection_prompt` 注入错误与原代码，重试 |
| Coder 超过最大轮次 | Workflow | 抛 Exception，前端收到 error SystemMessage |
| LLM 调用失败 | `LLM.chat` | 3 次指数退避；仍失败抛给上层 |
| 工具调用结构损坏 | `LLM._validate_and_fix_tool_calls` | 清理孤立的 tool_calls / role: tool |
| 内存爆掉 | `Agent.compress_if_needed` | LLM 总结历史，保留最末安全段 |
| 整个任务卡死 | Router | `asyncio.wait_for(task, 5h)` 超时取消 |

---

## 13. HIL（Human-in-the-Loop）扩展

`backend/app/schemas/response.py` 已经定义了：

```python
class ApprovalMessage(Message):
    msg_type = "approval"
    checkpoint_id: str = ""
    prompt: dict
    options: list[str] = ["confirm", "edit", "regenerate", "ask", "skip", "abort"]
    timeout: int = 300
```

设计意图：

| 检查点 | 时机 | 用户能做什么 |
| --- | --- | --- |
| `problem_split` | Coordinator 拆题后 | 编辑题目结构 |
| `model_selection` | Modeler 出方案后 | 调整建模思路 |
| `code_review` | Coder 子任务完成 | 重跑 / 接受 |
| `paper_review` | Writer 章节完成 | 编辑 / 重写 |

通过 `settings.HIL_CHECKPOINTS` 开关控制（默认打开三个）。前端可在 UI 上识别 `msg_type=="approval"` 弹出审批对话框，回传用户决策后工作流继续。

---

## 14. 设计原则总结

1. **角色专精**：四个 Agent 各有不可替代的产品语义。
2. **结构化交付**：所有传棒走 Pydantic，不靠隐含的字符串约定。
3. **双重重试**：LLM 层（HTTP）+ Agent 层（反思）双重容错。
4. **模型按角色解耦**：成本 / 质量按角色独立优化。
5. **过程透明**：每个 Agent 的中间输出都广播到前端，可重放可审查。
6. **失败安全**：JSON 解析、内存压缩、工具调用、超时全部有兜底。

---

> 下一步：
> - 想看端到端时序图：[workflow.md](./workflow.md)
> - 想精调每个 Agent 的脑回路：[prompts.md](./prompts.md)
