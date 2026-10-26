'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REVIEWED_FILES = Object.freeze([
  'backend/src/modules/api-docs/poms.openapi.ts',
  'backend/src/modules/device-connections/device-connections.repository.ts',
  'backend/src/modules/integrations/integration-device-configs.controller.ts',
  'backend/src/modules/integrations/integration-device-configs.repository.ts',
  'backend/src/modules/integrations/integration-device-configs.service.ts',
  'backend/src/db/migrations/0144_track_device_config_request_source.ts',
]);
const MIGRATION = REVIEWED_FILES[5];
const SHA = /^[a-f0-9]{40}$/i;
const HASH = /^[a-f0-9]{64}$/i;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function samePaths(left, right) {
  return (
    left.length === right.length && [...left].sort().join('\0') === [...right].sort().join('\0')
  );
}

function validateManifest(manifest) {
  assert(
    manifest &&
      typeof manifest === 'object' &&
      typeof manifest.head === 'string' &&
      SHA.test(manifest.head),
    'Invalid snapshot manifest.',
  );
  assert(
    Array.isArray(manifest.files) && manifest.files.length === REVIEWED_FILES.length,
    'Snapshot must contain exactly six reviewed files.',
  );
  assert(
    manifest.files.every(
      (entry) =>
        entry &&
        typeof entry.path === 'string' &&
        typeof entry.sha256 === 'string' &&
        HASH.test(entry.sha256),
    ),
    'Invalid snapshot file hashes.',
  );
  assert(
    samePaths(
      manifest.files.map((entry) => entry.path),
      REVIEWED_FILES,
    ),
    'Snapshot paths do not match the reviewed whitelist.',
  );
  assert(
    Array.isArray(manifest.trackedChanges) &&
      manifest.trackedChanges.every((file) => REVIEWED_FILES.includes(file)),
    'Snapshot contains an unexpected tracked path.',
  );
  assert(
    new Set(manifest.trackedChanges).size === manifest.trackedChanges.length,
    'Snapshot contains duplicate tracked paths.',
  );
  assert(
    Array.isArray(manifest.reviewedStatus) &&
      manifest.reviewedStatus.every((entry) => typeof entry === 'string'),
    'Invalid snapshot status.',
  );
}

function git(repoRoot, args, allowFailure = false) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
  });
  // Git output may contain authenticated remote URLs. Never include it in errors.
  assert(
    !result.error && (result.status === 0 || allowFailure),
    'Git reconciliation command failed.',
  );
  return { status: result.status, output: result.stdout || '' };
}

function lines(repoRoot, args) {
  return git(repoRoot, args).output.split('\0').filter(Boolean);
}

function trackedChanges(repoRoot) {
  return [
    ...new Set([
      ...lines(repoRoot, ['diff', '--name-only', '--no-renames', '-z', 'HEAD']),
      ...lines(repoRoot, ['diff', '--cached', '--name-only', '--no-renames', '-z']),
      ...lines(repoRoot, ['diff', '--name-only', '--no-renames', '-z']),
    ]),
  ];
}

function reviewedStatus(repoRoot) {
  return lines(repoRoot, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--',
    ...REVIEWED_FILES,
  ]);
}

function checkUnexpectedPaths(repoRoot) {
  const changed = trackedChanges(repoRoot);
  assert(
    changed.every((file) => REVIEWED_FILES.includes(file)),
    'Production contains an unreviewed tracked change.',
  );
  const untracked = lines(repoRoot, ['ls-files', '--others', '--exclude-standard', '-z']);
  assert(
    lines(repoRoot, ['diff', '--name-only', '--diff-filter=U', '-z']).length === 0,
    'Production has an unresolved merge.',
  );
  return { changed, untracked };
}

