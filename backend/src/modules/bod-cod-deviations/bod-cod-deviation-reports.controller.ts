import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { BadRequestError } from '../../shared/errors/AppError';
import { getScopeDetails } from '../../shared/middlewares/authorize';
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
        getScopeDetails(req, 'bod_cod_errors:view'),
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
        getScopeDetails(req, 'bod_cod_errors:view'),
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
        scope: getScopeDetails(req, 'bod_cod_errors:view'),
        editScope: getBodCodWriteDataScope(req),
        approveScope: getBodCodActionDataScope(req, 'approve'),
        regionalAccess: req.user?.regionalAccess ?? undefined,
        publicBaseUrl: getPublicBaseUrl(req),
        publicPath: env.UPLOAD_PUBLIC_PATH,
        roles: req.user?.roles ?? [],
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
        viewScope: getScopeDetails(req, 'bod_cod_errors:view'),
        roles: req.user?.roles ?? [],
        regionalAccess: req.user?.regionalAccess ?? undefined,
      });
      res
        .status(StatusCodes.CREATED)
        .location(`${env.API_PREFIX}/bod-cod-deviation-reports/${data.id}`)
        .json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async cancelReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = bodCodDeviationReportIdParamsSchema.parse(req.params);
      if (
        req.body !== undefined &&
        (req.body === null ||
          typeof req.body !== 'object' ||
          Array.isArray(req.body) ||
          Object.keys(req.body).length > 0)
      ) {
        throw new BadRequestError('Cancellation does not accept a request body');
      }
      const data = await bodCodDeviationReportsService.cancelReport(id, {
        actorUserId,
        scope: getBodCodWriteDataScope(req),
        viewScope: getScopeDetails(req, 'bod_cod_errors:view'),
        roles: req.user?.roles ?? [],
        regionalAccess: req.user?.regionalAccess ?? undefined,
      });
      res.status(StatusCodes.OK).json({ success: true, data });
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
        viewScope: getScopeDetails(req, 'bod_cod_errors:view'),
        roles: req.user?.roles ?? [],
        regionalAccess: req.user?.regionalAccess ?? undefined,
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
        scope: getBodCodActionDataScope(req, 'approve'),
        viewScope: getScopeDetails(req, 'bod_cod_errors:view'),
        regionalAccess: req.user?.regionalAccess ?? undefined,
        roles: req.user?.roles ?? [],
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
        scope: getBodCodActionDataScope(req, 'approve'),
        viewScope: getScopeDetails(req, 'bod_cod_errors:view'),
        regionalAccess: req.user?.regionalAccess ?? undefined,
        roles: req.user?.roles ?? [],
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

function getBodCodWriteDataScope(req: Request) {
  return getBodCodActionDataScope(req, 'edit');
}

function getBodCodActionDataScope(req: Request, action: 'edit' | 'approve') {
  const scope = getScopeDetails(req, `bod_cod_errors:${action}`);
  // Binary grants carry no data scope: keep the view scope instead of widening access.
  return scope?.scope === null ? getScopeDetails(req, 'bod_cod_errors:view') : scope;
}

function getPublicBaseUrl(req: Request): string {
  if (env.PUBLIC_BASE_URL) return env.PUBLIC_BASE_URL;
  return `${req.protocol}://${req.get('host')}`;
}
