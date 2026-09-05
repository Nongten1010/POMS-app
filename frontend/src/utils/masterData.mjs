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
