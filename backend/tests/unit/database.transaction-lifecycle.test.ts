import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Request, RequestError } from 'tedious';

jest.mock('../../src/config/env', () => ({
  env: {
    DB_HOST: 'fixture.invalid',
    DB_PORT: 1433,
    DB_NAME: 'synthetic',
    DB_USER: 'fixture',
    DB_PASSWORD: 'synthetic-only',
    DB_POOL_MIN: 0,
    DB_POOL_MAX: 1,
    FACTORY_PROFILE_MODE: 'legacy',
  },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn() },
}));

import { db } from '../../src/config/database';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';

// Exercise the real Knex MSSQL transaction, query queue and pool. Only the
// Tedious wire connection is replaced; no application database is contacted.
class WireConnection extends EventEmitter {
  connected = true;
  closed = false;
  inTransaction = false;
  state = { name: 'LoggedIn' };
  sql: string[] = [];
  fail = /synthetic_failure/;
  failCommit = false;
  active?: Request;
  timer?: ReturnType<typeof setImmediate>;

  beginTransaction(callback: () => void): void {
    this.inTransaction = true;
    queueMicrotask(callback);
  }

  saveTransaction(callback: () => void): void {
    queueMicrotask(callback);
  }

  commitTransaction(callback: (error?: Error) => void): void {
    if (this.failCommit) {
      queueMicrotask(() => callback(new Error('synthetic commit failure')));
      return;
    }
    this.inTransaction = false;
    queueMicrotask(callback);
  }

  rollbackTransaction(callback: () => void): void {
    this.inTransaction = false;
    queueMicrotask(callback);
  }

  execSql(request: Request): void {
    const sql = String(request.sqlTextOrProcedure);
    this.sql.push(sql);
    this.active = request;
    this.state.name = 'SentClientRequest';
    this.timer = setImmediate(() => {
      this.active = undefined;
      this.state.name = 'LoggedIn';
      if (this.fail.test(sql)) {
        request.callback(new RequestError('synthetic read failure', 'EREQUEST'));
        return;
      }
      const row = sql.includes('@@TRANCOUNT')
        ? { transaction_count: Number(this.inTransaction) }
        : { id: 1, status: 'WAITING_REVIEW' };
      request.emit(
        'row',
        Object.entries(row).map(([colName, value]) => ({ metadata: { colName }, value })),
      );
      request.callback(undefined, 1, []);
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.connected = false;
    this.inTransaction = false;
    this.state.name = 'Final';
    if (this.timer) clearImmediate(this.timer);
    const active = this.active;
    this.active = undefined;
    active?.callback(new RequestError('Synthetic connection closed', 'ECLOSE'));
    queueMicrotask(() => this.emit('end'));
  }
}

describe('SQL Server transaction lifecycle', () => {
  let connections: WireConnection[];

  beforeEach(() => {
    connections = [];
    if (!db.client.pool) db.client.initializePool(db.client.config);
    jest.spyOn(db.client, 'acquireRawConnection').mockImplementation(async () => {
      const connection = new WireConnection();
      connections.push(connection);
      return connection;
    });
  });

  afterEach(async () => {
    await db.destroy();
    jest.restoreAllMocks();
  });

  it('reuses a healthy connection after commit and ordinary rollback', async () => {
    await expect(
      db.transaction(async (trx) => {
        await trx.raw('SELECT 1');
        return 'committed';
      }),
    ).resolves.toBe('committed');
    await expect(
      db.transaction(async (trx) => {
        await trx.raw('SELECT synthetic_failure');
      }),
    ).rejects.toThrow('synthetic read failure');
    expect(await db.raw('SELECT @@TRANCOUNT AS transaction_count')).toEqual([
      { transaction_count: 0 },
    ]);
    expect(connections).toHaveLength(1);
    expect(connections[0].closed).toBe(false);
  });

  it('closes a leaked transaction immediately when rollback fails during parallel reads', async () => {
    let reads: Promise<unknown>[] = [];
    await expect(
      db.transaction(async (trx) => {
        reads = [
          trx.raw('SELECT synthetic_failure').then((value) => value),
          trx.raw('SELECT sibling_read').then((value) => value),
        ];
        await Promise.all(reads);
      }),
    ).rejects.toThrow();
    await Promise.allSettled(reads);

    // Must close even with no new acquire: idle pool connections can retain
    // write locks indefinitely. Merely validating the next checkout is too late.
    expect(connections[0].closed).toBe(true);
    expect(await db.raw('SELECT @@TRANCOUNT AS transaction_count')).toEqual([
      { transaction_count: 0 },
    ]);
    expect(connections).toHaveLength(2);
  });

  it('keeps the outer connection in use until nested work and the outer commit finish', async () => {
    await db.transaction(async (outer) => {
      await outer.transaction(async (nested) => {
        await nested.raw('SELECT 1');
      });
      expect(connections[0].inTransaction).toBe(true);
      expect(connections[0].closed).toBe(false);
      await outer.raw('SELECT 1');
    });
    expect(connections[0].inTransaction).toBe(false);
    expect(connections[0].closed).toBe(false);
  });

  it('discards a connection whose commit fails without ending the transaction', async () => {
    await db.raw('SELECT 1');
    connections[0].failCommit = true;
    await expect(
      db.transaction(async (trx) => {
        await trx.raw('SELECT 1');
      }),
    ).rejects.toThrow('synthetic commit failure');
    expect(connections[0].closed).toBe(true);
    expect(await db.raw('SELECT @@TRANCOUNT AS transaction_count')).toEqual([
      { transaction_count: 0 },
    ]);
  });

  it('preserves the original hydration error and rolls back before returning a request connection', async () => {
    await db.raw('SELECT 1');
    const connection = connections[0];
    connection.fail = /from \[cems_wpms_measurement_points\]/;

    await expect(
      connectionRequestsRepository.updateStatus(1, 'WAITING_FACTORY_REVISION', 42, {}),
    ).rejects.toThrow('synthetic read failure');

    expect(connection.inTransaction).toBe(false);
    expect(connection.closed).toBe(false);
    expect(
      connection.sql.some(
        (sql) =>
          sql.startsWith('select') && sql.includes('from [cems_wpms_request_status_history]'),
      ),
    ).toBe(false);
    expect(
      connection.sql.some(
        (sql) =>
          sql.startsWith('select') && sql.includes('from [cems_wpms_request_factory_snapshots]'),
      ),
    ).toBe(false);
  });
});
