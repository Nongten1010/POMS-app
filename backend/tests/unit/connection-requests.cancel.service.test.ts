import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    findById: jest.fn(),
    cancelOperatorRequest: jest.fn(),
  },
}));

jest.mock('../../src/modules/device-connections/device-connections.service', () => ({
  deviceConnectionsService: {},
}));

jest.mock('../../src/modules/parameter-values/parameter-values.service', () => ({
  parameterValuesService: {},
}));

jest.mock('../../src/modules/eligible-factories/eligible-factories.service', () => ({
  eligibleFactoriesService: {},
}));

jest.mock('../../src/config/logger', () => ({
  logger: { warn: jest.fn() },
}));

import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import {
  CONNECTION_REQUEST_STATUS,
  CONNECTION_REQUEST_SUBMISSION_SOURCE,
  type ConnectionRequestDTO,
  type ConnectionRequestStatus,
} from '../../src/modules/connection-requests/connection-requests.types';

const mockedRepository = jest.mocked(connectionRequestsRepository);
const actorUserId = 42;

const CANCELLABLE_STATUSES: ConnectionRequestStatus[] = [
  CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
  CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
  CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
  CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
  CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED,
];

describe('connectionRequestsService.cancel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(CANCELLABLE_STATUSES)('cancels an owned operator request from %s', async (status) => {
    const current = requestDto({ status });
    const canceled = requestDto({
      status: CONNECTION_REQUEST_STATUS.CANCELED,
      revisionReason: 'ยุติโครงการติดตั้งระบบตรวจวัด',
    });
    mockedRepository.findById.mockResolvedValue(current);
    mockedRepository.cancelOperatorRequest.mockResolvedValue(canceled);

    await expect(
      connectionRequestsService.cancel(1, { reason: 'ยุติโครงการติดตั้งระบบตรวจวัด' }, actorUserId),
    ).resolves.toBe(canceled);

    expect(mockedRepository.cancelOperatorRequest).toHaveBeenCalledWith(
      1,
      actorUserId,
      'ยุติโครงการติดตั้งระบบตรวจวัด',
    );
  });

  it('normalizes an omitted reason to null', async () => {
    const current = requestDto();
    const canceled = requestDto({ status: CONNECTION_REQUEST_STATUS.CANCELED });
    mockedRepository.findById.mockResolvedValue(current);
    mockedRepository.cancelOperatorRequest.mockResolvedValue(canceled);

    await connectionRequestsService.cancel(1, {}, actorUserId);

    expect(mockedRepository.cancelOperatorRequest).toHaveBeenCalledWith(1, actorUserId, null);
  });

  it('returns an already canceled owned request without writing another history row', async () => {
    const canceled = requestDto({
      status: CONNECTION_REQUEST_STATUS.CANCELED,
      revisionReason: 'เหตุผลเดิม',
    });
    mockedRepository.findById.mockResolvedValue(canceled);

    await expect(
      connectionRequestsService.cancel(1, { reason: 'เหตุผลใหม่' }, actorUserId),
    ).resolves.toBe(canceled);

    expect(mockedRepository.cancelOperatorRequest).not.toHaveBeenCalled();
  });

  it('rejects a request owned by another operator before revealing cancellation state', async () => {
    mockedRepository.findById.mockResolvedValue(requestDto({ createdBy: 99 }));

    await expect(connectionRequestsService.cancel(1, {}, actorUserId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Only the request owner can perform this action',
    });
    expect(mockedRepository.cancelOperatorRequest).not.toHaveBeenCalled();
  });

  it('rejects officer-direct requests even if their stored status is malformed as non-terminal', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        submissionSource: CONNECTION_REQUEST_SUBMISSION_SOURCE.OFFICER_DIRECT_API,
      }),
    );

    await expect(connectionRequestsService.cancel(1, {}, actorUserId)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(mockedRepository.cancelOperatorRequest).not.toHaveBeenCalled();
  });

  it('rejects a connected request with a conflict and leaves persistence untouched', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({ status: CONNECTION_REQUEST_STATUS.CONNECTED }),
    );

    await expect(connectionRequestsService.cancel(1, {}, actorUserId)).rejects.toMatchObject({
      code: 'CONFLICT',
      details: {
        currentStatus: CONNECTION_REQUEST_STATUS.CONNECTED,
        allowedStatuses: CANCELLABLE_STATUSES,
      },
    });
    expect(mockedRepository.cancelOperatorRequest).not.toHaveBeenCalled();
  });
});

function requestDto(overrides: Partial<ConnectionRequestDTO> = {}): ConnectionRequestDTO {
  return {
    id: 1,
    requestNo: 'CEMS-69-00001',
    submissionSource: CONNECTION_REQUEST_SUBMISSION_SOURCE.OPERATOR_FORM,
    requestType: 'NEW_CONNECTION',
    requestTypeLabel: 'ขอเชื่อมต่อใหม่',
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryRegistrationNo: '3-106-33/50สบ',
    systemType: 'CEMS',
    status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    statusLabel: 'รอพิจารณาแบบ',
    createdBy: actorUserId,
    revisionReason: null,
    measurementPoints: [],
    statusHistory: [],
    ...overrides,
  } as ConnectionRequestDTO;
}
