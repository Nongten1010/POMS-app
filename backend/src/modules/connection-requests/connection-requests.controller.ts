import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { getScope } from '../../shared/middlewares/authorize';
import { createDeviceConnectionConfigRequestSchema } from '../device-connections/device-connections.validator';
import type { RegionalAccessDTO } from '../auth/regional-access';
import { createConnectionRequestDocumentImageService } from './connection-request-document-image.service';
import { connectionRequestsService } from './connection-requests.service';
import {
  calendarStatusQuerySchema,
  connectedMeasurementPointDetailParamsSchema,
  measurementStatisticsQuerySchema,
} from '../parameter-values/parameter-values.validator';
import {
  addMeasurementPointRequestSchema,
  addParameterRequestSchema,
  changeConnectionRequestStatusSchema,
  confirmConnectionSchema,
  connectedMeasurementPointParamsSchema,
  connectionRequestDeviceConfigParamsSchema,
  connectionRequestIdParamsSchema,
  createConnectionRequestSchema,
  deviceConfigFormQuerySchema,
  factoryGeneralParamsSchema,
  listConnectedMeasurementPointsQuerySchema,
  listConnectionRequestTableRowsQuerySchema,
  listConnectionRequestsQuerySchema,
  listOperatorFactoriesQuerySchema,
  listPublicFactoryMapPointsQuerySchema,
  operatorFactoryFavoriteParamsSchema,
  operatorFactoryFavoriteSchema,
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
        ...getRegionalAccessArg(req),
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
        ...getRegionalAccessArg(req),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async listOperatorFactories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const query = listOperatorFactoriesQuerySchema.parse(req.query);
      const result = await connectionRequestsService.listOperatorFactories(
        actorUserId,
        getScope(req, 'factories:view'),
        query,
        ...getRegionalAccessArg(req),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async listOperatorFactoryDashboard(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const query = listOperatorFactoriesQuerySchema.parse(req.query);
      const result = await connectionRequestsService.listOperatorFactoryDashboard(
        actorUserId,
        getScope(req, 'dashboard:view'),
        { ...query, connectedOnly: true },
        ...getRegionalAccessArg(req),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async listPublicFactoryMapPoints(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listPublicFactoryMapPointsQuerySchema.parse(req.query);
      const result = await connectionRequestsService.listPublicFactoryMapPoints(query);
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async setOperatorFactoryFavorite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { factoryId } = operatorFactoryFavoriteParamsSchema.parse(req.params);
      const { isFavorite } = operatorFactoryFavoriteSchema.parse(req.body);
      const data = await connectionRequestsService.setOperatorFactoryFavorite(
        factoryId,
        isFavorite,
        actorUserId,
        getScope(req, 'factories:view'),
        ...getRegionalAccessArg(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
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
        ...getRegionalAccessArg(req),
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
        ...getRegionalAccessArg(req),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async listRequestsForConnectedMeasurementPoint(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { stationId } = connectedMeasurementPointParamsSchema.parse(req.params);
      const result = await connectionRequestsService.listDetails(
        { stationId },
        actorUserId,
        getScope(req, 'cems_wpms_requests:view'),
        ...getRegionalAccessArg(req),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async listConnectedMeasurementPointDetailsForFactory(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { factoryId } = factoryGeneralParamsSchema.parse(req.params);
      const result = await connectionRequestsService.getConnectedMeasurementPointDetailsByFactory(
        factoryId,
        actorUserId,
        getScope(req, 'cems_wpms_requests:view'),
        ...getRegionalAccessArg(req),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getAddParameterFormDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { stationId } = connectedMeasurementPointParamsSchema.parse(req.params);
      const data = await connectionRequestsService.getAddParameterFormDetail(
        stationId,
        actorUserId,
        getScope(req, 'cems_wpms_requests:view'),
        ...getRegionalAccessArg(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getCurrentDeviceConfigFormDetail(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { stationId } = connectedMeasurementPointParamsSchema.parse(req.params);
      const data = await connectionRequestsService.getCurrentDeviceConfigFormDetail(
        stationId,
        actorUserId,
        getScope(req, 'cems_wpms_requests:view'),
        ...getRegionalAccessArg(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async saveCurrentDeviceConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { stationId } = connectedMeasurementPointParamsSchema.parse(req.params);
      const payload = createDeviceConnectionConfigRequestSchema.parse(req.body);
      const data =
        'configs' in payload
          ? await connectionRequestsService.saveCurrentDeviceConfigs(
              stationId,
              payload,
              actorUserId,
              getScope(req, 'cems_wpms_requests:edit'),
              ...getRegionalAccessArg(req),
            )
          : await connectionRequestsService.saveCurrentDeviceConfig(
              stationId,
              payload,
              actorUserId,
              getScope(req, 'cems_wpms_requests:edit'),
              ...getRegionalAccessArg(req),
            );
      res.status(StatusCodes.CREATED).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getMeasurementStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { stationId } = connectedMeasurementPointDetailParamsSchema.parse(req.params);
      const query = measurementStatisticsQuerySchema.parse(req.query);
      const result = await connectionRequestsService.getMeasurementStatistics(
        stationId,
        query,
        actorUserId,
        getScope(req, 'dashboard.stats:view'),
        ...getRegionalAccessArg(req),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getCalendarStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { stationId } = connectedMeasurementPointDetailParamsSchema.parse(req.params);
      const query = calendarStatusQuerySchema.parse(req.query);
      const result = await connectionRequestsService.getCalendarStatus(
        stationId,
        query,
        actorUserId,
        getScope(req, 'dashboard.stats:view'),
        ...getRegionalAccessArg(req),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async uploadDocumentImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireActorUserId(req);
      const service = createConnectionRequestDocumentImageService({
        uploadDir: env.UPLOAD_DIR,
        publicPath: env.UPLOAD_PUBLIC_PATH,
        publicBaseUrl: getPublicBaseUrl(req),
      });
      const documentImage = await service.createDocumentImage({
        title: getSingleBodyValue(req.body.title),
        description: getSingleBodyValue(req.body.description),
        link: getSingleBodyValue(req.body.link),
        file: req.file
          ? {
              buffer: req.file.buffer,
              originalName: req.file.originalname,
              mimeType: req.file.mimetype,
              size: req.file.size,
            }
          : null,
      });
      const { storageKey: _storageKey, ...data } = documentImage;

      res.status(StatusCodes.CREATED).json({ success: true, data });
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
        ...getRegionalAccessArg(req),
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
        ...getRegionalAccessArg(req),
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
        ...getRegionalAccessArg(req),
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
        ...getRegionalAccessArg(req),
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
      const payload = createDeviceConnectionConfigRequestSchema.parse(req.body);
      if ('configs' in payload) {
        const data = await connectionRequestsService.createDeviceConfigs(id, payload, actorUserId);
        res.status(StatusCodes.CREATED).json({
          success: true,
          data,
        });
        return;
      }

      const data = await connectionRequestsService.createDeviceConfig(id, payload, actorUserId);
      res.status(StatusCodes.CREATED).json({
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

function getRegionalAccessArg(req: Request): [] | [RegionalAccessDTO] {
  return req.user?.regionalAccess ? [req.user.regionalAccess] : [];
}

function getSingleBodyValue(value: unknown): string | null {
  if (Array.isArray(value)) return getSingleBodyValue(value[0]);
  return typeof value === 'string' ? value : null;
}

function getPublicBaseUrl(req: Request): string {
  if (env.PUBLIC_BASE_URL) return env.PUBLIC_BASE_URL;
  return `${req.protocol}://${req.get('host')}`;
}
