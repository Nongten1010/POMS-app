import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getKwpLink, getKwpReportPeriod, readKwpApiResponse, fetchKwpMeasurementPoints,
  withKwpParameterOptions, isKwpParameterError, buildKwpAttachmentMetadata,
  isKwpMeasurementAttachment, cancelKwpSubmission, canCreateKwpRequest,
} from './kwpFormPresentation.mjs'

test('KWP creation is available to operators and admins, never ordinary officers or viewers', () => {
  assert.equal(canCreateKwpRequest('operator'), true)
  assert.equal(canCreateKwpRequest('officer', 'admin'), true)
  assert.equal(canCreateKwpRequest('officer', 'officer', ['ADMIN']), true)
  assert.equal(canCreateKwpRequest('officer', 'officer'), false)
  assert.equal(canCreateKwpRequest('officer', 'regional_officer', ['reviewer']), false)
  assert.equal(canCreateKwpRequest(''), false)
  assert.equal(canCreateKwpRequest('public'), false)
})

test('KWP links preserve valid URLs and reject credentials, control characters and overlength values', () => {
  for (const value of [null, undefined, '', '  ']) assert.equal(getKwpLink(value), null)
  assert.equal(getKwpLink('  https://example.com/report.pdf?q=1#page=2  '), 'https://example.com/report.pdf?q=1#page=2')
  const boundary = `https://example.com/${'a'.repeat(980)}`
  assert.equal(boundary.length, 1000)
  assert.equal(getKwpLink(boundary), boundary)
  for (const value of [boundary + 'a', 'https://user:password@example.com', 'https://user@example.com',
    'https://example.com/\nfile', '\thttps://example.com', 'https://example.com/\u007ffile',
    'javascript:alert(1)', 'ftp://example.com', 'example.com', 'http:example.com']) {
    assert.throws(() => getKwpLink(value), value)
  }
})

test('report periods enforce SQL integer bounds and keep blank legacy values without assigning a year', () => {
  const fields = new FormData()
  assert.throws(() => getKwpReportPeriod(fields))
  assert.deepEqual(getKwpReportPeriod(fields, { allowEmpty: true }), { reportRound: null, reportYear: null })
  fields.set('reportRound', '2147483647')
  fields.set('reportYear', '9999')
  assert.deepEqual(getKwpReportPeriod(fields), { reportRound: 2147483647, reportYear: 9999 })
  for (const value of ['2147483648', '99999999999999999999', '1e3', '0', '-1', '1.2']) {
    fields.set('reportRound', value)
    assert.throws(() => getKwpReportPeriod(fields, { allowEmpty: true }))
  }
  fields.set('reportRound', '')
  fields.set('reportYear', '2569')
  assert.deepEqual(getKwpReportPeriod(fields, { allowEmpty: true }), { reportRound: null, reportYear: 2569 })
  for (const year of ['2399', '10000', '2569.1']) {
    fields.set('reportYear', year)
    assert.throws(() => getKwpReportPeriod(fields, { allowEmpty: true }))
  }
})

test('KWP prefill uses the menu-specific endpoint with encoded identity, token and abort signal', async () => {
  const signal = new AbortController().signal
  const data = [{ connectedPointId: 7, pointCode: 'S2001', pointType: 'CEMS',
    parameterDetails: ['CO (ppm)', 'SO2 (ppm)'], parameterInstrumentDetails: [{ parameter: 'CO (ppm)', cemsModel: 'Model A' }] }]
  const response = await fetchKwpMeasurementPoints({ factoryId: 'F/1', accessToken: 'test-token', apiBaseUrl: '/api/v1/kwp-form-reports', signal,
    fetchImpl: async (url, options) => {
      assert.equal(url, '/api/v1/kwp-form-reports/factories/F%2F1/measurement-points')
      assert.equal(options.headers.Authorization, 'Bearer test-token')
      assert.equal(options.signal, signal)
      return Response.json({ success: true, data })
    },
  })
  assert.deepEqual(response, data)
})

test('prefill errors never fall back to the connection endpoint or stale parameter lists', async () => {
  for (const status of [400, 401, 403, 500]) {
    await assert.rejects(fetchKwpMeasurementPoints({ factoryId: 'F1', accessToken: 'token', apiBaseUrl: '/api',
      fetchImpl: async () => Response.json({ success: false, error: { code: 'BAD_REQUEST', message: 'failed' } }, { status }),
    }), (error) => error.status === status && error.message === 'failed')
  }
  await assert.rejects(fetchKwpMeasurementPoints({ factoryId: 'F1', accessToken: 'token', apiBaseUrl: '/api',
    fetchImpl: async () => Response.json({ success: true, data: null }),
  }), /API/)
  await assert.rejects(fetchKwpMeasurementPoints({ factoryId: 'F1', accessToken: '',
    fetchImpl: () => assert.fail('must not fetch without authentication'),
  }))
})

