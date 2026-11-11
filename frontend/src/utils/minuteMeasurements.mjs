export function getMeasurementHour(time) {
  const match = /^(\d{2})[:.][0-5]\d/.exec(String(time ?? ''))
  const hour = match ? Number(match[1]) : -1
  return hour >= 0 && hour <= 23 ? hour : null
}

export async function fetchMinuteMeasurements({ url, accessToken, context, signal, fetchImpl = fetch }) {
  if (!accessToken) throw new Error('กรุณาเข้าสู่ระบบใหม่')
  let response
  try {
    response = await fetchImpl(url, { signal, cache: 'no-store', headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` } })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบการเชื่อมต่อแล้วเปิดใหม่')
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const messages = {
      400: 'ข้อมูลจุดตรวจวัด วันที่ หรือชั่วโมงไม่ถูกต้อง กรุณาปิดแล้วเลือกใหม่',
      401: 'กรุณาเข้าสู่ระบบใหม่',
      403: 'ไม่มีสิทธิ์ดูข้อมูลรายนาทีของจุดตรวจวัดนี้',
      404: 'ข้อมูลรายนาทียังไม่พร้อมใช้งาน',
      503: 'ข้อมูลรายนาทียังไม่พร้อมใช้งาน กรุณาให้ผู้ดูแลตรวจสอบหน่วยของพารามิเตอร์',
    }
    if (response.status === 429) {
      const retry = response.headers.get('Retry-After')
      const seconds = /^\d+$/.test(retry ?? '') ? Number(retry) : Math.ceil((Date.parse(retry) - Date.now()) / 1000)
      throw new Error(Number.isFinite(seconds) && seconds > 0
        ? `เรียกข้อมูลถี่เกินไป กรุณารออย่างน้อย ${seconds} วินาทีก่อนเปิดใหม่`
        : 'เรียกข้อมูลถี่เกินไป กรุณารอสักครู่แล้วเปิดใหม่')
    }
    throw new Error(messages[response.status] ?? 'ไม่สามารถโหลดข้อมูลรายนาทีได้ กรุณาปิดแล้วเปิดใหม่')
  }
  const data = payload?.data
  const hour = String(context.hour).padStart(2, '0')
  if (payload?.success !== true || !data || data.date !== context.date || data.hour !== hour
    || data.timezone !== 'Asia/Bangkok' || typeof data.stationId !== 'string' || typeof data.pointName !== 'string'
    || !Array.isArray(data.parameters) || !data.parameters.every((p) => typeof p === 'string' && p.length > 0)
    || new Set(data.parameters).size !== data.parameters.length
    || !Array.isArray(data.rows) || data.rows.length !== 60
    || !data.rows.every((row, minute) => row?.time === `${hour}:${String(minute).padStart(2, '0')}` && row.values && data.parameters.every((p) => {
      const cell = row.values[p]
      return cell && (cell.value === null || typeof cell.value === 'number' || typeof cell.value === 'string')
        && (cell.status === null || typeof cell.status === 'string')
    }))
    || payload.meta?.interval !== '1m' || !Number.isInteger(payload.meta?.minutesWithData)
    || payload.meta.minutesWithData < 0 || payload.meta.minutesWithData > 60) {
    throw new Error('ข้อมูลรายนาทีที่ได้รับไม่ถูกต้อง กรุณาปิดแล้วเปิดใหม่')
  }
  return { data, meta: payload.meta }
}

export function displayMinuteValue(value) {
  return value === null || value === undefined || value === '' ? '-' : String(value)
}
