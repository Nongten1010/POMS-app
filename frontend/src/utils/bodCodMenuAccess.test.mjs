import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
const sidebar = readFileSync(new URL('../components/DpomsSidebar.jsx', import.meta.url), 'utf8')
const canViewMenu = runInNewContext(
  `${app.slice(app.indexOf('function canViewMenu('), app.indexOf('function getFirstViewableMenu('))}; canViewMenu`,
  { publicMenuValues: new Set(['home']), menuPermissionMap: { 'bod-cod-report': 'bod_cod_errors', forms: 'kwp_forms' } },
)

test('BOD/COD maintenance access requires admin and existing view permission', () => {
  const permissions = { bod_cod_errors: { view: true }, kwp_forms: { view: true } }
  for (const roles of [[], ['factory_operator'], ['officer'], ['director']]) {
    assert.equal(canViewMenu('bod-cod-report', permissions, roles), false)
  }
  assert.equal(canViewMenu('bod-cod-report', permissions, ['officer', 'admin']), true)
  assert.equal(canViewMenu('bod-cod-report', {}, ['admin']), false)
  assert.equal(canViewMenu('forms', permissions, ['officer']), true)
  assert.equal(canViewMenu('home', {}, []), true)
})

test('sidebar exposes maintenance label and disables non-admin navigation', () => {
  assert.match(sidebar, /value: 'bod-cod-report',\s+adminOnly: true,\s+secondary: 'อยู่ระหว่างการปรับปรุง'/)
  assert.match(sidebar, /disabled=\{isDisabled\}/)
  assert.match(sidebar, /if \(isDisabled\) return/)
  assert.match(app, /isAdmin=\{roleCodes.includes\('admin'\)\}/)
})
