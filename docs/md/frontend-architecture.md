# 🎨 前端架构文档

> Vue 3 + TypeScript + Vite + shadcn-vue + Pinia 构成的「数学建模实时观赛室」前端。
>
> 适合：要改 UI 的人、要加新页面的人、要排查 WebSocket / 消息渲染的人。

---

## 1. 一句话定位

> 一个**可视化多 Agent 协作过程**的单页应用：用户在 `/chat` 提交题目，跳到 `/task/{task_id}` 后通过 WebSocket 实时围观四个 Agent 的思考、代码、运行结果与论文成稿。

---

## 2. 技术栈

| 类别 | 选型 | 备注 |
| --- | --- | --- |
| 框架 | Vue 3 (`<script setup lang="ts">`) | Composition API + SFC |
| 构建 | Vite 6 | 开发热更新 + 生产构建 |
| 类型 | TypeScript 5.7 | 严格模式 |
| 路由 | vue-router 4 | History 模式 |
| 状态 | Pinia 3 + `pinia-plugin-persistedstate` | apiKeys 持久化到 localStorage |
| UI 库 | **shadcn-vue (Reka UI)** | 复制式组件位于 `components/ui/`，**不要修改** |
| 样式 | Tailwind CSS 3 + `tailwindcss-animate` + `@inspira-ui/plugins` | 配合 `class-variance-authority` 做变体 |
| Markdown | `marked` + `marked-katex-extension` + `highlight.js` | 渲染 Agent 输出 |
| 编辑器 | `md-editor-v3` | 编辑论文章节 |
| Notebook | `render-jupyter-notebook-vue` | 在浏览器内展示 ipynb |
| 图标 | `lucide-vue-next` | 全场景图标库 |
| HTTP | `axios` | 封装于 `utils/request.ts` |
| Lint | `@biomejs/biome` | 单工具一站式 lint + format |

---

## 3. 目录结构

```
frontend/
├── index.html                     # Vite 入口
├── package.json                   # pnpm 锁版本（packageManager: pnpm@10.6.3）
├── vite.config.ts                 # Vite 配置
├── tailwind.config.js             # Tailwind 主题
├── tsconfig.*.json                # TS 工程引用
├── biome.json                     # Lint + Format
├── public/                        # 静态资源（图标、社交 svg）
└── src/
    ├── main.ts                    # 应用启动 & Pinia & router 安装
    ├── App.vue                    # 根组件（仅 <router-view/>）
    ├── vite-env.d.ts
    │
    ├── apis/                      # 后端 API 封装
    │   ├── commonApi.ts           # /, /messages, /writer_seque, /open_folder, /status
    │   ├── submitModelingApi.ts   # /modeling 多 part 提交
    │   ├── filesApi.ts            # /files, /download_url
    │   └── apiKeyApi.ts           # /validate-api-key, /save-api-config
    │
    ├── router/index.ts            # 4 个路由：/ /login /chat /task/:task_id
    │
    ├── stores/                    # Pinia
    │   ├── apiKeys.ts             # 四个 Agent 的 ModelConfig + OpenAlex 邮箱（持久化）
    │   └── task.ts                # 任务消息 + WebSocket 状态（核心）
    │
    ├── utils/                     # 通用工具
    │   ├── request.ts             # axios 实例（baseURL = VITE_API_URL）
    │   ├── websocket.ts           # TaskWebSocket 类：自动重连 + 状态回调
    │   ├── response.ts            # 后端消息 TS 类型映射
    │   ├── interface.ts           # NoteCell / ModelConfig 等通用接口
    │   ├── enum.ts                # AgentType / ApiType
    │   ├── markdown.ts            # marked + katex + highlight 配置
    │   └── const.ts               # 社交链接等常量
    │
    ├── assets/                    # 样式与图片
    │   └── style.css              # 全局 CSS（含 Tailwind 指令、字体）
    │
    ├── components/                # 通用组件
    │   ├── ui/                    # ⚠️ shadcn-vue 第三方组件，不要改
    │   ├── AppSidebar.vue         # 侧边栏（导航 + NavUser + 社交链接）
    │   ├── ChatArea.vue           # 聊天区（系统消息 + Coder 输出 + 用户消息）
    │   ├── Bubble.vue             # 消息气泡
    │   ├── SystemMessage.vue      # 系统状态消息
    │   ├── NotebookArea.vue       # Notebook 渲染
    │   ├── NotebookCell.vue       # 单元格
    │   ├── Files.vue              # 文件列表 / 下载
    │   ├── Tree.vue               # 目录树
    │   ├── ServiceStatus.vue      # 后端 + Redis 健康指示灯
    │   ├── UserStepper.vue        # 新建任务的 4 步表单
    │   ├── SearchForm.vue         # 题目输入 + 文件上传
    │   ├── ModelingExamples.vue   # 内置示例题入口
    │   ├── LoginForm.vue          # 登录页表单
    │   ├── NavUser.vue            # 头像 + API Key 设置入口
    │   ├── VersionSwitcher.vue    # 顶部品牌切换
    │   ├── FileConfirmDialog.vue
    │   └── AgentEditor/           # Agent 维度的可编辑视图
    │       ├── ModelerEditor.vue
    │       ├── CoderEditor.vue
    │       └── WriterEditor.vue
    │
    └── pages/                     # 路由页面
        ├── index.vue              # 着陆页（产品介绍 + 进入 CTA）
        ├── login/index.vue        # 登录
        ├── chat/
        │   ├── index.vue          # 新建任务页（题目 + 数据 + 提交）
        │   └── components/
        │       ├── ApiDialog.vue  # 4 Agent API Key + Model 配置弹窗
        │       └── MoreDetail.vue # 更多设置抽屉
        ├── task/
        │   ├── index.vue          # 任务运行页（ChatArea + 3 Tabs Editor）
        │   └── components/
        │       └── FileSheet.vue  # 文件列表抽屉
        └── example/[id].vue       # 单个示例详情
```

