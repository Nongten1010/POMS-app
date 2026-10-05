import { jest } from '@jest/globals';
import type { Knex } from 'knex';
import initSqlJs, { type SqlValue } from 'sql.js';

type FixtureRow = Record<string, unknown>;

export interface KnexSqliteFixture {
  execute(sql: string, bindings?: unknown[]): void;
  close(): void;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function toSqlValue(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'string' || value instanceof Uint8Array) {
    return value;
  }
  throw new TypeError('SQL fixture values must be scalar values, dates, or binary data');
}

/** Executes production Knex queries against fixture data; only the database boundary is replaced. */
export async function createKnexSqliteFixture(
  db: Knex,
  tables: Record<string, FixtureRow[]>,
  schemas: Record<string, string[]> = {},
): Promise<KnexSqliteFixture> {
  const SQL = await initSqlJs({
    locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm'),
  });
  const sqlite = new SQL.Database();
  try {
    for (const table of new Set([...Object.keys(tables), ...Object.keys(schemas)])) {
      const rows = tables[table] ?? [];
      const columns = [...new Set([...(schemas[table] ?? []), ...rows.flatMap(Object.keys)])];
      if (columns.length === 0) throw new Error(`SQL fixture table ${table} requires columns`);
      const definitions = columns.map((column) => {
        const values = rows.map((row) => row[column]).filter((value) => value != null);
        const numeric = values.every(
          (value) => typeof value === 'number' || typeof value === 'boolean',
        );
        const type =
          numeric && (values.length > 0 || column === 'id')
            ? values.every((value) => Number.isInteger(Number(value)))
              ? 'INTEGER'
              : 'REAL'
            : 'TEXT';
        const primaryKey = column === 'id' && type === 'INTEGER' ? ' PRIMARY KEY' : '';
        return `${quoteIdentifier(column)} ${type}${primaryKey}`;
      });
      sqlite.run(`CREATE TABLE ${quoteIdentifier(table)} (${definitions.join(', ')})`);
      const insert = `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
      for (const row of rows)
        sqlite.run(
          insert,
          columns.map((column) => toSqlValue(row[column])),
        );
    }
  } catch (error) {
    sqlite.close();
    throw error;
  }

  const runner = jest.spyOn(db.client, 'runner').mockImplementation((builder: unknown) => ({
    run: async () => {
      const compiled = (builder as Knex.QueryBuilder).toSQL();
      const bindings = compiled.bindings.map(toSqlValue);
      let sql = compiled.sql.replace(
        /\s+with\s*\((?:UPDLOCK|HOLDLOCK|ROWLOCK)(?:\s*,\s*(?:UPDLOCK|HOLDLOCK|ROWLOCK))*\)/gi,
        '',
      );
      const guardedInsert =
        /^\s*IF NOT EXISTS\s*\(([\s\S]+)\)\s*BEGIN\s*(INSERT\s+INTO[\s\S]+)\s+VALUES\s*\(([\s\S]+)\);?\s*END;?\s*$/i.exec(
          sql,
        );
      if (guardedInsert) {
        const guardBindingCount = (guardedInsert[1].match(/\?/g) ?? []).length;
        bindings.push(...bindings.splice(0, guardBindingCount));
        sql = `${guardedInsert[2]} SELECT ${guardedInsert[3]} WHERE NOT EXISTS (${guardedInsert[1]})`;
      }
      const top = /^select\s+(distinct\s+)?top\s*\(\?\)\s+/i.exec(sql);
      if (top) {
        sql = sql.replace(top[0], `select ${top[1] ?? ''}`) + ' LIMIT ?';
        bindings.push(bindings.shift() ?? null);
      }
      sql = sql.replace(/;\s*select\s+@@rowcount\s*$/i, '');
      const output =
        /\s+output\s+((?:inserted|deleted)\.(?:\[[^\]]+\]|\*)(?:\s*,\s*(?:inserted|deleted)\.(?:\[[^\]]+\]|\*))*)/i.exec(
          sql,
        );
      if (output) {
        sql =
          sql.replace(output[0], '') +
          ` RETURNING ${output[1].replace(/(?:inserted|deleted)\./gi, '')}`;
      }
      const statement = sqlite.prepare(sql, bindings);
      const rows: Record<string, SqlValue>[] = [];
      try {
        while (statement.step()) rows.push(statement.getAsObject());
      } finally {
        statement.free();
      }
      if (compiled.method === 'first') return rows[0];
      if (compiled.method === 'update' || compiled.method === 'del') {
        return output ? rows : sqlite.getRowsModified();
      }
      return rows;
    },
  }));
  // Tests use callback transactions sequentially; production locking remains a SQL Server concern.
  const runTransaction = async (callback: unknown): Promise<unknown> => {
    if (typeof callback !== 'function') {
      throw new TypeError('SQL fixture requires callback transactions');
    }
    sqlite.run('BEGIN');
    try {
      const result: unknown = await callback(db as Knex.Transaction);
      sqlite.run('COMMIT');
      return result;
    } catch (error) {
      sqlite.run('ROLLBACK');
      throw error;
    }
  };
  const context = (db as Knex & { context: { transaction: typeof db.transaction } }).context;
  let restoreTransaction: () => void;
  try {
    const transaction = jest
      .spyOn(context, 'transaction')
      .mockImplementation(runTransaction as typeof db.transaction);
    restoreTransaction = () => transaction.mockRestore();
  } catch (error) {
    runner.mockRestore();
    sqlite.close();
    throw error;
  }
  let closed = false;
  return {
    execute: (sql, bindings = []) => {
      sqlite.run(sql, bindings.map(toSqlValue));
    },
    close: () => {
      if (closed) return;
      runner.mockRestore();
      restoreTransaction();
      sqlite.close();
      closed = true;
    },
  };
}
