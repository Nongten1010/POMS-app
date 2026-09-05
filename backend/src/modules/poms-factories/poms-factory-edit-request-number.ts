import type { Knex } from 'knex';
import { ConflictError } from '../../shared/errors/AppError';
import { buddhistCalendarYear } from '../../shared/utils/monitoring-point-code';
import type { PomsFactoryEditRequestFormType } from './poms-factories.types';

const PREFIXES: Record<PomsFactoryEditRequestFormType, string> = {
  BASIC_INFO: 'base',
  MEASUREMENT_POINTS: 'point',
};

export async function allocatePomsFactoryEditRequestNo(
  trx: Knex.Transaction,
  formType: PomsFactoryEditRequestFormType,
  date = new Date(),
): Promise<string> {
  const prefix = PREFIXES[formType];
  const year = buddhistCalendarYear(date);

  // Keep the matching key range locked until the request insert commits, including
  // an empty range for the first request. Closed/deleted requests still reserve numbers.
  const row = await trx(trx.raw('?? WITH (UPDLOCK, HOLDLOCK)', ['poms_factory_edit_requests']))
    .where('request_no', 'like', `${prefix}-[0-9][0-9][0-9][0-9][0-9]/${year}`)
    .select(
      trx.raw('MAX(TRY_CONVERT(INT, SUBSTRING(??, ?, 5))) AS ??', [
        'request_no',
        prefix.length + 2,
        'last_sequence',
      ]),
    )
    .first<{ last_sequence: number | string | null }>();

  const sequence = Number(row?.last_sequence ?? 0) + 1;
  if (sequence > 99999) {
    throw new ConflictError('POMS edit request sequence is exhausted for this form type and year');
  }
  return `${prefix}-${String(sequence).padStart(5, '0')}/${year}`;
}
