export const EIA_ASSESSMENT_OPTIONS = ['ไม่มี', 'มี IEE', 'มี EIA', 'มี EHIA', 'อื่นๆ']

export function getEiaAssessmentValue(factory = {}) {
  const value = String(factory?.eia ?? '').trim()
  return value === 'มี' ? '' : value
}

export function getEiaAssessmentFormState(previous, factory, sessionKey) {
  const value = getEiaAssessmentValue(factory)
  const sourceKey = JSON.stringify([sessionKey, factory?.factoryId ?? factory?.id ?? null, value])
  return previous?.sourceKey === sourceKey ? previous : { sourceKey, value }
}

export function getEnvironmentalAssessmentValues(...sources) {
  const read = (key) => {
    const source = sources.find((item) => item && Object.hasOwn(item, key))
    return source?.[key] ?? null
  }
  return { eia: read('eia'), eiaOther: read('eiaOther'), projectName: read('projectName') }
}

export function buildConnectionEnvironmentalAssessment(formData, factory = {}, { readOnly = false } = {}) {
  if (readOnly) return getEnvironmentalAssessmentValues(factory)
  const read = (key) => String((formData?.has(key) ? formData.get(key) : factory?.[key]) ?? '').trim()
  const eia = getEiaAssessmentValue({ eia: read('eia') }) || null
  const eiaOther = eia === 'อื่นๆ' ? read('eiaOther') || null : null
  const projectName = read('projectName') || null
  if (eia !== null && !EIA_ASSESSMENT_OPTIONS.includes(eia)) {
    throw new Error('การประเมินผลกระทบสิ่งแวดล้อมไม่ถูกต้อง')
  }
  if (eia === 'อื่นๆ' && !eiaOther) {
    throw new Error('กรุณาระบุการประเมินผลกระทบสิ่งแวดล้อมอื่นๆ')
  }
  if (eiaOther?.length > 500 || projectName?.length > 500) {
    throw new Error('ชื่อโครงการและรายละเอียดอื่นๆ ต้องไม่เกิน 500 ตัวอักษร')
  }
  return { eia, eiaOther, projectName }
}
