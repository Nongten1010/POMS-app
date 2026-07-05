import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { getScope } from '../../shared/middlewares/authorize';
import { bodCodDeviationReportsService } from './bod-cod-deviation-reports.service';
import {
  bodCodDeviationReportIdParamsSchema,
  changeBodCodWorkflowStatusSchema,
  createBodCodDeviationReportSchema,
  listBodCodDeviationReportsQuerySchema,
  resubmitBodCodDeviationReportSchema,
} from './bod-cod-deviation-reports.validator';

export const bodCodDeviationReportsController = {
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
};

function requireActorUserId(req: Request): number {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user id is required');
  return actorUserId;
}

function getBodCodWriteDataScope(req: Request): string | null | undefined {
  return getScope(req, 'bod_cod_errors:view');
}
