import assert from 'node:assert/strict'
import test from 'node:test'
import { buildConnectionEnvironmentalAssessment, getEiaAssessmentValue, getEnvironmentalAssessmentValues } from './environmentalAssessment.mjs'

test('empty and legacy EIA selections display a dash and submit null without restoring defaults', () => {
  for (const value of [null, undefined, '', 'มี']) {
    assert.equal(getEiaAssessmentValue({ eia: value }), '')
  }
  const form = new FormData()
  form.set('eia', '')
  form.set('projectName', ' โครงการเดิม ')
  assert.deepEqual(buildConnectionEnvironmentalAssessment(form, { eia: 'มี EIA', eiaOther: 'เดิม' }), {
    eia: null, eiaOther: null, projectName: 'โครงการเดิม',
  })
})

test('project names remain independent of EIA and stale other details are cleared', () => {
  for (const eia of ['ไม่มี', 'มี IEE', 'มี EIA', 'มี EHIA']) {
    const form = new FormData()
    form.set('eia', eia)
    form.set('eiaOther', 'รายละเอียดเดิม')
    form.set('projectName', 'โครงการทดสอบ')
    assert.deepEqual(buildConnectionEnvironmentalAssessment(form), {
      eia, eiaOther: null, projectName: 'โครงการทดสอบ',
    })
  }
})

test('other EIA requires a description and limits both text fields to 500 characters', () => {
  const form = new FormData()
  form.set('eia', 'อื่นๆ')
  form.set('eiaOther', '  ')
  assert.throws(() => buildConnectionEnvironmentalAssessment(form), /กรุณาระบุ/)
  form.set('eiaOther', ' รายละเอียด ')
  assert.equal(buildConnectionEnvironmentalAssessment(form).eiaOther, 'รายละเอียด')
  for (const field of ['eiaOther', 'projectName']) {
    form.set(field, 'ก'.repeat(501))
    assert.throws(() => buildConnectionEnvironmentalAssessment(form), /500/)
    form.set(field, '')
    form.set('eiaOther', 'รายละเอียด')
  }
})

test('explicit null prefill values do not fall back to stale factory data', () => {
  assert.deepEqual(getEnvironmentalAssessmentValues(
    { eia: null, eiaOther: null, projectName: null },
    { eia: 'อื่นๆ', eiaOther: 'เดิม', projectName: 'เดิม' },
  ), { eia: null, eiaOther: null, projectName: null })
  assert.equal(getEnvironmentalAssessmentValues({}, { eiaOther: 'รายละเอียด' }).eiaOther, 'รายละเอียด')
})

test('read-only factory information preserves source values in measurement-point edit forms', () => {
  const factory = { eia: 'มี', eiaOther: null, projectName: 'เดิม' }
  assert.deepEqual(buildConnectionEnvironmentalAssessment(new FormData(), factory, { readOnly: true }), factory)
})
