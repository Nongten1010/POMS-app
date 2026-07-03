import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getScope } from '../../shared/middlewares/authorize';
import { kwpFormReportsService } from './kwp-form-reports.service';
import { listKwpFormRequestsQuerySchema } from './kwp-form-reports.validator';

export const kwpFormReportsController = {
  async listFactories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const result = await kwpFormReportsService.listFactories(
        actorUserId,
        getScope(req, 'kwp_forms:view'),
        req.user?.regionalAccess ?? undefined,
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const query = listKwpFormRequestsQuerySchema.parse(req.query);
      const result = await kwpFormReportsService.listRequests(
        query,
        actorUserId,
        getScope(req, 'kwp_forms:view'),
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
