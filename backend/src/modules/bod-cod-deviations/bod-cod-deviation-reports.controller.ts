import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getScope } from '../../shared/middlewares/authorize';
import { bodCodDeviationReportsService } from './bod-cod-deviation-reports.service';
import { listBodCodDeviationReportsQuerySchema } from './bod-cod-deviation-reports.validator';

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
};

function requireActorUserId(req: Request): number {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user id is required');
  return actorUserId;
}
