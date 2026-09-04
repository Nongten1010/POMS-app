import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/laws/laws.service', () => ({
  lawsService: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getFile: jest.fn(),
  },
}));

jest.mock('../../src/modules/faqs/faqs.service', () => ({
  faqsService: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { lawsService } from '../../src/modules/laws/laws.service';
import { faqsService } from '../../src/modules/faqs/faqs.service';

const mockedLawsService = jest.mocked(lawsService);
const mockedFaqsService = jest.mocked(faqsService);

describe('content route wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLawsService.list.mockResolvedValue([]);
    mockedFaqsService.list.mockResolvedValue([]);
  });

  it('mounts the public laws collection under the API prefix', async () => {
    const response = await request(createApp()).get('/api/v1/laws');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: [] });
  });

  it('mounts the public FAQ collection under the API prefix', async () => {
    const response = await request(createApp()).get('/api/v1/faqs');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: [] });
  });
});
