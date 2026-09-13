export function stepModbusAddress(value, direction) {
  if (value == null || String(value).trim() === '') return '40001'
  const number = Number(value)
  return Number.isFinite(number) ? String(number + direction) : '40001'
}

export function isModbusParameterRow(row, connectionForms = []) {
  const form = row.deviceCode
    ? connectionForms.find((item) => item.deviceCode === row.deviceCode)
    : row.configId
      ? connectionForms.find((item) => String(item.configId) === String(row.configId))
      : connectionForms.length === 1 ? connectionForms[0] : null
  return ['Modbus RTU', 'Modbus TCP', 'MODBUS_RTU', 'MODBUS_TCP'].includes(form?.type)
}
