import type { FilePreviewRequest, WebChatFilePreview } from '~/types/web-chat'

const inFlightPreviews = new Map<string, Promise<WebChatFilePreview>>()

function previewCacheKey(payload: FilePreviewRequest) {
  return `${payload.workspace || ''}\u0000${payload.path}`
}

export function useFilePreviewCache() {
  const api = useHermesApi()

  async function fetchFilePreview(payload: FilePreviewRequest) {
    const key = previewCacheKey(payload)
    const inFlight = inFlightPreviews.get(key)
    if (inFlight) return inFlight

    const request = api.fetchFilePreview(payload)
      .finally(() => {
        inFlightPreviews.delete(key)
      })

    inFlightPreviews.set(key, request)
    return request
  }

  return { fetchFilePreview }
}
