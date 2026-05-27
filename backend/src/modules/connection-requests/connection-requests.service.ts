import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { connectionRequestsRepository } from './connection-requests.repository';
import {
  CONNECTION_REQUEST_STATUS,
  type ConfirmConnectionInput,
  type ConnectionRequestDTO,
  type ConnectionRequestStatus,
  type CreateConnectionRequestInput,
  type ListConnectionRequestsQuery,
  type PaginatedConnectionRequestsDTO,
  type ResubmitConnectionRequestInput,
  type ReviewConnectionRequestInput,
  type VerifyConnectionInput,
} from './connection-requests.types';

const DESIGN_REVIEW_STATUSES: ConnectionRequestStatus[] = [
  CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
  CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
];

let nowProvider = () => new Date();

export const connectionRequestsService = {
  setClockForTests(provider: () => Date): void {
    nowProvider = provider;
  },

  async list(
    query: ListConnectionRequestsQuery,
    actorUserId: number,
    viewScope: string | null | undefined,
  ): Promise<PaginatedConnectionRequestsDTO> {
    const { rows, total } = await connectionRequestsRepository.list(query, {
      actorUserId,
      scope: viewScope,
    });
    return { data: rows, meta: { total } };
  },

  async getById(
    id: number,
    actorUserId: number,
    viewScope: string | null | undefined,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureCanRead(request, actorUserId, viewScope);
    return request;
  },

  create(input: CreateConnectionRequestInput, actorUserId: number): Promise<ConnectionRequestDTO> {
    return connectionRequestsRepository.create(
      input,
      actorUserId,
      CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    );
  },

  async resubmit(
    id: number,
    input: ResubmitConnectionRequestInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureOwner(request, actorUserId);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION]);

    return connectionRequestsRepository.replaceForm(
      id,
      input,
      actorUserId,
      CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
    );
  },

  async review(
    id: number,
    input: ReviewConnectionRequestInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureStatus(request, DESIGN_REVIEW_STATUSES);

    if (input.decision === 'REQUEST_REVISION') {
      return connectionRequestsRepository.updateStatus(
        id,
        CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
        actorUserId,
        {
          officerNote: input.officerNote ?? null,
          revisionReason: input.revisionReason,
        },
      );
    }

    return connectionRequestsRepository.updateStatus(
      id,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      actorUserId,
      {
        officerNote: input.officerNote ?? null,
        revisionReason: null,
        connectionDueAt: addDays(nowProvider(), 30).toISOString(),
      },
    );
  },

  async confirmConnection(
    id: number,
    input: ConfirmConnectionInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureOwner(request, actorUserId);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.WAITING_CONNECTION]);

    if (!request.connectionDueAt) {
      throw new BadRequestError('Connection due date is not set');
    }

    const confirmedAt = input.confirmedAt ?? nowProvider().toISOString();
    if (new Date(confirmedAt).getTime() > new Date(request.connectionDueAt).getTime()) {
      throw new BadRequestError('Connection confirmation must be submitted within 30 days');
    }

    return connectionRequestsRepository.updateStatus(
      id,
      CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED,
      actorUserId,
      {
        confirmedAt,
        officerNote: input.note ?? null,
      },
    );
  },

  async verifyConnection(
    id: number,
    input: VerifyConnectionInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED]);

    return connectionRequestsRepository.updateStatus(
      id,
      CONNECTION_REQUEST_STATUS.CONNECTED,
      actorUserId,
      {
        verifiedAt: input.verifiedAt ?? nowProvider().toISOString(),
        officerNote: input.note ?? null,
      },
    );
  },
};

async function loadRequest(id: number): Promise<ConnectionRequestDTO> {
  const request = await connectionRequestsRepository.findById(id);
  if (!request) throw new NotFoundError('Connection request not found');
  return request;
}

function ensureCanRead(
  request: ConnectionRequestDTO,
  actorUserId: number,
  viewScope: string | null | undefined,
): void {
  if (viewScope === 'ALL') return;
  if (request.createdBy === actorUserId) return;
  throw new ForbiddenError('Cannot access another operator connection request');
}

function ensureOwner(request: ConnectionRequestDTO, actorUserId: number): void {
  if (request.createdBy !== actorUserId) {
    throw new ForbiddenError('Only the request owner can perform this action');
  }
}

function ensureStatus(
  request: ConnectionRequestDTO,
  allowedStatuses: ConnectionRequestStatus[],
): void {
  if (!allowedStatuses.includes(request.status)) {
    throw new BadRequestError('Invalid connection request status for this action', {
      currentStatus: request.status,
      allowedStatuses,
    });
  }
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
