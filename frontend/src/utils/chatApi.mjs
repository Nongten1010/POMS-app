import { getContentApiUrl } from './contentApi.mjs'

export const formatChatDate = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }).format(new Date(value)) : '-'

export class ChatApiError extends Error {
  constructor(message, status = 0, code = '', details = null) {
    super(message)
    Object.assign(this, { status, code, details })
  }
}

export function errorText(error) {
  if (error.status === 401) return 'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่'
  if (error.status === 403) return 'ไม่มีสิทธิ์ใช้งาน Chat'
  if (error.status === 404) return 'ไม่พบข้อมูลหรือไม่มีสิทธิ์เข้าถึง'
  if (error.code === 'CHAT_TICKET_CLOSED') return 'การสนทนาถูกปิดแล้ว ข้อความที่ยังไม่ส่งยังคงอยู่'
  if (error.code === 'IDEMPOTENCY_KEY_CONFLICT') return 'คำขอเดิมไม่ตรงกับข้อมูลที่เคยส่ง กรุณาตรวจสอบกับผู้ดูแล ไม่ส่งซ้ำด้วยคำขอใหม่'
  if (error.status === 429) return `เรียกข้อมูลบ่อยเกินไป กรุณารอ ${Math.max(1, Math.ceil(((error.retryAt || Date.now() + 60000) - Date.now()) / 1000))} วินาทีแล้วลองอีกครั้ง`
  return error.message || 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองอีกครั้ง'
}

// Keep unresolved write intents separate from attempts, so retries never get a new key.
export function createChatClient(accessToken, { userType, fetchImpl = fetch, uuid = () => crypto.randomUUID(), base = getContentApiUrl('chat') } = {}) {
  const controllers = new Set()
  const pending = new Map()
  const writing = new Set()
  let retryAt = 0
  function assertCanCreate(path, body) {
    if (path === '/tickets' && body !== undefined && userType !== 'operator') {
      throw new ChatApiError('เฉพาะผู้ประกอบการเท่านั้นที่เปิดการสนทนาได้', 0, 'CHAT_CREATE_OPERATOR_ONLY')
    }
  }
  async function request(path, { query, body, key, signal } = {}) {
    assertCanCreate(path, body)
    if (Date.now() < retryAt) {
      const error = new ChatApiError(`กรุณารอ ${Math.ceil((retryAt - Date.now()) / 1000)} วินาที`, 429)
      error.retryAt = retryAt
      throw error
    }
    const controller = new AbortController()
    controllers.add(controller)
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    try {
      const params = new URLSearchParams(Object.entries(query || {}).filter(([, value]) => value !== '' && value != null))
      const result = await fetchImpl(`${base}${path}${params.size ? `?${params}` : ''}`, {
        method: body === undefined ? 'GET' : 'POST', signal: controller.signal, cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      const raw = await result.text()
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      let payload
      try { payload = JSON.parse(raw) } catch { payload = null }
      if (!result.ok || payload?.success !== true) {
        const error = new ChatApiError(payload?.error?.message || 'โหลดหรือบันทึกข้อมูลไม่สำเร็จ', result.status, payload?.error?.code, payload?.error?.details)
        if (result.status === 429) {
          const retry = result.headers.get('Retry-After')
          retryAt = retry && Number.isFinite(Number(retry)) ? Date.now() + Number(retry) * 1000 : Date.parse(retry) || Date.now() + 60000
          error.retryAt = retryAt
        }
        throw error
      }
      return payload
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof ChatApiError) throw error
      throw new ChatApiError('เชื่อมต่อระบบไม่สำเร็จ กรุณาลองส่งคำขอเดิมอีกครั้ง')
    } finally {
      controllers.delete(controller)
      signal?.removeEventListener('abort', abort)
    }
  }
  async function write(intent, path, body) {
    assertCanCreate(path, body)
    if (writing.has(intent)) throw new ChatApiError('กำลังส่งคำขอ กรุณารอสักครู่')
    let attempt = pending.get(intent)
    if (!attempt) { attempt = { key: uuid(), body: structuredClone(body) }; pending.set(intent, attempt) }
    writing.add(intent)
    try {
      const response = await request(path, { body: attempt.body, key: attempt.key })
      pending.delete(intent)
      return { ...response, sent: attempt.body }
    } catch (error) {
      // Unknown outcomes and key conflicts must retain the original payload/key.
      if ([400, 401, 403, 404, 413].includes(error.status) || error.code === 'CHAT_TICKET_CLOSED' || error.code === 'CHAT_TICKET_NUMBER_EXHAUSTED') pending.delete(intent)
      throw error
    } finally { writing.delete(intent) }
  }
  return { request, write, hasPending: (intent) => pending.has(intent),
    dispose() { controllers.forEach((controller) => controller.abort()); pending.clear() },
  }
}

export async function readAllChatFactories(client, signal) {
  const factories = new Map()
  let page = 1
  let response
  do {
    response = await client.request('/factories', { query: { page, pageSize: 25 }, signal })
    for (const factory of response.data) factories.set(factory.id, factory)
    page += 1
  } while (!signal?.aborted && page <= response.pagination.totalPages)
  return { ...response, data: [...factories.values()] }
}

export function mergeMessages(current, incoming) {
  return [...new Map([...current, ...incoming].map((message) => [message.id, message])).values()].sort((a, b) => a.id - b.id)
}

export async function readNewMessages(client, id, after, signal, onBatch) {
  let cursor = after
  do {
    const { data } = await client.request(`/tickets/${id}/messages`, { query: { limit: 50, ...(cursor ? { afterMessageId: cursor } : {}) }, signal })
    const nextRead = data.messages.length ? Math.max(cursor || 0, ...data.messages.map((message) => message.id)) : cursor
    onBatch(data, nextRead)
    if (!cursor || !data.pagination.hasMore) return
    const next = data.pagination.nextAfterMessageId
    if (!next || next <= cursor) throw new ChatApiError('ไม่สามารถโหลดข้อความต่อได้ กรุณาลองใหม่')
    cursor = next
  } while (!signal?.aborted)
}

export function ticketQuery(pagination, sortModel, filterModel) {
  const sortMap = { ticketNo: 'ticketNo', topic: 'topic', factoryName: 'factoryName', registration: 'registrationNo', region: 'regionName', province: 'provinceName', status: 'status', latest: 'lastMessageAt' }
  const sort = sortModel[0]
  const query = { page: pagination.page + 1, pageSize: pagination.pageSize, sort: sortMap[sort?.field] || 'lastMessageAt', order: sort?.sort || 'desc' }
  const item = filterModel.items?.[0]
  if (item?.value !== '' && item?.value != null) {
    const keys = { status: 'status', topic: 'topicCode', region: 'regionName', province: 'provinceName', factoryId: 'eligibleFactoryId' }
    if (keys[item.field]) query[keys[item.field]] = String(item.value).trim()
    else if (item.field === 'latest') {
      const date = new Date(item.value)
      if (!Number.isNaN(date.getTime())) query[item.operator === 'onOrBefore' ? 'to' : 'from'] = date.toISOString()
    }
  }
  const q = (filterModel.quickFilterValues || []).join(' ').trim()
  if (q) query.q = q.slice(0, 200)
  return query
}
