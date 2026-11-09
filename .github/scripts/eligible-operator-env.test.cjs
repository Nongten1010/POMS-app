'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { patch } = require('./eligible-operator-env.cjs');
test('changes only fixed feature settings and preserves unrelated lines', () => {
  const source = '# retained\r\nDB_PASSWORD="synthetic-test-only"\r\nELIGIBLE_OPERATOR_ACCESS_ENABLED=false\r\n';
  const result = patch(source, 'backend');
  assert.ok(result.startsWith('# retained\r\nDB_PASSWORD="synthetic-test-only"\r\n'));
  assert.match(result, /ELIGIBLE_OPERATOR_ACCESS_ENABLED=true\r\n/);
  assert.match(result, /FACTORY_STATUS_SYNC_HOUR=2\r\n/);
  assert.equal(patch(result, 'backend'), result);
});
test('preserves BOM, replaces exported flags, and rejects duplicate definitions', () => {
  assert.match(patch('\uFEFFexport VITE_ELIGIBLE_OPERATOR_ACCESS_ENABLED="false"', 'frontend'), /^\uFEFFVITE_ELIGIBLE_OPERATOR_ACCESS_ENABLED=true$/);
  assert.throws(() => patch('VITE_ELIGIBLE_OPERATOR_ACCESS_ENABLED=false\nexport VITE_ELIGIBLE_OPERATOR_ACCESS_ENABLED=true', 'frontend'), /Duplicate/);
  assert.throws(() => patch('', 'unrestricted'), /Unsupported/);
});
test('disables both backend switches without altering schedule or other configuration', () => {
  const result = patch(patch('UNCHANGED=yes\n', 'backend'), 'disable-backend');
  assert.match(result, /ELIGIBLE_OPERATOR_ACCESS_ENABLED=false/);
  assert.match(result, /FACTORY_STATUS_SYNC_ENABLED=false/);
  assert.match(result, /FACTORY_STATUS_SYNC_HOUR=2/);
  assert.ok(result.startsWith('UNCHANGED=yes\n'));
});
