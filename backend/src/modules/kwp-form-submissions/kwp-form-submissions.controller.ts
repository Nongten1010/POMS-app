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
  createKwp03SubmissionSchema,
  createKwp04SubmissionSchema,
  createKwp05SubmissionSchema,
} from './kwp-form-submissions.validator';
import type { KwpFormSubmissionDetailType } from './kwp-form-submissions.types';

export const kwpFormSubmissionsController = {
  async getKwp01ById(req: Request, res: Response, next: NextFunction): Promise<void> {
    await getById(req, res, next, 'KWP01');
  },

  async getKwp02ById(req: Request, res: Response, next: NextFunction): Promise<void> {
    await getById(req, res, next, 'KWP02');
  },

  async getKwp03ById(req: Request, res: Response, next: NextFunction): Promise<void> {
    await getById(req, res, next, 'KWP03');
  },

  async getKwp04ById(req: Request, res: Response, next: NextFunction): Promise<void> {
    await getById(req, res, next, 'KWP04');
  },

  async getKwp05ById(req: Request, res: Response, next: NextFunction): Promise<void> {
    await getById(req, res, next, 'KWP05');
  },

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

  async createKwp03(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const payload = createKwp03SubmissionSchema.parse(req.body);
      const result = await kwpFormSubmissionsService.createKwp03(payload, {
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

  async createKwp05(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const payload = createKwp05SubmissionSchema.parse(req.body);
      const result = await kwpFormSubmissionsService.createKwp05(payload, {
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

async function getById(
  req: Request,
  res: Response,
  next: NextFunction,
  formType: KwpFormSubmissionDetailType,
): Promise<void> {
  try {
    const actorUserId = requireActorUserId(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestError('KWP form submission id must be a positive integer');
    }

    const result = await kwpFormSubmissionsService.getById(id, {
      actorUserId,
      formType,
      scope: getScope(req, 'kwp_forms:view'),
      regionalAccess: req.user?.regionalAccess ?? undefined,
      publicBaseUrl: getPublicBaseUrl(req),
      publicPath: env.UPLOAD_PUBLIC_PATH,
    });
    res.status(StatusCodes.OK).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

function requireActorUserId(req: Request): number {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user id is required');
  return actorUserId;
}

function getPublicBaseUrl(req: Request): string {
  if (env.PUBLIC_BASE_URL) return env.PUBLIC_BASE_URL;
  return `${req.protocol}://${req.get('host')}`;
}
