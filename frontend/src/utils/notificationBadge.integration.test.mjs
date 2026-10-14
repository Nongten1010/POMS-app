import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createServer } from 'vite'

test('every notification submenu supports a today badge without changing its label', async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-notification-badge-'))
  const server = await createServer({
    cacheDir, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    plugins: [{ name: 'notification-test-exports', enforce: 'pre', transform(code, id) {
      if (id.endsWith('/src/pages/NotificationPage.jsx')) return `${code}\nexport { TabLabel, notificationGroups };`
    } }],
  })
  try {
    const { TabLabel, notificationGroups } = await server.ssrLoadModule('/src/pages/NotificationPage.jsx')
    const menus = notificationGroups.flatMap((group) => group.menus)
    assert.equal(menus.length, 10)
    for (const menu of menus) {
      const badge = TabLabel({ menu, count: 12 })
      assert.equal(badge.props.badgeContent, 12)
      for (const count of [0, undefined]) {
        const label = TabLabel({ menu, count })
        assert.equal(label?.props?.badgeContent, undefined)
        if (!menu.tabLabelLines) assert.equal(label, menu.label)
        else assert.equal(label.props.children.length, menu.tabLabelLines.length)
      }
    }
  } finally {
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
