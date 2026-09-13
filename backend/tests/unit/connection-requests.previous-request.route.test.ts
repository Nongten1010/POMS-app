import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { connectionRequestsRoutes } from '../../src/modules/connection-requests/connection-requests.routes';
import { errorHandler, notFoundHandler } from '../../src/shared/middlewares/errorHandler';
import { signAccessToken } from '../../src/shared/utils/jwt';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

const findPreviousRequest = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    findPreviousRequestForReadAccess: (...args: unknown[]) => findPreviousRequest(...args),
  },
}));

const app = express();
app.use('/api/v1/cems-wpms-requests', connectionRequestsRoutes);
app.use(notFoundHandler);
app.use(errorHandler);
const endpoint = '/api/v1/cems-wpms-requests/factories/factory-001/previous-request';
const token = signAccessToken({
  sub: '42',
  userType: 'operator',
  roles: ['factory_operator'],
  scopes: { 'cems_wpms_requests:view': 'OWN_FACTORY' },
});

describe('GET previous-request through the route and service', () => {
  beforeEach(() => {
    findPreviousRequest.mockReset();
    findPreviousRequest.mockResolvedValue(null);
  });

  it('returns an explicit empty result when there is no accessible previous request', async () => {
    const response = await request(app).get(endpoint).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        hasPreviousRequest: false,
        sourceRequestId: null,
        formData: null,
        message: 'ไม่พบคำขอก่อนหน้าของโรงงานนี้',
      },
    });
    expect(findPreviousRequest).toHaveBeenCalledWith('factory-001', {
      actorUserId: 42,
      scope: { scope: 'OWN_FACTORY' },
      regionalAccess: undefined,
    });
  });

  it('requires authentication', async () => {
    expect((await request(app).get(endpoint)).status).toBe(401);
    expect(findPreviousRequest).not.toHaveBeenCalled();
  });

  it('returns all five groups with the fields published in runtime OpenAPI', async () => {
    const photo = {
      title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน',
      fileUrl: 'https://example.com/front.jpg',
    };
    const logo = {
      title: 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท',
      fileUrl: 'https://example.com/logo.png',
    };
    findPreviousRequest.mockResolvedValue({
      id: 17,
      factoryId: 'factory-001',
      factoryName: 'โรงงานตัวอย่าง',
      factoryRegistrationNo: 'REG-001',
      contactName: 'สมชาย',
      contactPhone: '0812345678',
      contactEmail: 'contact@example.com',
      contactPersons: [{ name: 'สมชาย', phone: '0812345678' }],
      notificationEmails: ['factory@example.com'],
      measurementPoints: [{ documentsAndImages: [photo, logo] }],
    });
    const response = await request(app).get(endpoint).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      hasPreviousRequest: true,
      sourceRequestId: 17,
      formData: {
        factoryName: 'โรงงานตัวอย่าง',
        factoryFrontPhotos: [photo],
        factoryLogo: logo,
        contactPersons: [{ name: 'สมชาย', phone: '0812345678' }],
        notificationEmails: ['factory@example.com'],
      },
    });
    const components = pomsOpenApiDocument.components as {
      schemas: Record<string, { required: string[]; properties: Record<string, unknown> }>;
    };
    const schema = components.schemas.PreviousRequestFormData;
    expect(Object.keys(response.body.data.formData).sort()).toEqual([...schema.required].sort());
    expect(Object.keys(schema.properties).sort()).toEqual([...schema.required].sort());
    expect(Object.values(schema.properties)).not.toContain(undefined);
    const paths = pomsOpenApiDocument.paths as Record<
      string,
      {
        get: {
          security: unknown;
          responses: Record<string, { content: Record<string, { schema: unknown }> }>;
        };
      }
    >;
    const operation = paths['/cems-wpms-requests/factories/{factoryId}/previous-request'].get;
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation.responses['200'].content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/PreviousConnectionRequestResponse',
    });
  });

  it('does not report a database failure as an empty previous request', async () => {
    findPreviousRequest.mockRejectedValue(new Error('Lookup failed'));
    const response = await request(app).get(endpoint).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ success: false, error: { code: 'INTERNAL_ERROR' } });
    expect(response.body).not.toHaveProperty('data');
    expect(JSON.stringify(response.body)).not.toContain('Lookup failed');
  });

  it('requires request view permission', async () => {
    const deniedToken = signAccessToken({
      sub: '42',
      userType: 'operator',
      roles: ['factory_operator'],
      scopes: {},
    });
    const response = await request(app).get(endpoint).set('Authorization', `Bearer ${deniedToken}`);
    expect(response.status).toBe(403);
    expect(findPreviousRequest).not.toHaveBeenCalled();
  });

  it.each(['%20', 'a'.repeat(65)])('rejects invalid factoryId %s', async (factoryId) => {
    const response = await request(app)
      .get(`/api/v1/cems-wpms-requests/factories/${factoryId}/previous-request`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(findPreviousRequest).not.toHaveBeenCalled();
  });
});
