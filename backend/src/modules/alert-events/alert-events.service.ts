import { AppError, BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import type { PermissionScopeDetails } from '../auth/permissions';
import type { RegionalAccessDTO } from '../auth/regional-access';
import { alertEventsRepository } from './alert-events.repository';
import {
  buildLegacyAlertEventIdempotencyKey,
  normalizeAlertEventUnit,
} from './alert-event-identity';
import type {
  AlertEventDTO,
  CreateAlertEventBatchItemResult,
  CreateAlertEventBatchResult,
  CreateAlertEventResult,
  CreateIntegrationAlertEventInput,
  ListAlertEventsQuery,
  ListAlertEventsResult,
  UpdateAlertEventStatusInput,
} from './alert-events.types';

export const alertEventsService = {
  async createFromIntegration(
    input: CreateIntegrationAlertEventInput,
  ): Promise<CreateAlertEventResult> {
    const existing = await alertEventsRepository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return {
        created: false,
        duplicate: true,
        event: existing,
      };
    }

    const legacyKey = buildLegacyAlertEventIdempotencyKey(input);
    if (legacyKey !== input.idempotencyKey) {
      const legacyEvent = await alertEventsRepository.findByIdempotencyKey(legacyKey);
      if (
        legacyEvent?.unit &&
        normalizeAlertEventUnit(legacyEvent.unit) === normalizeAlertEventUnit(input.unit)
      ) {
        return { created: false, duplicate: true, event: legacyEvent };
      }
    }

    const connectedPoint = await alertEventsRepository.findConnectedMeasurementPointByStation({
      systemType: input.systemType,
      stationId: input.stationId,
      pointCode: input.pointCode ?? null,
    });
    if (!connectedPoint) {
      throw new BadRequestError(
        'Alert event stationId must match a connected measurement point',
        {
          systemType: input.systemType,
          stationId: input.stationId,
          pointCode: input.pointCode ?? null,
        },
      );
    }

    const enrichedInput = {
      ...input,
      connectedMeasurementPointId: connectedPoint.id,
      factoryId: connectedPoint.factoryId,
      factoryName: connectedPoint.factoryName,
      factoryRegistrationNo: connectedPoint.factoryRegistrationNo,
      pointCode: connectedPoint.pointCode ?? input.pointCode ?? input.stationId,
      pointName: connectedPoint.pointName,
      pointType: connectedPoint.pointType,
    };

    try {
      const event = await alertEventsRepository.createFromIntegration(enrichedInput);
      return { created: true, duplicate: false, event };
    } catch (error) {
      // Another request may have inserted this identity after our initial lookup.
      // Recover only a SQL Server unique constraint failure with the exact same key.
      if (isSqlServerUniqueConstraintViolation(error)) {
        const concurrentEvent = await alertEventsRepository.findByIdempotencyKey(
          input.idempotencyKey,
        );
        if (concurrentEvent) {
          return { created: false, duplicate: true, event: concurrentEvent };
        }
      }
      throw error;
    }
  },

  async createBatchFromIntegration(
    inputs: CreateIntegrationAlertEventInput[],
  ): Promise<CreateAlertEventBatchResult> {
    const results: CreateAlertEventBatchItemResult[] = [];

    for (const [index, input] of inputs.entries()) {
      try {
        const result = await this.createFromIntegration(input);
        results.push({
          index,
          success: true,
          created: result.created,
          duplicate: result.duplicate,
          event: result.event,
        });
      } catch (error) {
        results.push({
          index,
          success: false,
          error: toBatchError(error),
        });
      }
    }

    return {
      total: results.length,
      created: results.filter((result) => result.success && result.created).length,
      duplicate: results.filter((result) => result.success && result.duplicate).length,
      failed: results.filter((result) => !result.success).length,
      results,
    };
  },

  async list(
    query: ListAlertEventsQuery,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
    canViewNotificationStatus = false,
  ): Promise<ListAlertEventsResult> {
    const result = await alertEventsRepository.list(query, {
      actorUserId,
      scope: viewScope,
      regionalAccess,
    });
    return {
      data: result.rows.map((row) => redactNotificationStatus(row, canViewNotificationStatus)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
      },
    };
  },

  async getById(
    id: number,
    actorUserId: number,
    viewScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
    canViewNotificationStatus = false,
  ): Promise<AlertEventDTO> {
    const event = await alertEventsRepository.findById(id, {
      actorUserId,
      scope: viewScope,
      regionalAccess,
    });
    if (!event) throw new NotFoundError('Alert event not found');
    return redactNotificationStatus(event, canViewNotificationStatus);
  },

  async updateStatus(
    id: number,
    input: UpdateAlertEventStatusInput,
    actorUserId: number,
    editScope: AccessScope,
    regionalAccess?: RegionalAccessDTO | null,
  ): Promise<AlertEventDTO> {
    const event = await alertEventsRepository.updateStatus(id, input, actorUserId, {
      actorUserId,
      scope: editScope,
      regionalAccess,
    });
    if (!event) throw new NotFoundError('Alert event not found');
    return event;
  },
};

type AccessScope = string | null | undefined | PermissionScopeDetails;

function isSqlServerUniqueConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as Record<string, unknown>;
  if (value.number === 2601 || value.number === 2627) return true;
  const original = value.originalError;
  if (!original || typeof original !== 'object') return false;
  const originalValue = original as Record<string, unknown>;
  if (originalValue.number === 2601 || originalValue.number === 2627) return true;
  const info = originalValue.info;
  if (!info || typeof info !== 'object') return false;
  const number = (info as Record<string, unknown>).number;
  return number === 2601 || number === 2627;
}

function redactNotificationStatus(
  event: AlertEventDTO,
  canViewNotificationStatus: boolean,
): AlertEventDTO {
  if (canViewNotificationStatus) return event;
  return {
    ...event,
    notificationStatus: null,
    notificationStatusLabel: null,
  };
}

function toBatchError(error: unknown): { code: string; message: string; details?: unknown } {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'Failed to create alert event',
  };
}
