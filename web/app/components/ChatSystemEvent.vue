<script setup lang="ts">
import type { WebChatPart } from '~/types/web-chat'
import { partText } from '~/utils/chatMessages'

const props = defineProps<{
  part: WebChatPart
}>()

const severity = computed(() => props.part.severity || 'info')
const title = computed(() => props.part.eventType === 'run_steered' ? 'Steer' : (props.part.title || partText(props.part) || 'System event'))
const description = computed(() => props.part.description || (props.part.title ? partText(props.part) : ''))
</script>

<template>
  <div
    class="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted"
    :class="{
      'border-error/30': severity === 'error',
      'border-warning/30': severity === 'warning',
      'border-default': severity !== 'error' && severity !== 'warning'
    }"
  >
    <div class="mb-1 text-xs font-medium uppercase tracking-wide text-dimmed">
      {{ title }}
    </div>
    <p v-if="description || partText(part)" class="whitespace-pre-wrap text-toned">
      {{ description || partText(part) }}
    </p>
  </div>
</template>
