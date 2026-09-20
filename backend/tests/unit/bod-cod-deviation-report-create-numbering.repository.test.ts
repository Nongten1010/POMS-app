import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), {
    transaction: jest.fn(),
  }),
}));

import { db } from '../../src/config/database';
import { bodCodDeviationReportsRepository } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository';
import type { CreateBodCodDeviationReportDTO } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.types';

const mockedDb = db as unknown as {
  transaction: jest.Mock<(callback: (trx: unknown) => Promise<unknown>) => Promise<unknown>>;
};

describe('BOD/COD deviation report create numbering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-09-20T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a report with a server-derived regional number and minimal snapshots', async () => {
    const harness = createReportHarness();
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const result = await bodCodDeviationReportsRepository.createReport(createPayload(), {
      actorUserId: 42,
      scope: 'ALL',
      roles: ['admin'],
    });

    expect(result).toMatchObject({
      id: 101,
      reportNo: 'E-02-0001/2569',
      statusCode: 'SUBMITTED',
      approvalTrack: 'REGIONAL',
    });
    expect(harness.reportInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        report_no: 'E-02-0001/2569',
        report_year: 2569,
        numbering_region_code: '02',
        numbering_sequence: 1,
        factory_id: 9,
        province_name: 'ราชบุรี',
      }),
    );
  });

  it('accepts canonical connected-point parameter labels including mg/l units', async () => {
    const h = createReportHarness(undefined, { parameters: '["BOD (mg/l)","COD (mg/l)"]' });
    mockedDb.transaction.mockImplementationOnce(h.runTransaction);
    const result = await bodCodDeviationReportsRepository.createReport(createPayload(), {
      actorUserId: 42, scope: 'ALL', roles: ['admin'],
    });
    expect(result.statusCode).toBe('SUBMITTED');
  });

  it('blocks pending reports before allocating a document number or inserting', async () => {
    const h = createReportHarness(undefined, {
      reports: [{ id: 8, status: 'REVISION_REQUESTED', report_sequence_no: 2 }],
    });
    mockedDb.transaction.mockImplementationOnce(h.runTransaction);
    await expect(
      bodCodDeviationReportsRepository.createReport(createPayload(), {
        actorUserId: 42,
        scope: 'ALL',
        roles: ['admin'],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(h.reportInsert).not.toHaveBeenCalled();
    expect(h.raw).toHaveBeenCalledTimes(1); // Point lock, no regional counter reservation.
  });

  it('reuses a rejected sequence while assigning a fresh document number', async () => {
    const h = createReportHarness(undefined, {
      reports: [
        { id: 1, status: 'APPROVED', report_sequence_no: 1 },
        { id: 2, status: 'REJECTED', report_sequence_no: 2 },
      ],
    });
    mockedDb.transaction.mockImplementationOnce(h.runTransaction);
    const result = await bodCodDeviationReportsRepository.createReport(createPayload(), {
      actorUserId: 42,
      scope: 'ALL',
      roles: ['admin'],
    });
    expect(result.reportSequenceNo).toBe(2);
    expect(h.reportInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        report_sequence_no: 2,
        report_round: 2,
        connected_measurement_point_id: 12,
      }),
    );
  });

  it('rejects a parameter no longer available after acquiring the point lock', async () => {
    const h = createReportHarness(undefined, { parameters: '["COD"]' });
    mockedDb.transaction.mockImplementationOnce(h.runTransaction);
    await expect(
      bodCodDeviationReportsRepository.createReport(createPayload(), {
        actorUserId: 42,
        scope: 'ALL',
        roles: ['admin'],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(h.reportInsert).not.toHaveBeenCalled();
  });

  it('rejects an inaccessible point and mismatched factory identity', async () => {
    const h = createReportHarness(undefined, { missingPoint: true });
    mockedDb.transaction.mockImplementationOnce(h.runTransaction);
    await expect(
      bodCodDeviationReportsRepository.createReport(createPayload(), {
        actorUserId: 42,
        scope: 'ALL',
        roles: ['admin'],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(h.reportInsert).not.toHaveBeenCalled();
    const h2 = createReportHarness();
    mockedDb.transaction.mockImplementationOnce(h2.runTransaction);
    await expect(
      bodCodDeviationReportsRepository.createReport(
        { ...createPayload(), factoryId: 'OTHER' },
        { actorUserId: 42, scope: 'ALL', roles: ['admin'] },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(h2.reportInsert).not.toHaveBeenCalled();
  });

  it('rechecks the calendar after waiting for the document-number lock', async () => {
    const h = createReportHarness();
    h.raw
      .mockImplementationOnce(async () => undefined)
      .mockImplementationOnce(async () => {
        jest.setSystemTime(new Date('2026-12-31T17:00:00Z'));
      });
    mockedDb.transaction.mockImplementationOnce(h.runTransaction);
    await expect(
      bodCodDeviationReportsRepository.createReport(createPayload(), {
        actorUserId: 42,
        scope: 'ALL',
        roles: ['admin'],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(h.reportInsert).not.toHaveBeenCalled();
  });

  it('derives the central approval track from the authoritative factory province', async () => {
    const harness = createReportHarness({
      factory_internal_id: 11,
      province_name: 'กรุงเทพมหานคร',
      region_name: 'ภาคกลาง',
    });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const result = await bodCodDeviationReportsRepository.createReport(
      {
        ...createPayload(),
        provinceName: 'กรุงเทพมหานคร',
      },
      {
        actorUserId: 42,
        scope: 'ALL',
        roles: ['admin'],
      },
    );

    expect(result).toMatchObject({
      id: 101,
      reportNo: 'E-07-0001/2569',
      statusCode: 'SUBMITTED',
      approvalTrack: 'CENTRAL',
    });
    expect(harness.reportInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        report_no: 'E-07-0001/2569',
        numbering_region_code: '07',
        province_name: 'กรุงเทพมหานคร',
        approval_track: 'CENTRAL',
      }),
    );
  });
});

function createReportHarness(
  factoryRow: {
    factory_internal_id: number;
    province_name: string;
    region_name: string;
  } = {
    factory_internal_id: 9,
    province_name: 'ราชบุรี',
    region_name: 'ภาคตะวันตก',
  },
  options: { reports?: unknown[]; parameters?: string; missingPoint?: boolean } = {},
) {
  const raw = jest.fn(async () => undefined);
  const reportInsert = jest.fn();
  const measurementInsert = jest.fn(async () => 1);
  const approvalStepInsert = jest.fn(async () => 1);
  const sequenceUpdate = jest.fn(async () => 1);

  const factoryBuilder = thenableBuilder(factoryRow);
  const sequenceSelectBuilder = firstBuilder({ last_sequence: 0 });
  const sequenceUpdateBuilder = whereUpdateBuilder(sequenceUpdate);
  const reportBuilder = {
    insert: jest.fn((values: Record<string, unknown>) => {
      reportInsert(values);
      return {
        returning: jest.fn(async () => [{ id: 101 }]),
      };
    }),
  };
  const approvalSteps = [
    {
      id: 1,
      step_no: 1,
      track: 'REGIONAL',
      role_code: 'INSPECTOR',
      role_label: 'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (ตรวจสอบความถูกต้อง)',
      status: 'PENDING',
      actor_user_id: null,
      actor_name: null,
      actor_position: null,
      decision: null,
      comment: null,
      decided_at: null,
      is_current: true,
    },
    {
      id: 2,
      step_no: 2,
      track: 'REGIONAL',
      role_code: 'RESULT_NOTICE',
      role_label: 'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (บันทึก/แก้ไขแบบแจ้งผล)',
      status: 'WAITING',
      actor_user_id: null,
      actor_name: null,
      actor_position: null,
      decision: null,
      comment: null,
      decided_at: null,
      is_current: false,
    },
    {
      id: 3,
      step_no: 3,
      track: 'REGIONAL',
      role_code: 'APPROVER',
      role_label: 'ผอ.ศูนย์ (อนุมัติ)',
      status: 'WAITING',
      actor_user_id: null,
      actor_name: null,
      actor_position: null,
      decision: null,
      comment: null,
      decided_at: null,
      is_current: false,
    },
  ];

  const queues = new Map<string, unknown[]>([
    ['factories as f', [factoryBuilder]],
    ['bod_cod_deviation_report_sequences', [sequenceSelectBuilder, sequenceUpdateBuilder]],
    ['bod_cod_deviation_reports', [thenableBuilder(options.reports ?? []), reportBuilder]],
    [
      'cems_wpms_connected_measurement_points as cp',
      [
        thenableBuilder(options.missingPoint ? [] : [pointRow()]),
        thenableBuilder([
          { ...pointRow(), parameters_json: options.parameters ?? pointRow().parameters_json },
        ]),
      ],
    ],
    ['bod_cod_deviation_measurements', [{ insert: measurementInsert }]],
    ['bod_cod_approval_steps', [{ insert: approvalStepInsert }, thenableBuilder(approvalSteps)]],
  ]);

  const trx = Object.assign(
    jest.fn((tableName: string) => {
      const builder = queues.get(tableName)?.shift();
      if (!builder) throw new Error(`Unexpected query for ${tableName}`);
      return builder;
    }),
    {
      raw,
      fn: { now: jest.fn(() => 'db-now') },
    },
  );

  return {
    reportInsert,
    raw,
    runTransaction: async (callback: (transaction: typeof trx) => Promise<unknown>) => {
      const result = await callback(trx);
      expect([...queues.values()].every((queue) => queue.length === 0)).toBe(true);
      return result;
    },
  };
}

function thenableBuilder(value: unknown) {
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn((argument?: unknown) => {
    if (typeof argument === 'function') {
      const predicate: Record<string, unknown> = {};
      const returnPredicate = jest.fn(() => predicate);
      Object.assign(predicate, { orWhere: returnPredicate, where: returnPredicate });
      argument(Object.assign(predicate, { leftJoin: returnPredicate }));
    }
    return chain;
  });
  Object.assign(chain, {
    leftJoin: returnChain,
    modify: returnChain,
    select: returnChain,
    first: returnChain,
    where: returnChain,
    whereNull: returnChain,
    orderBy: returnChain,
    then: (resolve: (resolved: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  });
  return chain;
}

function firstBuilder(value: unknown) {
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn(() => chain);
  Object.assign(chain, {
    where: returnChain,
    forUpdate: returnChain,
    first: jest.fn(async () => value),
  });
  return chain;
}

function whereUpdateBuilder(
  update: jest.Mock<(values: Record<string, unknown>) => Promise<number>>,
) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    where: jest.fn(() => chain),
    update,
  });
  return chain;
}

function createPayload(): CreateBodCodDeviationReportDTO {
  return {
    reportRoundNo: 2,
    connectedMeasurementPointId: 12,
    reportYear: 2569,
    factoryId: 'FID-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryRegistrationNo: 'REG-001',
    provinceName: 'ราชบุรี',
    selectedParameterCode: 'BOD',
    measurements: [
      {
        sampleDate: '2026-07-01',
        sampleTime: '09:30',
        deviceValueMgL: 12.5,
        labValueMgL: 10,
        standardDeviationMgL: 3,
      },
    ],
    attachments: [],
  };
}

function pointRow() {
  return {
    connected_point_id: 12,
    factory_id: 'FID-001',
    factory_fid: 'FID-001',
    factory_code: 'REG-001',
    poms_factory_id: 9,
    factory_registration_no: 'REG-001',
    parameters_json: '["BOD","COD"]',
    point_code: 'WEMS-001',
    point_name: 'Point A',
  };
}
