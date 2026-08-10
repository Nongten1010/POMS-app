import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getScopeDetails } from '../../shared/middlewares/authorize';
import {
  createEligibleFactorySchema,
  eligibleFactoryIdParamsSchema,
  listEligibleFactoryCandidatesQuerySchema,
  listEligibleFactoriesQuerySchema,
} from './eligible-factories.validator';
import { eligibleFactoriesService } from './eligible-factories.service';
import type { EligibleFactoryAccessContext } from './eligible-factories.access';

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
  permission: 'eligible_factories:view' | 'eligible_factories:edit',
): EligibleFactoryAccessContext {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user missing from request');

  return {
    actorUserId,
    scope: getScopeDetails(req, permission),
    regionalAccess: req.user?.regionalAccess,
  };
}
