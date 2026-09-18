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
          return `${code}\nexport { normalizeFactoryFormData, makeMasterDataInitialRequest, buildMeasurementPointsPayload };`
        }
      },
    }],
  })
  try {
    await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
    globalThis.window = { location: { hostname: 'localhost' } }
    const { normalizeFactoryFormData, makeMasterDataInitialRequest, buildMeasurementPointsPayload } =
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
      pointCode: 'S0915', pointName: cems.pointName,
      details: { monitoringPointKind: 'CEMS', requestedParameters: ['NOx (ppm)'] },
      documentsAndImages: [],
    }
    const form = { systemType: 'CEMS', measurementPoints: [point] }
    const extra = { __fromFormEndpoint: true, __formType: 'MEASUREMENT_POINTS' }
    const normalize = (data = form, source = factory) => normalizeFactoryFormData(data, source, extra)
    const payloadFor = (initial) => buildMeasurementPointsPayload(initial, makeMasterDataInitialRequest(initial))

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
        assert.equal('sourceMeasurementPointId' in payload.measurementPoints[0], false)
      }
      assert.equal(form.measurementPoints[0].connectedPointId, undefined)
    })

    await t.test('WPMS uses its live ID, not its source ID', () => {
      const initial = normalize({ systemType: 'WPMS', measurementPoints: [{
        ...point, pointCode: 'P0155', details: { monitoringPointKind: 'WPMS' },
      }] }, { ...factory, selectedMeasurementPoint: wpms })
      assert.equal(payloadFor(initial).measurementPoints[0].connectedPointId, 10023)
      assert.deepEqual(initial.measurementPoints[0].officerNotificationEmails, ['water@example.com'])
    })

    await t.test('multiple CEMS points select by identity even when form order differs', () => {
      const other = { ...cems, connectedPointId: 10030, pointCode: 'S0916' }
      const initial = normalize({ ...form, measurementPoints: [{ ...point, pointCode: 'S0916' }, point] }, {
        ...factory, measurementPoints: [wpms, cems, other],
      })
      assert.equal(initial.measurementPoints.length, 1)
      assert.equal(payloadFor(initial).measurementPoints[0].connectedPointId, 10021)
    })

    await t.test('an explicit live ID supports renamed points and numeric string IDs', () => {
      const initial = normalize({ ...form, measurementPoints: [{
        ...point, connectedPointId: '10021', pointName: 'Renamed stack',
      }] })
      assert.equal(payloadFor(initial).measurementPoints[0].connectedPointId, 10021)
      assert.equal(initial.measurementPoints[0].pointName, 'Renamed stack')
    })

    await t.test('missing, conflicting and ambiguous identities fail closed', () => {
      for (const broken of [
        { ...point, pointCode: 'S9999' },
        { ...point, pointCode: undefined },
        { ...point, connectedPointId: 10023 },
        { ...point, connectedPointId: 99999 },
        { ...point, systemType: 'WPMS' },
      ]) {
        assert.throws(() => normalize({ ...form, measurementPoints: [broken] }))
      }
      assert.throws(() => normalize({ ...form, measurementPoints: [] }))
      assert.throws(() => normalize(form, { ...factory, measurementPoints: [
        cems, { ...cems, connectedPointId: 10030 },
      ] }))
      assert.throws(() => normalize(form, { measurementPoints: [{
        pointCode: 'S0915', sourceMeasurementPointId: 10059, id: 10059,
      }] }))
    })

    await t.test('resubmission joins current/proposed snapshots by code, not position', () => {
      const initial = normalizeFactoryFormData(form, {
        raw: {
          proposedMeasurementPoints: [wpms, { ...cems, pointName: 'Renamed stack' }],
          currentMeasurementPoints: [wpms, cems],
        },
      }, { ...extra, __isResubmission: true })
      assert.equal(payloadFor(initial).measurementPoints[0].connectedPointId, 10021)
      assert.throws(() => normalize(form, { currentMeasurementPoints: [wpms] }))
    })

    await t.test('payload creation rejects an initial point that differs from the selection', () => {
      const initial = normalize()
      assert.throws(() => payloadFor({ ...initial, measurementPoints: [{
        ...initial.measurementPoints[0], connectedPointId: 10023,
      }] }))
      assert.throws(() => payloadFor({ ...initial, measurementPoints: [{
        ...initial.measurementPoints[0], pointCode: 'P0155',
      }] }))
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
