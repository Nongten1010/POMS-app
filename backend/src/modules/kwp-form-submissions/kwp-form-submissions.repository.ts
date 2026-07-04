import type { Knex } from 'knex';
import { ForbiddenError } from '../../shared/errors/AppError';
import { db } from '../../config/database';
import type {
  CreatedKwpFormSubmissionDTO,
  CreateKwp01SubmissionDTO,
  KwpFormSubmissionAccess,
} from './kwp-form-submissions.types';

interface Kwp01InsertInput {
  payload: CreateKwp01SubmissionDTO;
  submissionNo: string;
  actorUserId: number;
  now: Date;
}

interface Kwp01InsertRecords {
  submission: Record<string, unknown>;
  issueReport: Record<string, unknown>;
  unreportedParameters: Array<Record<string, unknown>>;
  statusHistory: Record<string, unknown>;
}

export const kwpFormSubmissionsRepository = {
  async createKwp01(
    payload: CreateKwp01SubmissionDTO,
    access: KwpFormSubmissionAccess,
  ): Promise<CreatedKwpFormSubmissionDTO> {
    return db.transaction(async (trx) => {
      await assertCanCreateForFactory(trx, payload.factoryId, access);

      const now = new Date();
      const submissionNo = await nextSubmissionNo(trx, now);
      const records = toKwp01InsertRecords({
        payload,
        submissionNo,
        actorUserId: access.actorUserId,
        now,
      });

      const inserted = await trx('kwp_form_submissions')
        .insert(records.submission)
        .returning<{ id: number | string }[]>('id');
      const submissionId = Number(inserted[0]?.id);

      await trx('kwp01_issue_reports').insert({
        ...records.issueReport,
        submission_id: submissionId,
      });

      if (records.unreportedParameters.length > 0) {
        await trx('kwp01_unreported_parameters').insert(
          records.unreportedParameters.map((parameter) => ({
            ...parameter,
            submission_id: submissionId,
          })),
        );
      }

      await trx('kwp_form_status_history').insert({
        ...records.statusHistory,
        submission_id: submissionId,
      });

      return {
        id: submissionId,
        requestNo: submissionNo,
        form: 'กวภ.01',
        formType: 'KWP01',
        status: 'SUBMITTED',
        submittedAt: now.toISOString(),
      };
    });
  },
};

export function buildKwpFormSubmissionFactoryAccessQueryForTests(
  factoryId: string,
  access: KwpFormSubmissionAccess,
): Knex.QueryBuilder {
  return buildFactoryAccessQuery(db, factoryId, access);
}

export function toKwp01InsertRecordsForTests(input: Kwp01InsertInput): Kwp01InsertRecords {
  return toKwp01InsertRecords(input);
}

async function assertCanCreateForFactory(
  trx: Knex.Transaction,
  factoryId: string,
  access: KwpFormSubmissionAccess,
): Promise<void> {
  if (access.scope !== 'OWN_FACTORY') return;

  const row = await buildFactoryAccessQuery(trx, factoryId, access).first();
  if (!row) {
    throw new ForbiddenError('User cannot submit KWP form for this factory');
  }
}

function buildFactoryAccessQuery(
  knexOrTrx: Knex | Knex.Transaction,
  factoryId: string,
  access: KwpFormSubmissionAccess,
): Knex.QueryBuilder {
  const builder = knexOrTrx('factories as f')
    .whereNull('f.deleted_at')
    .where((factoryBuilder) => {
      factoryBuilder.where('f.fid', factoryId).orWhere('f.code', factoryId);
    })
    .select('f.id');

  if (access.scope === 'OWN_FACTORY') {
    builder
      .join('user_juristics as uj', 'uj.juristic_id', 'f.juristic_id')
      .where('uj.user_id', access.actorUserId)
      .whereNull('uj.revoked_at');
  }

  return builder;
}

async function nextSubmissionNo(trx: Knex.Transaction, now: Date): Promise<string> {
  const buddhistYearSuffix = String(now.getFullYear() + 543).slice(-2);
  const prefix = `KWP-${buddhistYearSuffix}-`;
  const latest = await trx('kwp_form_submissions')
    .where('submission_no', 'like', `${prefix}%`)
    .orderBy('submission_no', 'desc')
    .first<{ submission_no: string }>('submission_no');
  const nextSequence = Number(latest?.submission_no.slice(prefix.length) ?? '0') + 1;
  return `${prefix}${String(nextSequence).padStart(5, '0')}`;
}

function toKwp01InsertRecords(input: Kwp01InsertInput): Kwp01InsertRecords {
  const { payload, submissionNo, actorUserId, now } = input;
  const submission = {
    submission_no: submissionNo,
    form_type: 'KWP01',
    status: 'SUBMITTED',
    factory_id: payload.factoryId,
    factory_name: payload.factoryName,
    factory_registration_no: payload.factoryRegistrationNo ?? null,
    factory_address: payload.factoryAddress ?? null,
    industry_type: payload.industryType ?? null,
    connected_point_id: payload.connectedPointId ?? null,
    point_code: payload.pointCode ?? null,
    point_name: payload.pointName ?? null,
    point_type: payload.pointType ?? null,
    production_stack: payload.productionStack ?? null,
    primary_fuel: payload.primaryFuel ?? null,
    secondary_fuel: payload.secondaryFuel ?? null,
    combustion_system: payload.combustionSystem ?? null,
    production_capacity: payload.productionCapacity ?? null,
    production_capacity_unit: payload.productionCapacityUnit ?? null,
    contact_name: payload.contactName ?? null,
    contact_phone: payload.contactPhone ?? null,
    contact_email: payload.contactEmail ?? null,
    reporter_name: payload.reporterName ?? null,
    reporter_position: payload.reporterPosition ?? null,
    submitted_at: now,
    created_at: now,
    updated_at: now,
    created_by: actorUserId,
    updated_by: actorUserId,
  };

  return {
    submission,
    issueReport: {
      issue_reason: payload.issueReason,
      reason_detail: payload.reasonDetail ?? null,
      problem_date: payload.problemDate ?? null,
      expected_done_date: payload.expectedDoneDate ?? null,
      total_days: payload.totalDays ?? null,
      corrective_action: payload.correctiveAction ?? null,
    },
    unreportedParameters: payload.unreportedParameters.map((parameterName, index) => ({
      parameter_name: parameterName,
      sort_order: index + 1,
    })),
    statusHistory: {
      status: 'SUBMITTED',
      note: null,
      changed_by: actorUserId,
      changed_at: now,
    },
  };
}
