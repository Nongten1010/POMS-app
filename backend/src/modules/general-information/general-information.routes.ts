import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { ForbiddenError } from '../../shared/errors/AppError';
import { getGeneralInformation } from './general-information.service';
import { generalInformationQuerySchema } from './general-information.validator';

export const generalInformationRoutes = Router();
generalInformationRoutes.get('/', authenticate, async (req, res, next) => {
  if (
    req.user?.userType !== 'officer' &&
    req.user?.userType !== 'admin' &&
    !req.user?.roles.includes('admin')
  ) {
    next(new ForbiddenError('Staff or administrator access required'));
    return;
  }
  const query = generalInformationQuerySchema.parse(req.query);
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ success: true, data: await getGeneralInformation(query.systemType) });
});
