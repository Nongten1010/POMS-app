import { jest } from '@jest/globals';
import type { Knex } from 'knex';
import { createKnexSqliteFixture } from './knex-sqlite-fixture';

/** SQL fixture for the measurement DB boundary; locking remains a SQL Server check. */
export async function parameterCleanupSourceFixture(source: Knex) {
  const fixture = await createKnexSqliteFixture(source, { fixture: [{ id: 1 }] });
  fixture.execute("ATTACH DATABASE ':memory:' AS sys");
  fixture.execute("ATTACH DATABASE ':memory:' AS ingest");
  fixture.execute('CREATE TABLE sys.schemas (schema_id INTEGER, name TEXT)');
  fixture.execute("INSERT INTO sys.schemas VALUES (1, 'ingest')");
  fixture.execute('CREATE TABLE sys.tables (object_id INTEGER, schema_id INTEGER, name TEXT)');
  fixture.execute('CREATE TABLE sys.columns (object_id INTEGER, name TEXT, is_nullable INTEGER)');
  fixture.execute(`CREATE TABLE ingest.parameter_measurement_cleanup_receipts (
    source_key TEXT, request_id INTEGER, station_id TEXT, parameter_key TEXT,
    parameter_label TEXT, actor_user_id INTEGER, cleared_at TEXT, table_results_json TEXT,
    PRIMARY KEY (source_key, request_id, station_id, parameter_key)
  )`);
  const run = jest.mocked(source.client.runner).getMockImplementation();
  if (!run) throw new Error('Measurement SQL fixture runner is unavailable');
  const state = { denyUpdate: false, denyMetadata: false, loseCommitReply: false, failUpdateAt: 0 };
  let updates = 0;
  jest.mocked(source.client.runner).mockImplementation((builder: unknown) => {
    const query = (builder as Knex.QueryBuilder).toSQL();
    if (query.sql.includes('sp_getapplock')) return { run: async () => [] } as never;
    if (query.sql.includes('HAS_PERMS_BY_NAME'))
      return { run: async () => [{ can_inspect: state.denyMetadata ? 0 : 1 }] } as never;
    if (query.sql === 'SELECT SYSUTCDATETIME() AS cleared_at')
      return { run: async () => [{ cleared_at: '2026-10-26T03:00:00.000Z' }] } as never;
    let sql = query.sql;
    let bindings = [...query.bindings];
    if (sql.startsWith('EXEC sys.sp_executesql')) {
      sql = String(bindings.shift());
      if (sql.includes('@unit')) sql = sql.replace(/@unit\b/g, '?');
    }
    if (/^UPDATE /i.test(sql) && (state.denyUpdate || ++updates === state.failUpdateAt))
      return {
        run: async () => {
          throw new Error('Synthetic measurement update denied');
        },
      } as never;
    sql = sql
      .replace(/COUNT_BIG\(/g, 'COUNT(')
      .replace(/\s+WITH\s*\(TABLOCKX,\s*HOLDLOCK\)/gi, '')
      .replace(/\bN'/g, "'");
    return run(source.raw(sql, bindings));
  });
  const context = (source as Knex & { context: { transaction: typeof source.transaction } })
    .context;
  const transact = jest.mocked(context.transaction).getMockImplementation();
  if (!transact) throw new Error('Measurement SQL fixture transaction is unavailable');
  jest.mocked(context.transaction).mockImplementation((async (...args: unknown[]) => {
    const result = await Reflect.apply(transact, context, args);
    if (state.loseCommitReply) throw new Error('Synthetic lost source commit acknowledgement');
    return result;
  }) as typeof source.transaction);
  let objectId = 0;
  return {
    ...fixture,
    state,
    createTable: (name: string, rows: Record<string, unknown>[]) => {
      const columns = [...new Set(rows.flatMap(Object.keys))];
      const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
      fixture.execute(
        `CREATE TABLE ingest.${quote(name)} (${columns.map((column) => `${quote(column)} TEXT`).join(', ')})`,
      );
      fixture.execute('INSERT INTO sys.tables VALUES (?, 1, ?)', [++objectId, name]);
      for (const column of columns)
        fixture.execute('INSERT INTO sys.columns VALUES (?, ?, 1)', [objectId, column]);
      for (const row of rows)
        fixture.execute(
          `INSERT INTO ingest.${quote(name)} (${columns.map(quote).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          columns.map((column) => row[column] ?? null),
        );
    },
  };
}
