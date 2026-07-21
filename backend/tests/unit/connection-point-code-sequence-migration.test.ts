import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { config, down, up } from '../../src/db/migrations/0075_start_operator_point_codes_at_2001';

describe('operator point-code sequence migration', () => {
  it('updates sequence state without rewriting historical measurement-point codes', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await up(knex);

    expect(config).toEqual({ transaction: true });
    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('legacy_last_sequence');
    expect(sql).toContain('legacy_last_sequence = last_sequence');
    expect(sql).toContain('DROP CONSTRAINT ck_cems_wpms_point_code_sequences_prefix');
    expect(sql).toContain("system_type = 'CEMS'");
    expect(sql).toContain('last_sequence < 2000 THEN 2000');
    expect(sql).toContain("prefix = 'W'");
    expect(sql).toContain("system_type = 'WPMS'");
    expect(sql).toContain("CHECK (prefix IN ('S', 'W'))");
    expect(sql).not.toContain('cems_wpms_measurement_points');
    expect(sql).not.toContain("point_code = 'W'");
  });

  it('restores the legacy sequence prefix constraint on rollback', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await down(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain("prefix = 'P'");
    expect(sql).toContain("system_type = 'WPMS'");
    expect(sql).toContain('last_sequence = legacy_last_sequence');
    expect(sql).toContain('DROP COLUMN legacy_last_sequence');
    expect(sql).toContain("CHECK (prefix IN ('S', 'P'))");
    expect(sql).not.toContain('cems_wpms_measurement_points');
  });
});
