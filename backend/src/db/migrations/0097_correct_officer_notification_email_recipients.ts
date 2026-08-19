import type { Knex } from 'knex';

const TABLE_NAME = 'officer_notification_email_recipients';

export const BANGKOK_PROVINCE_NAME = 'กรุงเทพมหานคร';
export const BANGKOK_NOTIFICATION_EMAILS = ['SARABAN@DIW.MAIL.GO.TH'];
export const INDUSTRIAL_ESTATE_NOTIFICATION_EMAILS = ['warroom.emcc@ieat.go.th'];
export const STALE_NOTIFICATION_EMAIL = 'second@example.com';

interface RecipientRow {
  id: number | string;
  recipient_type: 'PROVINCE' | 'INDUSTRIAL_ESTATE';
  province_name: string | null;
  emails_json: string;
  is_active: boolean;
}

interface ConnectionRequestRecipientRow {
  id: number | string;
  officer_notification_emails_json: string | null;
  province_name: string | null;
  industrial_estate_name: string | null;
}

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const rows = await trx<RecipientRow>(TABLE_NAME)
      .whereNull('deleted_at')
      .select('id', 'recipient_type', 'province_name', 'emails_json', 'is_active');

    let hasIndustrialEstateRecipient = false;
    let hasBangkokRecipient = false;

    for (const row of rows) {
      const isIndustrialEstate = row.recipient_type === 'INDUSTRIAL_ESTATE';
      const isBangkok =
        row.recipient_type === 'PROVINCE' && row.province_name === BANGKOK_PROVINCE_NAME;

      if (isIndustrialEstate) hasIndustrialEstateRecipient = true;
      if (isBangkok) hasBangkokRecipient = true;

      const currentEmails = parseEmailList(row.emails_json);
      const correctedEmails = correctedEmailsForRecipient(row, currentEmails);
      const correctedIsActive = isIndustrialEstate || isBangkok ? true : row.is_active;
      if (sameEmailList(currentEmails, correctedEmails) && row.is_active === correctedIsActive) {
        continue;
      }

      await trx(TABLE_NAME)
        .where('id', row.id)
        .update({
          emails_json: JSON.stringify(correctedEmails),
          is_active: correctedIsActive,
          updated_at: trx.fn.now(),
        });
    }

    if (!hasIndustrialEstateRecipient) {
      await trx(TABLE_NAME).insert({
        recipient_type: 'INDUSTRIAL_ESTATE',
        province_name: null,
        emails_json: JSON.stringify(INDUSTRIAL_ESTATE_NOTIFICATION_EMAILS),
        is_active: true,
        created_by: null,
        updated_by: null,
      });
    }

    if (!hasBangkokRecipient) {
      await trx(TABLE_NAME).insert({
        recipient_type: 'PROVINCE',
        province_name: BANGKOK_PROVINCE_NAME,
        emails_json: JSON.stringify(BANGKOK_NOTIFICATION_EMAILS),
        is_active: true,
        created_by: null,
        updated_by: null,
      });
    }

    const requestRows = await trx<ConnectionRequestRecipientRow>(
      'cems_wpms_connection_requests as request',
    )
      .leftJoin('cems_wpms_request_factory_snapshots as snapshot', function joinSnapshot() {
        this.on('snapshot.request_id', '=', 'request.id').andOnNull('snapshot.deleted_at');
      })
      .whereNull('request.deleted_at')
      .select(
        'request.id',
        'request.officer_notification_emails_json',
        'snapshot.province_name',
        'snapshot.industrial_estate_name',
      );

    for (const request of requestRows) {
      const currentEmails = parseEmailList(request.officer_notification_emails_json);
      const correctedEmails = correctedEmailsForRecipient(
        {
          recipient_type: request.industrial_estate_name ? 'INDUSTRIAL_ESTATE' : 'PROVINCE',
          province_name: request.province_name,
        },
        currentEmails,
      );
      if (sameEmailList(currentEmails, correctedEmails)) continue;

      await trx('cems_wpms_connection_requests')
        .where('id', request.id)
        .update({
          officer_notification_emails_json: JSON.stringify(correctedEmails),
          updated_at: trx.fn.now(),
        });
    }
  });
}

// This data repair is intentionally irreversible: rollback must not restore obsolete or test
// recipients that could receive notification email.
export async function down(_knex: Knex): Promise<void> {
  // One-way data repair: obsolete and test recipients must remain removed.
}

export function correctedEmailsForRecipient(
  recipient: Pick<RecipientRow, 'recipient_type' | 'province_name'>,
  currentEmails: string[],
): string[] {
  if (recipient.recipient_type === 'INDUSTRIAL_ESTATE') {
    return [...INDUSTRIAL_ESTATE_NOTIFICATION_EMAILS];
  }

  if (recipient.province_name === BANGKOK_PROVINCE_NAME) {
    return [...BANGKOK_NOTIFICATION_EMAILS];
  }

  return currentEmails.filter((email) => email.trim().toLowerCase() !== STALE_NOTIFICATION_EMAIL);
}

function parseEmailList(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((email): email is string => typeof email === 'string' && email.length > 0)
      : [];
  } catch {
    return [];
  }
}

function sameEmailList(first: string[], second: string[]): boolean {
  return (
    first.length === second.length &&
    first.every((email, index) => email.trim().toLowerCase() === second[index]?.toLowerCase())
  );
}
