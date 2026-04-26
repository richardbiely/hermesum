import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveSelectedWorkspace } from '../app/utils/workspaceSelection.ts'

const workspaces = [
  { id: 'alpha', label: 'Alpha', path: '/repo/alpha', active: false },
  { id: 'beta', label: 'Beta', path: '/repo/beta', active: false }
]

test('explicit no-workspace session clears persisted workspace selection', () => {
  assert.equal(resolveSelectedWorkspace({
    workspaces,
    preferredWorkspace: null,
    persistedWorkspace: '/repo/alpha',
    currentWorkspace: '/repo/beta'
  }), null)
})

test('new chat initialization can still restore persisted workspace', () => {
  assert.equal(resolveSelectedWorkspace({
    workspaces,
    preferredWorkspace: undefined,
    persistedWorkspace: '/repo/alpha',
    currentWorkspace: null
  }), '/repo/alpha')
})

test('session workspace takes precedence when present', () => {
  assert.equal(resolveSelectedWorkspace({
    workspaces,
    preferredWorkspace: '/repo/beta',
    persistedWorkspace: '/repo/alpha',
    currentWorkspace: null
  }), '/repo/beta')
})
