import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp } from '../../src/app';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import {
  CONNECTION_REQUEST_STATUS_LABELS,
  type ConnectionRequestDTO,
  type ConnectionRequestStatus,
} from '../../src/modules/connection-requests/connection-requests.types';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: { findById: jest.fn(), cancelOperatorRequest: jest.fn() },
}));

const repository = jest.mocked(connectionRequestsRepository);
const allowedStatuses: ConnectionRequestStatus[] = [
  'PENDING_DESIGN_REVIEW',
  'WAITING_FACTORY_REVISION',
  'REVISED_PENDING_DESIGN_REVIEW',
  'WAITING_CONNECTION',
  'CONNECTION_CONFIRMED',
];
const stateCases: [ConnectionRequestStatus, number][] = [
  ...allowedStatuses.map((status): [ConnectionRequestStatus, number] => [status, 200]),
  ['CONNECTED', 409],
  ['CANCELED', 409],
];

describe('operator cancellation HTTP status rules with the real service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(stateCases)('returns %s cancellation as HTTP %s', async (status, httpStatus) => {
    repository.findById.mockResolvedValue(requestDto(status));
    repository.cancelOperatorRequest.mockResolvedValue(requestDto('CANCELED'));

    const response = await cancel();

    expect(response.status).toBe(httpStatus);
    if (httpStatus === 200) {
      expect(response.body).toMatchObject({
        success: true,
        data: { status: 'CANCELED', statusLabel: 'ยกเลิก' },
      });
      expect(repository.cancelOperatorRequest).toHaveBeenCalledWith(1, 42, null);
    } else {
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'CONFLICT',
          details: { currentStatus: status, allowedStatuses },
        },
      });
      expect(repository.cancelOperatorRequest).not.toHaveBeenCalled();
    }
  });

  it('returns 403 for another owner even when the request is canceled', async () => {
    repository.findById.mockResolvedValue({ ...requestDto('CANCELED'), createdBy: 99 });
    const response = await cancel();
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(repository.cancelOperatorRequest).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing request', async () => {
    repository.findById.mockResolvedValue(null);
    const response = await cancel();
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(repository.cancelOperatorRequest).not.toHaveBeenCalled();
  });
});

function cancel() {
  const token = signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: { 'cems_wpms_requests:edit': 'OWN_FACTORY' },
  });
  return request(createApp())
    .post('/api/v1/cems-wpms-requests/1/cancel')
    .set('Authorization', `Bearer ${token}`)
    .send({});
}

function requestDto(status: ConnectionRequestStatus): ConnectionRequestDTO {
  return {
    id: 1,
    createdBy: 42,
    submissionSource: 'OPERATOR_FORM',
    status,
    statusLabel: CONNECTION_REQUEST_STATUS_LABELS[status],
  } as ConnectionRequestDTO;
}
