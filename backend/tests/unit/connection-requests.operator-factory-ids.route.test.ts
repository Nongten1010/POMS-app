import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp } from '../../src/app';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import type { FactorySummaryDTO } from '../../src/modules/connection-requests/connection-requests.types';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';

describe('operator factory row ids through the HTTP response', () => {
  beforeEach(() => {
    jest.spyOn(connectionRequestsRepository, 'listRequestsForFactories').mockResolvedValue([]);
    jest
      .spyOn(connectionRequestsRepository, 'listConnectedMeasurementPointsForFactories')
      .mockResolvedValue([]);
    jest
      .spyOn(connectionRequestsRepository, 'listOpenEligibleFactoryAddRequestsForFactoryMasterIds')
      .mockResolvedValue(new Map());
    jest
      .spyOn(connectionRequestsRepository, 'listOfficerNotificationEmailsForFactories')
      .mockResolvedValue(new Map());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns unique stable row keys for mixed master and masterless factories', async () => {
    const factories = [
      factory({ id: 77, factoryId: '10000000000077' }),
      factory({ id: null, factoryId: '40490171025682' }),
      factory({ id: null, factoryId: '77', eligibleFactoryId: 18 }),
    ];
    const list = jest
      .spyOn(connectionRequestsRepository, 'listFactoriesForAccess')
      .mockResolvedValue(factories);
    const app = createApp();
    const token = signTestAccessToken({
      sub: '42',
      userType: 'operator',
      roles: ['factory_operator'],
      scopes: { 'factories:view': 'OWN_FACTORY' },
    });
    const response = await request(app)
      .get('/api/v1/cems-wpms-requests/operator-factories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.meta.total).toBe(3);
    expect(response.body.data).toEqual([
      expect.objectContaining({ id: 77, factoryId: '10000000000077' }),
      expect.objectContaining({ id: 'factory-40490171025682', factoryId: '40490171025682' }),
      expect.objectContaining({ id: 'factory-77', factoryId: '77' }),
    ]);
    expect(factories.map(({ id }) => id)).toEqual([77, null, null]);

    list.mockResolvedValue([...factories].reverse());
    const refreshed = await request(app)
      .get('/api/v1/cems-wpms-requests/operator-factories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(refreshed.body.data).toEqual([...response.body.data].reverse());
  });

  it('serves the dedicated operator row-id contract through runtime OpenAPI', async () => {
    const response = await request(createApp()).get('/api/v1/openapi.json').expect(200);

    expect(
      response.body.paths['/cems-wpms-requests/operator-factories'].get.responses['200'].content[
        'application/json'
      ].schema,
    ).toEqual({ $ref: '#/components/schemas/OperatorFactoryListResponse' });
    expect(response.body.components.schemas.OperatorFactoryListRow.properties.id.oneOf).toEqual([
      { type: 'integer', minimum: 1 },
      expect.objectContaining({ type: 'string', pattern: '^factory-.+$' }),
    ]);
  });
});

function factory(overrides: Partial<FactorySummaryDTO>): FactorySummaryDTO {
  return {
    id: null,
    eligibleFactoryId: 17,
    factoryId: '40490171025682',
    factoryName: 'โรงงานทดสอบ',
    newRegistrationNo: '40490171025682',
    oldRegistrationNo: null,
    industryType: null,
    industryMainOrder: null,
    industrySubOrder: null,
    businessActivity: null,
    eia: null,
    projectName: null,
    address: null,
    latitude: null,
    longitude: null,
    province: null,
    isEligible: true,
    ...overrides,
  };
}
