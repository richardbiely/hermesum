<script setup lang="ts">
import type { WebChatTaskPlan } from '~/types/web-chat'
import type { QueuedMessage } from '~/utils/queuedMessages'

defineProps<{
  queuedMessages: QueuedMessage[]
  taskPlan: WebChatTaskPlan | null
  steeringQueuedMessageId: string | null
  disabled: boolean
}>()

const emit = defineEmits<{
  editQueuedMessage: [id: string]
  deleteQueuedMessage: [id: string]
  steerQueuedMessage: [id: string]
}>()
</script>

<template>
  <div class="space-y-2">
    <div v-if="queuedMessages.length" class="pointer-events-auto">
      <ChatQueuedMessages
        :messages="queuedMessages"
        :steering-id="steeringQueuedMessageId"
        :disabled="disabled"
        @edit="emit('editQueuedMessage', $event)"
        @delete="emit('deleteQueuedMessage', $event)"
        @steer="emit('steerQueuedMessage', $event)"
      />
    </div>

    <ChatTaskPlanCard
      v-if="taskPlan"
      :task-plan="taskPlan"
      class="pointer-events-auto mx-4 sm:mx-6"
    />
  </div>
</template>
