type NewChatRequest = {
  id: number
  workspace: string | null
  consumed: boolean
}

export function useNewChatRequest() {
  const request = useState<NewChatRequest>('new-chat-request', () => ({
    id: 0,
    workspace: null,
    consumed: true
  }))

  function openNewChat(workspace: string | null) {
    request.value = {
      id: request.value.id + 1,
      workspace,
      consumed: false
    }
  }

  function markConsumed(id: number) {
    if (request.value.id !== id) return
    request.value = {
      ...request.value,
      consumed: true
    }
  }

  return {
    request,
    openNewChat,
    markConsumed
  }
}
