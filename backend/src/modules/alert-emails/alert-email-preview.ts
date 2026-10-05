import { Router } from 'express';
import { z } from 'zod';
import type { PermissionScopeDetails } from '../auth/permissions';
import type { RegionalAccessDTO } from '../auth/regional-access';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize, getScopeDetails } from '../../shared/middlewares/authorize';
import { BadRequestError } from '../../shared/errors/AppError';
import { alertEventsService } from '../alert-events/alert-events.service';
import { createIntegrationAlertEventSchema } from '../alert-events/alert-events.validator';
import { normalizeAlertEventUnit } from '../alert-events/alert-event-identity';
import type { AlertEventDTO } from '../alert-events/alert-events.types';
import { renderAlertEmail } from './alert-email-template';
import { alertEmailSourceRepository } from './alert-email-source.repository';

export const alertEmailPreviewSchema = z
  .object({
    eventIds: z
      .array(z.number().int().positive())
      .min(1)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, 'eventIds must be unique'),
    scheduledAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export interface AlertEmailPreviewActor {
  userId: number;
  scope: PermissionScopeDetails | string | null | undefined;
  regionalAccess: RegionalAccessDTO | null;
}

export const alertEmailPreviewService = {
  async preview(input: z.infer<typeof alertEmailPreviewSchema>, actor: AlertEmailPreviewActor) {
    const parsed = alertEmailPreviewSchema.parse(input);
    const scopedEvents = await Promise.all(
      parsed.eventIds.map((id) =>
        alertEventsService.getById(id, actor.userId, actor.scope, actor.regionalAccess, false),
      ),
    );
    const events = scopedEvents.map(restoreMeasurementWindow);
    const scheduledAt = Date.parse(parsed.scheduledAt);
    if (events.some((event) => event.endedAt && Date.parse(event.endedAt) > scheduledAt)) {
      throw new BadRequestError('The measurement window must end before the email round');
    }
    const contextByEventId = await alertEmailSourceRepository.loadRenderContext(events);
    try {
      return {
        ...renderAlertEmail({ events, scheduledAt: parsed.scheduledAt, contextByEventId }),
        eventCount: events.length,
        scheduledAt: parsed.scheduledAt,
      };
    } catch {
      throw new BadRequestError(
        'Events must belong to one supported email type and contain valid evidence',
      );
    }
  },
};

function restoreMeasurementWindow(event: AlertEventDTO): AlertEventDTO {
  if (!['STANDARD_EXCEEDED', 'EIA_EXCEEDED'].includes(event.alertType)) return event;
  const original = createIntegrationAlertEventSchema.safeParse(event.sourcePayload);
  if (
    !original.success ||
    original.data.alertType !== event.alertType ||
    original.data.systemType !== event.systemType ||
    original.data.stationId !== event.stationId ||
    original.data.parameterCode !== event.parameterCode.toLowerCase() ||
    normalizeAlertEventUnit(original.data.unit) !== normalizeAlertEventUnit(event.unit ?? '')
  ) {
    throw new BadRequestError('Original hourly measurement time is unavailable');
  }
  return { ...event, startedAt: original.data.startedAt, endedAt: original.data.endedAt };
}

export const alertEmailPreviewRoutes = Router();
alertEmailPreviewRoutes.use(authenticate);
alertEmailPreviewRoutes.post('/', authorize('notifications:edit'), async (req, res, next) => {
  try {
    if (!req.user) throw new Error('Authenticated user missing from request');
    const data = await alertEmailPreviewService.preview(alertEmailPreviewSchema.parse(req.body), {
      userId: req.user.id,
      scope: getScopeDetails(req, 'notifications:edit'),
      regionalAccess: req.user.regionalAccess ?? null,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
