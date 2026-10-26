import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';

interface Manifest {
  head: string;
  trackedChanges: string[];
  reviewedStatus: string[];
  files: Array<{ path: string; sha256: string }>;
}
interface ReconciliationResult {
  backupDirectory: string | null;
  stashSha: string | null;
  head: string;
}
const loadCommonJs = createRequire(__filename);
const { reconcileCheckout } = loadCommonJs(
  '../../deploy/windows/reconcile-production-checkout.cjs',
) as {
  reconcileCheckout(input: {
    repoRoot: string;
    expectedManifest: Manifest;
    targetSha: string;
    backupRoot: string;
  }): ReconciliationResult;
};

const paths = [
  'backend/src/modules/api-docs/poms.openapi.ts',
  'backend/src/modules/device-connections/device-connections.repository.ts',
  'backend/src/modules/integrations/integration-device-configs.controller.ts',
  'backend/src/modules/integrations/integration-device-configs.repository.ts',
  'backend/src/modules/integrations/integration-device-configs.service.ts',
  'backend/src/db/migrations/0144_track_device_config_request_source.ts',
];
const temporary: string[] = [];

function git(repo: string, ...args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
  });
  if (result.status !== 0) throw new Error('Synthetic Git fixture command failed');
  return result.stdout.trim();
}

function put(repo: string, file: string, content: string): void {
  const target = path.join(repo, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'poms-reconcile-'));
  temporary.push(root);
  const remote = path.join(root, 'remote.git');
  const seed = path.join(root, 'seed');
  const repoRoot = path.join(root, 'production');
  const backupRoot = path.join(root, 'backups');
  mkdirSync(seed);
  git(root, 'init', '--bare', '--initial-branch=main', remote);
  git(seed, 'init', '--initial-branch=main');
  git(seed, 'config', 'user.name', 'Synthetic Git Test');
  git(seed, 'config', 'user.email', 'test@example.invalid');
  git(seed, 'config', 'core.autocrlf', 'false');
  git(seed, 'config', 'core.eol', 'lf');
  put(seed, '.gitignore', '.env\ndist/\n');
  put(seed, 'README.md', 'Unrelated tracked content\n');
  paths.slice(0, 5).forEach((file, index) => put(seed, file, `base source ${index}\n`));
  git(seed, 'add', '.');
  git(seed, '-c', 'commit.gpgsign=false', 'commit', '-m', 'Synthetic base');
  git(seed, 'remote', 'add', 'origin', remote);
  git(seed, 'push', 'origin', 'main');
  git(
    root,
    'clone',
    '--config',
    'core.autocrlf=false',
    '--config',
    'core.eol=lf',
    remote,
    repoRoot,
  );
  const head = git(repoRoot, 'rev-parse', 'HEAD');
  paths.forEach((file, index) => put(seed, file, `approved Git source ${index}\n`));
  put(seed, 'backend/src/only-in-target.ts', 'New source in the approved release\n');
  git(seed, 'add', '.');
  git(seed, '-c', 'commit.gpgsign=false', 'commit', '-m', 'Synthetic approved release');
  git(seed, 'push', 'origin', 'main');
  const targetSha = git(seed, 'rev-parse', 'HEAD');
  paths.forEach((file, index) => put(repoRoot, file, `reviewed server source ${index}\n`));
  put(repoRoot, '.env', 'SYNTHETIC_FIXTURE_ONLY=true\n');
  put(repoRoot, 'dist/old-runtime.txt', 'Existing runtime stays unchanged\n');
  put(repoRoot, 'backend/DEPLOYED_SHA.txt', 'Untracked deployment marker stays unchanged\n');
  const expectedManifest: Manifest = {
    head,
    trackedChanges: paths.slice(0, 5),
    reviewedStatus: paths.map((file, index) => `${index === 5 ? '??' : ' M'} ${file}`),
    files: paths.map((file) => ({
      path: file,
      sha256: createHash('sha256')
        .update(readFileSync(path.join(repoRoot, file)))
        .digest('hex'),
    })),
  };
  return { repoRoot, expectedManifest, targetSha, backupRoot, head };
}

afterEach(() =>
  temporary.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })),
);

