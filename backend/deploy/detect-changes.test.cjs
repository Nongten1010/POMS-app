'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyChanges } = require('./detect-changes.cjs');
const push = { eventName: 'push' };

test('backend application and migration changes require validated backend deployment', () => {
  for (const name of [
    'backend/src/app.ts',
    'backend/src/db/migrations/0150_test.ts',
    'backend/package-lock.json',
  ]) {
    const result = classifyChanges([name], push);
    assert.equal(result.backend_changed, true);
    assert.equal(result.backend_ci_required, true);
    assert.equal(result.frontend_changed, false);
  }
});

test('test-only edits run CI without restarting production', () => {
  const result = classifyChanges(['backend/tests/unit/example.test.ts'], push);
  assert.equal(result.backend_changed, false);
  assert.equal(result.backend_ci_required, true);
});

test('documentation-only edits do not build or deploy applications', () => {
  const result = classifyChanges(
    ['docs/backend/guides/production-git-delivery.md', 'backend/README.md'],
    push,
  );
  assert.equal(result.backend_ci_required, false);
  assert.equal(result.backend_changed, false);
  assert.equal(result.frontend_changed, false);
});

test('the deployment workflow and its helpers validate their own release path', () => {
  for (const name of ['.github/workflows/deploy.yml', 'backend/deploy/release-artifact.cjs']) {
    const result = classifyChanges([name], push);
    assert.equal(result.backend_ci_required, true);
    assert.equal(result.backend_changed, true);
  }
});

test('manual deployments select only the requested application', () => {
  for (const deployTarget of ['frontend', 'backend']) {
    const result = classifyChanges([], { eventName: 'workflow_dispatch', deployTarget });
    assert.equal(result.frontend_changed, deployTarget === 'frontend');
    assert.equal(result.backend_changed, deployTarget === 'backend');
    assert.equal(result.backend_ci_required, deployTarget === 'backend');
  }
});

test('frontend changes and explicit frontend pushes preserve their existing behavior', () => {
  assert.equal(classifyChanges(['frontend/package-lock.json'], push).frontend_deps_changed, true);
  assert.equal(classifyChanges([], { ...push, forceFrontend: true }).frontend_changed, true);
  assert.equal(classifyChanges(['frontend/src/App.jsx'], push).backend_ci_required, false);
});
