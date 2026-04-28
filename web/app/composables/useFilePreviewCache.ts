import type { FilePreviewRequest, WebChatFilePreview } from '~/types/web-chat'

const previewCache = new Map<string, WebChatFilePreview>()
const inFlightPreviews = new Map<string, Promise<WebChatFilePreview>>()

function previewCacheKey(payload: FilePreviewRequest) {
  return `${payload.workspace || ''}\u0000${payload.path}`
}

export function useFilePreviewCache() {
  const api = useHermesApi()

  async function fetchFilePreview(payload: FilePreviewRequest) {
    const key = previewCacheKey(payload)
    const cached = previewCache.get(key)
    if (cached) return cached

    const inFlight = inFlightPreviews.get(key)
    if (inFlight) return inFlight

    const request = api.fetchFilePreview(payload)
      .then((preview) => {
        previewCache.set(key, preview)
        return preview
      })
      .finally(() => {
        inFlightPreviews.delete(key)
      })

    inFlightPreviews.set(key, request)
    return request
  }

  return { fetchFilePreview }
}
