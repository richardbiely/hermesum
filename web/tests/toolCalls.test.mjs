import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toolCallTitle, toolDisplayName, toolInputSummary, toolOutputSummary } from '../app/utils/toolCalls.ts'

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

test('builds compact title from preferred input fields', () => {
  assert.equal(toolCallTitle({ name: 'skill_view', input: { name: 'systematic-debugging' } }), 'skill_view: systematic-debugging')
  assert.equal(toolCallTitle({ name: 'terminal', input: { command: 'pnpm typecheck', timeout: 600 } }), 'terminal: pnpm typecheck')
})

test('finds useful nested input without hardcoded paths', () => {
  assert.equal(toolInputSummary({ name: 'skill_view', input: { function: { arguments: { name: 'hermesum-web-chat-development' } } } }), 'hermesum-web-chat-development')
})

test('skips duplicated function names and prefers argument details', () => {
  assert.equal(toolCallTitle({
    name: 'terminal',
    input: { function: { name: 'terminal', arguments: '{"command":"pnpm typecheck","timeout":600}' } }
  }), 'terminal: pnpm typecheck')

  assert.equal(toolCallTitle({
    name: 'read_file',
    input: { function: { name: 'read_file', arguments: { path: '/Users/pavolbiely/Sites/hermesum/web/app/utils/toolCalls.ts', offset: 1 } } }
  }), 'read_file: ~/Sites/hermesum/web/app/utils/toolCalls.ts')
})

test('combines action with target for management tools', () => {
  assert.equal(toolCallTitle({
    name: 'skill_manage',
    input: { action: 'patch', name: 'hermesum-web-chat-development', old_string: 'x' }
  }), 'skill_manage: patch hermesum-web-chat-development')
})

test('summarizes paths and URLs compactly', () => {
  assert.equal(toolInputSummary({ input: { path: '/Users/pavolbiely/Sites/hermesum/web/app/layouts/default.vue' } }), '~/Sites/hermesum/web/app/layouts/default.vue')
  assert.equal(toolInputSummary({ input: { url: 'https://example.com/docs/page?foo=bar' } }), 'example.com/docs/page')
})

test('redacts sensitive candidate fields from summaries', () => {
  assert.equal(toolInputSummary({ input: { token: 'secret-token', command: 'pnpm build' } }), 'pnpm build')
})

test('summarizes common output shapes', () => {
  assert.equal(toolOutputSummary({ output: { exit_code: 0 } }), 'passed')
  assert.equal(toolOutputSummary({ output: { exit_code: 2 } }), 'failed (2)')
  assert.equal(toolOutputSummary({ output: { files_modified: ['a.vue', 'b.ts'] } }), '2 files changed')
  assert.equal(toolOutputSummary({ output: { total_count: 12, matches: [] } }), '12 matches')
})
