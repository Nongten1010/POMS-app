import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { raw: jest.fn() }),
}));

import { db } from '../../src/config/database';
import { bodCodDeviationReportsRepository as repository } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository';

const access = { actorUserId: 42, scope: 'ALL', roles: ['admin'] };

function step(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    step_no: 1,
    track: 'REGIONAL',
    role_code: 'INSPECTOR',
    role_label: 'ผู้ตรวจสอบ',
    status: 'APPROVED',
    actor_user_id: 77,
    actor_name: null,
    actor_position: null,
    actor_prename_th: 'นาย',
    actor_first_name: 'สมชาย',
    actor_last_name: 'ใจดี',
    actor_username: 'inspector',
    decision: 'APPROVED',
    comment: null,
    decided_at: '2026-09-01T10:00:00Z',
    is_current: false,
    ...overrides,
  };
}

function harness(steps: ReturnType<typeof step>[]) {
  const stepQuery = {
    leftJoin: jest.fn(),
    select: jest.fn(),
    where: jest.fn(),
    whereNull: jest.fn(),
    orderBy: jest.fn(),
  };
  jest.mocked(db).mockImplementation(((table: string) => {
    const isStepTable = table.startsWith('bod_cod_approval_steps');
    const chain: Record<string, unknown> = {};
    for (const method of [
      'leftJoin',
      'select',
      'where',
      'whereNull',
      'whereIn',
      'orderBy',
      'count',
      'groupBy',
      'as',
    ]) {
      const spy = isStepTable ? stepQuery[method as keyof typeof stepQuery] : undefined;
      chain[method] = spy ? spy.mockReturnValue(chain) : () => chain;
    }
    chain.first = async () =>
      table === 'bod_cod_deviation_reports as r'
        ? {
            id: 14,
            report_no: 'E-02-0001/2569',
            status: 'WAITING_RESULT_NOTICE',
            approval_track: 'REGIONAL',
            selected_parameter_code: 'BOD',
            submitted_at: '2026-09-01T09:00:00Z',
            updated_at: '2026-09-01T10:00:00Z',
          }
        : undefined;
    chain.then = (resolve: (rows: unknown[]) => unknown) =>
      Promise.resolve(isStepTable ? steps : []).then(resolve);
    return chain;
  }) as unknown as typeof db);
  return stepQuery;
}

describe('BOD/COD detail step actor names', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns each approver name from its actor user when the stored name is null', async () => {
    const query = harness([
      step(),
      step({
        id: 2,
        step_no: 2,
        role_code: 'RESULT_NOTICE',
        actor_user_id: 88,
        actor_prename_th: 'นาง',
        actor_first_name: 'สมหญิง',
        actor_last_name: 'ตรวจสอบ',
        is_current: true,
      }),
    ]);
    const detail = await repository.getReportById(14, access);

    expect(detail.currentStep?.actorName).toBe('นาง สมหญิง ตรวจสอบ');
    expect(detail.steps.map(({ actorUserId, actorName }) => ({ actorUserId, actorName }))).toEqual([
      { actorUserId: 77, actorName: 'นาย สมชาย ใจดี' },
      { actorUserId: 88, actorName: 'นาง สมหญิง ตรวจสอบ' },
    ]);
    expect(query.leftJoin).toHaveBeenCalledWith('users as u', 'u.id', 's.actor_user_id');
    expect(query.select.mock.calls[0]).toEqual(
      expect.arrayContaining([
        'u.prename_th as actor_prename_th',
        'u.first_name as actor_first_name',
        'u.last_name as actor_last_name',
        'u.username as actor_username',
      ]),
    );
    expect(query.where).toHaveBeenCalledWith('s.report_id', 14);
    expect(query.whereNull).toHaveBeenCalledWith('s.deleted_at');
  });

  it('preserves a stored actor name', async () => {
    harness([step({ actor_name: 'ชื่อที่บันทึกเดิม' })]);
    expect((await repository.getReportById(14, access)).steps[0].actorName).toBe(
      'ชื่อที่บันทึกเดิม',
    );
  });

  it('falls back to the user name for a blank stored actor name', async () => {
    harness([step({ actor_name: '  ' })]);
    expect((await repository.getReportById(14, access)).steps[0].actorName).toBe('นาย สมชาย ใจดี');
  });

  it('uses the username when the actor has no display name', async () => {
    harness([step({ actor_prename_th: null, actor_first_name: null, actor_last_name: null })]);
    expect((await repository.getReportById(14, access)).steps[0].actorName).toBe('inspector');
  });

  it('trims name parts and ignores blank parts', async () => {
    harness([
      step({ actor_prename_th: ' ', actor_first_name: ' สมชาย ', actor_last_name: ' ใจดี ' }),
    ]);
    expect((await repository.getReportById(14, access)).steps[0].actorName).toBe('สมชาย ใจดี');
  });

  it.each([77, null])(
    'keeps the step with actor %s when no user name is available',
    async (actorId) => {
      harness([
        step({
          actor_user_id: actorId,
          actor_prename_th: null,
          actor_first_name: null,
          actor_last_name: null,
          actor_username: null,
          status: actorId === null ? 'PENDING' : 'APPROVED',
          is_current: true,
        }),
      ]);
      const detail = await repository.getReportById(14, access);
      expect(detail.steps).toHaveLength(1);
      expect(detail.steps[0]).toMatchObject({ actorUserId: actorId, actorName: null });
      expect(detail.currentStep).toMatchObject({ actorUserId: actorId, actorName: null });
    },
  );
});
