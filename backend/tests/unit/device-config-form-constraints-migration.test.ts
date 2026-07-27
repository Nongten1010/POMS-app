import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { down, up } from '../../src/db/migrations/0083_relax_device_config_form_constraints';

describe('device config form constraints migration', () => {
  it('removes config-form constraints and makes nullable channel columns persistable', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = {
      schema: { raw },
    } as unknown as Knex;

    await up(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('uq_device_measurement_channels_config_address');
    expect(sql).toContain('ck_device_measurement_channels_address');
    expect(sql).toContain('ck_device_measurement_channels_value_format');
    expect(sql).toContain('ck_device_measurement_channels_alert_range');
    expect(sql).toContain('ALTER COLUMN address_id BIGINT NULL');
    expect(sql).toContain('ALTER COLUMN offset_value DECIMAL(18,6) NULL');
  });

  it('refuses a lossy rollback before restoring the original constraints', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = {
      schema: { raw },
    } as unknown as Knex;

    await down(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('THROW');
    expect(sql).toContain('address_id IS NULL');
    expect(sql).toContain('offset_value IS NULL');
    expect(sql).toContain('address_id < 40001');
    expect(sql).toContain('alert_low > alert_high');
    expect(sql).toContain('GROUP BY config_id, address_id');
    expect(sql).toContain('ALTER COLUMN address_id BIGINT NOT NULL');
    expect(sql).toContain('ALTER COLUMN offset_value DECIMAL(18,6) NOT NULL');
    expect(sql).toContain('ck_device_measurement_channels_value_format');
  });
});
