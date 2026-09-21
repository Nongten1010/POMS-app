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
      if (id.endsWith('/src/pages/BodCodReportPage.jsx')) return `${code}\nexport { ReportActions, StatusChip, getReportColumns, mapBodCodReportRow, mapBodCodReportDetail, makeDraftReport, makeEditableReport, getBodCodFormValues, buildBodCodReportPayload, officerSubMenus };`
      if (id.endsWith('/src/utils/bodCodReportPdf.js')) return `${code}\nexport { drawDocumentMetadata, drawSignature, BodCodPdfLayout };`
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
    await t.test('status chips use the approved palette for both codes and Thai labels', () => {
      for (const [statusCode, value, color] of [
        ['REVISION_REQUESTED', 'รอโรงงานแก้ไข', '#f97316'],
        ['SUBMITTED', 'รอพิจารณา', '#2563eb'],
        ['REVISED_PENDING_REVIEW', 'แก้ไขแล้ว/รอพิจารณา', '#2563eb'],
        ['WAITING_RESULT_NOTICE', 'กรอกแบบแจ้งผล', '#2563eb'],
        ['WAITING_REVIEW', 'รอทบทวน', '#7c3aed'],
        ['WAITING_APPROVAL', 'รออนุมัติ', '#7c3aed'],
        ['APPROVED', 'ผ่านการพิจารณา', '#16a34a'],
        ['REJECTED', 'ไม่อนุมัติ', '#dc2626'],
        ['CANCELLED', 'ยกเลิก', '#dc2626'],
      ]) {
        for (const props of [{ statusCode, value }, { value }, { value: statusCode }]) {
          const chip = page.StatusChip(props)
          assert.equal(chip.props.variant, 'filled')
          assert.equal(chip.props.sx.bgcolor, color)
          assert.equal(chip.props.sx.borderColor, color)
          assert.equal(chip.props.sx.color, '#ffffff')
          assert.equal(chip.props.label, props.value)
          const html = renderToStaticMarkup(chip)
          assert.ok(html.includes(`background-color:${color}`))
          assert.ok(html.includes(props.value))
        }
      }
    })
    await t.test('operator pending labels retain actual workflow colors in the report grid', () => {
      for (const [statusCode, color] of [
        ['SUBMITTED', '#2563eb'], ['REVISED_PENDING_REVIEW', '#2563eb'],
        ['WAITING_RESULT_NOTICE', '#2563eb'], ['WAITING_REVIEW', '#7c3aed'], ['WAITING_APPROVAL', '#7c3aed'],
      ]) {
        const row = page.mapBodCodReportRow({ ...fixture, statusCode }, 0, { isOperatorView: true })
        assert.equal(row.status, 'รอพิจารณา')
        const column = page.getReportColumns('operator', {}).find((item) => item.field === 'status')
        const cell = column.renderCell({ row, value: row.status })
        const chip = page.StatusChip(cell.props)
        assert.equal(chip.props.label, 'รอพิจารณา')
        assert.equal(chip.props.sx.bgcolor, color)
      }
      assert.equal(page.StatusChip({ statusCode: 'REJECTED', value: 'รอพิจารณา' }).props.sx.bgcolor, '#dc2626')
    })
    await t.test('missing or unknown statuses keep neutral styling instead of implying a workflow action', () => {
      for (const value of ['', 'ยังไม่ยื่น', 'DRAFT', 'UNKNOWN']) {
        const chip = page.StatusChip({ value })
        assert.equal(chip.props.variant, 'outlined')
        assert.equal(chip.props.sx, undefined)
      }
      assert.equal(page.StatusChip({ statusCode: 'UNKNOWN', value: 'รอพิจารณา' }).props.variant, 'outlined')
      const blank = renderToStaticMarkup(page.StatusChip({ value: '-', statusCode: 'SUBMITTED' }))
      assert.ok(!blank.includes('MuiChip'))
    })
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
    await t.test('resubmission payload retains old year, period, point and parameter without sending annual sequence', async () => {
      const original = page.mapBodCodReportDetail({ ...fixture, reportYear: 2568, reportRoundNo: 1, statusCode: 'REVISION_REQUESTED' })
      const edited = page.makeEditableReport(original)
      assert.equal(edited.mode, 'edit')
      assert.deepEqual(edited.allowedParameterCodes, ['COD'])
      const payload = await page.buildBodCodReportPayload(edited, 'test')
      assert.equal(payload.reportYear, 2568)
      assert.equal(payload.reportRoundNo, 1)
      assert.equal(payload.connectedMeasurementPointId, 10)
      assert.equal(payload.selectedParameterCode, 'COD')
      assert.equal(payload.reportSequenceNo, undefined)
      assert.equal(payload.originalIdentity, undefined)
      assert.equal(edited.reportNo, original.reportNo)
      await assert.rejects(page.buildBodCodReportPayload({ ...edited, parameter: 'BOD' }, 'test'), /ข้อมูลอ้างอิง/)
    })
    await t.test('factory parameter codes are authoritative and synthetic table IDs never enter the payload', async () => {
      const factory = { factoryId: 'F1' }
      const point = { id: 'point-0-0', code: 'P0010', parameterCodes: ['COD (mg/l)'], parameters: 'BOD, COD' }
      const draft = page.makeDraftReport(factory, point, 2)
      assert.deepEqual(draft.allowedParameterCodes, ['COD'])
      assert.equal(draft.parameter, 'COD')
      assert.equal(draft.monitoringPointId, null)
      const payload = await page.buildBodCodReportPayload(draft, 'test')
      assert.equal(payload.connectedMeasurementPointId, null)
      assert.equal(payload.pointCode, 'P0010')
      const noParameters = page.makeDraftReport(factory, { ...point, parameterCodes: [] }, 2)
      assert.equal(noParameters.parameter, '')
      assert.deepEqual(noParameters.allowedParameterCodes, [])
    })
    await t.test('authoritative detail null step and empty actions cannot inherit stale grants from the list', () => {
      const cached = { ...fixture, currentStep: { roleCode: 'INSPECTOR', status: 'PENDING', isCurrent: true }, allowedActions: ['APPROVE'] }
      const latest = page.mapBodCodReportDetail({ id: fixture.id, currentStep: null, allowedActions: [] }, cached)
      assert.equal(latest.currentStep, null)
      assert.deepEqual(latest.allowedActions, [])
      const incomplete = page.mapBodCodReportDetail({ id: fixture.id }, cached)
      assert.equal(incomplete.currentStep, null)
      assert.deepEqual(incomplete.allowedActions, [])
    })
    await t.test('operator cancel stays visible/enabled for rejected but disabled for approved', () => {
      for (const statusCode of ['REJECTED', 'APPROVED']) {
        const html = renderToStaticMarkup(createElement(page.ReportActions, {
          row: { statusCode }, mode: 'operator', actionContext: { userType: 'operator', roleCode: 'factory_operator', permissions },
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
    await t.test('reporter name and signature date are centered on their dotted lines', () => {
      for (const reporterName of ['ผู้รายงาน ทดสอบ', 'ชื่อผู้รายงานที่ยาวมาก '.repeat(5), '']) {
        const texts = []
        const lines = []
        const layout = {
          width: 595, margin: { right: 46, bottom: 42 }, y: 250,
          ensureSpace: () => {},
          textWidth: (text, size) => text.length * size / 2,
          drawText: (text, x, y, { size }) => texts.push({ text, x, y, size }),
          page: { drawLine: (line) => lines.push(line) },
        }
        pdf.drawSignature(layout, { ...fixture, reporterName })
        for (const label of ['ผู้รายงานผลการทดสอบ', 'ลงวันที่']) {
          const labelText = texts.find((item) => item.text === label)
          const value = texts.find((item) => item.y === labelText.y && item !== labelText)
          const line = lines.find((item) => item.start.y === labelText.y - 4)
          const width = layout.textWidth(value.text, value.size)
          assert.ok(Math.abs(value.x + width / 2 - (line.start.x + line.end.x) / 2) < 0.001)
          assert.ok(value.x >= line.start.x && value.x + width <= line.end.x)
          assert.ok(value.size <= 13)
        }
      }
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
    await t.test('business activity wraps without overlapping later fields, tables or signatures', async () => {
      globalThis.fetch = async (url) => new Response(await readFile(new URL(`../assets/fonts/${String(url).includes('-Bold') ? 'THSarabunNew-Bold.ttf' : 'THSarabunNew.ttf'}`, import.meta.url)))
      const longActivity = 'ผลิตสารเคมีสำหรับใช้ในอุตสาหกรรมและผลิตภัณฑ์พลาสติก รวมถึงการแปรรูปวัตถุดิบและการบำบัดน้ำเสียจากกระบวนการผลิต'
      for (const [name, businessActivity] of [
        ['short', 'ผลิตไฟฟ้า'], ['empty', ''], ['long', longActivity],
        ['newlines', 'ผลิตไฟฟ้า\nบำบัดน้ำเสีย'], ['overflow', longActivity.repeat(15)],
      ]) {
        const drawn = []
        const originalDrawText = pdf.BodCodPdfLayout.prototype.drawText
        pdf.BodCodPdfLayout.prototype.drawText = function (value, x, y, options = {}) {
          drawn.push({ value, x, y, page: this.pdfDoc.getPageCount(), right: x + this.textWidth(value, options.size, options.bold) })
          return originalDrawText.call(this, value, x, y, options)
        }
        let bytes
        try {
          bytes = await pdf.createBodCodReportPdf({ ...page.mapBodCodReportDetail(fixture), businessActivity })
        } finally {
          pdf.BodCodPdfLayout.prototype.drawText = originalDrawText
        }
        const start = drawn.findIndex((item) => item.value === 'ประกอบกิจการ :')
        const end = drawn.findIndex((item) => item.value === 'สถานที่ตั้ง :')
        const activityLines = drawn.slice(start + 1, end)
        assert.equal(activityLines.map((item) => item.value).join('').replace(/\s/g, ''), businessActivity.replace(/\s/g, ''), name)
        if (['long', 'newlines', 'overflow'].includes(name)) assert.ok(activityLines.length > 1, name)
        else assert.equal(activityLines.length, 1, name)
        for (const item of activityLines) {
          assert.ok(item.right <= 595.28 - 46, `${name}: activity must fit column`)
          assert.ok(item.y >= 42, `${name}: activity must fit page`)
        }
        const last = activityLines.at(-1)
        const address = drawn[end]
        assert.ok(address.page > last.page || address.y <= last.y - 18, `${name}: address must follow activity`)
        const signature = drawn.find((item) => item.value === 'ผู้รายงานผลการทดสอบ')
        const finalNote = drawn.find((item) => item.value === 'การปัดเศษ ให้เป็นไปตาม มอก.929-2533')
        assert.ok(signature.page > finalNote.page || signature.y <= finalNote.y - 28, `${name}: signature must follow notes`)
        assert.ok(drawn.every((item) => item.y >= 42), `${name}: all content must fit pages`)
        const doc = await PDFDocument.load(bytes)
        if (name === 'short' || name === 'empty') assert.equal(doc.getPageCount(), 1)
        if (name === 'overflow') assert.ok(doc.getPageCount() > 1)
        if (process.env.BOD_COD_PDF_DIR) await writeFile(join(process.env.BOD_COD_PDF_DIR, `activity-${name}.pdf`), bytes)
      }
    })
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
