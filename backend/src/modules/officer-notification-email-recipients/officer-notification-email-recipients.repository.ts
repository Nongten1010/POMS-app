import { db } from '../../config/database';
import { BadRequestError } from '../../shared/errors/AppError';
import type {
  CreateOfficerNotificationEmailRecipientInput,
  OfficerNotificationEmailRecipientDTO,
  OfficerNotificationRecipientType,
} from './officer-notification-email-recipients.types';

interface OfficerNotificationEmailRecipientRow {
  id: number | string;
  recipient_type: OfficerNotificationRecipientType;
  province_name: string | null;
  emails_json: string;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export const officerNotificationEmailRecipientsRepository = {
  async list(): Promise<OfficerNotificationEmailRecipientDTO[]> {
    const rows = await db<OfficerNotificationEmailRecipientRow>(
      'officer_notification_email_recipients',
    )
      .whereNull('deleted_at')
      .select(
        'id',
        'recipient_type',
        'province_name',
        'emails_json',
        'is_active',
        'created_at',
        'updated_at',
      )
      .orderBy('recipient_type', 'asc')
      .orderBy('province_name', 'asc')
      .orderBy('id', 'asc');
    return rows.map(toDto);
  },

  async create(
    input: CreateOfficerNotificationEmailRecipientInput,
    actorUserId: number,
  ): Promise<OfficerNotificationEmailRecipientDTO> {
    const [{ id }] = await db('officer_notification_email_recipients')
      .insert({
        recipient_type: input.recipientType,
        province_name: input.provinceName ?? null,
        emails_json: JSON.stringify(input.emails),
        is_active: true,
        created_by: actorUserId,
        updated_by: actorUserId,
      })
      .returning('id');

    const created = await db<OfficerNotificationEmailRecipientRow>(
      'officer_notification_email_recipients',
    )
      .where('id', id)
      .first();
    if (!created)
      throw new Error('Created officer notification email recipient could not be loaded');
    return toDto(created);
  },

  async addEmail(
    id: number,
    email: string,
    actorUserId: number,
  ): Promise<OfficerNotificationEmailRecipientDTO | null> {
    return db.transaction(async (trx) => {
      const current = await trx<OfficerNotificationEmailRecipientRow>(
        'officer_notification_email_recipients',
      )
        .where('id', id)
        .whereNull('deleted_at')
        .forUpdate()
        .first();
      if (!current) return null;

      const currentEmails = parseEmails(current.emails_json);
      const emails = normalizeEmails([...currentEmails, email]);
      if (emails.length === currentEmails.length) return toDto(current);
      if (emails.length > 20) {
        throw new BadRequestError('A recipient can have at most 20 email addresses', {
          field: 'email',
          max: 20,
        });
      }

      await trx('officer_notification_email_recipients')
        .where('id', id)
        .update({
          emails_json: JSON.stringify(emails),
          updated_at: trx.fn.now(),
          updated_by: actorUserId,
        });

      const updated = await trx<OfficerNotificationEmailRecipientRow>(
        'officer_notification_email_recipients',
      )
        .where('id', id)
        .first();
      if (!updated)
        throw new Error('Updated officer notification email recipient could not be loaded');
      return toDto(updated);
    });
  },
};

function toDto(row: OfficerNotificationEmailRecipientRow): OfficerNotificationEmailRecipientDTO {
  return {
    id: Number(row.id),
    recipientType: row.recipient_type,
    provinceName: row.province_name,
    emails: parseEmails(row.emails_json),
    isActive: row.is_active,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function parseEmails(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
  } catch {
    return [];
  }
}

function normalizeEmails(emails: string[]): string[] {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
