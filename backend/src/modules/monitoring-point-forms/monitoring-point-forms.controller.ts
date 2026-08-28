import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { BadRequestError } from '../../shared/errors/AppError';
import { getScopeDetails } from '../../shared/middlewares/authorize';
import { createMonitoringPointFormAttachmentStorage } from './monitoring-point-form-attachments.service';
import { monitoringPointFormsService } from './monitoring-point-forms.service';
import type { MonitoringPointFormAccessContext } from './monitoring-point-forms.types';
import {
  listMonitoringPointFormsQuerySchema,
  monitoringPointFormIdParamsSchema,
  saveMonitoringPointFormSchema,
} from './monitoring-point-forms.validator';

export const monitoringPointFormsController = {
  async downloadAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const storage = createMonitoringPointFormAttachmentStorage({
        uploadDir: env.UPLOAD_DIR,
        signingSecret: env.JWT_SECRET,
        apiPrefix: env.API_PREFIX,
      });
      const content = await storage.getContent(
        req.params.publicId,
        req.query.expires,
        req.query.signature,
      );

      res.setHeader('Content-Type', content.fileType);
      res.setHeader('Content-Length', String(content.fileSize));
      res.setHeader('Content-Disposition', buildInlineContentDisposition(content.fileName));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.status(StatusCodes.OK);
      await pipeline(createReadStream(content.filePath), res);
    } catch (err) {
      if (res.headersSent || res.destroyed) {
        if (!res.destroyed) res.destroy(err instanceof Error ? err : undefined);
        return;
      }
      next(err);
    }
  },

  async uploadAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      if (!req.file) {
        throw new BadRequestError('Attachment file is required');
      }

      const storage = createMonitoringPointFormAttachmentStorage({
        uploadDir: env.UPLOAD_DIR,
        signingSecret: env.JWT_SECRET,
        apiPrefix: env.API_PREFIX,
      });
      const data = await storage.save(
        {
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
        },
        actorUserId,
      );

      res.status(StatusCodes.CREATED).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listMonitoringPointFormsQuerySchema.parse(req.query);
      const data = await monitoringPointFormsService.list(
        query,
        requireAccess(req, 'cems_wpms_requests:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, data, meta: { total: data.length } });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = monitoringPointFormIdParamsSchema.parse(req.params);
      const data = await monitoringPointFormsService.getById(
        id,
        requireAccess(req, 'cems_wpms_requests:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const payload = saveMonitoringPointFormSchema.parse(req.body);
      const data = await monitoringPointFormsService.create(
        payload,
        actorUserId,
        requireAccess(req, 'cems_wpms_requests:edit'),
      );
      res.status(StatusCodes.CREATED).location(`${req.baseUrl}/${data.id}`).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const { id } = monitoringPointFormIdParamsSchema.parse(req.params);
      const payload = saveMonitoringPointFormSchema.parse(req.body);
      const data = await monitoringPointFormsService.update(
        id,
        payload,
        actorUserId,
        requireAccess(req, 'cems_wpms_requests:edit'),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async selectEligible(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const { id } = monitoringPointFormIdParamsSchema.parse(req.params);
      const data = await monitoringPointFormsService.selectEligible(
        id,
        actorUserId,
        requireAccess(req, 'eligible_factories:approve'),
      );
      res.status(StatusCodes.CREATED).location(`/api/v1/eligible-factories/${data.id}`).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },
};

function requireAccess(req: Request, permission: string): MonitoringPointFormAccessContext {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user missing from request');
  return {
    actorUserId,
    scope: getScopeDetails(req, permission),
    regionalAccess: req.user?.regionalAccess ?? null,
  };
}

function buildInlineContentDisposition(fileName: string): string {
  const asciiFileName = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const encodedFileName = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`;
}
