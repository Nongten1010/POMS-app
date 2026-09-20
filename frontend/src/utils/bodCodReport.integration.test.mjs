import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PDFDocument } from 'pdf-lib'
import { createServer } from 'vite'

test('BOD/COD UI, payload and PDF integration', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-bod-cod-'))
  const originalFetch = globalThis.fetch
  const server = await createServer({
    cacheDir, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    plugins: [{ name: 'bod-cod-test-exports', enforce: 'pre', transform(code, id) {
      if (id.endsWith('/src/pages/BodCodReportPage.jsx')) return `${code}\nexport { ReportActions, mapBodCodReportRow, mapBodCodReportDetail, makeDraftReport, makeEditableReport, getBodCodFormValues, buildBodCodReportPayload, officerSubMenus };`
      if (id.endsWith('/src/utils/bodCodReportPdf.js')) return `${code}\nexport { drawDocumentMetadata, BodCodPdfLayout };`
    } }],
  })
  try {
    const page = await server.ssrLoadModule('/src/pages/BodCodReportPage.jsx')
    const pdf = await server.ssrLoadModule('/src/utils/bodCodReportPdf.js')
    const permissions = { bod_cod_errors: { view: true, edit: true, approve: true } }
    const fixture = {
      id: 5, factoryId: 'F1', factoryName: 'โรงงานทดสอบ', factoryRegistration: 'F1',
      connectedMeasurementPointId: 10, pointCode: 'P0010', pointName: 'น้ำทิ้ง',
      reportRoundNo: 2, reportSequenceNo: 3, reportYear: 2569, reportNo: 'E-01-0010/2569',
      selectedParameterCode: 'COD', reporterName: 'ผู้รายงาน ทดสอบ', reporterPosition: 'ผู้จัดการ',
      submittedAt: '2026-09-19T18:00:00Z', statusCode: 'APPROVED',
      resultNotice: { inspectorName: 'ผู้ตรวจสอบ ทดสอบ', inspectorPosition: 'เจ้าหน้าที่', updatedAt: '2026-09-20T01:00:00Z' },
    }
    await t.test('mapping keeps annual sequence separate; payload still sends half-year and no invented number', async () => {
      const row = page.mapBodCodReportRow(fixture)
      assert.equal(row.reportRound, 'ก.ค.-ธ.ค.')
      assert.equal(row.roundNo, '2')
      assert.equal(row.reportSequenceNo, 3)
      const detail = page.mapBodCodReportDetail(fixture)
      assert.equal(detail.monitoringPointId, 10)
      const payload = await page.buildBodCodReportPayload(detail, 'test')
      assert.equal(payload.reportRoundNo, 2)
      assert.equal(payload.reportYear, 2569)
      assert.equal(payload.selectedParameterCode, 'COD')
      assert.equal(payload.reportSequenceNo, undefined)
      const draft = page.makeDraftReport({ factoryId: 'F1' }, { id: 10, parameters: 'BOD, COD' }, 2)
      assert.equal(draft.roundNo, 2)
      assert.equal(draft.reportSequenceNo, undefined)
      assert.deepEqual(page.officerSubMenus.map((tab) => tab.value), ['factories', 'reports', 'statistics'])
    })
    await t.test('new reports prefill the login name, leave position blank and preserve manually edited values in payload', async () => {
      for (const role of ['ผู้ประกอบการ', 'เจ้าหน้าที่']) {
        const user = { name: '  ผู้ใช้งาน ทดสอบ  ', position: 'ตำแหน่งบัญชี', role }
        const draft = page.makeDraftReport({ factoryId: 'F1' }, { id: 10, parameters: 'COD' }, 2, user)
        assert.equal(draft.reporterName, 'ผู้ใช้งาน ทดสอบ')
        assert.equal(draft.reporterPosition, '')
        assert.equal(page.getBodCodFormValues(draft).reporterName, 'ผู้ใช้งาน ทดสอบ')
        const prefilledPayload = await page.buildBodCodReportPayload(draft, 'test')
        assert.equal(prefilledPayload.reporterName, 'ผู้ใช้งาน ทดสอบ')
        const editedPayload = await page.buildBodCodReportPayload({ ...draft, reporterName: 'ชื่อที่แก้ไข ทดสอบ' }, 'test')
        assert.equal(editedPayload.reporterName, 'ชื่อที่แก้ไข ทดสอบ')
      }
      for (const user of [null, undefined, {}, { name: '   ' }]) {
        assert.equal(page.makeDraftReport({}, { id: 10, parameters: 'COD' }, 2, user).reporterName, '')
      }
    })
    await t.test('existing reports keep their saved name and position, including deliberately empty names', () => {
      for (const reporterName of ['ผู้รายงานเดิม ทดสอบ', '']) {
        const detail = page.mapBodCodReportDetail({ ...fixture, reporterName })
        const editable = page.makeEditableReport(detail)
        assert.equal(editable.reporterName, reporterName)
        assert.equal(page.getBodCodFormValues(editable).reporterName, reporterName)
        assert.equal(editable.reporterPosition, fixture.reporterPosition)
      }
    })
    await t.test('operator cancel stays visible/enabled for rejected but disabled for approved', () => {
      for (const statusCode of ['REJECTED', 'APPROVED']) {
        const html = renderToStaticMarkup(createElement(page.ReportActions, {
          row: { statusCode }, mode: 'operator', actionContext: { userType: 'operator', permissions },
        }))
        const button = html.match(/<button[^>]*>ยกเลิกคำขอ(?:<[^>]+>)*<\/button>/)?.[0]
        assert.ok(button)
        assert.equal(button.includes('disabled=""'), statusCode === 'APPROVED')
      }
    })
    await t.test('PDF metadata has bold final approval only and real Thai dates', () => {
      const output = []
      const layout = { margin: { left: 32, right: 32 }, width: 595, y: 800,
        textWidth: (value) => value.length * 4,
        drawText: (value, x, y, options) => output.push({ value, x, y, options }),
      }
      pdf.drawDocumentMetadata(layout, fixture)
      assert.ok(output.some((text) => text.value === 'ผ่านการพิจารณา' && text.options.bold))
      assert.ok(output.some((text) => text.value.includes('20/09/2569')))
      assert.ok(!output.some((text) => text.value.includes(fixture.reporterName)))
      output.length = 0
      pdf.drawDocumentMetadata(layout, { ...fixture, statusCode: 'WAITING_APPROVAL' })
      assert.ok(!output.some((text) => text.value === 'ผ่านการพิจารณา'))
    })
    await t.test('both PDFs generate with local fonts, including central/regional notice', async () => {
      globalThis.fetch = async (url) => new Response(await readFile(new URL(`../assets/fonts/${String(url).includes('-Bold') ? 'THSarabunNew-Bold.ttf' : 'THSarabunNew.ttf'}`, import.meta.url)))
      const report = page.mapBodCodReportDetail(fixture)
      for (const [name, generator, data] of [
        ['report', pdf.createBodCodReportPdf, report],
        ['notice-central', pdf.createBodCodResultNoticePdf, { ...report, approvalTrack: 'CENTRAL', regionCode: 'CENTRAL' }],
        ['notice-regional', pdf.createBodCodResultNoticePdf, { ...report, approvalTrack: 'REGIONAL', regionCode: 'R1' }],
      ]) {
        const drawn = []
        const originalDrawText = pdf.BodCodPdfLayout.prototype.drawText
        pdf.BodCodPdfLayout.prototype.drawText = function (value, x, y, options) {
          drawn.push({ value, x, y })
          return originalDrawText.call(this, value, x, y, options)
        }
        let bytes
        try { bytes = await generator(data) } finally { pdf.BodCodPdfLayout.prototype.drawText = originalDrawText }
        if (name.startsWith('notice-')) {
          assert.ok(!drawn.some((item) => item.value === 'ผู้รายงาน :'))
          assert.ok(!drawn.some((item) => item.value === 'วันที่ :' && item.y === 47))
          assert.ok(drawn.some((item) => item.value === '(ลงชื่อ)'))
          assert.ok(drawn.some((item) => item.value === 'วันที่ยื่นคำขอ 20/09/2569'))
        }
        if (name === 'notice-central') {
          const lastNote = drawn.find((item) => item.value.startsWith('กรมโรงงานอุตสาหกรรมจะดำเนินการแจ้งผล'))
          const firstSignature = drawn.find((item) => item.value === '(ลงชื่อ)')
          assert.ok(lastNote.y > firstSignature.y + 16, 'note must not overlap signatures')
        }
        assert.ok((await PDFDocument.load(bytes)).getPageCount() > 0)
        if (process.env.BOD_COD_PDF_DIR) await writeFile(join(process.env.BOD_COD_PDF_DIR, `${name}.pdf`), bytes)
      }
    })
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
