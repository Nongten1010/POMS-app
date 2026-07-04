import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { kwpFormSubmissionsController } from './kwp-form-submissions.controller';

export const kwpFormSubmissionsRoutes = Router();

kwpFormSubmissionsRoutes.use(authenticate);

kwpFormSubmissionsRoutes.post(
  '/kwp01',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.createKwp01,
);

kwpFormSubmissionsRoutes.post(
  '/kwp02',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.createKwp02,
);
