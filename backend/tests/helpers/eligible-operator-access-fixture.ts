import { jest } from '@jest/globals';
import initSqlJs, { type SqlValue } from 'sql.js';
import type { Knex } from 'knex';
import { db } from '../../src/config/database';
import { factorySourceDb } from '../../src/config/factory-source-database';

export async function operatorAccessFixture() {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  sqlite.run(`
    CREATE TABLE eligible_factories (id INTEGER PRIMARY KEY, factory_registration_no_new TEXT, source_factory_id TEXT, factory_name TEXT, operation_status TEXT, updated_at TEXT, deleted_at TEXT);
    CREATE TABLE users (id INTEGER PRIMARY KEY, identity_provider TEXT, external_id TEXT, user_type TEXT, is_active INTEGER, last_login_at TEXT, deleted_at TEXT, first_name TEXT, last_name TEXT);
    CREATE TABLE eligible_factory_source_status (eligible_factory_id INTEGER PRIMARY KEY, flag TEXT, verified_fid TEXT, last_success_at TEXT, last_attempt_at TEXT, error_code TEXT, daily_success_key TEXT);
    CREATE TABLE user_eligible_factory_access (id INTEGER PRIMARY KEY AUTOINCREMENT, eligible_factory_id INTEGER, user_id INTEGER, status TEXT, factory_fid TEXT, granted_by INTEGER, granted_at TEXT DEFAULT CURRENT_TIMESTAMP, reason TEXT, revoked_by INTEGER, ended_at TEXT);
    CREATE UNIQUE INDEX open_grant ON user_eligible_factory_access(eligible_factory_id,user_id) WHERE ended_at IS NULL;
    CREATE TABLE eligible_operator_access_events (id INTEGER PRIMARY KEY AUTOINCREMENT, grant_id INTEGER, action TEXT, actor_user_id INTEGER, reason TEXT, occurred_at TEXT);
    CREATE TABLE eligible_factory_status_events (id INTEGER PRIMARY KEY AUTOINCREMENT, eligible_factory_id INTEGER, before_flag TEXT, after_flag TEXT, observed_at TEXT);
    CREATE TABLE eligible_factory_status_runs (run_key TEXT PRIMARY KEY, run_token TEXT, status TEXT, lease_until TEXT, finished_at TEXT, checked_count INTEGER, failed_count INTEGER);
    CREATE TABLE factories (id INTEGER, fid TEXT, code TEXT, juristic_id INTEGER, deleted_at TEXT);
    CREATE TABLE user_juristics (user_id INTEGER, juristic_id INTEGER, revoked_at TEXT);
    CREATE TABLE user_factory_access (user_id INTEGER, factory_id INTEGER, revoked_at TEXT);
    CREATE VIEW factory_access_identities AS SELECT * FROM factories UNION ALL
      SELECT NULL, ef.factory_registration_no_new, ef.factory_registration_no_new, NULL, ef.deleted_at
      FROM eligible_factories ef WHERE NOT EXISTS (SELECT 1 FROM factories f WHERE f.fid=ef.factory_registration_no_new);
    INSERT INTO eligible_factories VALUES (17,'10000000000017','10000000000017','โรงงาน C','ยังไม่แจ้งประกอบ',NULL,NULL);
    INSERT INTO eligible_factories VALUES (18,'10000000000018','10000000000018','โรงงาน D','ยังไม่แจ้งประกอบ',NULL,NULL);
    INSERT INTO users VALUES (42,'i_industry','1111111111234','citizen',1,'2026-11-09',NULL,'ผู้ประกอบการ','ทดสอบ');
    INSERT INTO users VALUES (1,'local','admin','admin',1,'2026-11-09',NULL,'แอดมิน','ทดสอบ');
  `);
  const rows = (sql: string, bindings: SqlValue[] = []) => {
    const statement = sqlite.prepare(sql, bindings);
    const result: Record<string, SqlValue>[] = [];
    try {
      while (statement.step()) result.push(statement.getAsObject());
    } finally {
      statement.free();
    }
    return result;
  };
  const runner = jest.spyOn(db.client, 'runner').mockImplementation(
    (builder: unknown) =>
      ({
        run: async () => {
          const q = (builder as Knex.QueryBuilder).toSQL();
          if (q.sql.includes('sp_getapplock')) return [{ result: 0 }];
          const bindings = [...(q.bindings ?? [])];
          let sql = q.sql
            .replace(/N'/g, "'")
            .replace(/\s+WITH\s*\(UPDLOCK,\s*HOLDLOCK\)/gi, '')
            .replace(/SYSUTCDATETIME\(\)/g, "strftime('%Y-%m-%dT%H:%M:%fZ','now')")
            .replace(
              /DATEADD\(second, \?, strftime\('%Y-%m-%dT%H:%M:%fZ','now'\)\)/g,
              "strftime('%Y-%m-%dT%H:%M:%fZ','now', ? || ' seconds')",
            );
          let limit: number | undefined;
          sql = sql.replace(/top \(\?\) /i, () => {
            limit = Number(bindings.shift());
            return '';
          });
          const returning = / output inserted\.\[id\]/i.test(sql);
          sql = sql.replace(/ output inserted\.\[id\]/i, '');
          if (returning) sql += ' RETURNING id';
          if (limit !== undefined) sql += ` LIMIT ${limit}`;
          const values = bindings.map((v) =>
            v instanceof Date ? v.toISOString() : typeof v === 'boolean' ? Number(v) : v,
          ) as SqlValue[];
          const result = rows(sql, values);
          if (q.method === 'first') return result[0];
          if (q.method === 'update' || q.method === 'del') return sqlite.getRowsModified();
          return result;
        },
      }) as never,
  );
  const context = (db as Knex & { context: { transaction: typeof db.transaction } }).context;
  const transaction = jest.spyOn(context, 'transaction').mockImplementation((async (
    callback: (trx: Knex.Transaction) => Promise<unknown>,
  ) => {
    sqlite.run('BEGIN');
    try {
      const result = await callback(db as unknown as Knex.Transaction);
      sqlite.run('COMMIT');
      return result;
    } catch (error) {
      sqlite.run('ROLLBACK');
      throw error;
    }
  }) as typeof db.transaction);
  const source = {
    rows: [
      { FID: '10000000000017', FFLAG: '0' },
      { FID: '10000000000018', FFLAG: '0' },
    ],
    unavailable: false,
    calls: 0,
  };
  const sourceRunner = jest.spyOn(factorySourceDb.client, 'runner').mockImplementation(
    (builder: unknown) =>
      ({
        run: async () => {
          source.calls++;
          if (source.unavailable) throw new Error('Synthetic unavailable source');
          const q = (builder as Knex.QueryBuilder).toSQL();
          return source.rows.filter((r) => q.bindings?.includes(r.FID));
        },
      }) as never,
  );
  return {
    sqlite,
    rows,
    source,
    close: () => {
      runner.mockRestore();
      transaction.mockRestore();
      sourceRunner.mockRestore();
      sqlite.close();
    },
  };
}
