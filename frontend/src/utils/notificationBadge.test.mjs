import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchTodayNotificationCount, getThaiToday } from './notificationBadge.mjs'

test('today follows the Thai calendar date at UTC midnight boundaries', () => {
  assert.equal(getThaiToday(new Date('2026-10-13T16:59:59Z')), '2026-10-13')
  assert.equal(getThaiToday(new Date('2026-10-13T17:00:00Z')), '2026-10-14')
  assert.equal(getThaiToday(new Date('2026-12-31T17:00:00Z')), '2027-01-01')
})

const options = {
  apiBaseUrl: '/api/v1/alert-events', accessToken: 'test-token', date: '2026-10-14',
  query: { systemType: 'WPMS', displaySystemType: 'BOD_COD_ONLINE', alertType: 'EIA_EXCEEDED', thresholdType: 'EIA' },
}
const response = (data) => Response.json({ success: true, data })

test('counts all pages and preserves category and event-date filters', async () => {
  const requests = []
  const count = await fetchTodayNotificationCount({
    ...options,
    fetchImpl: async (url, request) => {
      const params = new URL(url, 'https://example.test').searchParams
      for (const [key, value] of Object.entries(options.query)) assert.equal(params.get(key), value)
      assert.equal(params.get('dateFrom'), options.date)
      assert.equal(params.get('dateTo'), options.date)
      assert.equal(params.get('pageSize'), '100')
      assert.equal(request.headers.Authorization, 'Bearer test-token')
      const page = Number(params.get('page'))
      requests.push(page)
      return response(Array.from({ length: page === 1 ? 100 : 7 }, (_, i) => ({
        id: page * 100 + i, eventDate: options.date, createdAt: '2026-10-15T00:00:00Z',
      })))
    },
  })
  assert.equal(count, 107)
  assert.deepEqual(requests, [1, 2])
})

test('empty results return zero and exact page-size results fetch the final empty page', async () => {
  assert.equal(await fetchTodayNotificationCount({ ...options, fetchImpl: async () => response([]) }), 0)
  let requests = 0
  assert.equal(await fetchTodayNotificationCount({
    ...options, fetchImpl: async () => response(++requests === 1 ? Array.from({ length: 100 }, (_, id) => ({ id })) : []),
  }), 100)
  assert.equal(requests, 2)
})

test('failed or malformed responses never become a misleading zero count', async () => {
  for (const result of [Response.json({ success: false }, { status: 403 }), response(null), new Response('not-json')]) {
    await assert.rejects(fetchTodayNotificationCount({ ...options, fetchImpl: async () => result }))
  }
})

test('pagination stops on repeated pages or cancellation', async () => {
  const rows = Array.from({ length: 100 }, (_, id) => ({ id }))
  await assert.rejects(fetchTodayNotificationCount({ ...options, fetchImpl: async () => response(rows) }), /same page/)
  const controller = new AbortController()
  controller.abort()
  let called = false
  await assert.rejects(fetchTodayNotificationCount({
    ...options, signal: controller.signal, fetchImpl: async () => { called = true; return response([]) },
  }), { name: 'AbortError' })
  assert.equal(called, false)
})
