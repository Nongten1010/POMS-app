export function isKwpAdmin(roleCode = '', roleCodes = []) {
  return [roleCode, ...roleCodes].some((role) => String(role).toLowerCase() === 'admin')
}

export function canCreateKwpRequest(userType, roleCode = '', roleCodes = []) {
  return userType === 'operator' || isKwpAdmin(roleCode, roleCodes)
}

export function canEditKwpRequest(request, { isOperator = false, isAdmin = false } = {}) {
  const status = request?.statusCode || request?.status || request?.statusLabel
  return (isOperator || isAdmin) && ['REVISION_REQUESTED', 'รอโรงงานแก้ไข'].includes(status)
}

export function canCancelKwpRequest(request = {}) {
  const statuses = [request?.statusCode, request?.status, request?.statusLabel]
    .map((value) => String(value ?? '').trim()).filter(Boolean)
  return statuses.length > 0 && !statuses.some((value) => [
    'APPROVED', 'ผ่านการพิจารณา', 'CANCELLED', 'CANCELED', 'ยกเลิก',
  ].includes(value))
}

const kwpRequestStatusPriorityGroups = [
  ['SUBMITTED', 'REVISED_PENDING_REVIEW', 'UNDER_REVIEW', 'รอพิจารณา', 'แก้ไขแล้ว/รอพิจารณา', 'แก้ไขแล้วรอพิจารณา', 'อยู่ระหว่างพิจารณา', 'ส่งฟอร์ม', 'ยื่นแบบสำเร็จ'],
  ['REVISION_REQUESTED', 'รอโรงงานแก้ไข', 'ส่งแก้ไข'],
  ['APPROVED', 'ผ่านการพิจารณา'],
  ['REJECTED', 'ไม่ผ่านการพิจารณา'],
  ['CANCELLED', 'CANCELED', 'ยกเลิก'],
  ['DRAFT', 'ร่าง'],
]

function getKwpRequestStatusPriority(row) {
  for (const value of [row.statusCode, row.status, row.statusLabel]) {
    const status = String(value ?? '').trim()
    const priority = kwpRequestStatusPriorityGroups.findIndex((group) => group.includes(status))
    if (priority !== -1) return priority
  }
  return kwpRequestStatusPriorityGroups.length
}

export function sortKwpRequestRows(rows = [], isOperator = false) {
  if (isOperator) return rows
  return rows
    .map((row, index) => ({ row, index, priority: getKwpRequestStatusPriority(row),
      submittedTime: Date.parse(row.submittedAt ?? '') || 0 }))
    .sort((a, b) => a.priority - b.priority || b.submittedTime - a.submittedTime || a.index - b.index)
    .map(({ row }) => row)
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

export async function cancelKwpSubmission({ request, accessToken, apiBaseUrl, fetchImpl = fetch, onConflict }) {
  if (!request?.id || !canCancelKwpRequest(request)) throw new Error('ไม่สามารถยกเลิกคำขอในสถานะนี้ได้')
  if (!accessToken) throw new Error('กรุณาเข้าสู่ระบบเพื่อยกเลิกคำขอ')
  const result = await fetchImpl(`${apiBaseUrl}/${encodeURIComponent(request.id)}/workflow-actions`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: 'CANCEL' }),
  })
  try {
    return await readKwpApiResponse(result, 'ยกเลิกคำขอไม่สำเร็จ')
  } catch (error) {
    if (error.status === 409) await onConflict?.()
    throw error
  }
}

export function getKwpReportPeriod(formData, { allowEmpty = false } = {}) {
  const reportRound = String(formData.get('reportRound') ?? '').trim()
  const reportYear = String(formData.get('reportYear') ?? '').trim()
  if (!(allowEmpty && !reportRound) && (!/^[1-9]\d*$/.test(reportRound) || Number(reportRound) > 2147483647)) {
    throw new Error('กรุณากรอกรายงานครั้งที่เป็นจำนวนเต็ม 1–2147483647')
  }
  if (!(allowEmpty && !reportYear) && (!/^\d{4}$/.test(reportYear) || Number(reportYear) < 2400)) {
    throw new Error('กรุณากรอกปี พ.ศ. ระหว่าง 2400–9999')
  }
  return { reportRound: reportRound ? Number(reportRound) : null, reportYear: reportYear ? Number(reportYear) : null }
}

