import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0086_validate_device_status_management_json';

describe('device status-management JSON constraint migration', () => {
  it('refuses invalid existing JSON before adding the database check constraint', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await up(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(config).toEqual({ transaction: true });
    expect(sql).toContain('ISJSON(status_management_json) <> 1');
    expect(sql).toContain('THROW');
    expect(sql).toContain('ck_device_connection_configs_status_management_json');
    expect(sql).toContain(
      'CHECK (status_management_json IS NULL OR ISJSON(status_management_json) = 1)',
    );
  });

  it('drops only the status-management JSON check during rollback', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await down(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('DROP CONSTRAINT ck_device_connection_configs_status_management_json');
    expect(sql).not.toContain('DROP COLUMN');
  });
});
