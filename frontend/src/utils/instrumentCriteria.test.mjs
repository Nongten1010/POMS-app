import test from 'node:test'
import assert from 'node:assert/strict'

import { deriveCriteriaRows, isCriteriaInputValid } from './instrumentCriteria.mjs'

test('derives the normal, warning, and critical ranges from 80% of standard value', () => {
  assert.deepEqual(deriveCriteriaRows('100'), [
    { level: 'normal', min: '0', max: '80' },
    { level: 'warning', min: '80', max: '100' },
    { level: 'critical', min: '100', max: '' },
  ])
})

test('derives stable decimal boundaries', () => {
  assert.deepEqual(deriveCriteriaRows('0.1'), [
    { level: 'normal', min: '0', max: '0.08' },
    { level: 'warning', min: '0.08', max: '0.1' },
    { level: 'critical', min: '0.1', max: '' },
  ])
})

test('returns no derived ranges for empty, non-finite, zero, negative, or subnormal standards', () => {
  for (const value of ['', 'abc', 'Infinity', '0', '-1', '5e-324']) {
    assert.equal(deriveCriteriaRows(value), null)
  }
})

test('allows disabled criteria and blocks enabled criteria until a positive standard is present', () => {
  assert.equal(isCriteriaInputValid({ enabled: false, standardValue: '' }), true)
  assert.equal(isCriteriaInputValid({ enabled: true, standardValue: '' }), false)
  assert.equal(isCriteriaInputValid({ enabled: true, standardValue: '0' }), false)
  assert.equal(isCriteriaInputValid({ enabled: true, standardValue: '100' }), true)
})
