const blockedStatuses = new Set([
  'CANCELED', 'CANCELLED', 'REJECTED',
  'ยกเลิก', 'ไม่อนุมัติ', 'ไม่ผ่านการพิจารณา',
])

const terminalProcessStatuses = new Set([
  ...blockedStatuses,
  'APPROVED', 'อนุมัติ', 'ผ่านการพิจารณา',
])

const pdfStatusLabels = new Map([
  ['APPROVED', 'ผ่านการพิจารณา'],
  ['CONNECTED', 'ผ่านการพิจารณา'],
  ['อนุมัติ', 'ผ่านการพิจารณา'],
  ['อนุมัติแล้ว', 'ผ่านการพิจารณา'],
  ['เชื่อมต่อแล้ว', 'ผ่านการพิจารณา'],
  ['ผ่านการพิจารณา', 'ผ่านการพิจารณา'],
  ['REJECTED', 'ไม่ผ่านการพิจารณา'],
  ['ไม่อนุมัติ', 'ไม่ผ่านการพิจารณา'],
  ['ไม่ผ่านการพิจารณา', 'ไม่ผ่านการพิจารณา'],
  ['CANCELED', 'ยกเลิกคำขอ'],
  ['CANCELLED', 'ยกเลิกคำขอ'],
  ['ยกเลิก', 'ยกเลิกคำขอ'],
  ['ยกเลิกคำขอ', 'ยกเลิกคำขอ'],
])

function getRequestStatuses(request) {
  const statusCode = String(request?.statusCode ?? '').trim()
  return statusCode ? [statusCode] : [request?.status, request?.statusLabel]
}

export function isCancelledOrRejectedRequest(request) {
  return getRequestStatuses(request).some((status) => blockedStatuses.has(String(status ?? '').trim().toUpperCase()))
}

export function isTerminalProcessRequest(request) {
  return getRequestStatuses(request).some((status) => terminalProcessStatuses.has(String(status ?? '').trim().toUpperCase()))
}

export function getPdfRequestStatusLabel(request) {
  const statusCode = String(request?.statusCode ?? request?.raw?.statusCode ?? '').trim()
  const statuses = statusCode
    ? [statusCode]
    : [request?.status, request?.statusLabel, request?.raw?.status, request?.raw?.statusLabel]

  for (const status of statuses) {
    const normalizedStatus = String(status ?? '').trim()
    if (!normalizedStatus) continue
    const label = pdfStatusLabels.get(normalizedStatus.toUpperCase())
    if (label) return label
  }
  return ''
}
