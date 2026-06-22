import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { monitoringPointFormsService } from './monitoring-point-forms.service';
import {
  listMonitoringPointFormsQuerySchema,
  monitoringPointFormIdParamsSchema,
  saveMonitoringPointFormSchema,
} from './monitoring-point-forms.validator';

export const monitoringPointFormsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listMonitoringPointFormsQuerySchema.parse(req.query);
      const data = await monitoringPointFormsService.list(query);
      res.status(StatusCodes.OK).json({ success: true, data, meta: { total: data.length } });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = monitoringPointFormIdParamsSchema.parse(req.params);
      const data = await monitoringPointFormsService.getById(id);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const payload = saveMonitoringPointFormSchema.parse(req.body);
      const data = await monitoringPointFormsService.create(payload, actorUserId);
      res.status(StatusCodes.CREATED).location(`${req.baseUrl}/${data.id}`).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const { id } = monitoringPointFormIdParamsSchema.parse(req.params);
      const payload = saveMonitoringPointFormSchema.parse(req.body);
      const data = await monitoringPointFormsService.update(id, payload, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
