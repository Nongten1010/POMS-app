import { ConflictError, NotFoundError } from '../../shared/errors/AppError';
import { officerNotificationEmailRecipientsRepository } from './officer-notification-email-recipients.repository';
import type {
  CreateOfficerNotificationEmailRecipientInput,
  OfficerNotificationEmailRecipientDTO,
} from './officer-notification-email-recipients.types';

export const officerNotificationEmailRecipientsService = {
  async list(): Promise<OfficerNotificationEmailRecipientDTO[]> {
    return officerNotificationEmailRecipientsRepository.list();
  },

  async create(
    input: CreateOfficerNotificationEmailRecipientInput,
    actorUserId: number,
  ): Promise<OfficerNotificationEmailRecipientDTO> {
    try {
      return await officerNotificationEmailRecipientsRepository.create(input, actorUserId);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(
          'Officer notification email recipient already exists; add an email to the existing recipient instead',
        );
      }
      throw error;
    }
  },

  async addEmail(
    id: number,
    email: string,
    actorUserId: number,
  ): Promise<OfficerNotificationEmailRecipientDTO> {
    const updated = await officerNotificationEmailRecipientsRepository.addEmail(
      id,
      email,
      actorUserId,
    );
    if (!updated) throw new NotFoundError('Officer notification email recipient not found');
    return updated;
  },
};

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const number = (error as { number?: unknown }).number;
  return number === 2601 || number === 2627;
}
