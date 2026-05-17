<script setup lang="ts">
import { GITHUB_LINK, QQ_GROUP, TWITTER } from "@/utils/const";
import {
	ArrowRight,
	BrainCircuit,
	ChevronRight,
	Code2,
	FileText,
	Github,
	Library,
	LineChart,
	NotebookPen,
	Search,
	Twitter,
	Workflow,
} from "lucide-vue-next";
import { useRouter } from "vue-router";

// ---- Router ----

const router = useRouter();

const goChat = () => router.push("/chat");

// ---- Static Content ----

/** 四 Agent 流水线：体现项目的核心叙事 */
const agents = [
	{
		role: "协调者",
		en: "Coordinator",
		desc: "解析题目，识别问题边界与背景。",
	},
	{
		role: "建模手",
		en: "Modeler",
		desc: "为每个子问题选定建模方案与求解思路。",
	},
	{
		role: "代码手",
		en: "Coder",
		desc: "在沙箱中执行 Python，自动反思纠错。",
	},
	{
		role: "写作手",
		en: "Writer",
		desc: "整合结果与图片，按学术规范成文。",
	},
];

/** 核心能力 —— 用三栏极简列表，无卡片 chrome */
const capabilities = [
	{
		icon: Search,
		title: "题目解析",
		desc: "自动识别问题结构并拆解为子任务。",
	},
	{
		icon: BrainCircuit,
		title: "智能建模",
		desc: "按问题类型选择回归、优化、评价、聚类等模型。",
	},
	{
		icon: Code2,
		title: "代码执行",
		desc: "本地 Jupyter 或 E2B 云端沙箱，保留中间变量。",
	},
	{
		icon: LineChart,
		title: "学术可视化",
		desc: "300dpi、统一配色、置信带与误差标注的图表。",
	},
	{
		icon: NotebookPen,
		title: "论文成稿",
		desc: "段落式学术语言，自动插图与引用脚注。",
	},
	{
		icon: Library,
		title: "文献检索",
		desc: "OpenAlex 接口实时拉取，引用即查即用。",
	},
];

/** 路线图 */
const roadmap = [
	"接入更多竞赛题库与基准测试",
	"开放交互式回环（模型选择、章节重写）",
	"扩展代码沙箱供应商与 GPU 算力",
];

/** 技术栈 chip */
const stack = [
	"FastAPI",
	"Vue 3",
	"Pinia",
	"Tailwind",
	"shadcn-vue",
	"Jupyter Kernel",
	"E2B",
	"OpenAlex",
	"Redis",
	"WebSocket",
];
</script>

