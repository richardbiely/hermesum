import type { WebChatPart } from '../types/web-chat'

type RecordValue = Record<string, unknown>

type Candidate = {
  key: string
  value: string
  score: number
}

const PREFERRED_KEYS = [
  'name',
  'path',
  'file_path',
  'command',
  'query',
  'pattern',
  'url',
  'ref',
  'key',
  'action',
  'job_id',
  'session_id',
  'prompt',
  'title',
  'text',
  'schedule'
]

const SENSITIVE_KEY_RE = /(token|password|passwd|secret|apikey|api_key|authorization|cookie|session.?token|bearer|jwt)/i
const PATH_KEY_RE = /(path|file|dir|workdir|cwd|url)$/i
const TEXT_KEY_RE = /(prompt|text|content|description|message|query|command|pattern)$/i
const MAX_SUMMARY_LENGTH = 84

function normalizeSummaryValue(value: unknown) {
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (!trimmed || !['{', '['].includes(trimmed[0] || '')) return value

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function parseJsonishString(value: unknown) {
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (!trimmed || !['{', '['].includes(trimmed[0] || '')) return value

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function firstJsonKey(value: unknown) {
  const record = normalizeToolPayload(value)
  if (!record) return undefined
  return Object.keys(record).find(key => record[key] !== undefined && record[key] !== null && record[key] !== '')
}

function normalizeToolPayload(value: unknown): RecordValue | undefined {
  const normalized = normalizeSummaryValue(value)
  return normalized && typeof normalized === 'object' && !Array.isArray(normalized)
    ? normalized as RecordValue
    : undefined
}

function isSensitiveKey(key: string) {
  return SENSITIVE_KEY_RE.test(key)
}

function compactText(value: string, maxLength = MAX_SUMMARY_LENGTH) {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

function compactPath(value: string) {
  const text = compactText(value, 120)
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text)
      return compactText(`${url.hostname}${url.pathname === '/' ? '' : url.pathname}`)
    } catch {
      return text
    }
  }

  return text.replace(/^\/Users\/[^/]+\//, '~/')
}

function primitiveSummary(key: string, value: unknown) {
  if (isSensitiveKey(key)) return undefined
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return undefined
    return PATH_KEY_RE.test(key) ? compactPath(text) : compactText(text)
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function keyScore(key: string, value: unknown, depth: number) {
  const lower = key.toLowerCase()
  const preferredIndex = PREFERRED_KEYS.indexOf(lower)
  let score = preferredIndex >= 0 ? 120 - preferredIndex : 20

  if (typeof value === 'string') {
    if (PATH_KEY_RE.test(key) || /^https?:\/\//i.test(value) || value.includes('/')) score += 18
    if (TEXT_KEY_RE.test(key)) score += 12
    if (value.length > 160) score -= 12
  }

  if (typeof value === 'number') score -= 10
  score -= depth * 8
  return score
}

function collectCandidates(value: unknown, toolName = '', depth = 0): Candidate[] {
  if (depth > 3) return []

  const normalized = normalizeSummaryValue(value)
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) return []

  const candidates: Candidate[] = []
  for (const [key, child] of Object.entries(normalized as RecordValue)) {
    if (isSensitiveKey(key)) continue

    const childValue = key === 'arguments' ? parseJsonishString(child) : child
    const primitive = primitiveSummary(key, childValue)
    if (primitive && primitive.toLowerCase() !== toolName.toLowerCase()) {
      candidates.push({ key, value: primitive, score: keyScore(key, child, depth) })
      continue
    }

    if (childValue && typeof childValue === 'object' && !Array.isArray(childValue)) {
      candidates.push(...collectCandidates(childValue, toolName, depth + 1))
    }
  }

  return candidates
}

function argumentPayload(input: unknown) {
  const record = normalizeToolPayload(input)
  if (!record) return undefined

  if ('arguments' in record) return parseJsonishString(record.arguments)

  const fn = record.function
  if (fn && typeof fn === 'object' && !Array.isArray(fn) && 'arguments' in fn) {
    return parseJsonishString((fn as RecordValue).arguments)
  }

  return undefined
}

function candidateByKey(candidates: Candidate[], key: string) {
  return candidates.find(candidate => candidate.key.toLowerCase() === key)
}

function candidateSummary(candidates: Candidate[]) {
  const action = candidateByKey(candidates, 'action')
  const target = candidates.find(candidate => candidate !== action)
  if (action && target) return compactText(`${action.value} ${target.value}`)

  return candidates[0]?.value
}

function bestInputSummary(input: unknown, toolName = '') {
  const args = argumentPayload(input)
  if (args !== undefined) {
    const argCandidates = collectCandidates(args, toolName).sort((a, b) => b.score - a.score)
    const argSummary = candidateSummary(argCandidates)
    if (argSummary) return argSummary
  }

  const normalized = normalizeSummaryValue(input)

  if (typeof normalized === 'string') return compactText(normalized)
  if (Array.isArray(normalized)) return `${normalized.length} items`
  if (!normalized || typeof normalized !== 'object') return primitiveSummary('value', normalized)

  const candidates = collectCandidates(normalized, toolName).sort((a, b) => b.score - a.score)
  const summary = candidateSummary(candidates)
  if (summary) return summary

  return `${Object.keys(normalized as RecordValue).length} keys`
}

function outputStatusSummary(output: unknown) {
  const normalized = normalizeSummaryValue(output)

  if (normalized && typeof normalized === 'object' && !Array.isArray(normalized)) {
    const record = normalized as RecordValue
    const error = primitiveSummary('error', record.error) || primitiveSummary('message', record.message)
    if (record.success === false && error) return error
    if (typeof record.exit_code === 'number') return record.exit_code === 0 ? 'passed' : `failed (${record.exit_code})`
    if (Array.isArray(record.files_modified)) return `${record.files_modified.length} files changed`
    if (typeof record.total_count === 'number') return `${record.total_count} matches`
    if (Array.isArray(record.matches)) return `${record.matches.length} matches`
    if (Array.isArray(record.files)) return `${record.files.length} files`
    if (Array.isArray(record.items)) return `${record.items.length} items`
    if (Array.isArray(record.results)) return `${record.results.length} results`
    if (record.success === true) return 'done'
  }

  if (Array.isArray(normalized)) return `${normalized.length} items`
  if (typeof normalized === 'string') return compactText(normalized)
  return undefined
}

export function toolDisplayName(part: Pick<WebChatPart, 'name' | 'input'>) {
  const name = typeof part.name === 'string' ? part.name.trim() : ''
  if (name && name !== 'Tool call') return name

  const input = normalizeToolPayload(part.input)
  const functionName = input?.function && typeof input.function === 'object'
    ? (input.function as RecordValue).name
    : undefined
  if (typeof functionName === 'string' && functionName.trim()) return functionName.trim()

  return firstJsonKey(part.input) || 'Tool call'
}

export function toolInputSummary(part: Pick<WebChatPart, 'name' | 'input'>) {
  return bestInputSummary(part.input, toolDisplayName(part))
}

export function toolOutputSummary(part: Pick<WebChatPart, 'output' | 'status'>) {
  return outputStatusSummary(part.output) || part.status || undefined
}

export function toolCallTitle(part: Pick<WebChatPart, 'name' | 'input'>) {
  const name = toolDisplayName(part)
  const input = toolInputSummary(part)
  return input ? `${name}: ${input}` : name
}
