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

export function getBodCodActions(row = {}, { userType, roleCode, roleCodes = [], permissions } = {}) {
  const roles = new Set([roleCode, ...roleCodes])
  const officer = userType === 'officer'
  const operator = userType === 'operator'
  const permission = permissions?.bod_cod_errors ?? {}
  const view = permission.view === true
  const edit = view && permission.edit === true
  const approve = view && permission.approve === true
  const status = getBodCodStatus(row)
  const serverAllows = (action) => !Array.isArray(row.allowedActions) || row.allowedActions.includes(action)
  const processStage = ['SUBMITTED', 'REVISED_PENDING_REVIEW'].includes(status)
    || (roles.has('kpm_director') && status === 'WAITING_REVIEW')
    || (['center_director', 'kwp_director'].some((role) => roles.has(role)) && status === 'WAITING_APPROVAL')
  return {
    view,
    create: edit && (operator || (officer && roles.has('admin'))),
    edit: edit && operator && status === 'REVISION_REQUESTED',
    cancel: edit && operator && Boolean(status) && !['APPROVED', 'CANCELLED'].includes(status),
    process: approve && officer && processStage && (serverAllows('APPROVE') || serverAllows('REQUEST_REVISION')),
    approve: approve && officer && processStage && serverAllows('APPROVE'),
    requestRevision: approve && officer && processStage && serverAllows('REQUEST_REVISION'),
    viewNotice: view && (status === 'APPROVED' || (officer && ['WAITING_REVIEW', 'WAITING_APPROVAL'].includes(status))),
    fillNotice: approve && officer && ['monitoring_kpm', 'admin'].some((role) => roles.has(role))
      && status === 'WAITING_RESULT_NOTICE',
  }
}

export function getBodCodSubmissionError(report, reports, now = new Date()) {
  const period = getBodCodPeriod(now)
  if (Number(report.year ?? report.reportYear) !== period.year || Number(report.roundNo ?? report.reportRoundNo) !== period.roundNo) {
    return 'ไม่สามารถส่งรายงานย้อนหลังหรือข้ามรอบได้ กรุณาใช้รอบรายงานปัจจุบัน'
  }
  const parameter = report.parameter ?? report.selectedParameterCode
  if (!['BOD', 'COD'].includes(parameter)) return 'กรุณาเลือกพารามิเตอร์ BOD หรือ COD'
  const pointId = report.monitoringPointId ?? report.connectedMeasurementPointId
  if (pointId == null || pointId === '') return 'ไม่พบรหัสอ้างอิงจุดตรวจวัด'
  const pending = reports.some((row) => String(row.id) !== String(report.id)
    && ((row.monitoringPointId ?? row.connectedMeasurementPointId) != null
      ? String(row.monitoringPointId ?? row.connectedMeasurementPointId) === String(pointId)
      : Boolean(report.monitoringPointCode ?? report.pointCode)
        && (row.monitoringPointCode ?? row.pointCode) === (report.monitoringPointCode ?? report.pointCode))
    && String(row.factoryId) === String(report.factoryId)
    && Number(row.year ?? row.reportYear) === period.year
    && (row.parameter ?? row.selectedParameterCode) === parameter
    && !['APPROVED', 'REJECTED', 'CANCELLED'].includes(getBodCodStatus(row)))
  return pending ? 'มีคำขอของจุดตรวจวัดและพารามิเตอร์นี้ที่ยังไม่สิ้นสุด กรุณาดำเนินการคำขอเดิมให้เสร็จก่อน' : ''
}
