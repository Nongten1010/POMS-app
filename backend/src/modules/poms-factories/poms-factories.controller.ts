import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ForbiddenError } from '../../shared/errors/AppError';
import { getScopeDetails } from '../../shared/middlewares/authorize';
import type { RegionalAccessDTO } from '../auth/regional-access';
import { pomsFactoriesService } from './poms-factories.service';
import {
  createPomsFactoryEditRequestSchema,
  listPomsFactoriesQuerySchema,
  listPomsFactoryEditRequestsQuerySchema,
  pomsFactoryEditRequestIdParamsSchema,
  pomsFactoryIdParamsSchema,
  resubmitPomsFactoryEditRequestSchema,
  reviewPomsFactoryEditRequestSchema,
} from './poms-factories.validator';

export const pomsFactoriesController = {
  async listFactories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const query = listPomsFactoriesQuerySchema.parse(req.query);
      const result = await pomsFactoriesService.listFactories(
        actorUserId,
        getScopeDetails(req, 'factories:view'),
        query.search,
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  async getFactoryDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { factoryId } = pomsFactoryIdParamsSchema.parse(req.params);
      const data = await pomsFactoriesService.getFactoryDetail(
        factoryId,
        actorUserId,
        getScopeDetails(req, 'factories:view'),
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async createEditRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { factoryId } = pomsFactoryIdParamsSchema.parse(req.params);
      const payload = createPomsFactoryEditRequestSchema.parse(req.body);
      const data = await pomsFactoriesService.createEditRequest(
        factoryId,
        payload,
        actorUserId,
        getScopeDetails(req, 'factories:edit'),
        regionalAccess(req),
      );
      res.status(StatusCodes.CREATED).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async listEditRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const query = listPomsFactoryEditRequestsQuerySchema.parse(req.query);
      const result = await pomsFactoriesService.listEditRequests(
        query,
        actorUserId,
        getScopeDetails(req, 'factories:view'),
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  async getEditRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = pomsFactoryEditRequestIdParamsSchema.parse(req.params);
      const data = await pomsFactoriesService.getEditRequest(
        id,
        actorUserId,
        getScopeDetails(req, 'factories:view'),
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async resubmitEditRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = pomsFactoryEditRequestIdParamsSchema.parse(req.params);
      const payload = resubmitPomsFactoryEditRequestSchema.parse(req.body);
      const data = await pomsFactoriesService.resubmitEditRequest(
        id,
        payload,
        actorUserId,
        getScopeDetails(req, 'factories:edit'),
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async reviewEditRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      requireAdminReviewActor(req);
      const { id } = pomsFactoryEditRequestIdParamsSchema.parse(req.params);
      const payload = reviewPomsFactoryEditRequestSchema.parse(req.body);
      const data = await pomsFactoriesService.reviewEditRequest(
        id,
        payload,
        actorUserId,
        {
          userType: req.user?.userType,
          roles: req.user?.roles ?? [],
        },
        getScopeDetails(req, 'factories:approve'),
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};

function requireActorUserId(req: Request): number {
  if (typeof req.user?.id !== 'number') {
    throw new Error('Authenticated user id is required');
  }
  return req.user.id;
}

function requireAdminReviewActor(req: Request): void {
  if (req.user?.userType === 'admin' && req.user.roles?.includes('admin')) return;
  throw new ForbiddenError('POMS factory edit request review is limited to admin users');
}

function regionalAccess(req: Request): RegionalAccessDTO | null | undefined {
  return req.user?.regionalAccess;
}
