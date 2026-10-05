import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize, getScopeDetails } from '../../shared/middlewares/authorize';
import { NotFoundError } from '../../shared/errors/AppError';
import { alertEventsService } from '../alert-events/alert-events.service';
import { alertEmailOutboxRepository } from './alert-email-outbox.repository';
import type { AlertEmailPreviewActor } from './alert-email-preview';

export const alertEmailHistoryService = {
  async getById(id: number, actor: AlertEmailPreviewActor) {
    const delivery = await alertEmailOutboxRepository.findDelivery(id);
    if (!delivery || delivery.eventIds.length === 0)
      throw new NotFoundError('Email delivery not found');
    try {
      // A batch can include multiple factories. Access to one event never reveals the others.
      for (const eventId of delivery.eventIds) {
        await alertEventsService.getById(
          eventId,
          actor.userId,
          actor.scope,
          actor.regionalAccess,
          false,
        );
      }
    } catch (error) {
      if (error instanceof NotFoundError) throw new NotFoundError('Email delivery not found');
      throw error;
    }
    const {
      leaseToken: _lease,
      leasedUntil: _until,
      deduplicationKey: _key,
      ...publicDelivery
    } = delivery;
    return publicDelivery;
  },
};

export const alertEmailHistoryRoutes = Router();
alertEmailHistoryRoutes.use(authenticate);
alertEmailHistoryRoutes.get(
  '/:id',
  authorize('notifications:view_status'),
  async (req, res, next) => {
    try {
      if (!req.user) throw new Error('Authenticated user missing from request');
      const id = z.coerce.number().int().positive().safe().parse(req.params.id);
      const data = await alertEmailHistoryService.getById(id, {
        userId: req.user.id,
        scope: getScopeDetails(req, 'notifications:view_status'),
        regionalAccess: req.user.regionalAccess ?? null,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);
