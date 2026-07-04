import { Router } from 'express';
import multer from 'multer';
import { BadRequestError } from '../../shared/errors/AppError';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import {
  allowedKwpAttachmentFileTypes,
  MAX_KWP_ATTACHMENT_FILE_SIZE_BYTES,
} from './kwp-form-attachments.service';
import { kwpFormSubmissionsController } from './kwp-form-submissions.controller';

export const kwpFormSubmissionsRoutes = Router();
const kwpAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_KWP_ATTACHMENT_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (allowedKwpAttachmentFileTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new BadRequestError('Unsupported file type'));
  },
});

kwpFormSubmissionsRoutes.use(authenticate);

kwpFormSubmissionsRoutes.post(
  '/attachments',
  authorize('kwp_forms:edit'),
  kwpAttachmentUpload.single('file'),
  kwpFormSubmissionsController.uploadAttachment,
);

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

kwpFormSubmissionsRoutes.post(
  '/kwp04',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.createKwp04,
);
