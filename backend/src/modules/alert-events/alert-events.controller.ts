import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { alertEventsService } from './alert-events.service';
import {
  alertEventIdParamsSchema,
  createIntegrationAlertEventSchema,
  listAlertEventsQuerySchema,
  updateAlertEventStatusSchema,
} from './alert-events.validator';

export const alertEventsController = {
  async createFromIntegration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createIntegrationAlertEventSchema.parse(req.body);
      const result = await alertEventsService.createFromIntegration(input);
      res.status(result.created ? StatusCodes.CREATED : StatusCodes.OK).json({
        success: true,
        data: {
          created: result.created,
          duplicate: result.duplicate,
          ...result.event,
          ...(result.duplicate ? { message: 'Alert event already exists' } : {}),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listAlertEventsQuerySchema.parse(req.query);
      const result = await alertEventsService.list(query);
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
      const data = await alertEventsService.getById(id);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = alertEventIdParamsSchema.parse(req.params);
      const input = updateAlertEventStatusSchema.parse(req.body);
      const data = await alertEventsService.updateStatus(id, input, req.user?.id ?? 0);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
