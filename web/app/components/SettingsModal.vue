<script setup lang="ts">
import type { DesktopNotificationPermission } from '~/utils/desktopNotifications'
import {
  desktopNotificationPermission,
  desktopNotificationsEnabled,
  desktopNotificationsSupported,
  requestDesktopNotificationPermission,
  setDesktopNotificationsEnabled
} from '~/utils/desktopNotifications'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const permission = ref<DesktopNotificationPermission>('unsupported')
const enabled = ref(false)
const pending = ref(false)

const supported = computed(() => permission.value !== 'unsupported')
const blocked = computed(() => permission.value === 'denied')
const enabledAndGranted = computed(() => enabled.value && permission.value === 'granted')
const statusLabel = computed(() => {
  if (!supported.value) return 'Not supported in this browser'
  if (blocked.value) return 'Blocked in browser settings'
  if (enabledAndGranted.value) return 'Enabled'
  if (permission.value === 'granted') return 'Disabled'
  return 'Not enabled'
})
const actionLabel = computed(() => {
  if (blocked.value) return 'Notifications blocked'
  if (enabledAndGranted.value) return 'Disable'
  if (permission.value === 'granted') return 'Enable'
  return 'Enable notifications'
})

function refreshState() {
  permission.value = desktopNotificationPermission()
  enabled.value = desktopNotificationsEnabled()
}

function waitForPermissionDecision() {
  return new Promise<void>((resolve) => {
    const started = Date.now()
    const check = () => {
      if (desktopNotificationPermission() !== 'default' || Date.now() - started > 10_000) {
        resolve()
        return
      }
      window.setTimeout(check, 250)
    }
    check()
  })
}

async function toggleNotifications() {
  if (pending.value || blocked.value || !desktopNotificationsSupported()) return

  if (permission.value === 'granted') {
    setDesktopNotificationsEnabled(!enabled.value)
    refreshState()
    return
  }

  pending.value = true
  try {
    await Promise.race([
      requestDesktopNotificationPermission(),
      waitForPermissionDecision()
    ])
    refreshState()
  } finally {
    pending.value = false
  }
}

function updateOpen(open: boolean) {
  emit('update:open', open)
}

watch(() => props.open, (open) => {
  if (open) refreshState()
})

onMounted(refreshState)
</script>

<template>
  <UModal
    :open="open"
    title="Settings"
    description="Configure local Hermes web preferences."
    @update:open="updateOpen"
  >
    <template #body>
      <div class="space-y-5">
        <section class="space-y-3">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 space-y-1">
              <h3 class="text-sm font-medium text-highlighted">
                Desktop notifications
              </h3>
              <p class="text-sm text-muted">
                Notify when a chat finishes while this browser window is hidden or unfocused.
              </p>
            </div>

            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
              class="shrink-0"
            >
              {{ statusLabel }}
            </UBadge>
          </div>

          <UAlert
            v-if="blocked"
            color="warning"
            variant="subtle"
            title="Notifications are blocked"
            description="Enable notifications for this site in your browser or macOS settings, then reopen this modal."
          />

          <UAlert
            v-else-if="!supported"
            color="neutral"
            variant="subtle"
            title="Notifications are not supported"
            description="This browser does not expose desktop notifications to the web app."
          />

          <div class="flex justify-end">
            <UButton
              color="neutral"
              variant="soft"
              :label="actionLabel"
              :loading="pending"
              :disabled="blocked || !supported"
              @click="toggleNotifications"
            />
          </div>
        </section>
      </div>
    </template>
  </UModal>
</template>
