import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getScope, getScopeDetails } from '../../shared/middlewares/authorize';
import { kwpFormReportsService } from './kwp-form-reports.service';
import type { KwpFormReportAccess } from './kwp-form-reports.types';
import { listKwpFormRequestsQuerySchema } from './kwp-form-reports.validator';

export const kwpFormReportsController = {
  async listFactories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const result = await kwpFormReportsService.listFactories(
        actorUserId,
        getScope(req, 'kwp_forms:view'),
        req.user?.regionalAccess ?? undefined,
        getPermissionLocationAccess(req, 'kwp_forms:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const query = listKwpFormRequestsQuerySchema.parse(req.query);
      const result = await kwpFormReportsService.listRequests(
        query,
        actorUserId,
        getScope(req, 'kwp_forms:view'),
        req.user?.regionalAccess ?? undefined,
        getPermissionLocationAccess(req, 'kwp_forms:view'),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
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

function getPermissionLocationAccess(
  req: Request,
  permission: string,
): KwpFormReportAccess['locationAccess'] {
  const details = getScopeDetails(req, permission);
  if (!details) return undefined;

  const region = normalizeLocationValue(details.region);
  if (details.scope === 'IN_REGION' && region) return { regions: [region] };

  const province = normalizeLocationValue(details.province);
  if (details.scope === 'IN_PROVINCE' && province) return { provinces: [province] };

  return undefined;
}

function normalizeLocationValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'all' ? trimmed : null;
}
