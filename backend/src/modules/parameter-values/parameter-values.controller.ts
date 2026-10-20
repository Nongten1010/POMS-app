import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getScopeDetails } from '../../shared/middlewares/authorize';
import { ForbiddenError } from '../../shared/errors/AppError';
import { parameterValuesService } from './parameter-values.service';
import {
  type ConnectionTestAccessContext,
  type ParameterValueAccessContext,
} from './parameter-values.types';
import {
  connectionTestQuerySchema,
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

  async connectionTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = connectionTestQuerySchema.parse(req.query);
      const result = await parameterValuesService.connectionTest(
        query,
        requireConnectionTestAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
};

function requireConnectionTestAccess(req: Request): ConnectionTestAccessContext {
  const user = req.user;
  if (!user) throw new Error('Authenticated user missing from request');
  if (!['operator', 'officer', 'admin'].includes(user.userType)) {
    throw new ForbiddenError(
      'Connection test is available to operators and approving officers only',
    );
  }

  const permission =
    user.userType === 'operator' ? 'cems_wpms_requests:view' : 'cems_wpms_requests:approve';
  if (!(permission in user.scopes)) {
    throw new ForbiddenError(`Missing required permission: ${permission}`);
  }
  const scope = getScopeDetails(req, permission);
  if (!scope) throw new ForbiddenError(`Missing required permission: ${permission}`);

  return {
    actorUserId: user.id,
    scope,
    regionalAccess: user.regionalAccess ?? null,
    permission,
  };
}

function requireAccess(req: Request): ParameterValueAccessContext {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user missing from request');

  return {
    actorUserId,
    scope: getScopeDetails(req, 'cems_wpms_requests:view'),
    regionalAccess: req.user?.regionalAccess ?? null,
  };
}
