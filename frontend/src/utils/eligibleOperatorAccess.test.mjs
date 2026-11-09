import test from 'node:test'
import assert from 'node:assert/strict'
import { canGrantOperatorAccess, createEligibleOperatorAccessApi, isAccessAdministrator, maskCitizenId, optionalAccessReason } from './eligibleOperatorAccess.mjs'

test('only admin can manage and granting requires a freshly confirmed status/capability', () => {
  assert.equal(isAccessAdministrator('admin'), true)
  assert.equal(isAccessAdministrator('officer', ['admin']), true)
  assert.equal(isAccessAdministrator('officer', ['director']), false)
  assert.equal(isAccessAdministrator('operator'), false)
  const factory = { eligibleFactoryId: 8, operationStatus: 'ยังไม่แจ้งประกอบ' }
  assert.equal(canGrantOperatorAccess(factory, null), false)
  assert.equal(canGrantOperatorAccess(factory, { factory: { operationStatus: 'ยังไม่แจ้งประกอบ' }, capabilities: { canGrant: true } }), true)
  for (const status of ['แจ้งประกอบแล้ว', 'หยุดชั่วคราว', 'จำหน่ายทะเบียน', '']) {
    assert.equal(canGrantOperatorAccess(factory, { factory: { operationStatus: status }, capabilities: { canGrant: true } }), false)
  }
})

test('reasons are optional; IDs are always masked', () => {
  assert.deepEqual(optionalAccessReason('  '), {})
  assert.deepEqual(optionalAccessReason(' ทดสอบ '), { reason: 'ทดสอบ' })
  assert.equal(maskCitizenId('1234567890123'), '*********0123')
  assert.equal(maskCitizenId('*********0123'), '*********0123')
  assert.equal(maskCitizenId(null), '-')
})

test('unconfirmed API is disabled by default without network requests', async () => {
  let called = false
  const api = createEligibleOperatorAccessApi({ accessToken: 'test', fetchImpl: async () => { called = true } })
  await assert.rejects(api.list(8), /ยังไม่เปิดให้บริการ/)
  await assert.rejects(api.grant(8, 9, ''), /ยังไม่เปิดให้บริการ/)
  assert.equal(called, false)
})

test('adapter sends eligible IDs, optional reasons, authentication and search cancellation', async () => {
  const requests = []
  const api = createEligibleOperatorAccessApi({ accessToken: 'test', enabled: true, isDevelopment: true, fetchImpl: async (url, options) => {
    requests.push({ url, ...options })
    return Response.json({ success: true, data: { items: [], history: [], factory: {}, capabilities: {} } })
  } })
  await api.grant(8, 9, '')
  assert.equal(requests[0].url, '/api-proxy/v1/eligible-factories/8/operator-access')
  assert.deepEqual(JSON.parse(requests[0].body), { userId: 9 })
  assert.equal(requests[0].headers.Authorization, 'Bearer test')
  await api.revoke(8, 10, ' เหตุผล ')
  assert.deepEqual(JSON.parse(requests[1].body), { reason: 'เหตุผล' })
  const signal = new AbortController().signal
  await api.search(8, 'ก ข', signal)
  assert.equal(requests[2].signal, signal)
  assert.ok(requests[2].url.endsWith(encodeURIComponent('ก ข')))
})

test('never treats empty or non-JSON responses as successful saves', async () => {
  for (const response of [new Response('', { status: 200 }), Response.json({ success: false }), new Response('', { status: 409 })]) {
    const api = createEligibleOperatorAccessApi({ enabled: true, fetchImpl: async () => response })
    await assert.rejects(api.grant(8, 9, ''))
  }
})
