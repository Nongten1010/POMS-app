import { buildContentApiHeaders, getContentApiUrl, readContentApiResponse } from './contentApi.mjs'

const factoryFields = [
  'factoryId', 'factoryName', 'factoryRegistrationNo',
  'industryMainOrder', 'industryMainOrderLabel', 'industrySubOrder', 'businessActivity',
  'eia', 'eiaOther', 'hasEia', 'projectName', 'address', 'latitude', 'longitude',
  'regionCode', 'regionName', 'provinceCode', 'provinceName', 'districtCode', 'districtName',
  'subdistrictCode', 'subdistrictName', 'industrialEstateCode', 'industrialEstateName',
]
const photoTitle = 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน'
const logoTitle = 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท'

export function getPreviousConnectionRequestUrl(factoryId, isDevelopment) {
  const id = String(factoryId ?? '').trim()
  if (!id || id.length > 64) throw new Error('ไม่พบรหัสโรงงานที่ถูกต้องสำหรับโหลดคำขอก่อนหน้า')
  return `${getContentApiUrl('cems-wpms-requests/factories', id, isDevelopment)}/previous-request`
}

export async function loadPreviousConnectionRequest(factoryId, accessToken, { signal, isDevelopment } = {}) {
  if (!accessToken) throw new Error('กรุณาเข้าสู่ระบบเพื่อโหลดข้อมูลคำขอก่อนหน้า')
  const response = await fetch(getPreviousConnectionRequestUrl(factoryId, isDevelopment), {
    signal,
    headers: buildContentApiHeaders(accessToken, { Accept: 'application/json' }),
  })
  const payload = await readContentApiResponse(response, 'โหลดข้อมูลคำขอก่อนหน้าไม่สำเร็จ กรุณาลองใหม่')
  if (payload?.data?.hasPreviousRequest === false) return null
  if (payload?.data?.hasPreviousRequest !== true || !payload.data.formData
    || typeof payload.data.formData !== 'object' || Array.isArray(payload.data.formData)) {
    throw new Error('ข้อมูลคำขอก่อนหน้าไม่ครบถ้วน กรุณาลองใหม่')
  }
  if (String(payload.data.formData.factoryId).trim() !== String(factoryId).trim()) {
    throw new Error('ข้อมูลคำขอก่อนหน้าไม่ตรงกับโรงงานที่เลือก')
  }
  return payload.data.formData
}

export function buildPreviousConnectionRequestPrefill(factory, formData) {
  if (!formData) return { factory, previousRequestFormData: null }
  const snapshot = Object.fromEntries(factoryFields.map((field) => [field, formData[field] ?? null]))
  const document = (item, title) => ({
    title,
    ...Object.fromEntries(['description', 'link', 'fileName', 'fileUrl', 'fileType', 'fileSize']
      .map((field) => [field, item[field] ?? null])),
  })
  const documentsAndImages = [
    ...(Array.isArray(formData.factoryFrontPhotos) ? formData.factoryFrontPhotos : [])
      .map((item) => document(item, photoTitle)),
    ...(formData.factoryLogo ? [document(formData.factoryLogo, logoTitle)] : []),
  ]
  const contactPersons = Array.isArray(formData.contactPersons) && formData.contactPersons.length
    ? formData.contactPersons
    : formData.contactName || formData.contactPhone
      ? [{ name: formData.contactName ?? '', phone: formData.contactPhone ?? '', email: formData.contactEmail ?? null, position: null }]
      : []
  return {
    factory: {
      ...factory,
      ...snapshot,
      newRegistrationNo: snapshot.factoryId,
      oldRegistrationNo: snapshot.factoryRegistrationNo,
      province: snapshot.provinceName,
      industryType: snapshot.businessActivity,
    },
    previousRequestFormData: {
      contactPersons,
      notificationEmails: Array.isArray(formData.notificationEmails) ? formData.notificationEmails : [],
      documentsAndImages,
    },
  }
}
