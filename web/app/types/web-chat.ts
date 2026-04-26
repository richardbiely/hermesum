declare global {
  interface Window {
    __HERMES_SESSION_TOKEN__?: string
  }
}

export type WebChatPart = {
  type: 'text' | 'reasoning' | 'tool' | 'media' | 'approval' | 'changes'
  text?: string | null
  name?: string | null
  status?: string | null
  input?: unknown
  output?: unknown
  url?: string | null
  mediaType?: string | null
  approvalId?: string | null
  changes?: WebChatWorkspaceChanges | null
}

export type WebChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  parts: WebChatPart[]
  createdAt: string
  reasoning?: string | null
  toolName?: string | null
  toolCalls?: unknown
}

export type WebChatSession = {
  id: string
  title: string | null
  preview: string
  source: string | null
  model: string | null
  reasoningEffort: string | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

export type WebChatModelCapability = {
  id: string
  label: string
  reasoningEfforts: string[]
  defaultReasoningEffort: string | null
}

export type WebChatCapabilitiesResponse = {
  provider: string
  defaultModel: string | null
  models: WebChatModelCapability[]
}

export type WebChatFileChange = {
  path: string
  status: 'created' | 'edited' | 'deleted' | 'renamed' | 'copied'
  additions: number
  deletions: number
}

export type WebChatWorkspaceChanges = {
  files: WebChatFileChange[]
  totalFiles: number
  totalAdditions: number
  totalDeletions: number
}

export type SessionListResponse = {
  sessions: WebChatSession[]
}

export type SessionDetailResponse = {
  session: WebChatSession
  messages: WebChatMessage[]
}

export type StartRunResponse = {
  sessionId: string
  runId: string
}

export {}
