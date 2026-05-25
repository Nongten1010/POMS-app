import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { loginSchema } from './auth.validator';
import { authService } from './auth.service';

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
      const result = await authService.me(req.user!.id);
      res.status(StatusCodes.OK).json(result);
    } catch (err) {
      next(err);
    }
  },
};
