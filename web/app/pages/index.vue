<script setup lang="ts">
import { requiresWorkspaceBeforeSubmit } from '../utils/slashCommands'
import { prepareNotificationSound } from '../utils/notificationSound'
import type { WebChatCommand } from '~/types/web-chat'

const input = ref('')
const loading = ref(false)
const error = ref<Error | undefined>()
const workspaceInvalidSignal = ref(0)
const api = useHermesApi()
const router = useRouter()
const refreshSessions = inject<() => Promise<void> | void>('refreshSessions')
const composer = useChatComposerCapabilities()
const activeChatRuns = useActiveChatRuns()
const context = useChatComposerContext()
const toast = useToast()
const slashCommands = useSlashCommands({ input })

await Promise.all([composer.initializeForNewChat(), context.initialize()])

function appendVoiceText(text: string) {
  input.value = input.value ? `${input.value} ${text}` : text
}

function showError(err: unknown, fallback: string) {
  const message = getHermesErrorMessage(err, fallback)
  error.value = new Error(message)
  toast.add({ color: 'error', title: fallback, description: message })
}

async function attachFiles(files: File[]) {
  try {
    await context.uploadFiles(files)
  } catch (err) {
    showError(err, 'Could not upload attachment.')
  }
}

function showVoiceError(message: string) {
  showError(new Error(message), 'Voice input failed')
}

function showCommandError(err: unknown, commandText: string) {
  const message = getHermesErrorMessage(err, 'Command failed')
  toast.add({ color: 'warning', title: commandText, description: message })
}

function shouldBlockForMissingWorkspace(message: string) {
  if (!requiresWorkspaceBeforeSubmit(message, context.selectedWorkspace.value)) return false
  workspaceInvalidSignal.value += 1
  return true
}

async function executeSlashCommand(commandText: string) {
  if (shouldBlockForMissingWorkspace(commandText)) return false

  error.value = undefined
  try {
    const response = await api.executeCommand({
      command: commandText,
      workspace: context.selectedWorkspace.value,
      model: composer.selectedModel.value,
      reasoningEffort: composer.selectedReasoningEffort.value
    })
    if (response.sessionId) {
      await refreshSessions?.()
      await router.push({ path: `/chat/${response.sessionId}` })
      return true
    }
    const text = response.message?.parts.find(part => part.type === 'text')?.text || 'Command completed.'
    toast.add({ title: commandText, description: text })
  } catch (err) {
    showCommandError(err, commandText)
  }
  return true
}

async function submitSlashCommandIfNeeded(message: string) {
  if (!message.startsWith('/')) return false
  await slashCommands.loadCommands()
  const command = slashCommands.exactCommand(message)
  if (!command) return false
  const executed = await executeSlashCommand(command.name)
  if (executed) input.value = ''
  return true
}

async function selectSlashCommand(command: WebChatCommand) {
  input.value = command.name
  const executed = await executeSlashCommand(command.name)
  if (executed) input.value = ''
}

function onPromptArrowDown(event: KeyboardEvent) {
  if (!slashCommands.isOpen.value) return
  event.preventDefault()
  slashCommands.moveHighlight(1)
}

function onPromptArrowUp(event: KeyboardEvent) {
  if (!slashCommands.isOpen.value) return
  event.preventDefault()
  slashCommands.moveHighlight(-1)
}

function onPromptEscape(event: KeyboardEvent) {
  if (!slashCommands.isOpen.value) return
  event.preventDefault()
  event.stopPropagation()
  slashCommands.close()
}

function onPromptEnter(event: KeyboardEvent) {
  if (!slashCommands.isOpen.value) return
  const command = slashCommands.highlightedCommand()
  if (!command) return
  event.preventDefault()
  selectSlashCommand(command)
}

async function onSubmit() {
  const message = input.value.trim()
  if (!message || loading.value) return
  if (shouldBlockForMissingWorkspace(message)) return
  if (await submitSlashCommandIfNeeded(message)) return

  loading.value = true
  error.value = undefined
  void prepareNotificationSound()
  try {
    const result = await api.startRun(message, {
      model: composer.selectedModel.value,
      reasoningEffort: composer.selectedReasoningEffort.value,
      workspace: context.selectedWorkspace.value,
      attachments: context.attachments.value.map(attachment => attachment.id)
    })
    composer.rememberLastUsedSelection()
    context.clearAttachments()
    activeChatRuns.trackRun(result.sessionId, result.runId)
    await router.push({ path: `/chat/${result.sessionId}`, query: { run: result.runId } })
    void refreshSessions?.()
  } catch (err) {
    showError(err, 'Failed to create chat')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppNavbar title="New chat" />
    </template>

    <template #body>
      <UContainer class="flex min-h-full items-center justify-center py-12">
        <div class="w-full max-w-3xl space-y-6">
          <div class="space-y-2 text-center">
            <h1 class="text-3xl font-semibold tracking-tight">How can Hermes help?</h1>
            <p class="text-muted">Start a native web chat session backed by Hermes Agent.</p>
          </div>

          <UChatPrompt
            v-model="input"
            :error="error || context.contextError.value"
            @submit="onSubmit"
            @keydown.down="onPromptArrowDown"
            @keydown.up="onPromptArrowUp"
            @keydown.esc="onPromptEscape"
            @keydown.enter="onPromptEnter"
          >
            <template #footer>
              <ChatPromptFooter
                :submit-status="loading ? 'submitted' : 'ready'"
                :workspaces="context.workspaces.value"
                :selected-workspace="context.selectedWorkspace.value"
                :workspace-invalid-signal="workspaceInvalidSignal"
                :workspaces-loading="context.workspacesLoading.value"
                :attachments="context.attachments.value"
                :attachments-loading="context.attachmentsLoading.value"
                :models="composer.models.value"
                :selected-model="composer.selectedModel.value"
                :selected-reasoning-effort="composer.selectedReasoningEffort.value"
                :capabilities-loading="composer.capabilitiesLoading.value"
                :slash-commands="slashCommands.filteredCommands.value"
                :slash-commands-open="slashCommands.isOpen.value"
                :slash-commands-loading="slashCommands.loading.value"
                :highlighted-slash-command-index="slashCommands.highlightedIndex.value"
                @update-selected-workspace="context.selectWorkspace"
                @attach-files="attachFiles"
                @remove-attachment="context.removeAttachment"
                @voice-text="appendVoiceText"
                @voice-error="showVoiceError"
                @update-selected-model="composer.selectedModel.value = $event"
                @update-selected-reasoning-effort="composer.selectedReasoningEffort.value = $event"
                @select-slash-command="selectSlashCommand"
                @highlight-slash-command="slashCommands.highlightedIndex.value = $event"
              />
            </template>
          </UChatPrompt>
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
