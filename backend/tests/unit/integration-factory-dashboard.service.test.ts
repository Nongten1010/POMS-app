import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/connection-requests/connection-requests.service', () => ({
  connectionRequestsService: {
    listPublicFactoryMapPoints: jest.fn(),
  },
}));

import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import { integrationFactoryDashboardService } from '../../src/modules/integrations/integration-factory-dashboard.service';

const mockedConnectionRequestsService = jest.mocked(connectionRequestsService);
const registrationNo = '40100007125560';

describe('integration factory dashboard service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and returns only the requested connected factory', async () => {
    const factory = {
      factoryId: registrationNo,
      factoryName: 'บริษัท ตัวอย่าง จำกัด',
      newRegistrationNo: registrationNo,
      hasLatestHourlyMeasurement: true,
      measurementPoints: [],
    };
    mockedConnectionRequestsService.listPublicFactoryMapPoints.mockResolvedValue({
      data: [factory],
      meta: { total: 1 },
    } as never);

    await expect(
      integrationFactoryDashboardService.getByRegistrationNo(registrationNo),
    ).resolves.toEqual({ data: [factory], meta: { total: 1 } });
    expect(mockedConnectionRequestsService.listPublicFactoryMapPoints).toHaveBeenCalledWith({
      registrationNo,
    });
  });

  it('returns a not-found error when no active connected factory matches', async () => {
    mockedConnectionRequestsService.listPublicFactoryMapPoints.mockResolvedValue({
      data: [],
      meta: { total: 0 },
    });

    await expect(
      integrationFactoryDashboardService.getByRegistrationNo(registrationNo),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Connected POMS factory not found',
    });
  });
});
