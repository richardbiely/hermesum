import type {
  SessionDetailResponse,
  SessionListResponse,
  StartRunResponse,
  WebChatCapabilitiesResponse,
  WebChatWorkspaceChanges
} from '~/types/web-chat'

function hermesToken() {
  if (import.meta.server) return undefined
  const runtimeToken = useRuntimeConfig().public.hermesSessionToken
  return window.__HERMES_SESSION_TOKEN__ || (typeof runtimeToken === 'string' ? runtimeToken : undefined)
}

export function useHermesApi() {
  async function request<T>(path: string, options: Parameters<typeof $fetch<T>>[1] = {}) {
    return await $fetch<T>(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(hermesToken() ? { 'X-Hermes-Session-Token': hermesToken() } : {})
      }
    })
  }

  return {
    getCapabilities: () => request<WebChatCapabilitiesResponse>('/api/web-chat/capabilities'),
    getWorkspaceChanges: () => request<WebChatWorkspaceChanges>('/api/web-chat/workspace-changes'),
    listSessions: () => request<SessionListResponse>('/api/web-chat/sessions'),
    getSession: (id: string) => request<SessionDetailResponse>(`/api/web-chat/sessions/${id}`, {
      query: { includeWorkspaceChanges: true }
    }),
    createSession: (message: string) => request<SessionDetailResponse>('/api/web-chat/sessions', {
      method: 'POST',
      body: { message }
    }),
    startRun: (
      input: string,
      options: { sessionId?: string, model?: string | null, reasoningEffort?: string | null } = {}
    ) => request<StartRunResponse>('/api/web-chat/runs', {
      method: 'POST',
      body: {
        input,
        sessionId: options.sessionId,
        model: options.model,
        reasoningEffort: options.reasoningEffort
      }
    })
  }
}