<template>
  <main class="bg-apple-canvas text-apple-ink antialiased">
    <!-- ===== 1. HERO（light canvas） ===== -->
    <section
      class="relative flex flex-col items-center justify-center text-center
             px-6 pt-[120px] pb-[100px] sm:pt-[160px] sm:pb-[120px]"
    >
      <span
        class="font-display text-caption-strong uppercase tracking-[0.18em]
               text-apple-ink-48 mb-5"
      >
        Math Modeling · Multi-Agent
      </span>

      <h1
        class="font-display font-semibold text-apple-ink
               text-[44px] sm:text-[56px] lg:text-[80px]
               leading-[1.04] tracking-[-0.028em]
               max-w-[920px]"
      >
        让 Agent 完整地<br />做一次数学建模。
      </h1>

      <p
        class="mt-7 max-w-[640px] font-sans text-lead
               text-apple-ink-80"
      >
        从题目解析到论文成稿，四个专家 Agent 协同
        完成建模、编码、可视化与写作。
      </p>

      <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
        <button class="apple-pill" @click="goChat">
          立即体验
          <ArrowRight class="size-[18px]" :stroke-width="1.75" />
        </button>
        <a :href="GITHUB_LINK" target="_blank" class="apple-link inline-flex items-center gap-1.5">
          查看源码
          <ChevronRight class="size-4" :stroke-width="2" />
        </a>
      </div>

      <!-- hero "产品图"：用流程示意代替真实产品照片 -->
      <div class="mt-[80px] sm:mt-[120px] w-full max-w-[1080px] mx-auto">
        <div
          class="relative rounded-apple-lg bg-apple-parchment
                 px-6 sm:px-12 py-12 sm:py-16
                 flex flex-col items-center"
        >
          <div class="w-full flex flex-wrap items-center justify-center gap-x-3 gap-y-4">
            <template v-for="(a, i) in agents" :key="a.role">
              <div class="text-center">
                <div
                  class="mx-auto mb-3 size-12 rounded-apple-pill
                         bg-apple-canvas border border-apple-hairline
                         flex items-center justify-center"
                >
                  <component
                    :is="i === 0 ? Workflow : i === 1 ? BrainCircuit : i === 2 ? Code2 : FileText"
                    class="size-5 text-apple-blue"
                    :stroke-width="1.5"
                  />
                </div>
                <p class="font-display text-body-strong">{{ a.role }}</p>
                <p class="text-caption text-apple-ink-48 mt-0.5">{{ a.en }}</p>
              </div>
              <ChevronRight
                v-if="i < agents.length - 1"
                class="size-5 text-apple-ink-48 shrink-0"
                :stroke-width="1.5"
              />
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== 2. DARK TILE：核心叙事 / 效率 ===== -->
    <section
      class="bg-apple-tile text-apple-canvas
             px-6 py-[96px] sm:py-[120px]"
    >
      <div class="max-w-[1080px] mx-auto">
        <p class="font-display text-tagline text-apple-blue-sky mb-4">
          效率
        </p>
        <h2
          class="font-display font-semibold
                 text-[40px] sm:text-[56px]
                 leading-[1.07] tracking-[-0.028em]
                 max-w-[820px]"
        >
          三天的建模赛程，<br />
          压缩到一小时。
        </h2>
        <p
          class="mt-6 max-w-[600px] font-sans text-lead font-light
                 text-apple-body-muted leading-[1.4]"
        >
          单一题目从读题到出稿，端到端自动化。
          你只需要审稿与微调。
        </p>

        <div class="mt-[64px] grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10
                    border-t border-white/10 pt-12">
          <div>
            <p class="font-display font-semibold
                      text-[64px] sm:text-[88px]
                      leading-none tracking-[-0.04em]
                      text-apple-canvas">
              ~1<span class="text-[40px] align-top ml-1">h</span>
            </p>
            <p class="mt-3 font-sans text-body text-apple-body-muted">
              从读题到论文 PDF 的总耗时
            </p>
          </div>
          <div>
            <p class="font-display font-semibold
                      text-[64px] sm:text-[88px]
                      leading-none tracking-[-0.04em]
                      text-apple-canvas">
              4<span class="text-[40px] align-top ml-1 text-apple-blue-sky">×</span>
            </p>
            <p class="mt-3 font-sans text-body text-apple-body-muted">
              专家 Agent 并行协作，单任务双重上限保护
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== 3. PARCHMENT TILE：四 Agent 流水线 ===== -->
    <section
      class="bg-apple-parchment text-apple-ink
             px-6 py-[96px] sm:py-[120px]"
    >
      <div class="max-w-[1200px] mx-auto">
        <div class="max-w-[820px]">
          <p class="font-display text-tagline text-apple-blue mb-4">
            架构
          </p>
          <h2
            class="font-display font-semibold
                   text-[40px] sm:text-[56px]
                   leading-[1.07] tracking-[-0.028em]"
          >
            四个 Agent，一条流水线。
          </h2>
          <p class="mt-6 font-sans text-lead text-apple-ink-80 max-w-[640px]">
            每个 Agent 由独立 LLM 驱动，
            通过强类型 schema 顺序交接。
          </p>
        </div>

        <div class="mt-[64px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <article
            v-for="(a, i) in agents"
            :key="a.role"
            class="bg-apple-canvas rounded-apple-lg p-6
                   border border-apple-hairline
                   flex flex-col h-full"
          >
            <div class="flex items-center gap-2 mb-6">
              <span
                class="font-display text-caption-strong text-apple-ink-48
                       tabular-nums"
              >
                0{{ i + 1 }}
              </span>
              <span class="flex-1 h-px bg-apple-hairline"></span>
              <component
                :is="i === 0 ? Workflow : i === 1 ? BrainCircuit : i === 2 ? Code2 : FileText"
                class="size-4 text-apple-blue"
                :stroke-width="1.75"
              />
            </div>
            <h3 class="font-display text-display-md font-semibold leading-tight">
              {{ a.role }}
            </h3>
            <p class="mt-1 font-sans text-caption text-apple-ink-48">{{ a.en }}</p>
            <p class="mt-5 font-sans text-body text-apple-ink-80 flex-1">
              {{ a.desc }}
            </p>
          </article>
        </div>
      </div>
    </section>

    <!-- ===== 4. LIGHT TILE：核心能力 ===== -->
    <section
      class="bg-apple-canvas text-apple-ink
             px-6 py-[96px] sm:py-[120px]"
    >
      <div class="max-w-[1200px] mx-auto">
        <div class="max-w-[820px]">
          <p class="font-display text-tagline text-apple-blue mb-4">
            能力
          </p>
          <h2
            class="font-display font-semibold
                   text-[40px] sm:text-[56px]
                   leading-[1.07] tracking-[-0.028em]"
          >
            学术级输出，<br />
            而不只是跑通。
          </h2>
        </div>

        <div class="mt-[80px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3
                    gap-x-8 gap-y-14">
          <div v-for="c in capabilities" :key="c.title">
            <component
              :is="c.icon"
              class="size-7 text-apple-ink mb-5"
              :stroke-width="1.5"
            />
            <h3 class="font-display text-tagline font-semibold leading-tight">
              {{ c.title }}
            </h3>
            <p class="mt-3 font-sans text-body text-apple-ink-80">
              {{ c.desc }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== 5. DARK TILE：技术栈 chip 一字排开 ===== -->
    <section
      class="bg-apple-tile-3 text-apple-canvas
             px-6 py-[96px] sm:py-[120px]"
    >
      <div class="max-w-[1080px] mx-auto">
        <div class="max-w-[820px]">
          <p class="font-display text-tagline text-apple-blue-sky mb-4">
            技术栈
          </p>
          <h2
            class="font-display font-semibold
                   text-[40px] sm:text-[56px]
                   leading-[1.07] tracking-[-0.028em]"
          >
            选最稳的，<br />
            把它们用好。
          </h2>
        </div>

        <div class="mt-12 flex flex-wrap gap-3">
          <span
            v-for="t in stack"
            :key="t"
            class="px-4 py-2 rounded-apple-pill
                   bg-white/10 text-apple-canvas
                   font-sans text-caption
                   border border-white/15"
          >
            {{ t }}
          </span>
        </div>
      </div>
    </section>

    <!-- ===== 6. PARCHMENT TILE：路线图 ===== -->
    <section
      class="bg-apple-parchment text-apple-ink
             px-6 py-[96px] sm:py-[120px]"
    >
      <div class="max-w-[1080px] mx-auto">
        <p class="font-display text-tagline text-apple-blue mb-4">
          路线图
        </p>
        <h2
          class="font-display font-semibold
                 text-[40px] sm:text-[56px]
                 leading-[1.07] tracking-[-0.028em]
                 max-w-[820px]"
        >
          下一站。
        </h2>

        <ol class="mt-12 divide-y divide-apple-hairline border-y border-apple-hairline">
          <li
            v-for="(item, i) in roadmap"
            :key="item"
            class="py-7 flex items-baseline gap-6"
          >
            <span
              class="font-display text-caption-strong text-apple-ink-48
                     tabular-nums w-10 shrink-0"
            >
              0{{ i + 1 }}
            </span>
            <span class="font-sans text-display-md text-apple-ink leading-tight">
              {{ item }}
            </span>
          </li>
        </ol>
      </div>
    </section>

    <!-- ===== 7. CTA TILE：行动召唤（light） ===== -->
    <section
      class="bg-apple-canvas text-apple-ink
             px-6 py-[120px] sm:py-[160px] text-center"
    >
      <h2
        class="font-display font-semibold
               text-[44px] sm:text-[64px]
               leading-[1.04] tracking-[-0.028em]
               max-w-[820px] mx-auto"
      >
        准备好交一份<br />漂亮的论文了吗？
      </h2>
      <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
        <button class="apple-pill" @click="goChat">立即体验</button>
        <a :href="GITHUB_LINK" target="_blank" class="apple-pill-ghost">
          阅读源码
        </a>
      </div>
    </section>

    <!-- ===== 8. FOOTER（parchment） ===== -->
    <footer
      class="bg-apple-parchment text-apple-ink-80
             px-6 pt-[64px] pb-[48px]
             border-t border-apple-hairline"
    >
      <div class="max-w-[1200px] mx-auto">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div class="md:col-span-2">
            <p class="font-display text-body-strong text-apple-ink">
              MathModelAgent
            </p>
            <p class="mt-3 font-sans text-caption text-apple-ink-48 max-w-[340px]">
              专为数学建模竞赛设计的多 Agent 系统，
              从问题分析到论文成稿全流程自动化。
            </p>
          </div>
          <div>
            <p class="font-display text-caption-strong text-apple-ink mb-4">
              资源
            </p>
            <ul class="space-y-2">
              <li><a :href="GITHUB_LINK" target="_blank" class="apple-link text-caption">GitHub</a></li>
              <li><a href="https://www.mathmodel.top/" target="_blank" class="apple-link text-caption">官方网站</a></li>
            </ul>
          </div>
          <div>
            <p class="font-display text-caption-strong text-apple-ink mb-4">
              联系
            </p>
            <div class="flex items-center gap-4">
              <a :href="QQ_GROUP" target="_blank" aria-label="QQ Group" class="text-apple-ink-48 hover:text-apple-blue transition-colors">
                <svg viewBox="0 0 1024 1024" class="size-5 fill-current">
                  <path d="M824.8 613.2c-16-51.4-34.4-94.6-62.7-165.3C766.5 262.2 689.3 112 511.5 112 331.7 112 256.2 265.2 261 447.9c-28.4 70.8-46.7 113.7-62.7 165.3-34 109.5-23 154.8-14.6 155.8 18 2.2 70.1-82.4 70.1-82.4 0 49 25.2 112.9 79.8 159-26.4 8.1-85.7 29.9-71.6 53.8 11.4 19.3 196.2 12.3 249.5 6.3 53.3 6 238.1 13 249.5-6.3 14.1-23.8-45.3-45.7-71.6-53.8 54.6-46.2 79.8-110.1 79.8-159 0 0 52.1 84.6 70.1 82.4 8.5-1.1 19.5-46.4-14.5-155.8z" />
                </svg>
              </a>
              <a :href="GITHUB_LINK" aria-label="GitHub" class="text-apple-ink-48 hover:text-apple-blue transition-colors">
                <Github class="size-5" :stroke-width="1.5" />
              </a>
              <a :href="TWITTER" aria-label="Twitter" class="text-apple-ink-48 hover:text-apple-blue transition-colors">
                <Twitter class="size-5" :stroke-width="1.5" />
              </a>
            </div>
          </div>
        </div>

        <div class="mt-[48px] pt-6 border-t border-apple-hairline
                    flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p class="font-sans text-micro-legal text-apple-ink-48">
            © 2026 MathModelAgent. 本项目处于内测阶段，欢迎反馈。
          </p>
          <p class="font-sans text-micro-legal text-apple-ink-48">
            Designed with restraint.
          </p>
        </div>
      </div>
    </footer>
  </main>
</template>

<style scoped>
/* 防止页面被外层 container 限宽 —— 落地页要全屏 tile 才能成立 */
:deep(body),
main {
	margin: 0;
}
</style>
