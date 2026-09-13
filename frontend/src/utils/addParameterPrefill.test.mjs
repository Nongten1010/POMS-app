import assert from 'node:assert/strict'
import test from 'node:test'
import { getAddParameterGroups } from './addParameterPrefill.mjs'

test('additional-parameter defaults use live connected values, not old requested or pending values', () => {
  assert.deepEqual(getAddParameterGroups({
    eligibleParameters: ['CO (ppm)', 'NOx (ppm)', 'SO2 (ppm)'],
    connectedParameters: ['CO (ppm)'],
    requestedParameters: ['SO2 (ppm)'],
    pendingParameters: ['CO (ppm)'],
  }), {
    connectedParameters: ['CO (ppm)'],
    pendingParameters: ['NOx (ppm)', 'SO2 (ppm)'],
    requestedParameters: [],
  })
})

test('pending is eligible minus connected without excluding exemptions or requested additions', () => {
  assert.deepEqual(getAddParameterGroups({
    eligibleParameters: ['BOD (mg/l)', 'COD (mg/l)'],
    connectedParameters: ['BOD (mg/l)'],
    exemptedParameters: ['COD (mg/l)'],
    requestedParameters: ['BOD (mg/l)', 'COD (mg/l)'],
  }).pendingParameters, ['COD (mg/l)'])
})

test('connected values outside eligibility remain connected without preselecting a request', () => {
  const groups = getAddParameterGroups({ eligibleParameters: ['CO (ppm)'], connectedParameters: ['CO (%)'] })
  assert.deepEqual(groups.pendingParameters, ['CO (ppm)'])
  assert.deepEqual(groups.connectedParameters, ['CO (%)'])
  assert.deepEqual(groups.requestedParameters, [])
})

test('empty active channels and fully connected eligibility produce valid empty derived lists', () => {
  for (const connectedParameters of [[], null, undefined]) {
    const groups = getAddParameterGroups({ eligibleParameters: ['BOD (mg/l)'], connectedParameters, requestedParameters: ['OLD'] })
    assert.deepEqual(groups.connectedParameters, [])
    assert.deepEqual(groups.requestedParameters, [])
    assert.deepEqual(groups.pendingParameters, ['BOD (mg/l)'])
  }
  assert.deepEqual(getAddParameterGroups({ eligibleParameters: ['CO (ppm)'], connectedParameters: ['CO (ppm)'] }).pendingParameters, [])
  assert.deepEqual(getAddParameterGroups(null), { connectedParameters: [], pendingParameters: [], requestedParameters: [] })
})

test('parameter groups are copied, deduplicated, and retain unit distinctions without none sentinels', () => {
  const details = { eligibleParameters: ['CO (ppm)', 'CO (%)', 'ไม่มี', ''], connectedParameters: [' CO (ppm) ', 'CO (ppm)', null] }
  const groups = getAddParameterGroups(details)
  assert.deepEqual(groups.connectedParameters, ['CO (ppm)'])
  assert.deepEqual(groups.pendingParameters, ['CO (%)'])
  groups.requestedParameters.push('NOx (ppm)')
  assert.deepEqual(groups.connectedParameters, ['CO (ppm)'])
  assert.equal(details.connectedParameters.length, 3)
  assert.deepEqual(getAddParameterGroups({ connectedParameters: ['ไม่มี'] }).requestedParameters, [])
})
