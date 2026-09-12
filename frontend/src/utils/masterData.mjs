export const CANCELLABLE_FACTORY_EDIT_REQUEST_STATUSES = [
  'PENDING_REVIEW',
  'REVISION_REQUESTED',
  'REVISED_PENDING_REVIEW',
]

const statusLabels = {
  PENDING_REVIEW: 'รอพิจารณา',
  REVISION_REQUESTED: 'รอโรงงานแก้ไข',
  REVISED_PENDING_REVIEW: 'แก้ไขแล้ว/รอพิจารณา',
  APPROVED: 'อนุมัติ',
  REJECTED: 'ไม่อนุมัติ',
  CANCELLED: 'ยกเลิก',
  'ส่งกลับให้แก้ไข': 'รอโรงงานแก้ไข',
  'แก้ไขแล้ว รอพิจารณา': 'แก้ไขแล้ว/รอพิจารณา',
  อนุมัติแล้ว: 'อนุมัติ',
}

export function getFactoryEditRequestStatusLabel(status, label = '') {
  const normalizedStatus = String(status ?? '').trim()
  const normalizedLabel = String(label ?? '').trim()
  const mappedLabel = statusLabels[normalizedStatus] ?? statusLabels[normalizedLabel]

  return mappedLabel || normalizedLabel || normalizedStatus || '-'
}

export function canCancelFactoryEditRequest(status) {
  return CANCELLABLE_FACTORY_EDIT_REQUEST_STATUSES.includes(String(status ?? '').trim())
}

export function formatFactoryEditRequestDate(value) {
  const normalizedValue = String(value ?? '').trim()
  if (!normalizedValue || normalizedValue === '-') {
    return '-'
  }

  const date = new Date(normalizedValue)
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    }).format(date)
  }

  return normalizedValue.split(/[T\s]/, 1)[0]
}

export function normalizeOfficerNotificationEmails(values = []) {
  if (!Array.isArray(values)) {
    throw new Error('อีเมลสำหรับแจ้งเตือนเจ้าหน้าที่ต้องเป็นรายการ')
  }

  const emails = values
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter(Boolean)

  if (emails.length > 20) {
    throw new Error('อีเมลสำหรับแจ้งเตือนเจ้าหน้าที่ต้องไม่เกิน 20 รายการ')
  }

  emails.forEach((email, index) => {
    if (email.length > 254) {
      throw new Error(`อีเมลสำหรับแจ้งเตือนเจ้าหน้าที่รายการที่ ${index + 1} ต้องไม่เกิน 254 ตัวอักษร`)
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`อีเมลสำหรับแจ้งเตือนเจ้าหน้าที่รายการที่ ${index + 1} ไม่ถูกต้อง`)
    }
  })

  return [...new Set(emails)]
}

const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024
const allowedDocumentTypes = new Set(['image/jpeg', 'image/png', 'application/pdf'])
const allowedDocumentExtensions = ['.jpg', '.jpeg', '.png', '.pdf']

export function getFactoryDocumentFileError(file) {
  if (!file) {
    return 'กรุณาเลือกไฟล์'
  }

  const fileName = String(file.name ?? '').toLowerCase()
  const hasAllowedExtension = allowedDocumentExtensions.some((extension) => fileName.endsWith(extension))

  if (!allowedDocumentTypes.has(file.type) || !hasAllowedExtension) {
    return 'รองรับเฉพาะไฟล์ JPEG, PNG หรือ PDF'
  }

  if (!Number.isFinite(file.size) || file.size < 1) {
    return 'ไฟล์ต้องไม่เป็นไฟล์ว่าง'
  }

  if (file.size > MAX_DOCUMENT_SIZE) {
    return 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB'
  }

  return ''
}

export function buildFactoryDocumentPatch({
  frontPhotosChanged = false,
  frontPhotos = [],
  logoChanged = false,
  logo = null,
} = {}) {
  return {
    ...(frontPhotosChanged ? { factoryFrontPhotos: frontPhotos } : {}),
    ...(logoChanged ? { factoryLogo: logo } : {}),
  }
}

export const FACTORY_BASIC_INFO_EIA_OPTIONS = ['มี', 'ไม่มี', 'มี IEE', 'มี EIA', 'มี EHIA', 'อื่นๆ']

function nullableText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function nullableNumber(value, label, min, max) {
  const text = String(value ?? '').trim()
  if (!text) {
    return null
  }

  const number = Number(text)
  if (!Number.isFinite(number)) {
    throw new Error(`${label}ต้องเป็นตัวเลข`)
  }
  if (number < min || number > max) {
    throw new Error(`${label}ต้องอยู่ระหว่าง ${min} ถึง ${max}`)
  }

  return number
}

function valuesEqual(left, right) {
  return left === right || (left == null && right == null)
}