---

## 4. 路由设计

| Path | 页面 | 职责 |
| --- | --- | --- |
| `/` | `pages/index.vue` | 着陆页：项目介绍 + 「开始」按钮 |
| `/login` | `pages/login/index.vue` | 登录（占位，目前未强制） |
| `/chat` | `pages/chat/index.vue` | **新建任务**：题目输入、上传数据、配置 API Key、提交 |
| `/task/:task_id` | `pages/task/index.vue` | **任务运行 / 回看**：左侧聊天，右侧 Modeler/Coder/Writer 三 Tab |

路由实例：

```ts
// frontend/src/router/index.ts
const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: "/",       component: () => import("@/pages/index.vue") },
        { path: "/login",  component: () => import("@/pages/login/index.vue") },
        { path: "/chat",   component: () => import("@/pages/chat/index.vue") },
        { path: "/task/:task_id", component: () => import("@/pages/task/index.vue"), props: true },
    ],
});
```

全部页面使用 **懒加载** 拆 chunk，首屏只加载着陆页。

---

## 5. 状态管理（Pinia）

### 5.1 `useApiKeyStore`

文件：`src/stores/apiKeys.ts`

- 四个 Agent 各自维护一份 `ModelConfig`：`apiKey / baseUrl / modelId / apiType / contextWindow`
- 一个 `openalexEmail` 用于文献检索工具
- `isEmpty` getter：所有 key 为空时为 `true`，用来决定是否打开 ApiDialog
- 启用 `persist: true`，状态自动同步到 `localStorage`（**用户切回页面无需重输 Key**）

### 5.2 `useTaskStore`（核心）

文件：`src/stores/task.ts`

```
┌────────────────────────────────────────────────────────────────────┐
│ messagesByTask    Record<task_id, Message[]>   按任务隔离的全部消息 │
│ currentTaskId     string | null                 当前激活的任务      │
│ wsStatus          "connecting" | "connected" | "disconnected"       │
│                   | "reconnecting"                                  │
│ seenMessageIdsByTask  Map<task_id, Set<id>>     去重                │
└────────────────────────────────────────────────────────────────────┘
```

**核心 Actions**：

| Action | 作用 |
| --- | --- |
| `loadTaskMessages(taskId)` | GET `/messages?task_id=...` 拿到落盘消息，合并去重 + 时间排序 |
| `connectWebSocket(taskId)` | 用 `TaskWebSocket` 连 `ws://.../task/{task_id}`，新消息走 `appendMessage` |
| `closeWebSocket()` | 主动关闭，停止重连 |
| `addUserMessage(content)` | 在本地插入用户消息（HIL / 回放） |
| `downloadMessages()` | 把当前任务消息导出为 JSON |

