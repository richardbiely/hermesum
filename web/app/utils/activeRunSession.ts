type ReconcileRunSessionOptions = {
  trackedSessionId: string
  eventSessionId: unknown
  runningSessionIds: string[]
  oldSessionStillRunning?: boolean
}

type ReconciledRunSession = {
  sessionId: string
  runningSessionIds: string[]
  clearSubscribers: boolean
}

export function reconcileRunSession(options: ReconcileRunSessionOptions): ReconciledRunSession {
  const eventSessionId = typeof options.eventSessionId === 'string' ? options.eventSessionId : ''
  if (!eventSessionId || eventSessionId === options.trackedSessionId) {
    return {
      sessionId: options.trackedSessionId,
      runningSessionIds: options.runningSessionIds,
      clearSubscribers: false
    }
  }

  const withoutOld = options.oldSessionStillRunning
    ? options.runningSessionIds
    : options.runningSessionIds.filter(sessionId => sessionId !== options.trackedSessionId)
  const runningSessionIds = withoutOld.includes(eventSessionId)
    ? withoutOld
    : [...withoutOld, eventSessionId]

  return {
    sessionId: eventSessionId,
    runningSessionIds,
    clearSubscribers: true
  }
}
