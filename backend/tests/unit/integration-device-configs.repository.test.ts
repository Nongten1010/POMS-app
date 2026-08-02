import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: jest.fn(),
}));

import { db } from '../../src/config/database';
import { integrationDeviceConfigsRepository } from '../../src/modules/integrations/integration-device-configs.repository';

const mockedDb = db as unknown as jest.Mock<(...args: unknown[]) => unknown>;

describe('integrationDeviceConfigsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the three measurement-point source fields for an integration response', async () => {
    const { query, first } = connectedPointQuery({
      point_name: 'Mobile point',
      point_code: 'MOBILE-0001',
      system_type: 'CEMS',
      point_type: 'OTHER',
      details_json: JSON.stringify({ monitoringPointKind: 'Mobile' }),
      instruments_json: null,
    });
    mockedDb.mockReturnValue(query);

    await expect(
      integrationDeviceConfigsRepository.findConnectedPointByStationId('MOBILE-0001'),
    ).resolves.toEqual({
      stationId: 'MOBILE-0001',
      systemType: 'CEMS',
      pointType: 'OTHER',
      monitoringPointKind: 'Mobile',
      measurementInstruments: null,
    });
    expect(first).toHaveBeenCalledWith(
      'point_name',
      'point_code',
      'system_type',
      'point_type',
      'details_json',
      'instruments_json',
    );
  });

  it.each([
    ['malformed JSON', '{not-json'],
    ['a non-string kind', JSON.stringify({ monitoringPointKind: 123 })],
  ])('treats %s as a missing monitoringPointKind', async (_label, detailsJson) => {
    const { query } = connectedPointQuery({
      point_name: 'Legacy point',
      point_code: 'S0002',
      system_type: 'CEMS',
      point_type: 'STACK',
      details_json: detailsJson,
      instruments_json: null,
    });
    mockedDb.mockReturnValue(query);

    const result = await integrationDeviceConfigsRepository.findConnectedPointByStationId('S0002');

    expect(result?.monitoringPointKind).toBeNull();
  });
});

function connectedPointQuery(row: Record<string, unknown>) {
  const first = jest
    .fn<(...columns: string[]) => Promise<Record<string, unknown>>>()
    .mockResolvedValue(row);
  const nestedWhere = {
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
  };
  const query = {
    whereNull: jest.fn().mockReturnThis(),
    where: jest.fn((callback: (builder: typeof nestedWhere) => void) => {
      callback(nestedWhere);
      return query;
    }),
    first,
  };

  return { query, first };
}
