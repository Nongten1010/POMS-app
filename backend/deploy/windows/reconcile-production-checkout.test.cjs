'use strict';
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { reconcileCheckout, REVIEWED_FILES } = require('./reconcile-production-checkout.cjs');
const temporary = [];
const helper = 'backend/src/shared/services/factory-source-provinces.ts';
const changed = 'backend/src/config/env.ts';
function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function write(root, file, value) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), value);
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poms-source-reconcile-'));
  temporary.push(root);
  const remote = path.join(root, 'origin.git');
  const source = path.join(root, 'source');
  const repoRoot = path.join(root, 'production');
  const backupRoot = path.join(root, 'backups');
  fs.mkdirSync(source);
  git(root, 'init', '--bare', remote);
  git(source, 'init', '-b', 'main');
  git(source, 'config', 'user.name', 'Reconciliation fixture');
  git(source, 'config', 'user.email', 'fixture@example.invalid');
  git(source, 'config', 'commit.gpgsign', 'false');
  for (const file of REVIEWED_FILES.filter((file) => file !== helper))
    write(source, file, 'baseline\n');
  write(source, 'README.md', 'baseline\n');
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'baseline');
  git(source, 'remote', 'add', 'origin', remote);
  git(source, 'push', '-u', 'origin', 'main');
  git(root, 'clone', '--branch', 'main', remote, repoRoot);
  write(repoRoot, changed, 'existing production correction\n');
  write(repoRoot, helper, 'existing production helper\n');
  const expectedManifest = {
    head: git(repoRoot, 'rev-parse', 'HEAD'),
    trackedChanges: [changed],
    reviewedStatus: execFileSync(
      'git',
      ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...REVIEWED_FILES],
      { cwd: repoRoot, encoding: 'utf8' },
    )
      .split('\0')
      .filter(Boolean),
    untrackedSource: [helper],
    files: REVIEWED_FILES.map((file) => ({
      path: file,
      sha256: createHash('sha256')
        .update(fs.readFileSync(path.join(repoRoot, file)))
        .digest('hex'),
    })),
  };
  write(source, helper, 'existing production helper\n');
  write(source, changed, 'existing production correction\nnew feature\n');
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'reviewed release preserves production correction');
  git(source, 'push', 'origin', 'main');
  const targetSha = git(source, 'rev-parse', 'HEAD');
  return { repoRoot, backupRoot, expectedManifest, targetSha };
}
afterEach(() => {
  for (const folder of temporary.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

test('backs up and stashes reviewed tracked edits, preserves an untracked helper, then fast-forwards exactly', () => {
  const input = fixture();
  const result = reconcileCheckout(input);
  assert.equal(result.head, input.targetSha);
  assert.ok(result.stashSha);
  assert.equal(git(input.repoRoot, 'status', '--short'), '');
  assert.equal(
    fs.readFileSync(path.join(result.backupDirectory, 'source', changed), 'utf8'),
    'existing production correction\n',
  );
  assert.equal(
    fs.readFileSync(path.join(result.backupDirectory, 'moved-untracked', helper), 'utf8'),
    'existing production helper\n',
  );
  assert.equal(
    fs.readFileSync(path.join(input.repoRoot, helper), 'utf8'),
    'existing production helper\n',
  );
  assert.equal(
    fs.readFileSync(path.join(input.repoRoot, changed), 'utf8'),
    'existing production correction\nnew feature\n',
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(result.backupDirectory, 'reconciliation.json'), 'utf8'))
      .phase,
    'complete',
  );
});
test('rejects a changed source hash before stashing or moving any production source', () => {
  const input = fixture();
  write(input.repoRoot, helper, 'changed after audit\n');
  assert.throws(() => reconcileCheckout(input), /changed after the reviewed snapshot/);
  assert.equal(git(input.repoRoot, 'rev-parse', 'HEAD'), input.expectedManifest.head);
  assert.equal(fs.existsSync(input.backupRoot), false);
  assert.equal(fs.readFileSync(path.join(input.repoRoot, helper), 'utf8'), 'changed after audit\n');
});
test('rejects unrelated tracked edits without changing production', () => {
  const input = fixture();
  write(input.repoRoot, 'README.md', 'unreviewed\n');
  assert.throws(() => reconcileCheckout(input), /unreviewed tracked change/);
  assert.equal(git(input.repoRoot, 'rev-parse', 'HEAD'), input.expectedManifest.head);
  assert.equal(fs.existsSync(input.backupRoot), false);
});
test('audit workflow and reconciliation helper share the same explicit source whitelist', () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, '../../..', '.github/workflows/inspect-production-checkout.yml'),
    'utf8',
  );
  for (const file of REVIEWED_FILES) assert.ok(workflow.includes(`'${file}'`), file);
});
