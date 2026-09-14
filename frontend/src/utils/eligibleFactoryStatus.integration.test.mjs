import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { getGridSingleSelectOperators } from '@mui/x-data-grid'
import { createServer } from 'vite'

test('eligible factory status filters match displayed CEMS and WPMS summaries', async () => {
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
          return `${code}\nexport { eligibleMonitoringColumns, mapEligibleFactory };`
        }
      },
    }],
  })
  try {
    const { eligibleMonitoringColumns, mapEligibleFactory } = await server.ssrLoadModule('/src/pages/EligibleFactoriesPage.jsx')
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
