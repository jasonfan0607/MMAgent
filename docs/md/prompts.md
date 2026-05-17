# 🧠 Prompt 设计文档

> 四个 Agent 的「思考方式」全部由 system prompt 决定。本文剖析每个 prompt 的设计意图、关键约束和自定义入口。

---

## 1. 总体设计原则

| 原则 | 体现 |
| --- | --- |
| **单一职责** | 每个 prompt 只负责一种「角色思考模式」，不写跨角色逻辑 |
| **结构化输出优先** | Coordinator / Modeler 强制 JSON；Coder 强制工具调用；Writer 强制段落式 |
| **决策树替代「自由发挥」** | Modeler / Coder 都给出**显式的分类决策树**，避免模型乱选方法 |
| **反模板化** | 显式列出常见错误模式（如「物理题套数据分析模板」），告诉模型「不要做什么」 |
| **数据真相约束** | 明确「不要捏造文献 / 数据 / 公式」，论文使用真实运行结果 |

---

## 2. CoordinatorAgent Prompt

文件：`backend/app/core/prompts/coordinator.py`

```
判断用户输入的信息是否是数学建模问题
如果是关于数学建模的，你将按照如下要求,整理问题格式
{FORMAT_QUESTIONS_PROMPT}
如果不是关于数学建模的，你将按照如下要求
你会拒绝用户请求，输出一段拒绝的文字
```

`FORMAT_QUESTIONS_PROMPT`：

```json
{
  "title": "<题目标题>",
  "background": "<除 title 和 ques 外的全部内容>",
  "ques_count": 3,
  "ques1": "<问题1>",
  "ques2": "<问题2>",
  "ques3": "<问题N>"
}
```

### 设计要点

- **二分流程**：是 / 不是建模题；不是的直接拒绝（防止系统被滥用为通用聊天）
- **强制 JSON**：方便下游 `json.loads`
- **`ques_count` 字段**：让 Workflow 知道有几个子问题，决定后续循环次数
- **不更改原题**：明确「不要更改题目信息，完整保留」，避免模型主观润色

### 容错策略

- `CoordinatorAgent.run` 自循环重试：解析失败时把错误描述拼到 system prompt 再请求

---

## 3. ModelerAgent Prompt

文件：`backend/app/core/prompts/modeler.py`（共 150 行，是项目最长 prompt）

### 3.1 结构

```
# Role           ← 你是建模手
# Task           ← 给方案，不写代码
# 模型选择决策树   ← 7 大类共 30+ 模型方案
# 工程优化铁律     ← 物理可行性约束
# 高分组合方案     ← 经验组合表
# 方案质量要求    ← 每个 ques 必须包含 5 件事
# 可视化方案指南   ← 6 种数据类型对应图表
# EDA 区分        ← 物理题 vs 数据题不同处理
# 敏感性分析要求   ← 参数、范围、指标
# 输出规范        ← 严格单层 JSON
```

### 3.2 关键约束

| 约束 | 用意 |
| --- | --- |
| 「**不需要给出代码**」 | 明确分工边界 |
| 决策树形式枚举模型 | 限定模型选择范围，避免 LLM 自由发挥导致跑偏 |
| 工程优化铁律 | 避免「数学上最优但物理上不存在」的可笑解 |
| 创新 ≠ 算法复杂度 | 鼓励先建简单基线再升级，与评审偏好对齐 |
| EDA 物理题/数据题分流 | 直接告诉模型「物理题不要画直方图」，避免套模板被扣分 |
| 单层 JSON / 字符串 value | 下游 `Flows.get_solution_flows` 需要 `dict[str, str]` |

### 3.3 输出契约

```json
{
  "eda": "<EDA方案，含清洗、分析、可视化>",
  "ques1": "<问题1的方案>",
  "quesN": "<问题N的方案>",
  "sensitivity_analysis": "<敏感性分析方案>"
}
```

### 3.4 容错

- `repair_json` 三层修复（直接解析 → 转义引号 → 正则提取）
- 解析失败时把「JSON 格式有误」错误反馈作为 user 消息追加，要求重写

---

## 4. CoderAgent Prompt

文件：`backend/app/core/prompts/coder.py`

### 4.1 结构

```
# Role + Env       ← 平台 / 关键库
# FILE HANDLING    ← 不查存在 / 直接读 / 编码探测
# LARGE CSV        ← chunksize / dtype / categorical
# CODING STANDARDS ← 中文直接写，不要 unicode escape
# 数据预处理规范    ← 物理题 / 数据题区分
# 数据泄露防范     ← shift(1) / fit-only-on-train
# 特征工程         ← 滞后 / 编码 / 对数
# 参数记录         ← 来源说明三选一
# 可视化规范       ← 全局 matplotlib 配置 + 章节图表
# 解题流程         ← Loop: code → execute → 修复 → 收敛
```

### 4.2 关键约束

