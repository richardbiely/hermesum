import assert from 'node:assert/strict'
import { test } from 'node:test'
import { notificationSoundVariant } from '../app/utils/notificationSound.ts'

test('uses the subtle sound only when the active chat latest content is visible', () => {
  assert.equal(notificationSoundVariant({ activeVisibleChat: true, latestContentVisible: true }), 'default')
})

test('uses the attention sound when active chat is scrolled away from latest content', () => {
  assert.equal(notificationSoundVariant({ activeVisibleChat: true, latestContentVisible: false }), 'attention')
})

test('uses the attention sound outside the active visible chat', () => {
  assert.equal(notificationSoundVariant({ activeVisibleChat: false, latestContentVisible: true }), 'attention')
})
