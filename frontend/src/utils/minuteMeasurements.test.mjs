import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchMinuteMeasurements, displayMinuteValue, getMeasurementHour } from './minuteMeasurements.mjs'

test('hour comes from the clicked time, including midnight and the last hour', () => {
  assert.equal(getMeasurementHour('00.00–00.59 น.'), 0)
  assert.equal(getMeasurementHour('19:00'), 19)
  assert.equal(getMeasurementHour('23:00'), 23)
  for (const value of ['', null, '24:00', '19:99']) assert.equal(getMeasurementHour(value), null)
})

test('preserves precision, whitespace, zero and status independently', () => {
  assert.equal(displayMinuteValue(0), '0')
  assert.equal(displayMinuteValue(12.34567), '12.34567')
  for (const value of [null, undefined, '']) assert.equal(displayMinuteValue(value), '-')
  assert.equal(displayMinuteValue('001.200'), '001.200')
  assert.equal(displayMinuteValue(' 001.200 '), ' 001.200 ')
  assert.equal(displayMinuteValue('Normal'), 'Normal')
})

const context = { stationId: 'CEMS-0001/2569', date: '2026-11-11', hour: 9 }
const url = '/api/v1/connected-measurement-points/CEMS-0001%2F2569/measurement-minutes?date=2026-11-11&hour=09'
function fixture(minutesWithData = 0) {
  return { success: true, data: { ...context, hour: '09', pointName: 'Stack', timezone: 'Asia/Bangkok', parameters: ['CO (ppm)'],
    rows: Array.from({ length: 60 }, (_, i) => ({ time: `09:${String(i).padStart(2, '0')}`, values: { 'CO (ppm)': { value: null, status: null } } })),
  }, meta: { interval: '1m', minutesWithData } }
}
test('reads API rows directly with auth, no-store and abort, including status-only data', async () => {
  const body = fixture(1)
  body.data.rows[0].values['CO (ppm)'] = { value: ' 001.200 ', status: 'Calibration', sourceStatus: 2 }
  const signal = new AbortController().signal
  let calls = 0
  const result = await fetchMinuteMeasurements({ url, context, accessToken: 'test', signal, fetchImpl: async (path, options) => {
    calls++
    assert.equal(path, url)
    assert.equal(options.headers.Authorization, 'Bearer test')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.signal, signal)
    return Response.json(body)
  } })
  assert.deepEqual(result.data, body.data)
  assert.equal(calls, 1)
  body.data.rows[0].values['CO (ppm)'].value = null
  const statusOnly = await fetchMinuteMeasurements({ url, context, accessToken: 'test', fetchImpl: async () => Response.json(body) })
  assert.equal(statusOnly.meta.minutesWithData, 1)
  assert.equal(statusOnly.data.rows[0].values['CO (ppm)'].status, 'Calibration')
  const empty = await fetchMinuteMeasurements({ url, context, accessToken: 'test', fetchImpl: async () => Response.json(fixture()) })
  assert.equal(empty.data.rows.length, 60)
  assert.equal(empty.meta.minutesWithData, 0)
})
test('rejects malformed, wrong-hour and wrong-date data rather than presenting it as empty', async () => {
  for (const change of [b => { b.success = false }, b => { b.data.rows.pop() }, b => { b.data.hour = '10' },
    b => { b.data.date = '2026-11-12' }, b => { b.data.timezone = 'UTC' }, b => { b.meta.minutesWithData = -1 },
    b => { delete b.data.rows[0].values['CO (ppm)'].status }]) {
    const body = fixture(); change(body)
    await assert.rejects(fetchMinuteMeasurements({ url, context, accessToken: 'test', fetchImpl: async () => Response.json(body) }), /ไม่ถูกต้อง/)
  }
})
test('safe errors cover status codes and plain-text 429 without automatic retries', async () => {
  for (const [status, message] of [[400, 'ไม่ถูกต้อง'], [401, 'เข้าสู่ระบบ'], [403, 'ไม่มีสิทธิ์'], [404, 'ยังไม่พร้อม'], [429, '30 วินาที'], [503, 'ตรวจสอบหน่วย'], [500, 'ไม่สามารถโหลด']]) {
    let calls = 0
    await assert.rejects(fetchMinuteMeasurements({ url, context, accessToken: 'test', fetchImpl: async () => {
      calls++; return new Response('private SQL error', { status, headers: { 'Retry-After': '30' } })
    } }), new RegExp(message))
    assert.equal(calls, 1)
  }
  await assert.rejects(fetchMinuteMeasurements({ url, context, accessToken: '', fetchImpl: () => assert.fail('no token') }), /เข้าสู่ระบบ/)
  await assert.rejects(fetchMinuteMeasurements({ url, context, accessToken: 'test', fetchImpl: async () => { throw new TypeError('network') } }), /เชื่อมต่อ/)
  const abort = new DOMException('Aborted', 'AbortError')
  await assert.rejects(fetchMinuteMeasurements({ url, context, accessToken: 'test', fetchImpl: async () => { throw abort } }), e => e === abort)
})
