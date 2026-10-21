import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';

jest.mock('../../src/config/parameter-source-database', () => ({ parameterSourceDb: {} }));
jest.mock('../../src/config/env', () => ({
  env: {
    DB_HOST: 'primary.example',
    DB_PORT: 1433,
    DB_NAME: 'poms-test',
    PARAMETER_DB_SCHEMA: 'ingest',
  },
}));
jest.mock('../../src/config/logger', () => ({ logger: { error: jest.fn() } }));

import {
  clearNewConnectionMeasurements,
  CONNECTION_CLEANUP_INTERVALS,
} from '../../src/modules/connection-requests/connection-measurement-cleanup';
import { cleanupSqlIdentifier } from '../../src/modules/connection-requests/connection-measurement-cleanup-schema';

function fixture() {
  type Receipt = { requestId: number; actor: number; results: unknown[] };
  const h = {
    tables: new Map<string, string[]>(),
    receipts: new Map<string, Receipt>(),
    historical: new Set<string>(),
    legacyNames: new Set<string>(),
    operations: [] as string[],
    deletes: 0,
    failDeleteAt: 0,
    canInspect: true,
    loseCommitReply: false,
    failReceipt: false,
  };
  const primary = ((table: string) => {
    expect(table).toBe('cems_wpms_connected_measurement_points');
    return {
      whereRaw: (sql: string, bindings: string[]) => {
        expect(sql).toBe("COALESCE(NULLIF(LTRIM(RTRIM(??)), ''), ??) = ?");
        expect(bindings.slice(0, 2)).toEqual(['point_code', 'point_name']);
        const station = bindings[2];
        return {
          first: async () =>
            h.historical.has(station) || h.legacyNames.has(station) ? { id: 7 } : undefined,
        };
      },
    };
  }) as unknown as Knex.Transaction;
  const source = {
    transaction: async (callback: (trx: Knex.Transaction) => Promise<void>) => {
      const tables = new Map([...h.tables].map(([key, value]) => [key, [...value]]));
      const receipts = new Map(h.receipts);
      const tableForSql = (sql: string) => {
        const name = [...tables.keys()].find((name) =>
          sql.includes(`.${cleanupSqlIdentifier(name)}`),
        );
        if (!name) throw new Error(`Unexpected fixture table: ${sql}`);
        return name;
      };
      const raw = async (sql: string, bindings: unknown[] = []) => {
        if (sql === 'EXEC sys.sp_executesql ?') sql = String(bindings[0]);
        if (sql.includes('sp_getapplock')) {
          h.operations.push('application-lock');
          expect(sql).toContain("@LockOwner = 'Transaction'");
          expect(sql).toContain('IF @result < 0 THROW');
          return [];
        }
        if (sql.includes('SELECT station_id')) return receipts.has(String(bindings[1])) ? [{}] : [];
        if (sql.includes('HAS_PERMS_BY_NAME')) return [{ can_inspect: h.canInspect ? 1 : 0 }];
        if (sql.includes('FROM sys.tables')) return tables.has(String(bindings[1])) ? [{}] : [];
        if (sql.includes('COUNT_BIG')) {
          const table = tableForSql(sql);
          h.operations.push(`lock:${table}`);
          expect(sql).toContain('WITH (TABLOCKX, HOLDLOCK)');
          return [{ row_count: String(tables.get(table)?.length) }];
        }
        if (sql.includes('SYSUTCDATETIME'))
          return [{ cleared_at: new Date('2026-10-19T08:00:00Z') }];
        if (sql.startsWith('DELETE FROM')) {
          h.operations.push(`delete:${tableForSql(sql)}`);
          if (++h.deletes === h.failDeleteAt) throw new Error('synthetic delete denied');
          tables.set(tableForSql(sql), []);
          return [];
        }
        if (sql.includes('INSERT INTO')) {
          if (h.failReceipt) throw new Error('synthetic audit write failure');
          receipts.set(String(bindings[1]), {
            requestId: Number(bindings[2]),
            actor: Number(bindings[3]),
            results: JSON.parse(String(bindings[5])),
          });
          return [];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      };
      await callback({ raw } as unknown as Knex.Transaction);
      h.tables = tables;
      h.receipts = receipts;
      if (h.loseCommitReply) throw new Error('synthetic lost commit acknowledgement');
    },
  } as unknown as Knex;
  const input = {
    requestId: 10,
    requestType: 'ADD_MEASUREMENT_POINT' as const,
    measurementPoints: [{ pointCode: 'S2001' }],
    actorUserId: 42,
  };
  for (const interval of CONNECTION_CLEANUP_INTERVALS) {
    h.tables.set(`S2001_data_${interval}`, ['test-before-cutoff']);
    h.tables.set(`S2002_data_${interval}`, ['other-station-live']);
  }
  const run = (patch: Partial<Parameters<typeof clearNewConnectionMeasurements>[1]> = {}) =>
    clearNewConnectionMeasurements(primary, { ...input, ...patch }, source);
  return { h, run };
}

describe('new point measurement cleanup', () => {
  it.each(['NEW_CONNECTION', 'ADD_MEASUREMENT_POINT'] as const)(
    'clears all six tables only for the new station in %s and retains an audit receipt',
    async (requestType) => {
      const { h, run } = fixture();
      await run({ requestType });
      for (const interval of CONNECTION_CLEANUP_INTERVALS) {
        expect(h.tables.get(`S2001_data_${interval}`)).toEqual([]);
        expect(h.tables.get(`S2002_data_${interval}`)).toEqual(['other-station-live']);
      }
      expect(h.receipts.get('S2001')).toMatchObject({
        requestId: 10,
        actor: 42,
        results: CONNECTION_CLEANUP_INTERVALS.map((interval) => ({
          tableName: `S2001_data_${interval}`,
          rowCount: 1,
          skippedMissing: false,
        })),
      });
      const firstDelete = h.operations.findIndex((op) => op.startsWith('delete:'));
      expect(
        h.operations.slice(0, firstDelete).filter((op) => op.startsWith('lock:')),
      ).toHaveLength(6);
      expect(JSON.stringify([...h.receipts.values()])).not.toContain('test-before-cutoff');
    },
  );

  it('never clears ADD_PARAMETER, existing points, or retired points', async () => {
    const { h, run } = fixture();
    await run({ requestType: 'ADD_PARAMETER' });
    h.historical.add('S2001'); // Query deliberately has no deleted_at filter.
    await run();
    expect(h.deletes).toBe(0);
    expect(h.operations).toEqual([]);
  });

  it('keeps a historical station unchanged when the same request also contains a new station', async () => {
    const { h, run } = fixture();
    h.historical.add('S2002');
    await run({ measurementPoints: [{ pointCode: 'S2001' }, { pointCode: 'S2002' }] });
    expect(h.tables.get('S2001_data_real')).toEqual([]);
    expect(h.tables.get('S2002_data_real')).toEqual(['other-station-live']);
    expect(h.receipts.has('S2002')).toBe(false);
  });

  it('protects a legacy station whose name is used as station identity because its code is empty', async () => {
    const { h, run } = fixture();
    h.legacyNames.add('S2001');
    await run();
    expect(h.deletes).toBe(0);
    expect(h.tables.get('S2001_data_real')).toEqual(['test-before-cutoff']);
  });

  it('keeps values arriving after cleanup through retries, even if a direct creation gets a new ID', async () => {
    const { h, run } = fixture();
    await run();
    h.tables.set('S2001_data_real', ['late-value-with-old-measurement-time']);
    await run({ requestId: 999 });
    expect(h.tables.get('S2001_data_real')).toEqual(['late-value-with-old-measurement-time']);
    expect(h.deletes).toBe(6);
    expect(h.receipts.get('S2001')?.requestId).toBe(10);
  });

  it('rolls back every table and receipt for every point if any deletion fails', async () => {
    const { h, run } = fixture();
    h.failDeleteAt = 8;
    await expect(
      run({ measurementPoints: [{ pointCode: 'S2001' }, { pointCode: 'S2002' }] }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'MEASUREMENT_CLEANUP_FAILED',
      details: { retryable: true },
    });
    for (const rows of h.tables.values()) expect(rows).toHaveLength(1);
    expect(h.receipts.size).toBe(0);
  });

  it('does not delete again after a committed cleanup whose acknowledgement was lost', async () => {
    const { h, run } = fixture();
    h.loseCommitReply = true;
    await expect(run()).rejects.toMatchObject({ statusCode: 503 });
    h.loseCommitReply = false;
    h.tables.set('S2001_data_1m', ['new-live-value']);
    await run();
    expect(h.tables.get('S2001_data_1m')).toEqual(['new-live-value']);
    expect(h.deletes).toBe(6);
  });

  it('rolls back deletions if the audit receipt cannot be persisted', async () => {
    const { h, run } = fixture();
    h.failReceipt = true;
    await expect(run()).rejects.toMatchObject({ code: 'MEASUREMENT_CLEANUP_FAILED' });
    expect(h.tables.get('S2001_data_real')).toEqual(['test-before-cutoff']);
    expect(h.receipts.size).toBe(0);
  });

  it('records missing tables as skipped, including a station with no tables yet', async () => {
    const { h, run } = fixture();
    h.tables.clear();
    await run();
    expect(h.receipts.get('S2001')?.results).toHaveLength(6);
    expect(h.receipts.get('S2001')?.results).toEqual(
      expect.arrayContaining([{ tableName: 'S2001_data_real', rowCount: 0, skippedMissing: true }]),
    );
    expect(h.deletes).toBe(0);
  });

  it('fails closed when table metadata cannot be inspected', async () => {
    const { h, run } = fixture();
    h.canInspect = false;
    await expect(run()).rejects.toMatchObject({ code: 'MEASUREMENT_CLEANUP_FAILED' });
    expect(h.deletes).toBe(0);
    expect(h.receipts.size).toBe(0);
  });

  it('quotes an entire Unicode/free-form point code, including dots and closing brackets', async () => {
    const { h, run } = fixture();
    const pointCode = 'จุด.01?]; DROP TABLE other;--';
    h.tables.set(`${pointCode}_data_real`, ['test']);
    await run({ measurementPoints: [{ pointCode }] });
    expect(h.tables.get(`${pointCode}_data_real`)).toEqual([]);
    expect(h.tables.get('S2002_data_real')).toEqual(['other-station-live']);
    expect(cleanupSqlIdentifier(`${pointCode}_data_real`)).toBe(
      '[จุด.01?]]; DROP TABLE other;--_data_real]',
    );
  });

  it.each([null, '', 'x'.repeat(65), 'S\0bad'])(
    'rejects an invalid code %j before deletion',
    async (pointCode) => {
      const { h, run } = fixture();
      await expect(run({ measurementPoints: [{ pointCode }] })).rejects.toMatchObject({
        statusCode: 503,
      });
      expect(h.deletes).toBe(0);
    },
  );
});
