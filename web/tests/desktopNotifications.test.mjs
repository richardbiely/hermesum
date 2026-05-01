import assert from 'node:assert/strict'
import { test } from 'node:test'
import { notificationBodyPreview, showRunFinishedDesktopNotification } from '../app/utils/desktopNotifications.ts'

function installNotificationWindow({ hidden = true, hasFocus = false, pathname = '/' } = {}) {
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const notifications = []

  class TestNotification {
    static permission = 'granted'

    constructor(title, options) {
      this.title = title
      this.options = options
      this.closed = false
      this.onclick = null
      notifications.push(this)
    }

    close() {
      this.closed = true
    }
  }

  const assigned = []
  globalThis.window = {
    Notification: TestNotification,
    localStorage: { getItem: () => 'true' },
    focus: () => {},
    location: {
      pathname,
      assign: value => assigned.push(value)
    }
  }
  globalThis.document = {
    hidden,
    hasFocus: () => hasFocus
  }

  return {
    notifications,
    assigned,
    restore() {
      globalThis.window = previousWindow
      globalThis.document = previousDocument
    }
  }
}

test('desktop notification click uses SPA callback instead of reloading the page', () => {
  const env = installNotificationWindow()
  const opened = []

  try {
    assert.equal(showRunFinishedDesktopNotification({
      sessionId: 'session-1',
      runId: 'run-1',
      status: 'completed',
      responsePreview: 'I updated the Hermes notification text.',
      chatTitle: 'Improve macOS notifications',
      onClick: sessionId => opened.push(sessionId)
    }), true)

    env.notifications[0].onclick()

    assert.equal(env.notifications[0].title, 'Reply ready')
    assert.equal(env.notifications[0].options.body, 'I updated the Hermes notification text.')
    assert.deepEqual(opened, ['session-1'])
    assert.deepEqual(env.assigned, [])
    assert.equal(env.notifications[0].closed, true)
  } finally {
    env.restore()
  }
})

test('desktop notification body normalizes and truncates chat title', () => {
  const longContent = `  ${'word '.repeat(60)}  `
  const preview = notificationBodyPreview(longContent)

  assert.equal(notificationBodyPreview(' First\n\nsecond\tline '), 'First second line')
  assert.equal(preview.length, 180)
  assert.equal(preview.endsWith('…'), true)
})

test('desktop notification falls back to chat title when response preview is unavailable', () => {
  const env = installNotificationWindow()

  try {
    assert.equal(showRunFinishedDesktopNotification({
      sessionId: 'session-1',
      runId: 'run-1',
      status: 'completed',
      responsePreview: '   ',
      chatTitle: 'Improve macOS notifications'
    }), true)

    assert.equal(env.notifications[0].options.body, 'Improve macOS notifications')
  } finally {
    env.restore()
  }
})

test('desktop notification falls back to untitled chat when no title is available', () => {
  const env = installNotificationWindow()

  try {
    assert.equal(showRunFinishedDesktopNotification({
      sessionId: 'session-1',
      runId: 'run-1',
      status: 'failed'
    }), true)

    assert.equal(env.notifications[0].title, 'Reply failed')
    assert.equal(env.notifications[0].options.body, 'Untitled chat')
  } finally {
    env.restore()
  }
})

test('desktop notification fallback avoids reloading when already on the chat route', () => {
  const env = installNotificationWindow({ pathname: '/chat/session-1' })

  try {
    assert.equal(showRunFinishedDesktopNotification({
      sessionId: 'session-1',
      runId: 'run-1',
      status: 'completed'
    }), true)

    env.notifications[0].onclick()

    assert.deepEqual(env.assigned, [])
    assert.equal(env.notifications[0].closed, true)
  } finally {
    env.restore()
  }
})
