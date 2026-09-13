export function buildEligibleFactoryAddRequestDraft(values = {}) {
  const errors = {}
  const rules = [
    ['factoryId', 'รหัสโรงงาน', 64, true],
    ['reason', 'เหตุผล', 1000, true],
    ['contactName', 'ชื่อ-นามสกุล', 255, false],
    ['contactPhone', 'เบอร์โทร', 64, false],
  ]
  const payload = {}

  for (const [field, label, maxLength, required] of rules) {
    const raw = values[field]
    if (raw != null && typeof raw !== 'string') {
      errors[field] = `${label}ต้องเป็นข้อความ`
      continue
    }
    const value = (raw ?? '').trim()
    payload[field] = value || (required ? '' : null)
    if (required && !value) errors[field] = `กรุณาระบุ${label}`
    else if (value.length > maxLength) errors[field] = `${label}ต้องมีความยาวไม่เกิน ${maxLength.toLocaleString('en-US')} ตัวอักษร`
  }

  return { payload, errors }
}
