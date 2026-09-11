import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn() }),
}));

import { db } from '../../src/config/database';
import {
  pomsFactoriesRepository,
  buildApprovedPomsMeasurementPointUpdates,
  toPomsFactoryDetailForTests,
} from '../../src/modules/poms-factories/poms-factories.repository';

const transaction = db.transaction as unknown as jest.Mock<
  (...args: unknown[]) => Promise<unknown>
>;

describe('approved measurement-point parameter replacement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([[[]], [['new@example.com']]])(
    'commits recipient replacement %j with approval and reads it back',
    async (emails) => {
      const harness = approvalHarness({ emails });
      transaction.mockImplementationOnce(harness.runTransaction);
      await pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77);
      const writes = harness.committed.filter(
        (write) => write.table === 'cems_wpms_connected_measurement_points',
      );
      expect(writes).toHaveLength(1);
      expect(writes[0].values.officer_notification_emails_json).toBe(JSON.stringify(emails));
      expect(writes[0].values).not.toHaveProperty('parameters_json');
      expect(
        harness.committed.some((write) => write.table === 'cems_wpms_connection_requests'),
      ).toBe(false);
      const live = toPomsFactoryDetailForTests(
        [
          connectedFactoryRow({
            ...writes[0].values,
            source_officer_notification_emails_json: '["old@example.com"]',
          }),
        ],
        0,
      );
      expect(live.measurementPoints[0].officerNotificationEmails).toEqual(emails);
    },
  );

  it('rolls back approval when saving recipients fails', async () => {
    const harness = approvalHarness({ emails: ['new@example.com'], failPointWrite: true });
    transaction.mockImplementationOnce(harness.runTransaction);
    await expect(
      pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77),
    ).rejects.toThrow('point write failed');
    expect(harness.committed).toEqual([]);
    expect(harness.attempted.some((write) => write.table === 'poms_factory_edit_requests')).toBe(
      false,
    );
  });

  it('rejects approval when recipients changed after the snapshot', async () => {
    const harness = approvalHarness({ emails: ['new@example.com'], staleEmails: true });
    transaction.mockImplementationOnce(harness.runTransaction);
    await expect(
      pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77),
    ).rejects.toThrow('measurement points changed');
    expect(harness.attempted).toEqual([]);
  });

  it.each([false, true])(
    'updates live parameters from BOD COD Watt to BOD Watt Flow (derived snapshot: %s)',
    async (derivedParameters) => {
      const harness = approvalHarness({ derivedParameters });
      transaction.mockImplementationOnce(harness.runTransaction);
      const result = await pomsFactoriesRepository.reviewEditRequest(
        11,
        { decision: 'APPROVE' },
        77,
      );
      expect(result.status).toBe('APPROVED');
      const liveRow = connectedFactoryRow({
        parameters_json: JSON.stringify(['BOD (mg/l)', 'COD (mg/l)', 'Watt (kW/hr)']),
      });
      for (const write of harness.committed) {
        if (write.table === 'cems_wpms_connected_measurement_points')
          Object.assign(liveRow, write.values);
      }
      const live = toPomsFactoryDetailForTests([liveRow], 0);
      expect(live.measurementPoints[0].details?.requestedParameters).toEqual([
        'BOD (mg/l)',
        'Watt (kW/hr)',
        'Flow rate (m3/hr)',
      ]);
      expect(live.measurementPoints[0].parameters).toEqual([
        'BOD (mg/l)',
        'Watt (kW/hr)',
        'Flow rate (m3/hr)',
      ]);
    },
  );

  it('preserves parameters when an unrelated legacy edit has an unspecified null list', () => {
    const point = toPomsFactoryDetailForTests(
      [
        connectedFactoryRow({
          details_json: JSON.stringify({ requestedParameters: null }),
        }),
      ],
      0,
    ).measurementPoints[0];
    const updates = buildApprovedPomsMeasurementPointUpdates(
      [point],
      [{ ...point, pointName: 'Updated name' }],
    );
    expect(updates[0].patch).not.toHaveProperty('parameters_json');
    expect(updates[0].parameterChange).toBeNull();
  });

  it('does not commit approval if retiring an obsolete device channel fails', async () => {
    const harness = approvalHarness({ failChannelWrite: true });
    transaction.mockImplementationOnce(harness.runTransaction);
    await expect(
      pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77),
    ).rejects.toThrow('channel write failed');
    expect(harness.committed).toEqual([]);
    expect(harness.attempted.some((write) => write.table === 'poms_factory_edit_requests')).toBe(
      false,
    );
  });
});

function approvalHarness(
  options: {
    derivedParameters?: boolean;
    failChannelWrite?: boolean;
    emails?: string[];
    failPointWrite?: boolean;
    staleEmails?: boolean;
  } = {},
) {
  const currentRow = connectedFactoryRow({
    ...(options.emails === undefined
      ? {}
      : { officer_notification_emails_json: '["old@example.com"]' }),
    system_type: 'WPMS',
    point_code: 'P0260',
    parameters_json: JSON.stringify(['BOD (mg/l)', 'COD (mg/l)', 'Watt (kW/hr)']),
  });
  const current = toPomsFactoryDetailForTests([currentRow], 0);
  const parameters = ['BOD (mg/l)', 'Watt (kW/hr)', 'Flow rate (m3/hr)'];
  const proposedPoints = current.measurementPoints.map((point) => ({
    ...point,
    ...(options.derivedParameters ? { parameters } : {}),
    ...(options.emails === undefined
      ? { details: { requestedParameters: parameters } }
      : { officerNotificationEmails: options.emails }),
  }));
  if (options.staleEmails)
    Object.assign(currentRow, { officer_notification_emails_json: '["concurrent@example.com"]' });
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
    proposed_factory_json: JSON.stringify(current),
    current_measurement_points_json: JSON.stringify(current.measurementPoints),
    proposed_measurement_points_json: JSON.stringify(proposedPoints),
    source_profile_updated_at: current.updatedAt,
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
        if (table === 'cems_wpms_connected_measurement_points' && options.failPointWrite)
          throw new Error('point write failed');
        if (table === 'device_measurement_channels' && options.failChannelWrite)
          throw new Error('channel write failed');
        if (table === 'poms_factory_edit_requests') Object.assign(row, values);
        return 1;
      };
      chain.insert = async (values: Record<string, unknown>) => {
        attempted.push({ table, values });
        return 1;
      };
      chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(
          table === 'locked-profile'
            ? [currentRow]
            : table === 'device_connection_configs'
              ? [{ id: 10, status_management_json: null }]
              : table === 'device_measurement_channels'
                ? [{ id: 2, data_type: 'COD (mg/l)' }]
                : [],
        ).then(resolve, reject);
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
