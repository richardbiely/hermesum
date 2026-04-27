import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reconcileRunSession } from '../app/utils/activeRunSession.ts'

test('keeps a run on the tracked session when the event session matches', () => {
  assert.deepEqual(
    reconcileRunSession({
      trackedSessionId: 'session-a',
      eventSessionId: 'session-a',
      runningSessionIds: ['session-a']
    }),
    {
      sessionId: 'session-a',
      runningSessionIds: ['session-a'],
      clearSubscribers: false
    }
  )
})

test('retargets a route-connected run when stream events reveal the real session', () => {
  assert.deepEqual(
    reconcileRunSession({
      trackedSessionId: 'active-chat',
      eventSessionId: 'background-chat',
      runningSessionIds: ['active-chat']
    }),
    {
      sessionId: 'background-chat',
      runningSessionIds: ['background-chat'],
      clearSubscribers: true
    }
  )
})

test('does not clear the old running session when another run still owns it', () => {
  assert.deepEqual(
    reconcileRunSession({
      trackedSessionId: 'active-chat',
      eventSessionId: 'background-chat',
      runningSessionIds: ['active-chat'],
      oldSessionStillRunning: true
    }),
    {
      sessionId: 'background-chat',
      runningSessionIds: ['active-chat', 'background-chat'],
      clearSubscribers: true
    }
  )
})

test('ignores events without a usable session id', () => {
  assert.deepEqual(
    reconcileRunSession({
      trackedSessionId: 'session-a',
      eventSessionId: null,
      runningSessionIds: ['session-a']
    }),
    {
      sessionId: 'session-a',
      runningSessionIds: ['session-a'],
      clearSubscribers: false
    }
  )
})
