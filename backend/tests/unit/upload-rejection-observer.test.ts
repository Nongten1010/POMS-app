import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { logger } from '../../src/config/logger';
import {
  captureUploadFileMetadata,
  createUploadRejectionObserver,
} from '../../src/shared/middlewares/upload-rejection-observer';

describe('upload rejection response lifecycle', () => {
  beforeEach(() => {
    jest.spyOn(logger, 'warn').mockImplementation(() => logger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function requestFor(pathname: string, method = 'POST'): Request {
    return {
      method,
      path: pathname,
      get: (name: string) => (name === 'content-length' ? '4096' : undefined),
    } as Request;
  }

  function responseFor(statusCode = 200) {
    const response = Object.assign(new EventEmitter(), {
      statusCode,
      writableFinished: false,
      json: jest.fn((_body: unknown) => response),
    });
    return response;
  }

  it('records one abort when a request closes before a response can finish', () => {
    const req = requestFor('/custom/v2/cems-wpms-requests/document-images');
    const res = responseFor();
    const next = jest.fn();
    createUploadRejectionObserver('/custom/v2')(req, res as unknown as Response, next);
    captureUploadFileMetadata(req, {
      originalname: 'private-owner.pdf',
      mimetype: 'application/pdf',
    });

    res.emit('close');
    res.emit('close');
    res.statusCode = 500;
    res.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'upload.rejected',
      expect.objectContaining({
        endpoint: '/custom/v2/cems-wpms-requests/document-images',
        status: null,
        reasonCode: 'REQUEST_ABORTED',
        fileExtension: '.pdf',
        declaredMimeType: 'application/pdf',
        fileSize: null,
      }),
    );
  });

  it('does not interpret the normal close after a successful finish as an abort', () => {
    const req = requestFor('/api/v1/kwp-form-submissions/attachments');
    const res = responseFor(201);
    createUploadRejectionObserver('/api/v1')(req, res as unknown as Response, jest.fn());
    res.writableFinished = true;
    res.emit('finish');
    res.emit('close');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('keeps custom prefixes and resource identifiers out of each other', () => {
    const req = requestFor('/internal-api/v9/faqs/private-resource-id', 'PUT');
    const res = responseFor(400);
    const originalJson = res.json;
    const body = {
      success: false,
      error: { code: 'BAD_REQUEST', message: 'private-unmapped-error-message' },
    };
    createUploadRejectionObserver('/internal-api/v9/')(req, res as unknown as Response, jest.fn());
    expect(res.json(body)).toBe(res);
    expect(originalJson).toHaveBeenCalledWith(body);
    res.writableFinished = true;
    res.emit('finish');
    res.emit('close');

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'upload.rejected',
      expect.objectContaining({
        endpoint: '/internal-api/v9/faqs/:id',
        method: 'PUT',
        reasonCode: 'UPLOAD_REJECTED',
      }),
    );
    const captured = JSON.stringify(jest.mocked(logger.warn).mock.calls);
    expect(captured).not.toContain('private-resource-id');
    expect(captured).not.toContain('private-unmapped-error-message');
  });

  it('bounds metadata and classifies arbitrary MIME types and extensions without logging them', () => {
    const req = requestFor('/api/v1/faqs');
    const res = responseFor(400);
    createUploadRejectionObserver('/api/v1')(req, res as unknown as Response, jest.fn());
    for (let index = 0; index < 15; index += 1) {
      captureUploadFileMetadata(req, {
        originalname: `private-owner-${index}.private-extension`,
        mimetype: 'application/private-mime-token',
      });
    }
    res.json({
      success: false,
      error: { code: 'UPLOAD_ERROR', details: { reason: 'LIMIT_FILE_COUNT' } },
    });
    res.writableFinished = true;
    res.emit('finish');

    expect(logger.warn).toHaveBeenCalledWith(
      'upload.rejected',
      expect.objectContaining({
        fileCount: 10,
        fileExtension: null,
        declaredMimeType: null,
        reasonCode: 'LIMIT_FILE_COUNT',
        files: Array.from({ length: 10 }, () => ({
          fileExtension: 'other',
          declaredMimeType: 'other',
          fileSize: null,
        })),
      }),
    );
    const captured = JSON.stringify(jest.mocked(logger.warn).mock.calls);
    expect(captured).not.toContain('private-owner');
    expect(captured).not.toContain('private-extension');
    expect(captured).not.toContain('private-mime-token');
  });

  it('does not allow diagnostic transport failure to escape the response event', () => {
    const req = requestFor('/api/v1/poms-factories/document-images');
    const res = responseFor(400);
    createUploadRejectionObserver('/api/v1')(req, res as unknown as Response, jest.fn());
    jest.mocked(logger.warn).mockImplementationOnce(() => {
      throw new Error('diagnostic transport unavailable');
    });
    res.json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Invalid uploaded file name' },
    });
    res.writableFinished = true;
    expect(() => res.emit('finish')).not.toThrow();
    expect(() => res.emit('close')).not.toThrow();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
