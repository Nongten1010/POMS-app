import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEligibleFactoryAddRequestDraft } from './eligibleFactoryAddRequest.mjs'

const required = { factoryId: 'F000123', reason: 'ขอเพิ่มโรงงาน' }

test('eligible factory intent sends exact API contact fields with trimmed strings', () => {
  assert.deepEqual(buildEligibleFactoryAddRequestDraft({
    factoryId: ' F000123 ', reason: ' ขอเพิ่มโรงงาน ',
    contactName: ' สมชาย ใจดี ', contactPhone: ' 081-234-5678 ',
  }), {
    payload: { ...required, contactName: 'สมชาย ใจดี', contactPhone: '081-234-5678' },
    errors: {},
  })
})

test('both contacts are optional independently and empty values become null', () => {
  for (const value of [undefined, null, '', ' \t ']) {
    const { payload, errors } = buildEligibleFactoryAddRequestDraft({ ...required, contactName: value, contactPhone: value })
    assert.deepEqual(errors, {})
    assert.equal(payload.contactName, null)
    assert.equal(payload.contactPhone, null)
  }
  for (const field of ['contactName', 'contactPhone']) {
    const { payload, errors } = buildEligibleFactoryAddRequestDraft({ ...required, [field]: 'test' })
    assert.deepEqual(errors, {})
    assert.equal(payload[field], 'test')
    assert.equal(payload[field === 'contactName' ? 'contactPhone' : 'contactName'], null)
  }
})

test('contact limits apply after trim, accept boundaries and reject overlength values', () => {
  for (const [field, max] of [['contactName', 255], ['contactPhone', 64]]) {
    const valid = buildEligibleFactoryAddRequestDraft({ ...required, [field]: ` ${'ก'.repeat(max)} ` })
    assert.deepEqual(valid.errors, {})
    assert.equal(valid.payload[field].length, max)
    const invalid = buildEligibleFactoryAddRequestDraft({ ...required, [field]: 'ก'.repeat(max + 1) })
    assert.ok(invalid.errors[field])
  }
})

test('phone keeps leading zero, punctuation, and internal spaces without format validation', () => {
  for (const phone of ['0812345678', '+66 81-234-5678', '02  123 4567 ต่อ 8', 'เบอร์โทรภายใน']) {
    const { payload, errors } = buildEligibleFactoryAddRequestDraft({ ...required, contactPhone: phone })
    assert.deepEqual(errors, {})
    assert.equal(payload.contactPhone, phone)
    assert.equal(typeof payload.contactPhone, 'string')
  }
})

test('invalid field types and required field lengths are rejected before sending', () => {
  for (const field of ['factoryId', 'reason', 'contactName', 'contactPhone']) {
    for (const value of [123, false, {}, []]) {
      assert.ok(buildEligibleFactoryAddRequestDraft({ ...required, [field]: value }).errors[field])
    }
  }
  for (const [field, max] of [['factoryId', 64], ['reason', 1000]]) {
    assert.ok(buildEligibleFactoryAddRequestDraft({ ...required, [field]: ' ' }).errors[field])
    assert.ok(buildEligibleFactoryAddRequestDraft({ ...required, [field]: 'a'.repeat(max + 1) }).errors[field])
    assert.deepEqual(buildEligibleFactoryAddRequestDraft({ ...required, [field]: 'a'.repeat(max) }).errors, {})
  }
})
