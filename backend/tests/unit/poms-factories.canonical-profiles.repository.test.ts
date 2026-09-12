import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';

jest.mock('../../src/config/database', () => {
  const knex = jest.requireActual<typeof import('knex')>('knex');
  const connection = knex({ client: 'mssql' });
  Object.defineProperty(connection, 'transaction', { value: jest.fn(), configurable: true });
  return { db: connection };
});
jest.mock('../../src/modules/factory-profiles/factory-profiles.repository', () => ({
  lockFactoryProfileInTransaction: jest.fn(),
  updateFactoryProfileInTransaction: jest.fn(),
}));
jest.mock('../../src/modules/poms-factories/poms-factory-edit-request-number', () => ({
  allocatePomsFactoryEditRequestNo: jest.fn(async () => 'profile-00001/2569'),
}));

import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import {
  lockFactoryProfileInTransaction,
  updateFactoryProfileInTransaction,
} from '../../src/modules/factory-profiles/factory-profiles.repository';
import {
  buildConnectedFactoryRowsQueryForTests,
  buildEditRequestsQueryForTests,
  buildLockedCurrentFactoryProfileQueryForTests,
  pomsFactoriesRepository,
  toPomsFactoryDetailForTests,
} from '../../src/modules/poms-factories/poms-factories.repository';

const lockProfile = jest.mocked(lockFactoryProfileInTransaction);
const updateProfile = jest.mocked(updateFactoryProfileInTransaction);
const transaction = db.transaction as unknown as jest.Mock<
  (...args: unknown[]) => Promise<unknown>
>;
const initialMode = env.FACTORY_PROFILE_MODE;
const profileTime = '2026-09-01T00:00:00.000Z';
const pointTime = '2026-09-05T00:00:00.000Z';

afterAll(async () => {
  await db.destroy();
});
afterEach(() => {
  env.FACTORY_PROFILE_MODE = initialMode;
});
beforeEach(() => {
  jest.clearAllMocks();
  env.FACTORY_PROFILE_MODE = 'canonical';
  lockProfile.mockResolvedValue({ revision: 8, updated_at: profileTime } as never);
  updateProfile.mockResolvedValue(undefined);
});

