import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { AppError } from '../../src/shared/errors/AppError';
import type { AccessTokenPayload } from '../../src/shared/utils/jwt';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';

jest.mock('../../src/modules/parameter-values/parameter-values.service', () => ({
  parameterValuesService: {
    listTables: jest.fn(),
    list: jest.fn(),
    latest: jest.fn(),
    connectionTest: jest.fn(),
  },
}));

import { parameterValuesRoutes } from '../../src/modules/parameter-values/parameter-values.routes';
import { parameterValuesService } from '../../src/modules/parameter-values/parameter-values.service';

const mockedService = jest.mocked(parameterValuesService);
const connectionTestPath = '/connection-test?stationId=S2007';

describe('connection-test authenticated router access without a listening server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.listTables.mockResolvedValue([]);
    mockedService.connectionTest.mockResolvedValue({
      data: [],
      meta: {
        stationId: 'S2007',
        interval: '1m',
        schemaName: 'ingest',
        tableName: 'S2007_data_1m',
        count: 0,
        registeredParameters: [],
      },
    });
  });

  it('rejects an unauthenticated request before calling the service', async () => {
    const result = await invokeRouter(connectionTestPath);

    expect(result.status).toBe(401);
    expect(result.error).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mockedService.connectionTest).not.toHaveBeenCalled();
  });

  it('rejects an invalid access token before calling the service', async () => {
    const result = await invokeRouter(connectionTestPath, 'not-a-signed-token');

    expect(result.status).toBe(401);
    expect(result.error).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mockedService.connectionTest).not.toHaveBeenCalled();
  });

  it.each(['officer', 'admin'] as const)(
    'allows approve-only %s and passes its qualified approval scope',
    async (userType) => {
      const token = accountToken({
        userType,
        scopes: { 'cems_wpms_requests:approve': 'IN_REGION' },
        scopeDetails: {
          'cems_wpms_requests:approve': { scope: 'IN_REGION', region: 'ภาคเหนือ' },
        },
        regionalAccess: { regions: ['ภาคใต้'] },
      });

      const result = await invokeRouter(connectionTestPath, token);

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true, meta: { stationId: 'S2007' } });
      expect(mockedService.connectionTest).toHaveBeenCalledWith(
        { stationId: 'S2007' },
        {
          actorUserId: 42,
          permission: 'cems_wpms_requests:approve',
          scope: { scope: 'IN_REGION', region: 'ภาคเหนือ' },
          regionalAccess: { regions: ['ภาคใต้'] },
        },
      );
    },
  );

  it.each(['officer', 'admin'] as const)(
    'rejects view-only %s before reading connection-test data',
    async (userType) => {
      const token = accountToken({
        userType,
        scopes: { 'cems_wpms_requests:view': 'ALL' },
      });

      const result = await invokeRouter(connectionTestPath, token);

      expect(result.status).toBe(403);
      expect(result.error).toMatchObject({
        code: 'FORBIDDEN',
        message: 'Missing required permission: cems_wpms_requests:approve',
      });
      expect(mockedService.connectionTest).not.toHaveBeenCalled();
    },
  );

  it('uses the approval province when view grants all locations', async () => {
    const token = accountToken({
      userType: 'officer',
      scopes: {
        'cems_wpms_requests:view': 'ALL',
        'cems_wpms_requests:approve': 'IN_PROVINCE',
      },
      scopeDetails: {
        'cems_wpms_requests:view': { scope: 'ALL' },
        'cems_wpms_requests:approve': { scope: 'IN_PROVINCE', province: 'ฉะเชิงเทรา' },
      },
    });

    const result = await invokeRouter(connectionTestPath, token);

    expect(result.status).toBe(200);
    expect(mockedService.connectionTest).toHaveBeenCalledWith(
      { stationId: 'S2007' },
      {
        actorUserId: 42,
        permission: 'cems_wpms_requests:approve',
        scope: { scope: 'IN_PROVINCE', province: 'ฉะเชิงเทรา' },
        regionalAccess: null,
      },
    );
  });

  it('does not accept an approval qualifier without the approval grant', async () => {
    const token = accountToken({
      userType: 'officer',
      scopes: { 'cems_wpms_requests:view': 'ALL' },
      scopeDetails: { 'cems_wpms_requests:approve': { scope: 'ALL' } },
    });

    const result = await invokeRouter(connectionTestPath, token);

    expect(result.status).toBe(403);
    expect(mockedService.connectionTest).not.toHaveBeenCalled();
  });

  it('retains the operator view permission and own-factory scope', async () => {
    const token = accountToken({
      userType: 'operator',
      scopes: { 'cems_wpms_requests:view': 'OWN_FACTORY' },
    });

    const result = await invokeRouter(connectionTestPath, token);

    expect(result.status).toBe(200);
    expect(mockedService.connectionTest).toHaveBeenCalledWith(
      { stationId: 'S2007' },
      {
        actorUserId: 42,
        permission: 'cems_wpms_requests:view',
        scope: { scope: 'OWN_FACTORY' },
        regionalAccess: null,
      },
    );
  });

  it('does not let an operator substitute approve for view', async () => {
    const token = accountToken({
      userType: 'operator',
      scopes: { 'cems_wpms_requests:approve': 'ALL' },
    });

    const result = await invokeRouter(connectionTestPath, token);

    expect(result.status).toBe(403);
    expect(result.error).toMatchObject({
      message: 'Missing required permission: cems_wpms_requests:view',
    });
    expect(mockedService.connectionTest).not.toHaveBeenCalled();
  });

  it('rejects a citizen even with both connection permissions', async () => {
    const token = accountToken({
      userType: 'citizen',
      scopes: { 'cems_wpms_requests:view': 'ALL', 'cems_wpms_requests:approve': 'ALL' },
    });

    const result = await invokeRouter(connectionTestPath, token);

    expect(result.status).toBe(403);
    expect(result.error).toMatchObject({ code: 'FORBIDDEN' });
    expect(mockedService.connectionTest).not.toHaveBeenCalled();
  });

  it.each([
    '/tables',
    '/latest?stationId=S2007',
    '/?stationId=S2007&startDate=2026-10-19&endDate=2026-10-20',
  ])('does not grant approve-only access to the sibling endpoint %s', async (path) => {
    const token = accountToken({
      userType: 'officer',
      scopes: { 'cems_wpms_requests:approve': 'ALL' },
    });

    const result = await invokeRouter(path, token);

    expect(result.status).toBe(403);
    expect(mockedService.listTables).not.toHaveBeenCalled();
    expect(mockedService.latest).not.toHaveBeenCalled();
    expect(mockedService.list).not.toHaveBeenCalled();
    expect(mockedService.connectionTest).not.toHaveBeenCalled();
  });
});

function accountToken(
  account: Pick<AccessTokenPayload, 'userType' | 'scopes'> &
    Partial<Pick<AccessTokenPayload, 'scopeDetails' | 'regionalAccess'>>,
): string {
  return signTestAccessToken({ sub: '42', roles: [], ...account });
}

function invokeRouter(
  path: string,
  token?: string,
): Promise<{ status: number; body?: unknown; error?: AppError }> {
  // Invoke the actual router so authentication, middleware order and controller
  // selection are tested without relying on permission to bind a local socket.
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost');
    const req = {
      method: 'GET',
      url: path,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      query: Object.fromEntries(url.searchParams),
    } as unknown as Request;
    let status = 200;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(body: unknown) {
        resolve({ status, body });
        return this;
      },
    } as unknown as Response;

    parameterValuesRoutes(req, res, (error?: unknown) => {
      if (error instanceof AppError) resolve({ status: error.statusCode, error });
      else if (error) reject(error);
      else reject(new Error(`No parameter-values route handled ${path}`));
    });
  });
}
