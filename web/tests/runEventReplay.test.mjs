import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRunEventReplay } from '../app/utils/runEventReplay.ts'

test('replays prompt events that arrive before a subscriber is attached', () => {
  const replay = createRunEventReplay()
  const prompt = { id: 'prompt-1', kind: 'approval', status: 'pending' }

  replay.record('onPromptRequested', prompt)

  const received = []
  replay.replay({
    onPromptRequested: value => received.push(value)
  })

  assert.deepEqual(received, [prompt])
})

test('replays live process events needed after route resubscribe', () => {
  const replay = createRunEventReplay()
  replay.record('onReasoningDelta', 'Thinking')
  replay.record('onToolStarted', { name: 'terminal', input: { command: 'pnpm typecheck' } })
  replay.record('onToolCompleted', { name: 'terminal' })
  replay.record('onDelta', 'Done')

  const received = []
  replay.replay({
    onReasoningDelta: value => received.push(['reasoning', value]),
    onToolStarted: value => received.push(['started', value.name, value.input.command]),
    onToolCompleted: value => received.push(['completed', value.name]),
    onDelta: value => received.push(['delta', value])
  })

  assert.deepEqual(received, [
    ['reasoning', 'Thinking'],
    ['started', 'terminal', 'pnpm typecheck'],
    ['completed', 'terminal'],
    ['delta', 'Done']
  ])
})
