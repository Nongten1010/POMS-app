import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import React, { Children, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

function buttons(element) {
  if (!isValidElement(element)) return []
  if (element.type?.name === 'ConnectionSettingsButton') return buttons(element.type(element.props))
  return [
    ...(typeof element.props.children === 'string' && element.props.onClick ? [element] : []),
    ...Children.toArray(element.props.children).flatMap(buttons),
  ]
}

test('officers reuse request actions to edit revisions without gaining creation or review permissions', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-officer-revision-test-'))
  const originalWindow = globalThis.window
  const server = await createServer({
    cacheDir,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    plugins: [{
      name: 'officer-revision-test-exports',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('/src/pages/ConnectionRequestPage.jsx')) {
          return `${code}\nexport { OfficerRequestActions, OperatorRequestActions, getRequestColumns };`
        }
        if (id.endsWith('/src/pages/MasterDataPage.jsx')) {
          return `${code}\nexport { getPageRequestColumns, canSubmitMasterDataForm, isFactoryRequestAwaitingRevision };`
        }
        if (id.endsWith('/src/pages/KwpFormsPage.jsx')) return `${code}\nexport { RequestActions };`
        if (id.endsWith('/src/pages/BodCodReportPage.jsx')) return `${code}\nexport { ReportActions };`
      },
    }],
  })
  try {
    const { OfficerRequestActions, OperatorRequestActions, getRequestColumns } = await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
    globalThis.window = { location: { hostname: 'localhost' } }
    const { default: MasterDataPage, getPageRequestColumns, canSubmitMasterDataForm, isFactoryRequestAwaitingRevision } = await server.ssrLoadModule('/src/pages/MasterDataPage.jsx')
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow

    await t.test('all four menus disable process for cancelled or rejected requests while preserving view', async () => {
      const kwp = await server.ssrLoadModule('/src/pages/KwpFormsPage.jsx')
      const bod = await server.ssrLoadModule('/src/pages/BodCodReportPage.jsx')
      const permissions = { bod_cod_errors: { view: true, approve: true, edit: true } }
      const masterColumn = getPageRequestColumns(() => {}, () => {}, null, true, { isOfficer: true })
        .find(({ field }) => field === 'actions')
      for (const status of ['CANCELED', 'CANCELLED', 'REJECTED', 'ยกเลิก', 'ไม่อนุมัติ', 'ไม่ผ่านการพิจารณา']) {
        for (const field of ['statusCode', 'status', 'statusLabel']) {
          const row = { id: 1, [field]: status, allowedActions: ['APPROVE', 'REQUEST_REVISION'],
            currentStep: { roleCode: 'INSPECTOR', isCurrent: true, status: 'PENDING' } }
          if (field === 'statusCode') row.status = 'รอพิจารณา'
          const menus = {
            connection: buttons(OfficerRequestActions({ row, canProcessRequest: true, onOpenRequestDocument: () => {}, onOpenRequestProcess: () => {} })),
            master: buttons(masterColumn.renderCell({ row })),
            kwp: buttons(kwp.RequestActions({ row, isOperator: false, isAdmin: true, canApprove: true, onOpenDocument: () => {} })),
            bod: buttons(bod.ReportActions({ row, mode: 'officer', actionContext: { userType: 'officer', roleCode: 'monitoring_kpm', permissions } })),
          }
          for (const [menu, actions] of Object.entries(menus)) {
            const process = actions.find((button) => button.props.children === 'ดำเนินการ')
            assert.ok(process, `${menu}/${field}/${status}: process remains visible`)
            assert.equal(process.props.disabled, true, `${menu}/${field}/${status}`)
            assert.equal(Boolean(actions[0].props.disabled), false, `${menu}: view remains enabled`)
            const html = renderToStaticMarkup(process)
            assert.match(html, /disabled=""/)
          }
        }
      }
    })

    await t.test('connection actions keep view, process, edit, settings order and independent permissions', () => {
      for (const requestType of ['ADD_MEASUREMENT_POINT', 'ADD_PARAMETER']) {
        const row = { id: 29, requestType, statusCode: 'WAITING_FACTORY_REVISION', status: 'รอโรงงานแก้ไข' }
        let opened
        let reviewed = false
        const props = {
          row, canProcessRequest: false, canEditRequest: true,
          onOpenRequestEdit: (value) => { opened = value },
          onOpenRequestProcess: () => { reviewed = true },
        }
        const actions = buttons(OfficerRequestActions(props))
        assert.deepEqual(actions.map((button) => button.props.children), ['เปิดดู', 'ดำเนินการ', 'แก้ไข', 'ตั้งค่า'])
        assert.equal(actions[1].props.disabled, true)
        assert.equal(actions[2].props.disabled, false)
        assert.equal(actions[3].props.disabled, true)
        actions[2].props.onClick()
        assert.equal(opened, row)
        assert.equal(reviewed, false)
        assert.equal(buttons(OfficerRequestActions({ ...props, canEditRequest: false, canProcessRequest: true }))[2].props.disabled, true)
        const legacy = { ...row, statusCode: '', status: 'รอโรงงานแก้ไข' }
        assert.equal(buttons(OfficerRequestActions({ ...props, row: legacy }))[2].props.disabled, false)
        for (const statusCode of ['CONNECTED', 'WAITING_CONNECTION', 'CANCELLED', 'PENDING_DESIGN_REVIEW']) {
          const allActions = buttons(OfficerRequestActions({ ...props, row: { ...row, statusCode } }))
          assert.equal(allActions.length, 4)
          assert.equal(allActions[2].props.disabled, true)
          const action = allActions[1]
          assert.equal(action.props.children, 'ดำเนินการ')
          assert.equal(action.props.disabled, true)
        }
        const review = buttons(OfficerRequestActions({ ...props, canProcessRequest: true,
          row: { ...row, statusCode: 'REVISED_PENDING_DESIGN_REVIEW' } }))[1]
        assert.equal(review.props.children, 'ดำเนินการ')
        assert.equal(review.props.disabled, false)
        review.props.onClick()
        assert.equal(reviewed, true)

        for (const status of [
          'WAITING_CONNECTION', 'WAITING_FACTORY_DEVICE_CONFIG', 'WAITING_FACTORY_DEVICE_CONFIGURATION',
          'WAITING_DEVICE_CONFIG', 'รอโรงงานตั้งค่าอุปกรณ์', 'WAITING_FACTORY_REVISION',
          'PENDING_DESIGN_REVIEW', 'CONNECTION_CONFIRMED', 'CONNECTED', 'CANCELLED', '',
        ]) {
          let settingsRow
          const settingsRequest = { ...row, statusCode: status, status, statusLabel: status }
          const onOpenConnectionSettings = (value) => { settingsRow = value }
          const officer = buttons(OfficerRequestActions({ ...props, row: settingsRequest, onOpenConnectionSettings }))
          const operator = buttons(OperatorRequestActions({ row: settingsRequest }))
          assert.equal(officer[3].props.disabled, operator[3].props.disabled, status)
          if (!officer[3].props.disabled) {
            officer[3].props.onClick()
            assert.equal(settingsRow, settingsRequest)
          }
          assert.equal(buttons(OfficerRequestActions({ ...props, row: settingsRequest, canEditRequest: false }))[3].props.disabled, true)
        }

        const openSettings = () => {}
        const column = getRequestColumns(false, false, openSettings, null, null, props.onOpenRequestEdit, null, true)
          .find(({ field }) => field === 'actions')
        const renderedAction = column.renderCell({ row })
        assert.equal(renderedAction.props.canEditRequest, true)
        assert.equal(renderedAction.props.onOpenRequestEdit, props.onOpenRequestEdit)
        assert.equal(renderedAction.props.onOpenConnectionSettings, openSettings)
        assert.ok(column.width >= 350)
        const operatorActions = buttons(OperatorRequestActions({ row }))
        assert.equal(operatorActions.find((button) => button.props.children === 'แก้ไข').props.disabled, false)
        assert.ok(operatorActions.some((button) => button.props.children === 'ยกเลิกคำขอ'))
      }
    })

    await t.test('master-data revision uses the existing edit flow for both form types and preserves admin review', () => {
      for (const formType of ['BASIC_INFO', 'MEASUREMENT_POINTS']) {
        const row = { id: 29, formType, statusCode: 'REVISION_REQUESTED', status: 'รอโรงงานแก้ไข' }
        for (const isAdmin of [false, true]) {
          let edited
          let reviewed
          const column = (canEditRequest = true) => getPageRequestColumns(null,
            (value) => { reviewed = value }, null, isAdmin, {
              isOfficer: true, canEditRequest, onEditRevisionRequest: (value) => { edited = value },
            }).find(({ field }) => field === 'actions')
          const actions = buttons(column().renderCell({ row }))
          assert.deepEqual(actions.map((button) => button.props.children), ['เปิดดู', 'ดำเนินการ', 'แก้ไข'])
          assert.equal(actions[1].props.disabled, true)
          assert.equal(actions[2].props.disabled, false)
          actions[2].props.onClick()
          assert.equal(edited, row)
          assert.equal(reviewed, undefined)
          assert.equal(buttons(column(false).renderCell({ row }))[2].props.disabled, true)
          const next = { ...row, statusCode: 'REVISED_PENDING_REVIEW', status: 'แก้ไขแล้ว/รอพิจารณา' }
          const nextActions = buttons(column().renderCell({ row: next }))
          assert.deepEqual(nextActions.map((button) => button.props.children), ['เปิดดู', 'ดำเนินการ', 'แก้ไข'])
          assert.equal(nextActions[2].props.disabled, true)
          assert.equal(nextActions[1].props.disabled, !isAdmin)
          if (isAdmin) {
            assert.equal(nextActions[1].props.children, 'ดำเนินการ')
            nextActions[1].props.onClick()
            assert.equal(reviewed, next)
          }
          for (const status of ['อนุมัติ', 'ยกเลิก', 'ไม่อนุมัติ']) {
            const inactiveActions = buttons(column().renderCell({ row: { ...row, statusCode: 'FINAL', status } }))
            assert.deepEqual(inactiveActions.map((button) => button.props.children), ['เปิดดู', 'ดำเนินการ', 'แก้ไข'])
            assert.equal(inactiveActions[1].props.disabled, true)
            assert.equal(inactiveActions[2].props.disabled, true)
          }
          assert.ok(column().width >= 300)
        }
        const operatorColumn = getPageRequestColumns(null, null, null).find(({ field }) => field === 'actions')
        const operatorActions = buttons(operatorColumn.renderCell({ row }))
        assert.deepEqual(operatorActions.map((button) => button.props.children), ['เปิดดู', 'แก้ไข', 'ยกเลิกคำขอ'])
        assert.equal(operatorActions[1].props.disabled, false)
        assert.equal(isFactoryRequestAwaitingRevision({ ...row, statusCode: 'APPROVED' }), false)
        assert.equal(isFactoryRequestAwaitingRevision({ status: 'รอโรงงานแก้ไข' }), true)
        assert.equal(isFactoryRequestAwaitingRevision(null), false)
      }
    })

    await t.test('officer save is limited to resubmissions, while operator and admin keep existing save access', () => {
      for (const formType of ['BASIC_INFO', 'MEASUREMENT_POINTS']) {
        const factory = { __formType: formType, __isResubmission: true, __editRequestId: 29 }
        const officer = { isAdmin: false, isOperator: false, canEditRevision: true }
        assert.equal(canSubmitMasterDataForm(factory, officer), true)
        assert.equal(canSubmitMasterDataForm(factory, { ...officer, canEditRevision: false }), false)
        assert.equal(canSubmitMasterDataForm({ factoryId: 'TEST' }, officer), false)
        assert.equal(canSubmitMasterDataForm({ ...factory, __editRequestId: null }, officer), false)
        assert.equal(canSubmitMasterDataForm(null, officer), false)
        for (const role of ['isOperator', 'isAdmin']) {
          assert.equal(canSubmitMasterDataForm(factory, { ...officer, canEditRevision: false, [role]: true }), true)
          assert.equal(canSubmitMasterDataForm({ factoryId: 'TEST' }, { ...officer, [role]: true }), true)
        }
      }
    })

    await t.test('master-data request tab is reachable for officers and remains visible for operators and admins', () => {
      for (const props of [{ userType: 'officer' }, { userType: 'operator' }, { roleCode: 'admin' }]) {
        const html = renderToStaticMarkup(React.createElement(MasterDataPage, props))
        assert.match(html, /รายการคำขอ/)
      }
    })
  } finally {
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})
