import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  up,
} from '../../src/db/migrations/0076_sync_connected_factory_profiles_with_eligible_factories';

describe('connected factory profile migration', () => {
  it('executes new-column DDL before any SQL batch references those columns', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await up(knex);

    const statements = raw.mock.calls.map(([statement]) => String(statement));
    const addColumnsIndex = statements.findIndex((statement) =>
      statement.includes('eia_assessment NVARCHAR(32) NULL'),
    );
    const backfillIndex = statements.findIndex((statement) =>
      statement.includes('SET eia_assessment = CASE'),
    );

    expect(addColumnsIndex).toBeGreaterThanOrEqual(0);
    expect(backfillIndex).toBeGreaterThan(addColumnsIndex);
    expect(statements[addColumnsIndex]).not.toContain('SET eia_assessment = CASE');
  });

  it('fails the transaction when an active POMS row cannot resolve exactly one eligible factory', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await up(knex);

    expect(config).toEqual({ transaction: true });
    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('cems_wpms_connected_measurement_points');
    expect(sql).toContain('eligible_factories');
    expect(sql).toContain('match_count <> 1');
    expect(sql).toContain('THROW 51000');
    expect(sql).toContain('POMS_ELIGIBLE_FACTORY_BACKFILL_FAILED');
    expect(sql).not.toContain('INSERT INTO eligible_factories');
    expect(sql).not.toContain('DELETE FROM cems_wpms_connected_measurement_points');
  });

  it('adds auditable factory-profile fields and eligible relationships without changing point coordinates', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await up(knex);

    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('cems_wpms_connection_requests');
    expect(sql).toContain('eligible_factory_id BIGINT NULL');
    expect(sql).toContain('factory_eia_assessment NVARCHAR(32) NULL');
    expect(sql).toContain('factory_eia_other NVARCHAR(500) NULL');
    expect(sql).toContain('factory_has_eia BIT NULL');
    expect(sql).toContain('factory_project_name NVARCHAR(500) NULL');
    expect(sql).toContain('factory_front_photos_json NVARCHAR(MAX) NULL');
    expect(sql).toContain('factory_logo_json NVARCHAR(MAX) NULL');
    expect(sql).toContain('ALTER TABLE eligible_factories');
    expect(sql).toContain('eia_assessment NVARCHAR(32) NULL');
    expect(sql).toContain('project_name NVARCHAR(500) NULL');
    expect(sql).toContain('fk_connected_point_eligible_factory');
    expect(sql).toContain('fk_connection_request_eligible_factory');
    expect(sql).toContain('ck_active_connected_point_eligible_factory');
    expect(sql).toContain('latest_connected_factory_profile');
    expect(sql).toContain('UPDATE eligible_row');
    expect(sql).toContain('request_row.latitude IS NOT NULL');
    expect(sql).toContain('request_row.longitude IS NOT NULL');
    expect(sql).not.toContain('cems_wpms_measurement_points.latitude');
    expect(sql).not.toContain('cems_wpms_measurement_points.longitude');
  });
});
