import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/monitoring-point-forms/monitoring-point-forms.repository', () => ({
  monitoringPointFormsRepository: {
    create: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
  },
}));

import { monitoringPointFormsRepository } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.repository';
import { monitoringPointFormsService } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.service';
import type { SaveMonitoringPointFormInput } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.types';

const mockedRepository = jest.mocked(monitoringPointFormsRepository);

describe('monitoringPointFormsService', () => {
  const input: SaveMonitoringPointFormInput = {
    factory: {
      factoryName: 'สถานีบ่มใบยาสบหนอง',
      factoryRegistrationNoNew: '10520000225172',
      factoryRegistrationNoOld: '3-1-2/17ลป',
      provinceName: 'ลำปาง',
    },
    points: [
      {
        systemType: 'CEMS',
        pointCode: 'S0001',
        pointName: 'ปล่องหลัก',
        eligibleParameters: ['NOx (ppm)'],
      },
      {
        systemType: 'WPMS',
        pointCode: 'P0001',
        pointName: 'จุดระบายน้ำทิ้ง',
        eligibleParameters: ['BOD (mg/l)'],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a form when the factory does not already have one', async () => {
    mockedRepository.list.mockResolvedValue([]);
    mockedRepository.create.mockResolvedValue({
      id: 1,
      factory: {
        ...input.factory,
        factoryRegistrationNoOld: input.factory.factoryRegistrationNoOld ?? null,
        provinceName: input.factory.provinceName ?? null,
        factoryTypeMain: null,
        factoryTypeSub: null,
        operationStatus: null,
        eiaInfo: null,
        address: null,
        businessActivity: null,
      },
      points: [],
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    });

    const result = await monitoringPointFormsService.create(input, 42);

    expect(mockedRepository.list).toHaveBeenCalledWith({
      factoryRegistrationNoNew: '10520000225172',
    });
    expect(mockedRepository.create).toHaveBeenCalledWith(input, 42);
    expect(result.id).toBe(1);
  });

  it('rejects duplicate factory forms so users edit the existing set', async () => {
    mockedRepository.list.mockResolvedValue([
      {
        id: 7,
        factory: {
          ...input.factory,
          factoryRegistrationNoOld: input.factory.factoryRegistrationNoOld ?? null,
          provinceName: input.factory.provinceName ?? null,
          factoryTypeMain: null,
          factoryTypeSub: null,
          operationStatus: null,
          eiaInfo: null,
          address: null,
          businessActivity: null,
        },
        pointCount: 1,
        cemsPointCount: 1,
        wpmsPointCount: 0,
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      },
    ]);

    await expect(monitoringPointFormsService.create(input, 42)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(mockedRepository.create).not.toHaveBeenCalled();
  });

  it('throws not found when updating an unknown form', async () => {
    mockedRepository.update.mockResolvedValue(null);

    await expect(monitoringPointFormsService.update(99, input, 42)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
