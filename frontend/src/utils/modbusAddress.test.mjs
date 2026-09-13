import assert from 'node:assert/strict'
import test from 'node:test'
import { isModbusParameterRow, stepModbusAddress } from './modbusAddress.mjs'

test('both step directions start an empty Modbus address at 40001', () => {
  for (const value of ['', ' ', null, undefined]) {
    assert.equal(stepModbusAddress(value, 1), '40001')
    assert.equal(stepModbusAddress(value, -1), '40001')
  }
})

test('nonempty Modbus addresses step by one without minimum or maximum', () => {
  for (const value of [0, 1, 40000, 40001, 65535, 100000, -10]) {
    assert.equal(stepModbusAddress(String(value), 1), String(value + 1))
    assert.equal(stepModbusAddress(value, -1), String(value - 1))
  }
})

test('address stepping is scoped to the selected RTU/TCP device in mixed configurations', () => {
  const forms = [
    { deviceCode: 'RTU', configId: 1, type: 'Modbus RTU' },
    { deviceCode: 'TCP', configId: 2, type: 'Modbus TCP' },
    { deviceCode: 'SQL', configId: 3, type: 'MySQL' },
  ]
  assert.equal(isModbusParameterRow({ deviceCode: 'RTU' }, forms), true)
  assert.equal(isModbusParameterRow({ deviceCode: 'TCP' }, forms), true)
  assert.equal(isModbusParameterRow({ deviceCode: 'SQL' }, forms), false)
  assert.equal(isModbusParameterRow({ deviceCode: 'missing' }, forms), false)
  assert.equal(isModbusParameterRow({}, forms), false)
  assert.equal(isModbusParameterRow({ configId: '2' }, forms), true)
  assert.equal(isModbusParameterRow({ deviceCode: 'SQL', configId: 2 }, forms), false)
})

test('single-device forms support unassigned parameter rows without changing other protocols', () => {
  for (const type of ['Modbus RTU', 'Modbus TCP', 'MODBUS_RTU', 'MODBUS_TCP']) {
    assert.equal(isModbusParameterRow({}, [{ type }]), true)
  }
  for (const type of ['MySQL', 'Microsoft SQL', 'POMS_BOX', '']) {
    assert.equal(isModbusParameterRow({}, [{ type }]), false)
  }
  assert.equal(isModbusParameterRow({}), false)
})
