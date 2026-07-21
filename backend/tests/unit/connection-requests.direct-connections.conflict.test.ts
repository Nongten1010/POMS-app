import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: {
    transaction: jest.fn(),
  },
}));

import { db } from '../../src/config/database';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';

const mockedDb = db as unknown as {
  transaction: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};

describe('connectionRequestsRepository.createDirectConnection conflict boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps a concurrent active point-code unique violation to the API conflict contract', async () => {
    mockedDb.transaction.mockRejectedValueOnce({
      number: 2601,
      message: "Cannot insert duplicate key row with unique index 'uq_connected_points_point_code'",
    });

    await expect(
      connectionRequestsRepository.createDirectConnection(directInput() as never, 42),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      details: {
        path: 'measurementPoints.0.pointCode',
        pointCode: 'free-form-01',
      },
    });
    expect(mockedDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('does not hide unrelated database failures', async () => {
    const failure = new Error('database unavailable');
    mockedDb.transaction.mockRejectedValueOnce(failure);

    await expect(
      connectionRequestsRepository.createDirectConnection(directInput() as never, 42),
    ).rejects.toBe(failure);
  });

  it.each([
    { measurementPoints: [] },
    {
      measurementPoints: [
        { ...directInput().measurementPoints[0] },
        { ...directInput().measurementPoints[0] },
      ],
    },
  ])(
    'rejects an internal call unless it contains exactly one point',
    async ({ measurementPoints }) => {
      await expect(
        connectionRequestsRepository.createDirectConnection(
          { ...directInput(), measurementPoints } as never,
          42,
        ),
      ).rejects.toThrow(
        'Direct connection repository requires exactly one measurement point with a code',
      );
      expect(mockedDb.transaction).not.toHaveBeenCalled();
    },
  );
});

function directInput() {
  return {
    requestType: 'ADD_MEASUREMENT_POINT',
    factoryId: 'factory-001',
    factoryName: 'โรงงานทดสอบ',
    factoryRegistrationNo: 'REG-001',
    systemType: 'WPMS',
    contactName: 'ผู้ประสานงาน',
    contactPhone: '0812345678',
    measurementPoints: [
      {
        pointName: 'จุดน้ำทิ้ง 1',
        pointCode: 'free-form-01',
        pointType: 'WASTEWATER',
        parameters: ['BOD (mg/l)'],
      },
    ],
  };
}
