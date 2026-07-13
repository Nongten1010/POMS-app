import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  addOfficerNotificationEmailSchema,
  createOfficerNotificationEmailRecipientSchema,
  officerNotificationEmailRecipientIdParamsSchema,
} from './officer-notification-email-recipients.validator';
import { officerNotificationEmailRecipientsService } from './officer-notification-email-recipients.service';

export const officerNotificationEmailRecipientsController = {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await officerNotificationEmailRecipientsService.list();
      res.status(StatusCodes.OK).json({ success: true, data, meta: { total: data.length } });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const input = createOfficerNotificationEmailRecipientSchema.parse(req.body);
      const data = await officerNotificationEmailRecipientsService.create(input, actorUserId);
      res
        .status(StatusCodes.CREATED)
        .location(`${req.baseUrl}/${data.id}`)
        .json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async addEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const { id } = officerNotificationEmailRecipientIdParamsSchema.parse(req.params);
      const { email } = addOfficerNotificationEmailSchema.parse(req.body);
      const data = await officerNotificationEmailRecipientsService.addEmail(id, email, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
