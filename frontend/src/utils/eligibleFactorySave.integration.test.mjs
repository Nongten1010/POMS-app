import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { parse } from '@babel/parser'
import { createServer } from 'vite'

function saveCallbackSource(code) {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] })
  let callback
  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'VariableDeclarator' && node.id?.name === 'handleSaveMonitoringPointForm') {
      callback = node.init.arguments[0]
      return
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit)
      else if (value?.type) visit(value)
    }
  }
  visit(ast.program)
  assert.equal(callback?.type, 'ArrowFunctionExpression', 'test must execute the actual save callback')
  return code.slice(callback.start, callback.end)
}

const factory = {
  id: 99,
  factoryId: '40900061525690',
  factoryRegistrationNo: '3-88(2)-6/69SK',
  factoryName: 'Existing eligible power plant',
  factoryClass: '08802',
  provinceName: 'Songkhla',
  productionCapacity: '6',
  monitoringPointFormId: null,
  measurementPoints: [],
}

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function saveState(module, row, accessToken = 'test-only-placeholder') {
  const state = { error: '', rows: [row], savingIds: [], closed: false, refreshed: 0, snackbar: false }
  const save = module.createSaveHandlerForTest({
    accessToken,
    setEligibleActionError: (error) => { state.error = error },
    setSavingEligibleFactoryIds: (update) => { state.savingIds = update(state.savingIds) },
    setFactoryRows: (update) => { state.rows = update(state.rows) },
    loadEligibleFactories: async () => { state.refreshed++ },
    handleCloseEligibleSheet: () => { state.closed = true },
    setSnackbarMessage: () => {},
    setSnackbarOpen: (open) => { state.snackbar = open },
  })
  return { state, save }
}

