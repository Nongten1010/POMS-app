import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    findActiveEligibleFactoryReference: jest.fn(),
    create: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import { officerAddParameterRequestSchema } from '../../src/modules/connection-requests/connection-requests.validator';

const repository = jest.mocked(connectionRequestsRepository);
const endpoint = '/api/v1/cems-wpms-requests/parameters';
const app = createApp();

function token(
  userType: 'officer' | 'admin' | 'operator' = 'officer',
  roles = ['monitoring_kpm'],
  canEdit = true,
) {
  return signAccessToken({
    sub: '52',
    userType,
    roles,
    scopes: canEdit ? { 'cems_wpms_requests:edit': 'ALL' } : {},
  });
}

function payload(systemType = 'CEMS') {
  const parameter = systemType === 'CEMS' ? 'CO (ppm)' : 'BOD (mg/l)';
  return {
    factoryId: 'factory-001',
    factoryName: 'โรงงานทดสอบ',
    factoryRegistrationNo: 'REG-001',
    systemType,
    contactPersons: [{ name: 'ผู้ติดต่อ', phone: '0812345678' }],
    measurementPoints: [
      {
        pointName: 'จุดตรวจวัดทดสอบ',
        pointCode: systemType === 'CEMS' ? 'S0001' : 'W0001',
        pointType: systemType === 'CEMS' ? 'STACK' : 'WASTEWATER',
        parameters: [parameter],
        details: {
          ...(systemType === 'CEMS' ? { stackShape: 'วงกลม', stackDiameter: 1.2 } : {}),
          requestedParameters: [parameter],
        },
        measurementInstruments: { parameters: [{ parameter, technique: 'Test' }] },
      },
    ],
  };
}

function withoutSections(systemType: string, section: string, value: null | undefined) {
  const body = payload(systemType);
  return {
    ...body,
    measurementPoints: [
      {
        ...body.measurementPoints[0],
        ...(section !== 'measurementInstruments' ? { details: value } : {}),
        ...(section !== 'details' ? { measurementInstruments: value } : {}),
      },
    ],
  };
}

describe('officer add-parameter optional sections through route and service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findActiveEligibleFactoryReference.mockResolvedValue({ id: 9 } as never);
    repository.create.mockResolvedValue({
      id: 17,
      requestType: 'ADD_PARAMETER',
      status: 'PENDING_DESIGN_REVIEW',
    } as never);
  });

  it.each(
    ['CEMS', 'WPMS'].flatMap((systemType) =>
      ['details', 'measurementInstruments', 'both'].flatMap((section) =>
        [undefined, null].map((value) => ({ systemType, section, value })),
      ),
    ),
  )(
    'allows officer $systemType $section = $value, but keeps operator validation',
    async ({ systemType, section, value }) => {
      const body = withoutSections(systemType, section, value);
      const officer = await request(app)
        .post(endpoint)
        .set('Connection', 'close')
        .set('Authorization', `Bearer ${token()}`)
        .send(body);
      expect(officer.status).toBe(201);
      expect(officer.headers.location).toBe('/api/v1/cems-wpms-requests/17');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestType: 'ADD_PARAMETER',
          eligibleFactoryId: 9,
          measurementPoints: [
            expect.objectContaining({
              pointCode: body.measurementPoints[0].pointCode,
              parameters: body.measurementPoints[0].parameters,
              ...(section !== 'measurementInstruments' ? { details: null } : {}),
              ...(section !== 'details' ? { measurementInstruments: null } : {}),
            }),
          ],
        }),
        52,
        'PENDING_DESIGN_REVIEW',
      );
      repository.create.mockClear();
      const operator = await request(app)
        .post(endpoint)
        .set('Connection', 'close')
        .set('Authorization', `Bearer ${token('operator', ['factory_operator'])}`)
        .send(body);
      expect(operator.status).toBe(400);
      expect(operator.body.error.code).toBe('VALIDATION_ERROR');
      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  it('allows the admin actor supported by the existing officer form', async () => {
    const response = await request(app)
      .post(endpoint)
      .set('Connection', 'close')
      .set('Authorization', `Bearer ${token('admin', ['admin'])}`)
      .send(withoutSections('CEMS', 'both', undefined));
    expect(response.status).toBe(201);
  });

  it.each([
    ['operator', ['monitoring_kpm']],
    ['operator', ['admin']],
    ['officer', ['factory_operator']],
  ])('does not relax validation for userType %s and roles %j', async (userType, roles) => {
    const response = await request(app)
      .post(endpoint)
      .set('Connection', 'close')
      .set(
        'Authorization',
        `Bearer ${token(userType as 'officer' | 'operator', roles as string[])}`,
      )
      .send(withoutSections('CEMS', 'both', undefined));
    expect(response.status).toBe(400);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('still requires edit permission', async () => {
    const response = await request(app)
      .post(endpoint)
      .set('Connection', 'close')
      .set('Authorization', `Bearer ${token('officer', ['monitoring_kpm'], false)}`)
      .send(withoutSections('CEMS', 'both', undefined));
    expect(response.status).toBe(403);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('keeps the service strict when an internal caller supplies only a user ID', async () => {
    const input = officerAddParameterRequestSchema.parse(
      withoutSections('CEMS', 'both', undefined),
    );
    await expect(connectionRequestsService.createParameterRequest(input, 52)).rejects.toMatchObject(
      { statusCode: 400, code: 'BAD_REQUEST' },
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each([
    { details: { stackShape: 'วงกลม' } },
    { details: 'invalid' },
    { measurementInstruments: { parameters: [{ parameter: '' }] } },
    { measurementInstruments: { parameters: [{ parameter: 'NOx (ppm)' }] } },
    { pointCode: null },
  ])('still validates supplied fields: %j', async (changes) => {
    const body = payload();
    const response = await request(app)
      .post(endpoint)
      .set('Connection', 'close')
      .set('Authorization', `Bearer ${token()}`)
      .send({ ...body, measurementPoints: [{ ...body.measurementPoints[0], ...changes }] });
    expect(response.status).toBe(400);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each([
    { contactPersons: [] },
    { factoryName: '' },
    { userType: 'officer' },
    { submissionAction: 'CONNECT' },
    { measurementPoints: [payload().measurementPoints[0], payload().measurementPoints[0]] },
  ])('does not relax other form rules: %j', async (changes) => {
    const response = await request(app)
      .post(endpoint)
      .set('Connection', 'close')
      .set('Authorization', `Bearer ${token()}`)
      .send({ ...withoutSections('CEMS', 'both', undefined), ...changes });
    expect(response.status).toBe(400);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
