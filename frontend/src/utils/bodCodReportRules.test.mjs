import assert from 'node:assert/strict'
import test from 'node:test'
import { formatBodCodDate, getBodCodActions, getBodCodConflictAction, getBodCodIdentity, getBodCodParameters, getBodCodPeriod, getBodCodPeriodLabel, getBodCodSequenceLabel, getBodCodSubmissionError } from './bodCodReportRules.js'

const permissions = { bod_cod_errors: { view: true, edit: true, approve: true } }
const operator = { userType: 'operator', roleCode: 'factory_operator', permissions }
const officer = { userType: 'officer', permissions, roleCode: 'monitoring_kpm' }
const draft = { id: 'draft', factoryId: 'F1', monitoringPointId: 10, monitoringPointCode: 'P0010', parameter: 'COD', allowedParameterCodes: ['COD', 'BOD'], year: 2569, roundNo: 2 }
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

test('authoritative current step, role and allowedActions must all agree', () => {
  const stages = [
    ['SUBMITTED', 'INSPECTOR', ['monitoring_kpm', 'monitoring_5_centers', 'admin'], 'approve'],
    ['WAITING_RESULT_NOTICE', 'RESULT_NOTICE', ['monitoring_kpm', 'monitoring_5_centers', 'admin'], 'fillNotice'],
    ['WAITING_REVIEW', 'REVIEWER', ['kpm_director'], 'approve'],
    ['WAITING_APPROVAL', 'APPROVER', ['center_director', 'kwp_director'], 'approve'],
  ]
  const allRoles = ['monitoring_kpm', 'monitoring_5_centers', 'admin', 'kpm_director', 'center_director', 'kwp_director', 'other']
  for (const [statusCode, roleCode, allowedRoles, action] of stages) {
    const row = { statusCode, currentStep: { roleCode, status: 'PENDING', isCurrent: true }, allowedActions: ['APPROVE'] }
    for (const userRole of allRoles) {
      assert.equal(getBodCodActions(row, { ...officer, roleCode: userRole })[action], allowedRoles.includes(userRole), `${statusCode}/${userRole}`)
    }
    const context = { ...officer, roleCode: allowedRoles[0] }
    for (const currentStep of [null, { ...row.currentStep, isCurrent: false }, { ...row.currentStep, status: 'APPROVED' }, { ...row.currentStep, roleCode: 'WRONG' }]) {
      assert.equal(getBodCodActions({ ...row, currentStep }, context)[action], false)
    }
    assert.equal(getBodCodActions({ ...row, allowedActions: [] }, context)[action], false)
  }
  assert.equal(getBodCodActions({ statusCode: 'REJECTED', allowedActions: [] }, operator).cancel, false)
  assert.equal(getBodCodActions({ statusCode: 'REJECTED', allowedActions: ['CANCEL'] }, operator).cancel, true)
  assert.equal(getBodCodActions({}, { ...operator, roleCode: 'other' }).create, false)
})

test('regional inspectors can fill result notices only with existing permission and API grants', () => {
  const row = {
    statusCode: 'WAITING_RESULT_NOTICE',
    currentStep: { roleCode: 'RESULT_NOTICE', status: 'PENDING', isCurrent: true },
    allowedActions: ['APPROVE'],
  }
  const context = { ...officer, roleCode: 'monitoring_5_centers' }
  assert.equal(getBodCodActions(row, context).fillNotice, true)
  for (const field of ['view', 'approve']) {
    for (const value of [false, undefined, 'true']) {
      assert.equal(getBodCodActions(row, {
        ...context, permissions: { bod_cod_errors: { ...permissions.bod_cod_errors, [field]: value } },
      }).fillNotice, false)
    }
  }
  for (const allowedActions of [[], ['REQUEST_REVISION'], ['REJECT']]) {
    assert.equal(getBodCodActions({ ...row, allowedActions }, context).fillNotice, false)
  }
  for (const statusCode of ['SUBMITTED', 'WAITING_REVIEW', 'WAITING_APPROVAL', 'APPROVED', 'CANCELLED']) {
    assert.equal(getBodCodActions({ ...row, statusCode }, context).fillNotice, false)
  }
  assert.equal(getBodCodActions(row, { ...context, userType: 'operator' }).fillNotice, false)
  assert.equal(getBodCodActions({
    ...row, statusCode: 'WAITING_APPROVAL', currentStep: { ...row.currentStep, roleCode: 'APPROVER' },
  }, context).approve, false)
})

test('resubmission keeps its original identity across half-years and years without treating itself as a new report', () => {
  const original = { ...draft, id: 10, year: 2568, roundNo: 1, reportSequenceNo: 3, reportNo: 'E-01-0010/2568' }
  const edited = { ...original, mode: 'edit', originalIdentity: getBodCodIdentity(original) }
  assert.equal(getBodCodSubmissionError(edited, [pending], now), '')
  for (const changes of [{ factoryId: 'F2' }, { factoryRegistration: 'new' }, { monitoringPointId: 11 }, { monitoringPointCode: 'P0011' }, { year: 2569 }, { roundNo: 2 }, { parameter: 'BOD' }]) {
    assert.match(getBodCodSubmissionError({ ...edited, ...changes }, [], now), /คำขอเดิม/)
  }
  assert.match(getBodCodSubmissionError({ ...edited, originalIdentity: undefined }, [], now), /คำขอเดิม/)
  assert.match(getBodCodSubmissionError({ ...original, id: 'new' }, [], now), /ย้อนหลังหรือข้ามรอบ/)
})

test('new report parameters must come from the selected live point; code-only identity is supported', () => {
  assert.deepEqual(getBodCodParameters(['BOD (mg/l)', 'COD', 'cod (mg/L)', 'TSS (mg/l)', 'BODX']), ['BOD', 'COD'])
  assert.deepEqual(getBodCodParameters('COD (mg/l), BOD (mg/l)'), ['COD', 'BOD'])
  assert.deepEqual(getBodCodParameters([]), [])
  assert.match(getBodCodSubmissionError({ ...draft, allowedParameterCodes: ['BOD'] }, [], now), /ไม่มีอยู่/)
  assert.match(getBodCodSubmissionError({ ...draft, allowedParameterCodes: [] }, [], now), /ไม่มีอยู่/)
  assert.equal(getBodCodSubmissionError({ ...draft, monitoringPointId: null }, [], now), '')
  assert.match(getBodCodSubmissionError({ ...draft, monitoringPointId: 'point-0-0' }, [], now), /ไม่ถูกต้อง/)
  assert.match(getBodCodSubmissionError({ ...draft, monitoringPointId: null, monitoringPointCode: '' }, [], now), /ไม่พบรหัส/)
})

test('409 recovery never advances an old resubmission into a new period', () => {
  const closed = { status: 409, code: 'CONFLICT', details: { reason: 'REPORT_PERIOD_CLOSED' } }
  assert.equal(getBodCodConflictAction(closed, draft), 'reload-period')
  assert.equal(getBodCodConflictAction(closed, { ...draft, mode: 'edit' }), 'reload-detail')
  assert.equal(getBodCodConflictAction({ ...closed, details: { reason: 'PENDING_REPORT_EXISTS' } }, draft), 'open-pending')
  assert.equal(getBodCodConflictAction({ ...closed, details: {} }, draft), 'reload-detail')
  assert.equal(getBodCodConflictAction({ ...closed, status: 403 }, draft), null)
})
