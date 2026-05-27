import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { deviceConnectionsService } from './device-connections.service';
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
      const data = await deviceConnectionsService.list(query);
      res.status(StatusCodes.OK).json({ success: true, data, meta: { total: data.length } });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = deviceConnectionConfigIdParamsSchema.parse(req.params);
      const data = await deviceConnectionsService.getById(id);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const payload = createDeviceConnectionConfigSchema.parse(req.body);
      const data = await deviceConnectionsService.create(payload, actorUserId);
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
      const data = await deviceConnectionsService.testConnection(payload);
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