describe('POMS canonical factory profile lifecycle', () => {
  it('writes approved contact overrides to connected rows in canonical mode', async () => {
    const harness = setup({ sourceRevision: 8 });
    const currentContacts = {
      systemType: null,
      contactPersons: [],
      notificationEmails: [],
      officerNotificationEmails: [],
    };
    const proposedContacts = {
      ...currentContacts,
      notificationEmails: ['new@example.com'],
      officerNotificationEmails: ['officer@example.com'],
    };
    Object.assign(harness.row, {
      current_contacts_json: JSON.stringify(currentContacts),
      proposed_contacts_json: JSON.stringify(proposedContacts),
    });
    const result = await pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77);
    expect(result).toMatchObject({ currentContacts, proposedContacts });
    expect(harness.committed).toContainEqual(
      expect.objectContaining({
        table: 'cems_wpms_connected_measurement_points',
        values: expect.objectContaining({
          notification_emails_json: '["new@example.com"]',
          officer_notification_emails_json: '["officer@example.com"]',
        }),
      }),
    );
    expect(harness.committed.some((write) => write.table === 'cems_wpms_connection_requests')).toBe(
      false,
    );
  });

  it('reads current profile views with separate profile and point versions', () => {
    const query = buildConnectedFactoryRowsQueryForTests({ actorUserId: 77, scope: 'ALL' }).toSQL();
    expect(query.sql).toContain('[current_connected_measurement_points] as [cp]');
    expect(query.sql).toContain('[current_eligible_factories] as [ef]');
    expect(query.sql).toContain('[cp].[factory_profile_revision]');
    expect(query.sql).toContain('[cp].[factory_profile_updated_at]');
    const current = toPomsFactoryDetailForTests([connectedRow()], 0);
    expect(current.updatedAt).toBe(profileTime);
    expect(current.measurementPoints[0].updatedAt).toBe(pointTime);
    expect(current).not.toHaveProperty('factoryProfileRevision');
  });

  it('uses current eligible data for history access while preserving stored request snapshots', () => {
    const query = buildEditRequestsQueryForTests({
      actorUserId: 77,
      scope: { scope: 'IN_PROVINCE', province: 'ระยอง' },
    })
      .select('req.*')
      .toSQL();
    expect(query.sql).toContain('[current_eligible_factories] as [ef]');
    expect(query.sql).toContain('[req].*');
    expect(query.bindings).toContain('ระยอง');
  });

  it('keeps approved province and estate names even when local lookup rows are absent', () => {
    const current = buildConnectedFactoryRowsQueryForTests({
      actorUserId: 77,
      scope: 'ALL',
    }).toSQL().sql;
    const locked = buildLockedCurrentFactoryProfileQueryForTests(db, 7).toSQL().sql;
    expect(current).toContain('[ef].[industrial_estate_name] as [industrial_estate_name]');
    expect(current).not.toContain('[ie].[name_th] as [industrial_estate_name]');
    expect(locked).toContain('[ef].[province_name] as [province_name]');
    expect(locked).toContain('[ef].[industrial_estate_name] as [industrial_estate_name]');
  });

  it('preserves legacy SQL without requiring the new schema', () => {
    env.FACTORY_PROFILE_MODE = 'legacy';
    const query = buildConnectedFactoryRowsQueryForTests({ actorUserId: 77, scope: 'ALL' }).toSQL();
    expect(query.sql).toContain('[cems_wpms_connected_measurement_points] as [cp]');
    expect(query.sql).not.toContain('factory_profile_revision');
  });

  it('approves general changes through the shared profile writer using the captured revision', async () => {
    const harness = setup({ sourceRevision: 8 });
    await pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77);
    expect(updateProfile).toHaveBeenCalledWith(
      harness.trx,
      7,
      expect.objectContaining({
        project_name: 'new project',
        latitude: 12.7,
        longitude: 101.1,
      }),
      77,
      'POMS_APPROVAL',
      8,
    );
    expect(
      harness.attempted.some((write) => write.table === 'cems_wpms_connected_measurement_points'),
    ).toBe(false);
    expect(harness.attempted.some((write) => write.table === 'eligible_factories')).toBe(false);
    expect(harness.reads.indexOf('profile-lock')).toBeLessThan(
      harness.reads.indexOf('locked-points'),
    );
    expect(harness.reads).toContain('current_connected_measurement_points as cp');
  });

  it('rejects a changed profile revision without changing approval state', async () => {
    const harness = setup({ sourceRevision: 7 });
    await expect(
      pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(updateProfile).not.toHaveBeenCalled();
    expect(harness.committed).toEqual([]);
  });

  it('accepts a legacy pending request only when its editable profile baseline still matches', async () => {
    setup({ sourceRevision: null, legacyTime: '2020-01-01T00:00:00.000Z' });
    await pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77);
    expect(updateProfile).toHaveBeenCalledWith(
      expect.anything(),
      7,
      expect.anything(),
      77,
      'POMS_APPROVAL',
      8,
    );
  });

  it('rejects a legacy pending request whose baseline was changed even if timestamps match', async () => {
    const harness = setup({ sourceRevision: null, liveProject: 'another approved project' });
    await expect(
      pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(updateProfile).not.toHaveBeenCalled();
    expect(harness.committed).toEqual([]);
  });

  it('approves point-only changes independently of the current factory revision', async () => {
    const harness = setup({
      sourceRevision: 1,
      pointOnly: true,
      liveProject: 'another approved project',
    });
    await pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77);
    expect(updateProfile).not.toHaveBeenCalled();
    expect(
      harness.attempted.filter((write) => write.table === 'cems_wpms_connected_measurement_points'),
    ).toEqual([
      expect.objectContaining({ values: expect.objectContaining({ point_name: 'new point' }) }),
    ]);
    expect(harness.attempted.some((write) => write.table === 'eligible_factories')).toBe(false);
  });

  it('prepares a point-only request despite a concurrent general-profile change', async () => {
    const harness = setup({
      sourceRevision: null,
      pointOnly: true,
      liveProfileTime: '2026-09-09T00:00:00.000Z',
    });
    const current = toPomsFactoryDetailForTests([connectedRow()], 0);
    await pomsFactoriesRepository.createEditRequest(
      current,
      {
        formType: 'MEASUREMENT_POINTS',
        proposedFactory: current,
        proposedMeasurementPoints: current.measurementPoints.map((point) => ({
          ...point,
          pointName: 'new point',
        })),
      },
      null,
      42,
    );
    expect(
      harness.committed.find((write) => write.table === 'poms_factory_edit_requests')?.values
        .status,
    ).toBe('PENDING_REVIEW');
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('rejects a stale point baseline when preparing a canonical point request', async () => {
    const harness = setup({
      sourceRevision: null,
      pointOnly: true,
      livePointName: 'concurrently approved point',
    });
    const current = toPomsFactoryDetailForTests([connectedRow()], 0);
    await expect(
      pomsFactoriesRepository.createEditRequest(
        current,
        {
          formType: 'MEASUREMENT_POINTS',
          proposedFactory: current,
          proposedMeasurementPoints: current.measurementPoints.map((point) => ({
            ...point,
            pointName: 'new point',
          })),
        },
        null,
        42,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(harness.committed).toEqual([]);
  });

  it('resubmits point-only edits without manufacturing a general-profile change after a concurrent profile update', async () => {
    const harness = setup({
      sourceRevision: null,
      pointOnly: true,
      resubmit: true,
      liveProfileTime: '2026-09-09T00:00:00.000Z',
      liveProject: 'new current project',
      liveFactoryName: 'new current name',
    });
    const current = toPomsFactoryDetailForTests([connectedRow()], 0);
    const payload = {
      formType: 'MEASUREMENT_POINTS' as const,
      currentFactory: current,
      proposedFactory: current,
      proposedMeasurementPoints: current.measurementPoints.map((point) => ({
        ...point,
        pointName: 'new point',
      })),
    };
    await pomsFactoriesRepository.resubmitEditRequest(11, payload, null, 42);
    const values =
      harness.committed.find((write) => write.table === 'poms_factory_edit_requests')?.values ?? {};
    expect(JSON.parse(values.current_factory_json as string).projectName).toBe(
      JSON.parse(values.proposed_factory_json as string).projectName,
    );
    expect(JSON.parse(values.current_measurement_points_json as string)[0].factoryName).toBe(
      JSON.parse(values.proposed_measurement_points_json as string)[0].factoryName,
    );
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it.each(['create', 'resubmit'] as const)(
    'captures the locked source profile revision on %s',
    async (operation) => {
      const harness = setup({ sourceRevision: null, resubmit: operation === 'resubmit' });
      const current = toPomsFactoryDetailForTests([connectedRow()], 0);
      const payload = {
        formType: 'BASIC_INFO' as const,
        proposedFactory: { ...current, projectName: 'new project' },
        proposedMeasurementPoints: null,
      };
      if (operation === 'create')
        await pomsFactoriesRepository.createEditRequest(current, payload, null, 42);
      else await pomsFactoriesRepository.resubmitEditRequest(11, payload, null, 42);
      expect(
        harness.attempted.find((write) => write.table === 'poms_factory_edit_requests')?.values,
      ).toHaveProperty('source_factory_profile_revision', 8);
    },
  );
});

function setup(options: {
  sourceRevision: number | null;
  pointOnly?: boolean;
  liveProject?: string;
  liveProfileTime?: string;
  livePointName?: string;
  liveFactoryName?: string;
  legacyTime?: string;
  resubmit?: boolean;
}) {
  const current = toPomsFactoryDetailForTests([connectedRow()], 0);
  const row: Record<string, unknown> = {
    id: 11,
    request_no: 'profile-00001/2569',
    eligible_factory_id: 7,
    factory_id: current.factoryId,
    factory_registration_no: current.factoryRegistrationNo,
    factory_name: current.factoryName,
    form_type: options.pointOnly ? 'MEASUREMENT_POINTS' : 'BASIC_INFO',
    status: options.resubmit ? 'REVISION_REQUESTED' : 'PENDING_REVIEW',
    revision_no: 0,
    is_open: 1,
    current_factory_json: JSON.stringify(current),
    proposed_factory_json: JSON.stringify(
      options.pointOnly ? current : { ...current, projectName: 'new project' },
    ),
    current_measurement_points_json: JSON.stringify(current.measurementPoints),
    proposed_measurement_points_json: JSON.stringify(
      current.measurementPoints.map((point) => ({ ...point, pointName: 'new point' })),
    ),
    source_factory_profile_revision: options.sourceRevision,
    source_profile_updated_at: options.legacyTime ?? current.updatedAt,
    created_by: 42,
    submitted_by: 42,
    submitted_at: profileTime,
    created_at: profileTime,
    updated_at: profileTime,
    reviewed_by: null,
    reviewed_at: null,
    approved_at: null,
  };
  const reads: string[] = [];
  const attempted: Array<{ table: string; values: Record<string, unknown> }> = [];
  const committed: typeof attempted = [];
  const trx = Object.assign(
    (table: string) => {
      reads.push(table);
      const chain: Record<string, unknown> = {};
      for (const method of [
        'where',
        'whereNull',
        'whereIn',
        'forUpdate',
        'innerJoin',
        'leftJoin',
        'select',
        'orderBy',
      ]) {
        chain[method] = jest.fn(() => chain);
      }
      chain.first = async (column?: string) =>
        table === 'cems_wpms_connected_measurement_points as cp'
          ? null
          : column === 'id'
            ? undefined
            : row;
      chain.update = async (values: Record<string, unknown>) => {
        attempted.push({ table, values });
        if (table === 'poms_factory_edit_requests') Object.assign(row, values);
        return 1;
      };
      chain.insert = (values: Record<string, unknown>) => {
        attempted.push({ table, values });
        if (table === 'poms_factory_edit_requests') Object.assign(row, values);
        return {
          returning: async () => [{ id: 11 }],
          then: (resolve: (value: unknown) => void) => resolve(1),
        };
      };
      chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(
          table === 'locked-points' || table === 'current_connected_measurement_points as cp'
            ? [
                connectedRow({
                  ...(options.liveProject ? { factory_project_name: options.liveProject } : {}),
                  ...(options.liveProfileTime
                    ? { factory_profile_updated_at: options.liveProfileTime }
                    : {}),
                  ...(options.livePointName ? { point_name: options.livePointName } : {}),
                  ...(options.liveFactoryName ? { factory_name: options.liveFactoryName } : {}),
                }),
              ]
            : [],
        ).then(resolve, reject);
      return chain;
    },
    { fn: { now: () => profileTime }, raw: () => 'locked-points' },
  ) as unknown as Knex.Transaction;
  lockProfile.mockImplementation(async () => {
    reads.push('profile-lock');
    return { revision: 8, updated_at: profileTime } as never;
  });
  transaction.mockImplementationOnce(async (...args) => {
    const result = await (args[0] as (trx: Knex.Transaction) => Promise<unknown>)(trx);
    committed.push(...attempted);
    return result;
  });
  return { trx, reads, attempted, committed, row };
}

function connectedRow(overrides: Record<string, unknown> = {}) {
  return {
    connected_point_id: 15,
    source_measurement_point_id: 2,
    eligible_factory_id: 7,
    factory_id: 'factory-001',
    factory_name: 'Factory',
    factory_registration_no: 'REG-001',
    factory_address: 'Address',
    factory_latitude: 12.7,
    factory_longitude: 101.1,
    factory_eia_assessment: 'มี EIA' as const,
    factory_eia_other: null,
    factory_project_name: 'old project',
    factory_front_photos_json: null,
    factory_logo_json: null,
    province_name: 'ระยอง',
    industrial_estate_name: null,
    factory_registration_no_new: 'REG-001',
    factory_registration_no_old: null,
    business_activity: 'Manufacturing',
    factory_type_sequence: '42 / 4201',
    system_type: 'CEMS' as const,
    point_name: 'Point',
    point_code: 'S0001',
    point_type: 'STACK' as const,
    parameters_json: '["CO"]',
    monitoring_point_status: 'เชื่อมต่อครบแล้ว' as const,
    details_json: null,
    documents_json: null,
    instruments_json: null,
    updated_at: pointTime,
    factory_profile_revision: 8,
    factory_profile_updated_at: profileTime,
    ...overrides,
  };
}
