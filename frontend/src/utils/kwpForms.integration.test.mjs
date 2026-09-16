import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import React, { Children, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PDFDocument } from 'pdf-lib'
import { createServer } from 'vite'
import {
  canCancelKwpRequest, cancelKwpSubmission, formatKwpDocumentDate,
  getCurrentThaiYear, getKwpAttachmentValidationError, getKwpReportPeriod,
} from './kwpFormPresentation.mjs'

function findButtons(element) {
  if (!isValidElement(element)) return []
  return [
    ...(element.props.onClick ? [element] : []),
    ...Children.toArray(element.props.children).flatMap(findButtons),
  ]
}

test('KWP cancellation blocks only reviewed and cancelled requests and handles API errors', async () => {
  const sent = []
  for (const statusCode of ['SUBMITTED', 'REVISION_REQUESTED', 'REVISED_PENDING_REVIEW', 'REJECTED', 'รอโรงงานแก้ไข']) {
    const request = { id: 9, statusCode }
    assert.equal(canCancelKwpRequest(request), true)
    const response = await cancelKwpSubmission({ request, accessToken: 'test-token', apiBaseUrl: '/api/v1/kwp-form-submissions',
      fetchImpl: async (url, options) => {
        sent.push({ url, options })
        return Response.json({ success: true, data: { status: 'CANCELLED' } })
      },
    })
    assert.equal(response.data.status, 'CANCELLED')
    assert.equal(sent.at(-1).url, '/api/v1/kwp-form-submissions/9/workflow-actions')
    assert.equal(sent.at(-1).options.method, 'POST')
    assert.deepEqual(JSON.parse(sent.at(-1).options.body), { action: 'CANCEL' })
  }
  for (const status of ['APPROVED', 'ผ่านการพิจารณา', 'CANCELLED', 'CANCELED', 'ยกเลิก', '']) {
    assert.equal(canCancelKwpRequest({ status }), false)
    await assert.rejects(cancelKwpSubmission({ request: { id: 9, status }, accessToken: 'test-token',
      fetchImpl: () => assert.fail('terminal requests must not be sent'),
    }))
  }
  for (const status of [400, 403, 409, 500]) {
    await assert.rejects(cancelKwpSubmission({ request: { id: 9, status: 'SUBMITTED' }, accessToken: 'test-token', apiBaseUrl: '/api',
      fetchImpl: async () => Response.json({ success: false, error: { message: 'backend rejection' } }, { status }),
    }), /backend rejection/)
  }
})

