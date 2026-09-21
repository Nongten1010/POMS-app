import assert from 'node:assert/strict'
import test from 'node:test'
import { cancelBodCodReport, readBodCodApiResponse } from './bodCodReportApi.js'

test('cancel uses the documented route and bearer token without a request body', async () => {
  const calls = []
  const data = { id: 9, reportNo: 'E-01-0001/2569', reportSequenceNo: 3, statusCode: 'CANCELLED', currentStep: null, allowedActions: [] }
  const result = await cancelBodCodReport(9, 'test-token', async (url, init) => {
    calls.push({ url, init })
    return Response.json({ success: true, data })
  })
  assert.deepEqual(result, data)
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /\/bod-cod-deviation-reports\/9\/cancel$/)
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token')
  assert.equal(Object.hasOwn(calls[0].init, 'body'), false)
  assert.equal(Object.hasOwn(calls[0].init.headers, 'Content-Type'), false)
})

test('structured API errors preserve status, code and conflict reason for UI recovery', async () => {
  for (const reason of ['REPORT_PERIOD_CLOSED', 'PENDING_REPORT_EXISTS']) {
    const response = Response.json({ success: false, error: { code: 'CONFLICT', message: reason, details: { reason } } }, { status: 409 })
    await assert.rejects(readBodCodApiResponse(response, 'fallback'), (error) => {
      assert.equal(error.status, 409)
      assert.equal(error.code, 'CONFLICT')
      assert.equal(error.details.reason, reason)
      return true
    })
  }
})

test('failed or ambiguous cancellation never retries POST automatically or reports success', async () => {
  for (const status of [401, 403, 404, 409, 500]) {
    let calls = 0
    await assert.rejects(cancelBodCodReport(9, 'test', async () => {
      calls += 1
      return Response.json({ success: false, error: { code: 'FAIL', message: 'denied' } }, { status })
    }), (error) => error.status === status)
    assert.equal(calls, 1)
  }
  let calls = 0
  await assert.rejects(cancelBodCodReport(9, 'test', async () => { calls += 1; throw new TypeError('Failed to fetch') }), /Failed to fetch/)
  assert.equal(calls, 1)
  for (const data of [null, { id: 10, statusCode: 'CANCELLED' }, { id: 9, statusCode: 'APPROVED' }]) {
    await assert.rejects(cancelBodCodReport(9, 'test', async () => Response.json({ success: true, data })), /ไม่พบผลยืนยัน/)
  }
})

test('invalid identity or missing token cannot issue cancellation requests', async () => {
  const fetchImpl = () => assert.fail('must not call API')
  for (const id of [null, '', 0, -1, 'draft-9', 1.5]) await assert.rejects(cancelBodCodReport(id, 'test', fetchImpl), /รหัสคำขอ/)
  await assert.rejects(cancelBodCodReport(9, '', fetchImpl), /เข้าสู่ระบบ/)
})

test('HTML/proxy errors and malformed success responses cannot silently succeed', async () => {
  await assert.rejects(readBodCodApiResponse(new Response('<html>Bad gateway</html>', { status: 502 }), 'โหลดไม่สำเร็จ'), (error) => error.status === 502)
  await assert.rejects(readBodCodApiResponse(new Response(''), 'โหลดไม่สำเร็จ'), /รูปแบบข้อมูล/)
})
