import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { getScope } from '../../shared/middlewares/authorize';
import { BadRequestError } from '../../shared/errors/AppError';
import { createKwpAttachmentStorage } from './kwp-form-attachments.service';
import { kwpFormSubmissionsService } from './kwp-form-submissions.service';
import {
  createKwp01SubmissionSchema,
  createKwp02SubmissionSchema,
  createKwp04SubmissionSchema,
} from './kwp-form-submissions.validator';

export const kwpFormSubmissionsController = {
  async uploadAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireActorUserId(req);
      if (!req.file) {
        throw new BadRequestError('Attachment file is required');
      }

      const storage = createKwpAttachmentStorage({
        uploadDir: env.UPLOAD_DIR,
        publicPath: env.UPLOAD_PUBLIC_PATH,
        publicBaseUrl: getPublicBaseUrl(req),
      });
      const data = await storage.save({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });

      res.status(StatusCodes.CREATED).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async createKwp01(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const payload = createKwp01SubmissionSchema.parse(req.body);
      const result = await kwpFormSubmissionsService.createKwp01(payload, {
        actorUserId,
        scope: getScope(req, 'kwp_forms:edit'),
      });
      res
        .status(StatusCodes.CREATED)
        .location(`${env.API_PREFIX}/kwp-form-reports/requests/${result.id}`)
        .json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async createKwp02(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const payload = createKwp02SubmissionSchema.parse(req.body);
      const result = await kwpFormSubmissionsService.createKwp02(payload, {
        actorUserId,
        scope: getScope(req, 'kwp_forms:edit'),
      });
      res
        .status(StatusCodes.CREATED)
        .location(`${env.API_PREFIX}/kwp-form-reports/requests/${result.id}`)
        .json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async createKwp04(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const payload = createKwp04SubmissionSchema.parse(req.body);
      const result = await kwpFormSubmissionsService.createKwp04(payload, {
        actorUserId,
        scope: getScope(req, 'kwp_forms:edit'),
      });
      res
        .status(StatusCodes.CREATED)
        .location(`${env.API_PREFIX}/kwp-form-reports/requests/${result.id}`)
        .json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

function requireActorUserId(req: Request): number {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user id is required');
  return actorUserId;
}

function getPublicBaseUrl(req: Request): string {
  if (env.PUBLIC_BASE_URL) return env.PUBLIC_BASE_URL;
  return `${req.protocol}://${req.get('host')}`;
}
