import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn(), raw: jest.fn() }),
}));

import { db } from '../../src/config/database';
import { bodCodDeviationReportsRepository as repository } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository';
import type {
  BodCodDeviationReportStatus,
  CreateBodCodDeviationReportDTO,
} from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.types';

const owner = { actorUserId: 42, scope: 'OWN_FACTORY', roles: ['factory_operator'] };

describe('BOD/COD cancellation and mutation serialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    'SUBMITTED',
    'REVISION_REQUESTED',
    'WAITING_REVIEW',
    'WAITING_APPROVAL',
    'REJECTED',
  ] as const)(
    'cancels %s with one event, preserving its annual and document numbers',
    async (status) => {
      const h = harness(status);
      const result = await repository.cancelReport(9, owner);
      expect(result).toMatchObject({
        statusCode: 'CANCELLED',
        reportNo: 'E-02-0001/2569',
        reportSequenceNo: 3,
        currentStep: null,
        allowedActions: [],
      });
      expect(h.writes).toEqual([
        {
          table: 'bod_cod_deviation_reports',
          values: expect.objectContaining({ status: 'CANCELLED', updated_by: 42 }),
        },
        { table: 'bod_cod_approval_steps', values: expect.objectContaining({ is_current: false }) },
        {
          table: 'bod_cod_approval_events',
          values: expect.objectContaining({ report_id: 9, action: 'CANCEL', actor_user_id: 42 }),
        },
      ]);
      expect(h.calls.slice(0, 2)).toEqual(['lock', 'read']);
      expect(h.raw).toHaveBeenCalledWith(expect.stringContaining('WITH (UPDLOCK, HOLDLOCK)'), [9]);
    },
  );

  it.each(['APPROVED', 'CANCELLED'] as const)(
    'rejects %s without adding history',
    async (status) => {
      const h = harness(status);
      await expect(repository.cancelReport(9, owner)).rejects.toMatchObject({ statusCode: 409 });
      expect(h.writes).toEqual([]);
    },
  );

  it('checks the latest status only after acquiring the lock', async () => {
    const h = harness('SUBMITTED');
    h.raw.mockImplementationOnce(async () => {
      h.row.status = 'APPROVED';
      h.calls.push('lock');
    });
    await expect(repository.cancelReport(9, owner)).rejects.toMatchObject({ statusCode: 409 });
    expect(h.writes).toEqual([]);
  });

  it('denies out-of-scope reports and non-operator actors', async () => {
    const h = harness('SUBMITTED', false);
    await expect(repository.cancelReport(9, owner)).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      repository.cancelReport(9, { actorUserId: 1, scope: 'ALL', roles: ['admin'] }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(h.writes).toEqual([]);
  });

  it('keeps legacy annual numbers null on cancellation', async () => {
    const h = harness('REJECTED');
    h.row.report_sequence_no = null;
    expect((await repository.cancelReport(9, owner)).reportSequenceNo).toBeNull();
  });

  it('resubmits an old half-year without changing its annual number or identity', async () => {
    const h = harness('REVISION_REQUESTED');
    h.row.current_step_status = 'REVISION_REQUESTED';
    const result = await repository.resubmitReport(9, payload(), owner);
    expect(result).toMatchObject({
      reportNo: 'E-02-0001/2569',
      reportSequenceNo: 3,
      statusCode: 'REVISED_PENDING_REVIEW',
    });
    const reportWrite = h.writes.find(
      (write) => write.table === 'bod_cod_deviation_reports',
    )!.values;
    expect(reportWrite).not.toHaveProperty('report_sequence_no');
    expect(reportWrite).not.toHaveProperty('report_round');
    expect(reportWrite).not.toHaveProperty('report_year');
  });

  it.each([3, null])(
    'returns annual sequence %s in detail without exposing actions to a view-only user',
    async (sequence) => {
      const h = harness('SUBMITTED');
      h.row.report_sequence_no = sequence;
      const result = await repository.getReportById(9, owner);
      expect(result.reportSequenceNo).toBe(sequence);
      expect(result.allowedActions).toEqual([]);
    },
  );

  it('prevents resubmit, workflow and result notice writes after cancellation', async () => {
    const h = harness('CANCELLED');
    await expect(repository.resubmitReport(9, payload(), owner)).rejects.toMatchObject({
      statusCode: 409,
    });
    const officer = { actorUserId: 77, scope: 'ALL', roles: ['monitoring_kpm'] };
    await expect(
      repository.changeWorkflowStatus(9, { action: 'APPROVE' }, officer),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      repository.upsertResultNotice(
        9,
        {
          reportCorrectness: 'ถูกต้องครบถ้วน',
          checkedParameters: ['BOD'],
          reviewResult: 'เห็นควรแจ้งผลการตรวจสอบ',
          inspectorName: '',
          inspectorPosition: '',
        },
        officer,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(h.calls).toEqual(['lock', 'read', 'lock', 'read', 'lock', 'read']);
    expect(h.writes).toEqual([]);
  });

  it('does not give an admin director approval authority', async () => {
    const h = harness('WAITING_APPROVAL');
    h.row.current_step_role_code = 'APPROVER';
    await expect(
      repository.changeWorkflowStatus(
        9,
        { action: 'APPROVE' },
        { actorUserId: 1, scope: 'ALL', roles: ['admin'] },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(h.writes).toEqual([]);
  });

  it('rejects result-notice writes from monitoring_5_centers even with approve scope', async () => {
    const h = harness('WAITING_RESULT_NOTICE');
    await expect(
      repository.upsertResultNotice(
        9,
        {
          reportCorrectness: 'ถูกต้องครบถ้วน',
          checkedParameters: ['BOD'],
          reviewResult: 'เห็นควรแจ้งผลการตรวจสอบ',
          inspectorName: '',
          inspectorPosition: '',
        },
        { actorUserId: 77, scope: 'ALL', roles: ['monitoring_5_centers'] },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(h.writes).toEqual([]);
  });
});

function harness(status: BodCodDeviationReportStatus, visible = true) {
  const row = {
    id: 9,
    report_no: 'E-02-0001/2569',
    report_sequence_no: 3 as number | null,
    report_round: 1,
    report_year: 2569,
    factory_registration_no: 'REG',
    connected_measurement_point_id: null,
    point_code: null,
    selected_parameter_code: 'BOD',
    submitted_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    approval_track: 'REGIONAL',
    status,
    current_step_id: 1,
    current_step_no: 1,
    current_step_role_code: 'INSPECTOR',
    current_step_status: 'PENDING',
  };
  const calls: string[] = [];
  const writes: { table: string; values: unknown }[] = [];
  const raw = jest.fn(async (_sql: string, _bindings: unknown[]) => {
    calls.push('lock');
  });
  const trx = Object.assign(
    jest.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      const next = () => chain;
      Object.assign(chain, {
        leftJoin: next,
        where: next,
        whereNull: next,
        whereIn: next,
        whereExists: next,
        whereRaw: next,
        select: next,
        orderBy: next,
        count: next,
        groupBy: next,
        as: next,
        first: async () => {
          calls.push('read');
          return table === 'bod_cod_deviation_reports as r' && visible ? row : undefined;
        },
        update: async (values: unknown) => {
          writes.push({ table, values });
          return 1;
        },
        insert: async (values: unknown) => {
          writes.push({ table, values });
          return 1;
        },
        then: (resolve: (value: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
      });
      return chain;
    }),
    { raw },
  );
  (db.transaction as jest.Mock).mockImplementation((callback: unknown) =>
    (callback as (transaction: unknown) => Promise<unknown>)(trx),
  );
  (db as unknown as jest.Mock).mockImplementation((table: unknown) => trx(String(table)));
  return { row, raw, writes, calls };
}

function payload(): CreateBodCodDeviationReportDTO {
  return {
    reportYear: 2569,
    reportRoundNo: 1,
    factoryName: 'Factory',
    factoryRegistrationNo: 'REG',
    provinceName: 'ราชบุรี',
    selectedParameterCode: 'BOD',
    measurements: [],
    attachments: [],
  };
}
