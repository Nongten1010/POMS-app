import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createLawsController } from '../../src/modules/laws/laws.controller';
import { createLawsRoutes } from '../../src/modules/laws/laws.routes';
import type { LawServiceContract } from '../../src/modules/laws/laws.service';
import type { LawDTO } from '../../src/modules/laws/laws.types';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import { signAccessToken } from '../../src/shared/utils/jwt';

const LAW_ID = '28b69ad9-2acf-4b50-961f-84d7a5bea945';
const temporaryDirectories: string[] = [];

describe('law routes', () => {
  let service: MockLawService;

  beforeEach(() => {
    service = {
      list: jest.fn<LawServiceContract['list']>(async () => [lawDto()]),
      create: jest.fn<LawServiceContract['create']>(async () => lawDto()),
      update: jest.fn<LawServiceContract['update']>(async () => lawDto({ title: 'ประกาศแก้ไข' })),
      delete: jest.fn<LawServiceContract['delete']>(async () => ({
        id: LAW_ID,
        deleted: true,
      })),
      getFile: jest.fn<LawServiceContract['getFile']>(),
    };
  });

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it('lists every law publicly without pagination metadata', async () => {
    const response = await request(testApp(service)).get('/laws');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: [lawDto()] });
    expect(service.list).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported list query fields instead of silently ignoring them', async () => {
    const response = await request(testApp(service)).get('/laws?page=99');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(service.list).not.toHaveBeenCalled();
  });

  it('requires authentication and laws:edit for create, update, and delete', async () => {
    const app = testApp(service);
    const anonymous = await request(app).post('/laws');
    const tokenWithoutPermission = accessToken({});
    const forbidden = await request(app)
      .delete(`/laws/${LAW_ID}`)
      .set('Authorization', `Bearer ${tokenWithoutPermission}`);

    expect(anonymous.status).toBe(401);
    expect(forbidden.status).toBe(403);
  });

  it('creates a law from four multipart fields and one PDF', async () => {
    const file = pdfBuffer();
    const response = await request(testApp(service))
      .post('/laws')
      .set('Authorization', `Bearer ${accessToken()}`)
      .field('title', 'ประกาศทดสอบ')
      .field('category', 'CEMS')
      .field('type', 'RULE_AND_ANNOUNCEMENT')
      .field('publishedDate', '2026-09-04')
      .attach('file', file, { filename: 'law.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(`/laws/${LAW_ID}`);
    expect(response.body).toEqual({ success: true, data: lawDto() });
    expect(service.create).toHaveBeenCalledWith(
      {
        title: 'ประกาศทดสอบ',
        category: 'CEMS',
        type: 'RULE_AND_ANNOUNCEMENT',
        publishedDate: '2026-09-04',
      },
      expect.objectContaining({
        buffer: file,
        originalName: 'law.pdf',
        mimeType: 'application/pdf',
        size: file.length,
      }),
      7,
    );
  });

  it('updates all metadata fields without requiring a replacement PDF', async () => {
    const response = await request(testApp(service))
      .put(`/laws/${LAW_ID}`)
      .set('Authorization', `Bearer ${accessToken()}`)
      .field('title', 'ประกาศแก้ไข')
      .field('category', 'WPMS')
      .field('type', 'OTHER')
      .field('publishedDate', '2026-09-05');

    expect(response.status).toBe(200);
    expect(service.update).toHaveBeenCalledWith(
      LAW_ID,
      {
        title: 'ประกาศแก้ไข',
        category: 'WPMS',
        type: 'OTHER',
        publishedDate: '2026-09-05',
      },
      undefined,
      7,
    );
  });

  it('returns field-addressable validation errors', async () => {
    const response = await request(testApp(service))
      .post('/laws')
      .set('Authorization', `Bearer ${accessToken()}`)
      .field('title', '')
      .field('category', 'ALL')
      .field('type', 'ACT')
      .field('publishedDate', '2025-02-29');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'ข้อมูลรายการกฎหมายไม่ถูกต้อง',
        details: {
          title: expect.any(String),
          category: expect.any(String),
          type: expect.any(String),
          publishedDate: expect.any(String),
        },
      },
    });
  });

  it('rejects a non-PDF MIME type before buffering it into the service', async () => {
    const response = await request(testApp(service))
      .post('/laws')
      .set('Authorization', `Bearer ${accessToken()}`)
      .field('title', 'ประกาศทดสอบ')
      .field('category', 'CEMS')
      .field('type', 'RULE_AND_ANNOUNCEMENT')
      .field('publishedDate', '2026-09-04')
      .attach('file', Buffer.from('plain text'), {
        filename: 'law.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR', details: { file: expect.any(String) } },
    });
    expect(service.create).not.toHaveBeenCalled();
  });

  it('soft-deletes a law and returns the stable UUID', async () => {
    const response = await request(testApp(service))
      .delete(`/laws/${LAW_ID}`)
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { id: LAW_ID, deleted: true } });
    expect(service.delete).toHaveBeenCalledWith(LAW_ID, 7);
  });

  it('downloads a PDF publicly with safe attachment headers', async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, 'law.pdf');
    const content = pdfBuffer();
    await writeFile(filePath, content);
    service.getFile.mockResolvedValue({
      filePath,
      fileName: 'ประกาศ "พิเศษ".pdf',
      fileSize: content.length,
      mimeType: 'application/pdf',
    });

    const response = await request(testApp(service)).get(`/laws/${LAW_ID}/file`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/pdf/);
    expect(response.headers['content-disposition']).toContain('attachment;');
    expect(response.headers['content-disposition']).toContain("filename*=UTF-8''");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cache-control']).toBe('public, no-store, max-age=0');
    expect(response.body).toEqual(content);
  });

  it('rejects a non-UUID download identifier before looking up storage', async () => {
    const response = await request(testApp(service)).get('/laws/not-a-uuid/file');

    expect(response.status).toBe(400);
    expect(service.getFile).not.toHaveBeenCalled();
  });
});

type MockLawService = {
  [K in keyof LawServiceContract]: jest.Mock<LawServiceContract[K]>;
};

function testApp(service: MockLawService) {
  const app = express();
  app.use('/laws', createLawsRoutes(createLawsController(service)));
  app.use(errorHandler);
  return app;
}

function accessToken(scopes: Record<string, string | null> = { 'laws:edit': null }): string {
  return signAccessToken({
    sub: '7',
    userType: 'admin',
    roles: ['admin'],
    scopes,
  });
}

function lawDto(overrides: Partial<LawDTO> = {}): LawDTO {
  return {
    id: LAW_ID,
    title: 'ประกาศทดสอบ',
    category: 'CEMS',
    categoryLabel: 'CEMS',
    type: 'RULE_AND_ANNOUNCEMENT',
    typeLabel: 'กฎและประกาศ',
    publishedDate: '2026-09-04',
    file: {
      fileName: 'law.pdf',
      fileSize: 15,
      mimeType: 'application/pdf',
      downloadUrl: `/api/v1/laws/${LAW_ID}/file`,
    },
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T08:00:00.000Z',
    ...overrides,
  };
}

function pdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.7\n%%EOF\n');
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'poms-laws-route-'));
  temporaryDirectories.push(directory);
  return directory;
}
