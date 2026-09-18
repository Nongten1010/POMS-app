import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Children, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

function fields(element) {
  if (!isValidElement(element)) return []
  return [
    ...(element.props.label ? [element] : []),
    ...Children.toArray(element.props.children).flatMap(fields),
  ]
}

test('DCON device settings preserve the RTU field shape and use DCON_ASCII on the wire', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-dcon-test-'))
  const server = await createServer({
    cacheDir,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    plugins: [{
      name: 'dcon-test-exports',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('/src/pages/ConnectionRequestPage.jsx')) {
          return `${code}\nexport {
            connectionTypeOptions, getDefaultConnectionForm, ConnectionFormFields,
            normalizeConnectionType, getConnectionProtocolCode, validateDeviceConfigForm,
            mapConnectionForms, getDeviceConfigConnectionForms, buildConnectionSettings,
            buildDeviceConfigPayloadItem, buildDeviceConfigDeviceItem, buildStructuredDeviceConfigPayload,
            getDeviceConfigsApiUrl, getConnectedMeasurementPointDeviceConfigsApiUrl,
          };`
        }
      },
    }],
  })
  try {
    const api = await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
    const values = {
      comPort: 'COM3', slaveId: '7', baudRate: '9600', parity: 'None',
      stopBits: '1', dataBits: '8', quantity: '2', measureMin: '0', measureMax: '200',
    }
    const form = { id: 1, deviceCode: 'DCON001', type: 'DCON', values }
    const settings = {
      comPort: 'COM3', slaveId: 7, baudRate: 9600, parity: 'NONE',
      stopBits: 1, dataBits: 8, quantity: 2, valueRange: { min: 0, max: 200 },
    }

    await t.test('DCON follows Modbus TCP and maps both directions without changing other protocols', () => {
      assert.deepEqual(api.connectionTypeOptions, ['Modbus RTU', 'Modbus TCP', 'DCON', 'Microsoft SQL', 'MySQL', 'POMS Box'])
      for (const [label, code] of [
        ['Modbus RTU', 'MODBUS_RTU'], ['Modbus TCP', 'MODBUS_TCP'], ['DCON', 'DCON_ASCII'],
        ['Microsoft SQL', 'MSSQL'], ['MySQL', 'MYSQL'], ['POMS Box', 'POMS_BOX'],
      ]) {
        assert.equal(api.getConnectionProtocolCode(label), code)
        assert.equal(api.getConnectionProtocolCode(code), code)
        assert.equal(api.normalizeConnectionType(code), label)
        assert.equal(api.validateDeviceConfigForm({ type: code }), '')
      }
      assert.notEqual(api.validateDeviceConfigForm({ type: 'INVALID_PROTOCOL' }), '')
    })

    await t.test('only DCON labels slaveId as device address and edits the same state field', () => {
      assert.deepEqual(api.getDefaultConnectionForm('DCON'), api.getDefaultConnectionForm('Modbus RTU'))
      let nextValues
      const dcon = api.ConnectionFormFields({ connectionType: 'DCON', value: values, onChange: (next) => { nextValues = next } })
      const rtu = api.ConnectionFormFields({ connectionType: 'Modbus RTU', value: values, onChange: () => {} })
      const dconFields = fields(dcon)
      assert.deepEqual(dconFields.map((field) => field.props.label),
        fields(rtu).map((field) => field.props.label === 'Slave ID' ? 'device address' : field.props.label))
      const address = dconFields.find((field) => field.props.label === 'device address')
      assert.equal(address.props.value, '7')
      address.props.onChange('12')
      assert.deepEqual(nextValues, { ...values, slaveId: '12' })
      assert.equal('deviceAddress' in nextValues, false)
      const html = renderToStaticMarkup(dcon)
      assert.match(html, /device address/)
      assert.doesNotMatch(html, /Slave ID|Host IP|dbUser/)
      for (const connectionType of ['Modbus RTU', 'Modbus TCP']) {
        const html = renderToStaticMarkup(api.ConnectionFormFields({ connectionType, value: values, onChange: () => {} }))
        assert.match(html, /Slave ID/)
        assert.doesNotMatch(html, /device address/)
      }
    })

    await t.test('serial settings match RTU including parity, numbers, zero and empty values', () => {
      assert.deepEqual(api.buildConnectionSettings(form), settings)
      assert.deepEqual(api.buildConnectionSettings({ ...form, type: 'DCON_ASCII' }), settings)
      assert.deepEqual(api.buildConnectionSettings({ ...form, type: 'Modbus RTU' }), settings)
      for (const [parity, code] of [['Even', 'EVEN'], ['Odd', 'ODD'], ['None', 'NONE']]) {
        assert.equal(api.buildConnectionSettings({ ...form, values: { ...values, parity } }).parity, code)
      }
      assert.deepEqual(api.buildConnectionSettings({ type: 'DCON', values: api.getDefaultConnectionForm('DCON') }), {
        comPort: null, slaveId: null, baudRate: null, parity: null, stopBits: null,
        dataBits: null, quantity: null, valueRange: null,
      })
    })

    await t.test('single and structured payloads preserve station, channels and schedules', () => {
      const channels = [{ deviceCode: 'DCON001', addressId: 1, dataType: 'NOx (ppm)' }]
      const statusManagement = { schedules: [] }
      const single = api.buildDeviceConfigPayloadItem({ form, stationId: 'S2001', deviceCode: 'DCON001', channels, statusManagement })
      assert.deepEqual(single, { stationId: 'S2001', deviceCode: 'DCON001', protocol: 'DCON_ASCII', settings, channels, statusManagement })
      const device = api.buildDeviceConfigDeviceItem(form, 'DCON001')
      const tcp = api.buildDeviceConfigDeviceItem({ type: 'Modbus TCP', values: { hostIp: '192.0.2.10', slaveId: '2', port: '502' } }, 'TCP001')
      const structured = api.buildStructuredDeviceConfigPayload({ stationId: 'S2001', deviceItems: [device, tcp], channelGroups: [channels, []], statusManagement })
      assert.deepEqual(structured.config.device[0], { deviceCode: 'DCON001', protocol: 'DCON_ASCII', settings })
      assert.equal(structured.config.device[1].protocol, 'MODBUS_TCP')
      assert.deepEqual(structured.config.channels, channels)
      assert.deepEqual(structured.config.statusManagement, statusManagement)
      assert.equal('deviceAddress' in structured.config.device[0].settings, false)
    })

    await t.test('GET responses refill DCON from both connectionForms and raw config without losing settings', () => {
      const device = { deviceCode: 'DCON001', protocol: 'DCON_ASCII', settings }
      for (const response of [
        { connectionForms: [{ type: 'DCON_ASCII', values: settings }] },
        { connectionForms: [{ type: 'DCON', values }] },
        { device: [device] },
        { config: { device: [device] } },
      ]) {
        const [loaded] = api.mapConnectionForms(api.getDeviceConfigConnectionForms(response))
        assert.equal(loaded.type, 'DCON')
        assert.equal(loaded.values.parity, 'None')
        assert.equal(Number(loaded.values.slaveId), 7)
        assert.deepEqual(api.buildConnectionSettings(loaded), settings)
        assert.equal(api.getConnectionProtocolCode(loaded.type), 'DCON_ASCII')
      }
      const [loaded] = api.mapConnectionForms([{ protocol: 'DCON_ASCII', settings: {} }])
      assert.equal(loaded.values.slaveId, '')
      assert.equal(loaded.values.parity, '')
    })

    await t.test('uses existing request and connected-point endpoints without a new DCON API', () => {
      assert.match(api.getDeviceConfigsApiUrl(123, 'S2001'), /\/cems-wpms-requests\/123\/device-configs\?stationId=S2001$/)
      assert.match(api.getDeviceConfigsApiUrl(123), /\/cems-wpms-requests\/123\/device-configs$/)
      assert.match(api.getConnectedMeasurementPointDeviceConfigsApiUrl('S2001'), /\/connected-measurement-points\/S2001\/device-configs$/)
    })
  } finally {
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
