import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PDFDocument } from 'pdf-lib'
import { createServer } from 'vite'

test('master-data detail comparison and PDF cover every target without inventing missing snapshots', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-detail-points-'))
  const originalWindow = globalThis.window
  const originalFetch = globalThis.fetch
  const server = await createServer({
    cacheDir,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    plugins: [{
      name: 'master-data-detail-points-test-exports',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('/src/pages/MasterDataPage.jsx')) {
          return `${code}\nexport { mapEditRequestToPdfRequest, getChangedMeasurementPointFieldNames, getMissingPointSnapshotMessage, RequestComparisonContent, RequestMonitoringPointPreview };`
        }
        if (id.endsWith('/src/utils/connectionRequestPdf.js')) return `${code}\nexport { getPdfRenderRequests };`
      },
    }],
  })
  try {
    await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
    globalThis.window = { location: { hostname: 'localhost' } }
    const {
      mapEditRequestToPdfRequest, getChangedMeasurementPointFieldNames, getMissingPointSnapshotMessage,
      RequestComparisonContent, RequestMonitoringPointPreview,
    } = await server.ssrLoadModule('/src/pages/MasterDataPage.jsx')
    const { createConnectionRequestPdf, getPdfRenderRequests } = await server.ssrLoadModule('/src/utils/connectionRequestPdf.js')
    const cems = {
      connectedPointId: 10021, systemType: 'CEMS', pointCode: 'S0915', pointName: 'Air target',
      details: { monitoringPointKind: 'CEMS', stackHeight: 10, eligibleParameters: ['NOx (ppm)'] },
      officerNotificationEmails: ['air@example.com'], measurementInstruments: { parameters: [] },
    }
    const wpms = {
      connectedPointId: 10024, systemType: 'WPMS', pointCode: 'P0155', pointName: 'Water target',
      details: { monitoringPointKind: 'WPMS', averageWastewaterDischarge: 20, eligibleParameters: ['BOD (mg/l)'] },
      officerNotificationEmails: ['water@example.com'], measurementInstruments: { parameters: [] },
    }
    const raw = {
      id: 48, formType: 'MEASUREMENT_POINTS', requestNo: 'point-test/2569',
      submittedAt: '2026-09-19T00:00:00Z', factoryName: 'Factory fixture', factoryId: 'fixture-id',
      currentFactory: { factoryName: 'Factory fixture' }, proposedFactory: { factoryName: 'Factory fixture' },
      currentMeasurementPoints: [wpms, cems],
      proposedMeasurementPoints: [{ ...cems, details: { ...cems.details, stackHeight: 12 } }, wpms],
    }
    const request = { formType: 'MEASUREMENT_POINTS', requestNo: raw.requestNo, raw }

    await t.test('selected ID scopes orange highlights and contact/email data to the same point', () => {
      assert.deepEqual(getChangedMeasurementPointFieldNames(raw, 10021), ['stackHeight'])
      assert.deepEqual(getChangedMeasurementPointFieldNames(raw, 10024), [])
      assert.deepEqual(getChangedMeasurementPointFieldNames(raw, 999), [])
      const partial = { ...raw, currentMeasurementPoints: [] }
      assert.deepEqual(getChangedMeasurementPointFieldNames(partial, 10021), [])
      for (const point of [cems, wpms]) {
        const element = RequestMonitoringPointPreview({ request, factory: {}, measurementPoints: [point], highlightedFieldNames: [], variant: 'after' })
        const form = element.props.children.find((child) => child?.props?.initialRequest)
        assert.equal(form.props.initialRequest.systemType, point.systemType)
        assert.equal(form.props.initialRequest.measurementPoints[0].connectedPointId, point.connectedPointId)
        assert.deepEqual(form.props.initialRequest.officerNotificationEmails, point.officerNotificationEmails)
      }
    })

    await t.test('multiple targets expose one tab per ID even with repeated or empty codes', () => {
      const mixed = {
        ...raw,
        proposedMeasurementPoints: [cems, { ...wpms, pointCode: 'S0915' }, { ...cems, connectedPointId: 10030, pointCode: null }],
      }
      for (const variant of ['after', 'before']) {
        const html = renderToStaticMarkup(createElement(RequestComparisonContent, { request: { ...request, raw: mixed }, variant }))
        assert.equal((html.match(/role="tab"/g) ?? []).length, 3)
        assert.match(html, /ID 10021/)
        assert.match(html, /ID 10024/)
        assert.match(html, /ID 10030/)
      }
    })

    await t.test('empty/null sides show an explanation, never an empty form or invented differences', () => {
      for (const snapshot of [[], null, undefined]) {
        for (const variant of ['before', 'after']) {
          const empty = { ...raw, currentMeasurementPoints: snapshot, proposedMeasurementPoints: snapshot }
          const html = renderToStaticMarkup(createElement(RequestComparisonContent, { request: { ...request, raw: empty }, variant }))
          assert.match(html, /role="alert"/)
          assert.ok(!html.includes('<form'))
          assert.ok(getMissingPointSnapshotMessage(empty, variant))
          assert.deepEqual(getChangedMeasurementPointFieldNames(empty, 10021), [])
        }
        const missingProposal = { ...raw, proposedMeasurementPoints: snapshot }
        const pdfRequest = mapEditRequestToPdfRequest({ ...request, raw: missingProposal })
        assert.deepEqual(pdfRequest.measurementPoints, [])
        assert.throws(() => getPdfRenderRequests(pdfRequest, { contentMode: 'measurement-point' }), /ไม่มีข้อมูลจุดตรวจวัด/)
      }
      const partial = { ...raw, currentMeasurementPoints: [wpms], proposedMeasurementPoints: [cems] }
      const html = renderToStaticMarkup(createElement(RequestComparisonContent, { request: { ...request, raw: partial }, variant: 'before' }))
      assert.match(html, /ไม่พบ snapshot ของจุดตรวจวัดนี้/)
      assert.ok(!html.includes('<form'))
    })

    await t.test('PDF uses all proposed points with each system and own emails, not before values', () => {
      const mapped = mapEditRequestToPdfRequest(request)
      assert.equal(mapped.systemType, null)
      assert.equal(mapped.measurementPoints[0].details.stackHeight, 12)
      const pages = getPdfRenderRequests({
        ...mapped, officerNotificationEmails: ['aggregate@example.com'],
        proposedContacts: { systemType: 'CEMS', contactPersons: [{ name: 'Air contact' }], notificationEmails: ['air-factory@example.com'] },
      }, { contentMode: 'measurement-point' })
      assert.deepEqual(pages.map((page) => page.systemType), ['CEMS', 'WPMS'])
      assert.deepEqual(pages.map((page) => page.measurementPoints[0].connectedPointId), [10021, 10024])
      assert.deepEqual(pages[0].officerNotificationEmails, ['air@example.com'])
      assert.deepEqual(pages[1].officerNotificationEmails, ['water@example.com'])
      assert.deepEqual(pages[1].contactPersons, [])
      assert.deepEqual(pages[1].notificationEmails, [])
      assert.throws(() => getPdfRenderRequests({ measurementPoints: [{}] }, { contentMode: 'measurement-point' }), /ไม่พบประเภท/)
      for (const contentMode of [undefined, 'factory-general-info']) {
        assert.deepEqual(getPdfRenderRequests(mapped, { contentMode }), [mapped])
      }
    })

    await t.test('real mixed-system PDF contains the pages of both single-point PDFs', async () => {
      globalThis.fetch = async (url) => {
        const name = String(url).split('/').at(-1).split('?')[0]
        assert.ok(['THSarabunNew.ttf', 'THSarabunNew-Bold.ttf'].includes(name), `Unexpected fetch: ${url}`)
        return new Response(await readFile(new URL(`../assets/fonts/${name}`, import.meta.url)))
      }
      const mapped = mapEditRequestToPdfRequest(request)
      const options = { contentMode: 'measurement-point', showRequestMetaHeader: true }
      let singlePageCount = 0
      for (const point of mapped.measurementPoints) {
        const bytes = await createConnectionRequestPdf({ ...mapped, measurementPoints: [point] }, options)
        singlePageCount += (await PDFDocument.load(bytes)).getPageCount()
      }
      const bytes = await createConnectionRequestPdf(mapped, options)
      const document = await PDFDocument.load(bytes)
      assert.equal(document.getPageCount(), singlePageCount)
      for (const page of document.getPages()) {
        assert.ok(page.getWidth() > 500)
        assert.ok(page.getHeight() > 800)
      }
      if (process.env.POMS_TEST_PDF_OUTPUT) await writeFile(process.env.POMS_TEST_PDF_OUTPUT, bytes)
      await assert.rejects(() => createConnectionRequestPdf({ ...mapped, measurementPoints: [] }, options), /ไม่มีข้อมูลจุดตรวจวัด/)
    })
  } finally {
    globalThis.fetch = originalFetch
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
