import { describe, expect, it } from '@jest/globals';
import type { Knex } from 'knex';
import {
  cleanupSourceConfig,
  down,
} from '../../src/db/migrations/0143_create_connection_measurement_cleanup_receipts';
import { createMeasurementCleanupReceipts } from '../../src/modules/connection-requests/connection-measurement-cleanup-schema';

describe('measurement cleanup receipt provisioning', () => {
  const primary = {
    server: 'primary.invalid',
    database: 'poms_test',
    user: 'fixture',
    password: 'fixture',
    port: 1433,
  };

  it('falls back to the actual migration database, including a test database suffix', () => {
    expect(cleanupSourceConfig(primary, {})).toMatchObject({
      connection: primary,
      pool: { min: 0, max: 1 },
    });
  });

  it('uses the separately configured parameter database without changing primary settings', () => {
    expect(
      cleanupSourceConfig(primary, {
        PARAMETER_DB_HOST: 'source.invalid',
        PARAMETER_DB_NAME: 'parameter_fixture',
        PARAMETER_DB_PORT: '1434',
        PARAMETER_DB_USER: 'source_fixture',
        PARAMETER_DB_ENCRYPT: 'true',
        PARAMETER_DB_TRUST_SERVER_CERTIFICATE: 'false',
      }),
    ).toMatchObject({
      connection: {
        server: 'source.invalid',
        database: 'parameter_fixture',
        port: 1434,
        user: 'source_fixture',
        options: { encrypt: true, trustServerCertificate: false },
      },
    });
  });

  it.each([false, true])(
    'only provisions missing receipts; existing=%s and never clears measurements',
    async (exists) => {
      const statements: string[] = [];
      const trx = {
        raw: async (sql: string) => {
          statements.push(sql);
        },
        schema: { withSchema: () => ({ hasTable: async () => exists }) },
      };
      const source = {
        transaction: async (callback: (trx: unknown) => Promise<void>) => callback(trx),
      } as unknown as Knex;
      await createMeasurementCleanupReceipts(source, 'ingest');
      const sql = statements.join('\n');
      expect(sql).toContain('sp_getapplock');
      expect(sql.includes('CREATE TABLE')).toBe(!exists);
      if (!exists) {
        expect(sql).toContain('[ingest].[connection_measurement_cleanup_receipts]');
        expect(sql).toContain('PRIMARY KEY (source_key, station_id)');
        expect(sql).toContain('SYSUTCDATETIME()');
      }
      expect(sql).not.toMatch(/DELETE|TRUNCATE|DROP TABLE/);
    },
  );

  it('retains receipts on rollback so a redeployment cannot repeat an earlier cleanup', async () => {
    await expect(down()).resolves.toBeUndefined();
  });
});
