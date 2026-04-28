import type { SessionDetailResponse } from '~/types/web-chat'

type HermesApi = ReturnType<typeof useHermesApi>
type SessionDetailOptions = Parameters<HermesApi['getSession']>[1]

const inflightSessionRequests = new Map<string, Promise<SessionDetailResponse>>()

function requestKey(sessionId: string, options: SessionDetailOptions = {}) {
  return [sessionId, options.messageLimit || '', options.messageBefore || ''].join(':')
}

export function useWebChatSessionCache(api: HermesApi = useHermesApi()) {
  const sessions = useState<Record<string, SessionDetailResponse>>('web-chat-session-detail-cache', () => ({}))

  function get(sessionId: string) {
    return sessions.value[sessionId] || null
  }

  function set(response: SessionDetailResponse | null | undefined) {
    const sessionId = response?.session?.id
    if (!sessionId) return
    sessions.value = { ...sessions.value, [sessionId]: response }
  }

  function remove(sessionId: string) {
    const { [sessionId]: _removed, ...rest } = sessions.value
    sessions.value = rest
    for (const key of Array.from(inflightSessionRequests.keys())) {
      if (key === sessionId || key.startsWith(`${sessionId}:`)) inflightSessionRequests.delete(key)
    }
  }

  async function fetch(sessionId: string, options: SessionDetailOptions = {}) {
    const key = requestKey(sessionId, options)
    const existing = inflightSessionRequests.get(key)
    if (existing) return await existing

    const request = api.getSession(sessionId, options)
      .then((response) => {
        set(response)
        return response
      })
      .finally(() => {
        inflightSessionRequests.delete(key)
      })

    inflightSessionRequests.set(key, request)
    return await request
  }

  function prefetch(sessionId: string, options: SessionDetailOptions = {}) {
    const key = requestKey(sessionId, options)
    if (get(sessionId) || inflightSessionRequests.has(key)) return
    void fetch(sessionId, options).catch(() => {
      // Navigation will surface errors if the user actually opens the chat.
    })
  }

  return {
    sessions,
    get,
    set,
    remove,
    fetch,
    prefetch
  }
}
