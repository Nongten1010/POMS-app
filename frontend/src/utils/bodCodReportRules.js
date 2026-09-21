export function getBodCodPeriod(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: 'numeric',
  }).formatToParts(now).map(({ type, value }) => [type, value]))
  return { year: Number(parts.year) + 543, roundNo: Number(parts.month) <= 6 ? 1 : 2 }
}

export function getBodCodPeriodLabel(roundNo) {
  return ({ 1: 'ม.ค.-มิ.ย.', 2: 'ก.ค.-ธ.ค.' })[Number(roundNo)] ?? '-'
}

export function getBodCodSequenceLabel(report = {}) {
  const sequence = Number(report.reportSequenceNo)
  return Number.isInteger(sequence) && sequence > 0
    ? `${sequence}/${report.year ?? report.reportYear ?? '-'}` : '-'
}

export function formatBodCodDate(value) {
  if (!value || value === '-') return '-'
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(value))) return String(value)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date)
}

const statusCodes = {
  'รอโรงงานแก้ไข': 'REVISION_REQUESTED', 'รอพิจารณา': 'SUBMITTED',
  'แก้ไขแล้ว/รอพิจารณา': 'REVISED_PENDING_REVIEW', 'รอทบทวน': 'WAITING_REVIEW',
  'รออนุมัติ': 'WAITING_APPROVAL', 'ผ่านการพิจารณา': 'APPROVED',
  'ไม่อนุมัติ': 'REJECTED', 'ยกเลิก': 'CANCELLED', 'กรอกแบบแจ้งผล': 'WAITING_RESULT_NOTICE',
}

export function getBodCodStatus(row = {}) {
  return row.statusCode || statusCodes[row.status] || statusCodes[row.statusLabel] || row.status || ''
}

export function getBodCodParameters(value) {
  const entries = Array.isArray(value) ? value : String(value ?? '').split(',')
  return [...new Set(entries.map((entry) => String(entry).trim().toUpperCase().match(/^(BOD|COD)(?:\s*\([^)]*\))?$/)?.[1]).filter(Boolean))]
}

export function getBodCodIdentity(report = {}) {
  return {
    factoryId: String(report.factoryId ?? '').trim(),
    factoryRegistration: String(report.factoryRegistration ?? report.factoryRegistrationNo ?? '').trim(),
    pointId: String(report.monitoringPointId ?? report.connectedMeasurementPointId ?? '').trim(),
    pointCode: String(report.monitoringPointCode ?? report.pointCode ?? '').trim(),
    year: Number(report.year ?? report.reportYear),
    roundNo: Number(report.roundNo ?? report.reportRoundNo),
    parameter: report.parameter ?? report.selectedParameterCode ?? '',
  }
}

export function hasBodCodIdentityChanged(report, originalIdentity) {
  if (!originalIdentity) return true
  const identity = getBodCodIdentity(report)
  return Object.keys(identity).some((key) => identity[key] !== originalIdentity[key])
}

export function findPendingBodCodReport(report, reports) {
  const identity = getBodCodIdentity(report)
  return reports.find((row) => {
    const other = getBodCodIdentity(row)
    const samePoint = identity.pointId && other.pointId
      ? identity.pointId === other.pointId
      : Boolean(identity.pointCode) && identity.pointCode === other.pointCode
    return String(row.id) !== String(report.id) && samePoint
      && other.factoryId === identity.factoryId && other.year === identity.year
      && other.parameter === identity.parameter
      && !['APPROVED', 'REJECTED', 'CANCELLED'].includes(getBodCodStatus(row))
  })
}

