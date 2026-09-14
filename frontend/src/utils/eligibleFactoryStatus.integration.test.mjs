import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Children, isValidElement } from 'react'
import { getGridSingleSelectOperators } from '@mui/x-data-grid'
import { createServer } from 'vite'

test('eligible factory status filters and monitoring-point form options', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-eligible-status-test-'))
  const server = await createServer({
    cacheDir,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: 'custom',
    plugins: [{
      name: 'eligible-status-test-exports',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('/src/pages/EligibleFactoriesPage.jsx')) {
          return `${code}\nexport { eligibleMonitoringColumns, mapEligibleFactory, MonitoringPointForm, ParameterMultiSelect, createDefaultMonitoringPoint, mapMonitoringPointToForm, mapMonitoringPointFormPayload };`
        }
      },
    }],
  })
  try {
    const {
      eligibleMonitoringColumns, mapEligibleFactory, MonitoringPointForm, ParameterMultiSelect,
      createDefaultMonitoringPoint, mapMonitoringPointToForm, mapMonitoringPointFormPayload,
    } = await server.ssrLoadModule('/src/pages/EligibleFactoriesPage.jsx')
    await t.test('parameter dropdowns put none first, keep it exclusive, and submit annex 13', () => {
      const fields = {
        eligibleParameters: 'พารามิเตอร์ที่เข้าข่าย',
        exemptedParameters: 'พารามิเตอร์ที่ได้รับการยกเว้น',
        connectedParameters: 'พารามิเตอร์ที่เชื่อมต่อแล้ว',
        pendingParameters: 'พารามิเตอร์ที่ยังไม่เชื่อมต่อ',
        timeSharingParameters: 'พารามิเตอร์ที่ติดตั้งแบบ Time sharing',
      }
      const findDropdowns = (element) => {
        if (!isValidElement(element)) return []
        if (element.type === ParameterMultiSelect) return [element]
        return Children.toArray(element.props.children).flatMap(findDropdowns)
      }
      for (const type of ['CEMS', 'WPMS']) {
        let point = createDefaultMonitoringPoint(type)
        const getFields = () => findDropdowns(MonitoringPointForm({
          point, onChange: (changes) => { point = { ...point, ...changes } }, onTypeChange: () => {},
        }))
        for (const [field, label] of Object.entries(fields)) {
          if (type === 'WPMS' && field === 'exemptedParameters') {
            assert.ok(!getFields().some((element) => element.props.label === label))
            continue
          }
          const getField = () => getFields().find((element) => element.props.label === label)
          const options = getField().props.options
          assert.equal(options[0], 'ไม่มี')
          assert.equal(options.filter((option) => option === 'ไม่มี').length, 1)
          const parameter = options[1]
          assert.ok(parameter)
          for (const [selected, expected] of [
            [[parameter], [parameter]],
            [[parameter, 'ไม่มี'], ['ไม่มี']],
            [['ไม่มี', parameter], [parameter]],
            [[], []],
            [['ไม่มี'], ['ไม่มี']],
          ]) {
            const select = Children.toArray(ParameterMultiSelect(getField().props).props.children)[1]
            select.props.onChange({ target: { value: selected } })
            assert.deepEqual(point[field], expected)
          }
          assert.deepEqual(mapMonitoringPointFormPayload(point)[field], ['ไม่มี'])
          assert.deepEqual(mapMonitoringPointToForm(mapMonitoringPointFormPayload(point))[field], ['ไม่มี'])
        }
        const annex = getFields().find((element) => element.props.label === 'เข้าข่ายตามบัญชีแนบท้ายลำดับที่')
        if (type === 'CEMS') {
          assert.deepEqual(annex.props.options, Array.from({ length: 13 }, (_, index) => String(index + 1)))
          annex.props.onChange(['1', '13'])
          assert.deepEqual(mapMonitoringPointFormPayload(point).legalAnnexNo, ['1', '13'])
          assert.deepEqual(mapMonitoringPointToForm(mapMonitoringPointFormPayload(point)).legalAnnexNo, ['1', '13'])
        } else {
          assert.equal(annex, undefined)
        }
      }
    })
    const statuses = ['-', 'เชื่อมต่อครบถ้วน', 'ได้รับยกเว้นทั้งหมด', 'อยู่ระหว่างเชื่อมต่อ', 'ยังไม่แล้วเสร็จ']
    const operators = getGridSingleSelectOperators()
    for (const type of ['CEMS', 'WPMS']) {
      const field = `${type.toLowerCase()}ConnectionStatusSummary`
      const column = eligibleMonitoringColumns.find((item) => item.field === field)
      assert.equal(column.filterable, true)
      assert.equal(column.type, 'singleSelect')
      assert.deepEqual(column.valueOptions, statuses)
      const rows = statuses.map((status, index) => mapEligibleFactory({
        id: index + 1, [field]: status,
        measurementPoints: [{ systemType: type }],
      }, index))
      const noPoints = mapEligibleFactory({
        id: 10, [field]: 'ยังไม่แล้วเสร็จ',
        measurementPoints: [{ systemType: type === 'CEMS' ? 'WPMS' : 'CEMS' }],
      }, 10)
      const missingSummary = mapEligibleFactory({ id: 11, measurementPoints: [{ systemType: type }] }, 11)
      const allRows = [...rows, noPoints, missingSummary]
      assert.equal(column.valueGetter(undefined, noPoints), '-')
      assert.equal(column.valueGetter(undefined, missingSummary), '-')
      for (const status of statuses) {
        const matches = operators.find((operator) => operator.value === 'is')
          .getApplyFilterFn({ field, value: status })
        const filtered = allRows.filter((row) => matches(column.valueGetter(undefined, row)))
        assert.equal(filtered.length, status === '-' ? 3 : 1)
        assert.ok(filtered.every((row) => column.valueGetter(undefined, row) === status))
      }
      const any = operators.find((operator) => operator.value === 'isAnyOf')
        .getApplyFilterFn({ field, value: statuses.slice(1, 3) })
      assert.equal(allRows.filter((row) => any(column.valueGetter(undefined, row))).length, 2)
      const not = operators.find((operator) => operator.value === 'not')
        .getApplyFilterFn({ field, value: '-' })
      assert.equal(allRows.filter((row) => not(column.valueGetter(undefined, row))).length, 4)
      assert.deepEqual([...statuses].reverse().sort(column.sortComparator), statuses)
      assert.equal(operators[0].getApplyFilterFn({ field, value: '' }), null)

      const progress = 'อยู่ระหว่างเชื่อมต่อ'
      const otherType = type === 'CEMS' ? 'WPMS' : 'CEMS'
      const makeRow = (points) => mapEligibleFactory({
        id: 20, [field]: 'ยังไม่แล้วเสร็จ', measurementPoints: points,
      }, 20)
      const firstPoint = { systemType: type, monitoringPointStatus: progress }
      const nestedPoint = { details: { monitoringPointKind: type, monitoringPointStatus: progress } }
      const matchesProgress = operators[0].getApplyFilterFn({ field, value: progress })
      for (const points of [[firstPoint], [firstPoint, nestedPoint], [firstPoint, nestedPoint, { systemType: otherType }]]) {
        const row = makeRow(points)
        const snapshot = structuredClone(row)
        assert.equal(column.valueGetter(undefined, row), progress)
        assert.equal(matchesProgress(column.valueGetter(undefined, row)), true)
        assert.deepEqual(row, snapshot)
      }
      for (const monitoringPointStatus of ['เชื่อมต่อครบแล้ว', 'ได้รับการยกเว้นทั้งหมด', null, '']) {
        const mixed = makeRow([firstPoint, { systemType: type, monitoringPointStatus }])
        assert.equal(column.valueGetter(undefined, mixed), 'ยังไม่แล้วเสร็จ')
        assert.equal(matchesProgress(column.valueGetter(undefined, mixed)), false)
      }
      assert.equal(column.valueGetter(undefined, makeRow([])), '-')
      assert.equal(column.valueGetter(undefined, makeRow([{ systemType: otherType, monitoringPointStatus: progress }])), '-')
      assert.equal(column.valueGetter(undefined, makeRow([{ systemType: type, status: progress }])), 'ยังไม่แล้วเสร็จ')
    }
  } finally {
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