test('parameter refresh replaces only option lists and matches the exact point instead of its array position', () => {
  const original = { connectedPointId: 8, code: 'P1', type: 'WPMS', name: 'Saved name',
    parameterDetails: ['OLD'], requestedParameters: ['BOD (mg/l)'], details: { snapshot: true } }
  const points = [
    { connectedPointId: 7, pointCode: 'S1', pointType: 'CEMS', parameterDetails: ['CO (ppm)'] },
    { connectedPointId: 8, pointCode: 'P1', pointType: 'WPMS', pointName: 'Live name',
      parameterDetails: ['BOD (mg/l)', 'COD (mg/l)'], parameterInstrumentDetails: [] },
  ]
  const updated = withKwpParameterOptions(original, points)
  assert.deepEqual(updated.parameterDetails, ['BOD (mg/l)', 'COD (mg/l)'])
  assert.equal(updated.name, 'Saved name')
  assert.deepEqual(updated.requestedParameters, original.requestedParameters)
  assert.deepEqual(original.parameterDetails, ['OLD'])
  assert.deepEqual(withKwpParameterOptions(original, [{ ...points[1], parameterDetails: [] }]).parameterDetails, [])
  assert.throws(() => withKwpParameterOptions(original, [points[0]]))
  assert.throws(() => withKwpParameterOptions(original, [points[1], points[1]]))
  const legacy = { code: 'P1', type: 'WPMS' }
  assert.deepEqual(withKwpParameterOptions(legacy, points).parameterDetails, points[1].parameterDetails)
  assert.throws(() => withKwpParameterOptions({ ...legacy, type: 'CEMS' }, points))
})

test('API errors retain HTTP status, allowedParameters and attachment issue paths', async () => {
  const details = { allowedParameters: ['BOD (mg/l)'] }
  await assert.rejects(readKwpApiResponse(Response.json({ success: false, error: {
    code: 'BAD_REQUEST', message: 'Invalid parameter', details,
  } }, { status: 400 }), 'failed'), (error) => {
    assert.ok(isKwpParameterError(error))
    assert.deepEqual(error.details, details)
    return true
  })
  const issues = [{ path: 'measurementItems[0].attachments[0].attachmentType', message: 'Invalid type' }]
  await assert.rejects(readKwpApiResponse(Response.json({ success: false, error: {
    code: 'VALIDATION_ERROR', message: 'Invalid attachment', issues,
  } }, { status: 400 }), 'failed'), (error) => {
    assert.deepEqual(error.issues, issues)
    assert.equal(isKwpParameterError(error), false)
    return true
  })
})

test('attachment payload keeps saved type and exact metadata, strips response-only fields', () => {
  const metadata = { attachmentType: 'LEGACY', originalFileName: 'report.pdf', storedFileName: 'uuid.pdf',
    mimeType: 'application/pdf', fileSize: 1234, storagePath: 'kwp/form-attachments/2026/09/42/uuid.pdf' }
  const file = { ...metadata, isSubmitted: true, id: 99, fileUrl: 'https://example.com/file.pdf', uploadedBy: 42 }
  assert.deepEqual(buildKwpAttachmentMetadata(file, 'GENERAL'), metadata)
  for (const type of ['GENERAL', 'SAMPLING_PHOTO', 'LAB_REPORT', 'RATA_REPORT', 'CALIBRATION_PHOTO']) {
    const uploaded = { ...file, isSubmitted: false }
    assert.deepEqual(buildKwpAttachmentMetadata(uploaded, type), { ...metadata, attachmentType: type })
  }
  assert.equal(isKwpMeasurementAttachment({ attachmentType: 'GENERAL' }), false)
  assert.equal(isKwpMeasurementAttachment({ attachmentType: 'SAMPLING_PHOTO' }), true)
  assert.equal(isKwpMeasurementAttachment({ attachmentType: 'LAB_REPORT' }), true)
})

test('cancel conflicts await the reload once and never retry cancellation automatically', async () => {
  const events = []
  await assert.rejects(cancelKwpSubmission({ request: { id: 9, status: 'SUBMITTED' }, accessToken: 'token', apiBaseUrl: '/api',
    fetchImpl: async () => {
      events.push('cancel')
      return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Status changed' } }, { status: 409 })
    },
    onConflict: async () => { events.push('reload') },
  }), (error) => error.status === 409 && error.code === 'CONFLICT')
  assert.deepEqual(events, ['cancel', 'reload'])
  await assert.rejects(cancelKwpSubmission({ request: { id: 9, status: 'SUBMITTED' }, accessToken: 'token', apiBaseUrl: '/api',
    fetchImpl: async () => Response.json({ success: false }, { status: 403 }),
    onConflict: () => assert.fail('only conflict triggers refresh'),
  }))
})
