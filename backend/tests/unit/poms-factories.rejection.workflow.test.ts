import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn() }),
}));

import { db } from '../../src/config/database';
import { pomsFactoriesService } from '../../src/modules/poms-factories/poms-factories.service';
import { reviewPomsFactoryEditRequestSchema } from '../../src/modules/poms-factories/poms-factories.validator';

const mockedDb = db as unknown as jest.Mock<(...args: unknown[]) => unknown> & {
  transaction: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};

describe('POMS factory edit request rejection workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an approved historical request without a reason and keeps its history readable', async () => {
    rejectionDatabase('APPROVED');

    const result = await pomsFactoriesService.reviewEditRequest(
      11,
      { decision: 'REJECT' },
      77,
      { roles: ['admin'] },
      { scope: 'ALL' },
    );

    expect(result).toMatchObject({
      status: 'REJECTED',
      isOpen: false,
      officerNote: null,
      approvedAt: '2026-09-04T00:00:00.000Z',
    });
    const reloaded = await pomsFactoriesService.getEditRequest(11, 77, { scope: 'ALL' });
    expect(reloaded).toMatchObject({
      status: 'REJECTED',
      events: [
        { action: 'APPROVE', fromStatus: 'PENDING_REVIEW', toStatus: 'APPROVED' },
        { action: 'REJECT', fromStatus: 'APPROVED', toStatus: 'REJECTED', note: null },
      ],
    });
  });

  it('does not reject a request that leaves approval scope after the initial read', async () => {
    rejectionDatabase('PENDING_REVIEW', { transactionAccessible: false });

    await expect(
      pomsFactoriesService.reviewEditRequest(
        11,
        { decision: 'REJECT' },
        77,
        { roles: ['admin'] },
        { scope: 'ALL' },
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

    const reloaded = await pomsFactoriesService.getEditRequest(11, 77, { scope: 'ALL' });
    expect(reloaded.status).toBe('PENDING_REVIEW');
    expect(reloaded.events).toHaveLength(1);
  });

  it.each([
    'PENDING_REVIEW',
    'REVISION_REQUESTED',
    'REVISED_PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
  ])('allows rejection from %s and records the actual previous status', async (status) => {
    rejectionDatabase(status);

    const result = await pomsFactoriesService.reviewEditRequest(
      11,
      reviewPomsFactoryEditRequestSchema.parse({ decision: 'REJECT', officerNote: '   ' }),
      77,
      { roles: ['admin'] },
      { scope: 'ALL' },
    );

    expect(result).toMatchObject({ status: 'REJECTED', isOpen: false, officerNote: null });
    expect(result.events.at(-1)).toMatchObject({
      action: 'REJECT',
      fromStatus: status,
      toStatus: 'REJECTED',
      note: null,
      actorUserId: 77,
    });
  });

  it('keeps an optional officer note in the request and rejection event', async () => {
    rejectionDatabase('CANCELLED');

    const result = await pomsFactoriesService.reviewEditRequest(
      11,
      reviewPomsFactoryEditRequestSchema.parse({
        decision: 'REJECT',
        officerNote: '  ข้อมูลไม่ตรงกับหลักฐาน  ',
      }),
      77,
      { roles: ['admin'] },
      { scope: 'ALL' },
    );

    expect(result.officerNote).toBe('ข้อมูลไม่ตรงกับหลักฐาน');
    expect(result.events.at(-1)?.note).toBe('ข้อมูลไม่ตรงกับหลักฐาน');
  });

  it('rejects using the status locked after the initial read', async () => {
    rejectionDatabase('PENDING_REVIEW', { lockedStatus: 'CANCELLED' });

    const result = await pomsFactoriesService.reviewEditRequest(
      11,
      { decision: 'REJECT' },
      77,
      { roles: ['admin'] },
      { scope: 'ALL' },
    );

    expect(result.events.at(-1)).toMatchObject({
      action: 'REJECT',
      fromStatus: 'CANCELLED',
      toStatus: 'REJECTED',
    });
  });

  it('still requires an admin role for unrestricted rejection', async () => {
    rejectionDatabase('APPROVED');

    await expect(
      pomsFactoriesService.reviewEditRequest(
        11,
        { decision: 'REJECT' },
        77,
        { roles: ['monitoring_kpm'] },
        { scope: 'ALL' },
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

    const reloaded = await pomsFactoriesService.getEditRequest(11, 77, { scope: 'ALL' });
    expect(reloaded.status).toBe('APPROVED');
    expect(reloaded.events).toHaveLength(1);
  });

  it.each(['APPROVE', 'REQUEST_REVISION'] as const)(
    'keeps the status restriction for %s',
    async (decision) => {
      rejectionDatabase('APPROVED');

      await expect(
        pomsFactoriesService.reviewEditRequest(
          11,
          { decision, revisionReason: decision === 'REQUEST_REVISION' ? 'แก้ไขข้อมูล' : null },
          77,
          { roles: ['admin'] },
          { scope: 'ALL' },
        ),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    },
  );
});

function rejectionDatabase(
  status: string,
  options: { transactionAccessible?: boolean; lockedStatus?: string } = {},
) {
  const profile = {
    eligibleFactoryId: 7,
    factoryId: 'factory-001',
    factoryRegistrationNo: '3-106-33/50สบ',
    factoryName: 'โรงงานตัวอย่าง',
    factoryAddress: '99 หมู่ 1',
    projectName: 'โครงการที่อนุมัติแล้ว',
    updatedAt: '2026-09-04T00:00:00.000Z',
  };
  const row: Record<string, unknown> = {
    id: 11,
    request_no: 'PFE-20260904-ABC12345',
    eligible_factory_id: 7,
    factory_id: 'factory-001',
    factory_registration_no: '3-106-33/50สบ',
    factory_name: profile.factoryName,
    form_type: 'BASIC_INFO',
    status,
    revision_no: 0,
    is_open: ['APPROVED', 'REJECTED', 'CANCELLED'].includes(status) ? 0 : 1,
    current_factory_json: JSON.stringify({ ...profile, projectName: 'โครงการเก่า' }),
    proposed_factory_json: JSON.stringify(profile),
    current_measurement_points_json: null,
    proposed_measurement_points_json: null,
    source_profile_updated_at: profile.updatedAt,
    request_note: null,
    revision_reason: null,
    officer_note: null,
    submitted_by: 42,
    reviewed_by: 77,
    submitted_at: profile.updatedAt,
    reviewed_at: profile.updatedAt,
    approved_at: status === 'APPROVED' ? profile.updatedAt : null,
    created_by: 42,
    created_at: profile.updatedAt,
    updated_at: profile.updatedAt,
  };
  const events: Record<string, unknown>[] = [
    {
      id: 1,
      request_id: 11,
      action: 'APPROVE',
      from_status: 'PENDING_REVIEW',
      to_status: 'APPROVED',
      actor_user_id: 77,
      event_note: 'ข้อมูลถูกต้อง',
      created_at: profile.updatedAt,
    },
  ];

  const query = (table: string, inTransaction = false) => {
    if (
      ![
        'poms_factory_edit_requests',
        'poms_factory_edit_requests as req',
        'poms_factory_edit_request_events',
        'cems_wpms_connected_measurement_points as cp',
      ].includes(table)
    )
      throw new Error(`Rejection must not access or write unrelated live data: ${table}`);
    const chain: Record<string, unknown> = {};
    let scopedRequest = false;
    for (const method of [
      'innerJoin',
      'leftJoin',
      'select',
      'where',
      'whereNull',
      'whereIn',
      'forUpdate',
      'orderBy',
    ])
      chain[method] = jest.fn(() => chain);
    chain.innerJoin = jest.fn(() => {
      scopedRequest = table === 'poms_factory_edit_requests as req';
      return chain;
    });
    chain.first = jest.fn(async () =>
      table === 'cems_wpms_connected_measurement_points as cp' ||
      (inTransaction && scopedRequest && options.transactionAccessible === false)
        ? undefined
        : { ...row },
    );
    chain.update = jest.fn(async (values: Record<string, unknown>) => {
      if (table !== 'poms_factory_edit_requests') throw new Error('Unexpected live data write');
      Object.assign(row, values);
      return 1;
    });
    chain.insert = jest.fn(async (values: Record<string, unknown>) => {
      if (table !== 'poms_factory_edit_request_events')
        throw new Error('Unexpected live data write');
      events.push({ ...values, id: events.length + 1, created_at: profile.updatedAt });
      return 1;
    });
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(table === 'poms_factory_edit_request_events' ? [...events] : []).then(
        resolve,
        reject,
      );
    return chain;
  };
  const transaction = Object.assign((table: string) => query(table, true), {
    fn: { now: () => profile.updatedAt },
  });
  mockedDb.mockImplementation((...args) => query(String(args[0])));
  mockedDb.transaction.mockImplementation(async (...args) => {
    if (options.lockedStatus) row.status = options.lockedStatus;
    const callback = args[0] as (trx: typeof transaction) => Promise<unknown>;
    return callback(transaction);
  });
}
