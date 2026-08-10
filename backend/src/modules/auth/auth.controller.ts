import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { loginSchema } from './auth.validator';
import { authService } from './auth.service';
import { UnauthorizedError } from '../../shared/errors/AppError';

export const authController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = loginSchema.parse(req.body);
      const result = await authService.login(payload);
      res.status(StatusCodes.OK).json(result);
    } catch (err) {
      next(err);
    }
  },

  /** ดู profile + permissions ของตัวเอง */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionUser = req.user;
      if (!sessionUser) throw new UnauthorizedError('Authentication required');
      const result = await authService.me(sessionUser.id, {
        userType: sessionUser.userType,
        roles: sessionUser.roles,
        scopes: sessionUser.scopes,
        scopeDetails: sessionUser.scopeDetails,
      });
      res.status(StatusCodes.OK).json(result);
    } catch (err) {
      next(err);
    }
  },
};
