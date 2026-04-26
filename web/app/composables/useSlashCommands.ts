import type { Ref } from 'vue'
import {
  exactSlashCommandMatch,
  filterSlashCommands,
  nextSlashCommandDismissedState
} from '~/utils/slashCommands'
import type { WebChatCommand } from '~/types/web-chat'

type SlashCommandOptions = {
  input: Ref<string>
}

export function useSlashCommands(options: SlashCommandOptions) {
  const api = useHermesApi()
  const commands = useState<WebChatCommand[]>('web-chat-slash-commands', () => [])
  const loading = useState('web-chat-slash-commands-loading', () => false)
  const loaded = useState('web-chat-slash-commands-loaded', () => false)
  const highlightedIndex = ref(0)
  const dismissed = ref(false)
  let loadingPromise: Promise<void> | null = null

  const query = computed(() => {
    const value = options.input.value
    if (!value.startsWith('/')) return null
    if (/\s/.test(value)) return null
    return value.slice(1).toLowerCase()
  })

  const isOpen = computed(() => query.value !== null && !dismissed.value && (loading.value || filteredCommands.value.length > 0))

  const filteredCommands = computed(() => filterSlashCommands(commands.value, options.input.value))

  async function loadCommands() {
    if (loaded.value) return
    if (loadingPromise) return loadingPromise

    loading.value = true
    loadingPromise = api.getCommands()
      .then((response) => {
        commands.value = response.commands
        loaded.value = true
      })
      .finally(() => {
        loading.value = false
        loadingPromise = null
      })

    return loadingPromise
  }

  watch(() => options.input.value, (value, previousValue) => {
    dismissed.value = nextSlashCommandDismissedState(previousValue, value, dismissed.value)
    if (query.value !== null) void loadCommands()
  }, { immediate: true })

  watch(filteredCommands, () => {
    highlightedIndex.value = 0
  })

  function moveHighlight(delta: number) {
    const count = filteredCommands.value.length
    if (!count) return
    highlightedIndex.value = (highlightedIndex.value + delta + count) % count
  }

  function highlightedCommand() {
    return filteredCommands.value[highlightedIndex.value] || null
  }

  function exactCommand(input: string) {
    return exactSlashCommandMatch(commands.value, input)
  }

  function close() {
    dismissed.value = true
    highlightedIndex.value = 0
  }

  return {
    commands,
    loading,
    query,
    isOpen,
    filteredCommands,
    highlightedIndex,
    highlightedCommand,
    exactCommand,
    moveHighlight,
    close,
    loadCommands
  }
}
