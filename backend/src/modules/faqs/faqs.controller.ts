import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { AppError, UnauthorizedError } from '../../shared/errors/AppError';
import { faqsService } from './faqs.service';
import {
  createFaqSchema,
  faqIdParamsSchema,
  faqListQuerySchema,
  updateFaqSchema,
  faqAttachmentParamsSchema,
} from './faqs.validator';

export const faqsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      faqListQuerySchema.parse(req.query);
      const data = await faqsService.list();
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createFaqSchema.parse(parseBody(req));
      const data = req.files
        ? await faqsService.create(
            input,
            authenticatedUserId(req),
            req.files as Express.Multer.File[],
          )
        : await faqsService.create(input, authenticatedUserId(req));
      res.status(StatusCodes.CREATED).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = faqIdParamsSchema.parse(req.params);
      const input = updateFaqSchema.parse(parseBody(req));
      const data = req.files
        ? await faqsService.update(
            id,
            input,
            authenticatedUserId(req),
            req.files as Express.Multer.File[],
          )
        : await faqsService.update(id, input, authenticatedUserId(req));
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      faqListQuerySchema.parse(req.query);
      const { id, attachmentId } = faqAttachmentParamsSchema.parse(req.params);
      const file = await faqsService.download(id, attachmentId);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.attachment(file.fileName);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', file.fileSize);
      await pipeline(createReadStream(file.filePath), res);
    } catch (error) {
      if (res.headersSent || res.destroyed) {
        if (!res.destroyed) res.destroy();
        return;
      }
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = faqIdParamsSchema.parse(req.params);
      const data = await faqsService.remove(id, authenticatedUserId(req));
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};

function parseBody(req: Request): unknown {
  if (!req.is('multipart/form-data')) return req.body;
  const body = { ...req.body };
  for (const field of ['links', 'attachmentIds']) {
    if (body[field] !== undefined) {
      try {
        if (typeof body[field] !== 'string') throw new Error('Expected JSON string');
        body[field] = JSON.parse(body[field]);
      } catch {
        throw new AppError('Request validation failed', 400, 'VALIDATION_ERROR', {
          [field]: 'Must be a JSON array',
        });
      }
    }
  }
  return body;
}

function authenticatedUserId(req: Request): number {
  if (!req.user?.id) throw new UnauthorizedError('Authentication required');
  return req.user.id;
}
