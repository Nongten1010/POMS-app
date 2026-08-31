import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ForbiddenError } from '../../shared/errors/AppError';
import { getScopeDetails } from '../../shared/middlewares/authorize';
import {
  createEligibleFactoryAddRequestSchema,
  createEligibleFactorySchema,
  eligibleFactoryAddRequestIdParamsSchema,
  eligibleFactoryIdParamsSchema,
  listEligibleFactoryCandidatesQuerySchema,
  listEligibleFactoriesQuerySchema,
  listEligibleFactoryAddRequestsQuerySchema,
  reviewEligibleFactoryAddRequestSchema,
} from './eligible-factories.validator';
import { eligibleFactoriesService } from './eligible-factories.service';
import type { EligibleFactoryAccessContext } from './eligible-factories.access';
import type { PermissionScopeDetails } from '../auth/permissions';
import type { RegionalAccessDTO } from '../auth/regional-access';

export const eligibleFactoriesController = {
  async listCandidates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listEligibleFactoryCandidatesQuerySchema.parse(req.query);
      const result = await eligibleFactoriesService.listCandidates(
        query,
        buildAccessContext(req, 'eligible_factories:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listEligibleFactoriesQuerySchema.parse(req.query);
      const result = await eligibleFactoriesService.list(
        query,
        buildAccessContext(req, 'eligible_factories:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async listAddRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listEligibleFactoryAddRequestsQuerySchema.parse(req.query);
      const result = await eligibleFactoriesService.listAddRequests(
        query,
        buildAccessContext(req, 'eligible_factories:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const payload = createEligibleFactorySchema.parse(req.body);
      const data = await eligibleFactoriesService.create(
        payload,
        actorUserId,
        buildAccessContext(req, 'eligible_factories:edit'),
      );
      res.status(StatusCodes.CREATED).location(`${req.baseUrl}/${data.id}`).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  async createAddRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireOperatorActor(req).id;
      const payload = createEligibleFactoryAddRequestSchema.parse(req.body);
      const data = await eligibleFactoriesService.createAddRequest(payload, actorUserId, {
        view: buildFactoryAccessContext(req, 'factories:view'),
        edit: buildFactoryAccessContext(req, 'factories:edit'),
      });
      res.status(StatusCodes.CREATED).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  async reviewAddRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const { id } = eligibleFactoryAddRequestIdParamsSchema.parse(req.params);
      const payload = reviewEligibleFactoryAddRequestSchema.parse(req.body);
      const data = await eligibleFactoriesService.reviewAddRequest(id, payload, actorUserId, {
        view: buildAccessContext(req, 'eligible_factories:view'),
        approve: buildAccessContext(req, 'eligible_factories:approve'),
      });
      res.status(StatusCodes.OK).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const { id } = eligibleFactoryIdParamsSchema.parse(req.params);
      await eligibleFactoriesService.remove(
        id,
        actorUserId,
        buildAccessContext(req, 'eligible_factories:edit'),
      );
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  },
};

function buildAccessContext(
  req: Request,
  permission: 'eligible_factories:view' | 'eligible_factories:edit' | 'eligible_factories:approve',
): EligibleFactoryAccessContext {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user missing from request');

  return {
    actorUserId,
    scope: getScopeDetails(req, permission),
    regionalAccess: req.user?.regionalAccess,
  };
}

function buildFactoryAccessContext(
  req: Request,
  permission: 'factories:view' | 'factories:edit',
): {
  actorUserId: number;
  scope: string | null | undefined | PermissionScopeDetails;
  regionalAccess?: RegionalAccessDTO | null;
} {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user missing from request');

  return {
    actorUserId,
    scope: getScopeDetails(req, permission),
    regionalAccess: req.user?.regionalAccess,
  };
}

function requireOperatorActor(req: Request): NonNullable<Request['user']> {
  const actor = req.user;
  if (!actor) throw new Error('Authenticated user missing from request');
  if (actor.userType !== 'operator') {
    throw new ForbiddenError('Eligible factory add requests are limited to operators');
  }

  return actor;
}
