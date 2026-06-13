import { NotFoundError } from '../../shared/errors/AppError';
import { alertEventsRepository } from './alert-events.repository';
import type {
  AlertEventDTO,
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

    const event = await alertEventsRepository.createFromIntegration(input);
    return {
      created: true,
      duplicate: false,
      event,
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
