import type { Ref } from 'vue'
import type { SessionDetailResponse } from '~/types/web-chat'

function pathBaseName(path?: string | null) {
  if (!path) return null
  return path.split(/[\\/]+/).filter(Boolean).at(-1) || path
}

type ChatHeaderStateOptions = {
  displayedData: Ref<SessionDetailResponse | null | undefined>
  isLoadingSession: Ref<boolean>
  sessionError: Ref<unknown>
  hasSession: Ref<boolean>
  activeChatRuns: ReturnType<typeof useActiveChatRuns>
}

export function useChatHeaderState({
  displayedData,
  isLoadingSession,
  sessionError,
  hasSession,
  activeChatRuns
}: ChatHeaderStateOptions) {
  const title = computed(() => {
    if (isLoadingSession.value) return 'Loading chat…'
    if (sessionError.value || !hasSession.value) return 'Chat unavailable'
    const session = displayedData.value?.session
    return session?.title || session?.preview || 'Chat'
  })

  const workspaceStatus = computed(() => {
    const workspace = displayedData.value?.isolatedWorkspace
    if (!workspace || workspace.status !== 'active') return null

    const sourceName = pathBaseName(workspace.sourceWorkspace)
    const branchName = workspace.branchName.split('/').at(-1)
    return {
      label: sourceName ? `${sourceName} · worktree` : 'Worktree',
      detail: `${workspace.worktreePath}${branchName ? `\n${branchName}` : ''}`
    }
  })

  watch(
    () => displayedData.value?.session,
    (session) => {
      if (!session) return
      activeChatRuns.setSessionTitle(session.id, session.title || session.preview)
    },
    { immediate: true }
  )

  return {
    title,
    workspaceStatus
  }
}
