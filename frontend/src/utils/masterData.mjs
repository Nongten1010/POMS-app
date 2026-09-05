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
