import assert from 'node:assert/strict'
import { test } from 'node:test'
import { latestContextUsageTokens } from '../app/utils/contextUsage.ts'

function message(role, fields = {}) {
  return {
    id: `${role}-${Math.random()}`,
    role,
    createdAt: '2026-01-01T10:00:00.000Z',
    parts: [],
    ...fields
  }
}

test('uses provider-reported current prompt tokens instead of cumulative run token totals', () => {
  const usage = latestContextUsageTokens([
    message('user', { parts: [{ type: 'text', text: 'make a long plan' }] }),
    message('assistant', {
      contextTokens: 120_000,
      inputTokens: 402_000,
      outputTokens: 18_000,
      parts: [{ type: 'text', text: 'Done' }]
    })
  ], false)

  assert.ok(usage)
  assert.equal(usage.tokens, 120_001)
  assert.equal(usage.estimated, true)
})

test('does not show stale aggregate metrics as context usage for legacy completed sessions', () => {
  const usage = latestContextUsageTokens([
    message('user', { parts: [{ type: 'text', text: 'make a long plan' }] }),
    message('assistant', {
      inputTokens: 402_000,
      outputTokens: 18_000,
      parts: [{ type: 'text', text: 'Done' }]
    })
  ], false)

  assert.equal(usage, null)
})

test('adds live text estimates to the last measured context baseline while a run is active', () => {
  const usage = latestContextUsageTokens([
    message('assistant', {
      contextTokens: 10_000,
      parts: [{ type: 'text', text: 'Previous answer' }]
    }),
    message('user', { parts: [{ type: 'text', text: 'next prompt text' }] })
  ], true)

  assert.ok(usage)
  assert.equal(usage.tokens, 10_008)
  assert.equal(usage.estimated, true)
})
