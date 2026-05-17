<script setup lang="ts">
import { getHelloWorld } from "@/apis/commonApi";
import AppSidebar from "@/components/AppSidebar.vue";
import ModelingExamples from "@/components/ModelingExamples.vue";
import ServiceStatus from "@/components/ServiceStatus.vue";
import UserStepper from "@/components/UserStepper.vue";
import Button from "@/components/ui/button/Button.vue";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import MoreDetail from "@/pages/chat/components/MoreDetail.vue";
import { AppWindow, CircleEllipsis } from "lucide-vue-next";
import { onMounted, ref } from "vue";

// ---- Reactive State ----

const isMoreDetailOpen = ref(false);

// ---- Lifecycle Hooks ----

onMounted(() => {
	getHelloWorld().then((res) => {
		console.log(res.data);
	});
});
</script>

<template>

  <SidebarProvider>
    <MoreDetail v-model="isMoreDetailOpen" />
    <AppSidebar />
    <SidebarInset>
      <header class="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger class="-ml-1" />
        <div class="flex justify-between w-full gap-2">
          <ServiceStatus />
          <div class="flex gap-2">
            <Button variant="outline" @click="isMoreDetailOpen = true">
              <CircleEllipsis />
              更多
            </Button>
            <a href="https://www.mathmodel.top/" target="_blank">
              <Button variant="outline">
                <AppWindow />
                官网
              </Button>
            </a>
          </div>
        </div>
      </header>

      <div class="px-6 sm:px-10 py-8 sm:py-14 max-w-[1080px] mx-auto w-full">
        <div class="space-y-10">
          <div class="text-center space-y-4 mb-12">
            <p class="font-display text-caption-strong uppercase tracking-[0.18em] text-apple-ink-48">
              New Project
            </p>
            <h1
              class="font-display font-semibold text-apple-ink
                     text-[40px] sm:text-[56px]
                     leading-[1.07] tracking-[-0.028em]"
            >
              新建一次建模任务。
            </h1>
            <p class="font-sans text-lead text-apple-ink-80 max-w-[640px] mx-auto">
              提交题目，四个 Agent 会接力完成建模、编码与写作。
            </p>
          </div>

          <UserStepper>
          </UserStepper>

          <div class="text-center font-sans text-fine-print text-apple-ink-48 pt-4">
            项目处于内测阶段，欢迎进群反馈
          </div>
          <ModelingExamples />
        </div>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
