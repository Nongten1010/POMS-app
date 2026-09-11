import type { Knex } from 'knex';
import { ConflictError } from '../src/shared/errors/AppError';
import {
  parseFactoryProfileBackfillOptions,
  runFactoryProfileBackfill,
} from '../src/modules/factory-profiles/factory-profile-backfill';

const USAGE =
  [
    'Usage: tsx scripts/factory-profile-backfill.ts [--dry-run]',
    '       tsx scripts/factory-profile-backfill.ts --apply --actor-id USER_ID [--batch-size 100]',
    'Default is read-only dry-run. --batch-size caps inserted profiles (1-1000).',
    'Apply audits and locks all active sources, then inserts only conflict-free new profiles.',
    'Resolve conflicting source records explicitly; no latest-timestamp winner or automatic relinking.',
    'Exit codes: 0 complete, 1 invalid options or execution failure, 2 unresolved dry-run conflicts.',
  ].join('\n') + '\n';

export async function runFactoryProfileBackfillCli(
  args: string[],
  output: { out(value: string): void; error(value: string): void } = {
    out: (value) => {
      process.stdout.write(value);
    },
    error: (value) => {
      process.stderr.write(value);
    },
  },
  // Import connection settings only after valid CLI options. Never import server or jobs.
  loadDatabase: () => Promise<Knex> = async () => (await import('../src/config/database')).db,
): Promise<number> {
  if (args.length === 1 && args[0] === '--help') {
    output.out(USAGE);
    return 0;
  }
  let options;
  try {
    options = parseFactoryProfileBackfillOptions(args);
  } catch {
    output.error(USAGE);
    return 1;
  }
  let database: Knex | undefined;
  try {
    database = await loadDatabase();
    const report = await runFactoryProfileBackfill(database, options);
    output.out(JSON.stringify(report, null, 2) + '\n');
    return report.counts.conflicts > 0 ? 2 : 0;
  } catch (error: unknown) {
    // Do not expose SQL, bindings, environment settings, source values or raw driver messages.
    output.error(
      (error instanceof ConflictError
        ? error.message
        : 'Factory profile backfill failed; inspect securely on the server') + '\n',
    );
    return 1;
  } finally {
    if (database) await database.destroy();
  }
}

if (require.main === module) {
  void runFactoryProfileBackfillCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      process.stderr.write(
        'Factory profile backfill cleanup failed; inspect securely on the server\n',
      );
      process.exitCode = 1;
    });
}
