export function canCancelKwpRequest(request = {}) {
  const statuses = [request?.statusCode, request?.status, request?.statusLabel]
    .map((value) => String(value ?? '').trim()).filter(Boolean)
  return statuses.length > 0 && !statuses.some((value) => [
    'APPROVED', 'ผ่านการพิจารณา', 'CANCELLED', 'CANCELED', 'ยกเลิก',
  ].includes(value))
}

export function getCurrentThaiYear(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(now)) + 543
}

export function formatKwpDocumentDate(value) {
  if (!value) return ''
  const thaiDate = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (thaiDate) {
    const [, day, month, year] = thaiDate
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${Number(year) < 2400 ? Number(year) + 543 : year}`
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB-u-ca-buddhist', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date).replace(/ BE$/, '')
}

export function getKwpDocumentMetadata(detail = {}, row = {}) {
  const submittedAt = detail.submittedAt ?? detail.submittedDate ?? row.submittedAt ?? row.submittedDate
  const submittedDate = formatKwpDocumentDate(submittedAt)
  return {
    submittedAt,
    submittedDate,
    signatureDate: submittedDate,
  }
}

export function getKwpAttachmentValidationError(files, maxFiles = 5, maxSizeMb = 5) {
  if (files.length > maxFiles) return `แนบไฟล์ได้ไม่เกิน ${maxFiles} ไฟล์`
  for (const file of files) {
    if (file.isSubmitted) continue
    if (!/\.(jpe?g|png|pdf)$/i.test(file.name) || !['image/jpeg', 'image/png', 'application/pdf', ''].includes(file.type)) {
      return 'รองรับเฉพาะไฟล์ JPG, PNG และ PDF'
    }
    if (!file.size || file.size > maxSizeMb * 1024 * 1024) return `ไฟล์ต้องมีขนาดมากกว่า 0 และไม่เกิน ${maxSizeMb} MB`
  }
  return ''
}

export async function cancelKwpSubmission({ request, accessToken, apiBaseUrl, fetchImpl = fetch }) {
  if (!request?.id || !canCancelKwpRequest(request)) throw new Error('ไม่สามารถยกเลิกคำขอในสถานะนี้ได้')
  if (!accessToken) throw new Error('กรุณาเข้าสู่ระบบเพื่อยกเลิกคำขอ')
  const result = await fetchImpl(`${apiBaseUrl}/${encodeURIComponent(request.id)}/workflow-actions`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: 'CANCEL' }),
  })
  const response = await result.json().catch(() => null)
  if (!result.ok || response?.success === false) throw new Error(response?.error?.message ?? response?.message ?? 'ยกเลิกคำขอไม่สำเร็จ')
  return response
}

export function getKwpReportPeriod(formData) {
  const reportRound = String(formData.get('reportRound') ?? '').trim()
  const reportYear = String(formData.get('reportYear') ?? '').trim()
  if (!/^[1-9]\d*$/.test(reportRound)) throw new Error('กรุณากรอกรายงานครั้งที่เป็นจำนวนเต็มมากกว่า 0')
  if (!/^\d{4}$/.test(reportYear) || Number(reportYear) < 2400) throw new Error('กรุณากรอกปี พ.ศ. ให้ถูกต้อง')
  return { reportRound: Number(reportRound), reportYear: Number(reportYear) }
}