function fileHash(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function normalizedPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function inside(parent, child) {
  const relative = path.relative(normalizedPath(parent), normalizedPath(child));
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function canonicalFuturePath(value) {
  let existing = path.resolve(value);
  const missing = [];
  while (!fs.existsSync(existing)) {
    missing.unshift(path.basename(existing));
    const parent = path.dirname(existing);
    assert(parent !== existing, 'Backup parent does not exist.');
    existing = parent;
  }
  return path.join(fs.realpathSync(existing), ...missing);
}

function checkHashes(repoRoot, manifest) {
  for (const entry of manifest.files) {
    const file = path.join(repoRoot, entry.path);
    assert(
      fs.existsSync(file) && fs.lstatSync(file).isFile(),
      'A reviewed source file is missing or is not a regular file.',
    );
    assert(
      normalizedPath(fs.realpathSync(file)) === normalizedPath(file),
      'Reviewed source paths must not contain links.',
    );
    assert(
      fileHash(file) === entry.sha256.toLowerCase(),
      'Production source changed after the reviewed snapshot.',
    );
  }
}

function reconcileCheckout({ repoRoot, expectedManifest, targetSha, backupRoot }) {
  validateManifest(expectedManifest);
  assert(
    typeof targetSha === 'string' && SHA.test(targetSha),
    'Target must be a full Git commit SHA.',
  );
  assert(
    typeof repoRoot === 'string' && typeof backupRoot === 'string' && backupRoot.length > 0,
    'Explicit checkout and backup paths are required.',
  );
  repoRoot = fs.realpathSync(path.resolve(repoRoot));
  backupRoot = canonicalFuturePath(backupRoot);
  assert(!inside(repoRoot, backupRoot), 'Backups must be outside the production checkout.');
  assert(
    process.platform !== 'win32' || !inside('C:\\sites\\poms', backupRoot),
    'Backups must be outside the production web root.',
  );
  targetSha = targetSha.toLowerCase();
  assert(
    normalizedPath(git(repoRoot, ['rev-parse', '--show-toplevel']).output.trim()) ===
      normalizedPath(repoRoot),
    'The production path must be the repository root.',
  );
  const branch = git(repoRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD']).output.trim();
  assert(branch === 'main', 'Production checkout must be on main.');
  const head = git(repoRoot, ['rev-parse', 'HEAD']).output.trim();
  assert(
    head === expectedManifest.head.toLowerCase() || head === targetSha,
    'Production HEAD changed after the reviewed snapshot.',
  );
  const state = checkUnexpectedPaths(repoRoot);

  // Fetch changes only Git metadata; the caller has already pushed this target.
  git(repoRoot, ['fetch', '--no-tags', 'origin', 'main']);
  assert(
    git(repoRoot, ['rev-parse', 'refs/remotes/origin/main']).output.trim() === targetSha,
    'Target is not the fetched origin/main commit.',
  );
  assert(
    git(repoRoot, ['merge-base', '--is-ancestor', expectedManifest.head, targetSha], true)
      .status === 0,
    'Target is not a fast-forward from the reviewed HEAD.',
  );
  const targetFiles = lines(repoRoot, ['ls-tree', '-r', '--name-only', '-z', targetSha]);
  assert(
    REVIEWED_FILES.every((file) => targetFiles.includes(file)),
    'The pushed target does not contain all reviewed source paths.',
  );
  assert(
    state.untracked.every(
      (file) =>
        file === MIGRATION ||
        !targetFiles.some(
          (target) =>
            target === file || target.startsWith(`${file}/`) || file.startsWith(`${target}/`),
        ),
    ),
    'An unreviewed untracked file would be overwritten by the release.',
  );
  if (head === targetSha) {
    assert(state.changed.length === 0, 'Target checkout is not clean.');
    return { backupDirectory: null, stashSha: null, head };
  }

  assert(
    samePaths(state.changed, expectedManifest.trackedChanges),
    'Tracked changes no longer match the reviewed snapshot.',
  );
  assert(
    samePaths(reviewedStatus(repoRoot), expectedManifest.reviewedStatus),
    'The reviewed index or working tree status changed after the snapshot.',
  );
  checkHashes(repoRoot, expectedManifest);
  const tracked = lines(repoRoot, ['ls-files', '-z', '--', ...REVIEWED_FILES]);
  assert(
    tracked.includes(REVIEWED_FILES[0]) && tracked.every((file) => REVIEWED_FILES.includes(file)),
    'Reviewed tracked source is unavailable.',
  );
  assert(
    !state.untracked.includes(MIGRATION) || !tracked.includes(MIGRATION),
    'Migration tracking state is ambiguous.',
  );

  const stamp = new Date().toISOString().replace(/[^a-z0-9]/gi, '');
  const backupDirectory = path.join(backupRoot, `${stamp}-${randomBytes(8).toString('hex')}`);
  fs.mkdirSync(backupDirectory, { recursive: true });
  for (const entry of expectedManifest.files) {
    const target = path.join(backupDirectory, 'source', entry.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, entry.path), target, fs.constants.COPYFILE_EXCL);
    assert(fileHash(target) === entry.sha256.toLowerCase(), 'Source backup verification failed.');
  }
  const patchFile = path.join(backupDirectory, 'tracked-server-changes.patch');
  git(repoRoot, ['diff', '--binary', `--output=${patchFile}`, 'HEAD', '--', ...REVIEWED_FILES]);
  fs.writeFileSync(
    path.join(backupDirectory, 'manifest.json'),
    `${JSON.stringify(expectedManifest, null, 2)}\n`,
    { flag: 'wx' },
  );
  const metadata = { originalHead: head, targetSha, stashSha: null, phase: 'backed-up' };
  const save = () =>
    fs.writeFileSync(
      path.join(backupDirectory, 'reconciliation.json'),
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
  save();

  // Recheck immediately before the first checkout mutation. Keep every backup on failure.
  checkHashes(repoRoot, expectedManifest);
  const current = checkUnexpectedPaths(repoRoot);
  assert(
    git(repoRoot, ['rev-parse', 'HEAD']).output.trim() === head &&
      git(repoRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD']).output.trim() === 'main',
    'Production checkout changed while creating the backup.',
  );
  assert(
    samePaths(current.changed, state.changed) && samePaths(current.untracked, state.untracked),
    'Production changed while creating the backup.',
  );
  assert(
    samePaths(reviewedStatus(repoRoot), expectedManifest.reviewedStatus),
    'The reviewed index changed while creating the backup.',
  );
  if (state.changed.length > 0) {
    const previousStash = git(
      repoRoot,
      ['rev-parse', '--verify', 'refs/stash'],
      true,
    ).output.trim();
    git(repoRoot, [
      '-c',
      'user.name=POMS source backup',
      '-c',
      'user.email=source-backup@example.invalid',
      'stash',
      'push',
      '-m',
      'poms-reviewed-production-source-backup',
      '--',
      ...tracked,
    ]);
    metadata.stashSha = git(repoRoot, ['rev-parse', '--verify', 'refs/stash']).output.trim();
    assert(
      SHA.test(metadata.stashSha) && metadata.stashSha !== previousStash,
      'Reviewed source stash was not created.',
    );
    metadata.phase = 'stashed';
    save();
  }
  if (state.untracked.includes(MIGRATION)) {
    const moved = path.join(backupDirectory, 'moved-untracked', MIGRATION);
    fs.mkdirSync(path.dirname(moved), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, MIGRATION), moved, fs.constants.COPYFILE_EXCL);
    const originalHash = expectedManifest.files
      .find((entry) => entry.path === MIGRATION)
      .sha256.toLowerCase();
    assert(
      fileHash(moved) === originalHash && fileHash(path.join(repoRoot, MIGRATION)) === originalHash,
      'Migration backup verification failed.',
    );
    fs.unlinkSync(path.join(repoRoot, MIGRATION));
    metadata.phase = 'untracked-migration-preserved';
    save();
  }
  assert(
    trackedChanges(repoRoot).length === 0,
    'Checkout did not become clean after preserving reviewed changes.',
  );
  git(repoRoot, ['merge', '--ff-only', targetSha]);
  const finalHead = git(repoRoot, ['rev-parse', 'HEAD']).output.trim();
  assert(
    finalHead === targetSha && trackedChanges(repoRoot).length === 0,
    'Checkout synchronization did not finish cleanly.',
  );
  metadata.phase = 'complete';
  save();
  return { backupDirectory, stashSha: metadata.stashSha, head: finalHead };
}

module.exports = { reconcileCheckout };

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const supported = new Set(['--repo', '--manifest', '--target', '--backup-root']);
    const options = {};
    for (let index = 0; index < args.length; index += 2) {
      assert(
        supported.has(args[index]) && args[index + 1] && !options[args[index]],
        'Invalid reconciliation arguments.',
      );
      options[args[index]] = args[index + 1];
    }
    assert(
      Object.keys(options).length === supported.size,
      'All reconciliation arguments are required.',
    );
    assert(
      !/^\.env(?:\.|$)/i.test(path.basename(options['--manifest'])),
      'An environment file cannot be used as a source manifest.',
    );
    const expectedManifest = JSON.parse(
      fs.readFileSync(options['--manifest'], 'utf8').replace(/^\uFEFF/, ''),
    );
    const result = reconcileCheckout({
      repoRoot: options['--repo'],
      expectedManifest,
      targetSha: options['--target'],
      backupRoot: options['--backup-root'],
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `Production reconciliation stopped: ${error instanceof Error ? error.message : 'Unknown failure.'}\n`,
    );
    process.exitCode = 1;
  }
}
