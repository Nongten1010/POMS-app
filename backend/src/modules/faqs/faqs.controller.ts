import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError } from '../../shared/errors/AppError';
import { faqsService } from './faqs.service';
import {
  createFaqSchema,
  faqIdParamsSchema,
  faqListQuerySchema,
  updateFaqSchema,
} from './faqs.validator';

export const faqsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      faqListQuerySchema.parse(req.query);
      const data = await faqsService.list();
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createFaqSchema.parse(req.body);
      const data = await faqsService.create(input, authenticatedUserId(req));
      res.status(StatusCodes.CREATED).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = faqIdParamsSchema.parse(req.params);
      const input = updateFaqSchema.parse(req.body);
      const data = await faqsService.update(id, input, authenticatedUserId(req));
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = faqIdParamsSchema.parse(req.params);
      const data = await faqsService.remove(id, authenticatedUserId(req));
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};

function authenticatedUserId(req: Request): number {
  if (!req.user?.id) throw new UnauthorizedError('Authentication required');
  return req.user.id;
}
