import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import knex from 'knex';
import { db } from '../../src/config/database';
import { pomsFactoriesRepository } from '../../src/modules/poms-factories/poms-factories.repository';
import {
  pomsStatusManagementRepository,
  statusFactoryLock,
} from '../../src/modules/poms-factories/poms-status-management.repository';
import { statusManagementDTO } from '../../src/modules/poms-factories/poms-status-management.state';

jest.mock('../../src/config/database', () => ({ db: { transaction: jest.fn() } }));
jest.mock('../../src/modules/poms-factories/poms-factories.repository', () => ({
  pomsFactoriesRepository: { findFactoryDetail: jest.fn() },
  toPomsParameterDisplayNames: (parameters: string[]) => parameters.map((p) => `${p} (ppm)`),
}));
type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let failAudit = false;
function executor(table: string) {
  const conditions: Row = {};
  let nullColumn: string | undefined;
  const rows = () =>
    (tables[table] ?? []).filter(
      (row) =>
        Object.entries(conditions).every(([k, v]) => row[k] === v) &&
        (!nullColumn || row[nullColumn] == null),
    );
  const query = {
    where: (field: string | Row, value?: unknown) => {
      Object.assign(conditions, typeof field === 'string' ? { [field]: value } : field);
      return query;
    },
    whereNull: (field: string) => {
      nullColumn = field;
      return query;
    },
    select: () => query,
    orderBy: () => query,
    first: async () => rows()[0],
    then: (resolve: (rows: Row[]) => unknown) => Promise.resolve(rows()).then(resolve),
    insert: async (record: Row) => {
      if (failAudit && table === 'poms_factory_status_events') throw new Error('audit unavailable');
      (tables[table] ??= []).push(record);
      return [1];
    },
    update: async (record: Row) => {
      const matches = rows();
      matches.forEach((r) => Object.assign(r, record));
      return matches.length;
    },
  };
  return query;
}
executor.raw = (_sql: string, bindings: string[]) => bindings[0]!;
const actor = { actorUserId: 42, roles: ['admin'], scope: 'ALL' };
const input = {
  expectedRevision: 0,
  reason: 'reviewed',
  factory: { visibility: 'HIDDEN' as const },
};
beforeEach(() => {
  failAudit = false;
  tables = {
    eligible_factories: [{ id: 7 }],
    cems_wpms_connected_measurement_points: [
      {
        id: 11,
        eligible_factory_id: 7,
        point_code: 'S0011',
        point_name: 'Boiler',
        system_type: 'CEMS',
        parameters_json: '["CO"]',
        instruments_json: null,
      },
    ],
    poms_factory_status_management: [],
    poms_factory_status_events: [],
  };
  jest
    .mocked(pomsFactoriesRepository.findFactoryDetail)
    .mockResolvedValue({ eligibleFactoryId: 7, factoryId: 'F1', factoryName: 'Factory' } as Awaited<
      ReturnType<typeof pomsFactoriesRepository.findFactoryDetail>
    >);
  jest.mocked(db.transaction).mockImplementation((async (
    callback: (trx: unknown) => Promise<unknown>,
  ) => {
    const before = structuredClone(tables);
    try {
      return await callback(executor);
    } catch (error) {
      tables = before;
      throw error;
    }
  }) as typeof db.transaction);
});
describe('Transactional POMS status storage', () => {
  it('persists a change and reads it back with an audit actor and revision', async () => {
    await pomsStatusManagementRepository.update('F1', actor, input);
    const saved = await pomsStatusManagementRepository.read('F1', actor);
    expect(statusManagementDTO(saved.source, saved.snapshot).factory.visibility).toBe('HIDDEN');
    expect(saved.snapshot.revision).toBe(1);
    expect(tables.poms_factory_status_events).toEqual([
      expect.objectContaining({ actor_user_id: 42, reason: 'reviewed', revision: 1 }),
    ]);
    expect(tables.cems_wpms_connected_measurement_points![0]).not.toHaveProperty('deleted_at');
  });
  it('rolls back the state if audit persistence fails', async () => {
    failAudit = true;
    await expect(pomsStatusManagementRepository.update('F1', actor, input)).rejects.toThrow(
      'audit unavailable',
    );
    expect(tables.poms_factory_status_management).toHaveLength(0);
    expect(tables.poms_factory_status_events).toHaveLength(0);
  });
  it('rejects stale writes and does not create duplicate audit events', async () => {
    await pomsStatusManagementRepository.update('F1', actor, input);
    await expect(pomsStatusManagementRepository.update('F1', actor, input)).rejects.toThrow(
      'Status has changed',
    );
    await pomsStatusManagementRepository.update('F1', actor, { ...input, expectedRevision: 1 });
    expect(tables.poms_factory_status_events).toHaveLength(1);
  });
  it('rejects an out-of-scope factory before entering a write transaction', async () => {
    jest.mocked(pomsFactoriesRepository.findFactoryDetail).mockResolvedValueOnce(null);
    await expect(pomsStatusManagementRepository.update('F1', actor, input)).rejects.toThrow(
      'POMS factory not found',
    );
    expect(tables.poms_factory_status_management).toHaveLength(0);
  });
  it('rechecks a deleted factory and a removed point under the lock', async () => {
    tables.eligible_factories![0]!.deleted_at = new Date();
    await expect(pomsStatusManagementRepository.update('F1', actor, input)).rejects.toThrow(
      'POMS factory not found',
    );
    tables.eligible_factories![0]!.deleted_at = null;
    tables.cems_wpms_connected_measurement_points = [];
    await expect(pomsStatusManagementRepository.update('F1', actor, input)).rejects.toThrow(
      'no current connected measurement points',
    );
  });
  it('rolls back a whole batch containing a parameter from another point', async () => {
    await expect(
      pomsStatusManagementRepository.update('F1', actor, {
        ...input,
        measurementPoints: [
          { connectedPointId: 11, parameters: [{ parameter: 'BOD', visibility: 'HIDDEN' }] },
        ],
      }),
    ).rejects.toThrow('Parameter is not connected');
    expect(tables.poms_factory_status_management).toHaveLength(0);
  });
  it('uses MSSQL parent locks and parameter binding to serialize the first insert', () => {
    const client = knex({ client: 'mssql' });
    const compiled = statusFactoryLock(client, 7).toSQL();
    expect(compiled.sql).toContain('[eligible_factories] WITH (UPDLOCK, HOLDLOCK)');
    expect(compiled.sql).toContain('[deleted_at] is null');
    expect(compiled.bindings).toContain(7);
    void client.destroy();
  });
});
