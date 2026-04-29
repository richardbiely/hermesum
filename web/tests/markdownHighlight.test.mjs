import assert from 'node:assert/strict'
import test from 'node:test'

import { createMarkdownHighlightPlugin } from '../app/utils/markdownHighlight.ts'

function vueCodeTree() {
  return {
    nodes: [
      ['pre', { language: 'vue' }, ['code', { class: 'language-vue' }, '<template><div>{{ msg }}</div></template>\n']]
    ]
  }
}

test('highlights Vue code blocks with Shiki token styles', async () => {
  const state = { tree: vueCodeTree() }

  await createMarkdownHighlightPlugin().post(state)

  const output = JSON.stringify(state.tree)
  assert.match(output, /"class":"shiki[^"]*"/)
  assert.match(output, /color:#/)
  assert.match(output, /template/)
})
