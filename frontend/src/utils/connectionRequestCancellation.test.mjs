import assert from 'node:assert/strict'
import test from 'node:test'
import { canCancelConnectionRequest } from './connectionRequestCancellation.mjs'

test('operators can cancel at every unfinished connection-request stage', () => {
  for (const status of [
    'PENDING_DESIGN_REVIEW', 'WAITING_FACTORY_REVISION', 'REVISED_PENDING_DESIGN_REVIEW',
    'WAITING_CONNECTION', 'CONNECTION_CONFIRMED', 'WAITING_FACTORY_DEVICE_CONFIG',
    'WAITING_FACTORY_DEVICE_CONFIGURATION', 'WAITING_DEVICE_CONFIG',
    'รอพิจารณาแบบ', 'รอโรงงานแก้ไข', 'แก้ไขแล้ว/รอพิจารณาแบบ',
    'รอเชื่อมต่อ', 'ยืนยันการเชื่อมต่อ', 'รอโรงงานตั้งค่าอุปกรณ์',
  ]) {
    for (const field of ['statusCode', 'status', 'statusLabel']) {
      assert.equal(canCancelConnectionRequest({ [field]: status }), true, status)
    }
  }
})

test('completed and cancelled requests cannot be cancelled with any status representation', () => {
  for (const status of ['CONNECTED', 'APPROVED', 'CANCELED', 'CANCELLED', 'เชื่อมต่อแล้ว', 'ผ่านการพิจารณา', 'ยกเลิก']) {
    for (const field of ['statusCode', 'status', 'statusLabel']) {
      assert.equal(canCancelConnectionRequest({ [field]: status }), false, status)
    }
  }
  assert.equal(canCancelConnectionRequest({ statusCode: ' connected ' }), false)
  assert.equal(canCancelConnectionRequest({ statusCode: 'CONNECTED', statusLabel: 'รอโรงงานแก้ไข' }), false)
  assert.equal(canCancelConnectionRequest({ statusCode: 'WAITING_CONNECTION', statusLabel: 'ยกเลิก' }), false)
})

test('missing request status does not enable cancellation', () => {
  for (const row of [null, undefined, {}, { status: null }, { statusCode: ' ' }]) {
    assert.equal(canCancelConnectionRequest(row), false)
  }
})
