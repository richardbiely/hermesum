import type { Ref } from 'vue'
import { filesFromClipboard } from '~/utils/clipboard'

type ChatComposerStateOptions = {
  sessionId: Ref<string>
  context: ReturnType<typeof useChatComposerContext>
  chatStatus: Ref<string>
  toast: ReturnType<typeof useToast>
  showError: (error: unknown, fallback: string) => void
}

export function useChatComposerState(options: ChatComposerStateOptions) {
  const { sessionId, context, chatStatus, toast, showError } = options
  const { input } = useChatDraft(sessionId)
  const slashCommands = useSlashCommands({ input })
  const autocomplete = useChatSlashCommandAutocomplete({ input, slashCommands })
  const drop = useChatAttachmentDrop({
    disabled: computed(() => chatStatus.value === 'submitted' || chatStatus.value === 'streaming' || context.attachmentsLoading.value),
    attachFiles,
    toast,
    unavailableTitle: 'Attachment upload is unavailable right now'
  })

  function appendVoiceText(text: string) {
    input.value = input.value ? `${input.value} ${text}` : text
  }

  async function attachFiles(files: File[]) {
    try {
      await context.uploadFiles(files)
    } catch (err) {
      showError(err, 'Could not upload attachment.')
    }
  }

  async function onPromptPaste(event: ClipboardEvent) {
    const files = filesFromClipboard(event)
    if (!files.length) return

    event.preventDefault()
    if (chatStatus.value === 'submitted' || chatStatus.value === 'streaming' || context.attachmentsLoading.value) {
      toast.add({ color: 'warning', title: 'Attachment upload is unavailable right now' })
      return
    }

    await attachFiles(files)
  }

  return {
    input,
    slashCommands,
    selectSlashCommand: autocomplete.selectSlashCommand,
    onPromptArrowDown: autocomplete.onPromptArrowDown,
    onPromptArrowUp: autocomplete.onPromptArrowUp,
    onPromptEscape: autocomplete.onPromptEscape,
    onPromptAutocompleteEnter: autocomplete.onPromptEnter,
    appendVoiceText,
    attachFiles,
    onPromptPaste,
    isDraggingFiles: drop.isDraggingFiles,
    onPromptDragEnter: drop.onPromptDragEnter,
    onPromptDragOver: drop.onPromptDragOver,
    onPromptDragLeave: drop.onPromptDragLeave,
    onPromptDrop: drop.onPromptDrop,
  }
}
