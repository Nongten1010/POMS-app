import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('master-data request summaries keep target identities separate from full detail', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-request-summary-test-'))
  const originalWindow = globalThis.window
  const server = await createServer({
    cacheDir,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    plugins: [{
      name: 'master-data-request-summary-test-exports',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('/src/pages/MasterDataPage.jsx')) {
          return `${code}\nexport { mapEditRequestRows, mapEditRequestDetail, getEditRequestFormQuery, getRequestRowHeight, RequestTargetCell, normalizeFactoryFormData, getPageRequestColumns };`
        }
      },
    }],
  })
  try {
    await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
    globalThis.window = { location: { hostname: 'localhost' } }
    const {
      mapEditRequestRows, mapEditRequestDetail, getEditRequestFormQuery,
      getRequestRowHeight, RequestTargetCell, normalizeFactoryFormData, getPageRequestColumns,
    } = await server.ssrLoadModule('/src/pages/MasterDataPage.jsx')
    const cems = { connectedPointId: 10021, systemType: 'CEMS', pointCode: 'S0915', pointName: 'Unit 4500 (Waste Gas)' }
    const wpms = { connectedPointId: 10024, systemType: 'WPMS', pointCode: 'P0155', pointName: 'Unit 4500 (Waste Gas)' }
    const summary = {
      id: 48, requestNo: 'point-00024/2569', factoryId: '91090100125393',
      factoryRegistrationNo: 'old-registration', factoryName: 'Factory', provinceName: 'Rayong',
      formType: 'MEASUREMENT_POINTS', status: 'PENDING_REVIEW', statusLabel: 'รอพิจารณา',
      submittedAt: '2026-09-18T22:00:00.000Z',
      targetMeasurementPoints: [cems], targetMeasurementPointsSource: 'SUBMITTED',
    }
    const map = (overrides = {}) => mapEditRequestRows([{ ...summary, ...overrides }])[0]

    await t.test('request 48 shows the selected CEMS point regardless of snapshot order', () => {
      for (const points of [[wpms, cems], [cems, wpms]]) {
        const row = map({ currentMeasurementPoints: points, proposedMeasurementPoints: points })
        assert.equal(row.systemType, 'CEMS')
        assert.equal(row.pointCode, 'S0915')
        assert.deepEqual(row.targetMeasurementPoints.map((point) => point.connectedPointId), [10021])
        assert.equal(row.targetSummaryNote, '')
      }
    })

    await t.test('summary alone fills the table with direct fields and Bangkok submission date', () => {
      const row = map()
      assert.equal(row.id, 48)
      assert.equal(row.requestId, 48)
      assert.equal(row.factoryId, summary.factoryId)
      assert.equal(row.factoryName, summary.factoryName)
      assert.equal(row.province, 'Rayong')
      assert.equal(row.statusCode, 'PENDING_REVIEW')
      assert.equal(row.status, 'รอพิจารณา')
      assert.equal(row.submittedDate, '19/09/2569')
      assert.deepEqual(row.statusHistory, [])
      assert.equal(map({ provinceName: null, province: 'Stale', proposedFactory: { provinceName: 'Stale' } }).province, '-')
      assert.equal(map({ factoryId: 'legacy-identifier' }).factoryId, 'legacy-identifier')
      assert.equal(map({ factoryId: null }).factoryId, '')
    })

    await t.test('multiple systems and duplicate names/codes stay aligned in one request row', () => {
      const points = [cems, wpms, { ...cems, connectedPointId: 10030 }, { ...wpms, connectedPointId: 10031, pointCode: null }]
      const rows = mapEditRequestRows([{ ...summary, targetMeasurementPoints: points }])
      assert.equal(rows.length, 1)
      const row = rows[0]
      assert.deepEqual(row.targetMeasurementPoints, points)
      assert.equal(row.systemType, 'CEMS\nWPMS\nCEMS\nWPMS')
      assert.equal(row.pointCode, 'S0915\nP0155\nS0915\n-')
      assert.equal(row.pointName.split('\n').length, 4)
      assert.equal(getRequestRowHeight({ model: row }), 128)
      assert.equal(getEditRequestFormQuery(row), '')
      for (const field of ['systemType', 'pointCode', 'pointName']) {
        const markup = renderToStaticMarkup(createElement(RequestTargetCell, { row, field }))
        assert.equal((markup.match(/<p\b/g) ?? []).length, 4)
      }
    })

    await t.test('all sources and absent contract fail closed without guessing a point', () => {
      const inferred = map({ targetMeasurementPointsSource: 'SNAPSHOT_DIFF' })
      assert.equal(inferred.pointCode, 'S0915')
      assert.equal(inferred.targetSummaryNote, 'อนุมานจากข้อมูลก่อน/หลัง')
      assert.match(inferred.targetSummaryDescription, /อาจไม่ครบ/)
      assert.equal(getRequestRowHeight({ model: inferred }), 68)
      for (const source of ['UNKNOWN', undefined, 'UNSUPPORTED']) {
        const row = map({
          targetMeasurementPointsSource: source,
          targetMeasurementPoints: source === 'UNKNOWN' ? [] : undefined,
          proposedMeasurementPoints: [wpms, cems],
        })
        assert.equal(row.pointCode, '-')
        assert.equal(row.systemType, '-')
        assert.equal(row.targetMeasurementPoints.length, 0)
        assert.ok(row.targetSummaryNote)
        assert.equal(getEditRequestFormQuery(row), '')
      }
      const basic = map({ formType: 'BASIC_INFO', targetMeasurementPointsSource: 'NOT_APPLICABLE', targetMeasurementPoints: [] })
      assert.equal(basic.pointCode, '-')
      assert.equal(basic.systemType, '-')
      assert.equal(basic.targetSummaryNote, '')
      assert.equal(basic.form, 'แก้ไขข้อมูลทั่วไปของโรงงาน')
      assert.equal(getRequestRowHeight({ model: basic }), 52)
    })

    await t.test('blank codes do not hide system/name and many points increase row height', () => {
      const row = map({ targetMeasurementPoints: Array.from({ length: 15 }, (_, index) => ({
        ...cems, connectedPointId: 20000 + index, pointCode: index % 2 ? '' : null,
      })) })
      assert.equal(row.targetMeasurementPoints.length, 15)
      assert.equal(row.pointCode.split('\n').every((code) => code === '-'), true)
      assert.equal(row.systemType.split('\n').every((system) => system === 'CEMS'), true)
      assert.equal(getRequestRowHeight({ model: row }), 436)
      assert.equal(getEditRequestFormQuery(row), 'systemType=CEMS')
    })

    await t.test('detail loading keeps summary targets while replacing status and loading events/documents/contacts', () => {
      const detail = {
        id: 48, formType: 'MEASUREMENT_POINTS', status: 'REVISION_REQUESTED', statusLabel: 'รอโรงงานแก้ไข',
        currentMeasurementPoints: [wpms, cems],
        proposedMeasurementPoints: [wpms, { ...cems, documentsAndImages: [{ title: 'Document', fileId: 123 }] }],
        currentFactory: { factoryName: 'Before' }, proposedFactory: { factoryName: 'After' },
        contactPersons: [{ name: 'Contact' }],
        events: [{ id: 1, toStatus: 'REVISION_REQUESTED', actorName: 'Reviewer', note: 'Revise', createdAt: summary.submittedAt }],
      }
      const row = mapEditRequestDetail(map(), detail)
      assert.equal(row.pointCode, 'S0915')
      assert.equal(row.systemType, 'CEMS')
      assert.equal(row.statusCode, 'REVISION_REQUESTED')
      assert.equal(row.status, 'รอโรงงานแก้ไข')
      assert.equal(row.statusHistory[0].changedByName, 'Reviewer')
      assert.equal(row.statusHistory[0].note, 'Revise')
      assert.equal(row.raw, detail)
      assert.equal(row.raw.proposedMeasurementPoints[1].documentsAndImages[0].fileId, 123)
      assert.equal(row.raw.contactPersons[0].name, 'Contact')
      assert.equal(getEditRequestFormQuery(row), 'systemType=CEMS')
      assert.equal(mapEditRequestDetail(row, detail).pointCode, 'S0915')
      const form = normalizeFactoryFormData({
        factoryId: summary.factoryId, factoryName: 'From form endpoint', systemType: 'CEMS',
        measurementPoints: [{ ...cems, pointName: 'From form endpoint', details: { requestedParameters: ['NOx (ppm)'] } }],
      }, row, { __fromFormEndpoint: true, __formType: 'MEASUREMENT_POINTS', __isResubmission: true })
      assert.equal(form.factoryName, 'From form endpoint')
      assert.equal(form.measurementPoints[0].pointName, 'From form endpoint')
      assert.deepEqual(form.measurementPoints[0].details.requestedParameters, ['NOx (ppm)'])
    })

    await t.test('a refreshed resubmission replaces target IDs and submission date', () => {
      const row = map({
        targetMeasurementPoints: [wpms], status: 'REVISED_PENDING_REVIEW',
        statusLabel: 'แก้ไขแล้ว/รอพิจารณา', submittedAt: '2026-09-20T00:00:00Z', revisionNo: 1,
      })
      assert.equal(row.pointCode, 'P0155')
      assert.equal(row.submittedDate, '20/09/2569')
      assert.equal(row.statusCode, 'REVISED_PENDING_REVIEW')
      assert.equal(getEditRequestFormQuery(row), 'systemType=WPMS')
    })

    await t.test('target columns retain filter/export text and actions reference the request ID', () => {
      const columns = getPageRequestColumns()
      assert.deepEqual(columns.filter((column) => ['systemType', 'pointCode', 'pointName'].includes(column.field))
        .map((column) => column.field), ['systemType', 'pointCode', 'pointName'])
      for (const field of ['systemType', 'pointCode', 'pointName']) {
        const column = columns.find((item) => item.field === field)
        assert.notEqual(column.filterable, false)
        assert.equal(typeof column.renderCell, 'function')
      }
      const row = map({ targetMeasurementPoints: [cems, wpms] })
      assert.equal(row.requestId, summary.id)
      assert.equal(row.id, summary.id)
    })
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
