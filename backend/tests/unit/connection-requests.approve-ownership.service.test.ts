import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import {
  CONNECTION_REQUEST_STATUS,
  CONNECTION_REQUEST_TYPE,
  type ConnectionRequestDTO,
} from '../../src/modules/connection-requests/connection-requests.types';
import { createKnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

let fixture: Awaited<ReturnType<typeof createKnexSqliteFixture>>;
let current: ConnectionRequestDTO;
const previousMode = env.FACTORY_PROFILE_MODE;

beforeEach(async () => {
  env.FACTORY_PROFILE_MODE = 'legacy';
  current = requestDto({ factoryId: 'FID-17', createdBy: 99 });
  fixture = await createKnexSqliteFixture(db, {
    cems_wpms_connection_requests: [
      { id: 1, factory_id: 'FID-17', eligible_factory_id: 17, created_by: 99, deleted_at: null },
      { id: 2, factory_id: 'FID-18', eligible_factory_id: 18, created_by: 42, deleted_at: null },
    ],
    eligible_factories: [17, 18].map((id) => ({
      id,
      source_factory_id: `FID-${id}`,
      factory_registration_no_new: `REG-${id}`,
      factory_registration_no_old: `OLD-${id}`,
      deleted_at: null,
    })),
    factories: [17, 18].map((id) => ({
      id,
      fid: `FID-${id}`,
      code: `REG-${id}`,
      juristic_id: 'J-1',
      deleted_at: null,
    })),
    user_factory_access: [{ user_id: 42, factory_id: 17, revoked_at: null }],
    user_juristics: [{ user_id: 43, juristic_id: 'J-1', revoked_at: null }],
    cems_wpms_request_factory_snapshots: [
      {
        request_id: 1,
        region_name: 'ภาคเหนือ',
        region_code: 'ภาคเหนือ',
        province_name: 'เชียงใหม่',
        province_code: '1050',
        industrial_estate_code: 'IE-1',
        factory_main_type_code: '88',
        deleted_at: null,
      },
    ],
  });
  jest
    .spyOn(connectionRequestsRepository, 'findById')
    .mockImplementation(async (id) => ({ ...current, id, factoryId: `FID-${id === 1 ? 17 : 18}` }));
  jest
    .spyOn(connectionRequestsRepository, 'updateStatus')
    .mockImplementation(async (_id, status) => ({ ...current, status }));
  jest
    .spyOn(connectionRequestsRepository, 'connect')
    .mockResolvedValue({ ...current, status: CONNECTION_REQUEST_STATUS.CONNECTED });
});

afterEach(() => {
  fixture?.close();
  jest.restoreAllMocks();
  env.FACTORY_PROFILE_MODE = previousMode;
});

const actions = ['approve', 'revise', 'return', 'verify'] as const;

async function act(action: (typeof actions)[number], actorUserId: number, id = 1) {
  if (action === 'return' || action === 'verify') {
    current.status = CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED;
    current.connectionDueAt = '2099-01-01T00:00:00.000Z';
  }
  const scope = { scope: 'OWN_FACTORY' as const, region: null, province: null };
  // A saved OWN_FACTORY grant is independent of the legacy officer profile area.
  const profile = { regions: ['ภาคใต้'] };
  if (action === 'verify')
    return connectionRequestsService.verifyConnection(id, {}, actorUserId, scope, profile);
  return connectionRequestsService.changeStatus(
    id,
    action === 'approve'
      ? { action: 'APPROVE_FORM' }
      : action === 'revise'
        ? { action: 'REQUEST_REVISION', revisionReason: 'เพิ่มเติมแบบ' }
        : { action: 'RETURN_TO_WAITING_CONNECTION' },
    actorUserId,
    scope,
    profile,
  );
}

describe('approval rights on assigned connection factories', () => {
  it.each(actions)(
    'permits %s with a live direct assignment even when another user created the request',
    async (action) => {
      await expect(act(action, 42)).resolves.toHaveProperty('id', 1);
    },
  );

  it.each(actions)('permits %s with a live juristic assignment', async (action) => {
    await expect(act(action, 43)).resolves.toHaveProperty('id', 1);
  });

  it.each(actions)('denies %s after the direct assignment is revoked', async (action) => {
    fixture.execute("UPDATE user_factory_access SET revoked_at = 'revoked' WHERE user_id = 42");
    await expect(act(action, 42)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(connectionRequestsRepository.updateStatus).not.toHaveBeenCalled();
    expect(connectionRequestsRepository.connect).not.toHaveBeenCalled();
  });

  it.each(actions)(
    'does not let request authorship expand %s to a sibling of an assigned factory',
    async (action) => {
      await expect(act(action, 42, 2)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(connectionRequestsRepository.updateStatus).not.toHaveBeenCalled();
      expect(connectionRequestsRepository.connect).not.toHaveBeenCalled();
    },
  );

  it('accepts a scalar ownership scope with a live direct assignment', async () => {
    await expect(
      connectionRequestsService.review(1, { decision: 'APPROVE_DESIGN' }, 42, 'OWN_FACTORY'),
    ).resolves.toHaveProperty('id', 1);
  });

  it('denies approval when no active factory assignment exists', async () => {
    await expect(act('approve', 99)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(connectionRequestsRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('denies approval for a deleted supporting factory despite an active assignment', async () => {
    fixture.execute("UPDATE factories SET deleted_at = 'deleted' WHERE id = 17");
    await expect(act('approve', 42)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(connectionRequestsRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('retains explicit area filters and fails closed for unsupported approval scopes', async () => {
    await expect(
      connectionRequestsRepository.canApproveRequest(1, {
        actorUserId: 99,
        scope: { scope: 'IN_PROVINCE', province: '1050' },
      }),
    ).resolves.toBe(true);
    await expect(
      connectionRequestsRepository.canApproveRequest(1, {
        actorUserId: 99,
        scope: { scope: 'IN_PROVINCE', province: '1080' },
      }),
    ).resolves.toBe(false);
    await expect(
      connectionRequestsRepository.canApproveRequest(1, {
        actorUserId: 99,
        scope: 'ALL',
        regionalAccess: { regions: ['ภาคใต้'] },
      }),
    ).resolves.toBe(true);
    for (const scope of [
      undefined,
      null,
      'INVALID',
      'IN_PROVINCE',
      { scope: 'IN_PROVINCE' as const },
    ]) {
      await expect(
        connectionRequestsRepository.canApproveRequest(1, { actorUserId: 42, scope }),
      ).resolves.toBe(false);
    }
  });

  it('still rejects an invalid business status after ownership succeeds', async () => {
    current.status = CONNECTION_REQUEST_STATUS.CONNECTED;
    await expect(act('approve', 42)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(connectionRequestsRepository.updateStatus).not.toHaveBeenCalled();
  });
});

function requestDto(overrides: Partial<ConnectionRequestDTO> = {}): ConnectionRequestDTO {
  return {
    id: 1,
    requestNo: 'CEMS-0001/2569',
    requestType: CONNECTION_REQUEST_TYPE.NEW_CONNECTION,
    requestTypeLabel: 'ขอเชื่อมต่อใหม่',
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryRegistrationNo: '3-106-33/50สบ',
    industryMainOrder: '106',
    industrySubOrder: '33',
    businessActivity: 'ผลิตเคมีภัณฑ์',
    eia: 'มี',
    eiaOther: null,
    hasEia: true,
    projectName: 'โครงการทดสอบ CEMS',
    address: '99 หมู่ 1 ตำบลทดสอบ อำเภอเมือง จังหวัดสระบุรี',
    latitude: 13.7563,
    longitude: 100.5018,
    systemType: 'CEMS',
    status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    statusLabel: 'รอพิจารณาแบบ',
    contactName: 'สมชาย ใจดี',
    contactPhone: '0812345678',
    contactEmail: 'ops@example.com',
    contactPersons: [
      {
        name: 'สมชาย ใจดี',
        phone: '0812345678',
        email: 'ops@example.com',
        position: 'ผู้จัดการสิ่งแวดล้อม',
      },
    ],
    notificationEmails: ['ops@example.com'],
    officerNotificationEmails: ['officer@example.com'],
    informationProviderName: 'ธนากรณ์ ศรีคอม',
    informationProviderPosition: 'ผู้จัดการโรงงาน',
    remarks: null,
    revisionReason: null,
    officerNote: null,
    connectionDueAt: null,
    confirmedAt: null,
    verifiedAt: null,
    measurementPoints: [],
    statusHistory: [],
    statusDurationSummary: {
      startedAt: null,
      startDate: null,
      startStatus: null,
      startStatusLabel: null,
      endedAt: null,
      endDate: null,
      endStatus: null,
      endStatusLabel: null,
      isTerminal: false,
      terminalStatuses: [CONNECTION_REQUEST_STATUS.CONNECTED, CONNECTION_REQUEST_STATUS.CANCELED],
      totalDurationDays: null,
      totalDurationText: null,
    },
    createdBy: 42,
    createdAt: '2026-05-27T10:00:00.000Z',
    updatedAt: '2026-05-27T10:00:00.000Z',
    ...overrides,
    industryMainOrderLabel: overrides.industryMainOrderLabel ?? null,
    regionCode: overrides.regionCode ?? null,
    regionName: overrides.regionName ?? null,
    provinceCode: overrides.provinceCode ?? null,
    provinceName: overrides.provinceName ?? null,
    districtCode: overrides.districtCode ?? null,
    districtName: overrides.districtName ?? null,
    subdistrictCode: overrides.subdistrictCode ?? null,
    subdistrictName: overrides.subdistrictName ?? null,
    industrialEstateCode: overrides.industrialEstateCode ?? null,
    industrialEstateName: overrides.industrialEstateName ?? null,
    submissionSource: overrides.submissionSource ?? 'OPERATOR_FORM',
  };
}