test('eligible factory point saving uses the real row mapper, save handler and serializers', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-eligible-save-test-'))
  const server = await createServer({
    cacheDir,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
    appType: 'custom',
    plugins: [{
      name: 'eligible-save-test-exports',
      enforce: 'pre',
      transform(code, id) {
        if (!id.endsWith('/src/pages/EligibleFactoriesPage.jsx')) return
        const callback = saveCallbackSource(code)
        return `${code}\n
          export { mapEligibleFactory, mapCandidateFactory, createDefaultMonitoringPoint, mapMonitoringPointToForm, mapMonitoringPointFormPayload };
          export function createSaveHandlerForTest(dependencies) {
            const { accessToken, setEligibleActionError, setSavingEligibleFactoryIds,
              setFactoryRows, loadEligibleFactories, handleCloseEligibleSheet,
              setSnackbarMessage, setSnackbarOpen } = dependencies;
            return ${callback};
          }
        `
      },
    }],
  })
  try {
    const module = await server.ssrLoadModule('/src/pages/EligibleFactoriesPage.jsx')
    const points = ['CEMS', 'WPMS'].map((type, index) => ({
      ...module.createDefaultMonitoringPoint(type, index + 1),
      id: `new-${type}`,
      pointCode: `TEST-${type}`,
      pointName: `New ${type} point`,
      eligibleParameters: type === 'CEMS' ? ['CO'] : ['BOD'],
    }))

    await t.test('first points for an already eligible factory are POSTed as a monitoring form', async (t) => {
      const requests = []
      t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({ url, options, body: JSON.parse(options.body) })
        if (url.endsWith('/eligible-factories')) {
          return response({ success: false, error: { code: 'CONFLICT', message: 'Factory is already selected as eligible' } }, 409)
        }
        return response({ success: true, data: { id: 55, points: [] } }, 201)
      })
      const row = module.mapEligibleFactory(factory, 0)
      const { save, state } = saveState(module, row)
      await save(row, points)
      assert.equal(requests.length, 1)
      assert.ok(requests[0].url.endsWith('/monitoring-point-forms'), requests[0].url)
      assert.equal(requests[0].options.method, 'POST')
      assert.equal(requests[0].body.factory.factoryRegistrationNoNew, factory.factoryId)
      assert.equal(requests[0].body.factory.factoryRegistrationNoOld, factory.factoryRegistrationNo)
      assert.deepEqual(requests[0].body.points, points.map(module.mapMonitoringPointFormPayload))
      assert.equal(state.error, '')
      assert.equal(state.closed, true)
      assert.equal(state.refreshed, 1)
      assert.equal(state.snackbar, true)
      assert.deepEqual(state.savingIds, [])
      assert.equal(state.rows[0].monitoringPointFormId, 55)
      assert.equal(state.rows[0].cemsPointCount, 1)
      assert.equal(state.rows[0].wpmsPointCount, 1)
    })

    await t.test('the selected row retains its form ID and PUT keeps old and new points', async (t) => {
      const existingPoint = { id: 7, systemType: 'CEMS', pointCode: 'TEST-OLD', pointName: 'Existing stack' }
      const row = module.mapEligibleFactory({ ...factory, monitoringPointFormId: 55, measurementPoints: [existingPoint] }, 0)
      assert.equal(row.monitoringPointFormId, 55)
      const nextPoints = [module.mapMonitoringPointToForm(existingPoint), ...points]
      const requests = []
      t.mock.method(globalThis, 'fetch', async (url, options) => {
        const body = JSON.parse(options.body)
        requests.push({ url, options, body })
        return response({ success: true, data: { id: 55, points: body.points } })
      })
      const { save, state } = saveState(module, row)
      await save(row, nextPoints)
      assert.equal(requests.length, 1)
      assert.ok(requests[0].url.endsWith('/monitoring-point-forms/55'))
      assert.equal(requests[0].options.method, 'PUT')
      assert.equal(requests[0].body.points[0].id, 7)
      assert.equal(requests[0].body.points.length, 3)
      assert.equal(state.error, '')
      assert.equal(state.closed, true)
    })

    await t.test('legacy formId is retained when the canonical field is absent', () => {
      assert.equal(module.mapEligibleFactory({ ...factory, formId: 66 }, 0).monitoringPointFormId, 66)
    })

    await t.test('a selected factory with an empty point list still saves a monitoring form', async (t) => {
      let request
      t.mock.method(globalThis, 'fetch', async (url, options) => {
        request = { url, body: JSON.parse(options.body) }
        return response({ success: true, data: { id: 55, points: [] } }, 201)
      })
      const row = module.mapEligibleFactory(factory, 0)
      const { save } = saveState(module, row)
      await save(row)
      assert.ok(request.url.endsWith('/monitoring-point-forms'))
      assert.deepEqual(request.body.points, [])
    })

    await t.test('selecting a new candidate continues to use the eligible-factory endpoint', async (t) => {
      let request
      t.mock.method(globalThis, 'fetch', async (url, options) => {
        request = { url, options, body: JSON.parse(options.body) }
        return response({ success: true, data: { id: 100, measurementPoints: [] } }, 201)
      })
      const row = module.mapCandidateFactory(factory, 0)
      const { save, state } = saveState(module, row)
      await save(row, [])
      assert.ok(request.url.endsWith('/eligible-factories'))
      assert.equal(request.options.method, 'POST')
      assert.equal(request.body.factoryId, factory.factoryId)
      assert.equal(request.body.factoryRegistrationNo, factory.factoryRegistrationNo)
      assert.equal(state.error, '')
    })

    await t.test('the existing approval flow continues to save its monitoring form', async (t) => {
      let url
      t.mock.method(globalThis, 'fetch', async (requestUrl) => {
        url = requestUrl
        return response({ success: true, data: { id: 55, points: [] } }, 201)
      })
      const row = { ...module.mapCandidateFactory(factory, 0), saveWithMonitoringPointForm: true }
      const { save } = saveState(module, row)
      await save(row, points)
      assert.ok(url.endsWith('/monitoring-point-forms'))
    })

    for (const [status, code] of [[400, 'BAD_REQUEST'], [403, 'FORBIDDEN'], [409, 'CONFLICT'], [500, 'INTERNAL_ERROR']]) {
      await t.test(`HTTP ${status} preserves the form and never retries another write endpoint`, async (t) => {
        const requests = []
        t.mock.method(globalThis, 'fetch', async (url, options) => {
          requests.push({ url, options })
          return response({ success: false, error: { code, message: `Save rejected: ${code}` } }, status)
        })
        const row = module.mapEligibleFactory(factory, 0)
        const before = structuredClone(row)
        const { save, state } = saveState(module, row)
        await save(row, points)
        assert.equal(requests.length, 1)
        assert.equal(requests[0].options.headers.Authorization, 'Bearer test-only-placeholder')
        assert.equal(state.error, `Save rejected: ${code}`)
        assert.equal(state.closed, false)
        assert.equal(state.snackbar, false)
        assert.equal(state.refreshed, 0)
        assert.deepEqual(state.rows, [before])
        assert.deepEqual(state.savingIds, [])
      })
    }

    await t.test('a network failure preserves the form and clears the saving state', async (t) => {
      t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network unavailable') })
      const row = module.mapEligibleFactory(factory, 0)
      const { save, state } = saveState(module, row)
      await save(row, points)
      assert.equal(state.error, 'Network unavailable')
      assert.equal(state.closed, false)
      assert.deepEqual(state.savingIds, [])
    })

    await t.test('saving without authentication makes no request', async (t) => {
      const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request') })
      const row = module.mapEligibleFactory(factory, 0)
      const { save, state } = saveState(module, row, '')
      await save(row, points)
      assert.equal(fetch.mock.callCount(), 0)
      assert.ok(state.error)
      assert.equal(state.closed, false)
    })
  } finally {
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
