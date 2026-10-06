import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  buildRegistrationRepairBackupSchemaSql,
  down as dropBackup,
  up as createBackup,
} from '../../src/db/migrations/0132_create_factory_registration_repair_backup';
import {
  ADD_REQUEST_REPAIRS,
  ELIGIBLE_FACTORY_REPAIRS,
  REQUEST_REPAIRS,
  buildRegistrationIdentityRepairSql,
  config,
  down,
  up,
} from '../../src/db/migrations/0134_repair_factory_registration_identity';

describe('bounded factory registration repair migrations', () => {
  it('repairs the 29 source-verified identities and excludes test records', () => {
    expect(ELIGIBLE_FACTORY_REPAIRS.map((row) => row.id)).toEqual([
      12, 13, 14, 15, 16, 17, 18, 933, 934, 935, 936, 939, 940, 941,
    ]);
    expect(REQUEST_REPAIRS.map((row) => [row.id, row.requestNo])).toEqual([
      [10043, 'CEMS-0020/2569'],
      [10044, 'CEMS-0021/2569'],
    ]);
    expect(ADD_REQUEST_REPAIRS.map((row) => row.id)).toEqual(
      Array.from({ length: 13 }, (_, index) => index + 1),
    );
    expect(ELIGIBLE_FACTORY_REPAIRS.filter((row) => !row.deleted).map((row) => row.id)).toEqual([
      940, 941,
    ]);
    expect(
      ADD_REQUEST_REPAIRS.filter((row) => row.status === 'REJECTED').map((row) => row.id),
    ).toEqual([7]);
    for (const row of [...ELIGIBLE_FACTORY_REPAIRS, ...ADD_REQUEST_REPAIRS]) {
      expect(row.newNumber).toMatch(/^\d{14}$/);
      expect(row.oldNumber).not.toBe(row.newNumber);
    }
    expect(ELIGIBLE_FACTORY_REPAIRS.find((row) => row.id === 939)?.newNumber).toBe(
      '91120225425673',
    );
    expect(ELIGIBLE_FACTORY_REPAIRS.find((row) => row.id === 940)?.newNumber).toBe(
      '91120225825674',
    );
  });

  it('binds Unicode registration values rather than interpolating them into SQL', () => {
    const batch = buildRegistrationIdentityRepairSql('up');
    expect(batch.bindings).toContain('ข3-59-7/67ปจ');
    expect(batch.bindings).toContain('?3-59-7/67??');
    expect(batch.sql).not.toContain('ข3-59-7/67ปจ');
    expect(batch.sql).not.toContain('91120225825674');
    expect((batch.sql.match(/\?/g) ?? []).length).toBe(batch.bindings.length);
  });

  it('keeps DDL separate from transactional data repair and preserves fixture isolation', async () => {
    const raw = jest
      .fn<(sql: string, bindings?: readonly unknown[]) => Promise<void>>()
      .mockResolvedValue();
    const knex = { raw } as unknown as Knex;
    await createBackup(knex);
    expect(raw).toHaveBeenCalledWith(buildRegistrationRepairBackupSchemaSql());
    raw.mockClear();
    await up(knex);
    const batch = buildRegistrationIdentityRepairSql('up');
    expect(raw).toHaveBeenCalledWith(batch.sql, batch.bindings);
    expect(config.transaction).toBe(true);
    expect(batch.sql).not.toMatch(/\b(?:CREATE|DROP|ALTER)\s+TABLE\b/i);
    const fixture = buildRegistrationIdentityRepairSql('up', 'fixture');
    expect(fixture.sql).toContain('[#registration_repair_eligible]');
    expect(fixture.sql).not.toContain('[dbo].[eligible_factories]');
    expect(fixture.bindings).toEqual(batch.bindings);
  });

  it('exposes guarded data recovery before attempting removal of durable backups', async () => {
    const raw = jest
      .fn<(sql: string, bindings?: readonly unknown[]) => Promise<void>>()
      .mockResolvedValue();
    const knex = { raw } as unknown as Knex;
    await down(knex);
    const recovery = buildRegistrationIdentityRepairSql('down');
    expect(raw).toHaveBeenCalledWith(recovery.sql, recovery.bindings);
    raw.mockClear();
    await dropBackup(knex);
    expect(raw).toHaveBeenCalledTimes(1);
  });
});
