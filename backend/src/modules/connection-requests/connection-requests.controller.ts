import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getScope } from '../../shared/middlewares/authorize';
import { createDeviceConnectionConfigSchema } from '../device-connections/device-connections.validator';
import { connectionRequestsService } from './connection-requests.service';
import {
  addMeasurementPointRequestSchema,
  addParameterRequestSchema,
  changeConnectionRequestStatusSchema,
  confirmConnectionSchema,
  connectionRequestDeviceConfigParamsSchema,
  connectionRequestIdParamsSchema,
  createConnectionRequestSchema,
  deviceConfigFormQuerySchema,
  factoryGeneralParamsSchema,
  listConnectedMeasurementPointsQuerySchema,
  listConnectionRequestTableRowsQuerySchema,
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

  async listTableRows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const query = listConnectionRequestTableRowsQuerySchema.parse(req.query);
      const result = await connectionRequestsService.listTableRows(
        query,
        actorUserId,
        getScope(req, 'cems_wpms_requests:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async listOperatorFactories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const result = await connectionRequestsService.listOperatorFactories(
        actorUserId,
        getScope(req, 'factories:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getFactoryGeneral(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { factoryId } = factoryGeneralParamsSchema.parse(req.params);
      const data = await connectionRequestsService.getFactoryGeneral(
        factoryId,
        actorUserId,
        getScope(req, 'factories:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async listConnectedMeasurementPoints(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const query = listConnectedMeasurementPointsQuerySchema.parse(req.query);
      const result = await connectionRequestsService.listConnectedMeasurementPoints(
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

  async getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = connectionRequestIdParamsSchema.parse(req.params);
      const data = await connectionRequestsService.getDetail(
        id,
        actorUserId,
        getScope(req, 'cems_wpms_requests:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getDeviceConfigFormDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = connectionRequestIdParamsSchema.parse(req.params);
      const { stationId } = deviceConfigFormQuerySchema.parse(req.query);
      const data = await connectionRequestsService.getDeviceConfigFormDetail(
        id,
        stationId,
        actorUserId,
        getScope(req, 'cems_wpms_requests:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getSingleDeviceConfigFormDetail(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id, configId } = connectionRequestDeviceConfigParamsSchema.parse(req.params);
      const data = await connectionRequestsService.getSingleDeviceConfigFormDetail(
        id,
        configId,
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

  async createMeasurementPointRequest(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const payload = addMeasurementPointRequestSchema.parse(req.body);
      const data = await connectionRequestsService.createMeasurementPointRequest(
        payload,
        actorUserId,
      );
      res.status(StatusCodes.CREATED).location(`${req.baseUrl}/${data.id}`).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  async createParameterRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const payload = addParameterRequestSchema.parse(req.body);
      const data = await connectionRequestsService.createParameterRequest(payload, actorUserId);
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

  async changeStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = connectionRequestIdParamsSchema.parse(req.params);
      const payload = changeConnectionRequestStatusSchema.parse(req.body);
      const data = await connectionRequestsService.changeStatus(id, payload, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async createDeviceConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = connectionRequestIdParamsSchema.parse(req.params);
      const payload = createDeviceConnectionConfigSchema.parse(req.body);
      const data = await connectionRequestsService.createDeviceConfig(id, payload, actorUserId);
      res.status(StatusCodes.CREATED).location(`/api/v1/device-connections/${data.id}`).json({
        success: true,
        data,
      });
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
