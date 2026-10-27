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
          return `${code}\nexport { renderGeneralFactorySection, renderInstrumentTable, getRequestContext, getRequestedParametersDisplay };`
        }
        if (id.endsWith('/src/pages/ConnectionRequestPage.jsx')) {
          code += '\nexport { formatApiErrorMessage, canShowRequestConnectionTest, getConnectionTestApiUrl, mapTestResultRows, formatDeviceConnectionTestError, buildDeviceConfigChannels, getTestResultParameterStatus, getDefaultConnectionForm, mapConnectionForms, buildConnectionSettings, getConnectionProtocolCode, ConnectionFormFields, connectionTypeOptions };'
          return `${code}\nexport { validateParameterGroups, validateConnectionRequestPayload, buildMeasurementPointRequestBody, syncInstrumentRowsWithRequestedParameters, getParameterFormDefaultsFromPayload, MeasurementInstrumentSection, getFactoryColumns, getAssignedRequestPointCodes, isAddParameterRequest, buildRequestApprovalPayload, mapOperatorFactoryRow, mapRequestDetailRow, getInitialRequestFactory, OfficerRequestActions, isPendingDesignReview, isConnectionConfirmed, approvePointCodeModeOptions };`
        }
        if (id.endsWith('/src/pages/MasterDataPage.jsx')) {
          return `${code.replace("window.location.hostname === 'localhost'", 'true')}\nexport { buildMeasurementPointsPayload };`
        }
      },
    }],
  })
  try {
    const {
      RequestFormBottomSheet, validateParameterGroups, validateConnectionRequestPayload, buildMeasurementPointRequestBody,
      syncInstrumentRowsWithRequestedParameters, getParameterFormDefaultsFromPayload,
      MeasurementInstrumentSection, getFactoryColumns, isAddParameterRequest, buildRequestApprovalPayload, mapRequestDetailRow,
      mapOperatorFactoryRow, getInitialRequestFactory, OfficerRequestActions, isPendingDesignReview, isConnectionConfirmed,
      getAssignedRequestPointCodes,
    } = await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')

    await t.test('Serial ASCII mirrors DCON and Modbus read function round trips without changing old settings', async () => {
      const { getDefaultConnectionForm, mapConnectionForms, buildConnectionSettings, getConnectionProtocolCode, ConnectionFormFields, connectionTypeOptions } = await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
      assert.equal(connectionTypeOptions[connectionTypeOptions.indexOf('DCON') + 1], 'Serial ASCII')
      assert.deepEqual(getDefaultConnectionForm('Serial ASCII'), getDefaultConnectionForm('DCON'))
      assert.equal(getConnectionProtocolCode('Serial ASCII'), 'SERIAL_ASCII')
      const values = { comPort: 'COM1', slaveId: '1', baudRate: '9600', parity: 'None', stopBits: '1', dataBits: '8', quantity: '2', measureMin: '0', measureMax: '100' }
      const serial = buildConnectionSettings({ type: 'Serial ASCII', values })
      assert.deepEqual(serial, buildConnectionSettings({ type: 'DCON', values }))
      const [restored] = mapConnectionForms([{ protocol: 'SERIAL_ASCII', settings: serial }])
      assert.equal(restored.type, 'Serial ASCII')
      assert.deepEqual(buildConnectionSettings(restored), serial)
      for (const type of ['Modbus TCP', 'Modbus RTU']) {
        assert.equal(Object.hasOwn(buildConnectionSettings({ type, values: {} }), 'readFunction'), false)
        for (const readFunction of ['READ_INPUT', 'READ_HOLDING']) {
          const settings = buildConnectionSettings({ type, values: { ...values, readFunction } })
          assert.equal(settings.readFunction, readFunction)
          const [form] = mapConnectionForms([{ protocol: getConnectionProtocolCode(type), settings }])
          assert.equal(form.values.readFunction, readFunction)
          assert.equal(buildConnectionSettings(form).readFunction, readFunction)
        }
        const html = renderToStaticMarkup(React.createElement(ConnectionFormFields, { connectionType: type, value: getDefaultConnectionForm(type), onChange: () => {} }))
        assert.ok(html.indexOf('ฟังก์ชันการอ่านข้อมูล') > html.indexOf(type === 'Modbus RTU' ? 'Quantity' : 'Port'))
        if (type === 'Modbus TCP') assert.ok(!html.includes('Quantity'))
      }
      for (const type of ['DCON', 'Serial ASCII']) {
        const html = renderToStaticMarkup(React.createElement(ConnectionFormFields, { connectionType: type, value: getDefaultConnectionForm(type), onChange: () => {} }))
        assert.ok(html.includes('device address'))
        assert.ok(!html.includes('ฟังก์ชันการอ่านข้อมูล'))
        assert.equal(Object.hasOwn(buildConnectionSettings({ type, values: { ...values, readFunction: 'READ_INPUT' } }), 'readFunction'), false)
      }
    })

    await t.test('test table displays Ok as Normal while preserving other statuses', async () => {
      const { getTestResultParameterStatus } = await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
      for (const status of ['Ok', 'OK', 'ok', 'Normal', 'Calibration', 'Defective', '']) {
        const expected = status.toLowerCase() === 'ok' ? 'Normal' : status
        const row = { statuses: { BOD: status } }
        assert.equal(getTestResultParameterStatus(row, 'BOD'), expected)
        assert.equal(getTestResultParameterStatus({ status }, 'BOD'), expected)
        assert.equal(row.statuses.BOD, status)
      }
      assert.equal(getTestResultParameterStatus({ statuses: {} }, 'BOD'), '')
    })

    await t.test('device config temporarily sends testMode false without mutating input', async () => {
      const { buildDeviceConfigChannels } = await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
      for (const testMode of [true, false, undefined]) {
        const row = { parameter: 'BOD (mg/l)', testMode, addressId: '10', offset: '2' }
        const [channel] = buildDeviceConfigChannels([row], 'P2001/01')
        assert.equal(channel.testMode, false)
        assert.equal(channel.deviceCode, 'P2001/01')
        assert.equal(channel.addressId, 10)
        assert.equal(channel.offset, 2)
        assert.equal(row.testMode, testMode)
      }
    })

    await t.test('device test translates missing tables without hiding other errors', async () => {
      const { formatDeviceConnectionTestError } = await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
      for (const table of ['ingest.S0747_data_1m', 'ingest.P2001_data_1m']) {
        const message = `Parameter value table ${table} not found`
        assert.equal(formatDeviceConnectionTestError({ error: { message } }, 'fallback'), 'ไม่พบข้อมูลทดสอบ')
        assert.equal(formatDeviceConnectionTestError({ message }, 'fallback'), 'ไม่พบข้อมูลทดสอบ')
      }
      assert.equal(formatDeviceConnectionTestError({ error: { message: 'Permission denied' } }, 'fallback'), 'Permission denied')
      assert.equal(formatDeviceConnectionTestError(null, 'fallback'), 'fallback')
    })

    await t.test('staff test data is limited to waiting connection and uses device test mapping', async () => {
      const { canShowRequestConnectionTest, getConnectionTestApiUrl, mapTestResultRows } = await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
      assert.equal(canShowRequestConnectionTest({ statusCode: 'CONNECTION_CONFIRMED' }, true), true)
      assert.equal(canShowRequestConnectionTest({ status: 'รอเชื่อมต่อ' }, true), true)
      assert.equal(canShowRequestConnectionTest({ statusCode: 'CONNECTION_CONFIRMED' }, false), false)
      for (const statusCode of ['PENDING_DESIGN_REVIEW', 'WAITING_CONNECTION', 'CONNECTED', 'REJECTED', 'CANCELLED', 'WAITING_FACTORY_DEVICE_CONFIG']) {
        assert.equal(canShowRequestConnectionTest({ statusCode, status: 'รอเชื่อมต่อ' }, true), false)
      }
      assert.equal(canShowRequestConnectionTest(null, true), false)
      assert.ok(getConnectionTestApiUrl('S0001').endsWith('/connection-test?stationId=S0001'))
      const [row] = mapTestResultRows([{ values: { 'BOD (mg/l)': 4 }, statuses: { 'BOD (mg/l)': 'Normal' }, timestamp: '2026-10-19 10:00:00' }])
      assert.equal(row.values['BOD (mg/l)'], 4)
      assert.equal(row.statuses['BOD (mg/l)'], 'Normal')
      assert.equal(row.timestamp, '2026-10-19 10:00:00')
    })

    await t.test('activation failures display 503 safely and retain existing API error details', async () => {
      const { formatApiErrorMessage } = await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
      for (const payload of [null, '<html>Service unavailable</html>', { error: { message: 'Unable to confirm cleanup' } }]) {
        const message = formatApiErrorMessage(payload, 'fallback', 503)
        assert.match(message, /HTTP 503/)
        assert.match(message, /ตรวจสอบสถานะคำขอ/)
        assert.ok(!message.includes('<html>'))
        if (payload?.error) assert.ok(message.includes(payload.error.message))
      }
      assert.equal(formatApiErrorMessage({ error: { message: 'denied' } }, 'fallback', 403), 'denied')
      assert.equal(formatApiErrorMessage({ error: { issues: [{ pathString: 'field', message: 'invalid' }] } }, 'fallback', 400), 'field: invalid')
      const source = await readFile(new URL('../pages/ConnectionRequestPage.jsx', import.meta.url), 'utf8')
      for (const title of ['ยืนยันการอนุมัติ', 'ยืนยันการเชื่อมต่อ']) {
        const content = source.slice(source.indexOf(`<DialogTitle>${title}</DialogTitle>`))
        assert.match(content.slice(0, content.indexOf('</DialogContent>')), /requestDocumentError.*<Alert severity="error"/)
      }
    })

    await t.test('numeric commas are removed for connection and point-edit payloads without altering text or form inputs', async () => {
      const { buildMeasurementPointsPayload } = await server.ssrLoadModule('/src/pages/MasterDataPage.jsx')
      for (const system of ['CEMS', 'WPMS']) {
        for (const options of [{}, { addParameterConnectedParameters: [] }]) {
          const form = new FormData()
          const numeric = system === 'CEMS'
            ? ['stackDiameter', 'stackWidth', 'stackLength', 'stackHeight', 'monitoringHeight', 'averageFlowRate', 'minFlowRate', 'maxFlowRate', 'primaryFuelPercent', 'secondaryFuelPercent', 'stackLatitude', 'stackLongitude']
            : ['averageWastewaterDischarge', 'minWastewaterDischarge', 'maxWastewaterDischarge', 'maxTreatmentCapacity', 'instrumentLatitude', 'instrumentLongitude', 'dischargeLatitude', 'dischargeLongitude']
          for (const key of [...numeric, 'latitude', 'longitude', 'productionCapacityValue']) form.set(key, '1,234.56')
          form.set('pointName', 'Point, unchanged')
          form.set('productionCapacityUnit', 'unit, unchanged')
          form.set('requestedParameters', 'BOD (mg/l)')
          const instrument = { parameter: 'BOD (mg/l)', brand: 'Brand, unchanged', standardCriteria: { enabled: true, standardValue: '2,000.5', rows: [{ level: 'normal', min: '-1,000.5', max: '2,000.5' }] } }
          const body = buildMeasurementPointRequestBody({}, system, form, [], [instrument], options)
          const point = body.measurementPoints[0]
          for (const key of numeric) assert.equal(point.details[key], 1234.56, key)
          assert.equal(body.latitude, 1234.56)
          assert.equal(body.longitude, 1234.56)
          assert.equal(point.pointName, 'Point, unchanged')
          assert.equal(form.get(numeric[0]), '1,234.56')
          if (system === 'CEMS') {
            assert.equal(point.details.productionCapacityValue, '1234.56')
            assert.equal(point.details.productionCapacityUnit, 'unit, unchanged')
          }
          const parameter = point.measurementInstruments.parameters[0]
          assert.equal(parameter.brand, 'Brand, unchanged')
          assert.equal(parameter.standardCriteria.standardValue, '2000.5')
          assert.equal(parameter.standardCriteria.rows[0].min, -1000.5)
          assert.equal(parameter.standardCriteria.rows[0].max, 2000.5)
          assert.equal(instrument.standardCriteria.standardValue, '2,000.5')
          const edit = buildMeasurementPointsPayload({ ...body, latitude: 13.75, longitude: 100.5 }, { measurementPoints: [{ connectedPointId: 1 }] })
          assert.deepEqual(edit.measurementPoints[0].details, point.details)
          assert.deepEqual(edit.measurementPoints[0].measurementInstruments, point.measurementInstruments)
        }
      }
      for (const [value, expected] of [['', null], ['0', 0], ['12.5', 12.5], ['-12.5', -12.5]]) {
        const form = new FormData()
        form.set('averageFlowRate', value)
        assert.equal(buildMeasurementPointRequestBody({}, 'CEMS', form).measurementPoints[0].details.averageFlowRate, expected)
      }
    })

    await t.test('optional flow fields accept decimals and reject nonnumeric input before payload conversion', () => {
      for (const [system, fields] of [
        ['CEMS', ['averageFlowRate', 'minFlowRate', 'maxFlowRate']],
        ['WPMS', ['averageWastewaterDischarge', 'minWastewaterDischarge', 'maxWastewaterDischarge']],
      ]) {
        for (const field of fields) {
          for (const [value, expected] of [['', null], ['   ', null], ['0', 0], ['100', 100], ['1,000.50', 1000.5], ['-12.5', -12.5], ['.5', 0.5]]) {
            const form = new FormData()
            form.set(field, value)
            assert.equal(buildMeasurementPointRequestBody({}, system, form).measurementPoints[0].details[field], expected)
            assert.equal(form.get(field), value)
          }
          for (const value of ['abc', '100 m3/hr', '12.3.4', ',', 'Infinity', 'NaN', '0x10']) {
            const form = new FormData()
            form.set(field, value)
            assert.throws(() => buildMeasurementPointRequestBody({}, system, form), /ต้องเป็นตัวเลข สามารถมีทศนิยมได้/)
          }
        }
      }
    })

    await t.test('industrial-estate mapper, snapshot and PDF keep one authoritative source', async () => {
      const current = mapOperatorFactoryRow({
        id: 1, factoryId: 'TEST', industrialEstateCode: 'IEAT001', industrialEstateName: 'นิคมทดสอบ',
        industrialAreaType: 'INDUSTRIAL_ESTATE', industrialAreaTypeLabel: 'ในนิคมอุตสาหกรรม',
      })
      assert.equal(current.industrialEstateCode, 'IEAT001')
      assert.equal(current.industrialEstateName, 'นิคมทดสอบ')
      assert.equal(current.industrialAreaTypeLabel, 'ในนิคมอุตสาหกรรม')

      const detail = mapRequestDetailRow({
        id: 2, industrialEstateCode: null, industrialEstateName: null,
        factory: { industrialEstateCode: 'NESTED', industrialEstateName: 'นิคมจาก factory' },
      }, current)
      const snapshot = getInitialRequestFactory(detail, current)
      assert.equal(snapshot.industrialEstateCode, null)
      assert.equal(snapshot.industrialEstateName, null)
      assert.equal(snapshot.industrialAreaTypeLabel, 'นอกนิคมอุตสาหกรรม')

      const lines = []
      const layout = {
        sectionTitle: () => {},
        labelValue: (label, value) => lines.push([label, value]),
        labelValueRow: (items) => lines.push(...items.map(({ label, value }) => [label, value])),
      }
      const { renderGeneralFactorySection } = await server.ssrLoadModule('/src/utils/connectionRequestPdf.js')
      renderGeneralFactorySection(layout, current, { factory: {} }, { showExtendedFields: true })
      assert.deepEqual(lines.find(([label]) => label.includes('นิคมอุตสาหกรรม')), [
        'เขตประกอบการ/นิคมอุตสาหกรรม (ถ้ามี) : ', 'นิคมทดสอบ (IEAT001)',
      ])
      renderGeneralFactorySection(layout, detail, { factory: current }, { showExtendedFields: true })
      assert.deepEqual(lines.filter(([label]) => label.includes('นิคมอุตสาหกรรม')).at(-1), [
        'เขตประกอบการ/นิคมอุตสาหกรรม (ถ้ามี) : ', '-',
      ])
    })

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

    await t.test('connection PDFs select instrument rows by request type without changing master-data PDFs or payloads', async () => {
      const { getRequestContext, getRequestedParametersDisplay } = await server.ssrLoadModule('/src/utils/connectionRequestPdf.js')
      for (const systemType of ['CEMS', 'WPMS']) {
        const [connected, requested, unrelated] = systemType === 'CEMS'
          ? ['CO (ppm)', 'NOx (ppm)', 'SO2 (ppm)']
          : ['BOD (mg/l)', 'COD (mg/l)', 'SS (mg/l)']
        const saved = { parameter: connected, brand: 'Existing brand' }
        const added = { parameter: requested, brand: 'New brand', eiaStandard: '120' }
        const extra = { parameter: unrelated, brand: 'Unrelated brand' }
        const request = {
          systemType, requestType: 'ADD_MEASUREMENT_POINT', measurementPoints: [{
            details: {
              eligibleParameters: [connected, requested, unrelated], connectedParameters: [connected],
              pendingParameters: [requested, unrelated], requestedParameters: [],
            },
            parameters: [unrelated], measurementInstruments: { parameters: [saved, added, extra] },
          }],
        }
        const point = request.measurementPoints[0]
        assert.equal(getRequestedParametersDisplay(point, point.details), '-')
        assert.deepEqual(getRequestContext(request).documentParameters, [])
        point.details.requestedParameters = [requested]
        assert.deepEqual(getRequestContext(request).documentParameters, [added])
        assert.equal(getRequestedParametersDisplay(point, point.details), requested)

        request.requestType = 'ADD_PARAMETER'
        assert.deepEqual(getRequestContext(request).documentParameters, [saved, added])
        point.details.requestedParameters = [connected, requested, requested]
        assert.deepEqual(getRequestContext(request).documentParameters, [saved, added])
        point.details.requestedParameters = []
        assert.deepEqual(getRequestContext(request).documentParameters, [saved])

        point.measurementInstruments.parameters = []
        assert.deepEqual(getRequestContext(request).documentParameters, [{ parameter: connected }])
        point.details.connectedParameters = ['ไม่มี']
        assert.deepEqual(getRequestContext(request).documentParameters, [])
        point.details.connectedParameters = [connected]
        point.details.requestedParameters = [requested]
        assert.deepEqual(getRequestContext(request).documentParameters, [{ parameter: connected }, { parameter: requested }])

        // Preview receives retained rows separately; the API payload still contains only new instruments.
        delete request.requestType
        point.measurementInstruments.parameters = [added]
        const before = structuredClone(request)
        assert.deepEqual(getRequestContext(request, {
          requestType: 'ADD_PARAMETER', connectedInstrumentParameters: [saved],
        }).documentParameters, [saved, added])
        assert.deepEqual(request, before)
        request.form = 'เพิ่มพารามิเตอร์'
        assert.deepEqual(getRequestContext(request).documentParameters, [{ parameter: connected }, added])
        request.requestType = 'ADD_MEASUREMENT_POINT'
        assert.deepEqual(getRequestContext(request).documentParameters, [added])

        point.measurementInstruments.parameters = [saved, added, extra]
        for (const contentMode of ['measurement-point', 'factory-general-info']) {
          assert.deepEqual(getRequestContext(request, { contentMode }).documentParameters, [saved, added, extra])
        }
        point.measurementInstruments.parameters = []
        assert.deepEqual(getRequestContext(request, { contentMode: 'measurement-point' }).documentParameters,
          [connected, requested, unrelated].map((parameter) => ({ parameter })))
        assert.deepEqual(getRequestContext(request).documentParameters, [{ parameter: requested }])

        for (const requestType of ['ADD_MEASUREMENT_POINT', 'ADD_PARAMETER']) {
          request.requestType = requestType
          point.measurementInstruments.parameters = [saved, added, extra]
          point.monitoringPointStatus = 'ได้รับการยกเว้นทั้งหมด'
          point.details.requestedParameters = []
          assert.deepEqual(getRequestContext(request).documentParameters, [])
          assert.equal(getRequestedParametersDisplay(point, point.details), 'ได้รับการยกเว้นทั้งหมด')
          delete point.monitoringPointStatus
          point.details.requestedParameters = ['ได้รับการยกเว้นทั้งหมด']
          assert.deepEqual(getRequestContext(request).documentParameters, [])
        }
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

      for (const [systemType, pointCodes] of [['CEMS', ['S0647']], ['WPMS', ['P0155', 'P0527']]]) {
        const assignedRequest = {
          requestType: 'ADD_MEASUREMENT_POINT',
          systemType,
          measurementPoints: pointCodes.map((pointCode, index) => ({ id: index + 1, pointCode })),
        }
        assert.deepEqual(getAssignedRequestPointCodes(assignedRequest), pointCodes)
        assert.deepEqual(buildRequestApprovalPayload(assignedRequest, 'EXISTING', pointCodes[0]), expected)
        assert.equal('pointCodeAssignments' in buildRequestApprovalPayload(assignedRequest, 'EXISTING', pointCodes[0]), false)
      }
      assert.deepEqual(getAssignedRequestPointCodes({ measurementPoints: [{ pointCode: 'S0647' }, { pointCode: null }] }), [])
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
          industrialEstateCode: 'IEAT001', industrialEstateName: 'นิคมทดสอบ',
          industrialAreaType: 'INDUSTRIAL_ESTATE', industrialAreaTypeLabel: 'ในนิคมอุตสาหกรรม',
          measurementPoints: [{ pointCode: 'S123', pointName: 'Test point', details,
            documentsAndImages: [
              { title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน', fileName: 'front.jpg', fileUrl: 'https://example.com/front.jpg', fileType: 'image/jpeg' },
              { title: 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท', fileName: 'logo.jpg', fileUrl: 'https://example.com/logo.jpg', fileType: 'image/jpeg' },
            ],
            measurementInstruments: { parameters: [
              { parameter: connected, brand: 'Saved brand' }, { parameter: 'STALE', brand: 'Old brand' },
            ] } }],
        } } }, { pointCode: 'S123', type: systemType })
        const render = (mode, props = {}) => renderToStaticMarkup(React.createElement(RequestFormBottomSheet, {
          open: true, embedded: true, mode, initialRequest, factory: { factoryId: 'TEST' }, isOperator: true,
          formType: mode === 'add-parameter' ? 'เพิ่มพารามิเตอร์' : 'เพิ่มจุดตรวจวัด',
          showIndustrialEstateFields: true,
          ...props,
        }))
        const generalSection = (markup) => markup.slice(markup.indexOf('ข้อมูลทั่วไปของโรงงาน'), markup.indexOf('data-field-name="contactPersons"'))
        const html = render('add-parameter')
        assert.equal(initialRequest.documentsAndImages, undefined)
        assert.ok(generalSection(html).includes('front.jpg'))
        assert.ok(generalSection(html).includes('logo.jpg'))
        assert.ok(!generalSection(html).includes('aria-label="ลบไฟล์'))
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
        for (const value of ['พื้นที่ประกอบกิจการ', 'ในนิคมอุตสาหกรรม', 'นิคมทดสอบ']) {
          assert.ok(generalSection(html).includes(value), `industrial-estate value must remain visible: ${value}`)
        }
        assert.ok(!generalSection(html).includes('รหัสนิคมอุตสาหกรรม'))
        assert.ok(!generalSection(html).includes('IEAT001'))
        const sharedFormWithoutConnectionFields = render('add-parameter', { showIndustrialEstateFields: false })
        assert.ok(!generalSection(sharedFormWithoutConnectionFields).includes('พื้นที่ประกอบกิจการ'))
        assert.ok(!generalSection(sharedFormWithoutConnectionFields).includes('รหัสนิคมอุตสาหกรรม'))
        assert.ok(!generalSection(sharedFormWithoutConnectionFields).includes('ชื่อนิคมอุตสาหกรรม'))
        const edit = render('edit')
        assert.deepEqual(hiddenValues(edit, 'requestedParameters'), ['STALE'])
        assert.deepEqual(hiddenValues(edit, 'pendingParameters'), ['STALE'])
        assert.ok(!fieldMarkup(edit, 'connectedParameters').includes('Mui-readOnly'))
        assert.ok(!render('create').includes('name="requestedParameters"'))

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
          assert.ok(inputs.filter((input) => !input.includes('type="file"')).every((input) => (
            input.includes('readOnly=""') || input.includes('disabled=""')
          )))
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
          existingDocuments: initialRequest.measurementPoints[0].documentsAndImages,
        })
        assert.equal(lockedPayload.eia, 'อื่นๆ')
        assert.equal(lockedPayload.eiaOther, 'Other assessment')
        assert.equal(lockedPayload.projectName, 'Saved project')
        assert.equal(lockedPayload.latitude, 13.5)
        assert.equal(lockedPayload.longitude, 100.5)
        assert.equal(lockedPayload.industrialEstateCode, 'IEAT001')
        assert.equal(lockedPayload.industrialEstateName, 'นิคมทดสอบ')
        assert.equal(lockedPayload.industrialAreaType, undefined)
        assert.equal(lockedPayload.industrialAreaTypeLabel, undefined)
        assert.ok(lockedPayload.measurementPoints[0].documentsAndImages.some((document) => document.fileName === 'front.jpg'))
        assert.ok(lockedPayload.measurementPoints[0].documentsAndImages.some((document) => document.fileName === 'logo.jpg'))

        const nullEstateDefaults = getParameterFormDefaultsFromPayload({ data: { formDefaults: {
          factoryId: 'TEST', systemType, industrialEstateCode: null, industrialEstateName: null,
          measurementPoints: [{ pointCode: 'S123', details }],
        } } }, { pointCode: 'S123', type: systemType })
        const nullEstateFactory = getInitialRequestFactory(nullEstateDefaults, {
          industrialEstateCode: 'CURRENT', industrialEstateName: 'นิคมปัจจุบัน',
          industrialAreaType: 'INDUSTRIAL_ESTATE',
        })
        assert.equal(nullEstateFactory.industrialEstateCode, null)
        assert.equal(nullEstateFactory.industrialEstateName, null)
        assert.equal(nullEstateFactory.industrialAreaTypeLabel, 'นอกนิคมอุตสาหกรรม')
        const nullEstateHtml = render('add-parameter', {
          initialRequest: nullEstateDefaults,
          factory: nullEstateFactory,
        })
        assert.ok(generalSection(nullEstateHtml).includes('นอกนิคมอุตสาหกรรม'))
        assert.ok(generalSection(nullEstateHtml).includes('value="-"'))
        const nullEstatePayload = buildMeasurementPointRequestBody(nullEstateFactory, systemType, new FormData())
        assert.equal(nullEstatePayload.industrialEstateCode, null)
        assert.equal(nullEstatePayload.industrialEstateName, null)

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
        assert.deepEqual(validateParameterGroups(groups, instruments), [])
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
