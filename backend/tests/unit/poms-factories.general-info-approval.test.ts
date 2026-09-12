import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import knex from 'knex';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn() }),
}));
jest.mock('../../src/modules/poms-factories/poms-factory-edit-request-number', () => ({
  allocatePomsFactoryEditRequestNo: jest.fn(async () => 'base-00001/2569'),
}));

import { db } from '../../src/config/database';
import {
  pomsFactoriesRepository,
  toPomsFactoryDetailForTests,
} from '../../src/modules/poms-factories/poms-factories.repository';

const transaction = db.transaction as unknown as jest.Mock<
  (...args: unknown[]) => Promise<unknown>
>;
// Use the installed MSSQL driver's real parameter serializer without opening a connection.
const bindingDb = knex({ client: 'mssql' });
afterAll(async () => bindingDb.destroy());

describe('measurement-point approval with general factory information', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [true, 42],
    [true, 55],
    [false, 42],
    [false, 55],
  ] as const)(
    'persists self-approval and its audit actor (basic=%s, actor=%s)',
    async (basicInfo, actorUserId) => {
      const harness = approvalHarness({ basicInfo });
      Object.assign(harness.row, {
        status: 'REVISED_PENDING_REVIEW',
        created_by: 42,
        submitted_by: 55,
      });
      transaction.mockImplementationOnce(harness.runTransaction);

      const result = await pomsFactoriesRepository.reviewEditRequest(
        11,
        { decision: 'APPROVE' },
        actorUserId,
      );

      expect(result).toMatchObject({ status: 'APPROVED', reviewedBy: actorUserId });
      expect(harness.committed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ table: 'cems_wpms_connected_measurement_points' }),
          expect.objectContaining({
            table: 'poms_factory_edit_request_events',
            values: expect.objectContaining({ action: 'APPROVE', actor_user_id: actorUserId }),
          }),
        ]),
      );
    },
  );

  it.each([true, false])('persists approved contacts atomically (basic=%s)', async (basicInfo) => {
    const harness = approvalHarness({ basicInfo, profileChanged: false, pointChanged: false });
    const currentContacts = {
      systemType: basicInfo ? null : 'CEMS',
      contactPersons: [],
      notificationEmails: ['old@example.com'],
      officerNotificationEmails: [],
    };
    const proposedContacts = {
      ...currentContacts,
      contactPersons: [{ name: 'New', phone: '0811111111', email: null, position: null }],
      notificationEmails: [],
    };
    Object.assign(harness.row, {
      current_contacts_json: JSON.stringify(currentContacts),
      proposed_contacts_json: JSON.stringify(proposedContacts),
    });
    transaction.mockImplementationOnce(harness.runTransaction);
    const result = await pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77);
    expect(result).toMatchObject({ currentContacts, proposedContacts, status: 'APPROVED' });
    expect(harness.committed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'cems_wpms_connected_measurement_points',
          values: expect.objectContaining({
            contact_persons_json: JSON.stringify(proposedContacts.contactPersons),
            notification_emails_json: '[]',
          }),
        }),
      ]),
    );
    expect(harness.committed.some((write) => write.table === 'cems_wpms_connection_requests')).toBe(
      false,
    );
    if (!basicInfo) expect(harness.contactScopes).toContainEqual(['system_type', 'CEMS']);
    const event = harness.committed.find(
      (write) => write.table === 'poms_factory_edit_request_events',
    );
    expect(JSON.parse(String(event?.values.factory_snapshot_json))).toMatchObject({
      currentContacts,
      proposedContacts,
    });
  });

  it('rolls contact writes back if a later factory update fails', async () => {
    const harness = approvalHarness({ basicInfo: true, missingEligible: true });
    const before = {
      systemType: null,
      contactPersons: [],
      notificationEmails: ['old@example.com'],
      officerNotificationEmails: [],
    };
    Object.assign(harness.row, {
      current_contacts_json: JSON.stringify(before),
      proposed_contacts_json: JSON.stringify({ ...before, notificationEmails: [] }),
    });
    transaction.mockImplementationOnce(harness.runTransaction);
    await expect(
      pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(harness.attempted.some((write) => 'notification_emails_json' in write.values)).toBe(
      true,
    );
    expect(harness.committed).toEqual([]);
  });

  it('refuses stale contacts without committing approval or any data writes', async () => {
    const harness = approvalHarness({ basicInfo: true });
    const currentContacts = {
      systemType: null,
      contactPersons: [],
      notificationEmails: ['outdated@example.com'],
      officerNotificationEmails: [],
    };
    Object.assign(harness.row, {
      current_contacts_json: JSON.stringify(currentContacts),
      proposed_contacts_json: JSON.stringify({ ...currentContacts, notificationEmails: [] }),
    });
    transaction.mockImplementationOnce(harness.runTransaction);
    await expect(
      pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(harness.committed).toEqual([]);
    expect(harness.attempted).toEqual([]);
  });

  it.each(['create', 'resubmit'] as const)(
    'stores both contact snapshots on %s',
    async (operation) => {
      const harness = approvalHarness({ basicInfo: true, resubmit: operation === 'resubmit' });
      const currentContacts = {
        systemType: null,
        contactPersons: [],
        notificationEmails: ['old@example.com'],
        officerNotificationEmails: [],
      };
      const proposedContacts = { ...currentContacts, notificationEmails: [] };
      const payload = {
        formType: 'BASIC_INFO' as const,
        currentContacts,
        proposedContacts,
        proposedFactory: harness.current,
        proposedMeasurementPoints: null,
      };
      transaction.mockImplementationOnce(harness.runTransaction);
      const result =
        operation === 'create'
          ? await pomsFactoriesRepository.createEditRequest(harness.current, payload, null, 42)
          : await pomsFactoriesRepository.resubmitEditRequest(11, payload, null, 42);
      expect(result).toMatchObject({ currentContacts, proposedContacts });
      expect(harness.row).toMatchObject({
        current_contacts_json: JSON.stringify(currentContacts),
        proposed_contacts_json: JSON.stringify(proposedContacts),
      });
    },
  );

  it('approves BASIC_INFO and exposes all seven updated fields through the live detail mapper', async () => {
    const harness = approvalHarness({ basicInfo: true, pointChanged: false });
    transaction.mockImplementationOnce(harness.runTransaction);
    const result = await pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77);
    expect(result.status).toBe('APPROVED');
    const connectedWrite = harness.committed.find(
      (write) => write.table === 'cems_wpms_connected_measurement_points',
    );
    const eligibleWrite = harness.committed.find((write) => write.table === 'eligible_factories');
    expect(connectedWrite).toBeDefined();
    expect(eligibleWrite?.values).toEqual(
      expect.objectContaining({
        latitude: 13.1,
        longitude: 100.1,
        eia_assessment: 'อื่นๆ',
        eia_other: 'อยู่ระหว่างตรวจสอบ',
        project_name: 'โครงการใหม่',
      }),
    );
    const live = toPomsFactoryDetailForTests([connectedFactoryRow(connectedWrite!.values)], 0);
    expect(live).toEqual(
      expect.objectContaining({
        latitude: 13.1,
        longitude: 100.1,
        eia: 'อื่นๆ',
        eiaOther: 'อยู่ระหว่างตรวจสอบ',
        projectName: 'โครงการใหม่',
        factoryFrontPhotos: [{ fileUrl: 'https://example.com/front.jpg' }],
        factoryLogo: { fileUrl: 'https://example.com/logo.png' },
      }),
    );
    // The request keeps its before/after audit snapshots; currentFactory is not live data.
    expect(result.currentFactory.projectName).toBe('โครงการเดิม');
    expect(result.proposedFactory.projectName).toBe(live.projectName);
    expect(harness.committed.some((write) => 'point_name' in write.values)).toBe(false);
  });

  it.each(['staleProfile', 'missingEligible'] as const)(
    'does not commit BASIC_INFO approval when %s prevents saving',
    async (failure) => {
      const harness = approvalHarness({ basicInfo: true, [failure]: true });
      transaction.mockImplementationOnce(harness.runTransaction);
      await expect(
        pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
      expect(harness.committed).toEqual([]);
    },
  );

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

  it.each(['create', 'resubmit'] as const)(
    'preserves the exact profile milliseconds through SQL parameter binding on %s and approval',
    async (operation) => {
      const timestamp = '2026-08-19T21:54:02.944Z';
      const harness = approvalHarness({
        basicInfo: true,
        pointChanged: false,
        snapshotTime: timestamp,
        resubmit: operation === 'resubmit',
      });
      transaction.mockImplementation(harness.runTransaction);
      const payload = {
        formType: 'BASIC_INFO' as const,
        proposedFactory: { ...harness.current, projectName: 'new project' },
        proposedMeasurementPoints: null,
      };
      if (operation === 'create') {
        await pomsFactoriesRepository.createEditRequest(harness.current, payload, null, 42);
      } else {
        await pomsFactoriesRepository.resubmitEditRequest(11, payload, null, 42);
      }
      expect(harness.row.source_profile_updated_at).toBe(timestamp);
      const result = await pomsFactoriesRepository.reviewEditRequest(
        11,
        { decision: 'APPROVE' },
        77,
      );
      expect(result.status).toBe('APPROVED');
    },
  );

  it.each([
    ['2026-08-19T21:54:02.944Z', '2026-08-19T21:54:02.943Z'],
    ['2026-08-19T21:54:02.445Z', '2026-08-19T21:54:02.446Z'],
    ['2026-08-19T21:54:02.445Z', '2026-08-19T21:54:02.447Z'],
    ['2026-08-19T23:59:59.999Z', '2026-08-20T00:00:00.000Z'],
  ])(
    'approves an unchanged pending snapshot at %s despite legacy DATETIME rounding to %s',
    async (snapshotTime, sourceTime) => {
      const harness = approvalHarness({
        basicInfo: true,
        pointChanged: false,
        snapshotTime,
        sourceTime,
      });
      transaction.mockImplementationOnce(harness.runTransaction);
      const result = await pomsFactoriesRepository.reviewEditRequest(
        11,
        { decision: 'APPROVE' },
        77,
      );
      expect(result.status).toBe('APPROVED');
    },
  );

  it.each(['2026-08-19T21:54:02.943Z', '2026-08-19T21:54:02.945Z'])(
    'still rejects a real one-millisecond live change to %s for a rounded pending version',
    async (liveTime) => {
      const harness = approvalHarness({
        basicInfo: true,
        pointChanged: false,
        snapshotTime: '2026-08-19T21:54:02.944Z',
        sourceTime: '2026-08-19T21:54:02.943Z',
        liveTime,
      });
      transaction.mockImplementationOnce(harness.runTransaction);
      await expect(
        pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
      expect(harness.attempted).toEqual([]);
    },
  );

  it('rejects a source mismatch that is not the snapshot DATETIME conversion', async () => {
    const harness = approvalHarness({
      basicInfo: true,
      snapshotTime: '2026-08-19T21:54:02.944Z',
      sourceTime: '2026-08-19T21:54:02.942Z',
    });
    transaction.mockImplementationOnce(harness.runTransaction);
    await expect(
      pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    expect(harness.attempted).toEqual([]);
  });

  it.each([undefined, 'invalid timestamp'])(
    'keeps the exact stored-version guard for older snapshots with updatedAt = %s',
    async (updatedAt) => {
      for (const staleProfile of [false, true]) {
        const harness = approvalHarness({ basicInfo: true, staleProfile });
        harness.row.current_factory_json = JSON.stringify({ ...harness.current, updatedAt });
        transaction.mockImplementationOnce(harness.runTransaction);
        const result = pomsFactoriesRepository.reviewEditRequest(11, { decision: 'APPROVE' }, 77);
        if (staleProfile) {
          await expect(result).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
          expect(harness.attempted).toEqual([]);
        } else {
          await expect(result).resolves.toMatchObject({ status: 'APPROVED' });
        }
      }
    },
  );

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
    basicInfo?: boolean;
    profileChanged?: boolean;
    pointChanged?: boolean;
    staleProfile?: boolean;
    missingEligible?: boolean;
    snapshotTime?: string;
    sourceTime?: string;
    liveTime?: string;
    resubmit?: boolean;
  } = {},
) {
  const currentRow = connectedFactoryRow(
    options.snapshotTime ? { updated_at: options.snapshotTime } : {},
  );
  const current = toPomsFactoryDetailForTests([currentRow], 0);
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
          ...(options.basicInfo
            ? {
                eia: 'อื่นๆ' as const,
                eiaOther: 'อยู่ระหว่างตรวจสอบ',
                factoryFrontPhotos: [{ fileUrl: 'https://example.com/front.jpg' }],
                factoryLogo: { fileUrl: 'https://example.com/logo.png' },
              }
            : {}),
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
    form_type: options.basicInfo ? 'BASIC_INFO' : 'MEASUREMENT_POINTS',
    status: options.resubmit ? 'REVISION_REQUESTED' : 'PENDING_REVIEW',
    revision_no: 0,
    is_open: 1,
    current_factory_json: JSON.stringify(current),
    proposed_factory_json: JSON.stringify(proposed),
    current_measurement_points_json: JSON.stringify(current.measurementPoints),
    proposed_measurement_points_json: JSON.stringify(proposedPoints),
    source_profile_updated_at: options.staleProfile
      ? '2020-01-01T00:00:00.000Z'
      : (options.sourceTime ?? current.updatedAt),
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
  const contactSource = {
    contact_name: 'Old',
    contact_phone: '0800000000',
    contact_email: null,
    contact_persons_json: '[]',
    notification_emails_json: '["old@example.com"]',
    officer_notification_emails_json: null,
    live_contact_persons_json: '[]',
    live_notification_emails_json: null,
    information_provider_name: null,
    information_provider_position: null,
  };
  const contactScopes: unknown[][] = [];
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
      chain.where = jest.fn((...args: unknown[]) => {
        if (table === 'cems_wpms_connected_measurement_points') contactScopes.push(args);
        return chain;
      });
      chain.first = async (column?: string) =>
        table === 'cems_wpms_connected_measurement_points as cp' || table === 'locked-profile'
          ? contactSource
          : column === 'id'
            ? undefined
            : row;
      chain.update = async (values: Record<string, unknown>) => {
        attempted.push({ table, values });
        if (table === 'eligible_factories' && options.missingEligible) return 0;
        if (table === 'poms_factory_edit_requests') saveRequest(values);
        return 1;
      };
      chain.insert = (values: Record<string, unknown>) => {
        attempted.push({ table, values });
        if (table === 'poms_factory_edit_requests') saveRequest(values);
        return {
          returning: async () => [{ id: 11 }],
          then: (resolve: (value: unknown) => void) => resolve(1),
        };
      };
      chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(
          table === 'locked-profile'
            ? [{ ...currentRow, updated_at: options.liveTime ?? current.updatedAt }]
            : [],
        ).then(resolve, reject);
      return chain;
    },
    {
      fn: { now: () => current.updatedAt },
      raw: () => 'locked-profile',
    },
  );
  function saveRequest(values: Record<string, unknown>) {
    Object.assign(row, values);
    if ('source_profile_updated_at' in values) {
      row.source_profile_updated_at = roundTripProfileTimestamp(values.source_profile_updated_at);
    }
  }
  return {
    current,
    row,
    contactSource,
    contactScopes,
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

function roundTripProfileTimestamp(value: unknown): string {
  const client = bindingDb.client as typeof bindingDb.client & {
    _typeForBinding(value: unknown): [
      unknown,
      {
        name: string;
        generateParameterData(
          parameter: { value: unknown },
          options: { useUTC: boolean },
        ): Iterable<Buffer>;
      },
    ];
  };
  const [parameter, type] = client._typeForBinding(value);
  if (type.name === 'DateTime') {
    const bytes = Buffer.concat([
      ...type.generateParameterData({ value: parameter }, { useUTC: true }),
    ]);
    return new Date(
      Date.UTC(1900, 0, 1) +
        bytes.readInt32LE(0) * 86_400_000 +
        (bytes.readUInt32LE(4) * 1_000) / 300,
    ).toISOString();
  }
  expect(type.name).toBe('NVarChar');
  expect(parameter).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/);
  return new Date(`${parameter}Z`).toISOString();
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
