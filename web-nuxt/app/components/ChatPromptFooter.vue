<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { WebChatModelCapability } from '~/types/web-chat'

type ChatPromptFooterProps = {
  submitStatus: 'ready' | 'submitted' | 'streaming' | 'error'
  profileLabel?: string
  projectLabel?: string
  models?: WebChatModelCapability[]
  selectedModel?: string | null
  selectedReasoningEffort?: string | null
  capabilitiesLoading?: boolean
}

const props = withDefaults(defineProps<ChatPromptFooterProps>(), {
  profileLabel: 'Hermes',
  projectLabel: 'hermesum',
  models: () => [],
  selectedModel: null,
  selectedReasoningEffort: null,
  capabilitiesLoading: false
})

const emit = defineEmits<{
  stop: []
  updateSelectedModel: [model: string]
  updateSelectedReasoningEffort: [reasoningEffort: string]
}>()

const mockButtons = [
  { label: 'Attach file', icon: 'i-lucide-paperclip' },
  { label: 'Dictate by voice', icon: 'i-lucide-mic' }
]

const selectedModelCapability = computed(() => {
  return props.models.find(model => model.id === props.selectedModel) || null
})

const reasoningEfforts = computed(() => selectedModelCapability.value?.reasoningEfforts || [])

const modelLabel = computed(() => {
  if (props.capabilitiesLoading && !selectedModelCapability.value) return 'Loading models'
  return selectedModelCapability.value?.label || props.selectedModel || 'Select model'
})

const reasoningLabel = computed(() => {
  if (props.capabilitiesLoading && !reasoningEfforts.value.length) return 'Loading reasoning'
  return props.selectedReasoningEffort || 'Select reasoning'
})

const modelItems = computed<DropdownMenuItem[]>(() => {
  return props.models.map(model => ({
    label: model.label,
    icon: 'i-lucide-cpu',
    checked: model.id === props.selectedModel,
    onSelect: () => emit('updateSelectedModel', model.id),
    trailingIcon: model.id === props.selectedModel ? 'i-lucide-check' : undefined
  }))
})

const reasoningItems = computed<DropdownMenuItem[]>(() => {
  return reasoningEfforts.value.map(reasoningEffort => ({
    label: reasoningEffort,
    icon: 'i-lucide-brain',
    checked: reasoningEffort === props.selectedReasoningEffort,
    onSelect: () => emit('updateSelectedReasoningEffort', reasoningEffort),
    trailingIcon: reasoningEffort === props.selectedReasoningEffort ? 'i-lucide-check' : undefined
  }))
})
</script>

<template>
  <div class="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
    <UTooltip v-for="button in mockButtons" :key="button.label" :text="`${button.label} (coming soon)`">
      <UButton
        :aria-label="`${button.label} (coming soon)`"
        :icon="button.icon"
        color="neutral"
        variant="ghost"
        size="sm"
        disabled
      />
    </UTooltip>

    <USeparator orientation="vertical" class="mx-1 h-5" />

    <div class="flex min-w-0 items-center gap-1.5 overflow-x-auto">
      <UButton
        :aria-label="'Hermes profile'"
        icon="i-lucide-user-round"
        trailing-icon="i-lucide-chevron-down"
        color="neutral"
        variant="ghost"
        size="sm"
        class="shrink-0"
        disabled
      >
        {{ profileLabel }}
      </UButton>

      <UButton
        :aria-label="'Project or directory'"
        icon="i-lucide-folder"
        trailing-icon="i-lucide-chevron-down"
        color="neutral"
        variant="ghost"
        size="sm"
        class="shrink-0"
        disabled
      >
        {{ projectLabel }}
      </UButton>

      <UDropdownMenu
        :items="modelItems"
        :disabled="capabilitiesLoading || !modelItems.length"
        :content="{ align: 'start', side: 'top', sideOffset: 8 }"
      >
        <UButton
          :aria-label="'Model'"
          icon="i-lucide-cpu"
          trailing-icon="i-lucide-chevron-down"
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0"
          :loading="capabilitiesLoading && !modelItems.length"
        >
          {{ modelLabel }}
        </UButton>
      </UDropdownMenu>

      <UDropdownMenu
        :items="reasoningItems"
        :disabled="capabilitiesLoading || !reasoningItems.length"
        :content="{ align: 'start', side: 'top', sideOffset: 8 }"
      >
        <UButton
          :aria-label="'Reasoning effort'"
          icon="i-lucide-brain"
          trailing-icon="i-lucide-chevron-down"
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0"
          :disabled="capabilitiesLoading || !reasoningItems.length"
          :loading="capabilitiesLoading && !reasoningItems.length"
        >
          {{ reasoningLabel }}
        </UButton>
      </UDropdownMenu>
    </div>
  </div>

  <UChatPromptSubmit :status="submitStatus" @stop="emit('stop')" />
</template>
