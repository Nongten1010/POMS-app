import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildFactoryBasicInfoPayload,
  buildFactoryEditableProfilePatch,
  buildFactoryDocumentPatch,
  buildFactoryEditReviewPayload,
  buildStatusManagementPayload,
  canCancelFactoryEditRequest,
  formatFactoryEditRequestDate,
  getChangedFactoryGeneralInfoFieldNames,
  getFactoryDocumentFileError,
  getFactoryEditRequestStatusLabel,
  getLatestFactoryRevisionMessage,
  getStatusManagementSelection,
  getPomsDisplayStatus,
  normalizeOfficerNotificationEmails,
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

test('formats factory edit request timestamps as Thai dates without time', () => {
  assert.equal(formatFactoryEditRequestDate('2026-08-24T02:00:00.000Z'), '24/08/2569')
  assert.equal(formatFactoryEditRequestDate('27/08/2569 10:30'), '27/08/2569')
  assert.equal(formatFactoryEditRequestDate(null), '-')
})

test('builds factory edit review payloads and requires a revision reason', () => {
  assert.deepEqual(buildFactoryEditReviewPayload('REQUEST_REVISION', {
    revisionReason: '  กรุณาแก้ไขข้อมูลจุดตรวจวัด  ',
  }), {
    decision: 'REQUEST_REVISION',
    revisionReason: 'กรุณาแก้ไขข้อมูลจุดตรวจวัด',
    officerNote: null,
  })
  assert.deepEqual(buildFactoryEditReviewPayload('REJECT'), {
    decision: 'REJECT',
    revisionReason: null,
    officerNote: 'ไม่อนุมัติ',
  })
  assert.throws(() => buildFactoryEditReviewPayload('REQUEST_REVISION'), /กรุณากรอกเหตุผล/)
})

test('finds changed editable factory fields for the review comparison', () => {
  assert.deepEqual(getChangedFactoryGeneralInfoFieldNames({
    currentFactory: {
      eia: 'ไม่มี',
      projectName: 'โครงการเดิม',
      latitude: 13.5,
      longitude: 100.5,
      factoryFrontPhotos: [{ id: 1, fileUrl: 'https://example.com/front.jpg' }],
      factoryLogo: null,
    },
    proposedFactory: {
      eia: 'มี EIA',
      projectName: 'โครงการใหม่',
      latitude: '13.5',
      longitude: 100.5,
      factoryFrontPhotos: [{ id: 99, fileUrl: 'https://example.com/front.jpg' }],
      factoryLogo: { fileUrl: 'https://example.com/logo.png' },
    },
  }), ['eia', 'projectName', 'factoryLogo'])
})

test('does not mark factory fields omitted from a sparse proposed patch', () => {
  assert.deepEqual(getChangedFactoryGeneralInfoFieldNames({
    currentFactory: { eia: 'ไม่มี', projectName: 'โครงการเดิม' },
    proposedFactory: { projectName: 'โครงการใหม่' },
  }), ['projectName'])
})

test('reads the latest factory revision reason from direct fields and events', () => {
  assert.equal(getLatestFactoryRevisionMessage({ revisionReason: 'แก้ไขพิกัด' }), 'แก้ไขพิกัด')
  assert.equal(getLatestFactoryRevisionMessage({
    events: [
      { id: 1, action: 'REQUEST_REVISION', note: 'แก้ไขข้อมูลเก่า', createdAt: '2026-09-10T00:00:00Z' },
      { id: 2, action: 'REQUEST_REVISION', note: 'แก้ไขข้อมูลล่าสุด', createdAt: '2026-09-11T00:00:00Z' },
    ],
  }), 'แก้ไขข้อมูลล่าสุด')
})

