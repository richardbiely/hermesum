import { ref, toValue, type MaybeRefOrGetter } from 'vue'
import { filesFromDataTransfer, hasDataTransferFiles } from '../utils/clipboard'

type ToastLike = {
  add: (toast: { color: 'warning', title: string }) => void
}

type ChatAttachmentDropOptions = {
  disabled: MaybeRefOrGetter<boolean>
  attachFiles: (files: File[]) => Promise<void> | void
  toast?: ToastLike
  unavailableTitle?: string
}

export function useChatAttachmentDrop(options: ChatAttachmentDropOptions) {
  const isDraggingFiles = ref(false)
  let dragDepth = 0

  const isDisabled = () => toValue(options.disabled)

  function resetDragState() {
    dragDepth = 0
    isDraggingFiles.value = false
  }

  function onPromptDragEnter(event: DragEvent) {
    if (!hasDataTransferFiles(event.dataTransfer)) return

    event.preventDefault()
    dragDepth += 1
    isDraggingFiles.value = true
  }

  function onPromptDragOver(event: DragEvent) {
    if (!hasDataTransferFiles(event.dataTransfer)) return

    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = isDisabled() ? 'none' : 'copy'
  }

  function onPromptDragLeave(event: DragEvent) {
    if (!hasDataTransferFiles(event.dataTransfer)) return

    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) isDraggingFiles.value = false
  }

  async function onPromptDrop(event: DragEvent) {
    if (!hasDataTransferFiles(event.dataTransfer)) return

    event.preventDefault()
    resetDragState()

    const files = filesFromDataTransfer(event.dataTransfer)
    if (!files.length) return

    if (isDisabled()) {
      options.toast?.add({
        color: 'warning',
        title: options.unavailableTitle || 'Attachment upload is unavailable right now'
      })
      return
    }

    await options.attachFiles(files)
  }

  return {
    isDraggingFiles,
    onPromptDragEnter,
    onPromptDragOver,
    onPromptDragLeave,
    onPromptDrop
  }
}
