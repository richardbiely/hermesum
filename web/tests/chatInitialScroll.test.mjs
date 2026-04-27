import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shouldHideChatUntilInitialScroll } from '../app/utils/chatInitialScroll.ts'

test('hides newly loaded chat content until the initial bottom scroll has settled', () => {
  assert.equal(shouldHideChatUntilInitialScroll({
    currentSessionId: 'chat-2',
    loadedSessionId: 'chat-2',
    settledSessionId: null,
    isLoading: false,
    hasSession: true
  }), true)
})

test('does not hide while loading, unavailable, stale, or already settled', () => {
  assert.equal(shouldHideChatUntilInitialScroll({
    currentSessionId: 'chat-2',
    loadedSessionId: undefined,
    settledSessionId: null,
    isLoading: true,
    hasSession: false
  }), false)

  assert.equal(shouldHideChatUntilInitialScroll({
    currentSessionId: 'chat-2',
    loadedSessionId: 'chat-1',
    settledSessionId: null,
    isLoading: false,
    hasSession: true
  }), false)

  assert.equal(shouldHideChatUntilInitialScroll({
    currentSessionId: 'chat-2',
    loadedSessionId: 'chat-2',
    settledSessionId: 'chat-2',
    isLoading: false,
    hasSession: true
  }), false)
})