**派生 computed**（前端把统一的 `messages` 列表按消息类型/Agent 类型拆成多个视图）：

| Getter | 用于 |
| --- | --- |
| `chatMessages` | 左侧 ChatArea：系统消息 + 用户 + Coder 文本 |
| `coordinatorMessages` | （历史回看） |
| `modelerMessages` | 右侧 Modeler Tab |
| `coderMessages` | 右侧 Coder Tab |
| `writerMessages` | 右侧 Writer Tab |
| `interpreterMessage` | Notebook 渲染（execute_code 工具调用流） |
| `files` | 文件抽屉 / 树 |

> **设计精髓**：所有消息都进同一个数组，按 `msg_type + agent_type` filter 出多个视图。前端不需要单独的事件总线。

---

## 6. WebSocket 客户端

文件：`src/utils/websocket.ts`

```ts
class TaskWebSocket {
    connect()                  // 建连，触发 onopen/onmessage/onclose/onerror
    send(data)                 // OPEN 时才发送
    close()                    // 手动关闭，停止重连
    private scheduleReconnect  // 指数退避：1s, 2s, 4s ... 上限 30s，最多 10 次
}
```

特性：

- **状态回调** `onStatus("connecting"|"connected"|"disconnected"|"reconnecting")` 同步给 Pinia → UI 顶栏状态灯
- **自动重连**：非主动关闭一律触发指数退避重连
- **手动关闭**：`isManualClose` 标志，路由切走 / 任务结束时调 `close()` 防止僵尸连接

```
ws://localhost:8000/task/{task_id}
                ↓
   后端 ws_router 订阅 task:{task_id}:messages Pub/Sub
                ↓
   Redis 收到 Agent / Workflow 发的消息
                ↓
   ws_router.send → 前端 onmessage
                ↓
   useTaskStore.appendMessage(parsed)
                ↓
   computed 派生视图自动更新 → 各组件重渲染
```

---

## 7. UI 组件分层

```
┌─────────────────────────────────────────────────────┐
│ Page (pages/)             路由级容器，负责数据获取/状态  │
├─────────────────────────────────────────────────────┤
│ Feature (components/)     业务组件，组合多个 UI 原子    │
│   AppSidebar / ChatArea / NotebookArea / Files ...   │
├─────────────────────────────────────────────────────┤
│ UI Atom (components/ui/)  shadcn-vue 复制式组件        │
│   Button / Dialog / Tabs / Sidebar / Tooltip ...     │
└─────────────────────────────────────────────────────┘
```

### 7.1 `components/ui/` 红线

`components/ui/` 下是 shadcn-vue 通过 CLI 生成的组件代码，**直接修改会被升级或重新生成时覆盖**。
正确做法：

1. 需要扩展某个 UI 组件 → 在 `components/` 创建一个 wrapper。
2. 需要新增某个 shadcn 组件 → 用官方 CLI 重新 add（保持目录结构一致）。

### 7.2 关键业务组件速览

| 组件 | 作用 |
| --- | --- |
| `AppSidebar.vue` | 整个 App 的侧边栏：开始 / 历史 / 帮助 / 社交链接 |
| `UserStepper.vue` | `chat/index.vue` 中的 4 步引导（题目 → 数据 → API → 提交） |
| `SearchForm.vue` | 题目输入 + 文件 drag-n-drop |
| `ChatArea.vue` | 把 `chatMessages` 渲染为气泡流 |
| `NotebookArea.vue` | 把 `interpreterMessage` 渲染为 Notebook |
| `AgentEditor/*.vue` | 三个 Agent 的可编辑视图，与 `md-editor-v3` 集成 |
| `ServiceStatus.vue` | 顶栏右侧的「后端 / Redis 健康灯」 |
| `ApiDialog.vue` | 提交前的 API Key 配置弹窗，与 `useApiKeyStore` 绑定 |

---

## 8. 后端 API 调用约定

`src/utils/request.ts` 封装 axios：

```ts
const request = axios.create({
    baseURL: import.meta.env.VITE_API_URL,  // dev: http://localhost:8000
    timeout: 10000,
});
```

约定：

- 所有 API 通过 `apis/*.ts` 暴露，**页面/组件不直接用 axios**。
- 请求返回类型尽量泛型注解 `request.get<T>(...)`，方便消费侧类型推导。
- WebSocket URL 使用独立环境变量 `VITE_WS_URL`（dev: `ws://localhost:8000`）。

