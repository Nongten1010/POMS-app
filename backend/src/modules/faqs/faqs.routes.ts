import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { faqsController } from './faqs.controller';
import multer from 'multer';
import { FAQ_MAX_FILES, FAQ_MAX_FILE_SIZE } from './faqs-file-storage';

const upload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: {
    files: FAQ_MAX_FILES,
    fileSize: FAQ_MAX_FILE_SIZE,
    fields: 6,
    fieldNameSize: 64,
    fieldSize: 1024 * 1024,
  },
}).array('files', FAQ_MAX_FILES);

export const faqsRoutes = Router();

faqsRoutes.get('/', faqsController.list);
faqsRoutes.get('/:id/attachments/:attachmentId', faqsController.download);
faqsRoutes.post('/', authenticate, authorize('faq:edit'), upload, faqsController.create);
faqsRoutes.put('/:id', authenticate, authorize('faq:edit'), upload, faqsController.update);
faqsRoutes.delete('/:id', authenticate, authorize('faq:edit'), faqsController.remove);
