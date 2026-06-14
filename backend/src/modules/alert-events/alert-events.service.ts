import { AppError, BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import { alertEventsRepository } from './alert-events.repository';
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

    const event = await alertEventsRepository.createFromIntegration(enrichedInput);
    return {
      created: true,
      duplicate: false,
      event,
    };
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

  async list(query: ListAlertEventsQuery): Promise<ListAlertEventsResult> {
    const result = await alertEventsRepository.list(query);
    return {
      data: result.rows,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
      },
    };
  },

  async getById(id: number): Promise<AlertEventDTO> {
    const event = await alertEventsRepository.findById(id);
    if (!event) throw new NotFoundError('Alert event not found');
    return event;
  },

  async updateStatus(
    id: number,
    input: UpdateAlertEventStatusInput,
    actorUserId: number,
  ): Promise<AlertEventDTO> {
    const event = await alertEventsRepository.updateStatus(id, input, actorUserId);
    if (!event) throw new NotFoundError('Alert event not found');
    return event;
  },
};

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
