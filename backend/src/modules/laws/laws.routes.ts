import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { lawsController, type LawsController } from './laws.controller';
import { LAW_MAX_FILE_SIZE_BYTES } from './laws-file-storage';
import { lawValidationError } from './laws.validator';

const lawUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: {
    fileSize: LAW_MAX_FILE_SIZE_BYTES,
    files: 1,
    fields: 4,
    fieldNameSize: 64,
    fieldSize: 4096,
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype === 'application/pdf') {
      callback(null, true);
      return;
    }
    callback(lawValidationError({ file: 'รองรับเฉพาะไฟล์ PDF' }));
  },
});

export function createLawsRoutes(controller: LawsController = lawsController): Router {
  const routes = Router();

  routes.get('/', controller.list);
  routes.get('/:id/file', controller.download);

  routes.use(authenticate);
  routes.post('/', authorize('laws:edit'), lawUpload.single('file'), controller.create);
  routes.put('/:id', authorize('laws:edit'), lawUpload.single('file'), controller.update);
  routes.delete('/:id', authorize('laws:edit'), controller.delete);
  return routes;
}

export const lawsRoutes = createLawsRoutes();
