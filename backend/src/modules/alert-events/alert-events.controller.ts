import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getScopeDetails } from '../../shared/middlewares/authorize';
import { alertEventsService } from './alert-events.service';
import {
  alertEventIdParamsSchema,
  createIntegrationAlertEventBatchSchema,
  listAlertEventsQuerySchema,
  updateAlertEventStatusSchema,
} from './alert-events.validator';

export const alertEventsController = {
  async createFromIntegration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { events } = createIntegrationAlertEventBatchSchema.parse(req.body);
      const data = await alertEventsService.createBatchFromIntegration(events);
      res.status(StatusCodes.OK).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listAlertEventsQuerySchema.parse(req.query);
      const result = await alertEventsService.list(
        query,
        requireActorUserId(req),
        getScopeDetails(req, 'notifications:view'),
        req.user?.regionalAccess ?? null,
        canViewNotificationStatus(req),
      );
      res.status(StatusCodes.OK).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = alertEventIdParamsSchema.parse(req.params);
      const data = await alertEventsService.getById(
        id,
        requireActorUserId(req),
        getScopeDetails(req, 'notifications:view'),
        req.user?.regionalAccess ?? null,
        canViewNotificationStatus(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = alertEventIdParamsSchema.parse(req.params);
      const input = updateAlertEventStatusSchema.parse(req.body);
      const data = await alertEventsService.updateStatus(
        id,
        input,
        requireActorUserId(req),
        getScopeDetails(req, 'notifications:edit'),
        req.user?.regionalAccess ?? null,
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

function requireActorUserId(req: Request): number {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user missing from request');
  return actorUserId;
}

function canViewNotificationStatus(req: Request): boolean {
  return req.user?.scopes['notifications:view_status'] !== undefined;
}
