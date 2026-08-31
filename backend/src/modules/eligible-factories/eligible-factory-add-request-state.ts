import { ConflictError, ForbiddenError } from '../../shared/errors/AppError';
import type { EligibleFactoryAddRequestDTO } from './eligible-factories.types';

export function assertEligibleFactoryAddRequestReviewable(
  request: Pick<EligibleFactoryAddRequestDTO, 'submittedBy' | 'status'>,
  isOpen: boolean,
  actorUserId: number,
): void {
  if (request.submittedBy === actorUserId) {
    throw new ForbiddenError('Submitter cannot review their own eligible factory add request');
  }
  if (request.status !== 'PENDING_REVIEW' || !isOpen) {
    throw new ConflictError('Eligible factory add request is not pending review', {
      currentStatus: request.status,
    });
  }
}
