export async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Some browsers deny async clipboard writes after an awaited operation.
      // Fall through to the legacy copy path, which still works in more contexts.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    if (!document.execCommand('copy')) {
      throw new Error('Clipboard copy was blocked by the browser.')
    }
  } finally {
    document.body.removeChild(textarea)
  }
}

export function filesFromClipboard(event: ClipboardEvent) {
  const clipboardData = event.clipboardData
  if (!clipboardData) return []

  const files = Array.from(clipboardData.files)
  if (files.length) return files

  return Array.from(clipboardData.items)
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter((file): file is File => Boolean(file))
}
