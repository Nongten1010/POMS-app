import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getScope } from '../../shared/middlewares/authorize';
import { parameterValuesService } from './parameter-values.service';
import { type ParameterValueAccessContext } from './parameter-values.types';
import {
  latestParameterValueQuerySchema,
  listParameterValuesQuerySchema,
} from './parameter-values.validator';

export const parameterValuesController = {
  async listTables(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await parameterValuesService.listTables(requireAccess(req));
      res.status(StatusCodes.OK).json({ success: true, data, meta: { total: data.length } });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listParameterValuesQuerySchema.parse(req.query);
      const result = await parameterValuesService.list(query, requireAccess(req));
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async latest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = latestParameterValueQuerySchema.parse(req.query);
      const result = await parameterValuesService.latest(query, requireAccess(req));
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
};

function requireAccess(req: Request): ParameterValueAccessContext {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user missing from request');

  return {
    actorUserId,
    scope: getScope(req, 'cems_wpms_requests:view'),
  };
}
