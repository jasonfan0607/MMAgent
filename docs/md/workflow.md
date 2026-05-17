# 🔄 端到端工作流

> 从「用户点提交」到「res.docx 落盘」，每一步发生了什么？本文给出可对照源码阅读的时序图。

---

## 1. 全景时序

```
浏览器                FastAPI               Workflow              Agents              CodeInterp        Redis            前端
  │                    │                      │                    │                    │                │                │
  │ POST /modeling     │                      │                    │                    │                │                │
  │ (题目 + 数据)      ──▶                     │                    │                    │                │                │
  │                    │ task_id=create_task_id                    │                    │                │                │
  │                    │ create_work_dir                           │                    │                │                │
  │                    │ save uploaded files                       │                    │                │                │
  │                    │ redis.set("task_id:{tid}", tid)─────────────────────────────────▶               │                │
  │                    │ background_tasks.add_task(run_modeling_task_async)             │                │                │
  │ ◀── { task_id, "processing" }                                  │                    │                │                │
  │                    │                      │                    │                    │                │                │
  │ navigate /task/{tid}                      │                    │                    │                │                │
  │ ws connect /task/{tid}─────────────────────────────────────────────────────────────────────────────────────────────▶  │
  │                    │ ws_router 校验 task_id 存在 ─▶ redis.exists                    │                │                │
  │                    │ pubsub.subscribe("task:{tid}:messages")                        │                │                │
  │                    │                      │                    │                    │                │                │
  │                    │ run_modeling_task_async start             │                    │                │                │
  │                    │ publish SystemMessage("任务开始")──────────────────────────────▶ Pub/Sub        │                │
  │                    │ MathModelWorkFlow().execute(problem)──────▶ workflow.py        │                │                │
  │                    │                      │ LLMFactory.get_all_llms()              │                │                │
  │                    │                      │                    │                    │                │                │
  │                    │                      │ Coordinator.run(ques_all)              │                │                │
  │                    │                      │   ─── LLM.chat ───▶ provider ◀── content│                │                │
  │                    │                      │   ◀── CoordinatorToModeler             │                │                │
  │                    │                      │   publish CoordinatorMessage ───────────────────────────▶ Pub/Sub ──────▶ 显示
  │                    │                      │                    │                    │                │                │
  │                    │                      │ Modeler.run(coordinator_response)       │                │                │
  │                    │                      │   ◀── ModelerToCoder (questions_solution)                │                │
  │                    │                      │   publish ModelerMessage ───────────────────────────────▶ Pub/Sub ──────▶ 显示
  │                    │                      │                    │                    │                │                │
  │                    │                      │ create_interpreter(local|remote)                          │                │
  │                    │                      │   publish "正在创建代码沙盒环境"                          │                │
  │                    │                      │   notebook_serializer = NotebookSerializer(work_dir)      │                │
  │                    │                      │   scholar = OpenAlexScholar(...)                          │                │
  │                    │                      │                    │                    │                │                │
  │                    │                      │ Flows.get_solution_flows(...)                            │                │
  │                    │                      │                    │                    │                │                │
  │                    │                      │ for key in [eda, ques1, ..., sensitivity]:                │                │
  │                    │                      │     publish "代码手开始求解 {key}"                        │                │
  │                    │                      │     Coder.run(coder_prompt, subtask_title=key)            │                │
  │                    │                      │       ── LLM.chat (tools=execute_code) ──▶               │                │
  │                    │                      │         tool_call ──▶ publish InterpreterMessage(input=code)              │
  │                    │                      │         interpreter.execute_code(code) ──▶ kernel        │                │
  │                    │                      │         ◀── (text, error, error_msg)                     │                │
  │                    │                      │         如出错 → reflection prompt → 重试                │                │
  │                    │                      │       (无 tool_call 视为完成)                            │                │
  │                    │                      │     ◀── CoderToWriter(text, created_images)              │                │
  │                    │                      │     publish "代码手求解成功 {key}"                        │                │
  │                    │                      │                    │                    │                │                │
  │                    │                      │     writer_prompt = Flows.get_writer_prompt(key, ...)    │                │
  │                    │                      │     publish "论文手开始写 {key} 部分"                     │                │
  │                    │                      │     Writer.run(writer_prompt, available_images=...)      │                │
  │                    │                      │       可能触发 search_papers → OpenAlex                  │                │
  │                    │                      │     ◀── WriterResponse                                   │                │
  │                    │                      │     user_output.set_res(key, writer_response)            │                │
  │                    │                      │                                                          │                │
  │                    │                      │ interpreter.cleanup()                                    │                │
  │                    │                      │                                                          │                │
  │                    │                      │ Flows.get_write_flows(user_output, ...)                  │                │
  │                    │                      │ for chapter in [firstPage, RepeatQues, ...]:             │                │
  │                    │                      │     Writer.run(chapter_prompt, sub_title=chapter)        │                │
  │                    │                      │     user_output.set_res(chapter, writer_response)        │                │
  │                    │                      │                                                          │                │
  │                    │                      │ user_output.save_result()                                │                │
  │                    │                      │   ──▶ res.md  写入 work_dir/{task_id}/                   │                │
  │                    │ md_2_docx(task_id)   │                                                          │                │
  │                    │   ──▶ res.docx                                                                  │                │
  │                    │ publish SystemMessage("任务处理完成", success)                                  │                │
  │                                                                                                       │                │
  │ ◀── 实时接收所有消息 (任务全过程)                                                                       │                │
```

