import type { MaybeRefOrGetter } from 'vue'
import type { WebChatProviderUsageResponse } from '~/types/web-chat'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

function unavailableUsage(provider: string | null, model: string | null, reason: string): WebChatProviderUsageResponse | null {
  if (!provider) return null
  return {
    provider,
    model,
    source: provider,
    available: false,
    unavailableReason: reason,
    limits: []
  }
}

export function useProviderUsage(
  provider: MaybeRefOrGetter<string | null | undefined>,
  model: MaybeRefOrGetter<string | null | undefined>
) {
  const api = useHermesApi()
  const usage = useState<WebChatProviderUsageResponse | null>('provider-usage', () => null)
  const loading = useState('provider-usage-loading', () => false)
  let requestId = 0
  let refreshInterval: ReturnType<typeof setInterval> | null = null

  async function refresh() {
    const nextProvider = toValue(provider)?.trim() || null
    const nextModel = toValue(model)?.trim() || null
    const currentRequest = ++requestId

    if (!nextProvider) {
      usage.value = null
      loading.value = false
      return
    }

    loading.value = true
    try {
      const response = await api.getProviderUsage(nextProvider, nextModel)
      if (currentRequest === requestId) usage.value = response
    } catch (err) {
      if (currentRequest !== requestId) return
      usage.value = unavailableUsage(
        nextProvider,
        nextModel,
        getHermesErrorMessage(err, 'Provider usage is unavailable.')
      )
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  watch(
    () => [toValue(provider), toValue(model)] as const,
    () => { void refresh() },
    { immediate: true }
  )

  onMounted(() => {
    refreshInterval = setInterval(() => { void refresh() }, REFRESH_INTERVAL_MS)
  })

  onBeforeUnmount(() => {
    if (refreshInterval) clearInterval(refreshInterval)
  })

  return {
    usage,
    loading,
    refresh
  }
}
