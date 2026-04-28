<script setup lang="ts">
import type { WebChatPart } from '~/types/web-chat'
import type { ToolDetailSection } from '~/utils/toolCallDetails'
import { writeClipboardText } from '~/utils/clipboard'
import { toolCallTitle, toolDisplayName, toolOutputSummary } from '~/utils/toolCalls'
import { toolDetailSections } from '~/utils/toolCallDetails'
import { formatProcessPartDuration } from '~/utils/chatMessages'

const props = defineProps<{
  part: WebChatPart
}>()

const toolName = computed(() => toolDisplayName(props.part))
const isRunning = computed(() => ['running', 'thinking', 'streaming', 'started'].includes(String(props.part.status || '')))
const now = ref(new Date())
const copiedSection = ref<string | null>(null)
const wrappedSections = ref<Record<string, boolean>>({})
let copiedTimer: ReturnType<typeof setTimeout> | undefined
let durationTimer: ReturnType<typeof setInterval> | undefined

function isWrapped(label: string) {
  return wrappedSections.value[label] === true
}

function toggleWrap(label: string) {
  wrappedSections.value = {
    ...wrappedSections.value,
    [label]: !isWrapped(label)
  }
}

async function copySection(section: ToolDetailSection) {
  await writeClipboardText(section.text)
  copiedSection.value = section.label

  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copiedSection.value = null
  }, 1600)
}

onMounted(() => {
  durationTimer = setInterval(() => {
    if (isRunning.value) now.value = new Date()
  }, 1000)
})

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
  if (durationTimer) clearInterval(durationTimer)
})

const durationLabel = computed(() => formatProcessPartDuration(props.part, now.value))
const sections = computed(() => toolDetailSections(props.part))

const summary = computed(() => {
  if (isRunning.value) return 'Running'
  return toolOutputSummary(props.part)
})

const actionLabel = computed(() => toolCallTitle(props.part))
</script>

<template>
  <UModal
    :title="toolName"
    :description="summary"
    scrollable
    :ui="{ content: 'sm:max-w-7xl', body: 'p-0' }"
  >
    <button
      type="button"
      class="group flex max-w-full items-center gap-1.5 overflow-hidden text-left text-sm text-muted transition-colors hover:text-default"
    >
      <UIcon
        :name="isRunning ? 'i-lucide-loader-circle' : 'i-lucide-chevron-down'"
        class="size-3.5 shrink-0 text-dimmed"
        :class="{ 'animate-spin': isRunning }"
      />
      <span class="min-w-0 truncate" :class="{ 'tool-call-shimmer': isRunning }">
        {{ actionLabel }}
      </span>
      <span v-if="summary" class="min-w-0 truncate text-dimmed" :class="{ 'tool-call-shimmer': isRunning }">
        {{ summary }}
      </span>
      <span
        v-if="durationLabel"
        class="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] leading-none text-dimmed tabular-nums"
        :title="isRunning ? 'Elapsed time' : 'Duration'"
      >
        <span v-if="isRunning" class="size-1.5 rounded-full bg-primary/70 animate-pulse" aria-hidden="true" />
        {{ durationLabel }}
      </span>
    </button>

    <template #body>
      <div class="h-[75vh] overflow-y-auto p-4 lg:overflow-hidden">
        <div v-if="sections.length" class="grid min-h-0 gap-4 lg:h-full lg:grid-cols-2 lg:auto-rows-fr">
          <ToolCallDetailSection
            v-for="section in sections"
            :key="section.label"
            :section="section"
            :path="`${toolName}-${section.label}`"
            :copied="copiedSection === section.label"
            :wrapped="isWrapped(section.label)"
            :single="sections.length === 1"
            @copy="copySection"
            @toggle-wrap="toggleWrap"
          />
        </div>

        <p v-else class="text-sm text-muted">
          No tool payload available.
        </p>
      </div>
    </template>
  </UModal>
</template>
