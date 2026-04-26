<script setup lang="ts">
import type { WebChatWorkspaceChanges } from '~/types/web-chat'

const props = defineProps<{
  changes: WebChatWorkspaceChanges
}>()

const open = ref(false)

const changedFiles = computed(() => props.changes.files)

const totalLabel = computed(() => {
  const count = props.changes.totalFiles
  return `${count} ${count === 1 ? 'file' : 'files'} changed`
})

const groupedLabel = computed(() => {
  const order: Array<WebChatWorkspaceChanges['files'][number]['status']> = ['created', 'edited', 'deleted', 'renamed', 'copied']
  const counts = new Map(order.map(status => [status, 0]))
  for (const file of changedFiles.value) {
    counts.set(file.status, (counts.get(file.status) || 0) + 1)
  }

  return order
    .map((status) => {
      const count = counts.get(status) || 0
      if (!count) return ''
      return `${statusLabel(status)} ${count} ${count === 1 ? 'file' : 'files'}`
    })
    .filter(Boolean)
    .join(', ')
})

function statusLabel(status: WebChatWorkspaceChanges['files'][number]['status']) {
  return {
    created: 'Created',
    edited: 'Edited',
    deleted: 'Deleted',
    renamed: 'Renamed',
    copied: 'Copied'
  }[status] || 'Edited'
}

function statusClass(status: WebChatWorkspaceChanges['files'][number]['status']) {
  return {
    created: 'text-success',
    edited: 'text-dimmed',
    deleted: 'text-error',
    renamed: 'text-warning',
    copied: 'text-info'
  }[status] || 'text-dimmed'
}
</script>

<template>
  <div v-if="changedFiles.length" class="my-3 text-sm">
    <button
      type="button"
      class="flex max-w-full items-center gap-1.5 text-left text-muted hover:text-default"
      @click="open = !open"
    >
      <span class="min-w-0 truncate">
        {{ groupedLabel || totalLabel }}
        <span class="ml-1 text-success">+{{ changes.totalAdditions }}</span>
        <span class="text-error">-{{ changes.totalDeletions }}</span>
      </span>
      <UIcon
        name="i-lucide-chevron-down"
        class="size-3.5 shrink-0 text-dimmed transition-transform"
        :class="{ 'rotate-180': open }"
      />
    </button>

    <div v-show="open" class="mt-1 space-y-1">
      <div
        v-for="file in changedFiles"
        :key="file.path"
        class="flex max-w-full items-baseline gap-1.5 overflow-hidden text-muted"
      >
        <span class="shrink-0" :class="statusClass(file.status)">{{ statusLabel(file.status) }}</span>
        <span class="min-w-0 truncate text-primary">{{ file.path }}</span>
        <span class="shrink-0">
          <span class="text-success">+{{ file.additions }}</span>
          <span class="text-error">-{{ file.deletions }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
