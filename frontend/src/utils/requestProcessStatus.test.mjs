import assert from 'node:assert/strict'
import test from 'node:test'
import { isCancelledOrRejectedRequest } from './requestProcessStatus.mjs'

test('cancelled and rejected process guard recognizes API codes and legacy Thai labels', () => {
  for (const status of ['CANCELED', 'CANCELLED', 'REJECTED', 'ยกเลิก', 'ไม่อนุมัติ', 'ไม่ผ่านการพิจารณา']) {
    for (const field of ['statusCode', 'status', 'statusLabel']) {
      assert.equal(isCancelledOrRejectedRequest({ [field]: ` ${status} ` }), true, `${field}/${status}`)
    }
  }
  assert.equal(isCancelledOrRejectedRequest({ statusCode: 'rejected' }), true)
  for (const request of [undefined, null, {}, { statusCode: 'APPROVED' }, { status: 'รอพิจารณา' }]) {
    assert.equal(isCancelledOrRejectedRequest(request), false)
  }
})

test('canonical status codes override stale labels without granting other workflow permissions', () => {
  assert.equal(isCancelledOrRejectedRequest({ statusCode: 'CANCELED', status: 'รอพิจารณา' }), true)
  assert.equal(isCancelledOrRejectedRequest({ statusCode: 'REJECTED', statusLabel: 'รอพิจารณา' }), true)
  assert.equal(isCancelledOrRejectedRequest({ statusCode: 'CONNECTION_CONFIRMED', status: 'ยกเลิก' }), false)
  assert.equal(isCancelledOrRejectedRequest({ statusCode: ' ', statusLabel: 'ไม่อนุมัติ' }), true)
})
