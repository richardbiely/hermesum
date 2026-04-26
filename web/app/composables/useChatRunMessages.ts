import type { ComputedRef, Ref } from 'vue'
import type { InteractivePrompt, WebChatMessage, WebChatPart } from '~/types/web-chat'
import { toolDisplayName } from '~/utils/toolCalls'
import { createLocalMessage } from './useHermesRunStream'

type SubmitStatus = 'ready' | 'submitted' | 'streaming' | 'error'

type UseChatRunMessagesOptions = {
  sessionId: ComputedRef<string>
  refresh: () => Promise<unknown> | unknown
  refreshSessions?: () => Promise<void> | void
  refreshSessionOnFinish?: boolean
  toast: ReturnType<typeof useToast>
  activeChatRuns: ReturnType<typeof useActiveChatRuns>
}

export function useChatRunMessages(options: UseChatRunMessagesOptions) {
  const messages = ref<WebChatMessage[]>([])
  const submitStatus: Ref<SubmitStatus> = ref('ready')
  const streamError = ref<Error | undefined>()
  const connectedRunIds = new Set<string>()
  let unsubscribeRun: (() => void) | undefined

  const chatStatus = computed(() => submitStatus.value === 'submitted' || options.activeChatRuns.isRunning(options.sessionId.value) ? 'streaming' : 'ready')
  const isRunning = computed(() => options.activeChatRuns.isRunning(options.sessionId.value))

  function createThinkingMessage() {
    const message = createLocalMessage('assistant', '')
    message.parts = [{ type: 'text', text: '', status: 'thinking' }]
    return message
  }

  function isThinkingMessage(message: WebChatMessage) {
    return message.role === 'assistant' && message.parts.some(part => part.status === 'thinking') && isRunning.value
  }

  function ensureThinkingMessage() {
    const lastMessage = messages.value.at(-1)
    if (lastMessage?.role === 'assistant') return
    messages.value.push(createThinkingMessage())
  }

  function assistantMessage() {
    let assistant = messages.value[messages.value.length - 1]
    if (!assistant || assistant.role !== 'assistant') {
      assistant = createLocalMessage('assistant', '')
      messages.value.push(assistant)
    }
    return assistant
  }

  function removeThinkingPart(message: WebChatMessage) {
    const thinkingIndex = message.parts.findIndex(part => part.status === 'thinking')
    if (thinkingIndex >= 0) message.parts.splice(thinkingIndex, 1)
  }

  function appendAssistantDelta(content: string) {
    if (!content) return

    const assistant = assistantMessage()
    removeThinkingPart(assistant)

    const textPart = assistant.parts.find(part => part.type === 'text')
    if (textPart) {
      textPart.text = `${textPart.text || ''}${content}`
      textPart.status = null
    } else {
      assistant.parts.push({ type: 'text', text: content })
    }

  }

  function replaceAssistantMessage(content?: string) {
    if (!content) return

    const assistant = assistantMessage()
    removeThinkingPart(assistant)
    const textPart = assistant.parts.find(part => part.type === 'text')
    if (textPart) {
      textPart.text = content
      textPart.status = null
    } else {
      assistant.parts.push({ type: 'text', text: content, status: null })
    }
  }

  function appendToolStarted(payload: { name?: string, preview?: string, input?: unknown }) {
    let assistant = messages.value[messages.value.length - 1]
    if (!assistant || assistant.role !== 'assistant') {
      assistant = createLocalMessage('assistant', '')
      messages.value.push(assistant)
    }

    const thinkingIndex = assistant.parts.findIndex(part => part.status === 'thinking')
    if (thinkingIndex >= 0) assistant.parts.splice(thinkingIndex, 1)

    const toolPart: WebChatPart = {
      type: 'tool',
      name: payload.name,
      status: 'running',
      input: payload.input ?? payload.preview ?? null
    }
    toolPart.name = toolDisplayName(toolPart)
    assistant.parts.push(toolPart)
  }

  function markToolCompleted(payload: { name?: string }) {
    const assistant = [...messages.value].reverse().find(message => message.role === 'assistant')
    const toolPart = assistant?.parts.findLast(part => part.type === 'tool' && part.status === 'running' && (!payload.name || part.name === payload.name))
    if (toolPart) toolPart.status = 'completed'
  }

  function appendPrompt(prompt: InteractivePrompt) {
    const assistant = assistantMessage()
    removeThinkingPart(assistant)
    const existing = assistant.parts.find(part => part.prompt?.id === prompt.id)
    if (existing) {
      existing.prompt = prompt
      return
    }
    assistant.parts.push({ type: 'interactive_prompt', prompt })
  }

  function updatePrompt(prompt: InteractivePrompt) {
    for (const message of messages.value) {
      const part = message.parts.find(part => part.prompt?.id === prompt.id)
      if (part) {
        part.prompt = prompt
        return
      }
    }
  }

  function connectRun(runId: string, targetSessionId = options.sessionId.value) {
    connectedRunIds.add(runId)
    const tracked = options.activeChatRuns.trackRun(targetSessionId, runId)
    if (!tracked) {
      submitStatus.value = 'ready'
      void options.refresh()
      void options.refreshSessions?.()
      return
    }

    if (targetSessionId === options.sessionId.value) {
      submitStatus.value = 'streaming'
      ensureThinkingMessage()
    }

    unsubscribeRun?.()
    unsubscribeRun = options.activeChatRuns.subscribe(targetSessionId, {
      onDelta: (content) => {
        if (targetSessionId === options.sessionId.value) appendAssistantDelta(content)
      },
      onCompleted: (content) => {
        if (targetSessionId === options.sessionId.value) replaceAssistantMessage(content)
      },
      onToolStarted: (payload) => {
        if (targetSessionId === options.sessionId.value) appendToolStarted(payload)
      },
      onToolCompleted: (payload) => {
        if (targetSessionId === options.sessionId.value) markToolCompleted(payload)
      },
      onPromptRequested: (prompt) => {
        if (targetSessionId === options.sessionId.value) appendPrompt(prompt)
      },
      onPromptUpdated: (prompt) => {
        if (targetSessionId === options.sessionId.value) updatePrompt(prompt)
      },
      onError: (err) => {
        if (targetSessionId !== options.sessionId.value) return
        streamError.value = err
        submitStatus.value = 'error'
        options.toast.add({ color: 'error', title: 'Run failed', description: err.message })
      },
      async onFinished() {
        if (targetSessionId === options.sessionId.value) {
          submitStatus.value = 'ready'
          if (options.refreshSessionOnFinish !== false) {
            await options.refresh()
          }
        }
        await options.refreshSessions?.()
      }
    })
  }

  function hasConnectedRun(runId: string) {
    return connectedRunIds.has(runId)
  }

  function cleanupRunMessages() {
    unsubscribeRun?.()
  }

  return {
    messages,
    submitStatus,
    streamError,
    chatStatus,
    isRunning,
    createThinkingMessage,
    isThinkingMessage,
    connectRun,
    hasConnectedRun,
    cleanupRunMessages
  }
}
