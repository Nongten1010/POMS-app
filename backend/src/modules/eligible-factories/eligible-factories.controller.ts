import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createEligibleFactorySchema,
  eligibleFactoryIdParamsSchema,
  listEligibleFactoryCandidatesQuerySchema,
  listEligibleFactoriesQuerySchema,
} from './eligible-factories.validator';
import { eligibleFactoriesService } from './eligible-factories.service';

export const eligibleFactoriesController = {
  async listCandidates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listEligibleFactoryCandidatesQuerySchema.parse(req.query);
      const result = await eligibleFactoriesService.listCandidates(query);
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listEligibleFactoriesQuerySchema.parse(req.query);
      const result = await eligibleFactoriesService.list(query);
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
      const data = await eligibleFactoriesService.create(payload, actorUserId);
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
      await eligibleFactoriesService.remove(id, actorUserId);
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  },
};