export function getBodCodActions(row = {}, { userType, roleCode, roleCodes = [], permissions } = {}) {
  const roles = new Set([roleCode, ...roleCodes])
  const officer = userType === 'officer'
  const operator = userType === 'operator' && roles.has('factory_operator')
  const permission = permissions?.bod_cod_errors ?? {}
  const view = permission.view === true
  const edit = view && permission.edit === true
  const approve = view && permission.approve === true
  const status = getBodCodStatus(row)
  const serverAllows = (action) => !Array.isArray(row.allowedActions) || row.allowedActions.includes(action)
  // Lists may omit the step; an explicit null in detail means there is no active step.
  const atStep = (role) => row.currentStep === undefined || (row.currentStep?.roleCode === role
    && row.currentStep.status === 'PENDING' && row.currentStep.isCurrent === true)
  const hasRole = (allowed) => allowed.some((role) => roles.has(role))
  const processStage = (hasRole(['monitoring_kpm', 'monitoring_5_centers', 'admin'])
      && ['SUBMITTED', 'REVISED_PENDING_REVIEW'].includes(status) && atStep('INSPECTOR'))
    || (roles.has('kpm_director') && status === 'WAITING_REVIEW' && atStep('REVIEWER'))
    || (hasRole(['center_director', 'kwp_director']) && status === 'WAITING_APPROVAL' && atStep('APPROVER'))
  const noticeStage = hasRole(['monitoring_kpm', 'monitoring_5_centers', 'admin']) && status === 'WAITING_RESULT_NOTICE' && atStep('RESULT_NOTICE')
  return {
    view,
    create: edit && (operator || (officer && roles.has('admin'))),
    edit: edit && operator && status === 'REVISION_REQUESTED',
    cancel: edit && operator && Boolean(status) && !['APPROVED', 'CANCELLED'].includes(status) && serverAllows('CANCEL'),
    process: approve && officer && processStage && (serverAllows('APPROVE') || serverAllows('REQUEST_REVISION')),
    approve: approve && officer && processStage && serverAllows('APPROVE'),
    requestRevision: approve && officer && processStage && serverAllows('REQUEST_REVISION'),
    viewNotice: view && (status === 'APPROVED' || (officer && ['WAITING_REVIEW', 'WAITING_APPROVAL'].includes(status))),
    // Let regional inspectors submit notices for server-side authorization even if allowedActions omits APPROVE.
    fillNotice: approve && officer && noticeStage && (roles.has('monitoring_5_centers') || serverAllows('APPROVE')),
  }
}

export function getBodCodSubmissionError(report, reports, now = new Date()) {
  const period = getBodCodPeriod(now)
  const isEdit = report.mode === 'edit'
  if (isEdit && hasBodCodIdentityChanged(report, report.originalIdentity)) {
    return 'ไม่สามารถเปลี่ยนโรงงาน จุดตรวจวัด ปี รอบ หรือพารามิเตอร์ของคำขอเดิมได้'
  }
  if (!isEdit && (Number(report.year ?? report.reportYear) !== period.year || Number(report.roundNo ?? report.reportRoundNo) !== period.roundNo)) {
    return 'ไม่สามารถส่งรายงานย้อนหลังหรือข้ามรอบได้ กรุณาใช้รอบรายงานปัจจุบัน'
  }
  const parameter = report.parameter ?? report.selectedParameterCode
  if (!['BOD', 'COD'].includes(parameter)) return 'กรุณาเลือกพารามิเตอร์ BOD หรือ COD'
  const pointId = report.monitoringPointId ?? report.connectedMeasurementPointId
  const hasId = pointId != null && pointId !== ''
  if (hasId && (!Number.isSafeInteger(Number(pointId)) || Number(pointId) <= 0)) return 'รหัสอ้างอิงจุดตรวจวัดไม่ถูกต้อง'
  if (!hasId && !String(report.monitoringPointCode ?? report.pointCode ?? '').trim()) return 'ไม่พบรหัสอ้างอิงจุดตรวจวัด'
  if (isEdit) return ''
  if (!getBodCodParameters(report.allowedParameterCodes).includes(parameter)) return 'พารามิเตอร์ที่เลือกไม่มีอยู่ในจุดตรวจวัดนี้'
  const pending = findPendingBodCodReport(report, reports)
  return pending ? 'มีคำขอของจุดตรวจวัดและพารามิเตอร์นี้ที่ยังไม่สิ้นสุด กรุณาดำเนินการคำขอเดิมให้เสร็จก่อน' : ''
}

export function getBodCodConflictAction(error, report = {}) {
  if (error?.status !== 409) return null
  if (report.mode !== 'edit' && error.details?.reason === 'REPORT_PERIOD_CLOSED') return 'reload-period'
  if (report.mode !== 'edit' && error.details?.reason === 'PENDING_REPORT_EXISTS') return 'open-pending'
  return 'reload-detail'
}
