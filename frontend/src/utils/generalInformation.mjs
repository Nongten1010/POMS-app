export const regions = ['ภาคเหนือ', 'ภาคกลาง', 'ภาคตะวันออกเฉียงเหนือ', 'ภาคตะวันตก', 'ภาคตะวันออก', 'ภาคใต้']

export function canViewGeneralInformation(userType, roleCodes = []) {
  return userType === 'officer' || userType === 'admin' || roleCodes.includes('admin')
}

export function formatSummaryNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value) : '-'
}

const countFields = ['factoryCount', 'pointCount']
const flowFields = ['average', 'min', 'max']

// Reject incomplete aggregates instead of presenting missing values as zero.
export function validateGeneralInformation(data, systemType) {
  if (!data || data.systemType !== systemType || !Number.isFinite(Date.parse(data.generatedAt))) throw new Error('รูปแบบข้อมูลสรุปไม่ถูกต้อง')
  const checkRows = (rows, fields) => {
    if (!Array.isArray(rows)) throw new Error('ข้อมูลสรุปไม่ครบถ้วน')
    rows.forEach((row) => {
      if (!row || typeof row.label !== 'string' || !row.label.trim()) throw new Error('ข้อมูลสรุปไม่ครบถ้วน')
      fields.forEach((field) => {
        const value = row[field]
        if (fields === flowFields && value === null) return
        if (typeof value !== 'number' || !Number.isFinite(value) || (fields === countFields && (!Number.isInteger(value) || value < 0))) throw new Error('ค่าข้อมูลสรุปไม่ถูกต้อง')
      })
    })
  }
  checkRows(data.regions, countFields)
  checkRows(data.estates, countFields)
  checkRows(data.parameters, countFields)
  checkRows(data.flowRates, flowFields)
  checkRows([data.total], countFields)
  checkRows([data.flowTotal], flowFields)
  for (const rows of [data.regions, data.flowRates]) {
    if (rows.length !== regions.length || regions.some((label) => rows.filter((row) => row.label === label).length !== 1)) throw new Error('ข้อมูลภาคไม่ครบถ้วน')
  }
  if (data.estates.length !== 2 || ['ในนิคมฯ', 'นอกนิคมฯ'].some((label) => !data.estates.some((row) => row.label === label))) throw new Error('ข้อมูลนิคมไม่ครบถ้วน')
  return data
}

export function summarySections(data, systemType) {
  const countHeaders = ['รายการ', 'โรงงาน', systemType === 'CEMS' ? 'ปล่อง' : 'จุด']
  const counts = (row) => [row.label, row.factoryCount, row.pointCount]
  const ordered = (rows) => regions.map((label) => rows.find((row) => row.label === label))
  const flow = (row) => [row.label, row.average, row.min, row.max]
  const unit = systemType === 'CEMS' ? 'm³/hr' : 'm³/d'
  return [
    { title: '1. จำนวนโรงงานที่ติดตั้ง แยกตามภาค', headers: countHeaders, rows: data ? [...ordered(data.regions).map(counts), ['ทั่วประเทศ', data.total.factoryCount, data.total.pointCount]] : [], total: true },
    { title: '2. จำนวนโรงงานในนิคมอุตสาหกรรมและนอกนิคมอุตสาหกรรม', headers: countHeaders, rows: data ? data.estates.map((row) => [row.label === 'ในนิคมฯ' ? 'ในนิคมอุตสาหกรรม' : row.label === 'นอกนิคมฯ' ? 'นอกนิคมอุตสาหกรรม' : row.label, row.factoryCount, row.pointCount]) : [] },
    { title: '3. จำนวนตามพารามิเตอร์ที่ตรวจวัด', headers: countHeaders, rows: data ? data.parameters.map(counts) : [] },
    { title: `4. ปริมาณอัตราการระบาย${systemType === 'CEMS' ? 'อากาศ' : 'น้ำทิ้ง'}`, headers: ['ภาค', `เฉลี่ย (${unit})`, `ต่ำสุด (${unit})`, `สูงสุด (${unit})`], rows: data ? [...ordered(data.flowRates).map(flow), ['ทั่วประเทศ', data.flowTotal.average, data.flowTotal.min, data.flowTotal.max]] : [], total: true },
  ]
}

export async function fetchGeneralInformation({ systemType, accessToken, signal, isDevelopment = false, fetchImpl = fetch }) {
  const prefix = isDevelopment ? '/api-proxy/v1' : '/api/v1'
  const response = await fetchImpl(`${prefix}/general-information?systemType=${systemType}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal,
  })
  if (response.status === 404 || response.status === 501) return null
  if (!response.ok) throw new Error(response.status === 403 ? 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' : response.status === 401 ? 'กรุณาเข้าสู่ระบบใหม่' : 'ไม่สามารถโหลดข้อมูลสรุปได้ กรุณาลองใหม่')
  const body = await response.json()
  if (body.success !== true) throw new Error('ไม่สามารถโหลดข้อมูลสรุปได้ กรุณาลองใหม่')
  return validateGeneralInformation(body.data, systemType)
}
