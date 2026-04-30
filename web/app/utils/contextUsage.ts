import type { WebChatMessage } from '~/types/web-chat'

export type ContextUsageTokens = {
  tokens: number
  estimated: boolean
}

export function estimateTokenCount(text: string) {
  const normalized = text.trim()
  if (!normalized) return 0
  return Math.max(1, Math.ceil(normalized.length / 4))
}

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function messageText(message: WebChatMessage) {
  return message.parts
    .map(part => typeof part.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('\n\n')
}

export function latestContextUsageTokens(messages: WebChatMessage[], isRunning: boolean): ContextUsageTokens | null {
  let baselineTokens: number | null = null
  let baselineIndex = -1
  let baselineEstimated = false

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role !== 'assistant' || !finitePositive(message.contextTokens)) continue

    const responseTokens = estimateTokenCount(messageText(message))
    baselineTokens = message.contextTokens + responseTokens
    baselineIndex = index
    baselineEstimated = responseTokens > 0
    break
  }

  if (!isRunning) {
    return baselineTokens === null
      ? null
      : { tokens: baselineTokens, estimated: baselineEstimated }
  }

  const activeMessages = messages.slice(baselineIndex + 1)
  const liveText = activeMessages
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .map(messageText)
    .filter(Boolean)
    .join('\n\n')
  const estimatedLiveTokens = estimateTokenCount(liveText)
  if (estimatedLiveTokens > 0) {
    return { tokens: (baselineTokens ?? 0) + estimatedLiveTokens, estimated: true }
  }

  return baselineTokens === null
    ? null
    : { tokens: baselineTokens, estimated: baselineEstimated }
}
