import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';
import { errorHandler, notFoundHandler } from '../../src/shared/middlewares/errorHandler';

jest.mock('../../src/modules/faqs/faqs.service', () => ({
  faqsService: {
    create: jest.fn(),
    list: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
  },
}));

import { faqsRoutes } from '../../src/modules/faqs/faqs.routes';
import { faqsService } from '../../src/modules/faqs/faqs.service';

const mockedService = jest.mocked(faqsService);
const id = 'c24ff643-87c1-4154-bb8a-293a76b9900f';
const faq = {
  id,
  question: 'คำถาม',
  answer: 'คำตอบ',
  category: 'CEMS' as const,
  categoryLabel: 'CEMS',
  updatedDate: '2026-09-04',
  createdAt: '2026-09-04T09:30:00.000Z',
  updatedAt: '2026-09-04T09:30:00.000Z',
};
const input = {
  question: 'คำถาม',
  answer: 'คำตอบ',
  category: 'CEMS' as const,
  updatedDate: '2026-09-04',
};

describe('FAQ routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists all FAQs publicly with the exact no-pagination envelope', async () => {
    mockedService.list.mockResolvedValue([faq]);

    const response = await request(app()).get('/api/v1/faqs');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: [faq] });
  });

  it('rejects list pagination because the contract returns all FAQs at once', async () => {
    const response = await request(app()).get('/api/v1/faqs?page=1');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(mockedService.list).not.toHaveBeenCalled();
  });

  it('requires a bearer token before creating an FAQ', async () => {
    const response = await request(app()).post('/api/v1/faqs').send(input);

    expect(response.status).toBe(401);
    expect(mockedService.create).not.toHaveBeenCalled();
  });

  it('requires faq:edit before creating an FAQ', async () => {
    const response = await request(app())
      .post('/api/v1/faqs')
      .set('Authorization', `Bearer ${accessToken({ 'faq:view': null })}`)
      .send(input);

    expect(response.status).toBe(403);
    expect(mockedService.create).not.toHaveBeenCalled();
  });

  it('creates a validated FAQ for an editor', async () => {
    mockedService.create.mockResolvedValue(faq);

    const response = await request(app())
      .post('/api/v1/faqs')
      .set('Authorization', `Bearer ${accessToken({ 'faq:edit': null })}`)
      .send({ ...input, question: '  คำถาม  ' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true, data: faq });
    expect(mockedService.create).toHaveBeenCalledWith(input, 1);
  });

  it('returns field validation details and rejects unknown create fields', async () => {
    const response = await request(app())
      .post('/api/v1/faqs')
      .set('Authorization', `Bearer ${accessToken({ 'faq:edit': null })}`)
      .send({ ...input, unexpected: true });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: expect.any(Object),
      },
    });
    expect(mockedService.create).not.toHaveBeenCalled();
  });

  it('fully updates an FAQ identified only by the UUID path parameter', async () => {
    mockedService.update.mockResolvedValue(faq);

    const response = await request(app())
      .put(`/api/v1/faqs/${id}`)
      .set('Authorization', `Bearer ${accessToken({ 'faq:edit': null })}`)
      .send(input);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: faq });
    expect(mockedService.update).toHaveBeenCalledWith(id, input, 1);
  });

  it('rejects partial PUT payloads', async () => {
    const response = await request(app())
      .put(`/api/v1/faqs/${id}`)
      .set('Authorization', `Bearer ${accessToken({ 'faq:edit': null })}`)
      .send({ question: 'มีเพียงคำถาม' });

    expect(response.status).toBe(400);
    expect(mockedService.update).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID FAQ path before calling the service', async () => {
    const response = await request(app())
      .delete('/api/v1/faqs/faq_001')
      .set('Authorization', `Bearer ${accessToken({ 'faq:edit': null })}`);

    expect(response.status).toBe(400);
    expect(mockedService.remove).not.toHaveBeenCalled();
  });

  it('soft-deletes an FAQ for an editor', async () => {
    mockedService.remove.mockResolvedValue({ id, deleted: true });

    const response = await request(app())
      .delete(`/api/v1/faqs/${id}`)
      .set('Authorization', `Bearer ${accessToken({ 'faq:edit': null })}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { id, deleted: true } });
    expect(mockedService.remove).toHaveBeenCalledWith(id, 1);
  });
});

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/v1/faqs', faqsRoutes);
  instance.use(notFoundHandler);
  instance.use(errorHandler);
  return instance;
}

function accessToken(scopes: Record<string, string | null>): string {
  return signAccessToken({
    sub: '1',
    userType: 'officer',
    roles: ['admin'],
    scopes,
  });
}
