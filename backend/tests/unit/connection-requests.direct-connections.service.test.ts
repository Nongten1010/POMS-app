import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    findFactoryGeneral: jest.fn(),
    findDirectConnectionFactory: jest.fn(),
    createDirectConnection: jest.fn(),
  },
}));

import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';

const mockedRepository = connectionRequestsRepository as unknown as {
  findFactoryGeneral: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
  findDirectConnectionFactory: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
  createDirectConnection: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};
const directService = connectionRequestsService as unknown as {
  createDirectConnection: (input: unknown, actor: DirectActor) => Promise<unknown>;
};

interface DirectActor {
  actorUserId: number;
  userType: 'citizen' | 'operator' | 'officer' | 'admin';
  roles: string[];
  scope: { scope: 'ALL' };
  regionalAccess?: { regions?: string[] };
}

describe('connectionRequestsService.createDirectConnection', () => {
  const actor: DirectActor = {
    actorUserId: 42,
    userType: 'officer',
    roles: ['monitoring_kpm'],
    scope: { scope: 'ALL' },
  };
  const canonicalFactory = {
    factoryId: 'canonical-factory-id',
    factoryName: 'โรงงานจากฐานข้อมูล',
    newRegistrationNo: 'REG-CANONICAL',
    isEligible: true,
    eligibleFactoryId: 17,
  };
  const created = {
    id: 91,
    requestNo: 'OLDW-69-00001',
    status: 'CONNECTED',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepository.findFactoryGeneral.mockResolvedValue(canonicalFactory);
    mockedRepository.findDirectConnectionFactory.mockResolvedValue(canonicalFactory);
    mockedRepository.createDirectConnection.mockResolvedValue(created);
  });

  it('checks factory scope, canonicalizes factory identity, and keeps the officer point code', async () => {
    const result = await directService.createDirectConnection(validInput(), actor);

    expect(mockedRepository.findFactoryGeneral).toHaveBeenCalledWith('factory-input', {
      actorUserId: 42,
      scope: { scope: 'ALL' },
      regionalAccess: undefined,
    });
    expect(mockedRepository.createDirectConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'ADD_MEASUREMENT_POINT',
        factoryId: 'canonical-factory-id',
        factoryName: 'โรงงานจากฐานข้อมูล',
        factoryRegistrationNo: 'REG-CANONICAL',
        eligibleFactoryId: 17,
        measurementPoints: [expect.objectContaining({ pointCode: 'free-form/ก-01' })],
      }),
      42,
    );
    expect(result).toBe(created);
  });

  it('rejects a non-officer actor even if the permission middleware were bypassed', async () => {
    await expect(
      directService.createDirectConnection(validInput(), {
        ...actor,
        userType: 'operator',
        roles: ['factory_operator'],
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

    expect(mockedRepository.findFactoryGeneral).not.toHaveBeenCalled();
    expect(mockedRepository.createDirectConnection).not.toHaveBeenCalled();
  });

  it('rejects more than one point when the service is called without HTTP validation', async () => {
    const input = validInput();
    await expect(
      directService.createDirectConnection(
        { ...input, measurementPoints: [input.measurementPoints[0], input.measurementPoints[0]] },
        actor,
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });

    expect(mockedRepository.findFactoryGeneral).not.toHaveBeenCalled();
  });

  it('rejects a missing point code when the service is called without HTTP validation', async () => {
    const input = validInput();
    await expect(
      directService.createDirectConnection(
        {
          ...input,
          measurementPoints: [{ ...input.measurementPoints[0], pointCode: null }],
        },
        actor,
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });

    expect(mockedRepository.findFactoryGeneral).not.toHaveBeenCalled();
  });

  it('does not create anything when the selected factory is outside the officer scope', async () => {
    mockedRepository.findFactoryGeneral.mockResolvedValueOnce(null);

    await expect(directService.createDirectConnection(validInput(), actor)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });

    expect(mockedRepository.createDirectConnection).not.toHaveBeenCalled();
  });

  it('connects an active eligible factory even when it has no current POMS factory row', async () => {
    mockedRepository.findFactoryGeneral.mockResolvedValueOnce(null);

    await expect(directService.createDirectConnection(validInput(), actor)).resolves.toBe(created);

    expect(mockedRepository.findDirectConnectionFactory).toHaveBeenCalledWith('factory-input', {
      actorUserId: 42,
      scope: { scope: 'ALL' },
      regionalAccess: undefined,
    });
    expect(mockedRepository.createDirectConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        eligibleFactoryId: 17,
        factoryId: 'canonical-factory-id',
        factoryName: 'โรงงานจากฐานข้อมูล',
        factoryRegistrationNo: 'REG-CANONICAL',
      }),
      42,
    );
  });

  it('does not create anything when the selected factory is not actively eligible', async () => {
    mockedRepository.findFactoryGeneral.mockResolvedValueOnce({
      ...canonicalFactory,
      isEligible: false,
    });

    await expect(directService.createDirectConnection(validInput(), actor)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });

    expect(mockedRepository.createDirectConnection).not.toHaveBeenCalled();
  });
});

function validInput() {
  return {
    requestType: 'ADD_MEASUREMENT_POINT',
    factoryId: 'factory-input',
    factoryName: 'ชื่อจาก client',
    factoryRegistrationNo: 'REG-INPUT',
    systemType: 'WPMS',
    contactName: 'ผู้ประสานงาน',
    contactPhone: '0812345678',
    measurementPoints: [
      {
        pointName: 'จุดน้ำทิ้ง 1',
        pointCode: '  free-form/ก-01  ',
        pointType: 'WASTEWATER',
        parameters: ['BOD (mg/l)'],
      },
    ],
  };
}
