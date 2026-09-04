import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/poms-factories/poms-factories.repository', () => ({
  pomsFactoriesRepository: {
    findEditRequestById: jest.fn(),
    cancelEditRequest: jest.fn(),
  },
}));

import { pomsFactoriesRepository } from '../../src/modules/poms-factories/poms-factories.repository';
import { pomsFactoriesService } from '../../src/modules/poms-factories/poms-factories.service';
import {
  POMS_FACTORY_EDIT_REQUEST_STATUS,
  type PomsFactoryEditRequestDTO,
  type PomsFactoryEditRequestStatus,
} from '../../src/modules/poms-factories/poms-factories.types';

const mockedRepository = jest.mocked(pomsFactoriesRepository);
const editScope = { scope: 'OWN_FACTORY' as const };
const actorUserId = 42;

const CANCELLABLE_STATUSES: PomsFactoryEditRequestStatus[] = [
  POMS_FACTORY_EDIT_REQUEST_STATUS.PENDING_REVIEW,
  POMS_FACTORY_EDIT_REQUEST_STATUS.REVISION_REQUESTED,
  POMS_FACTORY_EDIT_REQUEST_STATUS.REVISED_PENDING_REVIEW,
];

describe('pomsFactoriesService.cancelEditRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(CANCELLABLE_STATUSES)('cancels an owned request from %s', async (status) => {
    const current = editRequest(status);
    const cancelled = editRequest(POMS_FACTORY_EDIT_REQUEST_STATUS.CANCELLED, {
      isOpen: false,
      statusLabel: 'ยกเลิก',
    });
    mockedRepository.findEditRequestById.mockResolvedValue(current);
    mockedRepository.cancelEditRequest.mockResolvedValue(cancelled);

    await expect(
      pomsFactoriesService.cancelEditRequest(11, actorUserId, editScope, null),
    ).resolves.toBe(cancelled);

    expect(mockedRepository.findEditRequestById).toHaveBeenCalledWith(11, {
      actorUserId,
      scope: editScope,
      regionalAccess: null,
    });
    expect(mockedRepository.cancelEditRequest).toHaveBeenCalledWith(11, actorUserId);
  });

  it('returns not found without attempting a write when the request is outside factories:edit scope', async () => {
    mockedRepository.findEditRequestById.mockResolvedValue(null);

    await expect(
      pomsFactoriesService.cancelEditRequest(11, actorUserId, editScope, null),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });

    expect(mockedRepository.cancelEditRequest).not.toHaveBeenCalled();
  });

  it('allows only the original creator to cancel the request', async () => {
    mockedRepository.findEditRequestById.mockResolvedValue(
      editRequest(POMS_FACTORY_EDIT_REQUEST_STATUS.PENDING_REVIEW, { createdBy: 99 }),
    );

    await expect(
      pomsFactoriesService.cancelEditRequest(11, actorUserId, editScope, null),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Only the request owner can perform this action',
    });

    expect(mockedRepository.cancelEditRequest).not.toHaveBeenCalled();
  });

  it.each([
    POMS_FACTORY_EDIT_REQUEST_STATUS.CANCELLED,
    POMS_FACTORY_EDIT_REQUEST_STATUS.APPROVED,
    POMS_FACTORY_EDIT_REQUEST_STATUS.REJECTED,
  ])(
    'rejects cancellation from terminal status %s with the transition error contract',
    async (status) => {
      mockedRepository.findEditRequestById.mockResolvedValue(editRequest(status));

      await expect(
        pomsFactoriesService.cancelEditRequest(11, actorUserId, editScope, null),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'INVALID_STATUS_TRANSITION',
        message: 'ไม่สามารถยกเลิกคำขอในสถานะปัจจุบันได้',
        details: {
          id: 11,
          status,
          allowedStatuses: CANCELLABLE_STATUSES,
        },
      });

      expect(mockedRepository.cancelEditRequest).not.toHaveBeenCalled();
    },
  );
});

function editRequest(
  status: PomsFactoryEditRequestStatus,
  overrides: Partial<PomsFactoryEditRequestDTO> = {},
): PomsFactoryEditRequestDTO {
  const profile = {
    eligibleFactoryId: 7,
    factoryId: 'factory-001',
    factoryRegistrationNo: '3-106-33/50สบ',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    industryMainOrder: '00042',
    industryMainOrderLabel: 'ประเภทโรงงานลำดับที่ 00042',
    industrySubOrder: '04201',
    businessActivity: 'ผลิตเคมีภัณฑ์',
    factoryAddress: '99 หมู่ 1',
    provinceName: 'ระยอง',
    industrialEstateName: null,
    latitude: 12.7,
    longitude: 101.1,
    eia: 'มี EIA' as const,
    eiaOther: null,
    projectName: null,
    factoryFrontPhotos: [],
    factoryLogo: null,
    updatedAt: '2026-09-04T00:00:00.000Z',
  };

  return {
    id: 11,
    requestNo: 'PFE-20260904-ABC12345',
    eligibleFactoryId: 7,
    factoryId: 'factory-001',
    factoryRegistrationNo: '3-106-33/50สบ',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    formType: 'BASIC_INFO',
    status,
    statusLabel: status,
    revisionNo: 0,
    isOpen: !(
      [
        POMS_FACTORY_EDIT_REQUEST_STATUS.APPROVED,
        POMS_FACTORY_EDIT_REQUEST_STATUS.REJECTED,
        POMS_FACTORY_EDIT_REQUEST_STATUS.CANCELLED,
      ] as PomsFactoryEditRequestStatus[]
    ).includes(status),
    requestNote: null,
    revisionReason: null,
    officerNote: null,
    currentFactory: profile,
    proposedFactory: profile,
    currentMeasurementPoints: null,
    proposedMeasurementPoints: null,
    submittedBy: actorUserId,
    reviewedBy: null,
    submittedAt: '2026-09-04T00:00:00.000Z',
    reviewedAt: null,
    approvedAt: null,
    createdBy: actorUserId,
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
    events: [],
    ...overrides,
  };
}
