import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPreviousConnectionRequestPrefill,
  getPreviousConnectionRequestUrl,
  loadPreviousConnectionRequest,
} from './previousConnectionRequest.mjs'

const factory = { factoryId: 'factory/1', factoryName: 'Current', eia: 'มี EIA', projectName: 'Current project', latitude: 14, officerNotificationEmails: ['current-officer@example.com'] }
const formData = {
  factoryId: 'factory/1', factoryName: 'Previous', factoryRegistrationNo: 'old-registration',
  eia: null, eiaOther: null, projectName: null, latitude: null, longitude: null,
  factoryFrontPhotos: [{ fileUrl: 'https://example.com/front.jpg', fileName: 'front.jpg', fileType: 'image/jpeg', fileSize: 100 }],
  factoryLogo: { fileUrl: 'https://example.com/logo.jpg', fileName: 'logo.jpg' },
  contactPersons: [{ name: 'Contact', phone: '0812345678', position: 'Engineer', email: 'contact@example.com' }],
  notificationEmails: ['factory@example.com'],
}

test('previous-request URLs use factoryId, encode slashes, and have no query parameters', () => {
  assert.equal(getPreviousConnectionRequestUrl(' factory/1 ', true), '/api-proxy/v1/cems-wpms-requests/factories/factory%2F1/previous-request')
  assert.equal(getPreviousConnectionRequestUrl('factory/1', false), '/api/v1/cems-wpms-requests/factories/factory%2F1/previous-request')
  assert.throws(() => getPreviousConnectionRequestUrl(' '))
  assert.throws(() => getPreviousConnectionRequestUrl('a'.repeat(65)))
})

test('loads previous-request formData with bearer authentication and cancellation support', async (t) => {
  const controller = new AbortController()
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, getPreviousConnectionRequestUrl(factory.factoryId, true))
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.equal(options.body, undefined)
    assert.equal(options.signal, controller.signal)
    return Response.json({ success: true, data: { hasPreviousRequest: true, sourceRequestId: 17, formData } })
  })
  assert.deepEqual(await loadPreviousConnectionRequest(factory.factoryId, 'test-token', { signal: controller.signal, isDevelopment: true }), formData)
})

test('only an explicit not-found result retains the existing factory form defaults', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, data: { hasPreviousRequest: false, sourceRequestId: null, formData: null } }))
  const previous = await loadPreviousConnectionRequest(factory.factoryId, 'test-token')
  assert.equal(previous, null)
  const result = buildPreviousConnectionRequestPrefill(factory, previous)
  assert.equal(result.factory, factory)
  assert.equal(result.previousRequestFormData, null)
})

test('API errors and invalid responses never silently use not-found behavior', async (t) => {
  for (const status of [401, 403, 500]) {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ success: false, error: { message: 'API failed' } }, { status }))
    await assert.rejects(loadPreviousConnectionRequest(factory.factoryId, 'test-token'), /API failed/)
    fetchMock.mock.restore()
  }
  for (const payload of [null, {}, { data: { hasPreviousRequest: true, formData: null } }]) {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(payload))
    await assert.rejects(loadPreviousConnectionRequest(factory.factoryId, 'test-token'), /ไม่ครบถ้วน/)
    fetchMock.mock.restore()
  }
  await assert.rejects(loadPreviousConnectionRequest(factory.factoryId, ''), /เข้าสู่ระบบ/)
})

test('rejects a response for a different factory and propagates aborted loads', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, data: { hasPreviousRequest: true, formData: { factoryId: 'another' } } }))
  await assert.rejects(loadPreviousConnectionRequest(factory.factoryId, 'test-token'), /ไม่ตรง/)
  fetchMock.mock.restore()
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => { signal.throwIfAborted() })
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(loadPreviousConnectionRequest(factory.factoryId, 'test-token', { signal: controller.signal }), { name: 'AbortError' })
})

test('prefills snapshot values including explicit nulls, keeping old and new registrations separate', () => {
  const result = buildPreviousConnectionRequestPrefill(factory, formData)
  assert.equal(result.factory.factoryName, 'Previous')
  assert.equal(result.factory.newRegistrationNo, 'factory/1')
  assert.equal(result.factory.oldRegistrationNo, 'old-registration')
  assert.equal(result.factory.eia, null)
  assert.equal(result.factory.projectName, null)
  assert.equal(result.factory.latitude, null)
  assert.deepEqual(result.previousRequestFormData.contactPersons, formData.contactPersons)
  assert.deepEqual(result.previousRequestFormData.notificationEmails, ['factory@example.com'])
  assert.equal(factory.eia, 'มี EIA')
})

test('copies only general prefill data, never prior point identity, devices, or officer emails', () => {
  const result = buildPreviousConnectionRequestPrefill(factory, {
    ...formData,
    id: 17, requestId: 17, status: 'APPROVED', systemType: 'WPMS',
    measurementPoints: [{ pointCode: 'OLD123', details: { requestedParameters: ['BOD'] } }],
    officerNotificationEmails: ['old-officer@example.com'],
    informationProviderName: 'Previous signer',
  })
  for (const key of ['measurementPoints', 'systemType', 'requestId', 'informationProviderName']) {
    assert.equal(result.factory[key], undefined)
    assert.equal(result.previousRequestFormData[key], undefined)
  }
  assert.deepEqual(result.factory.officerNotificationEmails, factory.officerNotificationEmails)
  assert.equal(result.previousRequestFormData.officerNotificationEmails, undefined)
})

test('reuses image metadata with canonical document titles without file uploads', () => {
  const { previousRequestFormData } = buildPreviousConnectionRequestPrefill(factory, formData)
  const [front, logo] = previousRequestFormData.documentsAndImages
  assert.equal(front.title, 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน')
  assert.equal(logo.title, 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท')
  assert.equal(front.fileUrl, formData.factoryFrontPhotos[0].fileUrl)
  assert.equal(front.fileSize, 100)
  assert.equal(logo.fileUrl, formData.factoryLogo.fileUrl)
  assert.equal(front.link, null)
})

test('empty images and emails stay empty and legacy primary contacts come from the same snapshot', () => {
  const { previousRequestFormData } = buildPreviousConnectionRequestPrefill(factory, {
    ...formData, factoryFrontPhotos: [], factoryLogo: null, contactPersons: [], notificationEmails: [],
    contactName: 'Primary', contactPhone: '0899999999', contactEmail: null,
  })
  assert.deepEqual(previousRequestFormData.documentsAndImages, [])
  assert.deepEqual(previousRequestFormData.notificationEmails, [])
  assert.equal(previousRequestFormData.contactPersons[0].name, 'Primary')
})
