import type { WebChatPart } from '../types/web-chat'

function firstJsonKey(value: unknown) {
  const record = normalizeToolPayload(value)
  if (!record) return undefined
  return Object.keys(record).find(key => record[key] !== undefined && record[key] !== null && record[key] !== '')
}

function normalizeToolPayload(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (!trimmed.startsWith('{')) return undefined

  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

export function toolDisplayName(part: Pick<WebChatPart, 'name' | 'input'>) {
  const name = typeof part.name === 'string' ? part.name.trim() : ''
  if (name && name !== 'Tool call') return name

  const input = normalizeToolPayload(part.input)
  const functionName = input?.function && typeof input.function === 'object'
    ? (input.function as Record<string, unknown>).name
    : undefined
  if (typeof functionName === 'string' && functionName.trim()) return functionName.trim()

  return firstJsonKey(part.input) || 'Tool call'
}
