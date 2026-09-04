import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { faqsController } from './faqs.controller';

export const faqsRoutes = Router();

faqsRoutes.get('/', faqsController.list);
faqsRoutes.post('/', authenticate, authorize('faq:edit'), faqsController.create);
faqsRoutes.put('/:id', authenticate, authorize('faq:edit'), faqsController.update);
faqsRoutes.delete('/:id', authenticate, authorize('faq:edit'), faqsController.remove);
