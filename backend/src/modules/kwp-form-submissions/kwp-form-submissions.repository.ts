import type { Knex } from 'knex';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { db } from '../../config/database';
import { buildPublicFileUrl } from './kwp-form-attachments.service';
import type {
  CreatedKwpFormSubmissionDTO,
  CreateKwp01SubmissionDTO,
  CreateKwp02SubmissionDTO,
  CreateKwp04SubmissionDTO,
  KwpEmissionMeasurementItemDTO,
  Kwp01IssueReason,
  KwpFormAttachmentDTO,
  KwpFormSubmissionDetailType,
  KwpFormSubmissionDetailDTO,
  KwpFormSubmissionAccess,
  KwpFormSubmissionReadAccess,
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

interface Kwp02InsertInput {
  payload: CreateKwp02SubmissionDTO | CreateKwp04SubmissionDTO;
  submissionNo: string;
  actorUserId: number;
  now: Date;
  formType?: 'KWP02' | 'KWP04';
}

interface Kwp02InsertRecords {
  submission: Record<string, unknown>;
  measurementItems: Array<Record<string, unknown>>;
  attachmentsByItemIndex: Map<number, Array<Record<string, unknown>>>;
  statusHistory: Record<string, unknown>;
}

interface SubmissionDetailRow {
  id: number | string;
  submission_no: string;
  form_type: KwpFormSubmissionDetailType;
  status: string;
  factory_id: string | null;
  factory_name: string;
  factory_registration_no: string | null;
  factory_address: string | null;
  industry_type: string | null;
  connected_point_id: number | string | null;
  point_code: string | null;
  point_name: string | null;
  point_type: string | null;
  production_stack: string | null;
  primary_fuel: string | null;
  secondary_fuel: string | null;
  combustion_system: string | null;
  production_capacity: string | null;
  production_capacity_unit: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  reporter_name: string | null;
  reporter_position: string | null;
  submitted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface Kwp01IssueReportRow {
  issue_reason: string;
  reason_detail: string | null;
  problem_date: Date | string | null;
  expected_done_date: Date | string | null;
  total_days: number | string | null;
  corrective_action: string | null;
}

interface Kwp01UnreportedParameterRow {
  parameter_name: string;
}

interface KwpEmissionMeasurementItemRow {
  id: number | string;
  pollutant: string;
  sample_date: Date | string | null;
  measured_value: number | string | null;
  measured_value_text: string | null;
  unit: string | null;
  laboratory_no: string | null;
  report_no: string | null;
  method: string | null;
}

interface KwpAttachmentRow {
  id: number | string;
  related_id: number | string | null;
  attachment_type: string;
  original_file_name: string;
  stored_file_name: string | null;
  mime_type: string | null;
  file_size: number | string | null;
  storage_path: string | null;
  uploaded_at: Date | string;
  uploaded_by: number | string | null;
}

export const kwpFormSubmissionsRepository = {
  async getById(
    id: number,
    access: KwpFormSubmissionReadAccess,
  ): Promise<KwpFormSubmissionDetailDTO> {
    const submission = await buildSubmissionDetailQuery(id, access).first();
    if (!submission) {
      throw new NotFoundError('KWP form submission not found');
    }

    const baseDetail = toSubmissionDetailDTO(submission);
    if (submission.form_type === 'KWP01') {
      return {
        ...baseDetail,
        issueReport: await getKwp01IssueReport(Number(submission.id)),
      };
    }

    return {
      ...baseDetail,
      measurementItems: await listEmissionMeasurementItems(Number(submission.id), access),
    };
  },

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

  async createKwp02(
    payload: CreateKwp02SubmissionDTO,
    access: KwpFormSubmissionAccess,
  ): Promise<CreatedKwpFormSubmissionDTO> {
    return createKwpEmissionReport(payload, access, 'KWP02');
  },

  async createKwp04(
    payload: CreateKwp04SubmissionDTO,
    access: KwpFormSubmissionAccess,
  ): Promise<CreatedKwpFormSubmissionDTO> {
    return createKwpEmissionReport(payload, access, 'KWP04');
  },
};

async function createKwpEmissionReport(
  payload: CreateKwp02SubmissionDTO | CreateKwp04SubmissionDTO,
  access: KwpFormSubmissionAccess,
  formType: 'KWP02' | 'KWP04',
): Promise<CreatedKwpFormSubmissionDTO> {
  return db.transaction(async (trx) => {
    await assertCanCreateForFactory(trx, payload.factoryId, access);

    const now = new Date();
    const submissionNo = await nextSubmissionNo(trx, now);
    const records = toKwp02InsertRecords({
      payload,
      submissionNo,
      actorUserId: access.actorUserId,
      now,
      formType,
    });

    const inserted = await trx('kwp_form_submissions')
      .insert(records.submission)
      .returning<{ id: number | string }[]>('id');
    const submissionId = Number(inserted[0]?.id);

    let attachmentCount = 0;
    for (const [itemIndex, item] of records.measurementItems.entries()) {
      const insertedItem = await trx('kwp_emission_measurement_items')
        .insert({
          ...item,
          submission_id: submissionId,
        })
        .returning<{ id: number | string }[]>('id');
      const itemId = Number(insertedItem[0]?.id);
      const attachments = records.attachmentsByItemIndex.get(itemIndex) ?? [];

      if (attachments.length > 0) {
        await trx('kwp_form_attachments').insert(
          attachments.map((attachment) => ({
            ...attachment,
            submission_id: submissionId,
            related_table: 'kwp_emission_measurement_items',
            related_id: itemId,
          })),
        );
        attachmentCount += attachments.length;
      }
    }

    await trx('kwp_form_status_history').insert({
      ...records.statusHistory,
      submission_id: submissionId,
    });

    return {
      id: submissionId,
      requestNo: submissionNo,
      form: formType === 'KWP04' ? 'กวภ.04' : 'กวภ.02',
      formType,
      status: 'SUBMITTED',
      submittedAt: now.toISOString(),
      measurementItemCount: records.measurementItems.length,
      attachmentCount,
    };
  });
}

export function buildKwpFormSubmissionFactoryAccessQueryForTests(
  factoryId: string,
  access: KwpFormSubmissionAccess,
): Knex.QueryBuilder {
  return buildFactoryAccessQuery(db, factoryId, access);
}

export function buildKwpFormSubmissionDetailQueryForTests(
  id: number,
  access: KwpFormSubmissionReadAccess,
): Knex.QueryBuilder {
  return buildSubmissionDetailQuery(id, access);
}

export function toKwp01InsertRecordsForTests(input: Kwp01InsertInput): Kwp01InsertRecords {
  return toKwp01InsertRecords(input);
}

export function toKwp02InsertRecordsForTests(input: Kwp02InsertInput): Kwp02InsertRecords {
  return toKwp02InsertRecords(input);
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

function buildSubmissionDetailQuery(
  id: number,
  access: KwpFormSubmissionReadAccess,
): Knex.QueryBuilder<SubmissionDetailRow, SubmissionDetailRow[]> {
  const builder = db<SubmissionDetailRow>('kwp_form_submissions as s')
    .leftJoin('factories as f', function joinFactory() {
      this.on('f.fid', '=', 's.factory_id')
        .orOn('f.code', '=', 's.factory_id')
        .orOn('f.code', '=', 's.factory_registration_no');
    })
    .leftJoin('provinces as p', 'p.id', 'f.province_id')
    .where('s.id', id)
    .whereNull('s.deleted_at')
    .where('s.form_type', access.formType)
    .select(
      's.id',
      's.submission_no',
      's.form_type',
      's.status',
      's.factory_id',
      's.factory_name',
      's.factory_registration_no',
      's.factory_address',
      's.industry_type',
      's.connected_point_id',
      's.point_code',
      's.point_name',
      's.point_type',
      's.production_stack',
      's.primary_fuel',
      's.secondary_fuel',
      's.combustion_system',
      's.production_capacity',
      's.production_capacity_unit',
      's.contact_name',
      's.contact_phone',
      's.contact_email',
      's.reporter_name',
      's.reporter_position',
      's.submitted_at',
      's.created_at',
      's.updated_at',
    );

  applySubmissionReadAccessFilter(builder, access);

  return builder as unknown as Knex.QueryBuilder<SubmissionDetailRow, SubmissionDetailRow[]>;
}

function applySubmissionReadAccessFilter(
  builder: Knex.QueryBuilder,
  access: KwpFormSubmissionReadAccess,
): void {
  if (access.scope === 'OWN_FACTORY') {
    builder
      .join('user_juristics as uj', 'uj.juristic_id', 'f.juristic_id')
      .where('uj.user_id', access.actorUserId)
      .whereNull('uj.revoked_at');
  }

  const regions = [
    ...new Set((access.regionalAccess?.regions ?? []).map((region) => region.trim())),
  ].filter(Boolean);
  if (regions.length > 0) builder.whereIn('p.region', regions);
}

async function getKwp01IssueReport(submissionId: number) {
  const issueReport = await db<Kwp01IssueReportRow>('kwp01_issue_reports')
    .where('submission_id', submissionId)
    .first(
      'issue_reason',
      'reason_detail',
      'problem_date',
      'expected_done_date',
      'total_days',
      'corrective_action',
    );

  const parameterRows = await db<Kwp01UnreportedParameterRow>('kwp01_unreported_parameters')
    .where('submission_id', submissionId)
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc')
    .select('parameter_name');

  if (!issueReport) {
    return {
      issueReason: 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง' as const,
      reasonDetail: null,
      problemDate: null,
      expectedDoneDate: null,
      totalDays: null,
      correctiveAction: null,
      unreportedParameters: parameterRows.map((row) => row.parameter_name),
    };
  }

  const issueReason: Kwp01IssueReason =
    issueReport.issue_reason === 'หยุดหน่วยการผลิต'
      ? 'หยุดหน่วยการผลิต'
      : 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง';

  return {
    issueReason,
    reasonDetail: issueReport.reason_detail,
    problemDate: toDateOnly(issueReport.problem_date),
    expectedDoneDate: toDateOnly(issueReport.expected_done_date),
    totalDays: issueReport.total_days === null ? null : Number(issueReport.total_days),
    correctiveAction: issueReport.corrective_action,
    unreportedParameters: parameterRows.map((row) => row.parameter_name),
  };
}

async function listEmissionMeasurementItems(
  submissionId: number,
  access: KwpFormSubmissionReadAccess,
): Promise<KwpEmissionMeasurementItemDTO[]> {
  const itemRows = await db<KwpEmissionMeasurementItemRow>('kwp_emission_measurement_items')
    .where('submission_id', submissionId)
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc')
    .select(
      'id',
      'pollutant',
      'sample_date',
      'measured_value',
      'measured_value_text',
      'unit',
      'laboratory_no',
      'report_no',
      'method',
    );
  const attachmentsByItemId = await listAttachmentsByItemId(
    submissionId,
    itemRows.map((row) => Number(row.id)),
    access,
  );

  return itemRows.map((row) => ({
    id: Number(row.id),
    pollutant: row.pollutant,
    sampleDate: toDateOnly(row.sample_date),
    measuredValue: row.measured_value_text,
    numericValue: row.measured_value === null ? null : Number(row.measured_value),
    unit: row.unit,
    laboratoryNo: row.laboratory_no,
    reportNo: row.report_no,
    method: row.method,
    attachments: attachmentsByItemId.get(Number(row.id)) ?? [],
  }));
}

async function listAttachmentsByItemId(
  submissionId: number,
  itemIds: number[],
  access: KwpFormSubmissionReadAccess,
): Promise<Map<number, KwpFormAttachmentDTO[]>> {
  if (itemIds.length === 0) return new Map();

  const rows = await db<KwpAttachmentRow>('kwp_form_attachments')
    .where('submission_id', submissionId)
    .where('related_table', 'kwp_emission_measurement_items')
    .whereIn('related_id', itemIds)
    .orderBy('attachment_type', 'asc')
    .orderBy('id', 'asc')
    .select(
      'id',
      'related_id',
      'attachment_type',
      'original_file_name',
      'stored_file_name',
      'mime_type',
      'file_size',
      'storage_path',
      'uploaded_at',
      'uploaded_by',
    );

  return rows.reduce((map, row) => {
    const itemId = Number(row.related_id);
    const current = map.get(itemId) ?? [];
    map.set(itemId, [...current, toAttachmentDTO(row, access)]);
    return map;
  }, new Map<number, KwpFormAttachmentDTO[]>());
}

function toSubmissionDetailDTO(row: SubmissionDetailRow): KwpFormSubmissionDetailDTO {
  return {
    id: Number(row.id),
    requestNo: row.submission_no,
    form: row.form_type === 'KWP04' ? 'กวภ.04' : row.form_type === 'KWP02' ? 'กวภ.02' : 'กวภ.01',
    formType: row.form_type,
    status: row.status,
    submittedAt: toIsoString(row.submitted_at),
    createdAt: toIsoString(row.created_at) ?? String(row.created_at),
    updatedAt: toIsoString(row.updated_at) ?? String(row.updated_at),
    factoryId: row.factory_id,
    factoryName: row.factory_name,
    factoryRegistrationNo: row.factory_registration_no,
    factoryAddress: row.factory_address,
    industryType: row.industry_type,
    connectedPointId: row.connected_point_id === null ? null : Number(row.connected_point_id),
    pointCode: row.point_code,
    pointName: row.point_name,
    pointType: row.point_type,
    productionStack: row.production_stack,
    primaryFuel: row.primary_fuel,
    secondaryFuel: row.secondary_fuel,
    combustionSystem: row.combustion_system,
    productionCapacity: row.production_capacity,
    productionCapacityUnit: row.production_capacity_unit,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    reporterName: row.reporter_name,
    reporterPosition: row.reporter_position,
  };
}

function toAttachmentDTO(
  row: KwpAttachmentRow,
  access: KwpFormSubmissionReadAccess,
): KwpFormAttachmentDTO {
  return {
    id: Number(row.id),
    attachmentType: row.attachment_type,
    originalFileName: row.original_file_name,
    storedFileName: row.stored_file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size === null ? null : Number(row.file_size),
    storagePath: row.storage_path,
    fileUrl: row.storage_path
      ? buildPublicFileUrl(access.publicBaseUrl, access.publicPath, row.storage_path)
      : null,
    uploadedAt: toIsoString(row.uploaded_at) ?? String(row.uploaded_at),
    uploadedBy: row.uploaded_by === null ? null : Number(row.uploaded_by),
  };
}

function toIsoString(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function toDateOnly(value: Date | string | null): string | null {
  if (value === null) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const iso = toIsoString(value);
  return iso ? iso.slice(0, 10) : null;
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
  const submission = toCommonSubmissionRecord(payload, 'KWP01', submissionNo, actorUserId, now);

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

function toKwp02InsertRecords(input: Kwp02InsertInput): Kwp02InsertRecords {
  const { payload, submissionNo, actorUserId, now, formType = 'KWP02' } = input;
  const attachmentsByItemIndex = new Map<number, Array<Record<string, unknown>>>();

  const measurementItems = payload.measurementItems.map((item, index) => {
    const attachments = (item.attachments ?? []).map((attachment) => ({
      attachment_type: attachment.attachmentType,
      original_file_name: attachment.originalFileName,
      stored_file_name: attachment.storedFileName ?? null,
      mime_type: attachment.mimeType ?? null,
      file_size: attachment.fileSize ?? null,
      storage_path: attachment.storagePath ?? null,
      uploaded_at: now,
      uploaded_by: actorUserId,
    }));

    if (attachments.length > 0) {
      attachmentsByItemIndex.set(index, attachments);
    }

    return {
      pollutant: item.pollutant,
      sample_date: item.sampleDate ?? null,
      measured_value: numericMeasurementValue(item.measuredValue),
      measured_value_text: measurementValueText(item.measuredValue),
      unit: item.unit ?? null,
      laboratory_no: item.laboratoryNo ?? null,
      report_no: item.reportNo ?? null,
      method: item.method ?? null,
      sort_order: index + 1,
    };
  });

  return {
    submission: toCommonSubmissionRecord(payload, formType, submissionNo, actorUserId, now),
    measurementItems,
    attachmentsByItemIndex,
    statusHistory: {
      status: 'SUBMITTED',
      note: null,
      changed_by: actorUserId,
      changed_at: now,
    },
  };
}

function toCommonSubmissionRecord(
  payload: CreateKwp01SubmissionDTO | CreateKwp02SubmissionDTO | CreateKwp04SubmissionDTO,
  formType: 'KWP01' | 'KWP02' | 'KWP04',
  submissionNo: string,
  actorUserId: number,
  now: Date,
): Record<string, unknown> {
  return {
    submission_no: submissionNo,
    form_type: formType,
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
}

function numericMeasurementValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function measurementValueText(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}
