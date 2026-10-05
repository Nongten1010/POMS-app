const blockedStatuses = new Set([
  'CANCELED', 'CANCELLED', 'REJECTED',
  'ยกเลิก', 'ไม่อนุมัติ', 'ไม่ผ่านการพิจารณา',
])

const terminalProcessStatuses = new Set([
  ...blockedStatuses,
  'APPROVED', 'อนุมัติ', 'ผ่านการพิจารณา',
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
