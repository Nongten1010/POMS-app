'use strict';

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRelease, verifyRelease } = require('./release-artifact.cjs');

const sha = 'a'.repeat(40);
const temporary = [];
afterEach(() => {
  for (const folder of temporary.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poms-release-test-'));
  temporary.push(root);
  const backend = path.join(root, 'backend');
  const release = path.join(root, 'release');
  fs.mkdirSync(path.join(backend, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(backend, 'dist/server.js'), 'module.exports = {};');
  fs.writeFileSync(path.join(backend, 'package.json'), '{}');
  fs.writeFileSync(path.join(backend, 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(backend, '.env'), 'private configuration');
  fs.mkdirSync(path.join(backend, 'node_modules'));
  fs.writeFileSync(path.join(backend, 'node_modules/native.node'), 'platform binary');
  return { root, backend, release };
}

test('only deploys compiled output and package metadata from the verified commit', () => {
  const { backend, release } = fixture();
  const manifest = createRelease(backend, release, sha);
  assert.deepEqual(Object.keys(manifest.files), [
    'dist/server.js',
    'package-lock.json',
    'package.json',
  ]);
  assert.equal(fs.existsSync(path.join(release, '.env')), false);
  assert.equal(fs.existsSync(path.join(release, 'node_modules')), false);
  assert.equal(verifyRelease(release, sha).sha, sha);
});

test('rejects a different commit before installation', () => {
  const { backend, release } = fixture();
  createRelease(backend, release, sha);
  assert.throws(() => verifyRelease(release, 'b'.repeat(40)), /commit does not match/);
});

test('rejects modified compiled output and lockfiles', () => {
  for (const name of ['dist/server.js', 'package-lock.json']) {
    const { backend, release } = fixture();
    createRelease(backend, release, sha);
    fs.appendFileSync(path.join(release, name), 'changed');
    assert.throws(() => verifyRelease(release, sha), /checksum does not match/);
  }
});

test('rejects missing or unexpected files including environment files', () => {
  for (const name of ['dist/server.js', '.env']) {
    const { backend, release } = fixture();
    createRelease(backend, release, sha);
    if (name === '.env') fs.writeFileSync(path.join(release, name), 'unexpected');
    else fs.unlinkSync(path.join(release, name));
    assert.throws(() => verifyRelease(release, sha), /file list does not match/);
  }
});

test('rejects traversal paths even when listed in the manifest', () => {
  const { backend, release, root } = fixture();
  createRelease(backend, release, sha);
  const file = path.join(release, 'release-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file));
  manifest.files['../outside'] = '0'.repeat(64);
  fs.writeFileSync(path.join(root, 'outside'), 'outside');
  fs.writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => verifyRelease(release, sha));
});

test('rejects accidental environment files in compiled output', () => {
  const { backend, release } = fixture();
  fs.writeFileSync(path.join(backend, 'dist/.env'), 'unexpected');
  assert.throws(() => createRelease(backend, release, sha), /Unsafe release path/);
});

test(
  'rejects artifact symlinks before reading their contents',
  { skip: process.platform === 'win32' },
  () => {
    const { backend, release, root } = fixture();
    createRelease(backend, release, sha);
    fs.unlinkSync(path.join(release, 'release-manifest.json'));
    const target = path.join(root, 'outside.json');
    fs.writeFileSync(target, '{}');
    fs.symlinkSync(target, path.join(release, 'release-manifest.json'));
    assert.throws(() => verifyRelease(release, sha), /symlink is not allowed/);
  },
);

test('does not overwrite a release directory and requires a complete commit SHA', () => {
  const { backend, release } = fixture();
  assert.throws(() => createRelease(backend, release, 'short'), /full commit SHA/);
  createRelease(backend, release, sha);
  assert.throws(() => createRelease(backend, release, sha), /output must be empty/);
});
