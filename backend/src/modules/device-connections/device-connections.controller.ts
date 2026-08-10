import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getScopeDetails } from '../../shared/middlewares/authorize';
import { deviceConnectionsService } from './device-connections.service';
import type { DeviceConnectionAccessContext } from './device-connections.types';
import {
  createDeviceConnectionConfigSchema,
  deviceConnectionConfigIdParamsSchema,
  listDeviceConnectionConfigsQuerySchema,
  testDeviceConnectionSchema,
} from './device-connections.validator';

export const deviceConnectionsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listDeviceConnectionConfigsQuerySchema.parse(req.query);
      const data = await deviceConnectionsService.list(query, requireAccess(req, 'cems_wpms_requests:view'));
      res.status(StatusCodes.OK).json({ success: true, data, meta: { total: data.length } });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = deviceConnectionConfigIdParamsSchema.parse(req.params);
      const data = await deviceConnectionsService.getById(id, requireAccess(req, 'cems_wpms_requests:view'));
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const payload = createDeviceConnectionConfigSchema.parse(req.body);
      const data = await deviceConnectionsService.create(
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

  async testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = testDeviceConnectionSchema.parse(req.body);
      const data = await deviceConnectionsService.testConnection(
        payload,
        requireAccess(req, 'cems_wpms_requests:edit'),
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

function requireAccess(req: Request, permission: string): DeviceConnectionAccessContext {
  return {
    actorUserId: requireActorUserId(req),
    scope: getScopeDetails(req, permission),
    regionalAccess: req.user?.regionalAccess ?? null,
  };
}
