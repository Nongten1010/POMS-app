export function isAccessAdministrator(userType, roleCodes = []) {
  return userType === 'admin' || roleCodes.includes('admin')
}

export function canGrantOperatorAccess(factory, data) {
  return Boolean(factory?.eligibleFactoryId) && data?.factory?.operationStatus === 'ยังไม่แจ้งประกอบ'
    && data?.capabilities?.canGrant === true
}

export function optionalAccessReason(reason) {
  const value = reason.trim()
  if (value.length > 1000) throw new Error('เหตุผลต้องไม่เกิน 1,000 ตัวอักษร')
  return value ? { reason: value } : {}
}

export function accessSearchError(query) {
  const value = query.trim()
  if (value.length < 2 || value.length > 100) return 'กรุณาระบุชื่อ 2–100 ตัวอักษร หรือเลขบัตรประชาชนครบ 13 หลัก'
  if (/^[0-9]+$/.test(value) && value.length !== 13) return 'กรุณาระบุเลขบัตรประชาชนครบ 13 หลัก'
  return ''
}

export function accessUnavailableMessage(code) {
  return {
    SOURCE_STATUS_UNVERIFIED: 'ยังไม่สามารถยืนยันสถานะโรงงานจากต้นทางได้ กรุณารีเฟรชเพื่อตรวจสอบอีกครั้ง',
    FACTORY_NOT_NOT_STARTED: 'เพิ่มสิทธิ์ได้เฉพาะโรงงานสถานะยังไม่แจ้งประกอบ',
  }[code] ?? 'ยังไม่สามารถเพิ่มสิทธิ์ได้ กรุณารีเฟรชเพื่อตรวจสอบสถานะโรงงาน'
}

function accessRequestError(status, response, method) {
  if (status === 400) return 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบคำค้นหรือข้อมูลที่กรอก'
  if (status === 401) return 'กรุณาเข้าสู่ระบบใหม่'
  if (status === 403) return 'ไม่มีสิทธิ์ดำเนินการรายการนี้'
  if (status === 404) return 'ไม่พบโรงงาน บัญชี หรือรายการสิทธิ์ที่เข้าถึงได้ กรุณารีเฟรชรายการ'
  if (status === 503) return 'ระบบจัดการผู้มีสิทธิ์ยังไม่เปิดให้บริการ กรุณาลองใหม่ภายหลัง'
  if (status === 409) {
    const reason = response?.error?.details?.reason
    if (reason === 'DUPLICATE_GRANT') return 'บัญชีนี้มีสิทธิ์ผูกกับโรงงานแล้ว กรุณารีเฟรชรายการ'
    if (['SOURCE_STATUS_UNVERIFIED', 'FACTORY_NOT_NOT_STARTED'].includes(reason)) return accessUnavailableMessage(reason)
    return 'ข้อมูลสิทธิ์หรือสถานะโรงงานเปลี่ยนแปลง กรุณารีเฟรชรายการ'
  }
  return method === 'GET' ? 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่' : 'ไม่สามารถยืนยันผลการบันทึกได้ กรุณารีเฟรชรายการก่อนทำซ้ำ'
}

export function maskCitizenId(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length === 13 || (/[*xX]/.test(String(value)) && digits.length === 4) ? `*********${digits.slice(-4)}` : '-'
}

// Contract: docs/backend/api/menus/eligible-factories/operator-access.md.
export function createEligibleOperatorAccessApi({ accessToken, enabled = false, isDevelopment = false, fetchImpl = fetch }) {
  const prefix = isDevelopment ? '/api-proxy/v1' : '/api/v1'
  const request = async (path, { method = 'GET', body, signal } = {}) => {
    if (!enabled) throw new Error('ระบบจัดการผู้มีสิทธิ์ยังไม่เปิดให้บริการ')
    const result = await fetchImpl(`${prefix}${path}`, {
      method, signal, headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }).catch((error) => {
      if (error.name === 'AbortError') throw error
      throw new Error(method === 'GET' ? 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่' : 'ไม่สามารถยืนยันผลการบันทึกได้ กรุณารีเฟรชรายการก่อนทำซ้ำ')
    })
    const response = await result.json().catch(() => null)
    if (!result.ok || response?.success !== true || !response.data) {
      throw new Error(accessRequestError(result.status, response, method))
    }
    return response.data
  }
  const factoryPath = (id) => `/eligible-factories/${encodeURIComponent(id)}/operator-access`
  return {
    list: async (id, signal) => {
      const data = await request(factoryPath(id), { signal })
      if (!Array.isArray(data.items) || !Array.isArray(data.history) || !data.factory || !data.capabilities) throw new Error('ข้อมูลสิทธิ์ไม่ครบถ้วน')
      return data
    },
    search: async (id, query, signal) => {
      const validationError = accessSearchError(query)
      if (validationError) throw new Error(validationError)
      const data = await request(`${factoryPath(id)}/candidates?query=${encodeURIComponent(query.trim())}`, { signal })
      if (!Array.isArray(data.items)) throw new Error('ข้อมูลผู้ประกอบการไม่ถูกต้อง')
      return data.items
    },
    grant: (id, userId, reason) => request(factoryPath(id), { method: 'POST', body: { userId, ...optionalAccessReason(reason) } }),
    revoke: (id, grantId, reason) => request(`${factoryPath(id)}/${encodeURIComponent(grantId)}/revoke`, { method: 'POST', body: optionalAccessReason(reason) }),
  }
}
