export const FAQ_FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt'
export const FAQ_MAX_FILES = 10
export const FAQ_MAX_LINKS = 20
const MAX_FILE_SIZE = 10 * 1024 * 1024
const extensions = new Set(FAQ_FILE_ACCEPT.split(','))

export function getFaqLink(value) {
  if (typeof value !== 'string') return ''
  const link = value.trim()
  if (!/^https?:\/\//i.test(link) || link.length > 2048) return ''
  try {
    const url = new URL(link)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? link : ''
  } catch {
    return ''
  }
}

export function getFaqAttachmentErrors({ files = [], attachments = [], links = [] }) {
  const errors = {}
  if (files.length + attachments.length > FAQ_MAX_FILES) {
    errors.files = 'แนบไฟล์รวมได้ไม่เกิน 10 ไฟล์'
  } else {
    for (const file of files) {
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      if (!extensions.has(extension)) {
        errors.files = 'รองรับเฉพาะ PDF, DOC, DOCX, XLS, XLSX, PNG, JPG/JPEG และ TXT'
      } else if (file.name.length > 255) {
        errors.files = 'ชื่อไฟล์ต้องยาวไม่เกิน 255 ตัวอักษร'
      } else if (file.size < 1 || file.size > MAX_FILE_SIZE) {
        errors.files = 'ไฟล์ต้องไม่ว่างและมีขนาดไม่เกิน 10 MB ต่อไฟล์'
      }
      if (errors.files) break
    }
  }
  const populatedLinks = links.filter((link) => link.trim())
  if (populatedLinks.length > FAQ_MAX_LINKS) {
    errors.links = 'เพิ่มลิงก์ได้ไม่เกิน 20 รายการ'
  } else if (populatedLinks.some((link) => !getFaqLink(link))) {
    errors.links = 'ลิงก์ต้องเป็น HTTP/HTTPS ไม่มีชื่อผู้ใช้หรือรหัสผ่าน และไม่เกิน 2,048 ตัวอักษร'
  }
  return errors
}

export function getFaqEditForm(faq) {
  return {
    question: faq.question,
    answer: faq.answer,
    category: faq.category,
    updatedDate: faq.updatedDate,
    attachments: [...(faq.attachments ?? [])],
    files: [],
    links: faq.links?.length ? [...faq.links] : [''],
  }
}

export function buildFaqFormData(form) {
  const body = new FormData()
  body.append('question', form.question.trim())
  body.append('answer', form.answer.trim())
  body.append('category', form.category)
  body.append('updatedDate', form.updatedDate)
  body.append('links', JSON.stringify(form.links.map((link) => link.trim()).filter(Boolean)))
  body.append('attachmentIds', JSON.stringify(form.attachments.map((file) => file.id)))
  form.files.forEach((file) => body.append('files', file))
  return body
}
