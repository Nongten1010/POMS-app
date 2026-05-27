import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    create: jest.fn(),
    findById: jest.fn(),
    replaceForm: jest.fn(),
    updateStatus: jest.fn(),
    list: jest.fn(),
  },
}));

import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import {
  CONNECTION_REQUEST_STATUS,
  type ConnectionRequestDTO,
  type CreateConnectionRequestInput,
} from '../../src/modules/connection-requests/connection-requests.types';

const mockedRepository = jest.mocked(connectionRequestsRepository);

describe('connectionRequestsService', () => {
  const actorUserId = 42;
  const now = new Date('2026-05-27T10:00:00.000Z');
  const dueAt = new Date('2026-06-26T10:00:00.000Z').toISOString();
  const payload: CreateConnectionRequestInput = {
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryRegistrationNo: '3-106-33/50สบ',
    systemType: 'CEMS',
    contactName: 'สมชาย ใจดี',
    contactPhone: '0812345678',
    contactEmail: 'ops@example.com',
    measurementPoints: [
      {
        pointName: 'ปล่องระบาย A',
        pointCode: 'STACK-A',
        pointType: 'STACK',
        latitude: 13.7563,
        longitude: 100.5018,
        parameters: ['NOx', 'SO2'],
        description: 'จุดตรวจวัดหลัก',
      },
    ],
    remarks: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    connectionRequestsService.setClockForTests(() => now);
  });

  it('creates a request in pending design review status', async () => {
    mockedRepository.create.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
        connectionDueAt: null,
        createdBy: actorUserId,
      }),
    );

    const result = await connectionRequestsService.create(payload, actorUserId);

    expect(mockedRepository.create).toHaveBeenCalledWith(
      payload,
      actorUserId,
      CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    );
    expect(result.statusLabel).toBe('รอพิจารณาแบบ');
  });

  it('moves an approved design to waiting connection with a 30 day due date', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
        createdBy: actorUserId,
      }),
    );
    mockedRepository.updateStatus.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        connectionDueAt: dueAt,
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.review(1, { decision: 'APPROVE_DESIGN' }, 7);

    expect(mockedRepository.updateStatus).toHaveBeenCalledWith(
      1,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      7,
      {
        officerNote: null,
        revisionReason: null,
        connectionDueAt: dueAt,
      },
    );
  });

  it('moves a request back to factory revision when officer requests changes', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
        createdBy: actorUserId,
      }),
    );
    mockedRepository.updateStatus.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.review(
      1,
      { decision: 'REQUEST_REVISION', revisionReason: 'เพิ่มรายละเอียดจุดตรวจวัด' },
      7,
    );

    expect(mockedRepository.updateStatus).toHaveBeenCalledWith(
      1,
      CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
      7,
      {
        officerNote: null,
        revisionReason: 'เพิ่มรายละเอียดจุดตรวจวัด',
      },
    );
  });

  it('allows the owner to resubmit a revised form', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
        createdBy: actorUserId,
      }),
    );
    mockedRepository.replaceForm.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.resubmit(1, payload, actorUserId);

    expect(mockedRepository.replaceForm).toHaveBeenCalledWith(
      1,
      payload,
      actorUserId,
      CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
    );
  });

  it('rejects connection confirmation after the 30 day due date', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        connectionDueAt: '2026-05-01T00:00:00.000Z',
        createdBy: actorUserId,
      }),
    );

    await expect(
      connectionRequestsService.confirmConnection(
        1,
        { confirmedAt: now.toISOString() },
        actorUserId,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('moves confirmed requests to connected after officer verification', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED,
        createdBy: actorUserId,
      }),
    );
    mockedRepository.updateStatus.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.CONNECTED,
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.verifyConnection(
      1,
      { verifiedAt: '2026-05-27T11:00:00.000Z' },
      7,
    );

    expect(mockedRepository.updateStatus).toHaveBeenCalledWith(
      1,
      CONNECTION_REQUEST_STATUS.CONNECTED,
      7,
      {
        verifiedAt: '2026-05-27T11:00:00.000Z',
        officerNote: null,
      },
    );
  });
});

function requestDto(overrides: Partial<ConnectionRequestDTO> = {}): ConnectionRequestDTO {
  return {
    id: 1,
    requestNo: 'CR-20260527-0001',
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryRegistrationNo: '3-106-33/50สบ',
    systemType: 'CEMS',
    status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    statusLabel: 'รอพิจารณาแบบ',
    contactName: 'สมชาย ใจดี',
    contactPhone: '0812345678',
    contactEmail: 'ops@example.com',
    remarks: null,
    revisionReason: null,
    officerNote: null,
    connectionDueAt: null,
    confirmedAt: null,
    verifiedAt: null,
    measurementPoints: [],
    statusHistory: [],
    createdBy: 42,
    createdAt: '2026-05-27T10:00:00.000Z',
    updatedAt: '2026-05-27T10:00:00.000Z',
    ...overrides,
  };
}
