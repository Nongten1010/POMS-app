import {
  config as dconConfig,
  up as upDcon,
  down as downDcon,
} from '../../src/db/migrations/0122_allow_dcon_ascii_device_protocol';
import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { config, down, up } from '../../src/db/migrations/0087_allow_poms_box_device_protocol';

describe('POMS Box device protocol migration', () => {
  it('replaces the device protocol check with one that includes POMS_BOX', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await up(knex);

    expect(config).toEqual({ transaction: true });
    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('ck_device_connection_configs_protocol');
    expect(sql).toContain("'POMS_BOX'");
    expect(sql).toContain("'MYSQL'");
  });

  it('refuses rollback while POMS_BOX data exists', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await down(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain("protocol = 'POMS_BOX'");
    expect(sql).toContain('THROW');
    expect(sql).toContain("CHECK (protocol IN ('MODBUS_RTU', 'MODBUS_TCP', 'MSSQL', 'MYSQL'))");
  });
});
describe('DCON ASCII device protocol migration', () => {
  it('replaces the device protocol check with one that includes DCON_ASCII', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await upDcon(knex);

    expect(dconConfig).toEqual({ transaction: true });
    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('ck_device_connection_configs_protocol');
    expect(sql).toContain("'DCON_ASCII'");
    expect(sql).toContain("'MYSQL'");
  });

  it('refuses rollback while DCON_ASCII data exists', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await downDcon(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain("protocol = 'DCON_ASCII'");
    expect(sql).toContain('THROW');
    expect(sql).toContain(
      "CHECK (protocol IN ('POMS_BOX', 'MODBUS_RTU', 'MODBUS_TCP', 'MSSQL', 'MYSQL'))",
    );
  });
});
