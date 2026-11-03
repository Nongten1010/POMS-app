'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function classifyChanges(files, { eventName, deployTarget, forceFrontend = false }) {
  const manual = eventName === 'workflow_dispatch';
  const pipeline =
    files.includes('.github/workflows/deploy.yml') ||
    files.some((file) => file.startsWith('backend/deploy/') && !file.endsWith('.md'));
  const backend = files.some(
    (file) =>
      file.startsWith('backend/') && !file.startsWith('backend/tests/') && !file.endsWith('.md'),
  );
  const backendChanged = pipeline || backend || (manual && deployTarget === 'backend');
  return {
    frontend_changed:
      files.some((file) => file.startsWith('frontend/')) ||
      forceFrontend ||
      (manual && deployTarget === 'frontend'),
    backend_changed: backendChanged,
    backend_ci_required: backendChanged || files.some((file) => file.startsWith('backend/tests/')),
    frontend_deps_changed: files.some((file) =>
      ['frontend/package.json', 'frontend/package-lock.json'].includes(file),
    ),
    backend_deps_changed: files.some((file) =>
      ['backend/package.json', 'backend/package-lock.json'].includes(file),
    ),
  };
}

module.exports = { classifyChanges };

if (require.main === module) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
  const head = process.env.HEAD_SHA;
  if (!/^[a-f0-9]{40}$/.test(head ?? '')) throw new Error('A full HEAD commit SHA is required');
  let files = [];
  if (process.env.EVENT_NAME !== 'workflow_dispatch') {
    const base = process.env.BASE_SHA || process.env.BEFORE_SHA;
    files =
      /^[a-f0-9]{40}$/.test(base ?? '') && !/^0+$/.test(base)
        ? git('diff', '--name-only', '-z', base, head).split('\0').filter(Boolean)
        : git('ls-tree', '-r', '--name-only', '-z', head).split('\0').filter(Boolean);
  }
  const result = classifyChanges(files, {
    eventName: process.env.EVENT_NAME,
    deployTarget: process.env.DEPLOY_TARGET,
    forceFrontend: process.env.FORCE_FRONTEND === 'true',
  });
  for (const [key, value] of Object.entries(result))
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  console.log(JSON.stringify({ changedPaths: files.length, ...result }));
}
