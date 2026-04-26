import type { WebChatCapabilitiesResponse, WebChatModelCapability, WebChatSession } from '~/types/web-chat'

function normalizeReasoningValue(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized || null
}

export function useChatComposerCapabilities() {
  const api = useHermesApi()

  const capabilities = useState<WebChatCapabilitiesResponse | null>('chat-composer-capabilities', () => null)
  const capabilitiesLoading = useState('chat-composer-capabilities-loading', () => false)
  const selectedModel = useState<string | null>('chat-composer-selected-model', () => null)
  const selectedReasoningEffort = useState<string | null>('chat-composer-selected-reasoning', () => null)
  const lastUsedModel = useState<string | null>('chat-composer-last-used-model', () => null)
  const lastUsedReasoningEffort = useState<string | null>('chat-composer-last-used-reasoning', () => null)

  const models = computed(() => capabilities.value?.models || [])
  const defaultModel = computed(() => capabilities.value?.defaultModel || models.value[0]?.id || null)

  function modelCapability(modelId: string | null | undefined): WebChatModelCapability | null {
    if (!modelId) return null
    return models.value.find(model => model.id === modelId) || null
  }

  function supportedReasoningEfforts(modelId: string | null | undefined) {
    return modelCapability(modelId)?.reasoningEfforts || []
  }

  function defaultReasoningForModel(modelId: string | null | undefined) {
    const capability = modelCapability(modelId)
    if (!capability) return null
    if (capability.defaultReasoningEffort) return capability.defaultReasoningEffort
    if (capability.reasoningEfforts.includes('medium')) return 'medium'
    return capability.reasoningEfforts[0] || null
  }

  function normalizeModel(modelId: string | null | undefined) {
    if (modelId && modelCapability(modelId)) return modelId
    return defaultModel.value
  }

  function reconcileReasoning(modelId: string | null | undefined, reasoningEffort: string | null | undefined) {
    const supported = supportedReasoningEfforts(modelId)
    if (!supported.length) return null

    const normalized = normalizeReasoningValue(reasoningEffort)
    if (normalized && supported.includes(normalized)) return normalized

    return defaultReasoningForModel(modelId)
  }

  function setSelection(modelId: string | null | undefined, reasoningEffort: string | null | undefined) {
    const resolvedModel = normalizeModel(modelId)
    selectedModel.value = resolvedModel
    selectedReasoningEffort.value = reconcileReasoning(resolvedModel, reasoningEffort)
  }

  async function ensureCapabilities() {
    if (capabilities.value || capabilitiesLoading.value) return

    capabilitiesLoading.value = true
    try {
      capabilities.value = await api.getCapabilities()
    } finally {
      capabilitiesLoading.value = false
    }
  }

  async function initializeForNewChat() {
    await ensureCapabilities()
    setSelection(lastUsedModel.value, lastUsedReasoningEffort.value)
  }

  async function initializeForSession(session: WebChatSession | null | undefined) {
    await ensureCapabilities()
    setSelection(
      session?.model || lastUsedModel.value,
      normalizeReasoningValue(session?.reasoningEffort) || lastUsedReasoningEffort.value
    )
  }

  function rememberLastUsedSelection() {
    lastUsedModel.value = selectedModel.value
    lastUsedReasoningEffort.value = selectedReasoningEffort.value
  }

  watch(selectedModel, (modelId) => {
    if (!capabilities.value) return
    selectedReasoningEffort.value = reconcileReasoning(modelId, selectedReasoningEffort.value)
  })

  return {
    capabilities,
    capabilitiesLoading,
    defaultModel,
    models,
    selectedModel,
    selectedReasoningEffort,
    supportedReasoningEfforts,
    ensureCapabilities,
    initializeForNewChat,
    initializeForSession,
    rememberLastUsedSelection
  }
}
