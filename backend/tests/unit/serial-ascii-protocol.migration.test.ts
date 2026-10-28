import type { Knex } from 'knex';
import { describe, expect, it, jest } from '@jest/globals';
import { config, down, up } from '../../src/db/migrations/0147_allow_serial_ascii_device_protocol';

// SQL generation checks only. Engine execution is covered by the opt-in SQL Server suite.
function sqlBoundary() {
  const statements: string[] = [];
  const knex = {
    schema: {
      raw: jest.fn(async (sql: string) => {
        statements.push(sql);
      }),
    },
  } as unknown as Knex;
  return { knex, statements };
}

describe('Serial ASCII protocol migration SQL', () => {
  it('extends the protocol constraint without removing existing protocols', async () => {
    const { knex, statements } = sqlBoundary();
    await up(knex);
    expect(config.transaction).toBe(true);
    const sql = statements.join('\n');
    expect(sql).toContain('ck_device_connection_configs_protocol');
    const allowed = sql.match(/CHECK\s*\(protocol IN\s*\(([^)]+)\)\)/i)?.[1];
    expect(allowed?.match(/'[A-Z_]+'/g)).toEqual([
      "'POMS_BOX'",
      "'MODBUS_RTU'",
      "'DCON_ASCII'",
      "'SERIAL_ASCII'",
      "'MODBUS_TCP'",
      "'MSSQL'",
      "'MYSQL'",
    ]);
  });

  it('guards every Serial ASCII row before attempting to remove the protocol', async () => {
    const { knex, statements } = sqlBoundary();
    await down(knex);
    const sql = statements.join('\n');
    expect(sql).toMatch(/WHERE protocol = 'SERIAL_ASCII'/);
    expect(sql).not.toContain('deleted_at');
    expect(sql).toContain('THROW');
    expect(sql.indexOf('THROW')).toBeLessThan(sql.indexOf('DROP CONSTRAINT'));
    expect(sql.match(/CHECK\s*\(protocol IN\s*\(([^)]+)\)\)/i)?.[1].match(/'[A-Z_]+'/g)).toEqual([
      "'POMS_BOX'",
      "'MODBUS_RTU'",
      "'DCON_ASCII'",
      "'MODBUS_TCP'",
      "'MSSQL'",
      "'MYSQL'",
    ]);
  });
});
