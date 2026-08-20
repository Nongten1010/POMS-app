import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { config, down, up } from '../../src/db/migrations/0098_change_wpms_point_code_prefix_to_p';

describe('WPMS point-code prefix migration', () => {
  it('switches the WPMS sequence to P while preserving historical W registry rows', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await up(knex);

    expect(config).toEqual({ transaction: true });
    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('DROP CONSTRAINT ck_cems_wpms_point_code_sequences_prefix');
    expect(sql).toContain('DROP CONSTRAINT ck_cems_wpms_point_code_registry_prefix_sequence');
    expect(sql).toContain("prefix = 'P'");
    expect(sql).toContain("system_type = 'WPMS'");
    expect(sql).toContain("CHECK (prefix IN ('S', 'P'))");
    expect(sql).toContain("prefix IN ('S', 'W', 'P')");
    expect(sql).not.toContain('UPDATE cems_wpms_measurement_points');
    expect(sql).not.toContain('UPDATE cems_wpms_point_code_registry');
  });

  it('restores W for new allocations without invalidating issued P registry rows', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await down(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain("prefix = 'W'");
    expect(sql).toContain("CHECK (prefix IN ('S', 'W'))");
    expect(sql).not.toContain('DROP CONSTRAINT ck_cems_wpms_point_code_registry_prefix_sequence');
  });
});
