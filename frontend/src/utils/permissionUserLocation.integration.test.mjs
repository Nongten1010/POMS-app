import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

function form(values = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries({
    fullName: 'ผู้ใช้งาน ทดสอบ', username: 'test_user', password: 'test-only-password',
    status: 'active', ...values,
  })) data.set(key, value)
  return data
}

test('permission management account location fields and payloads', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-user-location-'))
  const server = await createServer({
    cacheDir, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    plugins: [{ name: 'user-location-test-exports', enforce: 'pre', transform(code, id) {
      if (id.endsWith('/src/pages/PermissionManagementPage.jsx')) {
        return `${code}\nexport { getUserLocationField, validateUserLocationFields, buildUserPermissionPayload, mapApiUser, UserLocationField };`
      }
    } }],
  })
  try {
    const api = await server.ssrLoadModule('/src/pages/PermissionManagementPage.jsx')
    await t.test('only regional roles and provincial office require a selectable location', () => {
      for (const role of ['monitoring_5_centers', 'center_director']) {
        const field = api.getUserLocationField(role)
        assert.equal(field.name, 'regionName')
        assert.ok(field.options.some((option) => option.value === 'ภาคตะวันตก'))
        assert.ok(field.options.every((option) => option.value && option.value !== 'all'))
      }
      const province = api.getUserLocationField('provincial_office')
      assert.equal(province.name, 'provinceName')
      assert.equal(province.options.length, 77)
      assert.ok(province.options.every((option) => option.value && option.value !== 'all'))
      for (const role of ['monitoring_kpm', 'kpm_director', 'admin', 'diw_central', 'erc_office', 'industrial_estate']) {
        assert.equal(api.getUserLocationField(role), null)
      }
    })
    await t.test('empty, all, unknown and multiple locations cannot reach the create or edit payload', () => {
      for (const roleCode of ['monitoring_5_centers', 'center_director', 'provincial_office']) {
        const field = api.getUserLocationField(roleCode)
        for (const value of ['', 'all', 'UNKNOWN', 'ภาคเหนือ,ภาคใต้']) {
          const data = form({ roleCode, [field.name]: value })
          assert.ok(api.validateUserLocationFields(data, roleCode)[field.name])
          for (const mode of ['add', 'edit']) {
            assert.throws(() => api.buildUserPermissionPayload(data, { mode, user: { roleCode } }), /กรุณาเลือก/)
          }
        }
      }
    })
    await t.test('create sends one assigned location under user, leaving role-default permissions intact', () => {
      for (const [roleCode, field, value] of [
        ['monitoring_5_centers', 'regionName', 'ภาคตะวันตก'],
        ['center_director', 'regionName', 'ภาคใต้'],
        ['provincial_office', 'provinceName', 'ราชบุรี'],
      ]) {
        const payload = api.buildUserPermissionPayload(form({ roleCode, [field]: value }), { mode: 'add' })
        assert.equal(payload.user[field], value)
        assert.deepEqual(payload.user.roleCodes, [roleCode])
        assert.deepEqual(payload.permissions, {})
        assert.equal(payload.user[field === 'regionName' ? 'provinceName' : 'regionName'], undefined)
        assert.equal(payload.user.estateCode, undefined)
      }
    })
    await t.test('edit prefills canonical account assignments without deriving them from menu permissions', () => {
      const permissions = { dashboard: { data: 'IN_REGION', region: 'ภาคเหนือ' } }
      const mapped = api.mapApiUser({
        id: 8, roleCodes: ['monitoring_5_centers'], regionalAccess: { regions: ['ภาคตะวันตก'] },
        provinceName: 'ราชบุรี', isActive: true,
      }, permissions)
      assert.equal(mapped.regionName, 'ภาคตะวันตก')
      assert.equal(mapped.provinceName, 'ราชบุรี')
      assert.equal(api.mapApiUser({ regionalAccess: null }, permissions).regionName, '')
      assert.equal(api.mapApiUser({ regionalAccess: { regions: ['ภาคเหนือ', 'ภาคใต้'] } }).regionName, '')
      const payload = api.buildUserPermissionPayload(form({ roleCode: mapped.roleCode, regionName: mapped.regionName }), { mode: 'edit', user: mapped })
      assert.equal(payload.user.regionName, 'ภาคตะวันตก')
      assert.equal(payload.permissions.dashboard.region, 'ภาคเหนือ')
    })
    await t.test('role changes clear the previous assignment and ignore hidden stale fields', () => {
      const toProvince = api.buildUserPermissionPayload(form({
        roleCode: 'provincial_office', regionName: 'ภาคตะวันตก', provinceName: 'ราชบุรี',
      }), { mode: 'edit', user: { roleCode: 'monitoring_5_centers' } })
      assert.equal(toProvince.user.regionName, null)
      assert.equal(toProvince.user.provinceName, 'ราชบุรี')
      const toRegion = api.buildUserPermissionPayload(form({
        roleCode: 'center_director', regionName: 'ภาคตะวันตก', provinceName: 'ราชบุรี',
      }), { mode: 'edit', user: { roleCode: 'provincial_office' } })
      assert.equal(toRegion.user.provinceName, null)
      assert.equal(toRegion.user.regionName, 'ภาคตะวันตก')
      for (const roleCode of ['diw_central', 'monitoring_kpm', 'industrial_estate']) {
        const payload = api.buildUserPermissionPayload(form({ roleCode, regionName: 'ภาคใต้', provinceName: 'ราชบุรี' }), {
          mode: 'edit', user: { roleCode: 'center_director' },
        })
        assert.equal(payload.user.regionName, null)
        assert.equal(payload.user.provinceName, undefined)
        assert.equal(payload.user.estateCode, undefined)
      }
    })
    await t.test('API accounts can update assignment without changing identity or password', () => {
      const user = { accountType: 'api', username: 'idp_user', fullName: 'ชื่อจากระบบภายนอก', roleCode: 'monitoring_5_centers' }
      const payload = api.buildUserPermissionPayload(form({ roleCode: 'monitoring_5_centers', regionName: 'ภาคตะวันออก' }), { mode: 'edit', user })
      assert.equal(payload.user.regionName, 'ภาคตะวันออก')
      assert.equal(payload.user.username, user.username)
      assert.equal(payload.user.fullName, user.fullName)
      assert.equal(payload.user.password, undefined)
      assert.equal(payload.user.department, undefined)
    })
    await t.test('UI renders the correct required dropdown, current value and inline validation', () => {
      for (const [roleCode, name, value] of [
        ['monitoring_5_centers', 'regionName', 'ภาคตะวันตก'],
        ['center_director', 'regionName', 'ภาคใต้'],
        ['provincial_office', 'provinceName', 'ราชบุรี'],
      ]) {
        const props = { roleCode, values: { [name]: value }, onChange: () => {} }
        const html = renderToStaticMarkup(createElement(api.UserLocationField, props))
        assert.ok(html.includes(`name="${name}"`))
        assert.ok(html.includes(`value="${value}"`))
        assert.ok(html.includes('aria-required="true"'))
        const errorHtml = renderToStaticMarkup(createElement(api.UserLocationField, {
          ...props, values: { [name]: 'all' }, errors: { [name]: 'กรุณาเลือกพื้นที่' },
        }))
        assert.ok(errorHtml.includes('กรุณาเลือกพื้นที่'))
        assert.ok(errorHtml.includes('aria-invalid="true"'))
        assert.ok(!errorHtml.includes('value="all"'))
      }
      for (const roleCode of ['monitoring_kpm', 'kpm_director', 'industrial_estate', 'admin']) {
        assert.equal(renderToStaticMarkup(createElement(api.UserLocationField, { roleCode, values: {} })), '')
      }
    })
  } finally {
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
