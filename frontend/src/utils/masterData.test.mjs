import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildFactoryDocumentPatch,
  canCancelFactoryEditRequest,
  getFactoryDocumentFileError,
  getFactoryEditRequestStatusLabel,
} from './masterData.mjs'

test('keeps cancelled and rejected factory edit requests distinct', () => {
  assert.equal(getFactoryEditRequestStatusLabel('CANCELLED', 'ยกเลิก'), 'ยกเลิก')
  assert.equal(getFactoryEditRequestStatusLabel('REJECTED', 'ไม่อนุมัติ'), 'ไม่อนุมัติ')
  assert.equal(getFactoryEditRequestStatusLabel('REVISED_PENDING_REVIEW', 'แก้ไขแล้ว รอพิจารณา'), 'แก้ไขแล้ว/รอพิจารณา')
})

test('allows cancellation only while a factory edit request is open', () => {
  assert.equal(canCancelFactoryEditRequest('PENDING_REVIEW'), true)
  assert.equal(canCancelFactoryEditRequest('REVISION_REQUESTED'), true)
  assert.equal(canCancelFactoryEditRequest('REVISED_PENDING_REVIEW'), true)
  assert.equal(canCancelFactoryEditRequest('APPROVED'), false)
  assert.equal(canCancelFactoryEditRequest('REJECTED'), false)
  assert.equal(canCancelFactoryEditRequest('CANCELLED'), false)
})

test('validates POMS factory document files', () => {
  assert.equal(getFactoryDocumentFileError({ name: 'factory.jpg', type: 'image/jpeg', size: 100 }), '')
  assert.equal(getFactoryDocumentFileError({ name: 'factory.pdf', type: 'application/pdf', size: 100 }), '')
  assert.match(getFactoryDocumentFileError({ name: 'factory.txt', type: 'text/plain', size: 100 }), /JPEG/)
  assert.match(getFactoryDocumentFileError({ name: 'factory.png', type: 'image/png', size: 0 }), /ไฟล์ว่าง/)
  assert.match(getFactoryDocumentFileError({ name: 'factory.png', type: 'image/png', size: 5 * 1024 * 1024 + 1 }), /5 MB/)
})

test('omits unchanged document fields and preserves explicit removals', () => {
  assert.deepEqual(buildFactoryDocumentPatch(), {})
  assert.deepEqual(buildFactoryDocumentPatch({ frontPhotosChanged: true, frontPhotos: [] }), {
    factoryFrontPhotos: [],
  })
  assert.deepEqual(buildFactoryDocumentPatch({ logoChanged: true, logo: null }), {
    factoryLogo: null,
  })
})