describe('production checkout reconciliation', () => {
  it('backs up the reviewed source, stashes only tracked changes, and fast-forwards once', () => {
    const input = fixture();
    const result = reconcileCheckout(input);
    expect(result.head).toBe(input.targetSha);
    expect(result.stashSha).toMatch(/^[a-f0-9]{40}$/);
    expect(result.backupDirectory).not.toBeNull();
    if (result.backupDirectory === null || result.stashSha === null)
      throw new Error('Expected a new source backup and stash');
    const backup = result.backupDirectory;
    for (const entry of input.expectedManifest.files) {
      const copied = readFileSync(path.join(backup, 'source', entry.path));
      expect(createHash('sha256').update(copied).digest('hex')).toBe(entry.sha256);
    }
    expect(readFileSync(path.join(backup, 'manifest.json'), 'utf8')).toContain(input.head);
    expect(readFileSync(path.join(backup, 'tracked-server-changes.patch'), 'utf8')).toContain(
      paths[0],
    );
    expect(existsSync(path.join(backup, 'source', '.env'))).toBe(false);
    expect(readFileSync(path.join(input.repoRoot, '.env'), 'utf8')).toBe(
      'SYNTHETIC_FIXTURE_ONLY=true\n',
    );
    expect(readFileSync(path.join(input.repoRoot, 'dist/old-runtime.txt'), 'utf8')).toBe(
      'Existing runtime stays unchanged\n',
    );
    expect(readFileSync(path.join(input.repoRoot, 'backend/DEPLOYED_SHA.txt'), 'utf8')).toBe(
      'Untracked deployment marker stays unchanged\n',
    );
    expect(git(input.repoRoot, 'diff', '--name-only', 'HEAD')).toBe('');
    expect(git(input.repoRoot, 'stash', 'show', '--name-only', result.stashSha)).not.toContain(
      paths[5],
    );
    paths.forEach((file, index) =>
      expect(readFileSync(path.join(input.repoRoot, file), 'utf8')).toBe(
        `approved Git source ${index}\n`,
      ),
    );
    const stash = git(input.repoRoot, 'rev-parse', 'refs/stash');
    expect(reconcileCheckout(input)).toEqual({
      head: input.targetSha,
      backupDirectory: null,
      stashSha: null,
    });
    expect(git(input.repoRoot, 'rev-parse', 'refs/stash')).toBe(stash);
  });

  it.each([
    'stale-hash',
    'unexpected-tracked',
    'index-only-outside',
    'unreviewed-index-source',
    'unexpected-untracked',
    'wrong-target',
    'invalid-manifest',
    'wrong-branch',
  ])('rejects %s before backing up, stashing, or changing source', (failure) => {
    const input = fixture();
    if (failure === 'stale-hash') put(input.repoRoot, paths[0], 'Unreviewed source change\n');
    if (failure === 'unexpected-tracked') put(input.repoRoot, 'README.md', 'Unexpected edit\n');
    if (failure === 'index-only-outside') {
      put(input.repoRoot, 'README.md', 'Unreviewed index content\n');
      git(input.repoRoot, 'add', 'README.md');
      put(input.repoRoot, 'README.md', 'Unrelated tracked content\n');
    }
    if (failure === 'unreviewed-index-source') {
      put(input.repoRoot, paths[0], 'Unreviewed index source\n');
      git(input.repoRoot, 'add', paths[0]);
      put(input.repoRoot, paths[0], 'reviewed server source 0\n');
    }
    if (failure === 'unexpected-untracked')
      put(input.repoRoot, 'backend/src/only-in-target.ts', 'Unexpected source\n');
    if (failure === 'wrong-target') input.targetSha = input.head;
    if (failure === 'invalid-manifest') input.expectedManifest.files[0].path = '.env';
    if (failure === 'wrong-branch') git(input.repoRoot, 'switch', '-c', 'other-branch');
    const before = paths.map((file) => readFileSync(path.join(input.repoRoot, file), 'utf8'));
    const status = git(input.repoRoot, 'status', '--porcelain');
    expect(() => reconcileCheckout(input)).toThrow();
    expect(git(input.repoRoot, 'rev-parse', 'HEAD')).toBe(input.head);
    expect(git(input.repoRoot, 'status', '--porcelain')).toBe(status);
    expect(paths.map((file) => readFileSync(path.join(input.repoRoot, file), 'utf8'))).toEqual(
      before,
    );
    expect(git(input.repoRoot, 'stash', 'list')).toBe('');
    expect(existsSync(input.backupRoot)).toBe(false);
  });
});
