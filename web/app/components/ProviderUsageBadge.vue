<script setup lang="ts">
import type { WebChatProviderUsageResponse, WebChatProviderUsageWindow } from '~/types/web-chat'

const props = defineProps<{
  usage?: WebChatProviderUsageResponse | null
  loading?: boolean
}>()

const primaryLimit = computed(() => props.usage?.limits.find(limit => limit.id === 'codex') || props.usage?.limits[0] || null)
const summaryWindows = computed(() => primaryLimit.value?.windows.slice(0, 2) || [])
const visibleLimits = computed(() => props.usage?.limits.filter(limit => limit.windows.length > 0) || [])
const visible = computed(() => props.loading || (props.usage?.available && summaryWindows.value.length > 0))

const color = computed(() => {
  if (props.loading) return 'info'
  if (!props.usage?.available) return 'warning'
  const highestUsedPercent = Math.max(...summaryWindows.value.map(window => window.usedPercent), 0)
  if (highestUsedPercent >= 90) return 'warning'
  return 'info'
})

const badgeLabel = computed(() => {
  if (props.loading) return 'Codex…'
  if (!props.usage?.available || !summaryWindows.value.length) return 'Codex limits unavailable'

  const parts = summaryWindows.value.map(window => `${formatPercent(window.remainingPercent)}${windowCode(window)}`)
  return `Codex ${parts.join(' · ')}`
})

function formatPercent(value: number) {
  const rounded = Math.round(value)
  return `${rounded}%`
}

function formatReset(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function windowCode(window: WebChatProviderUsageWindow) {
  const label = window.label.toLowerCase()
  if (label.startsWith('daily')) return 'D'
  if (label.startsWith('weekly')) return 'W'
  if (label.endsWith('h')) return label
  if (label.endsWith('m')) return label
  return label.slice(0, 1).toUpperCase()
}

</script>

<template>
  <UPopover
    v-if="visible"
    mode="hover"
    :content="{ side: 'bottom', align: 'end', sideOffset: 8 }"
    :ui="{ content: 'w-80 p-0' }"
  >
    <UBadge
      :color="color"
      variant="subtle"
      icon="i-lucide-gauge"
      size="sm"
      class="hidden max-w-40 truncate font-normal sm:inline-flex"
    >
      {{ badgeLabel }}
    </UBadge>

    <template #content>
      <div class="w-80 space-y-3 p-3 text-left text-xs leading-relaxed">
        <div class="flex items-center justify-between gap-3 border-b border-default pb-2">
          <div class="font-medium text-highlighted">Codex limits</div>
          <div class="text-muted">refreshes every 5m</div>
        </div>

        <div v-if="loading" class="text-muted">Loading provider usage…</div>

        <div v-else class="space-y-3">
          <div
            v-for="limit in visibleLimits"
            :key="limit.id"
            class="space-y-2"
          >
            <div class="font-medium text-highlighted">{{ limit.label }}</div>

            <div class="space-y-2">
              <div
                v-for="window in limit.windows"
                :key="`${limit.id}-${window.label}`"
                class="grid grid-cols-[4rem_1fr] gap-3 rounded-md border border-default/70 bg-muted/80 p-2 dark:bg-muted/40"
              >
                <div class="font-medium text-highlighted">{{ window.label }}</div>
                <div class="min-w-0 space-y-1">
                  <div class="flex justify-between gap-3">
                    <span class="text-muted">Remaining</span>
                    <span class="font-medium text-highlighted">{{ formatPercent(window.remainingPercent) }}</span>
                  </div>
                  <div class="flex justify-between gap-3">
                    <span class="text-muted">Used</span>
                    <span>{{ formatPercent(window.usedPercent) }}</span>
                  </div>
                  <div v-if="formatReset(window.resetsAt)" class="flex justify-between gap-3">
                    <span class="text-muted">Resets</span>
                    <span class="text-right">{{ formatReset(window.resetsAt) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
