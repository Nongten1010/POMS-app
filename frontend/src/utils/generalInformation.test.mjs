import test from 'node:test'
import assert from 'node:assert/strict'
import { canViewGeneralInformation, fetchGeneralInformation, formatSummaryNumber, regions, summarySections, validateGeneralInformation } from './generalInformation.mjs'

export function fixture(systemType = 'CEMS') {
  return {
    systemType, generatedAt: '2026-11-06T00:00:00Z',
    regions: regions.map((label) => ({ label, factoryCount: 1, pointCount: 2 })),
    total: { label: 'ทั่วประเทศ', factoryCount: 6, pointCount: 12 },
    estates: ['ในนิคมฯ', 'นอกนิคมฯ'].map((label) => ({ label, factoryCount: 3, pointCount: 6 })),
    parameters: [{ label: 'CO', factoryCount: 2, pointCount: 4 }],
    flowRates: regions.map((label) => ({ label, average: 123.456, min: 0, max: null })),
    flowTotal: { label: 'ทั่วประเทศ', average: 123.456, min: 0, max: null },
  }
}
test('only staff/admin can access', () => {
  assert.equal(canViewGeneralInformation('officer'), true)
  assert.equal(canViewGeneralInformation('admin'), true)
  assert.equal(canViewGeneralInformation('', ['admin']), true)
  for (const role of ['', 'operator', 'citizen']) assert.equal(canViewGeneralInformation(role), false)
})
test('accept aggregates; reject partial, mismatched or nonnumeric results', () => {
  assert.deepEqual(validateGeneralInformation(fixture(), 'CEMS'), fixture())
  assert.throws(() => validateGeneralInformation(fixture(), 'WPMS'))
  for (const key of ['regions', 'flowRates', 'estates']) {
    const data = fixture(); data[key].pop()
    assert.throws(() => validateGeneralInformation(data, 'CEMS'))
  }
  for (const value of ['12', null, -1, 1.5, Infinity]) {
    const data = fixture(); data.total.factoryCount = value
    assert.throws(() => validateGeneralInformation(data, 'CEMS'))
  }
})
test('preserve zero/null and backend national totals; order DIW regions', () => {
  const data = fixture(); data.regions.reverse(); data.flowTotal.average = 99
  const sections = summarySections(data, 'CEMS')
  assert.equal(sections[0].rows[0][0], 'ภาคเหนือ')
  assert.equal(sections[3].rows.at(-1)[1], 99)
  assert.equal(formatSummaryNumber(0), '0')
  assert.equal(formatSummaryNumber(null), '-')
  assert.equal(summarySections(fixture('WPMS'), 'WPMS')[3].headers[1], 'เฉลี่ย (m³/d)')
})
test('request is authenticated, abortable and distinguishes unavailable/errors', async () => {
  const signal = new AbortController().signal
  const options = { systemType: 'CEMS', accessToken: 'test', signal, isDevelopment: true }
  const data = await fetchGeneralInformation({ ...options, fetchImpl: async (url, init) => {
    assert.equal(url, '/api-proxy/v1/general-information?systemType=CEMS')
    assert.equal(init.headers.Authorization, 'Bearer test')
    assert.equal(init.signal, signal)
    return Response.json({ success: true, data: fixture() })
  } })
  assert.equal(data.total.factoryCount, 6)
  assert.equal(await fetchGeneralInformation({ ...options, fetchImpl: async () => new Response('', { status: 404 }) }), null)
  await assert.rejects(fetchGeneralInformation({ ...options, fetchImpl: async () => new Response('', { status: 403 }) }), /ไม่มีสิทธิ์/)
})

test('expand estate labels for tables and exports without mutating the API data', () => {
  for (const systemType of ['CEMS', 'WPMS']) {
    const data = fixture(systemType)
    const sections = summarySections(validateGeneralInformation(data, systemType), systemType)
    assert.deepEqual(sections[1].rows, [
      ['ในนิคมอุตสาหกรรม', 3, 6],
      ['นอกนิคมอุตสาหกรรม', 3, 6],
    ])
    assert.deepEqual(data.estates.map((row) => row.label), ['ในนิคมฯ', 'นอกนิคมฯ'])
  }
})