---

## 2. 时间线（粗略）

| 阶段 | 子步骤 | 典型耗时 |
| --- | --- | --- |
| 提交 | 接收 multipart + 落盘 | <1s |
| 拆题 | Coordinator 单轮 | 3-10s |
| 建模 | Modeler 单轮（推理模型可能慢） | 10-60s |
| 求解 | 每子任务 N 轮 Coder + 单轮 Writer | 2-15 分钟 / 子任务 |
| 写作 | 6 章 × 单轮 Writer | 3-10 分钟 |
| 转 docx | `md_2_docx` | <2s |
| **总计** | **依模型与题目而定** | **20 分钟 – 2 小时** |

---

## 3. 工作目录变化

```
backend/project/work_dir/{task_id}/
  ├── data.csv                  ← 用户上传（提交时）
  ├── notebook.ipynb            ← Coder 每次 execute_code 后追加
  ├── *.png                     ← Coder 生成的图，按 section 归档
  ├── res.md                    ← user_output.save_result()
  ├── res.docx                  ← md_2_docx
  └── all.zip                   ← /download_all_url 触发时打包
```

---

## 4. 失败路径

```
┌────────────────────────────────────────────────────────────┐
│  Coordinator 拒绝（非建模题）                                │
│    → 抛异常 → workflow.execute 抛回 → router catch          │
│    → publish SystemMessage(error)                          │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│  Modeler JSON 损坏                                          │
│    → ModelerAgent 自动 `repair_json` + 自循环               │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│  Coder 子任务卡死 / 多次失败                                │
│    → max_retries 命中 → 返回 "任务失败" 文本                 │
│    → Writer 拿到的是失败说明，依然会输出占位章节             │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│  整体超过 5 小时                                            │
│    → asyncio.wait_for TimeoutError                          │
│    → publish SystemMessage(error)                          │
└────────────────────────────────────────────────────────────┘
```

---

## 5. 重放任务

任何任务都能离线重放：

```bash
cat backend/logs/messages/{task_id}.json | jq '.[] | {msg_type, agent_type, content}'
```

前端进 `/task/{task_id}` 时会先 `GET /messages` 一次性拉回所有消息，再开 WebSocket 接力实时增量。

---

> 下一步：[api.md](./api.md) 看具体接口字段。
