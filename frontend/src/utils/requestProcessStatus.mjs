const blockedStatuses = new Set([
  'CANCELED', 'CANCELLED', 'REJECTED',
  'ยกเลิก', 'ไม่อนุมัติ', 'ไม่ผ่านการพิจารณา',
])

export function isCancelledOrRejectedRequest(request) {
  const statusCode = String(request?.statusCode ?? '').trim()
  const statuses = statusCode ? [statusCode] : [request?.status, request?.statusLabel]
  return statuses.some((status) => blockedStatuses.has(String(status ?? '').trim().toUpperCase()))
}
