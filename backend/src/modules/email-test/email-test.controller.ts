import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendEmailTestSchema } from './email-test.validator';
import { emailTestService } from './email-test.service';

export const emailTestController = {
  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = sendEmailTestSchema.parse(req.body);
      const data = await emailTestService.send(payload, req.user!.id);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