| 约束 | 用意 |
| --- | --- |
| **中文回复** | 与论文语言一致 |
| **`pd.read_excel` 强制** | 防止用 csv 读 xlsx 错误 |
| **smart encoding** | `utf-8 → gbk → gb2312 → latin-1` |
| **变量持久化** | 明确「kernel 持久化，变量保留」，避免重复读数据 |
| **数据泄露铁律** | 选手代码常踩，prompt 直接钉死 |
| **图必须保存到工作目录** | tool 描述里说 `[image]` 占位，必须落盘 |

### 4.3 反思 Prompt

`backend/app/core/prompts/shared.py:get_reflection_prompt(error_message, code)` —— 当代码出错时注入：

```
代码运行出错了：
{error_message}

我执行的代码是：
{code}

请认真分析错误原因，给出修正后的代码并重新调用 execute_code。
```

### 4.4 工具调用强约束

System prompt 明确告诉模型：

- 所有 Python 必须经过 `execute_code` 工具调用
- 没有工具调用即视为「任务完成」

CoderAgent 在循环中也按此契约判断结束条件：

```python
if response.tool_calls:   # 继续跑代码
    ...
else:                     # 任务完成
    return CoderToWriter(code_response=response.content, ...)
```

---

## 5. WriterAgent Prompt

文件：`backend/app/core/prompts/writer.py:get_writer_prompt(format_output)`

### 5.1 结构

```
# Role             ← 数学建模论文写作专家
# 论文结构规范      ← 章节 + 篇幅占比表
# 写作风格规范      ← 段落式 / 学术中文 / 公式规范
# 数据真实性约束    ← 仅使用提供的运行结果
# 图片插入规范      ← 必须 ![]() + 解读
# 文献检索约束      ← 必要时 search_papers
# 输出格式规范      ← Markdown / LaTeX 切换
```

### 5.2 关键约束

| 约束 | 用意 |
| --- | --- |
| **禁止 bullet 列表** | 建模论文评审标准要求段落式 |
| **公式规范** | Markdown 用 `$...$` / `$$...$$`；LaTeX 用 `\(\)` / `\[\]` |
| **图片必须插入** | Workflow 强制把 `created_images` 拼到 prompt 末尾 |
| **数据真实性** | 不允许 LLM 自己编公式/参数/文献；引用必须用 `search_papers` 拿真实结果 |
| **章节篇幅约束** | 摘要 1 页、求解 50-60%、其他章节配额清晰 |

### 5.3 输出格式切换

`format_output: FormatOutPut` 决定生成 Markdown 还是 LaTeX；prompt 内做条件化模板。

---

## 6. Prompt Inject —— 任务级自定义

不想改源码也能影响 Agent 行为：通过 **subtask 级 prompt 注入**。

文件：`backend/app/config/md_template.toml`

每个章节是一个 key，值是「写作模板（占位说明）」。Workflow 在生成 writer_prompt 时拼接：

```python
quesx_writer_prompt = f"""
    问题背景{bgc},不需要编写代码,代码手得到的结果{coder_response},{code_output},
    按照如下模板撰写：{config_template[key]}
"""
```

> 你可以在 `md_template.toml` 里写「请额外强调与往年获奖论文的对比」「严格使用 SI 单位」等领域约束。

---

## 7. 模型差异适配（OpenAI / Anthropic）

工具调用 schema 在两家平台格式略有不同：

| 平台 | schema 入口 |
| --- | --- |
| OpenAI Chat Completions / Responses | `core/functions.py::coder_tools` / `writer_tools` |
| Anthropic | `coder_tools_anthropic` / `writer_tools_anthropic` |

Agent 内通过 `self.model.api_type` 自动选用：

```python
tools = coder_tools_anthropic if api_type == ApiType.ANTHROPIC else coder_tools
```

prompt 本体保持一致，无需为不同平台准备两份系统提示词。

---

## 8. Prompt 调优建议

| 现象 | 调整方向 |
| --- | --- |
| Coordinator JSON 经常崩 | 强化「严格 JSON、不带任何注释 / Markdown 围栏」描述；或切到更强的小模型 |
| Modeler 方案过浅、像废话 | 强化「每个 value 要详细充实」；或加入「示例方案」few-shot |
| Coder 反复同样的错 | 在 reflection prompt 中追加「请尝试不同的修复策略 / 换一种实现路径」 |
| Coder 漏画图 / 漏保存 | 在 CODER_PROMPT 的「可视化规范」加入更严的检查清单（如 plt.savefig 不能用相对路径之类） |
| Writer 输出 bullet | 在 WRITER_PROMPT 顶部加「★最高优先级：严禁分点列表★」 |
| Writer 不插图 | Workflow 已经强制拼接图片 prompt；仍漏插考虑把图片描述附上 |
| Writer 文献假造 | 在 prompt 内强调「只能引用 search_papers 实际返回的结果」 |

---

## 9. Prompt 维护工作流

1. 修改 `app/core/prompts/{role}.py`
2. **同步更新** [multi-agent.md](./multi-agent.md) 中的「Prompt 精髓」摘要
3. 跑一个已知 task 验证，对比新旧 `logs/messages/{tid}.json` 看差异
4. 如果改了输出契约（如 JSON 字段），**同步改 `schemas/A2A.py`、`Flows`、前端 type**

---

> 下一步：[development.md](./development.md) 看本地开发规范。