export function getKwpLink(value) {
  const raw = String(value ?? '')
  if (/[\u0000-\u001f\u007f]/u.test(raw)) throw new Error('Link ต้องไม่มีอักขระควบคุม')
  const text = raw.trim()
  if (!text) return null
  if (text.length > 1000) throw new Error('Link ต้องมีความยาวไม่เกิน 1,000 ตัวอักษร')
  let url
  try { url = new URL(text) } catch { throw new Error('กรุณากรอก Link เป็น URL ที่ขึ้นต้นด้วย http:// หรือ https://') }
  if (!['http:', 'https:'].includes(url.protocol) || !/^https?:\/\//i.test(text)) {
    throw new Error('Link ต้องขึ้นต้นด้วย http:// หรือ https://')
  }
  if (url.username || url.password) throw new Error('Link ต้องไม่มีชื่อผู้ใช้หรือรหัสผ่านใน URL')
  return text
}

export async function readKwpApiResponse(result, fallbackMessage) {
  const raw = await result.text()
  let response
  try { response = raw ? JSON.parse(raw) : null } catch { response = null }
  if (!result.ok || response?.success === false) {
    const error = new Error(response?.error?.message ?? response?.message ?? `${fallbackMessage} (${result.status})`)
    error.status = result.status
    error.code = response?.error?.code
    error.details = response?.error?.details
    error.issues = response?.error?.issues ?? []
    throw error
  }
  return response
}

export async function fetchKwpMeasurementPoints({ factoryId, accessToken, apiBaseUrl, signal, fetchImpl = fetch }) {
  if (!factoryId || !accessToken) throw new Error('ไม่พบโรงงานหรือสิทธิ์สำหรับโหลดจุดตรวจวัด')
  const result = await fetchImpl(`${apiBaseUrl}/factories/${encodeURIComponent(factoryId)}/measurement-points`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` }, signal,
  })
  const response = await readKwpApiResponse(result, 'โหลดรายละเอียดจุดตรวจวัดไม่สำเร็จ')
  if (!Array.isArray(response?.data)) throw new Error('ข้อมูลจุดตรวจวัดจาก API ไม่ถูกต้อง')
  return response.data
}

export function withKwpParameterOptions(point, points) {
  const id = point?.connectedPointId
  const code = point?.code ?? point?.pointCode
  const type = point?.type ?? point?.pointType
  const name = point?.name ?? point?.pointName
  const matches = points.filter((candidate) => {
    if (id != null) return candidate.connectedPointId != null && String(candidate.connectedPointId) === String(id)
    return candidate.pointType === type && (code ? candidate.pointCode === code : name && candidate.pointName === name)
  })
  if (matches.length !== 1) throw new Error('ไม่พบจุดตรวจวัดที่ตรงกับคำขออย่างชัดเจน กรุณาโหลดข้อมูลใหม่')
  const source = matches[0]
  return { ...point,
    parameterDetails: Array.isArray(source.parameterDetails) ? [...source.parameterDetails] : [],
    parameterInstrumentDetails: Array.isArray(source.parameterInstrumentDetails) ? [...source.parameterInstrumentDetails] : [],
  }
}

export function isKwpParameterError(error) {
  return error?.status === 400 && Array.isArray(error?.details?.allowedParameters)
}

export function buildKwpAttachmentMetadata(file, attachmentType) {
  return {
    attachmentType: file?.isSubmitted ? file.attachmentType : attachmentType,
    originalFileName: file?.originalFileName ?? '',
    storedFileName: file?.storedFileName ?? null,
    mimeType: file?.mimeType ?? null,
    fileSize: file?.fileSize ?? null,
    storagePath: file?.storagePath ?? null,
  }
}

export function isKwpMeasurementAttachment(file) {
  return ['SAMPLING_PHOTO', 'LAB_REPORT'].includes(file?.attachmentType)
}
