export const menuBadgeKeys = ['factories', 'connection', 'kwp_forms', 'bod_cod_errors', 'eligible_factories', 'notifications']

export async function fetchMenuBadges({ url, accessToken, signal, fetchImpl = fetch }) {
  const result = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal,
  })
  if (!result.ok) {
    const error = new Error(result.status === 401
      ? 'ไม่สามารถโหลดการแจ้งเตือนได้ กรุณาเข้าสู่ระบบใหม่'
      : result.status === 429
        ? 'เรียกข้อมูลบ่อยเกินไป กรุณารอสักครู่แล้วรีเฟรชอีกครั้ง'
        : 'โหลดการแจ้งเตือนไม่สำเร็จ กรุณารีเฟรชอีกครั้ง')
    if (result.status === 429) {
      const retry = result.headers.get('Retry-After')
      error.retryAt = retry && Number.isFinite(Number(retry))
        ? Date.now() + Number(retry) * 1000
        : Date.parse(retry) || Date.now() + 60000
    }
    throw error
  }
  const response = await result.json()
  if (response?.success !== true || !menuBadgeKeys.every((key) => typeof response.data?.[key] === 'boolean')) {
    throw new Error('ข้อมูลการแจ้งเตือนไม่ถูกต้อง กรุณารีเฟรชอีกครั้ง')
  }
  return Object.fromEntries(menuBadgeKeys.map((key) => [key, response.data[key]]))
}
