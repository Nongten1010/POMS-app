import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn() }),
}));

import { db } from '../../src/config/database';
import {
  pomsFactoriesRepository,
  toPomsFactoryDetailForTests,
} from '../../src/modules/poms-factories/poms-factories.repository';

const transaction = db.transaction as unknown as jest.Mock<
  (...args: unknown[]) => Promise<unknown>
>;

describe('measurement-point approval with general factory information', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves factory data, points, approval and audit together', async () => {
    const harness = approvalHarness();
    transaction.mockImplementationOnce(harness.runTransaction);
    const result = await pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77);
    expect(result.status).toBe('APPROVED');
    expect(harness.committed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'cems_wpms_connected_measurement_points',
          values: expect.objectContaining({
            factory_project_name: 'โครงการใหม่',
            factory_latitude: 13.1,
            factory_longitude: 100.1,
            factory_front_photos_json: null,
            factory_logo_json: null,
          }),
        }),
        expect.objectContaining({
          table: 'eligible_factories',
          values: expect.objectContaining({
            project_name: 'โครงการใหม่',
            latitude: 13.1,
            longitude: 100.1,
          }),
        }),
        expect.objectContaining({
          table: 'cems_wpms_connected_measurement_points',
          values: expect.objectContaining({ point_name: 'ปล่องใหม่' }),
        }),
        expect.objectContaining({
          table: 'poms_factory_edit_requests',
          values: expect.objectContaining({ status: 'APPROVED' }),
        }),
        expect.objectContaining({
          table: 'poms_factory_edit_request_events',
          values: expect.objectContaining({ action: 'APPROVE' }),
        }),
      ]),
    );
    for (const write of harness.committed) {
      expect(write.table).not.toBe('factories');
      expect(write.values).not.toHaveProperty('factory_name');
      expect(write.values).not.toHaveProperty('factory_address');
      expect(write.values).not.toHaveProperty('point_code');
    }
  });

  it('approves a factory-only change without requiring a changed point', async () => {
    const harness = approvalHarness({ pointChanged: false });
    transaction.mockImplementationOnce(harness.runTransaction);
    await pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77);
    expect(harness.committed.some((write) => write.table === 'eligible_factories')).toBe(true);
    expect(harness.committed.some((write) => 'point_name' in write.values)).toBe(false);
  });

  it('does not write factory snapshots when only the point changed', async () => {
    const harness = approvalHarness({ profileChanged: false });
    transaction.mockImplementationOnce(harness.runTransaction);
    await pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77);
    expect(harness.committed.some((write) => write.table === 'eligible_factories')).toBe(false);
    expect(harness.committed.some((write) => 'factory_project_name' in write.values)).toBe(false);
    expect(harness.committed.some((write) => 'point_name' in write.values)).toBe(true);
  });

  it('rejects a stale factory snapshot before writing any changes', async () => {
    const harness = approvalHarness({ staleProfile: true });
    transaction.mockImplementationOnce(harness.runTransaction);
    await expect(
      pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    expect(harness.attempted).toEqual([]);
    expect(harness.committed).toEqual([]);
  });

  it('rejects an entirely unchanged proposal', async () => {
    const harness = approvalHarness({ profileChanged: false, pointChanged: false });
    transaction.mockImplementationOnce(harness.runTransaction);
    await expect(
      pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    expect(harness.attempted).toEqual([]);
  });

  it('aborts the transaction if the eligible factory update fails', async () => {
    const harness = approvalHarness({ missingEligible: true });
    transaction.mockImplementationOnce(harness.runTransaction);
    await expect(
      pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    expect(harness.committed).toEqual([]);
    expect(harness.attempted.some((write) => write.table === 'poms_factory_edit_requests')).toBe(
      false,
    );
    expect(
      harness.attempted.some((write) => write.table === 'poms_factory_edit_request_events'),
    ).toBe(false);
  });
});

function approvalHarness(
  options: {
    profileChanged?: boolean;
    pointChanged?: boolean;
    staleProfile?: boolean;
    missingEligible?: boolean;
  } = {},
) {
  const current = toPomsFactoryDetailForTests([connectedFactoryRow()], 0);
  const proposed =
    options.profileChanged === false
      ? current
      : {
          ...current,
          projectName: 'โครงการใหม่',
          latitude: 13.1,
          longitude: 100.1,
          factoryFrontPhotos: [],
          factoryLogo: null,
        };
  const proposedPoints =
    options.pointChanged === false
      ? current.measurementPoints
      : current.measurementPoints.map((point) => ({ ...point, pointName: 'ปล่องใหม่' }));
  const row = {
    id: 11,
    request_no: 'point-00001/2569',
    eligible_factory_id: 7,
    factory_id: current.factoryId,
    factory_registration_no: current.factoryRegistrationNo,
    factory_name: current.factoryName,
    form_type: 'MEASUREMENT_POINTS',
    status: 'PENDING_REVIEW',
    revision_no: 0,
    is_open: 1,
    current_factory_json: JSON.stringify(current),
    proposed_factory_json: JSON.stringify(proposed),
    current_measurement_points_json: JSON.stringify(current.measurementPoints),
    proposed_measurement_points_json: JSON.stringify(proposedPoints),
    source_profile_updated_at: options.staleProfile
      ? '2020-01-01T00:00:00.000Z'
      : current.updatedAt,
    request_note: null,
    revision_reason: null,
    officer_note: null,
    created_by: 42,
    submitted_by: 42,
    reviewed_by: null,
    submitted_at: current.updatedAt,
    reviewed_at: null,
    approved_at: null,
    created_at: current.updatedAt,
    updated_at: current.updatedAt,
  };
  const attempted: Array<{ table: string; values: Record<string, unknown> }> = [];
  const committed: typeof attempted = [];
  const trx = Object.assign(
    (table: string) => {
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
      chain.first = async () => row;
      chain.update = async (values: Record<string, unknown>) => {
        attempted.push({ table, values });
        if (table === 'eligible_factories' && options.missingEligible) return 0;
        if (table === 'poms_factory_edit_requests') Object.assign(row, values);
        return 1;
      };
      chain.insert = async (values: Record<string, unknown>) => {
        attempted.push({ table, values });
        return 1;
      };
      chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(table === 'locked-profile' ? [connectedFactoryRow()] : []).then(
          resolve,
          reject,
        );
      return chain;
    },
    {
      fn: { now: () => current.updatedAt },
      raw: () => 'locked-profile',
    },
  );
  return {
    attempted,
    committed,
    runTransaction: async (...args: unknown[]) => {
      const callback = args[0] as (transaction: typeof trx) => Promise<unknown>;
      const result = await callback(trx);
      committed.push(...attempted);
      return result;
    },
  };
}

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
