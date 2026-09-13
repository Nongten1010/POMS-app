import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

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
        if (id.endsWith('/src/pages/ConnectionRequestPage.jsx')) {
          return `${code}\nexport { validateParameterGroups, buildMeasurementPointRequestBody, syncInstrumentRowsWithRequestedParameters, getParameterFormDefaultsFromPayload, MeasurementInstrumentSection };`
        }
      },
    }],
  })
  try {
    const {
      RequestFormBottomSheet, validateParameterGroups, buildMeasurementPointRequestBody,
      syncInstrumentRowsWithRequestedParameters, getParameterFormDefaultsFromPayload,
      MeasurementInstrumentSection,
    } = await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')

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
        for (const name of ['connectedParameters', 'pendingParameters']) {
          assert.ok(fieldMarkup(html, name).includes('Mui-readOnly'))
        }
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
        for (const isOperator of [true, false]) {
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
          }
          const editByRole = render('edit', { isOperator })
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
        assert.deepEqual(point.details.pendingParameters, [additional])
        assert.deepEqual(point.details.requestedParameters, [additional])
        assert.deepEqual(point.measurementInstruments.parameters.map((item) => item.parameter), [additional])
        const standard = buildMeasurementPointRequestBody({}, systemType, formData, [], instruments).measurementPoints[0]
        assert.deepEqual(standard.details.connectedParameters, ['TAMPERED'])
        assert.deepEqual(standard.details.pendingParameters, ['STALE'])
        assert.deepEqual(standard.measurementInstruments.parameters.map((item) => item.parameter), [connected, additional])
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
