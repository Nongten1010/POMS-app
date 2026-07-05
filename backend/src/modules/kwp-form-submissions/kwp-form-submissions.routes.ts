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
  '/kwp03',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.createKwp03,
);

kwpFormSubmissionsRoutes.post(
  '/kwp04',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.createKwp04,
);

kwpFormSubmissionsRoutes.post(
  '/kwp05',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.createKwp05,
);

kwpFormSubmissionsRoutes.patch(
  '/kwp01/:id',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.updateKwp01,
);

kwpFormSubmissionsRoutes.patch(
  '/kwp02/:id',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.updateKwp02,
);

kwpFormSubmissionsRoutes.patch(
  '/kwp03/:id',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.updateKwp03,
);

kwpFormSubmissionsRoutes.patch(
  '/kwp04/:id',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.updateKwp04,
);

kwpFormSubmissionsRoutes.patch(
  '/kwp05/:id',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.updateKwp05,
);

kwpFormSubmissionsRoutes.post(
  '/kwp01/:id/resubmit',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.resubmitKwp01,
);

kwpFormSubmissionsRoutes.post(
  '/kwp02/:id/resubmit',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.resubmitKwp02,
);

kwpFormSubmissionsRoutes.post(
  '/kwp03/:id/resubmit',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.resubmitKwp03,
);

kwpFormSubmissionsRoutes.post(
  '/kwp04/:id/resubmit',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.resubmitKwp04,
);

kwpFormSubmissionsRoutes.post(
  '/kwp05/:id/resubmit',
  authorize('kwp_forms:edit'),
  kwpFormSubmissionsController.resubmitKwp05,
);

kwpFormSubmissionsRoutes.get(
  '/:id/workflow',
  authorize('kwp_forms:view'),
  kwpFormSubmissionsController.getWorkflow,
);

kwpFormSubmissionsRoutes.post(
  '/:id/workflow-actions',
  authorize('kwp_forms:approve'),
  kwpFormSubmissionsController.changeWorkflowStatus,
);

kwpFormSubmissionsRoutes.get(
  '/kwp01/:id',
  authorize('kwp_forms:view'),
  kwpFormSubmissionsController.getKwp01ById,
);

kwpFormSubmissionsRoutes.get(
  '/kwp02/:id',
  authorize('kwp_forms:view'),
  kwpFormSubmissionsController.getKwp02ById,
);

kwpFormSubmissionsRoutes.get(
  '/kwp03/:id',
  authorize('kwp_forms:view'),
  kwpFormSubmissionsController.getKwp03ById,
);

kwpFormSubmissionsRoutes.get(
  '/kwp04/:id',
  authorize('kwp_forms:view'),
  kwpFormSubmissionsController.getKwp04ById,
);

kwpFormSubmissionsRoutes.get(
  '/kwp05/:id',
  authorize('kwp_forms:view'),
  kwpFormSubmissionsController.getKwp05ById,
);
