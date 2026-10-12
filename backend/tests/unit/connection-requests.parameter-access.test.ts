import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    findActiveEligibleFactoryReference: jest.fn(),
    findDirectConnectionFactory: jest.fn(),
    create: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import { officerAddParameterRequestSchema } from '../../src/modules/connection-requests/connection-requests.validator';
import {
  canOmitParameterRequestSections,
  type ParameterRequestActorContext,
} from '../../src/modules/connection-requests/parameter-request-policy';

const repository = jest.mocked(connectionRequestsRepository);
const factoryId = '10120000325542';
const registration = '3-34(3)-3/54นบ';
const factory = {
  eligibleFactoryId: 9,
  factoryId,
  factoryName: 'โรงงานทดสอบ',
  newRegistrationNo: factoryId,
  oldRegistrationNo: registration,
};
const body = {
  factoryId,
  factoryName: factory.factoryName,
  factoryRegistrationNo: registration,
  systemType: 'CEMS',
  contactPersons: [{ name: 'ผู้ติดต่อ', phone: '0812345678' }],
  measurementPoints: [
    {
      pointName: 'ปล่องทดสอบ',
      pointCode: 'S0001',
      pointType: 'STACK',
      parameters: ['CO (ppm)'],
      details: { stackShape: 'วงกลม', stackDiameter: 1.2, requestedParameters: ['CO (ppm)'] },
      measurementInstruments: { parameters: [{ parameter: 'CO (ppm)', technique: 'NDIR' }] },
    },
  ],
};
const input = officerAddParameterRequestSchema.parse(body);
function actor(editScope: ParameterRequestActorContext['editScope']): ParameterRequestActorContext {
  return { actorUserId: 52, userType: 'operator', roles: ['factory_operator'], editScope };
}

beforeEach(() => {
  jest.clearAllMocks();
  repository.findActiveEligibleFactoryReference.mockResolvedValue({
    id: 9,
    sourceFactoryId: factoryId,
    factoryRegistrationNoNew: factoryId,
    factoryRegistrationNoOld: registration,
  });
  repository.findDirectConnectionFactory.mockResolvedValue(factory);
  repository.create.mockResolvedValue({ id: 17, status: 'PENDING_DESIGN_REVIEW' } as never);
});

describe('parameter creation effective edit access', () => {
  it('denies a factory outside the custom province before creating a request', async () => {
    repository.findDirectConnectionFactory.mockResolvedValueOnce(null);
    await expect(
      connectionRequestsService.createParameterRequest(
        input,
        actor({ scope: 'IN_PROVINCE', province: 'ระยอง' }),
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(repository.findDirectConnectionFactory).toHaveBeenCalledWith(
      { factoryId, factoryRegistrationNo: registration },
      expect.objectContaining({
        actorUserId: 52,
        scope: { scope: 'IN_PROVINCE', province: 'ระยอง' },
      }),
    );
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.findActiveEligibleFactoryReference).not.toHaveBeenCalled();
  });

  it('allows a saved ALL grant and preserves existing registration and point identity', async () => {
    await expect(
      connectionRequestsService.createParameterRequest(input, actor({ scope: 'ALL' })),
    ).resolves.toMatchObject({ id: 17 });
    expect(repository.findDirectConnectionFactory).toHaveBeenCalledWith(
      { factoryId, factoryRegistrationNo: registration },
      expect.objectContaining({ scope: { scope: 'ALL' } }),
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        factoryId,
        factoryRegistrationNo: registration,
        eligibleFactoryId: 9,
        measurementPoints: [expect.objectContaining({ pointCode: 'S0001' })],
      }),
      52,
      'PENDING_DESIGN_REVIEW',
    );
  });

  it('checks current factory assignment for an OWN_FACTORY edit grant', async () => {
    repository.findDirectConnectionFactory.mockResolvedValueOnce(null);
    await expect(
      connectionRequestsService.createParameterRequest(input, actor({ scope: 'OWN_FACTORY' })),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(repository.findDirectConnectionFactory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorUserId: 52, scope: { scope: 'OWN_FACTORY' } }),
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('allows an assigned factory with OWN_FACTORY edit access', async () => {
    await expect(
      connectionRequestsService.createParameterRequest(input, actor({ scope: 'OWN_FACTORY' })),
    ).resolves.toMatchObject({ id: 17 });
    expect(repository.findDirectConnectionFactory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorUserId: 52, scope: { scope: 'OWN_FACTORY' } }),
    );
  });

  it('denies an admin without an edit grant before any factory lookup', async () => {
    await expect(
      connectionRequestsService.createParameterRequest(input, {
        ...actor(undefined),
        userType: 'admin',
        roles: ['admin'],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repository.findDirectConnectionFactory).not.toHaveBeenCalled();
    expect(repository.findActiveEligibleFactoryReference).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('keeps profile regional access for an unresolved regional edit scope', async () => {
    const regionalActor = {
      ...actor({ scope: 'IN_REGION' }),
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    };
    await connectionRequestsService.createParameterRequest(input, regionalActor);
    expect(repository.findDirectConnectionFactory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        scope: { scope: 'IN_REGION' },
        regionalAccess: regionalActor.regionalAccess,
      }),
    );
  });

  it('uses granted view data scope for a binary edit action', async () => {
    const binaryActor = {
      ...actor({ scope: null }),
      viewScope: { scope: 'IN_PROVINCE' as const, province: 'ระยอง' },
    };
    await connectionRequestsService.createParameterRequest(input, binaryActor);
    expect(repository.findDirectConnectionFactory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: binaryActor.viewScope }),
    );
  });

  it('passes explicit regional qualifiers without replacing them with legacy profile regions', async () => {
    const explicitActor = {
      ...actor({ scope: 'IN_REGION', region: 'ภาคตะวันออก' }),
      regionalAccess: { regions: ['ภาคกลาง'] },
    };
    await connectionRequestsService.createParameterRequest(input, explicitActor);
    expect(repository.findDirectConnectionFactory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: { scope: 'IN_REGION', region: 'ภาคตะวันออก' } }),
    );
  });

  it('passes binary edit view-scope fallback through the authenticated route', async () => {
    const token = signTestAccessToken({
      sub: '52',
      userType: 'operator',
      roles: ['factory_operator'],
      scopes: { 'cems_wpms_requests:edit': null, 'cems_wpms_requests:view': 'IN_PROVINCE' },
      scopeDetails: { 'cems_wpms_requests:view': { scope: 'IN_PROVINCE', province: 'ระยอง' } },
    });
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/parameters')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(response.status).toBe(201);
    expect(repository.findDirectConnectionFactory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: { scope: 'IN_PROVINCE', province: 'ระยอง' } }),
    );
  });

  it('denies a binary edit action without a granted data scope', async () => {
    await expect(
      connectionRequestsService.createParameterRequest(input, actor({ scope: null })),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('does not choose reduced form validation for null-wrapped edit scope', () => {
    expect(canOmitParameterRequestSections({ editScope: { scope: null } })).toBe(false);
  });

  it('requires complete sections when binary edit uses a view scope', async () => {
    const token = signTestAccessToken({
      sub: '52',
      userType: 'operator',
      roles: ['factory_operator'],
      scopes: { 'cems_wpms_requests:edit': null, 'cems_wpms_requests:view': 'ALL' },
    });
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/parameters')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...body,
        measurementPoints: [
          { ...body.measurementPoints[0], details: undefined, measurementInstruments: undefined },
        ],
      });
    expect(response.status).toBe(400);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
