import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { getScope } from '../../shared/middlewares/authorize';
import { kwpFormSubmissionsService } from './kwp-form-submissions.service';
import { createKwp01SubmissionSchema } from './kwp-form-submissions.validator';

export const kwpFormSubmissionsController = {
  async createKwp01(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const payload = createKwp01SubmissionSchema.parse(req.body);
      const result = await kwpFormSubmissionsService.createKwp01(payload, {
        actorUserId,
        scope: getScope(req, 'kwp_forms:edit'),
      });
      res
        .status(StatusCodes.CREATED)
        .location(`${env.API_PREFIX}/kwp-form-reports/requests/${result.id}`)
        .json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

function requireActorUserId(req: Request): number {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user id is required');
  return actorUserId;
}
