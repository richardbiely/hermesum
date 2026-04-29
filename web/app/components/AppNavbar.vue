<script setup lang="ts">
import type { Ref } from 'vue'
import type { WebChatProviderUsageResponse } from '~/types/web-chat'

type UpdateControl = {
  visible: Ref<boolean>
  pending: Ref<boolean>
  completed: Ref<boolean>
  label: Ref<string>
  color: Ref<'primary' | 'success'>
  title: Ref<string>
  update: () => void
}

const props = defineProps<{
  title: string
  workspaceStatus?: {
    label: string
    detail?: string | null
  } | null
  providerUsage?: WebChatProviderUsageResponse | null
  providerUsageLoading?: boolean
  commitVisible?: boolean
  commitDisabled?: boolean
  commitLoading?: boolean
  updateVisible?: boolean
  updatePending?: boolean
  updateCompleted?: boolean
  updateLabel?: string
  updateColor?: 'primary' | 'success'
  updateTitle?: string
}>()

const emit = defineEmits<{
  generateCommit: []
}>()

const updateControl = inject<UpdateControl | null>('hermesUpdateControl', null)
const appUpdateControl = inject<UpdateControl | null>('appUpdateControl', null)

const resolvedUpdateVisible = computed(() => props.updateVisible ?? updateControl?.visible.value ?? false)
const resolvedUpdatePending = computed(() => props.updatePending ?? updateControl?.pending.value ?? false)
const resolvedUpdateCompleted = computed(() => props.updateCompleted ?? updateControl?.completed.value ?? false)
const resolvedUpdateLabel = computed(() => props.updateLabel || updateControl?.label.value || 'Update Hermes')
const resolvedUpdateColor = computed(() => props.updateColor || updateControl?.color.value || 'primary')
const resolvedUpdateTitle = computed(() => props.updateTitle || updateControl?.title.value || 'Update Hermes Agent')
const resolvedAppUpdateVisible = computed(() => appUpdateControl?.visible.value ?? false)
const resolvedAppUpdatePending = computed(() => appUpdateControl?.pending.value ?? false)
const resolvedAppUpdateCompleted = computed(() => appUpdateControl?.completed.value ?? false)
const resolvedAppUpdateLabel = computed(() => appUpdateControl?.label.value || 'Update app')
const resolvedAppUpdateColor = computed(() => appUpdateControl?.color.value || 'primary')
const resolvedAppUpdateTitle = computed(() => appUpdateControl?.title.value || 'Update Hermesum app')

function submitUpdate() {
  updateControl?.update()
}

function submitAppUpdate() {
  appUpdateControl?.update()
}
</script>

<template>
  <UDashboardNavbar :title="title">
    <template #trailing>
      <UTooltip v-if="workspaceStatus" :text="workspaceStatus.detail || workspaceStatus.label">
        <UBadge color="neutral" variant="subtle" icon="i-lucide-git-branch" size="sm" class="hidden max-w-64 truncate font-normal sm:inline-flex">
          {{ workspaceStatus.label }}
        </UBadge>
      </UTooltip>
    </template>

    <template #right>
      <div class="flex items-center gap-3">
        <UButton
          v-if="commitVisible"
          aria-label="Generate commit message"
          icon="i-lucide-sparkles"
          label="Generate commit"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="commitLoading"
          :disabled="commitDisabled || commitLoading"
          @click="emit('generateCommit')"
        />
        <ProviderUsageBadge :usage="providerUsage" :loading="providerUsageLoading" />
        <UButton
          v-if="resolvedUpdateVisible"
          size="sm"
          variant="solid"
          icon="i-lucide-refresh-cw"
          :label="resolvedUpdateLabel"
          :color="resolvedUpdateColor"
          :loading="resolvedUpdatePending"
          :disabled="resolvedUpdatePending || resolvedUpdateCompleted"
          :title="resolvedUpdateTitle"
          @click="submitUpdate"
        />
        <UButton
          v-if="resolvedAppUpdateVisible"
          size="sm"
          variant="solid"
          icon="i-lucide-download"
          :label="resolvedAppUpdateLabel"
          :color="resolvedAppUpdateColor"
          :loading="resolvedAppUpdatePending"
          :disabled="resolvedAppUpdatePending || resolvedAppUpdateCompleted"
          :title="resolvedAppUpdateTitle"
          @click="submitAppUpdate"
        />
        <UTooltip text="Toggle dark mode">
          <UColorModeSwitch color="neutral" size="sm" />
        </UTooltip>
      </div>
    </template>
  </UDashboardNavbar>
</template>
