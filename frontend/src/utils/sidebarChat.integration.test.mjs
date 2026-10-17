import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Children, isValidElement } from 'react'
import { createServer } from 'vite'

function findElements(element, predicate) {
  if (!isValidElement(element)) return []
  const matches = predicate(element) ? [element] : []
  Children.forEach(element.props.children, (child) => matches.push(...findElements(child, predicate)))
  return matches
}

test('sidebar Chat is enabled for every permitted user and preserves menu permissions', async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-sidebar-chat-'))
  const server = await createServer({
    plugins: [{ name: 'sidebar-badge-test-fixture', enforce: 'pre', transform(code, id) {
      if (id.endsWith('/src/components/DpomsSidebar.jsx')) return code.replace("import useMenuBadges from './useMenuBadges'", 'const useMenuBadges = () => ({ data: null, error: "" })')
    } }],
    cacheDir, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
  })
  try {
    const { default: Sidebar } = await server.ssrLoadModule('/src/components/DpomsSidebar.jsx')
    for (const userType of ['operator', 'officer', 'citizen', '']) {
      let selected = null
      let closed = false
      const tree = Sidebar({
        open: true, userType,
        permissions: { chat: { view: true }, dashboard: { view: true } },
        onSelect: (value) => { selected = value }, onClose: () => { closed = true },
      })
      const chat = findElements(tree, (element) => element.key === 'Chat')[0]
      assert.ok(chat)
      assert.ok(!chat.props.disabled)
      const labels = findElements(chat, (element) => typeof element.props.primary === 'string')
      assert.equal(labels[0].props.primary, 'Chat')
      chat.props.onClick()
      assert.equal(selected, 'chat')
      assert.equal(closed, true)
      const home = findElements(tree, (element) => element.key === 'หน้าหลัก')[0]
      assert.ok(!home.props.disabled)
      home.props.onClick()
      assert.equal(selected, 'home')
      assert.equal(closed, true)
    }
    const hidden = Sidebar({ open: true, userType: 'operator', permissions: { chat: { view: false } } })
    assert.equal(findElements(hidden, (element) => element.key === 'Chat').length, 0)
  } finally {
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
