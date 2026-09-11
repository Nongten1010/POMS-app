import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, jest } from '@jest/globals';

const workflow = readFileSync(
  path.join(__dirname, '../../../.github/workflows/deploy.yml'),
  'utf8',
);
const step = workflow
  .split('- name: Verify factory profile activation prerequisites')[1]
  ?.split('\n      - name: ')[0];
const script = step?.match(/@'\r?\n([\s\S]+?)\s*'@\s*\|\s*node/)?.[1];
if (!script) throw new Error('Factory profile deployment preflight script is missing');
const preflightScript: string = script;

async function execute(mode: string, ready = false, failure = false) {
  const destroy = jest.fn(async () => undefined);
  const audit = jest.fn(async (_database: unknown, _options: { apply: boolean }) => {
    if (failure) throw new Error('Synthetic connection failure');
    return {
      schemaReady: true,
      readyForCanonical: ready,
      counts: { missingProfiles: ready ? 0 : 909, conflicts: ready ? 0 : 244 },
    };
  });
  const modules: string[] = [];
  const processState: { exitCode?: number } = {};
  await runInNewContext(
    preflightScript,
    {
      process: processState,
      console: { log: jest.fn(), error: jest.fn() },
      require: (name: string) => {
        modules.push(name);
        if (name === './dist/config/env') return { env: { FACTORY_PROFILE_MODE: mode } };
        if (name === './dist/config/database') return { db: { destroy } };
        if (name === './dist/modules/factory-profiles/factory-profile-backfill')
          return { runFactoryProfileBackfill: audit };
        throw new Error('Unexpected deployment module');
      },
    },
    { timeout: 1000 },
  );
  return { processState, destroy, audit, modules };
}

describe('production factory profile activation preflight', () => {
  it('allows legacy deployment without loading a database or applying backfill', async () => {
    const result = await execute('legacy');
    expect(result.processState.exitCode).toBeUndefined();
    expect(result.modules).toEqual(['./dist/config/env']);
    expect(result.audit).not.toHaveBeenCalled();
  });

  it('allows canonical only when the read-only audit reports ready', async () => {
    const result = await execute('canonical', true);
    expect(result.processState.exitCode).toBeUndefined();
    expect(result.audit).toHaveBeenCalledWith(expect.anything(), { apply: false });
    expect(result.destroy).toHaveBeenCalledTimes(1);
  });

  it('blocks canonical when profiles are missing or conflicts remain', async () => {
    const result = await execute('canonical', false);
    expect(result.processState.exitCode).toBe(1);
    expect(result.audit).toHaveBeenCalledWith(expect.anything(), { apply: false });
    expect(result.destroy).toHaveBeenCalledTimes(1);
  });

  it('blocks canonical and closes the connection when the audit fails', async () => {
    const result = await execute('canonical', false, true);
    expect(result.processState.exitCode).toBe(1);
    expect(result.destroy).toHaveBeenCalledTimes(1);
  });
});
