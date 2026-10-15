import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fetchMenuBadges, menuBadgeKeys } from './menuBadges.mjs'

const data = Object.fromEntries(menuBadgeKeys.map((key) => [key, key === 'connection']))
test('loads all six booleans with authenticated no-store request', async () => {
  const controller = new AbortController()
  const actual = await fetchMenuBadges({ url: '/api/v1/me/menu-badges', accessToken: 'test-token', signal: controller.signal,
    fetchImpl: async (url, options) => {
      assert.equal(url, '/api/v1/me/menu-badges')
      assert.equal(options.headers.Authorization, 'Bearer test-token')
      assert.equal(options.cache, 'no-store')
      assert.equal(options.signal, controller.signal)
      return Response.json({ success: true, data })
    } })
  assert.deepEqual(actual, data)
})

test('rejects missing or nonboolean data instead of treating failures as no work', async () => {
  for (const response of [{ success: false, data }, { success: true, data: {} }, { success: true, data: { ...data, connection: 1 } }]) {
    await assert.rejects(fetchMenuBadges({ url: '/', accessToken: 'test-token', fetchImpl: async () => Response.json(response) }))
  }
})

test('handles authentication, server and network failures', async () => {
  for (const status of [401, 500]) {
    await assert.rejects(fetchMenuBadges({ url: '/', accessToken: 'test-token', fetchImpl: async () => new Response('', { status }) }))
  }
  await assert.rejects(fetchMenuBadges({ url: '/', accessToken: 'test-token', fetchImpl: async () => { throw new TypeError('Failed to fetch') } }))
})

test('supports text rate-limit responses and Retry-After', async () => {
  const before = Date.now()
  await assert.rejects(fetchMenuBadges({ url: '/', accessToken: 'test-token',
    fetchImpl: async () => new Response('Too many requests', { status: 429, headers: { 'Retry-After': '120' } }) }),
  (error) => error.retryAt >= before + 120000)
})

test('manual refresh has no polling, visibility, or workflow triggers and isolates accounts', () => {
  const hook = readFileSync(new URL('../components/useMenuBadges.js', import.meta.url), 'utf8')
  assert.doesNotMatch(hook, /setInterval|setTimeout|visibilitychange|addEventListener/)
  assert.match(hook, /activeRequest.current\?\.abort/)
  assert.match(hook, /Date.now\(\) < retryAt.current/)
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
  assert.match(app, /key=\{accessToken \|\| 'anonymous'\}/)
})
