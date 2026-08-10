import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getScopeDetails } from '../../shared/middlewares/authorize';
import { monitoringPointFormsService } from './monitoring-point-forms.service';
import type { MonitoringPointFormAccessContext } from './monitoring-point-forms.types';
import {
  listMonitoringPointFormsQuerySchema,
  monitoringPointFormIdParamsSchema,
  saveMonitoringPointFormSchema,
} from './monitoring-point-forms.validator';

export const monitoringPointFormsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listMonitoringPointFormsQuerySchema.parse(req.query);
      const data = await monitoringPointFormsService.list(
        query,
        requireAccess(req, 'cems_wpms_requests:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, data, meta: { total: data.length } });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = monitoringPointFormIdParamsSchema.parse(req.params);
      const data = await monitoringPointFormsService.getById(
        id,
        requireAccess(req, 'cems_wpms_requests:view'),
      );
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
      const data = await monitoringPointFormsService.create(
        payload,
        actorUserId,
        requireAccess(req, 'cems_wpms_requests:edit'),
      );
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
      const data = await monitoringPointFormsService.update(
        id,
        payload,
        actorUserId,
        requireAccess(req, 'cems_wpms_requests:edit'),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async selectEligible(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const { id } = monitoringPointFormIdParamsSchema.parse(req.params);
      const data = await monitoringPointFormsService.selectEligible(
        id,
        actorUserId,
        requireAccess(req, 'eligible_factories:edit'),
      );
      res.status(StatusCodes.CREATED).location(`/api/v1/eligible-factories/${data.id}`).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },
};

function requireAccess(req: Request, permission: string): MonitoringPointFormAccessContext {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user missing from request');
  return {
    actorUserId,
    scope: getScopeDetails(req, permission),
    regionalAccess: req.user?.regionalAccess ?? null,
  };
}
