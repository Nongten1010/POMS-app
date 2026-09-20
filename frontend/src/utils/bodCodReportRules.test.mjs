import assert from 'node:assert/strict'
import test from 'node:test'
import { formatBodCodDate, getBodCodActions, getBodCodPeriod, getBodCodPeriodLabel, getBodCodSequenceLabel, getBodCodSubmissionError } from './bodCodReportRules.js'

const permissions = { bod_cod_errors: { view: true, edit: true, approve: true } }
const operator = { userType: 'operator', permissions }
const officer = { userType: 'officer', permissions, roleCode: 'monitoring_kpm' }
const draft = { id: 'draft', factoryId: 'F1', monitoringPointId: 10, monitoringPointCode: 'P0010', parameter: 'COD', year: 2569, roundNo: 2 }
const now = new Date('2026-09-20T00:00:00Z')
const pending = { ...draft, id: 1, statusCode: 'SUBMITTED' }

test('Thai half-year and year boundaries, not machine timezone', () => {
  assert.deepEqual(getBodCodPeriod(new Date('2026-06-30T16:59:59Z')), { year: 2569, roundNo: 1 })
  assert.deepEqual(getBodCodPeriod(new Date('2026-06-30T17:00:00Z')), { year: 2569, roundNo: 2 })
  assert.deepEqual(getBodCodPeriod(new Date('2026-12-31T17:00:00Z')), { year: 2570, roundNo: 1 })
  assert.equal(getBodCodPeriodLabel(1), 'ม.ค.-มิ.ย.')
  assert.equal(getBodCodPeriodLabel(2), 'ก.ค.-ธ.ค.')
})

test('existing role-stage combinations remain necessary in addition to approve permission', () => {
  for (const statusCode of ['SUBMITTED', 'REVISED_PENDING_REVIEW']) assert.equal(getBodCodActions({ statusCode }, officer).process, true)
  assert.equal(getBodCodActions({ statusCode: 'WAITING_REVIEW' }, officer).process, false)
  assert.equal(getBodCodActions({ statusCode: 'WAITING_REVIEW' }, { ...officer, roleCodes: ['kpm_director'] }).process, true)
  for (const roleCode of ['center_director', 'kwp_director']) {
    assert.equal(getBodCodActions({ statusCode: 'WAITING_APPROVAL' }, { ...officer, roleCode }).process, true)
  }
  assert.equal(getBodCodActions({ statusCode: 'WAITING_APPROVAL' }, { ...officer, roleCode: 'admin' }).process, false)
  assert.equal(getBodCodActions({ statusCode: 'WAITING_RESULT_NOTICE' }, officer).fillNotice, true)
  assert.equal(getBodCodActions({ statusCode: 'WAITING_RESULT_NOTICE' }, { ...officer, roleCode: 'other' }).fillNotice, false)
})

test('permissions and allowedActions only narrow existing processing conditions', () => {
  const submitted = { statusCode: 'SUBMITTED' }
  for (const value of [undefined, false, 'true']) {
    const context = { ...officer, permissions: { bod_cod_errors: { view: true, approve: value } } }
    assert.equal(getBodCodActions(submitted, context).process, false)
  }
  assert.equal(getBodCodActions(submitted, {}).view, false)
  assert.equal(getBodCodActions({ ...submitted, allowedActions: [] }, officer).process, false)
  const actions = getBodCodActions({ ...submitted, allowedActions: ['REQUEST_REVISION'] }, officer)
  assert.equal(actions.process, true)
  assert.equal(actions.approve, false)
  assert.equal(actions.requestRevision, true)
  assert.equal(getBodCodActions({ statusCode: 'WAITING_APPROVAL', allowedActions: ['APPROVE'] }, officer).approve, false)
})

test('only operator or admin with edit can create; operator-only revision remains unchanged', () => {
  assert.equal(getBodCodActions({}, operator).create, true)
  assert.equal(getBodCodActions({}, officer).create, false)
  assert.equal(getBodCodActions({}, { ...officer, roleCodes: ['admin'] }).create, true)
  assert.equal(getBodCodActions({}, { ...officer, roleCode: 'admin', permissions: { bod_cod_errors: { view: true } } }).create, false)
  assert.equal(getBodCodActions({ statusCode: 'REVISION_REQUESTED' }, operator).edit, true)
  assert.equal(getBodCodActions({ statusCode: 'REVISION_REQUESTED' }, { ...officer, roleCode: 'admin' }).edit, false)
})

test('operator cancellation includes rejected and all nonterminal workflow stages except approved/cancelled', () => {
  for (const statusCode of ['DRAFT', 'SUBMITTED', 'REVISED_PENDING_REVIEW', 'REVISION_REQUESTED', 'WAITING_RESULT_NOTICE', 'WAITING_REVIEW', 'WAITING_APPROVAL', 'REJECTED']) {
    assert.equal(getBodCodActions({ statusCode }, operator).cancel, true, statusCode)
    assert.equal(getBodCodActions({ statusCode }, officer).cancel, false)
  }
  for (const statusCode of ['APPROVED', 'CANCELLED', '']) assert.equal(getBodCodActions({ statusCode }, operator).cancel, false)
  assert.equal(getBodCodActions({ status: 'รอพิจารณา', statusCode: 'APPROVED' }, operator).cancel, false)
})

test('pending requests block same parameter/point/year across both periods, not other identities', () => {
  assert.match(getBodCodSubmissionError(draft, [pending], now), /ยังไม่สิ้นสุด/)
  assert.match(getBodCodSubmissionError(draft, [{ ...pending, roundNo: 1 }], now), /ยังไม่สิ้นสุด/)
  for (const changes of [{ parameter: 'BOD' }, { monitoringPointId: 11 }, { factoryId: 'F2' }, { year: 2568 }]) {
    assert.equal(getBodCodSubmissionError(draft, [{ ...pending, ...changes }], now), '')
  }
  assert.match(getBodCodSubmissionError(draft, [{ ...pending, monitoringPointId: undefined }], now), /ยังไม่สิ้นสุด/)
  assert.equal(getBodCodSubmissionError({ ...draft, id: 1 }, [pending], now), '')
})

test('approved, rejected and cancelled finish requests; no backdated or next-period submission', () => {
  for (const statusCode of ['APPROVED', 'REJECTED', 'CANCELLED']) {
    assert.equal(getBodCodSubmissionError(draft, [{ ...pending, statusCode }], now), '')
  }
  assert.match(getBodCodSubmissionError({ ...draft, roundNo: 1 }, [], now), /ย้อนหลังหรือข้ามรอบ/)
  assert.match(getBodCodSubmissionError({ ...draft, year: 2570 }, [], now), /ย้อนหลังหรือข้ามรอบ/)
  assert.match(getBodCodSubmissionError({ ...draft, parameter: '' }, [], now), /เลือกพารามิเตอร์/)
})

test('annual sequence is never inferred from period or row count; dates never fall back to today', () => {
  assert.equal(getBodCodSequenceLabel({ roundNo: 2, year: 2569 }), '-')
  assert.equal(getBodCodSequenceLabel({ reportSequenceNo: 3, year: 2569 }), '3/2569')
  for (const reportSequenceNo of [null, '', 0, -1, 1.5]) assert.equal(getBodCodSequenceLabel({ reportSequenceNo }), '-')
  assert.equal(formatBodCodDate('2026-09-19T18:00:00Z'), '20/09/2569')
  assert.equal(formatBodCodDate('20/09/2569'), '20/09/2569')
  assert.equal(formatBodCodDate(null), '-')
  assert.equal(formatBodCodDate('invalid'), '-')
})
