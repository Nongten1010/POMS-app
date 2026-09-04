import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/faqs/faqs.service', () => ({
  faqsService: {
    create: jest.fn(),
    list: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
  },
}));

import { faqsController } from '../../src/modules/faqs/faqs.controller';
import { faqsService } from '../../src/modules/faqs/faqs.service';

const mockedService = jest.mocked(faqsService);
const id = 'c24ff643-87c1-4154-bb8a-293a76b9900f';
const input = {
  question: 'คำถาม',
  answer: 'คำตอบ',
  category: 'WPMS' as const,
  updatedDate: '2026-09-04',
};
const faq = {
  id,
  ...input,
  categoryLabel: 'WPMS',
  createdAt: '2026-09-04T09:30:00.000Z',
  updatedAt: '2026-09-04T09:30:00.000Z',
};

describe('faqsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes list failures to the shared error handler', async () => {
    const failure = new Error('database unavailable');
    mockedService.list.mockRejectedValue(failure);
    const { response } = responseHarness();
    const next = jest.fn() as NextFunction;

    await faqsController.list({ query: {} } as Request, response, next);

    expect(next).toHaveBeenCalledWith(failure);
  });

  it('passes create failures to the shared error handler', async () => {
    const failure = new Error('create failed');
    mockedService.create.mockRejectedValue(failure);
    const { response } = responseHarness();
    const next = jest.fn() as NextFunction;

    await faqsController.create(authenticatedRequest({ body: input }), response, next);

    expect(next).toHaveBeenCalledWith(failure);
  });

  it('serializes the latest full update response', async () => {
    mockedService.update.mockResolvedValue(faq);
    const { response, status, json } = responseHarness();

    await faqsController.update(
      authenticatedRequest({ params: { id }, body: input }),
      response,
      jest.fn(),
    );

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true, data: faq });
  });

  it('passes delete failures to the shared error handler', async () => {
    const failure = new Error('delete failed');
    mockedService.remove.mockRejectedValue(failure);
    const { response } = responseHarness();
    const next = jest.fn() as NextFunction;

    await faqsController.remove(authenticatedRequest({ params: { id } }), response, next);

    expect(next).toHaveBeenCalledWith(failure);
  });

  it('fails closed if an authenticated route is invoked without a request user', async () => {
    const { response } = responseHarness();
    const next = jest.fn() as NextFunction;

    await faqsController.create({ body: input } as Request, response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 }),
    );
    expect(mockedService.create).not.toHaveBeenCalled();
  });
});

function authenticatedRequest(values: Partial<Request>): Request {
  return {
    ...values,
    user: {
      id: 1,
      userType: 'officer',
      roles: ['admin'],
      scopes: { 'faq:edit': null },
      regionalAccess: null,
    },
  } as Request;
}

function responseHarness() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json })) as unknown as Response['status'] & jest.Mock;
  return { response: { status } as unknown as Response, status, json };
}
