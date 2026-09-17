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
  canCreateKwpRequest, canEditKwpRequest, isKwpAdmin, canCancelKwpRequest, cancelKwpSubmission, formatKwpDocumentDate,
  getCurrentThaiYear, getKwpAttachmentValidationError, getKwpReportPeriod, sortKwpRequestRows,
} from './kwpFormPresentation.mjs'

function findButtons(element) {
  if (!isValidElement(element)) return []
  return [
    ...(element.props.onClick ? [element] : []),
    ...Children.toArray(element.props.children).flatMap(findButtons),
  ]
}

function findComponent(element, type) {
  if (!isValidElement(element)) return undefined
  if (element.type === type) return element
  return Children.toArray(element.props.children).map((child) => findComponent(child, type)).find(Boolean)
}

test('KWP officer and admin requests follow workflow priority without changing operator order', () => {
  const statuses = ['SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'DRAFT', 'UNKNOWN']
  for (const field of ['statusCode', 'status', 'statusLabel']) {
    const rows = Object.freeze([...statuses].reverse().map((status) => Object.freeze({ [field]: status })))
    assert.deepEqual(sortKwpRequestRows(rows).map((row) => row[field]), statuses)
    assert.equal(sortKwpRequestRows(rows, true), rows)
  }
  const labels = ['รอพิจารณา', 'รอโรงงานแก้ไข', 'ผ่านการพิจารณา', 'ไม่ผ่านการพิจารณา', 'ยกเลิก', 'ร่าง']
  assert.deepEqual(sortKwpRequestRows([...labels].reverse().map((statusLabel) => ({ statusLabel })))
    .map((row) => row.statusLabel), labels)
  assert.deepEqual(sortKwpRequestRows(), [])
})

test('KWP requests sort newest first within each status group with stable ties and invalid dates last', () => {
  const rows = [
    { id: 'invalid', statusCode: 'SUBMITTED', submittedAt: 'invalid' },
    { id: 'older', statusCode: 'SUBMITTED', submittedAt: '2026-09-16T00:00:00Z' },
    { id: 'revision', statusCode: 'REVISION_REQUESTED', submittedAt: '2026-09-19T00:00:00Z' },
    { id: 'revised', status: 'แก้ไขแล้ว/รอพิจารณา', submittedAt: '2026-09-17T00:00:00Z' },
    { id: 'reviewing', statusCode: 'UNDER_REVIEW', submittedAt: '2026-09-17T07:00:00+07:00' },
    { id: 'missing', statusLabel: 'ยื่นแบบสำเร็จ' },
    { id: 'newest', statusCode: 'REVISED_PENDING_REVIEW', submittedAt: '2026-09-18T00:00:00Z' },
  ]
  const original = structuredClone(rows)
  assert.deepEqual(sortKwpRequestRows(rows).map(({ id }) => id), ['newest', 'revised', 'reviewing', 'older', 'invalid', 'missing', 'revision'])
  assert.deepEqual(rows, original)
})

test('KWP sorting prioritizes canonical codes and falls back to recognized labels', () => {
  const rows = [
    { id: 1, statusCode: 'APPROVED', statusLabel: 'รอพิจารณา' },
    { id: 2, statusCode: 'FUTURE_STATUS', statusLabel: 'รอโรงงานแก้ไข' },
    { id: 3, statusCode: ' CANCELED ' },
    { id: 4, statusCode: '', status: ' ส่งฟอร์ม ' },
  ]
  assert.deepEqual(sortKwpRequestRows(rows).map(({ id }) => id), [4, 2, 1, 3])
})

test('only operators and admins may edit KWP revision requests', () => {
  assert.equal(isKwpAdmin('ADMIN'), true)
  assert.equal(isKwpAdmin('officer', ['officer', 'admin']), true)
  assert.equal(isKwpAdmin('officer'), false)
  for (const flags of [{ isOperator: true }, { isAdmin: true }, {}]) {
    for (const status of ['REVISION_REQUESTED', 'รอโรงงานแก้ไข', 'SUBMITTED', 'DRAFT', 'UNDER_REVIEW',
      'APPROVED', 'REJECTED', 'CANCELLED', 'ผ่านการพิจารณา', 'ยกเลิก', '']) {
      const expected = Boolean((flags.isOperator || flags.isAdmin) && ['REVISION_REQUESTED', 'รอโรงงานแก้ไข'].includes(status))
      for (const field of ['statusCode', 'status', 'statusLabel']) {
        assert.equal(canEditKwpRequest({ [field]: status }, flags), expected, `${field}=${status}`)
      }
    }
    assert.equal(canEditKwpRequest(null, flags), false)
    assert.equal(canEditKwpRequest({ statusCode: 'APPROVED', statusLabel: 'รอโรงงานแก้ไข' }, flags), false)
  }
})

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
      if (id.endsWith('/src/pages/KwpFormsPage.jsx')) return `${code}\nexport { Kwp01Form, Kwp02Form, Kwp03Form, RequestActions, KwpCancelRequestDialog, KwpLegacyAttachmentWarning, ParameterMultiSelect, fetchKwpEditForm, buildKwp01PreviewData, buildKwp02PreviewData, buildKwp03PreviewData, buildKwp01SubmissionPayload, buildKwp02SubmissionPayload, buildKwp03SubmissionPayload, buildKwpEditFormFromDetail, buildKwpRequestPreviewDataFromDetail, getKwpPreviewAttachmentGroups, FormSelectionMenu, MonitoringPointDialog, getFactoryColumns, isKwpFormOptionDisabledForPoint };`
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

    await t.test('all roles have the factory list while only operators and admins can select forms', () => {
      const cases = [
        { userType: 'operator', roleCode: 'operator', enabled: true },
        { userType: 'officer', roleCode: 'officer', enabled: false },
        { userType: 'officer', roleCode: 'admin', enabled: true },
        { userType: 'officer', roleCode: 'officer', roleCodes: ['admin'], enabled: true },
      ]
      const factory = { factoryId: 'F1', factoryName: 'โรงงานทดสอบ' }
      const point = { id: 8, code: 'S2001', name: 'Boiler', type: 'CEMS', parameters: 'CO (ppm)' }
      const fields = page.getFactoryColumns(() => {}).map(({ field }) => field)
      for (const props of cases) {
        const canCreate = canCreateKwpRequest(props.userType, props.roleCode, props.roleCodes)
        const html = renderToStaticMarkup(React.createElement(page.default, props))
        assert.ok(html.includes('รายชื่อโรงงาน'))
        assert.ok(html.includes('รายการคำขอ'))
        if (props.userType === 'officer') assert.ok(html.includes('สถิติข้อมูล'))
        const dialog = page.MonitoringPointDialog({ context: factory, rows: [point], open: true, canCreate })
        const selector = findComponent(dialog, page.FormSelectionMenu)
        assert.equal(selector.props.canCreate, props.enabled)
        const selectorHtml = renderToStaticMarkup(selector)
        const buttonTag = selectorHtml.match(/<button[^>]*>/)?.[0]
        assert.ok(buttonTag)
        assert.equal(buttonTag.includes('disabled'), !props.enabled)
        let opened
        const columns = page.getFactoryColumns((row) => { opened = row })
        assert.deepEqual(columns.map(({ field }) => field), fields)
        const actions = columns.find(({ field }) => field === 'actions').renderCell({ row: factory })
        findButtons(actions.type(actions.props))[0].props.onClick()
        assert.equal(opened, factory)
      }
      assert.equal(page.isKwpFormOptionDisabledForPoint('กวภ.03', point), true)
      assert.equal(page.isKwpFormOptionDisabledForPoint('กวภ.01', point), false)
      assert.equal(page.isKwpFormOptionDisabledForPoint('กวภ.03', { type: 'WPMS' }), false)
    })

    await t.test('admins can edit revision requests without gaining cancellation or giving officers edit access', () => {
      const row = { id: 1, status: 'REVISION_REQUESTED' }
      const staff = page.RequestActions({ row, isOperator: false })
      assert.deepEqual(findButtons(staff).map((button) => button.props.children), ['เปิดดู', 'ดำเนินการ'])
      const operator = page.RequestActions({ row, isOperator: true })
      assert.deepEqual(findButtons(operator).map((button) => button.props.children), ['เปิดดู', 'แก้ไข', 'ยกเลิกคำขอ'])
      for (const statusCode of ['REVISION_REQUESTED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED']) {
        let opened
        const request = { ...row, statusCode }
        const admin = page.RequestActions({ row: request, isOperator: false, isAdmin: true,
          onOpenDocument: (...args) => { opened = args } })
        const buttons = findButtons(admin)
        assert.deepEqual(buttons.map((button) => button.props.children), ['เปิดดู', 'ดำเนินการ', 'แก้ไข'])
        const edit = buttons[2]
        assert.equal(edit.props.disabled, statusCode !== 'REVISION_REQUESTED')
        if (!edit.props.disabled) {
          edit.props.onClick()
          assert.deepEqual(opened, [request, 'edit'])
        }
      }
    })

    await t.test('all five edit forms retain the latest status for admin save authorization', () => {
      for (const formType of ['KWP01', 'KWP02', 'KWP03', 'KWP04', 'KWP05']) {
        const row = { id: 1, formType, statusCode: 'REVISION_REQUESTED' }
        for (const status of ['REVISION_REQUESTED', 'SUBMITTED', 'APPROVED', 'CANCELLED']) {
          const form = page.buildKwpEditFormFromDetail({ id: 1, formType, status }, row)
          assert.equal(form.mode, 'edit')
          assert.equal(form.statusCode, status)
          assert.equal(canEditKwpRequest(form, { isAdmin: true }), status === 'REVISION_REQUESTED')
          assert.equal(canEditKwpRequest(form, { isOperator: false, isAdmin: false }), false)
        }
      }
    })

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

    await t.test('editing all form types loads KWP parameter choices without replacing submission snapshots or selected parameters', async () => {
      const points = [{ connectedPointId: 8, pointType: 'CEMS', pointCode: 'S2001',
        parameterDetails: ['CO (ppm)', 'SO2 (ppm)'], parameterInstrumentDetails: [{ parameter: 'SO2 (ppm)', cemsModel: 'MODEL' }] }]
      let requests = 0
      globalThis.fetch = async (url, options) => {
        requests += 1
        assert.ok(url.endsWith('/kwp-form-reports/factories/F1/measurement-points'))
        assert.equal(options.headers.Authorization, 'Bearer test-token')
        return Response.json({ success: true, data: points })
      }
      for (const code of ['01', '02', '03', '04', '05']) {
        const detail = { id: 12, formType: `KWP${code}`, factoryId: 'F1', factoryName: 'Saved factory',
          connectedPointId: 8, pointCode: 'S2001', pointType: 'CEMS', pointName: 'Saved point',
          parameterDetails: ['OLD'], issueReport: { unreportedParameters: ['OLD'] },
          wpmsIssueReport: { failedParameters: ['OLD'] }, measurementItems: [{ pollutant: 'OLD' }],
          calibrationItems: [{ parameter: 'OLD', parameters: ['OLD', 'CO (ppm)'] }],
          reportRound: null, reportYear: null }
        const form = await page.fetchKwpEditForm(detail, {}, 'test-token')
        assert.deepEqual(form.point.parameterDetails, points[0].parameterDetails)
        assert.deepEqual(form.point.parameterInstrumentDetails, points[0].parameterInstrumentDetails)
        assert.equal(form.point.connectedPointId, 8)
        assert.equal(form.point.name, 'Saved point')
        assert.equal(form.factory.factoryName, 'Saved factory')
        assert.deepEqual(form.initialState.unreportedParameters, ['OLD'])
        assert.deepEqual(form.initialState.wpmsFailedParameters, ['OLD'])
        assert.deepEqual(form.initialState.calibrationRows[0].parameter, ['OLD', 'CO (ppm)'])
        assert.equal(form.initialState.measurementRows[0].pollutant, 'OLD')
        if (['02', '04'].includes(code)) {
          const empty = [['reportRound', ''], ['reportYear', '']]
          const payload = page.buildKwp02SubmissionPayload(form, empty, [])
          assert.equal(payload.reportRound, null)
          assert.equal(payload.reportYear, null)
          assert.equal(payload.connectedPointId, 8)
          const preview = page.buildKwp02PreviewData(form, empty, [])
          assert.equal(preview.reportYear, null)
          const html = renderToStaticMarkup(React.createElement(page.Kwp02Form, { factory: {}, point: {},
            defaults: form.defaults, measurementRows: [], samplingPhotoFiles: [], labReportFiles: [] }))
          assert.match(html, /name="reportYear"[^>]*value=""/)
        }
      }
      assert.equal(requests, 5)
      const selected = ['OLD']
      const selector = page.ParameterMultiSelect({ label: 'พารามิเตอร์', value: selected, options: ['CO (ppm)'] })
      assert.deepEqual(selector.props.value, ['OLD'])
      assert.deepEqual(selector.props.options, ['CO (ppm)', 'OLD'])
      assert.deepEqual(selector.props.legacyOptions, ['OLD'])
      const deselected = page.ParameterMultiSelect({ label: 'พารามิเตอร์', value: [], options: ['CO (ppm)'] })
      assert.deepEqual(deselected.props.options, ['CO (ppm)'])
    })

    await t.test('KWP03 never falls back to static parameters and expands select-all into current API labels with units', () => {
      let selected
      const props = { factory: {}, defaults: {}, problemDate: null, expectedDoneDate: null,
        instruments: '', issueReasons: '', failedParameters: [], attachmentFiles: [],
        onFailedParametersChange: (value) => { selected = value } }
      const parameters = ['BOD (mg/l)', 'COD (mg/l)']
      const form = page.Kwp03Form({ ...props, point: { parameterDetails: parameters } })
      const selector = findComponent(form, page.ParameterMultiSelect)
      assert.deepEqual(selector.props.options, [...parameters, 'ทั้งหมด'])
      selector.props.onChange(['ทั้งหมด'])
      assert.deepEqual(selected, parameters)
      selector.props.onChange(['BOD (mg/l)'])
      assert.deepEqual(selected, ['BOD (mg/l)'])
      const empty = page.Kwp03Form({ ...props, point: { parameterDetails: [] } })
      assert.deepEqual(findComponent(empty, page.ParameterMultiSelect).props.options, [])
    })

    await t.test('unknown measurement attachments stay visible until explicitly removed and valid groups retain their types', () => {
      const attachments = [
        { ...file, originalFileName: 'old.pdf', attachmentType: 'GENERAL' },
        { ...file, originalFileName: 'sample.pdf', attachmentType: 'SAMPLING_PHOTO' },
        { ...file, originalFileName: 'lab.pdf', attachmentType: 'LAB_REPORT' },
      ]
      for (const code of ['02', '04']) {
        const detail = { formType: `KWP${code}`, measurementItems: [{ attachments }] }
        const form = page.buildKwpEditFormFromDetail(detail)
        assert.equal(form.initialState.unsupportedMeasurementFiles.length, 1)
        assert.equal(form.initialState.unsupportedMeasurementFiles[0].name, 'old.pdf')
        assert.equal(form.initialState.samplingPhotoFiles[0].attachmentType, 'SAMPLING_PHOTO')
        assert.equal(form.initialState.labReportFiles[0].attachmentType, 'LAB_REPORT')
        const preview = page.buildKwpRequestPreviewDataFromDetail(detail)
        assert.equal(preview.attachmentSections.find((group) => group.key === 'legacyAttachments').files[0].name, 'old.pdf')
        let removed
        const warning = page.KwpLegacyAttachmentWarning({ files: form.initialState.unsupportedMeasurementFiles,
          onRemove: (index) => { removed = index } })
        const html = renderToStaticMarkup(warning)
        assert.ok(html.includes('old.pdf'))
        assert.ok(html.includes('GENERAL'))
        assert.equal(removed, undefined)
        findButtons(warning)[0].props.onClick()
        assert.equal(removed, 0)
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
          const names = drawn.filter(({ text }) => text === data.reporterName)
          const signatureLabel = drawn.find(({ text }) => text === (code === '05' ? 'ผู้รายงานผลการทดสอบ' : '(ลงชื่อ)'))
          const parenthesis = drawn.find(({ text }) => text === '(')
          assert.equal(names.length, 2, `${code}: name on signature line and in parentheses`)
          assert.equal(names[0].page, signatureLabel.page)
          assert.equal(names[0].y, signatureLabel.y)
          assert.equal(names[1].page, parenthesis.page)
          assert.equal(names[1].y, parenthesis.y)
          assert.equal(names[0].page, names[1].page)
          assert.equal(names[0].x, names[1].x)
          assert.ok(names[0].y > names[1].y)
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
          for (const missing of [undefined, null, '', '   ']) {
            drawn.length = 0
            const fields = ['factoryName', 'companyName', 'factoryRegistration', 'industryType', 'factoryAddress',
              'contactName', 'contactPhone', 'contactEmail', 'pointCode', 'pointName', 'productionStack',
              'primaryFuel', 'secondaryFuel', 'productionCapacity', 'productionCapacityUnit', 'reasonDetail',
              'problemDate', 'expectedDoneDate', 'totalDays', 'correctiveAction', 'wastewaterSource',
              'receivingSource', 'treatmentSystemType', 'dischargePoint', 'averageDischarge', 'minimumDischarge',
              'maximumDischarge', 'businessActivity', 'samplerName', 'officerRegistration', 'laboratoryName',
              'laboratoryRegistration', 'cemsBrand', 'reportRound', 'reportYear', 'reporterName', 'reporterPosition',
              'submittedAt', 'signatureDate']
            const measurement = Object.fromEntries(['pollutant', 'sampleDate', 'measuredValue', 'unit',
              'laboratoryNo', 'reportNo', 'method'].map((field) => [field, missing]))
            const calibration = Object.fromEntries(['parameter', 'startDate', 'endDate', 'result',
              'verifierCompany', 'cemsModel', 'rataReportLink', 'calibrationPhotoLink'].map((field) => [field, missing]))
            const data = { formType: `kwp${code}`, ...Object.fromEntries(fields.map((field) => [field, missing])),
              unreportedParameters: [], failedParameters: [],
              measurementRows: missing === undefined ? [] : [measurement],
              calibrationRows: missing === undefined ? [] : [calibration] }
            const originalData = structuredClone(data)
            const bytes = await pdf.createKwpFormPdf(data)
            assert.deepEqual(data, originalData, `${code}: PDF placeholders do not mutate form values`)
            assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1)
            assert.ok(!drawn.some(({ text }) => /undefined|null/.test(text)))
            assert.ok(drawn.some(({ text }) => text === 'เลขที่ : -'))
            assert.ok(drawn.some(({ text }) => text === 'วันที่ยื่นคำขอ : -'))
            const labels = drawn.filter(({ text }) => (text.endsWith(' : ') || text.endsWith(' :')
              || ['(ลงชื่อ)', 'ผู้รายงานผลการทดสอบ', '(', 'ตำแหน่ง', 'วันที่', 'ลงวันที่', 'ครั้งที่', 'ประจำปี พ.ศ.'].includes(text))
              && !['ระบบการเผาไหม้เชื้อเพลิง :', 'เครื่องตรวจวัด :'].includes(text)
              && !text.startsWith('4.4 '))
            assert.ok(labels.length >= 15, `${code}: checks all empty text fields`)
            for (const label of labels) {
              assert.ok(drawn.some(({ text, page, y }) => text === '-' && page === label.page && y === label.y),
                `${code}: missing placeholder for ${label.text}`)
            }
            if (['02', '04', '05'].includes(code)) {
              const size = code === '05' ? 12.8 : 11.4
              assert.equal(drawn.filter(({ text, options }) => text === '-' && options.size === size).length,
                code === '05' ? 8 : 7, `${code}: each empty table cell has a placeholder`)
            }
            if (missing === undefined && process.env.KWP_PDF_QA_DIR) {
              await writeFile(join(process.env.KWP_PDF_QA_DIR, `kwp${code}-empty.pdf`), bytes)
            }
          }
          drawn.length = 0
          await pdf.createKwpFormPdf({ formType: `kwp${code}`, productionCapacity: 0, totalDays: 0,
            averageDischarge: 0, minimumDischarge: 0, maximumDischarge: 0,
            measurementRows: [{ measuredValue: 0 }], calibrationRows: [{ result: 0 }] })
          assert.equal(drawn.filter(({ text }) => text === '0').length,
            code === '01' ? 2 : code === '03' ? 4 : code === '05' ? 1 : 2, `${code}: zero is not missing`)
        }
        for (const code of ['01', '02', '03', '04', '05']) {
          drawn.length = 0
          const reporterName = `${'นายทดสอบนามสกุลยาว '.repeat(5)}NAME-END`
          const reporterPosition = `${'ผู้รับผิดชอบการตรวจสอบระบบ '.repeat(5)}POSITION-END`
          const bytes = await pdf.createKwpFormPdf({ formType: `kwp${code}`, reporterName, reporterPosition,
            submittedAt: '2026-09-16T00:00:00Z' })
          const allText = drawn.map(({ text }) => text).join('').replace(/\s/g, '')
          assert.equal(allText.split(reporterName.replace(/\s/g, '')).length - 1, 2, `${code}: both complete reporter names`)
          assert.ok(allText.includes(reporterPosition.replace(/\s/g, '')), `${code}: complete reporter position`)
          const nameEnds = drawn.filter(({ text }) => text.includes('NAME-END'))
          const parenthesis = drawn.find(({ text }) => text === '(')
          const positionLabel = drawn.find(({ text }) => text === 'ตำแหน่ง')
          const positionEnd = drawn.find(({ text }) => text.includes('POSITION-END'))
          assert.equal(nameEnds.length, 2)
          assert.equal(nameEnds[0].page, positionEnd.page)
          assert.equal(nameEnds[1].page, positionEnd.page)
          assert.ok(nameEnds[0].y - parenthesis.y >= 17, `${code}: signature name does not overlap parentheses`)
          assert.ok(nameEnds[1].y - positionLabel.y >= 17, `${code}: parenthesized name does not overlap position`)
          assert.ok(drawn.every(({ y }) => y >= 24 && y <= 818))
          if (process.env.KWP_PDF_QA_DIR) await writeFile(join(process.env.KWP_PDF_QA_DIR, `kwp${code}-long-signature.pdf`), bytes)
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