### 8.1 主要 API 调用清单

| 函数 | 后端路由 | 用途 |
| --- | --- | --- |
| `submitModelingTask` | POST `/modeling` | 多 part 提交题目 + 数据 |
| `getTaskMessages` | GET `/messages` | 拉历史消息 |
| `getWriterSeque` | GET `/writer_seque` | 获取论文章节顺序 |
| `getServiceStatus` | GET `/status` | 后端 + Redis 健康检查 |
| `openFolderAPI` | GET `/open_folder` | 让后端弹出工作目录（本地部署可用） |
| `exampleAPI` | POST `/example` | 一键跑内置示例 |
| `validateApiKey` | POST `/validate-api-key` | 提交前预检 Key |
| `saveApiConfig` | POST `/save-api-config` | 保存四组 Agent 配置 |

---

## 9. 样式与设计系统

### 9.1 Tailwind 主题扩展点

- `font-display` / `font-sans`：Apple-style 排版（参考 `chat/index.vue`）
- 自定义颜色变量：`text-apple-ink`、`text-apple-ink-48` 等
- 暗色模式：使用 Tailwind 的 `dark:` 前缀（shadcn-vue 默认支持）

### 9.2 Markdown 渲染

`utils/markdown.ts` 注册：

- `marked` 解析正文
- `marked-katex-extension` 渲染 `\( ... \)` 行内与 `\[ ... \]` 块公式
- `highlight.js` 给代码块上色

```ts
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import hljs from "highlight.js";
marked.use(markedKatex({ throwOnError: false }), {
    highlight: (code, lang) => hljs.highlightAuto(code).value,
});
```

---

## 10. 开发流程

```bash
cd frontend
pnpm i             # 安装依赖（packageManager 字段强制 pnpm 10.6.3）
pnpm run dev       # 启动 vite dev server (5173)
pnpm run build     # 类型检查 + 生产构建
pnpm run preview   # 预览生产产物

# Lint / 格式化
npx biome check src/
npx biome check --write src/
```

### 10.1 代码风格（来自 CLAUDE.md）

- SFC 必须 `<script setup lang="ts">`
- 用注释分块：`// ---- Props ----` / `// ---- State ----` / `// ---- Computed ----` / `// ---- Methods ----`
- TS 接口 + API 函数使用 JSDoc `/** */`
- Tab 缩进，双引号（Biome 默认）

示例：

```vue
<script setup lang="ts">
import { ref, computed } from "vue";

// ---- Props ----

/** 组件属性 */
interface Props {
    /** 消息类型 */
    type: "agent" | "user";
    /** 消息内容 */
    content: string;
}
const props = withDefaults(defineProps<Props>(), { type: "user" });

// ---- Computed ----

const rendered = computed(() => marked.parse(props.content));
</script>
```

---

## 11. 性能与体验细节

| 关注点 | 实现 |
| --- | --- |
| 首屏速度 | 路由懒加载 + Vite tree-shaking |
| 长任务实时反馈 | WebSocket Pub/Sub，毫秒级到达；同时持久化便于刷新恢复 |
| 大型消息列表 | 当前为简单 `v-for`；TODO 引入虚拟滚动 |
| 网络抖动 | TaskWebSocket 指数退避重连，UI 顶栏状态灯实时切色 |
| 用户配置不丢 | `pinia-plugin-persistedstate` 持久化 API Key 到 localStorage |
| 状态隔离 | `messagesByTask` 按 task_id 分桶，避免不同任务串扰 |

---

## 12. 已知 TODO / 扩展点

| 项 | 位置 | 备注 |
| --- | --- | --- |
| 大量消息时的虚拟滚动 | `ChatArea.vue` / `NotebookArea.vue` | 当前一次性渲染 |
| 多语言（i18n） | 全局 | 目前只中文 UI |
| 任务历史列表 | `AppSidebar.vue` | navMain 占位空 items |
| 移动端响应式 | `task/index.vue` | 左右分屏在小屏体验差 |
| 上传文件大小限制 | `SearchForm.vue` | 当前无前端校验 |
| HIL Approval UI | 全局 | 后端已有 `ApprovalMessage`，前端待补浮层 |

---

> 下一步：
> - 想看后端实现：[backend-architecture.md](./backend-architecture.md)
> - 想看消息协议字段：[api.md](./api.md)
