import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { emailTestController } from './email-test.controller';

export const emailTestRoutes = Router();

emailTestRoutes.use(authenticate);
emailTestRoutes.post('/send', emailTestController.send);
