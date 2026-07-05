import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { BadRequestError } from '../../shared/errors/AppError';
import { getScope } from '../../shared/middlewares/authorize';
import { createBodCodAttachmentStorage } from './bod-cod-deviation-attachments.service';
import { bodCodDeviationReportsService } from './bod-cod-deviation-reports.service';
import {
  bodCodDeviationReportIdParamsSchema,
  changeBodCodWorkflowStatusSchema,
  createBodCodDeviationReportSchema,
  listBodCodDeviationReportsQuerySchema,
  resubmitBodCodDeviationReportSchema,
  upsertBodCodResultNoticeSchema,
} from './bod-cod-deviation-reports.validator';

export const bodCodDeviationReportsController = {
  async uploadAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireActorUserId(req);
      if (!req.file) {
        throw new BadRequestError('Attachment file is required');
      }

      const storage = createBodCodAttachmentStorage({
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

  async listFactories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const result = await bodCodDeviationReportsService.listFactories(
        actorUserId,
        getScope(req, 'bod_cod_errors:view'),
        req.user?.regionalAccess ?? undefined,
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async listReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const query = listBodCodDeviationReportsQuerySchema.parse(req.query);
      const result = await bodCodDeviationReportsService.listReports(
        query,
        actorUserId,
        getScope(req, 'bod_cod_errors:view'),
        req.user?.regionalAccess ?? undefined,
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getReportById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = bodCodDeviationReportIdParamsSchema.parse(req.params);
      const data = await bodCodDeviationReportsService.getReportById(id, {
        actorUserId,
        scope: getScope(req, 'bod_cod_errors:view'),
        regionalAccess: req.user?.regionalAccess ?? undefined,
        publicBaseUrl: getPublicBaseUrl(req),
        publicPath: env.UPLOAD_PUBLIC_PATH,
      });
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async createReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const payload = createBodCodDeviationReportSchema.parse(req.body);
      const data = await bodCodDeviationReportsService.createReport(payload, {
        actorUserId,
        scope: getBodCodWriteDataScope(req),
      });
      res
        .status(StatusCodes.CREATED)
        .location(`${env.API_PREFIX}/bod-cod-deviation-reports/${data.id}`)
        .json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async resubmitReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = bodCodDeviationReportIdParamsSchema.parse(req.params);
      const payload = resubmitBodCodDeviationReportSchema.parse(req.body);
      const data = await bodCodDeviationReportsService.resubmitReport(id, payload, {
        actorUserId,
        scope: getBodCodWriteDataScope(req),
      });
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async changeWorkflowStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = bodCodDeviationReportIdParamsSchema.parse(req.params);
      const payload = changeBodCodWorkflowStatusSchema.parse(req.body);
      const data = await bodCodDeviationReportsService.changeWorkflowStatus(id, payload, {
        actorUserId,
        scope: getScope(req, 'bod_cod_errors:approve'),
        regionalAccess: req.user?.regionalAccess ?? undefined,
      });
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async upsertResultNotice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = bodCodDeviationReportIdParamsSchema.parse(req.params);
      const payload = upsertBodCodResultNoticeSchema.parse(req.body);
      const data = await bodCodDeviationReportsService.upsertResultNotice(id, payload, {
        actorUserId,
        scope: getScope(req, 'bod_cod_errors:approve'),
        regionalAccess: req.user?.regionalAccess ?? undefined,
      });
      res.status(StatusCodes.OK).json({ success: true, data });
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

function getBodCodWriteDataScope(req: Request): string | null | undefined {
  return getScope(req, 'bod_cod_errors:edit') ?? getScope(req, 'bod_cod_errors:view');
}

function getPublicBaseUrl(req: Request): string {
  if (env.PUBLIC_BASE_URL) return env.PUBLIC_BASE_URL;
  return `${req.protocol}://${req.get('host')}`;
}
