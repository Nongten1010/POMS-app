import assert from 'node:assert/strict'
import test from 'node:test'
import { formatIndustrialEstate, getIndustrialEstateInfo } from './industrialEstate.mjs'

test('industrial-estate snapshots preserve explicit nulls instead of using current values', () => {
  const snapshot = { industrialEstateCode: null, industrialEstateName: null }
  const current = {
    industrialEstateCode: 'CURRENT',
    industrialEstateName: 'นิคมปัจจุบัน',
    industrialAreaType: 'INDUSTRIAL_ESTATE',
  }
  assert.deepEqual(getIndustrialEstateInfo(snapshot, current), {
    industrialEstateCode: null,
    industrialEstateName: null,
    industrialAreaType: 'OUTSIDE_INDUSTRIAL_ESTATE',
    industrialAreaTypeLabel: 'นอกนิคมอุตสาหกรรม',
  })
  assert.equal(getIndustrialEstateInfo(
    { industrialAreaTypeLabel: null },
    { industrialEstateName: 'นิคมจาก snapshot' },
  ).industrialEstateName, 'นิคมจาก snapshot')
})

test('industrial-estate display type depends on whether code or name is present', () => {
  assert.equal(getIndustrialEstateInfo({ industrialEstateName: 'นิคมทดสอบ' }).industrialAreaTypeLabel, 'ในนิคมอุตสาหกรรม')
  assert.equal(getIndustrialEstateInfo({
    industrialEstateCode: null,
    industrialEstateName: null,
    industrialAreaType: 'OUTSIDE_INDUSTRIAL_ESTATE',
  }).industrialAreaTypeLabel, 'นอกนิคมอุตสาหกรรม')
  assert.equal(getIndustrialEstateInfo({ industrialEstateCode: null, industrialEstateName: null }).industrialAreaTypeLabel, 'นอกนิคมอุตสาหกรรม')
  assert.equal(getIndustrialEstateInfo({
    industrialEstateCode: null,
    industrialEstateName: null,
    industrialAreaType: 'INDUSTRIAL_ESTATE',
  }).industrialAreaTypeLabel, 'นอกนิคมอุตสาหกรรม')
  assert.equal(getIndustrialEstateInfo({ unrelated: true }), null)
})

test('industrial-estate PDF display supports name, code and missing values', () => {
  assert.equal(formatIndustrialEstate({ industrialEstateCode: 'IEAT001', industrialEstateName: 'นิคมทดสอบ' }), 'นิคมทดสอบ (IEAT001)')
  assert.equal(formatIndustrialEstate({ industrialEstateCode: null, industrialEstateName: 'นิคมทดสอบ' }), 'นิคมทดสอบ')
  assert.equal(formatIndustrialEstate({ industrialEstateCode: 'IEAT001', industrialEstateName: null }), 'IEAT001')
  assert.equal(formatIndustrialEstate(null), '-')
})
