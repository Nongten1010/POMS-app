import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import fontkit from '@pdf-lib/fontkit'

function hiddenValues(html, name) {
  const input = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0]
  assert.ok(input, name)
  assert.ok(!input.includes('disabled'), `${name} must be submitted`)
  return JSON.parse(input.match(/value="([^"]*)"/)[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'))
}

function fieldMarkup(html, name) {
  const start = html.indexOf(`name="${name}"`)
  assert.ok(start >= 0, name)
  return html.slice(start, html.indexOf('</fieldset>', start))
}

test('add-parameter form and payload preserve live groups without affecting other form modes', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-add-parameter-test-'))
  const server = await createServer({
    cacheDir,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: 'custom',
    plugins: [{
      name: 'add-parameter-test-exports',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('/src/utils/connectionRequestPdf.js')) {
          return `${code}\nexport { renderInstrumentTable };`
        }
        if (id.endsWith('/src/pages/ConnectionRequestPage.jsx')) {
          return `${code}\nexport { validateParameterGroups, validateConnectionRequestPayload, buildMeasurementPointRequestBody, syncInstrumentRowsWithRequestedParameters, getParameterFormDefaultsFromPayload, MeasurementInstrumentSection, getFactoryColumns, isAddParameterRequest, buildRequestApprovalPayload, mapRequestDetailRow, OfficerRequestActions, isPendingDesignReview, isConnectionConfirmed, approvePointCodeModeOptions };`
        }
      },
    }],
  })
  try {
    const {
      RequestFormBottomSheet, validateParameterGroups, validateConnectionRequestPayload, buildMeasurementPointRequestBody,
      syncInstrumentRowsWithRequestedParameters, getParameterFormDefaultsFromPayload,
      MeasurementInstrumentSection, getFactoryColumns, isAddParameterRequest, buildRequestApprovalPayload, mapRequestDetailRow,
      OfficerRequestActions, isPendingDesignReview, isConnectionConfirmed,
    } = await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')

    await t.test('PDF instrument headers use IEE/EIA/HEIA and fit both CEMS and WPMS columns', async () => {
      const { renderInstrumentTable } = await server.ssrLoadModule('/src/utils/connectionRequestPdf.js')
      const font = fontkit.create(await readFile(new URL('../assets/fonts/THSarabunNew-Bold.ttf', import.meta.url)))
      for (const isWpms of [false, true]) {
        let rendered = false
        renderInstrumentTable({
          cemsInstrumentTable(columns, rows, options) {
            rendered = true
            const column = columns[5]
            assert.equal(column.label.replaceAll('\n', ''), 'มาตรฐานIEE/EIA/HEIA')
            for (const line of column.label.split('\n')) {
              const width = font.layout(line).glyphs.reduce((sum, glyph) => sum + glyph.advanceWidth, 0)
                / font.unitsPerEm * options.headerFontSize
              assert.ok(width <= column.width - 8, `${line} must fit the header cell`)
            }
            assert.equal(rows[0][5], '120')
          },
        }, [{ parameter: 'CO (ppm)', eiaStandard: '120' }], isWpms)
        assert.equal(rendered, true)
      }
    })

    await t.test('officer processing prioritizes statusCode over display labels and still requires permission', () => {
      const row = {
        id: 10048, requestNo: 'CEMS-0024/2569', requestType: 'ADD_PARAMETER',
        statusCode: 'CONNECTION_CONFIRMED', status: 'รอเชื่อมต่อ',
      }
      let openedRequest
      const action = (request, canProcessRequest = true) => OfficerRequestActions({
        row: request, canProcessRequest, onOpenRequestProcess: (value) => { openedRequest = value },
      }).props.children[1]
      assert.equal(action(row).props.disabled, false)
      action(row).props.onClick()
      assert.equal(openedRequest, row)
      assert.equal(action(row, false).props.disabled, true)
      assert.equal(isConnectionConfirmed(row), true)
      assert.equal(isPendingDesignReview(row), false)

      for (const requestType of ['ADD_PARAMETER', 'ADD_MEASUREMENT_POINT']) {
        for (const statusCode of ['WAITING_FACTORY_REVISION', 'WAITING_CONNECTION', 'CONNECTED']) {
          const request = { ...row, requestType, statusCode, status: 'ยืนยันการเชื่อมต่อ', statusLabel: 'รอพิจารณาแบบ' }
          assert.equal(action(request).props.disabled, true)
          assert.equal(isConnectionConfirmed(request), false)
          assert.equal(isPendingDesignReview(request), false)
        }
        for (const statusCode of ['PENDING_DESIGN_REVIEW', 'REVISED_PENDING_DESIGN_REVIEW']) {
          const request = { ...row, requestType, statusCode, status: 'ยืนยันการเชื่อมต่อ', statusLabel: 'เชื่อมต่อแล้ว' }
          assert.equal(action(request).props.disabled, false)
          assert.equal(isPendingDesignReview(request), true)
          assert.equal(isConnectionConfirmed(request), false)
        }
      }
      for (const statusCode of [undefined, null, '', '   ']) {
        assert.equal(action({ ...row, statusCode }).props.disabled, true)
        assert.equal(isConnectionConfirmed({ ...row, statusCode }), false)
        assert.equal(isConnectionConfirmed({ statusCode, status: 'ยืนยันการเชื่อมต่อ' }), true)
        assert.equal(isPendingDesignReview({ statusCode, statusLabel: 'รอพิจารณาแบบ' }), true)
      }
      assert.equal(isConnectionConfirmed(null), false)
      assert.equal(isPendingDesignReview(null), false)
    })

    await t.test('parameter approvals keep existing point codes without assignments or legacy-code validation', () => {
      const expected = { action: 'APPROVE_FORM', officerNote: 'แบบถูกต้อง' }
      for (const [systemType, pointCode] of [['CEMS', 'S2001'], ['WPMS', 'P2001']]) {
        const request = mapRequestDetailRow({
          id: 1, systemType, measurementPoints: [{ id: 2, pointCode }],
        }, { requestType: 'ADD_PARAMETER' })
        const snapshot = structuredClone(request)
        assert.equal(isAddParameterRequest(request), true)
        for (const mode of ['AUTO', 'EXISTING']) {
          for (const staleCode of ['', 'invalid', pointCode]) {
            assert.deepEqual(buildRequestApprovalPayload(request, mode, staleCode), expected)
          }
        }
        assert.deepEqual(request, snapshot)
        const newPoint = { requestType: 'ADD_MEASUREMENT_POINT', systemType, measurementPoints: [{ id: 2 }] }
        assert.equal(isAddParameterRequest(newPoint), false)
        assert.deepEqual(buildRequestApprovalPayload(newPoint, 'AUTO'), expected)
        const legacyCode = `${pointCode[0]}0001`
        assert.deepEqual(buildRequestApprovalPayload(newPoint, 'EXISTING', ` ${legacyCode.toLowerCase()} `), {
          ...expected,
          pointCodeAssignments: [{ measurementPointId: 2, assignmentMode: 'MANUAL_LEGACY', pointCode: legacyCode, reason: 'ใช้รหัสเดิมของจุดตรวจวัดเก่า' }],
        })
        assert.throws(() => buildRequestApprovalPayload(newPoint, 'EXISTING', pointCode), /S0001-S1999/)
        assert.throws(() => buildRequestApprovalPayload(newPoint, 'EXISTING', systemType === 'CEMS' ? 'P0001' : 'S0001'), /ต้องขึ้นต้นด้วย/)
        assert.throws(() => buildRequestApprovalPayload({ ...newPoint, measurementPoints: [] }, 'EXISTING', legacyCode), /รอออกรหัส 1 จุด/)
        assert.throws(() => buildRequestApprovalPayload({ ...newPoint, measurementPoints: [{}] }, 'EXISTING', legacyCode), /ไม่พบรหัสอ้างอิง/)
      }
      assert.equal(isAddParameterRequest(null), false)
      assert.equal(isAddParameterRequest({ form: 'เพิ่มพารามิเตอร์' }), true)
      assert.equal(isAddParameterRequest({ requestType: 'ADD_MEASUREMENT_POINT', form: 'เพิ่มพารามิเตอร์' }), false)
      assert.deepEqual(buildRequestApprovalPayload({ form: 'เพิ่มพารามิเตอร์' }, 'EXISTING', ''), expected)
      const oldWaterPoint = { requestType: 'ADD_PARAMETER', systemType: 'WPMS', measurementPoints: [{ id: 2, pointCode: 'W0123' }] }
      assert.deepEqual(buildRequestApprovalPayload(oldWaterPoint, 'EXISTING', 'W0123'), expected)
      assert.equal(oldWaterPoint.measurementPoints[0].pointCode, 'W0123')
    })

    await t.test('manual approval accepts only S/P legacy ranges and does not assign AUTO codes in frontend', async () => {
      const { approvePointCodeModeOptions } = await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
      assert.match(approvePointCodeModeOptions[0].description, /S2001 หรือ P2001/)
      assert.match(approvePointCodeModeOptions[1].description, /S0001-S1999 หรือ P0001-P1999/)
      for (const requestType of ['NEW_CONNECTION', 'ADD_MEASUREMENT_POINT']) {
        for (const [systemType, prefix] of [['CEMS', 'S'], ['WPMS', 'P']]) {
          const request = { requestType, systemType, measurementPoints: [{ id: 201, pointCode: null }] }
          for (const sequence of ['0001', '0188', '1999']) {
            const payload = buildRequestApprovalPayload(request, 'EXISTING', ` ${prefix.toLowerCase()}${sequence} `)
            assert.deepEqual(payload, {
              action: 'APPROVE_FORM', officerNote: 'แบบถูกต้อง',
              pointCodeAssignments: [{ measurementPointId: 201, assignmentMode: 'MANUAL_LEGACY', pointCode: `${prefix}${sequence}`, reason: 'ใช้รหัสเดิมของจุดตรวจวัดเก่า' }],
            })
          }
          for (const code of [`${prefix}0000`, `${prefix}2000`, `${prefix}2001`, `${prefix}9999`, `${prefix}001`, `${prefix}00001`, 'W0001', 'W1999']) {
            assert.throws(() => buildRequestApprovalPayload(request, 'EXISTING', code), /P0001-P1999/)
          }
          assert.deepEqual(buildRequestApprovalPayload(request, 'AUTO'), { action: 'APPROVE_FORM', officerNote: 'แบบถูกต้อง' })
        }
      }
    })

    await t.test('factory actions show the monitoring-point list label and retain the factory callback for both roles', () => {
      const row = { factoryId: 'TEST', isEligible: true, status: 'แสดง' }
      for (const isOperator of [true, false]) {
        let openedFactory
        const actions = getFactoryColumns(isOperator, () => {}, (factory) => { openedFactory = factory })
          .find((column) => column.field === 'actions')
        const element = actions.renderCell({ row })
        const html = renderToStaticMarkup(element)
        assert.ok(html.includes('รายการจุดตรวจวัด'))
        assert.ok(!html.includes('ดูข้อมูล'))
        assert.ok(actions.width >= 330)
        element.props.onOpenMonitoringPoints(row)
        assert.equal(openedFactory, row)
      }
    })

    await t.test('add-parameter exemptions are optional for both roles while production and stack requirements remain role-specific', () => {
      const payload = {
        factoryId: 'TEST', factoryName: 'Test factory', systemType: 'CEMS', latitude: 13.5, longitude: 100.5,
        contactPersons: [{ name: 'Contact', phone: '0812345678' }], notificationEmails: ['contact@example.com'],
        informationProviderName: 'Provider', informationProviderPosition: 'Engineer',
        measurementPoints: [{
          pointCode: 'S123', pointName: 'Stack', pointType: 'STACK',
          details: {
            eligibleParameters: ['CO (ppm)'], exemptedParameters: [], connectedParameters: ['ไม่มี'],
            pendingParameters: ['CO (ppm)'], requestedParameters: ['CO (ppm)'],
            productionUnitType: null, productionCapacityValue: null, productionCapacityUnit: null, stackShape: null,
          },
          documentsAndImages: [{ title: 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท', fileName: 'logo.jpg', fileUrl: 'https://example.com/logo.jpg', fileType: 'image/jpeg' }],
          measurementInstruments: { parameters: [{ parameter: 'CO (ppm)' }] },
        }],
      }
      const officerAdd = { isAddParameterMode: true, isOfficer: true }
      const exemptionMessage = 'กรุณาเลือกพารามิเตอร์ที่ได้รับการยกเว้น'
      const requiredMessages = [
        'กรุณากรอกประเภทของหน่วยการผลิต', 'กรุณากรอกกำลังการผลิต',
        'กรุณากรอกหน่วยกำลังการผลิต', 'กรุณาเลือกลักษณะปล่อง',
      ]
      assert.doesNotThrow(() => validateConnectionRequestPayload(payload, officerAdd))
      for (const options of [undefined, { isAddParameterMode: true, isOfficer: false }, { isAddParameterMode: false, isOfficer: true }]) {
        assert.throws(() => validateConnectionRequestPayload(payload, options), (error) => (
          requiredMessages.every((message) => error.message.includes(message))
          && error.message.includes(exemptionMessage) === !options?.isAddParameterMode
        ))
      }
      const completeProduction = structuredClone(payload)
      Object.assign(completeProduction.measurementPoints[0].details, {
        productionUnitType: 'Boiler', productionCapacityValue: 10, productionCapacityUnit: 'MW',
        stackShape: 'วงกลม', stackDiameter: 1,
      })
      for (const isOfficer of [true, false]) {
        for (const exemptedParameters of [[], null, undefined]) {
          const request = structuredClone(completeProduction)
          request.measurementPoints[0].details.exemptedParameters = exemptedParameters
          assert.doesNotThrow(() => validateConnectionRequestPayload(request, { isAddParameterMode: true, isOfficer }))
          assert.throws(() => validateConnectionRequestPayload(request, { isOfficer }), (error) => error.message.includes(exemptionMessage))
        }
        const request = structuredClone(completeProduction)
        request.measurementPoints[0].details.exemptedParameters = ['ไม่มี', 'CO (ppm)']
        assert.throws(() => validateConnectionRequestPayload(request, { isAddParameterMode: true, isOfficer }), /ต้องเลือก "ไม่มี" เพียงตัวเดียว/)
      }
      for (const blank of ['', undefined]) {
        const request = structuredClone(payload)
        Object.assign(request.measurementPoints[0].details, {
          productionUnitType: blank, productionCapacityValue: blank, productionCapacityUnit: blank, stackShape: blank,
        })
        assert.doesNotThrow(() => validateConnectionRequestPayload(request, officerAdd))
      }
      const invalid = structuredClone(payload)
      invalid.measurementPoints[0].details.exemptedParameters = ['ไม่มี', 'CO (ppm)']
      invalid.measurementPoints[0].details.stackShape = 'วงกลม'
      invalid.measurementPoints[0].pointName = ''
      invalid.measurementPoints[0].details.requestedParameters = []
      assert.throws(() => validateConnectionRequestPayload(invalid, officerAdd), (error) => (
        error.message.includes('ถ้าเลือก "ไม่มี" ต้องเลือก "ไม่มี" เพียงตัวเดียว')
        && error.message.includes('กรุณากรอกเส้นผ่านศูนย์กลางปล่อง')
        && error.message.includes('กรุณากรอกชื่อจุดตรวจวัด')
        && error.message.includes('กรุณาเลือกพารามิเตอร์ที่ขอเชื่อมต่อ')
      ))
    })

    for (const systemType of ['CEMS', 'WPMS']) {
      await t.test(systemType, () => {
        const [connected, additional] = systemType === 'CEMS'
          ? ['CO (ppm)', 'NOx (ppm)'] : ['BOD (mg/l)', 'COD (mg/l)']
        const details = {
          eligibleParameters: [connected, additional], connectedParameters: [connected],
          pendingParameters: ['STALE'], requestedParameters: ['STALE'], exemptedParameters: ['ไม่มี'],
        }
        const initialRequest = getParameterFormDefaultsFromPayload({ data: { formDefaults: {
          id: 1, factoryId: 'TEST', systemType,
          eia: 'อื่นๆ', eiaOther: 'Other assessment', projectName: 'Saved project', latitude: 13.5, longitude: 100.5,
          documentsAndImages: [
            { title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน', fileName: 'front.jpg', fileUrl: 'https://example.com/front.jpg', fileType: 'image/jpeg' },
            { title: 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท', fileName: 'logo.jpg', fileUrl: 'https://example.com/logo.jpg', fileType: 'image/jpeg' },
          ],
          measurementPoints: [{ pointCode: 'S123', pointName: 'Test point', details,
            measurementInstruments: { parameters: [
              { parameter: connected, brand: 'Saved brand' }, { parameter: 'STALE', brand: 'Old brand' },
            ] } }],
        } } }, { pointCode: 'S123', type: systemType })
        const render = (mode, props = {}) => renderToStaticMarkup(React.createElement(RequestFormBottomSheet, {
          open: true, embedded: true, mode, initialRequest, factory: { factoryId: 'TEST' }, isOperator: true,
          formType: mode === 'add-parameter' ? 'เพิ่มพารามิเตอร์' : 'เพิ่มจุดตรวจวัด',
          ...props,
        }))
        const html = render('add-parameter')
        assert.deepEqual(hiddenValues(html, 'eligibleParameters'), [connected, additional])
        assert.deepEqual(hiddenValues(html, 'connectedParameters'), [connected])
        assert.deepEqual(hiddenValues(html, 'pendingParameters'), [additional])
        assert.deepEqual(hiddenValues(html, 'requestedParameters'), [])
        assert.ok(fieldMarkup(html, 'connectedParameters').includes('Mui-readOnly'))
        assert.ok(!fieldMarkup(html, 'pendingParameters').includes('Mui-readOnly'))
        assert.ok(!fieldMarkup(html, 'requestedParameters').includes('Mui-readOnly'))
        assert.ok(html.includes('Saved brand'))
        assert.ok(!html.includes('Old brand'))
        assert.ok(!html.includes('จัดการข้อมูล'))
        const edit = render('edit')
        assert.deepEqual(hiddenValues(edit, 'requestedParameters'), ['STALE'])
        assert.deepEqual(hiddenValues(edit, 'pendingParameters'), ['STALE'])
        assert.ok(!fieldMarkup(edit, 'connectedParameters').includes('Mui-readOnly'))
        assert.ok(!render('create').includes('name="requestedParameters"'))

        const generalSection = (markup) => markup.slice(markup.indexOf('ข้อมูลทั่วไปของโรงงาน'), markup.indexOf('data-field-name="contactPersons"'))
        const typeRadios = (markup) => (markup.match(/<input\b[^>]*>/g) ?? [])
          .filter((input) => input.includes('type="radio"') && /value="(?:CEMS|WPMS)"/.test(input))
        for (const isOperator of [true, false]) {
          const addByRole = render('add-parameter', { isOperator, monitoringPointTypeReadOnly: false })
          const radios = typeRadios(addByRole)
          assert.equal(radios.length, 2)
          assert.ok(radios.every((input) => input.includes('disabled=""')))
          assert.ok(radios.find((input) => input.includes(`value="${systemType}"`)).includes('checked=""'))
          assert.deepEqual(hiddenValues(addByRole, 'pendingParameters'), [additional])
          assert.ok(!fieldMarkup(addByRole, 'pendingParameters').includes('Mui-readOnly'))
          const locked = generalSection(render('add-parameter', { isOperator, generalFactoryFieldsReadOnly: false }))
          const inputs = locked.match(/<input\b[^>]*>/g)
          const uploads = inputs.filter((input) => input.includes('type="file"'))
          assert.equal(uploads.length, 2)
          assert.ok(uploads.every((input) => input.includes('disabled=""')))
          assert.ok(inputs.filter((input) => !input.includes('type="file"')).every((input) => input.includes('readOnly=""')))
          for (const value of ['Other assessment', 'Saved project', '13.5', '100.5', 'front.jpg', 'logo.jpg']) {
            assert.ok(locked.includes(value), `locked factory data must remain visible: ${value}`)
          }
          assert.ok(!locked.includes('aria-label="ลบไฟล์'))
          assert.ok(!render('add-parameter', { isOperator }).includes('เลือกสถานะหลังส่งแบบฟอร์ม'))

          for (const generalFactoryFieldsReadOnly of [false, true]) {
            const create = render('create', { isOperator, generalFactoryFieldsReadOnly })
            const section = generalSection(create)
            const latitude = section.match(/<input[^>]*name="latitude"[^>]*>/)?.[0]
            assert.equal(Boolean(latitude), !generalFactoryFieldsReadOnly)
            const fileInputs = section.match(/<input[^>]*type="file"[^>]*>/g)
            assert.equal(fileInputs.every((input) => input.includes('disabled=""')), generalFactoryFieldsReadOnly)
            assert.equal(create.includes('เลือกสถานะหลังส่งแบบฟอร์ม'), !isOperator)
            assert.equal(typeRadios(create).length, 2)
            assert.ok(typeRadios(create).every((input) => !input.includes('disabled=""')))
          }
          assert.ok(typeRadios(render('create', { isOperator, monitoringPointTypeReadOnly: true }))
            .every((input) => input.includes('disabled=""')))
          const editByRole = render('edit', { isOperator })
          assert.ok(typeRadios(editByRole).every((input) => !input.includes('disabled=""')))
          const pointCodeInput = editByRole.match(/<input[^>]*name="pointCode"[^>]*>/)?.[0]
          assert.ok(pointCodeInput)
          assert.equal(pointCodeInput.includes('readOnly=""'), isOperator)
          assert.ok(generalSection(editByRole).includes('aria-label="ลบไฟล์ front.jpg"'))
        }

        const lockedPayload = buildMeasurementPointRequestBody(initialRequest, systemType, new FormData(), [], [], {
          generalFactoryFieldsReadOnly: true,
          existingDocuments: initialRequest.documentsAndImages,
        })
        assert.equal(lockedPayload.eia, 'อื่นๆ')
        assert.equal(lockedPayload.eiaOther, 'Other assessment')
        assert.equal(lockedPayload.projectName, 'Saved project')
        assert.equal(lockedPayload.latitude, 13.5)
        assert.equal(lockedPayload.longitude, 100.5)
        assert.ok(lockedPayload.measurementPoints[0].documentsAndImages.some((document) => document.fileName === 'front.jpg'))
        assert.ok(lockedPayload.measurementPoints[0].documentsAndImages.some((document) => document.fileName === 'logo.jpg'))

        const formData = new FormData()
        for (const [name, values] of Object.entries({
          eligibleParameters: [connected, additional], connectedParameters: ['TAMPERED'],
          pendingParameters: ['STALE'], requestedParameters: [additional],
        })) formData.set(name, JSON.stringify(values))
        const instruments = syncInstrumentRowsWithRequestedParameters(
          [{ parameter: connected, brand: 'Saved brand' }], [additional], [connected],
        )
        assert.equal(instruments[0].brand, 'Saved brand')
        assert.deepEqual(instruments.map((row) => row.parameter), [connected, additional])
        const section = (readOnlyParameters) => renderToStaticMarkup(React.createElement(MeasurementInstrumentSection, {
          rows: instruments, setRows: () => {}, isWpms: systemType === 'WPMS', readOnlyParameters,
        }))
        const table = section([connected])
        assert.ok(table.includes('มาตรฐาน IEE/EIA/HEIA'))
        assert.ok(!table.includes('มาตรฐาน EIA'))
        const tableRows = table.match(/<tr\b[\s\S]*?<\/tr>/g)
        assert.ok(!tableRows.find((row) => row.includes('Saved brand')).includes('จัดการข้อมูล'))
        assert.ok(tableRows.find((row) => row.includes(additional)).includes('จัดการข้อมูล'))
        assert.equal((table.match(/จัดการข้อมูล/g) ?? []).length, 1)
        assert.equal((section([]).match(/จัดการข้อมูล/g) ?? []).length, 2)
        assert.deepEqual(syncInstrumentRowsWithRequestedParameters(instruments, [], [connected]), [instruments[0]])
        assert.deepEqual(syncInstrumentRowsWithRequestedParameters(instruments, [connected, additional], [connected]), instruments)
        assert.deepEqual(syncInstrumentRowsWithRequestedParameters(instruments, []), [])
        const point = buildMeasurementPointRequestBody({ factoryId: 'TEST' }, systemType, formData, [], instruments, {
          addParameterConnectedParameters: [connected],
        }).measurementPoints[0]
        assert.deepEqual(point.details.connectedParameters, [connected])
        assert.deepEqual(point.details.pendingParameters, ['STALE'])
        assert.deepEqual(point.details.requestedParameters, [additional])
        assert.deepEqual(point.measurementInstruments.parameters.map((item) => item.parameter), [additional])
        const standard = buildMeasurementPointRequestBody({}, systemType, formData, [], instruments).measurementPoints[0]
        assert.deepEqual(standard.details.connectedParameters, ['TAMPERED'])
        assert.deepEqual(standard.details.pendingParameters, ['STALE'])
        assert.deepEqual(standard.measurementInstruments.parameters.map((item) => item.parameter), [connected, additional])
        for (const pendingParameters of [[], ['ไม่มี'], [additional]]) {
          formData.set('pendingParameters', JSON.stringify(pendingParameters))
          const changed = buildMeasurementPointRequestBody({ factoryId: 'TEST' }, systemType, formData, [], instruments, {
            addParameterConnectedParameters: [connected],
          })
          assert.equal(changed.systemType, systemType)
          assert.deepEqual(changed.measurementPoints[0].details.pendingParameters, pendingParameters)
          assert.deepEqual(changed.measurementPoints[0].details.connectedParameters, [connected])
          assert.deepEqual(changed.measurementPoints[0].details.requestedParameters, [additional])
        }
        formData.set('requestedParameters', '[]')
        const unselected = buildMeasurementPointRequestBody({}, systemType, formData, [], instruments, {
          addParameterConnectedParameters: [connected],
        }).measurementPoints[0]
        assert.deepEqual(unselected.details.requestedParameters, [])
        assert.deepEqual(unselected.measurementInstruments.parameters, [])
        const groups = { eligibleParameters: [connected, additional], connectedParameters: [connected],
          pendingParameters: [additional], requestedParameters: [connected, additional] }
        assert.deepEqual(validateParameterGroups(groups, instruments, {}, { isAddParameterMode: true }), [])
        assert.ok(validateParameterGroups(groups, instruments).some((error) => error.includes('ยังไม่เชื่อมต่อเท่านั้น')))
        assert.deepEqual(validateParameterGroups({ ...groups, pendingParameters: [], requestedParameters: [connected] },
          [{ parameter: connected }], {}, { isAddParameterMode: true }), [])
        assert.deepEqual(validateParameterGroups({ ...groups, connectedParameters: [], requestedParameters: [additional] },
          [{ parameter: additional }], {}, { isAddParameterMode: true }), [])
      })
    }
  } finally {
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
