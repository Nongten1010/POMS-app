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
      expect.objectContaining({
        actor_user_id: 42,
        reason: 'อัปเดตสถานะผ่าน status-management',
        revision: 1,
      }),
    ]);
    expect(JSON.parse(tables.poms_factory_status_events?.[0]?.changes_json as string)).toEqual(
      input,
    );
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

const actualFactories = jest.requireActual<
  typeof import('../../src/modules/poms-factories/poms-factories.repository')
>('../../src/modules/poms-factories/poms-factories.repository');
describe('persist point status then map factory GET detail', () => {
  it.each([
    ['VISIBLE', 'CONNECTED', 'แสดง'],
    ['HIDDEN', 'CONNECTED', 'ซ่อน'],
    ['VISIBLE', 'DISCONNECTED', 'ยกเลิกการเชื่อมต่อ'],
  ] as const)('%s/%s must return %s after save', async (visibility, connectionStatus, label) => {
    await pomsStatusManagementRepository.update('10120000325542', actor, {
      expectedRevision: 0,
      measurementPoints: [{ connectedPointId: 11, visibility, connectionStatus }],
    });
    const saved = await pomsStatusManagementRepository.read('10120000325542', actor);
    const status = statusManagementDTO(saved.source, saved.snapshot).measurementPoints[0];
    expect(status?.visibility).toBe(visibility);
    expect(status?.connectionStatus).toBe(connectionStatus);
    const row = connectedFactoryRow({
      connected_point_id: 11,
      management_state_json: tables.poms_factory_status_management![0]!.state_json,
    });
    const detail = actualFactories.toPomsFactoryDetailForTests([row], 0);
    expect((detail?.measurementPoints[0] as unknown as { status?: string })?.status).toBe(label);
  });
});
function connectedFactoryRow(overrides: Record<string, unknown> = {}) {
  return {
    connected_point_id: 15,
    source_measurement_point_id: 2,
    eligible_factory_id: 7,
    factory_id: 'factory-001',
    factory_name: 'บริษัท ทดสอบ จำกัด',
    factory_registration_no: 'POMS-REG-001',
    factory_address: '99 หมู่ 1',
    factory_latitude: 12.7,
    factory_longitude: 101.1,
    factory_eia_assessment: 'มี EIA' as const,
    factory_eia_other: null,
    factory_project_name: 'โครงการเดิม',
    factory_front_photos_json: null,
    factory_logo_json: null,
    province_name: 'ระยอง',
    industrial_estate_name: null,
    factory_registration_no_new: '3-106-33/50สบ',
    factory_registration_no_old: '3-106-33/49สบ',
    business_activity: 'ผลิตเคมีภัณฑ์',
    factory_type_sequence: '42 / 4201',
    system_type: 'CEMS' as const,
    point_name: 'ปล่อง A',
    point_code: 'S0001',
    point_type: 'STACK' as const,
    parameters_json: '["CO"]',
    monitoring_point_status: 'เชื่อมต่อครบแล้ว' as const,
    details_json: null,
    documents_json: null,
    instruments_json: null,
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('factory status inheritance in both POMS GET responses', () => {
  it('derives existing saved parameter statuses on GET without requiring another save', async () => {
    const state = {
      factory: { visibility: 'VISIBLE', connectionStatus: 'CONNECTED' },
      measurementPoints: {
        '11': {
          visibility: 'VISIBLE',
          connectionStatus: 'CONNECTED',
          parameters: { CO: 'HIDDEN', removed: 'VISIBLE' },
        },
        '999': { visibility: 'VISIBLE', connectionStatus: 'CONNECTED', parameters: {} },
      },
    };
    tables.poms_factory_status_management = [
      {
        eligible_factory_id: 7,
        state_json: JSON.stringify(state),
        revision: 6,
        updated_at: '2026-09-11T00:00:00Z',
        updated_by: 42,
      },
    ];
    const saved = await pomsStatusManagementRepository.read('F1', actor);
    expect(statusManagementDTO(saved.source, saved.snapshot)).toMatchObject({
      factory: { status: 'ซ่อน' },
      measurementPoints: [expect.objectContaining({ status: 'ซ่อน' })],
    });
    const row = connectedFactoryRow({
      connected_point_id: 11,
      management_state_json: JSON.stringify(state),
    });
    expect(actualFactories.toPomsFactoryDetailForTests([row], 0)).toMatchObject({
      status: 'ซ่อน',
      measurementPoints: [expect.objectContaining({ status: 'ซ่อน' })],
    });
    expect(actualFactories.summarizeConnectedFactoryRowsForTests([row])[0]?.status).toBe('ซ่อน');
    expect(tables.poms_factory_status_events).toHaveLength(0);
  });
  it('hides descendants on a parent command, then reopening one parameter reopens the point and factory', async () => {
    await pomsStatusManagementRepository.update('F1', actor, input);
    const hidden = await pomsStatusManagementRepository.read('F1', actor);
    expect(statusManagementDTO(hidden.source, hidden.snapshot).measurementPoints[0]).toMatchObject({
      visibility: 'HIDDEN',
      parameters: [expect.objectContaining({ visibility: 'HIDDEN' })],
    });
    await pomsStatusManagementRepository.update('F1', actor, {
      expectedRevision: 1,
      measurementPoints: [
        { connectedPointId: 11, parameters: [{ parameter: 'CO', visibility: 'VISIBLE' }] },
      ],
    });
    const opened = await pomsStatusManagementRepository.read('F1', actor);
    const dto = statusManagementDTO(opened.source, opened.snapshot);
    expect(dto.factory.status).toBe('แสดง');
    expect(dto.measurementPoints[0]?.status).toBe('แสดง');
  });
  it('rolls all hidden parameters up through save/read, factory detail and factory list', async () => {
    await pomsStatusManagementRepository.update('F1', actor, {
      expectedRevision: 0,
      measurementPoints: [
        { connectedPointId: 11, parameters: [{ parameter: 'CO', visibility: 'HIDDEN' }] },
      ],
    });
    const saved = await pomsStatusManagementRepository.read('F1', actor);
    const dto = statusManagementDTO(saved.source, saved.snapshot);
    expect(dto.measurementPoints[0]).toMatchObject({ status: 'ซ่อน', visibility: 'HIDDEN' });
    expect(dto.factory).toMatchObject({ status: 'ซ่อน', visibility: 'HIDDEN' });
    const row = connectedFactoryRow({
      connected_point_id: 11,
      management_state_json: tables.poms_factory_status_management![0]!.state_json,
    });
    expect(actualFactories.toPomsFactoryDetailForTests([row], 0)).toMatchObject({
      status: 'ซ่อน',
      measurementPoints: [expect.objectContaining({ status: 'ซ่อน' })],
    });
    expect(actualFactories.summarizeConnectedFactoryRowsForTests([row])[0]?.status).toBe('ซ่อน');
  });
  it.each([
    ['HIDDEN', 'CONNECTED', 'ซ่อน'],
    ['VISIBLE', 'DISCONNECTED', 'ยกเลิกการเชื่อมต่อ'],
  ] as const)(
    '%s/%s reaches detail, points and list',
    async (visibility, connectionStatus, label) => {
      await pomsStatusManagementRepository.update('F1', actor, {
        expectedRevision: 0,
        factory: { visibility, connectionStatus },
      });
      const row = connectedFactoryRow({
        connected_point_id: 11,
        management_state_json: tables.poms_factory_status_management![0]!.state_json,
      });
      const detail = actualFactories.toPomsFactoryDetailForTests([row], 0);
      expect(detail).toMatchObject({ status: label, visibility, connectionStatus });
      expect(detail?.measurementPoints[0]).toMatchObject({
        status: label,
        visibility,
        connectionStatus: 'CONNECTED',
        effectiveVisibility: visibility,
        effectiveConnectionStatus: connectionStatus,
        monitoringPointStatus: 'เชื่อมต่อครบแล้ว',
      });
      expect(actualFactories.summarizeConnectedFactoryRowsForTests([row])[0]?.status).toBe(label);
    },
  );
  it('shows every current point after showing the parent again', async () => {
    await pomsStatusManagementRepository.update('F1', actor, {
      expectedRevision: 0,
      factory: { visibility: 'HIDDEN' },
      measurementPoints: [{ connectedPointId: 11, visibility: 'HIDDEN' }],
    });
    await pomsStatusManagementRepository.update('F1', actor, {
      expectedRevision: 1,
      factory: { visibility: 'VISIBLE' },
    });
    const row = connectedFactoryRow({
      connected_point_id: 11,
      management_state_json: tables.poms_factory_status_management![0]!.state_json,
    });
    expect(
      actualFactories.toPomsFactoryDetailForTests([row], 0)?.measurementPoints[0]?.status,
    ).toBe('แสดง');
    expect(actualFactories.summarizeConnectedFactoryRowsForTests([row])[0]?.status).toBe('แสดง');
  });
});
