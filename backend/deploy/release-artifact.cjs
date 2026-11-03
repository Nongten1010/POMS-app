'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function checksum(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function filesUnder(root, relative = '') {
  return fs
    .readdirSync(path.join(root, relative), { withFileTypes: true })
    .flatMap((entry) => {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Release symlink is not allowed: ${name}`);
      if (entry.isDirectory()) return filesUnder(root, name);
      if (!entry.isFile()) throw new Error(`Unsupported release entry: ${name}`);
      return [name];
    })
    .sort();
}

function validateSha(sha) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('A full commit SHA is required');
}

function allowedFile(name) {
  return (
    !name.includes('\\') &&
    path.posix.normalize(name) === name &&
    !name.split('/').some((part) => part.startsWith('.') || part === 'node_modules') &&
    (name.startsWith('dist/') || ['package.json', 'package-lock.json'].includes(name))
  );
}

function verifyRelease(release, sha) {
  validateSha(sha);
  const actual = filesUnder(release).filter((name) => name !== 'release-manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(release, 'release-manifest.json'), 'utf8'));
  } catch {
    throw new Error('Invalid release manifest');
  }
  if (manifest.version !== 1 || manifest.sha !== sha)
    throw new Error('Release commit does not match');
  const names = Object.keys(manifest.files ?? {}).sort();
  for (const required of ['dist/server.js', 'package.json', 'package-lock.json']) {
    if (!names.includes(required)) throw new Error(`Missing release file: ${required}`);
  }
  if (JSON.stringify(names) !== JSON.stringify(actual))
    throw new Error('Release file list does not match');
  for (const name of names) {
    if (!allowedFile(name)) throw new Error(`Unsafe release path: ${name}`);
    if (checksum(path.join(release, name)) !== manifest.files[name]) {
      throw new Error(`Release checksum does not match: ${name}`);
    }
  }
  return manifest;
}

function createRelease(backend, release, sha) {
  validateSha(sha);
  fs.mkdirSync(release, { recursive: true });
  if (fs.readdirSync(release).length) throw new Error('Release output must be empty');
  const names = [
    'package.json',
    'package-lock.json',
    ...filesUnder(path.join(backend, 'dist')).map((name) => `dist/${name}`),
  ].sort();
  const manifest = { version: 1, sha, files: {} };
  for (const name of names) {
    if (!allowedFile(name)) throw new Error(`Unsafe release path: ${name}`);
    const target = path.join(release, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(backend, name), target);
    manifest.files[name] = checksum(target);
  }
  fs.writeFileSync(
    path.join(release, 'release-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  return verifyRelease(release, sha);
}

module.exports = { createRelease, verifyRelease };

if (require.main === module) {
  try {
    const [command, ...args] = process.argv.slice(2);
    const options = Object.fromEntries(
      Array.from({ length: args.length / 2 }, (_, i) => [args[i * 2], args[i * 2 + 1]]),
    );
    const manifest =
      command === 'create'
        ? createRelease(options['--backend'], options['--release'], options['--sha'])
        : command === 'verify'
          ? verifyRelease(options['--release'], options['--sha'])
          : (() => {
              throw new Error('Expected create or verify');
            })();
    console.log(JSON.stringify({ sha: manifest.sha, files: Object.keys(manifest.files).length }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
