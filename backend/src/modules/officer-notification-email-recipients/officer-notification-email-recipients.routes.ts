import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { officerNotificationEmailRecipientsController } from './officer-notification-email-recipients.controller';

export const officerNotificationEmailRecipientsRoutes = Router();

officerNotificationEmailRecipientsRoutes.use(authenticate);
officerNotificationEmailRecipientsRoutes.get(
  '/',
  authorize('notifications:edit'),
  officerNotificationEmailRecipientsController.list,
);
officerNotificationEmailRecipientsRoutes.post(
  '/',
  authorize('notifications:edit'),
  officerNotificationEmailRecipientsController.create,
);
officerNotificationEmailRecipientsRoutes.post(
  '/:id/emails',
  authorize('notifications:edit'),
  officerNotificationEmailRecipientsController.addEmail,
);
