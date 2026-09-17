import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getScopeDetails } from '../../shared/middlewares/authorize';
import { kwpFormReportsService } from './kwp-form-reports.service';
import { listKwpFormRequestsQuerySchema } from './kwp-form-reports.validator';
import { z } from 'zod';

export const kwpFormReportsController = {
  async listMeasurementPoints(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const factoryId = z.string().trim().min(1).max(64).parse(req.params.factoryId);
      const result = await kwpFormReportsService.listMeasurementPoints(
        factoryId,
        requireActorUserId(req),
        getScopeDetails(req, 'kwp_forms:view'),
        req.user?.regionalAccess ?? undefined,
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  async listFactories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const result = await kwpFormReportsService.listFactories(
        actorUserId,
        getScopeDetails(req, 'kwp_forms:view'),
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
        getScopeDetails(req, 'kwp_forms:view'),
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
