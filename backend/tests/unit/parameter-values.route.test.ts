import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';
import { NotFoundError } from '../../src/shared/errors/AppError';

jest.mock('../../src/modules/parameter-values/parameter-values.service', () => ({
  parameterValuesService: {
    listTables: jest.fn(),
    list: jest.fn(),
    latest: jest.fn(),
    connectionTest: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { parameterValuesService } from '../../src/modules/parameter-values/parameter-values.service';

const mockedService = jest.mocked(parameterValuesService);

describe('parameter value routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.listTables.mockResolvedValue([]);
  });

  it('rejects unauthenticated and view-forbidden callers', async () => {
    const anonymousResponse = await request(createApp()).get('/api/v1/parameter-values/tables');
    const forbiddenResponse = await request(createApp())
      .get('/api/v1/parameter-values/tables')
      .set('Authorization', `Bearer ${token({ 'cems_wpms_requests:edit': 'ALL' })}`);

    expect(anonymousResponse.status).toBe(401);
    expect(forbiddenResponse.status).toBe(403);
    expect(mockedService.listTables).not.toHaveBeenCalled();
  });

  it('forwards regional access with the permission scope', async () => {
    const response = await request(createApp())
      .get('/api/v1/parameter-values/tables')
      .set(
        'Authorization',
        `Bearer ${token(
          { 'cems_wpms_requests:view': 'IN_REGION' },
          { 'cems_wpms_requests:view': { scope: 'IN_REGION' } },
          { regions: ['ภาคใต้'] },
        )}`,
      );

    expect(response.status).toBe(200);
    expect(mockedService.listTables).toHaveBeenCalledWith({
      actorUserId: 42,
      scope: { scope: 'IN_REGION' },
      regionalAccess: { regions: ['ภาคใต้'] },
    });
  });

  it('returns 404 for a station outside the caller scope', async () => {
    mockedService.latest.mockRejectedValue(new NotFoundError('Measurement point not found'));

    const response = await request(createApp())
      .get('/api/v1/parameter-values/latest?stationId=S_NORTH&interval=real')
      .set('Authorization', `Bearer ${token({ 'cems_wpms_requests:view': 'OWN_FACTORY' })}`);

    expect(response.status).toBe(404);
    expect(mockedService.latest).toHaveBeenCalledWith(
      { stationId: 'S_NORTH', interval: 'real' },
      {
        actorUserId: 42,
        scope: { scope: 'OWN_FACTORY' },
        regionalAccess: null,
      },
    );
  });
});

function token(
  scopes: Record<string, string | null>,
  scopeDetails?: Record<string, { scope: string }>,
  regionalAccess?: { regions: string[] },
): string {
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['monitoring_5_centers'],
    scopes,
    scopeDetails: scopeDetails as never,
    regionalAccess,
  });
}
