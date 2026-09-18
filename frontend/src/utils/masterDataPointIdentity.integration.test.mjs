import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createServer } from 'vite'

test('master-data point edits keep the selected live point identity through prefill and payload', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-point-identity-test-'))
  const originalWindow = globalThis.window
  const server = await createServer({
    cacheDir,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    plugins: [{
      name: 'master-data-point-identity-test-exports',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('/src/pages/MasterDataPage.jsx')) {
          return `${code}\nexport { normalizeFactoryFormData, makeMasterDataInitialRequest, buildMeasurementPointsPayload, mapMonitoringPointRows, createFactoryStatusRows };`
        }
      },
    }],
  })
  try {
    await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
    globalThis.window = { location: { hostname: 'localhost' } }
    const { normalizeFactoryFormData, makeMasterDataInitialRequest, buildMeasurementPointsPayload, mapMonitoringPointRows, createFactoryStatusRows } =
      await server.ssrLoadModule('/src/pages/MasterDataPage.jsx')
    const wpms = {
      connectedPointId: 10023, sourceMeasurementPointId: 10064,
      systemType: 'WPMS', pointCode: 'P0155', pointName: 'Unit 4500 (Waste Gas)',
      officerNotificationEmails: ['water@example.com'],
      details: { monitoringPointKind: 'CEMS' },
    }
    const cems = {
      connectedPointId: 10021, sourceMeasurementPointId: 10059,
      systemType: 'CEMS', pointCode: 'S0915', pointName: wpms.pointName,
      officerNotificationEmails: ['air@example.com'],
    }
    const factory = { measurementPoints: [wpms, cems], selectedMeasurementPoint: cems }
    const point = {
      connectedPointId: 10021,
      pointCode: 'S0915', pointName: cems.pointName,
      details: { monitoringPointKind: 'CEMS', requestedParameters: ['NOx (ppm)'] },
      documentsAndImages: [],
    }
    const form = { systemType: 'CEMS', measurementPoints: [point] }
    const extra = { __fromFormEndpoint: true, __formType: 'MEASUREMENT_POINTS' }
    const normalize = (data = form, source = factory) => normalizeFactoryFormData(data, source, extra)
    const payloadFor = (initial) => buildMeasurementPointsPayload({
      ...initial,
      officerNotificationEmails: initial.measurementPoints[0]?.officerNotificationEmails ?? [],
    }, makeMasterDataInitialRequest(initial))

    await t.test('CEMS does not inherit the first WPMS ID despite identical point names', () => {
      for (const measurementPoints of [[wpms, cems], [cems, wpms]]) {
        const initial = normalize(form, { ...factory, measurementPoints })
        const matched = initial.measurementPoints[0]
        assert.equal(matched.connectedPointId, 10021)
        assert.equal(matched.pointCode, 'S0915')
        assert.equal(matched.systemType, 'CEMS')
        assert.deepEqual(matched.officerNotificationEmails, ['air@example.com'])
        assert.deepEqual(matched.details, point.details)
        const payload = payloadFor(initial)
        assert.equal(payload.measurementPoints[0].connectedPointId, 10021)
        assert.equal(payload.measurementPoints[0].details.monitoringPointKind, 'CEMS')
        assert.deepEqual(payload.measurementPoints[0].officerNotificationEmails, ['air@example.com'])
        assert.equal('sourceMeasurementPointId' in payload.measurementPoints[0], false)
      }
      assert.equal(form.measurementPoints[0].connectedPointId, 10021)
    })

    await t.test('WPMS uses its live ID, not its source ID', () => {
      const initial = normalize({ systemType: 'WPMS', measurementPoints: [{
        ...point, connectedPointId: 10023, pointCode: 'P0155', details: { monitoringPointKind: 'WPMS' },
      }] }, { ...factory, selectedMeasurementPoint: wpms })
      assert.equal(payloadFor(initial).measurementPoints[0].connectedPointId, 10023)
      assert.deepEqual(initial.measurementPoints[0].officerNotificationEmails, ['water@example.com'])
    })

    await t.test('multiple CEMS points select by identity even when form order differs', () => {
      const other = { ...cems, connectedPointId: 10030, pointCode: 'S0916' }
      const initial = normalize({ ...form, measurementPoints: [{ ...point, connectedPointId: 10030, pointCode: 'S0916' }, point] }, {
        ...factory, measurementPoints: [wpms, cems, other],
      })
      assert.equal(initial.measurementPoints.length, 1)
      assert.equal(payloadFor(initial).measurementPoints[0].connectedPointId, 10021)
    })

    await t.test('the form ID remains authoritative even when display codes and names change', () => {
      const initial = normalize({ ...form, measurementPoints: [{
        ...point, pointCode: 'S0999', pointName: 'Renamed stack',
      }] }, { measurementPoints: [{ ...cems, connectedPointId: '10021' }], selectedMeasurementPoint: cems })
      assert.equal(payloadFor(initial).measurementPoints[0].connectedPointId, 10021)
      assert.equal(initial.measurementPoints[0].pointCode, 'S0999')
      assert.equal(initial.measurementPoints[0].pointName, 'Renamed stack')
    })

    await t.test('missing, invalid, duplicate and conflicting IDs fail closed without a code fallback', () => {
      for (const broken of [
        ...[undefined, null, 0, -1, 1.5, '10021'].map((connectedPointId) => ({ ...point, connectedPointId })),
        { ...point, connectedPointId: undefined, id: 10021, sourceMeasurementPointId: 10059 },
        { ...point, connectedPointId: 10023 },
        { ...point, connectedPointId: 99999 },
        { ...point, systemType: 'WPMS' },
      ]) {
        assert.throws(() => normalize({ ...form, measurementPoints: [broken] }))
      }
      assert.throws(() => normalize({ ...form, measurementPoints: [] }))
      assert.throws(() => normalize({ ...form, measurementPoints: [point, { ...point, pointCode: null }] }))
    })

    await t.test('resubmission joins current/proposed snapshots by live ID, not code or position', () => {
      const initial = normalizeFactoryFormData(form, {
        raw: {
          proposedMeasurementPoints: [wpms, { ...cems, pointName: 'Renamed stack' }],
          currentMeasurementPoints: [wpms, cems],
        },
      }, { ...extra, __isResubmission: true })
      assert.equal(payloadFor(initial).measurementPoints[0].connectedPointId, 10021)
      assert.deepEqual(initial.measurementPoints[0].officerNotificationEmails, ['air@example.com'])
      const withoutSnapshots = normalize(form, {})
      assert.equal(payloadFor(withoutSnapshots).measurementPoints[0].connectedPointId, 10021)
    })

    await t.test('payload creation rejects an initial point that differs from the selection', () => {
      const initial = normalize()
      assert.throws(() => payloadFor({ ...initial, measurementPoints: [{
        ...initial.measurementPoints[0], connectedPointId: 10023,
      }] }))
      for (const connectedPointId of [undefined, null, 0, -1, 1.5]) {
        assert.throws(() => payloadFor({ ...initial, measurementPoints: [{
          ...initial.measurementPoints[0], connectedPointId,
        }] }))
      }
    })

    await t.test('21 same-name CEMS points with null or duplicate codes submit only the selected ID', () => {
      const points = Array.from({ length: 21 }, (_, index) => ({
        ...cems, connectedPointId: 20000 + index, pointCode: index % 2 ? null : 'S0915',
        officerNotificationEmails: [`officer-${index}@example.com`],
      }))
      const selected = points[17]
      const multiPointForm = {
        ...form,
        officerNotificationEmails: points.flatMap((item) => item.officerNotificationEmails),
        measurementPoints: points.toReversed().map((item) => ({
          ...point, connectedPointId: item.connectedPointId, pointCode: item.pointCode,
        })),
      }
      const initial = normalize(multiPointForm, { measurementPoints: [wpms, ...points], selectedMeasurementPoint: selected })
      assert.equal(initial.measurementPoints.length, 1)
      assert.equal(initial.measurementPoints[0].pointCode, null)
      const payload = payloadFor(initial)
      assert.equal(payload.measurementPoints.length, 1)
      assert.equal(payload.measurementPoints[0].connectedPointId, 20017)
      assert.deepEqual(payload.measurementPoints[0].officerNotificationEmails, ['officer-17@example.com'])
      for (const identityField of ['pointCode', 'systemType', 'sourceMeasurementPointId', 'id']) {
        assert.equal(identityField in payload.measurementPoints[0], false)
      }
      assert.equal(multiPointForm.measurementPoints.length, 21)
    })

    await t.test('missing codes display a dash, never a generated code or stale alias', () => {
      const uncoded = { ...cems, pointCode: null, stationId: 'S0001', code: 'S0002' }
      for (const buildRows of [mapMonitoringPointRows, createFactoryStatusRows]) {
        const rows = buildRows({ measurementPoints: [wpms, uncoded] })
        assert.equal(rows[0].pointCode, 'P0155')
        assert.equal(rows[1].pointCode, '-')
        assert.equal(rows[1].connectedPointId, 10021)
      }
      const fallback = makeMasterDataInitialRequest({ selectedMeasurementPoint: uncoded })
      assert.equal(fallback.measurementPoints[0].pointCode, null)
    })

    await t.test('basic-info and untyped prefill preserve all form IDs', () => {
      for (const __formType of ['BASIC_INFO', undefined]) {
        const initial = normalizeFactoryFormData(form, {}, { __formType })
        assert.equal(initial.measurementPoints[0].connectedPointId, 10021)
      }
    })

    await t.test('basic-info prefill without point identities remains supported', () => {
      const initial = normalizeFactoryFormData({ factoryName: 'Factory', measurementPoints: [] }, {}, {
        __formType: 'BASIC_INFO',
      })
      assert.equal(initial.factoryName, 'Factory')
      assert.deepEqual(initial.measurementPoints, [])
    })
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
