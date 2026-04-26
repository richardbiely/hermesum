import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toolDisplayName } from '../app/utils/toolCalls.ts'

test('uses explicit tool name when available', () => {
  assert.equal(toolDisplayName({ name: 'terminal', input: { command: 'pnpm typecheck' } }), 'terminal')
})

test('falls back to function name from structured tool call input', () => {
  assert.equal(toolDisplayName({ name: null, input: { function: { name: 'search_files' } } }), 'search_files')
})

test('falls back to first JSON payload key for unnamed tool calls', () => {
  assert.equal(toolDisplayName({ name: 'Tool call', input: { command: 'pnpm typecheck', timeout: 300 } }), 'command')
})

test('falls back to first key from stringified JSON payload', () => {
  assert.equal(toolDisplayName({ name: undefined, input: '{"path":"/tmp/example","limit":10}' }), 'path')
})
