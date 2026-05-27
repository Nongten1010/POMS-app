import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getScope } from '../../shared/middlewares/authorize';
import { connectionRequestsService } from './connection-requests.service';
import {
  confirmConnectionSchema,
  connectionRequestIdParamsSchema,
  createConnectionRequestSchema,
  listConnectionRequestsQuerySchema,
  resubmitConnectionRequestSchema,
  reviewConnectionRequestSchema,
  verifyConnectionSchema,
} from './connection-requests.validator';

export const connectionRequestsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const query = listConnectionRequestsQuerySchema.parse(req.query);
      const result = await connectionRequestsService.list(
        query,
        actorUserId,
        getScope(req, 'cems_wpms_requests:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = connectionRequestIdParamsSchema.parse(req.params);
      const data = await connectionRequestsService.getById(
        id,
        actorUserId,
        getScope(req, 'cems_wpms_requests:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const payload = createConnectionRequestSchema.parse(req.body);
      const data = await connectionRequestsService.create(payload, actorUserId);
      res.status(StatusCodes.CREATED).location(`${req.baseUrl}/${data.id}`).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  async resubmit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = connectionRequestIdParamsSchema.parse(req.params);
      const payload = resubmitConnectionRequestSchema.parse(req.body);
      const data = await connectionRequestsService.resubmit(id, payload, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async review(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = connectionRequestIdParamsSchema.parse(req.params);
      const payload = reviewConnectionRequestSchema.parse(req.body);
      const data = await connectionRequestsService.review(id, payload, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async confirmConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = connectionRequestIdParamsSchema.parse(req.params);
      const payload = confirmConnectionSchema.parse(req.body);
      const data = await connectionRequestsService.confirmConnection(id, payload, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async verifyConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = connectionRequestIdParamsSchema.parse(req.params);
      const payload = verifyConnectionSchema.parse(req.body);
      const data = await connectionRequestsService.verifyConnection(id, payload, actorUserId);
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