test('normalizes and validates officer notification emails', () => {
  assert.deepEqual(normalizeOfficerNotificationEmails([
    ' Officer@Example.go.th ',
    'officer@example.go.th',
    '',
  ]), ['officer@example.go.th'])
  assert.deepEqual(normalizeOfficerNotificationEmails([]), [])
  assert.throws(() => normalizeOfficerNotificationEmails(['invalid']), /ไม่ถูกต้อง/)
  assert.throws(() => normalizeOfficerNotificationEmails([`${'a'.repeat(243)}@example.go.th`]), /254 ตัวอักษร/)
  assert.throws(() => normalizeOfficerNotificationEmails(
    Array.from({ length: 21 }, (_, index) => `officer-${index}@example.go.th`),
  ), /20 รายการ/)
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
    initial: { eia: 'มี', projectName: null, latitude: 13, longitude: 100 },
    values: { eia: '', projectName: null, latitude: '13', longitude: '100' },
  }), {
    formType: 'BASIC_INFO',
    eia: null,
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

test('maps status management state to the single dropdown selection', () => {
  assert.equal(getStatusManagementSelection({ visibility: 'HIDDEN', connectionStatus: 'CONNECTED' }), 'HIDDEN')
  assert.equal(getStatusManagementSelection({ visibility: 'HIDDEN', connectionStatus: 'DISCONNECTED' }), 'DISCONNECTED')
  assert.equal(getStatusManagementSelection({ visibility: 'HIDDEN' }, { parameter: true }), 'HIDDEN')
})

test('builds a minimal status management patch with exact parameter keys', () => {
  const initial = {
    revision: 3,
    factory: { visibility: 'VISIBLE', connectionStatus: 'CONNECTED' },
    measurementPoints: [{
      connectedPointId: 11,
      visibility: 'VISIBLE',
      connectionStatus: 'CONNECTED',
      parameters: [
        { parameter: 'CO', displayName: 'CO (ppm)', visibility: 'VISIBLE' },
        { parameter: 'NOX', displayName: 'NOx (ppm)', visibility: 'VISIBLE' },
      ],
    }],
  }

  assert.deepEqual(buildStatusManagementPayload({
    initial,
    factoryStatus: 'HIDDEN',
    measurementPoints: [{
      connectedPointId: 11,
      status: 'DISCONNECTED',
      parameters: [
        { parameter: 'CO', status: 'HIDDEN' },
        { parameter: 'NOX', status: 'VISIBLE' },
      ],
    }],
  }), {
    expectedRevision: 3,
    factory: { visibility: 'HIDDEN', connectionStatus: 'CONNECTED' },
    measurementPoints: [{
      connectedPointId: 11,
      connectionStatus: 'DISCONNECTED',
      parameters: [{ parameter: 'CO', visibility: 'HIDDEN' }],
    }],
  })
})

test('requires at least one status management change', () => {
  const initial = {
    revision: 0,
    factory: { visibility: 'VISIBLE', connectionStatus: 'CONNECTED' },
    measurementPoints: [],
  }
  assert.throws(() => buildStatusManagementPayload({
    initial,
    factoryStatus: 'VISIBLE',
  }), /เปลี่ยนสถานะอย่างน้อย 1 รายการ/)
})

for (const [visibility, connectionStatus, expected] of [
  ['VISIBLE', 'CONNECTED', 'แสดง'], ['HIDDEN', 'CONNECTED', 'ซ่อน'],
  ['VISIBLE', 'DISCONNECTED', 'ยกเลิกการเชื่อมต่อ'],
]) {
  test(`uses effective POMS status ${expected} instead of legacy monitoring status`, () => {
    assert.equal(getPomsDisplayStatus({monitoringPointStatus: 'เชื่อมต่อครบแล้ว', visibility: 'VISIBLE', connectionStatus: 'CONNECTED', effectiveVisibility: visibility, effectiveConnectionStatus: connectionStatus}), expected)
  })
}
test('prefers the new display status and defaults unmanaged points to visible', () => {
  assert.equal(getPomsDisplayStatus({status: 'ซ่อน', monitoringPointStatus:'เชื่อมต่อครบแล้ว'}), 'ซ่อน')
  assert.equal(getPomsDisplayStatus({monitoringPointStatus:'อยู่ระหว่างเชื่อมต่อ'}), 'แสดง')
})

test('switches a disconnected factory and point to the selected hidden state', () => {
  const initial = {revision:1, factory:{visibility:'VISIBLE',connectionStatus:'DISCONNECTED'},measurementPoints:[{connectedPointId:11,visibility:'VISIBLE',connectionStatus:'DISCONNECTED',parameters:[]}]}
  const payload = buildStatusManagementPayload({initial,factoryStatus:'HIDDEN',measurementPoints:[{connectedPointId:11,status:'HIDDEN',parameters:[]}]})
  assert.deepEqual(payload.factory,{visibility:'HIDDEN',connectionStatus:'CONNECTED'})
  assert.deepEqual(payload.measurementPoints[0],{connectedPointId:11,visibility:'HIDDEN',connectionStatus:'CONNECTED'})
})
