export function useChatRouteState() {
  const route = useRoute()
  const sessionId = computed(() => String(route.params.id))

  return {
    route,
    sessionId,
  }
}
