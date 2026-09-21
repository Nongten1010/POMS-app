export const bodCodDeviationReportsApiBaseUrl = import.meta.env?.DEV
  ? '/api-proxy/v1/bod-cod-deviation-reports'
  : 'https://d-poms.diw.go.th/api/v1/bod-cod-deviation-reports'

export async function readBodCodApiResponse(result, fallbackMessage) {
  const rawText = await result.text()
  let response
  try { response = rawText ? JSON.parse(rawText) : null } catch { response = null }
  if (!result.ok || response?.success === false) {
    const error = new Error(response?.error?.message ?? response?.message ?? `${fallbackMessage} (${result.status} ${result.statusText})`)
    error.status = result.status
    error.code = response?.error?.code
    error.details = response?.error?.details
    throw error
  }
  if (!response || typeof response !== 'object') throw new Error(`${fallbackMessage}: รูปแบบข้อมูลตอบกลับไม่ถูกต้อง`)
  return response
}

export async function cancelBodCodReport(id, accessToken, fetchImpl = fetch) {
  if (!accessToken) throw new Error('กรุณาเข้าสู่ระบบเพื่อยกเลิกคำขอ')
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new Error('ไม่พบรหัสคำขอที่ถูกต้อง')
  const result = await fetchImpl(`${bodCodDeviationReportsApiBaseUrl}/${Number(id)}/cancel`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
  })
  const response = await readBodCodApiResponse(result, 'ยกเลิกคำขอไม่สำเร็จ')
  if (Number(response.data?.id) !== Number(id) || response.data?.statusCode !== 'CANCELLED') {
    throw new Error('ไม่พบผลยืนยันการยกเลิก กรุณาตรวจสอบสถานะล่าสุดก่อนดำเนินการอีกครั้ง')
  }
  return response.data
}