test('KWP dates, report periods and attachment limits are validated locally', () => {
  assert.equal(formatKwpDocumentDate('2026-09-16T18:30:00Z'), '17/09/2569')
  assert.equal(formatKwpDocumentDate('16/09/2569'), '16/09/2569')
  assert.equal(formatKwpDocumentDate(null), '')
  assert.equal(formatKwpDocumentDate('invalid'), '')
  assert.equal(getCurrentThaiYear(new Date('2026-12-31T18:00:00Z')), 2570)
  const period = new FormData()
  period.set('reportRound', '1')
  period.set('reportYear', '2569')
  assert.deepEqual(getKwpReportPeriod(period), { reportRound: 1, reportYear: 2569 })
  for (const value of ['', '0', '-1', '1.5', 'abc']) {
    period.set('reportRound', value)
    assert.throws(() => getKwpReportPeriod(period))
  }
  period.set('reportRound', '1')
  period.set('reportYear', '2026')
  assert.throws(() => getKwpReportPeriod(period))
  const file = new File(['pdf'], 'report.pdf', { type: 'application/pdf' })
  assert.equal(getKwpAttachmentValidationError([file, file], 5, 10), '')
  assert.ok(getKwpAttachmentValidationError(Array(6).fill(file)))
  assert.ok(getKwpAttachmentValidationError([new File(['text'], 'bad.exe')]))
  assert.ok(getKwpAttachmentValidationError([{ name: 'large.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 }], 5, 10))
})

test('KWP forms, detail round trips and generated PDF content', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-kwp-test-'))
  const originalFormData = globalThis.FormData
  const originalFetch = globalThis.fetch
  const server = await createServer({ cacheDir, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    plugins: [{ name: 'kwp-test-exports', enforce: 'pre', transform(code, id) {
      if (id.endsWith('/src/pages/KwpFormsPage.jsx')) return `${code}\nexport { Kwp01Form, Kwp02Form, Kwp03Form, RequestActions, KwpCancelRequestDialog, buildKwp01PreviewData, buildKwp02PreviewData, buildKwp03PreviewData, buildKwp01SubmissionPayload, buildKwp02SubmissionPayload, buildKwp03SubmissionPayload, buildKwpEditFormFromDetail, buildKwpRequestPreviewDataFromDetail, getKwpPreviewAttachmentGroups };`
      if (id.endsWith('/src/utils/kwpFormPdf.js')) return `${code}\nexport { KwpPdfLayout };`
    } }],
  })
  try {
    const page = await server.ssrLoadModule('/src/pages/KwpFormsPage.jsx')
    const pdf = await server.ssrLoadModule('/src/utils/kwpFormPdf.js')
    globalThis.FormData = class extends originalFormData {
      constructor(entries) {
        super()
        for (const [key, value] of entries ?? []) this.set(key, value)
      }
    }
    const file = { name: 'saved.pdf', originalFileName: 'saved.pdf', mimeType: 'application/pdf',
      type: 'application/pdf', storagePath: '/uploads/saved.pdf', url: 'https://example.com/saved.pdf', isSubmitted: true }
    const inputs = [['attachmentLink', 'https://example.com/evidence'], ['reportRound', '1'], ['reportYear', '2569'],
      ['samplingPhotoLink', 'https://example.com/photos'], ['labReportLink', 'https://example.com/lab'], ['reporterName', 'นายทดสอบ ระบบ']]
    const dates = { problemDate: null, expectedDoneDate: null }
    const selected = { instruments: [], issueReasons: [], failedParameters: [] }

    await t.test('01 and 03 each have one multi-file collection, one link, and preserve them on edit and preview', () => {
      for (const code of ['01', '03']) {
        const form = { code: `กวภ.${code}`, title: `กวภ.${code}`, factory: {}, point: {} }
        const Component = code === '01' ? page.Kwp01Form : page.Kwp03Form
        const html = renderToStaticMarkup(React.createElement(Component, {
          factory: {}, point: {}, defaults: {}, problemDate: null, expectedDoneDate: null,
          unreportedParameters: [], instruments: '', issueReasons: '', failedParameters: [], attachmentFiles: [],
        }))
        assert.equal((html.match(/type="file"/g) ?? []).length, 1)
        assert.ok(html.includes('multiple=""'))
        assert.ok(html.includes('name="attachmentLink"'))
        const payload = code === '01'
          ? page.buildKwp01SubmissionPayload(form, inputs, dates, [], [file])
          : page.buildKwp03SubmissionPayload(form, inputs, dates, selected, [file])
        assert.equal(payload.attachmentLink, 'https://example.com/evidence')
        assert.deepEqual(payload.attachments, [file])
        const preview = code === '01'
          ? page.buildKwp01PreviewData(form, inputs, dates, [], [file])
          : page.buildKwp03PreviewData(form, inputs, dates, selected, [file])
        assert.equal(preview.attachmentSections.length, 1)
        assert.equal(preview.attachmentSections[0].files[0].url, file.url)
        assert.equal(page.getKwpPreviewAttachmentGroups(preview)[0].items.length, 2)
        const detail = { ...payload, id: 1, formType: `KWP${code}`, submittedAt: '2026-09-16T00:00:00Z' }
        const edit = page.buildKwpEditFormFromDetail(detail)
        assert.equal(edit.defaults.attachmentLink, payload.attachmentLink)
        assert.equal(edit.initialState.attachmentFiles.length, 1)
        const view = page.buildKwpRequestPreviewDataFromDetail(detail)
        assert.equal(view.attachmentSections[0].link, payload.attachmentLink)
        assert.equal(view.attachmentSections[0].files.length, 1)
        assert.equal(view.signatureDate, '16/09/2569')
        assert.equal(view.reporterName, 'นายทดสอบ ระบบ')
      }
    })

    await t.test('02 and 04 place report period before point code and retain both links in payload and detail', () => {
      const html = renderToStaticMarkup(React.createElement(page.Kwp02Form, {
        factory: {}, point: { code: 'S2001' }, measurementRows: [], samplingPhotoFiles: [], labReportFiles: [],
      }))
      assert.equal((html.match(/type="file"/g) ?? []).length, 2)
      assert.ok(html.indexOf('name="reportRound"') < html.indexOf('รหัสจุดตรวจวัด'))
      assert.ok(html.indexOf('name="reportYear"') < html.indexOf('รหัสจุดตรวจวัด'))
      assert.match(html, new RegExp(`value="${getCurrentThaiYear()}"`))
      assert.ok(html.includes('name="samplingPhotoLink"'))
      assert.ok(html.includes('name="labReportLink"'))
      for (const code of ['02', '04']) {
        const form = { code: `กวภ.${code}`, title: `กวภ.${code}` }
        const payload = page.buildKwp02SubmissionPayload(form, inputs, [{ pollutant: 'CO (ppm)' }], [])
        assert.equal(payload.reportRound, 1)
        assert.equal(payload.reportYear, 2569)
        assert.equal(payload.samplingPhotoLink, 'https://example.com/photos')
        assert.equal(payload.labReportLink, 'https://example.com/lab')
        const preview = page.buildKwp02PreviewData(form, inputs, [])
        assert.equal(preview.reportYear, 2569)
        assert.equal(preview.attachmentSections[1].link, payload.labReportLink)
        const detail = { ...payload, formType: `KWP${code}` }
        const edit = page.buildKwpEditFormFromDetail(detail)
        assert.equal(edit.defaults.reportRound, 1)
        assert.equal(edit.defaults.reportYear, 2569)
        assert.equal(edit.defaults.samplingPhotoLink, payload.samplingPhotoLink)
        const view = page.buildKwpRequestPreviewDataFromDetail(detail)
        assert.equal(view.reportRound, 1)
        assert.equal(view.reportYear, 2569)
        assert.equal(view.attachmentSections[0].link, payload.samplingPhotoLink)
      }
    })

    await t.test('cancel action only opens confirmation and busy dialogs cannot close or submit again', () => {
      const row = { id: 1, requestNo: 'KWP01-0001/2569', status: 'SUBMITTED' }
      let target
      let confirmed = false
      const action = findButtons(page.RequestActions({ row, isOperator: true, onCancelRequest: (value) => { target = value } }))
        .find((button) => button.props.children === 'ยกเลิกคำขอ')
      assert.equal(action.props.disabled, false)
      action.props.onClick()
      assert.equal(target, row)
      assert.equal(confirmed, false)
      const props = { request: target, submitting: false, onClose: () => {}, onConfirm: () => { confirmed = true } }
      const dialog = page.KwpCancelRequestDialog(props)
      assert.equal(dialog.props.open, true)
      findButtons(dialog).find((button) => button.props.children === 'ยืนยันยกเลิกคำขอ').props.onClick()
      assert.equal(confirmed, true)
      const busy = page.KwpCancelRequestDialog({ ...props, submitting: true })
      assert.equal(busy.props.onClose, undefined)
      assert.ok(findButtons(busy).every((button) => button.props.disabled))
    })

    await t.test('all five PDFs contain metadata, bold approval, reporter name, dates and correct report period', async () => {
      globalThis.fetch = async (url) => new Response(await readFile(new URL(
        String(url).includes('Bold') ? '../assets/fonts/THSarabunNew-Bold.ttf' : '../assets/fonts/THSarabunNew.ttf', import.meta.url,
      )))
      const originalDraw = pdf.KwpPdfLayout.prototype.drawTextAt
      const drawn = []
      pdf.KwpPdfLayout.prototype.drawTextAt = function (text, x, y, options) {
        if (!this.templateRecording) drawn.push({ text: String(text), x, y, options, page: this.pdfDoc.getPageCount(), width: this.textWidth(text, options?.size, options?.bold) })
        return originalDraw.call(this, text, x, y, options)
      }
      try {
        for (const code of ['01', '02', '03', '04', '05']) {
          drawn.length = 0
          const data = { formType: `kwp${code}`, requestNo: `KWP${code}-0001/2569`, status: 'APPROVED',
            submittedAt: '2026-09-16T00:00:00Z', reporterName: 'นายทดสอบ ระบบ', reporterPosition: 'วิศวกร',
            factoryName: 'บริษัท ทดสอบ จำกัด', companyName: 'บริษัท ทดสอบ จำกัด', reportRound: 1, reportYear: 2569,
            measurementRows: [{ pollutant: 'CO (ppm)', measuredValue: '10', unit: 'ppm' }], calibrationRows: [],
            attachmentSections: [{ title: 'เอกสารแนบ', link: 'https://example.com/evidence', files: [{ name: 'evidence.pdf', type: 'application/pdf' }] }],
          }
          const bytes = await pdf.createKwpFormPdf(data)
          assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 2)
          assert.ok(drawn.some(({ text }) => text === `เลขที่ : ${data.requestNo}`))
          assert.ok(drawn.some(({ text, options }) => text === 'ผ่านการพิจารณา' && options.bold === true))
          assert.ok(!drawn.some(({ text }) => text.includes('ผู้แก้ไขข้อมูล')))
          assert.ok(drawn.some(({ text, y }) => text === 'นายทดสอบ ระบบ' && y > 50 && y < 796))
          assert.ok(drawn.some(({ text }) => text === 'วันที่ยื่นคำขอ : 16/09/2569'))
          assert.ok(drawn.some(({ text, y }) => text === '16/09/2569' && y > 50 && y < 796))
          if (['02', '04'].includes(code)) assert.ok(drawn.some(({ text }) => text.includes('1/2569')))
          if (code === '03') {
            const heading = drawn.find(({ text }) => text.startsWith('4.4 '))
            for (const parameter of ['BOD', 'COD', 'flow', 'watt']) {
              const option = drawn.find(({ text }) => text === parameter)
              assert.equal(option.page, heading.page)
              assert.equal(option.y, heading.y)
              assert.ok(option.x > heading.x)
            }
          }
          if (process.env.KWP_PDF_QA_DIR) {
            await mkdir(process.env.KWP_PDF_QA_DIR, { recursive: true })
            await writeFile(join(process.env.KWP_PDF_QA_DIR, `kwp${code}.pdf`), bytes)
          }
        }
        drawn.length = 0
        await pdf.createKwpFormPdf({ formType: 'kwp01', status: 'SUBMITTED' })
        assert.ok(!drawn.some(({ text }) => text === 'ผ่านการพิจารณา'))
        for (const code of ['01', '02', '03', '04', '05']) {
          drawn.length = 0
          const reporterName = `${'นายทดสอบนามสกุลยาว '.repeat(5)}NAME-END`
          const reporterPosition = `${'ผู้รับผิดชอบการตรวจสอบระบบ '.repeat(5)}POSITION-END`
          await pdf.createKwpFormPdf({ formType: `kwp${code}`, reporterName, reporterPosition,
            submittedAt: '2026-09-16T00:00:00Z' })
          const allText = drawn.map(({ text }) => text).join('').replace(/\s/g, '')
          assert.ok(allText.includes(reporterName.replace(/\s/g, '')), `${code}: complete reporter name`)
          assert.ok(allText.includes(reporterPosition.replace(/\s/g, '')), `${code}: complete reporter position`)
          const nameEnd = drawn.find(({ text }) => text.includes('NAME-END'))
          const positionEnd = drawn.find(({ text }) => text.includes('POSITION-END'))
          assert.equal(nameEnd.page, positionEnd.page)
          assert.ok(nameEnd.y > positionEnd.y)
          assert.ok(drawn.every(({ y }) => y >= 24 && y <= 818))
        }
        for (const formType of ['kwp02', 'kwp04']) {
          drawn.length = 0
          const bytes = await pdf.createKwpFormPdf({ formType, submittedAt: '2026-09-16T00:00:00Z',
            measurementRows: Array.from({ length: 10 }, () => ({ pollutant: 'CO (ppm)', measuredValue: '10' })),
          })
          assert.equal((await PDFDocument.load(bytes)).getPageCount(), 2)
          assert.ok(drawn.filter(({ text }) => text === '16/09/2569').every(({ y }) => y > 28))
        }
        for (const code of ['01', '02', '03', '04', '05']) {
          drawn.length = 0
          const longAddress = `${'ที่ตั้งโรงงานและอาคารผลิต ตำบลทดสอบ อำเภอทดสอบ '.repeat(10)}ADDRESS-END`
          const longReason = `${'สาเหตุขัดข้องและการตรวจสอบระบบโดยผู้รับผิดชอบ '.repeat(35)}REASON-END`
          const correctiveAction = Array.from({ length: 85 }, (_, index) => `ขั้นตอนดำเนินการแก้ไขระบบและตรวจสอบผล ลำดับ ${index} ACTION-${index}`).join('\n')
          const longLink = `https://example.com/${'evidence-'.repeat(30)}LINK-END.pdf`
          const data = { formType: `kwp${code}`, requestNo: `LONG-${code}`, reporterName: 'นายทดสอบ ระบบ', reporterPosition: 'วิศวกร',
            factoryName: 'บริษัท ทดสอบ จำกัด', companyName: 'บริษัท ทดสอบ จำกัด', factoryAddress: longAddress,
            issueReason: 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง', issueReasons: ['เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง'],
            reasonDetail: longReason, correctiveAction,
            reportRound: 2, reportYear: 2569, submittedAt: '2026-09-16T00:00:00Z',
            measurementRows: Array.from({ length: 24 }, (_, index) => ({ pollutant: `ROW-${index}`, measuredValue: index,
              method: `${'ตรวจวิเคราะห์ด้วยเครื่องมือตามมาตรฐาน '.repeat(7)}METHOD-END-${index}` })),
            calibrationRows: Array.from({ length: 8 }, (_, index) => ({ parameter: [`CAL-${index}`, 'CO (ppm)'],
              result: 'ผ่านการตรวจสอบ', verifierCompany: 'บริษัท ทดสอบการสอบเทียบ จำกัด', cemsModel: 'MODEL', rataReportLink: longLink })),
            attachmentSections: [{ title: 'เอกสารแนบ', link: longLink, files: [] }],
          }
          const bytes = await pdf.createKwpFormPdf(data)
          assert.ok((await PDFDocument.load(bytes)).getPageCount() > 2)
          const allText = drawn.map((item) => item.text).join('').replace(/\s/g, '')
          assert.ok(allText.includes(longAddress.replace(/\s/g, '')))
          assert.ok(allText.includes(longLink))
          if (['01', '03'].includes(code)) {
            assert.ok(allText.includes(longReason.replace(/\s/g, '')))
            for (let index = 0; index < 85; index += 1) assert.ok(allText.includes(`ACTION-${index}`))
          }
          if (['02', '04'].includes(code)) {
            for (let index = 0; index < 24; index += 1) assert.ok(allText.includes(`METHOD-END-${index}`))
            for (const pageNo of new Set(drawn.filter((item) => /^ROW-\d+$/.test(item.text)).map((item) => item.page))) {
              assert.ok(drawn.some((item) => item.page === pageNo && item.text.includes('เลขที่รายงาน')))
            }
          }
          if (code === '05') {
            for (const pageNo of new Set(drawn.filter((item) => /^CAL-\d+$/.test(item.text)).map((item) => item.page))) {
              assert.ok(drawn.some((item) => item.page === pageNo && item.text === 'พารามิเตอร์'))
            }
          }
          for (const item of drawn) {
            assert.ok(item.y >= 24 && item.y <= 818, `${code}: out-of-bounds Y: ${item.text}`)
            const rightLimit = code === '05' && item.text === ')' ? 558 : 549.29
            assert.ok(item.x >= 45.99 && item.x + item.width <= rightLimit, `${code}: out-of-bounds X: ${item.text}`)
          }
          if (process.env.KWP_PDF_QA_DIR) await writeFile(join(process.env.KWP_PDF_QA_DIR, `kwp${code}-long.pdf`), bytes)
        }
      } finally {
        pdf.KwpPdfLayout.prototype.drawTextAt = originalDraw
      }
    })
  } finally {
    globalThis.FormData = originalFormData
    globalThis.fetch = originalFetch
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
