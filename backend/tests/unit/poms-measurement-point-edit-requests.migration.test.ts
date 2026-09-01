import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0106_extend_poms_factory_edit_requests_for_measurement_points';

describe('POMS measurement-point edit request forward migration', () => {
  it('adds the integrated form discriminator and point snapshots in migration 0106', async () => {
    const harness = migrationHarness();

    await up(harness.knex);

    expect(config).toEqual({ transaction: true });
    const sql = normalizeSql(
      harness.raw.mock.calls.map(([statement]) => String(statement)).join('\n'),
    );
    expect(sql).toContain(
      "ADD form_type VARCHAR(32) NOT NULL CONSTRAINT df_poms_factory_edit_requests_form_type DEFAULT 'BASIC_INFO' WITH VALUES",
    );
    expect(sql).toContain('ADD current_measurement_points_json NVARCHAR(MAX) NULL');
    expect(sql).toContain('proposed_measurement_points_json NVARCHAR(MAX) NULL');
    expect(sql).toContain('ck_poms_factory_edit_requests_form_type');
    expect(sql).toContain("form_type IN ('BASIC_INFO', 'MEASUREMENT_POINTS')");
    expect(sql).toContain('ck_poms_factory_edit_requests_current_measurement_points_json');
    expect(sql).toContain('ISJSON(current_measurement_points_json) = 1');
    expect(sql).toContain('ck_poms_factory_edit_requests_proposed_measurement_points_json');
    expect(sql).toContain('ISJSON(proposed_measurement_points_json) = 1');
    expect(sql).toContain(
      'DROP INDEX uq_poms_factory_edit_requests_open_factory ON poms_factory_edit_requests',
    );
    expect(sql).toContain(
      'ON poms_factory_edit_requests(eligible_factory_id, form_type) WHERE deleted_at IS NULL AND is_open = 1',
    );
  });

  it('keeps the historical 0100 migration free of measurement-point schema changes', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/db/migrations/0100_create_poms_factory_edit_requests.ts'),
      'utf8',
    );

    expect(source).not.toContain('FORM_TYPE_VALUES');
    expect(source).not.toContain("table.specificType(\n      'form_type'");
    expect(source).not.toContain('current_measurement_points_json');
    expect(source).not.toContain('proposed_measurement_points_json');
    expect(source).toContain('ON ${REQUESTS_TABLE}(eligible_factory_id)');
    expect(source).not.toContain('ON ${REQUESTS_TABLE}(eligible_factory_id, form_type)');
  });

  it('guards rollback before destructive DDL when any MEASUREMENT_POINTS request exists', async () => {
    const harness = migrationHarness();

    await down(harness.knex);

    const sql = normalizeSql(
      harness.raw.mock.calls.map(([statement]) => String(statement)).join('\n'),
    );
    const guardPosition = sql.indexOf(
      "IF EXISTS ( SELECT 1 FROM poms_factory_edit_requests WHERE form_type = 'MEASUREMENT_POINTS' )",
    );
    const throwPosition = sql.indexOf('THROW 50001');
    const destructiveDdlPosition = sql.indexOf(
      'DROP INDEX uq_poms_factory_edit_requests_open_factory',
    );
    expect(guardPosition).toBeGreaterThanOrEqual(0);
    expect(throwPosition).toBeGreaterThan(guardPosition);
    expect(destructiveDdlPosition).toBeGreaterThan(throwPosition);
    expect(sql).toContain(
      'Cannot roll back measurement-point edit requests while their data exists',
    );
  });

  it('removes only 0106 artifacts and restores the original open-request index', async () => {
    const harness = migrationHarness();

    await down(harness.knex);

    const sql = normalizeSql(
      harness.raw.mock.calls.map(([statement]) => String(statement)).join('\n'),
    );
    expect(sql).toContain(
      'DROP INDEX uq_poms_factory_edit_requests_open_factory ON poms_factory_edit_requests',
    );
    expect(sql).toContain(
      'ON poms_factory_edit_requests(eligible_factory_id) WHERE deleted_at IS NULL AND is_open = 1',
    );
    expect(sql).toContain('DROP CONSTRAINT ck_poms_factory_edit_requests_form_snapshots');
    expect(sql).toContain(
      'DROP COLUMN proposed_measurement_points_json, current_measurement_points_json, form_type',
    );
    expect(sql).not.toMatch(/\b(?:UPDATE|DELETE)\b/u);
  });
});

function migrationHarness(): {
  knex: Knex;
  raw: jest.Mock<(statement: string) => Promise<void>>;
} {
  const raw = jest.fn(async (_statement: string) => undefined);
  const knex = { schema: { raw } } as unknown as Knex;
  return { knex, raw };
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/gu, ' ').trim();
}
