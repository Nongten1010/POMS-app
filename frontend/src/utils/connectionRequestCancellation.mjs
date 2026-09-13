const nonCancelableStatuses = new Set([
  'CONNECTED', 'APPROVED', 'CANCELED', 'CANCELLED',
  'เชื่อมต่อแล้ว', 'ผ่านการพิจารณา', 'ยกเลิก',
])

export function canCancelConnectionRequest(row) {
  if (!row) return false
  const statuses = [row.statusCode, row.status, row.statusLabel]
    .map((value) => String(value ?? '').trim().toUpperCase())
    .filter(Boolean)
  return statuses.length > 0 && !statuses.some((status) => nonCancelableStatuses.has(status))
}
