export function isAccessAdministrator(userType, roleCodes = []) {
  return userType === 'admin' || roleCodes.includes('admin')
}

export function canGrantOperatorAccess(factory, data) {
  return Boolean(factory?.eligibleFactoryId) && data?.factory?.operationStatus === 'ยังไม่แจ้งประกอบ'
    && data?.capabilities?.canGrant === true
}

export function optionalAccessReason(reason) {
  const value = reason.trim()
  return value ? { reason: value } : {}
}

export function maskCitizenId(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length === 13 || (/[*xX]/.test(String(value)) && digits.length === 4) ? `*********${digits.slice(-4)}` : '-'
}

// Proposed integration only: enable after Backend publishes and confirms the contract.
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
      if (result.status === 401) throw new Error('กรุณาเข้าสู่ระบบใหม่')
      if (result.status === 403) throw new Error('ไม่มีสิทธิ์ดำเนินการรายการนี้')
      if (result.status === 409) throw new Error('ข้อมูลสิทธิ์หรือสถานะโรงงานเปลี่ยนแปลง กรุณารีเฟรชรายการ')
      throw new Error(method === 'GET' ? 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่' : 'ไม่สามารถยืนยันผลการบันทึกได้ กรุณารีเฟรชรายการก่อนทำซ้ำ')
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
      const data = await request(`${factoryPath(id)}/candidates?query=${encodeURIComponent(query)}`, { signal })
      if (!Array.isArray(data.items)) throw new Error('ข้อมูลผู้ประกอบการไม่ถูกต้อง')
      return data.items
    },
    grant: (id, userId, reason) => request(factoryPath(id), { method: 'POST', body: { userId, ...optionalAccessReason(reason) } }),
    revoke: (id, grantId, reason) => request(`${factoryPath(id)}/${encodeURIComponent(grantId)}/revoke`, { method: 'POST', body: optionalAccessReason(reason) }),
  }
}
