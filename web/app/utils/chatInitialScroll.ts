type InitialScrollState = {
  currentSessionId: string
  loadedSessionId?: string | null
  settledSessionId?: string | null
  isLoading: boolean
  hasSession: boolean
}

export function shouldHideChatUntilInitialScroll(state: InitialScrollState) {
  if (state.isLoading || !state.hasSession) return false
  if (state.loadedSessionId !== state.currentSessionId) return false

  return state.settledSessionId !== state.currentSessionId
}

export function scrollElementTreeToBottom(element?: HTMLElement | null) {
  const scrolled = new Set<Element>()
  let current: HTMLElement | null = element ?? null

  while (current) {
    if (current.scrollHeight > current.clientHeight) {
      current.scrollTop = current.scrollHeight
      scrolled.add(current)
    }
    current = current.parentElement
  }

  const scrollingElement = document.scrollingElement
  if (scrollingElement && scrollingElement.scrollHeight > scrollingElement.clientHeight) {
    scrollingElement.scrollTop = scrollingElement.scrollHeight
    scrolled.add(scrollingElement)
  }

  return scrolled.size
}