export function buildFactoryEditableProfilePatch({
  initial = {},
  values = {},
  documentPatch = {},
  isResubmission = false,
  requireChange = true,
} = {}) {
  const eia = nullableText(values.eia)
  const initialEia = nullableText(initial.eia)
  const projectName = nullableText(values.projectName)
  const initialProjectName = nullableText(initial.projectName)
  const eiaOther = nullableText(values.eiaOther)
  const initialEiaOther = nullableText(initial.eiaOther)
  const latitudeText = String(values.latitude ?? '').trim()
  const longitudeText = String(values.longitude ?? '').trim()

  if (eia !== null && !FACTORY_BASIC_INFO_EIA_OPTIONS.includes(eia)) {
    throw new Error('การประเมินผลกระทบสิ่งแวดล้อมไม่ถูกต้อง')
  }
  if (projectName && projectName.length > 500) {
    throw new Error('ชื่อโครงการต้องไม่เกิน 500 ตัวอักษร')
  }
  if (eiaOther && eiaOther.length > 500) {
    throw new Error('ข้อมูลอื่นๆ ต้องไม่เกิน 500 ตัวอักษร')
  }
  if (eia === 'อื่นๆ' && !eiaOther) {
    throw new Error('กรุณาระบุข้อมูลอื่นๆ ของการประเมินผลกระทบสิ่งแวดล้อม')
  }
  if ((latitudeText && !longitudeText) || (!latitudeText && longitudeText)) {
    throw new Error('กรุณาระบุละติจูดและลองจิจูดให้ครบทั้งสองช่อง')
  }

  const latitude = nullableNumber(latitudeText, 'ละติจูด', -90, 90)
  const longitude = nullableNumber(longitudeText, 'ลองจิจูด', -180, 180)
  const initialLatitude = nullableNumber(initial.latitude, 'ละติจูด', -90, 90)
  const initialLongitude = nullableNumber(initial.longitude, 'ลองจิจูด', -180, 180)
  const payload = {}
  const eiaChanged = !valuesEqual(eia, initialEia)
  const eiaOtherChanged = !valuesEqual(eiaOther, initialEiaOther)

  if (isResubmission || eiaChanged || (eia === 'อื่นๆ' && eiaOtherChanged)) {
    payload.eia = eia
  }
  if (eia === 'อื่นๆ' && (isResubmission || eiaChanged || eiaOtherChanged)) {
    payload.eiaOther = eiaOther
  }
  if (isResubmission || !valuesEqual(projectName, initialProjectName)) {
    payload.projectName = projectName
  }
  if (
    isResubmission
    || !valuesEqual(latitude, initialLatitude)
    || !valuesEqual(longitude, initialLongitude)
  ) {
    payload.latitude = latitude
    payload.longitude = longitude
  }

  Object.assign(payload, documentPatch)

  if (requireChange && Object.keys(payload).length === 0) {
    throw new Error('กรุณาแก้ไขข้อมูลอย่างน้อย 1 รายการก่อนบันทึก')
  }

  return payload
}

export function buildFactoryBasicInfoPayload(options = {}) {
  return {
    formType: 'BASIC_INFO',
    ...buildFactoryEditableProfilePatch(options),
  }
}

export function getStatusManagementSelection(scope = {}, { parameter = false } = {}) {
  if (!parameter && scope.connectionStatus === 'DISCONNECTED') {
    return 'DISCONNECTED'
  }
  return scope.visibility === 'HIDDEN' ? 'HIDDEN' : 'VISIBLE'
}

function buildScopeStatusPatch(selection) {
  if (selection === 'VISIBLE') {
    return { visibility: 'VISIBLE', connectionStatus: 'CONNECTED' }
  }
  if (selection === 'HIDDEN') {
    return { visibility: 'HIDDEN', connectionStatus: 'CONNECTED' }
  }
  if (selection === 'DISCONNECTED') {
    return { connectionStatus: 'DISCONNECTED' }
  }
  throw new Error('สถานะไม่ถูกต้อง')
}

export function buildStatusManagementPayload({ initial = {}, factoryStatus, measurementPoints = [] } = {}) {
  const payload = {
    expectedRevision: initial.revision,
  }
  if (factoryStatus !== getStatusManagementSelection(initial.factory)) {
    payload.factory = buildScopeStatusPatch(factoryStatus)
  }

  const initialPoints = Array.isArray(initial.measurementPoints) ? initial.measurementPoints : []
  const pointPatches = measurementPoints.flatMap((point) => {
    const initialPoint = initialPoints.find((item) => item.connectedPointId === point.connectedPointId)
    if (!initialPoint) {
      return []
    }

    const pointPatch = { connectedPointId: point.connectedPointId }
    if (point.status !== getStatusManagementSelection(initialPoint)) {
      Object.assign(pointPatch, buildScopeStatusPatch(point.status))
    }

    const initialParameters = Array.isArray(initialPoint.parameters) ? initialPoint.parameters : []
    const parameterPatches = point.parameters.flatMap((parameter) => {
      const initialParameter = initialParameters.find((item) => item.parameter === parameter.parameter)
      if (!initialParameter || parameter.status === getStatusManagementSelection(initialParameter, { parameter: true })) {
        return []
      }
      return [{ parameter: parameter.parameter, visibility: parameter.status }]
    })
    if (parameterPatches.length > 0) {
      pointPatch.parameters = parameterPatches
    }

    return Object.keys(pointPatch).length > 1 ? [pointPatch] : []
  })
  if (pointPatches.length > 0) {
    payload.measurementPoints = pointPatches
  }

  if (!payload.factory && !payload.measurementPoints) {
    throw new Error('กรุณาเปลี่ยนสถานะอย่างน้อย 1 รายการก่อนบันทึก')
  }

  return payload
}

// Current POMS display status is independent from connection-request workflow status.
export function getPomsDisplayStatus(point = {}) {
  const connection = point.effectiveConnectionStatus ?? point.connectionStatus
  const visibility = point.effectiveVisibility ?? point.visibility
  if (connection === 'DISCONNECTED') return 'ยกเลิกการเชื่อมต่อ'
  if (visibility === 'HIDDEN') return 'ซ่อน'
  if (visibility === 'VISIBLE' || connection === 'CONNECTED') return 'แสดง'
  return ['แสดง', 'ซ่อน', 'ยกเลิกการเชื่อมต่อ'].includes(point.status) ? point.status : 'แสดง'
}
