import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildFactoryBasicInfoPayload,
  buildFactoryEditableProfilePatch,
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

test('builds a strict basic-info patch without read-only fields', () => {
  assert.deepEqual(buildFactoryBasicInfoPayload({
    initial: {
      factoryName: 'โรงงานเดิม',
      address: 'ที่อยู่เดิม',
      eia: 'ไม่มี',
      projectName: null,
      latitude: 13.5,
      longitude: 100.5,
    },
    values: {
      factoryName: 'ชื่อที่ห้ามส่ง',
      address: 'ที่อยู่ที่ห้ามส่ง',
      eia: 'มี EIA',
      projectName: 'โครงการใหม่',
      latitude: '13.5',
      longitude: '100.5',
    },
  }), {
    formType: 'BASIC_INFO',
    eia: 'มี EIA',
    projectName: 'โครงการใหม่',
  })
})

test('validates other EIA, coordinate pairs, ranges, and unchanged forms', () => {
  assert.throws(() => buildFactoryBasicInfoPayload({
    initial: { eia: 'ไม่มี' },
    values: { eia: 'อื่นๆ', eiaOther: '', latitude: '', longitude: '' },
  }), /กรุณาระบุข้อมูลอื่นๆ/)
  assert.throws(() => buildFactoryBasicInfoPayload({
    initial: { eia: 'ไม่มี' },
    values: { eia: 'ไม่มี', latitude: '13.5', longitude: '' },
  }), /ครบทั้งสองช่อง/)
  assert.throws(() => buildFactoryBasicInfoPayload({
    initial: { eia: 'ไม่มี' },
    values: { eia: 'ไม่มี', latitude: '91', longitude: '100' },
  }), /-90 ถึง 90/)
  assert.throws(() => buildFactoryBasicInfoPayload({
    initial: { eia: 'ไม่มี', latitude: 13.5, longitude: 100.5 },
    values: { eia: 'ไม่มี', latitude: '13.5', longitude: '100.5' },
  }), /อย่างน้อย 1 รายการ/)
})

test('keeps project names independent from EIA and preserves resubmission values', () => {
  assert.deepEqual(buildFactoryBasicInfoPayload({
    initial: { eia: 'มี EIA', projectName: 'โครงการเดิม', latitude: 13, longitude: 100 },
    values: { eia: 'ไม่มี', projectName: 'โครงการเดิม', latitude: '13', longitude: '100' },
  }), {
    formType: 'BASIC_INFO',
    eia: 'ไม่มี',
  })

  assert.deepEqual(buildFactoryBasicInfoPayload({
    initial: { eia: 'อื่นๆ', eiaOther: 'เดิม', projectName: 'โครงการ', latitude: 13, longitude: 100 },
    values: { eia: 'อื่นๆ', eiaOther: 'แก้ไข', projectName: 'โครงการ', latitude: '13', longitude: '100' },
    documentPatch: { factoryFrontPhotos: [{ title: 'ภาพ', fileUrl: 'https://example.com/a.jpg' }] },
    isResubmission: true,
  }), {
    formType: 'BASIC_INFO',
    eia: 'อื่นๆ',
    eiaOther: 'แก้ไข',
    projectName: 'โครงการ',
    latitude: 13,
    longitude: 100,
    factoryFrontPhotos: [{ title: 'ภาพ', fileUrl: 'https://example.com/a.jpg' }],
  })
})

test('builds an optional factory profile patch for a measurement-point request', () => {
  assert.deepEqual(buildFactoryEditableProfilePatch({
    initial: { eia: 'ไม่มี', projectName: null, latitude: 13, longitude: 100 },
    values: { eia: 'ไม่มี', projectName: null, latitude: '13', longitude: '100' },
    requireChange: false,
  }), {})

  assert.deepEqual(buildFactoryEditableProfilePatch({
    initial: { eia: 'ไม่มี', projectName: null, latitude: 13, longitude: 100 },
    values: { eia: 'ไม่มี', projectName: 'โครงการใหม่', latitude: '13', longitude: '100' },
    documentPatch: { factoryLogo: null },
    requireChange: false,
  }), {
    projectName: 'โครงการใหม่',
    factoryLogo: null,
  })
})
