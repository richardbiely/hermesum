export type DesktopNotificationPermission = NotificationPermission | 'unsupported'

export type RunFinishedNotificationStatus = 'completed' | 'failed'

type RunFinishedNotificationOptions = {
  sessionId: string
  runId: string
  status: RunFinishedNotificationStatus
  responsePreview?: string
  chatTitle?: string
  onClick?: (sessionId: string) => void
}

const preferenceKey = 'hermes.desktopNotifications.enabled'
const maxNotificationBodyLength = 180

function isClient() {
  return typeof window !== 'undefined'
}

function notificationApi() {
  if (!isClient() || !('Notification' in window)) return undefined
  return window.Notification
}

export function desktopNotificationsSupported() {
  return Boolean(notificationApi())
}

export function desktopNotificationPermission(): DesktopNotificationPermission {
  const api = notificationApi()
  if (!api) return 'unsupported'
  return api.permission
}

export function desktopNotificationsEnabled() {
  if (!isClient()) return false
  return window.localStorage.getItem(preferenceKey) === 'true'
}

export function setDesktopNotificationsEnabled(enabled: boolean) {
  if (!isClient()) return
  window.localStorage.setItem(preferenceKey, enabled ? 'true' : 'false')
}

export async function requestDesktopNotificationPermission() {
  const api = notificationApi()
  if (!api) return 'unsupported'

  const permission = await api.requestPermission()
  setDesktopNotificationsEnabled(permission === 'granted')
  return permission
}

export function shouldShowDesktopNotification() {
  if (!desktopNotificationsEnabled()) return false
  if (desktopNotificationPermission() !== 'granted') return false
  return document.hidden || !document.hasFocus()
}

export function notificationBodyPreview(content?: string | null) {
  const normalized = content?.replace(/\s+/g, ' ').trim()
  if (!normalized) return undefined
  if (normalized.length <= maxNotificationBodyLength) return normalized
  return `${normalized.slice(0, maxNotificationBodyLength - 1).trimEnd()}…`
}

export function showRunFinishedDesktopNotification(options: RunFinishedNotificationOptions) {
  const api = notificationApi()
  if (!api || !shouldShowDesktopNotification()) return false

  const failed = options.status === 'failed'
  const notification = new api(failed ? 'Reply failed' : 'Reply ready', {
    body: notificationBodyPreview(options.responsePreview) || notificationBodyPreview(options.chatTitle) || 'Untitled chat',
    tag: `hermes-run-${options.runId}`,
    silent: false
  })

  notification.onclick = () => {
    window.focus()
    if (options.onClick) {
      options.onClick(options.sessionId)
    } else if (window.location.pathname !== `/chat/${options.sessionId}`) {
      window.location.assign(`/chat/${options.sessionId}`)
    }
    notification.close()
  }

  return true
}
