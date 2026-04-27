import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadingChatSkeletonCount } from '../app/utils/chatLoadingState.ts'

test('keeps a stable minimum number of chat loading rows', () => {
  assert.equal(loadingChatSkeletonCount(0), 3)
  assert.equal(loadingChatSkeletonCount(1), 3)
})

test('uses the previous message count for chat switch skeletons within a small cap', () => {
  assert.equal(loadingChatSkeletonCount(5), 5)
  assert.equal(loadingChatSkeletonCount(20), 8)
})
