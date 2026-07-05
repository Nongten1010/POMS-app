import type { Knex } from 'knex';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/AppError';
import { db } from '../../config/database';
import { buildPublicFileUrl } from './kwp-form-attachments.service';
import type {
  CreatedKwpFormSubmissionDTO,
  CreateKwp01SubmissionDTO,
  CreateKwp02SubmissionDTO,
  CreateKwp03SubmissionDTO,
  CreateKwp04SubmissionDTO,
  CreateKwp05SubmissionDTO,
  ChangeKwpFormWorkflowStatusDTO,
  KwpEmissionMeasurementItemDTO,
  Kwp03IssueReason,
  Kwp03WpmsIssueReportDTO,
  Kwp05CalibrationItemDTO,
  Kwp05CalibrationReportDTO,
  Kwp01IssueReason,
  KwpFormAttachmentDTO,
  KwpFormSubmissionDetailType,
  KwpFormSubmissionStatus,
  KwpFormSubmissionDetailDTO,
  KwpFormSubmissionAccess,
  KwpFormSubmissionReadAccess,
  KwpFormSubmissionUpdateAccess,
  KwpFormWorkflowAccess,
  KwpFormWorkflowAction,
  KwpFormWorkflowDTO,
  KwpFormWorkflowStepDTO,
  ResubmitKwpFormSubmissionDTO,
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

interface Kwp03InsertInput {
  payload: CreateKwp03SubmissionDTO;
  submissionNo: string;
  actorUserId: number;
  now: Date;
}

interface Kwp03InsertRecords {
  submission: Record<string, unknown>;
  wpmsIssueReport: Record<string, unknown>;
  selectedOptions: Array<Record<string, unknown>>;
  attachments: Array<Record<string, unknown>>;
  statusHistory: Record<string, unknown>;
}

interface Kwp05InsertInput {
  payload: CreateKwp05SubmissionDTO;
  submissionNo: string;
  actorUserId: number;
  now: Date;
}

interface Kwp05InsertRecords {
  submission: Record<string, unknown>;
  calibrationReport: Record<string, unknown>;
  calibrationItems: Array<Record<string, unknown>>;
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

interface SubmissionWorkflowRow {
  id: number | string;
  submission_no: string;
  form_type: KwpFormSubmissionDetailType;
  status: KwpFormSubmissionStatus;
  officer_note: string | null;
  reviewed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  province_region: string | null;
}

interface EditableSubmissionRow {
  id: number | string;
  form_type: KwpFormSubmissionDetailType;
  status: KwpFormSubmissionStatus;
}

interface WorkflowHistoryRow {
  status: KwpFormSubmissionStatus;
  note: string | null;
  changed_at: Date | string;
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

interface Kwp03WpmsIssueReportRow {
  id: number | string;
  wastewater_source: string | null;
  receiving_source: string | null;
  treatment_system_type: string | null;
  discharge_point: string | null;
  average_discharge: number | string | null;
  minimum_discharge: number | string | null;
  maximum_discharge: number | string | null;
  reason_detail: string | null;
  problem_date: Date | string | null;
  expected_done_date: Date | string | null;
  total_days: number | string | null;
  corrective_action: string | null;
}

interface Kwp03SelectedOptionRow {
  option_group: Kwp03OptionGroup;
  option_value: string;
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

type Kwp03OptionGroup = 'INSTRUMENT' | 'MEASUREMENT_TIME' | 'ISSUE_REASON' | 'FAILED_PARAMETER';

interface Kwp05CalibrationReportRow {
  business_activity: string | null;
  sampler_name: string | null;
  officer_registration: string | null;
  laboratory_name: string | null;
  laboratory_registration: string | null;
  cems_brand: string | null;
  cems_detail: string | null;
  report_round: string | null;
  report_year: string | null;
}

interface Kwp05CalibrationItemRow {
  id: number | string;
  parameter_name: string;
  start_date: Date | string | null;
  end_date: Date | string | null;
  result: string | null;
  verifier_company: string | null;
  cems_model: string | null;
  link_qr1: string | null;
  link_qr2: string | null;
}

export const kwpFormSubmissionsRepository = {
  async getWorkflow(id: number, access: KwpFormWorkflowAccess): Promise<KwpFormWorkflowDTO> {
    const submission = await buildWorkflowQuery(id, access).first();
    if (!submission) {
      throw new NotFoundError('KWP form submission not found');
    }

    const historyRows = await listWorkflowHistory(Number(submission.id));
    return toWorkflowDTO(submission, historyRows);
  },

  async changeWorkflowStatus(
    id: number,
    input: ChangeKwpFormWorkflowStatusDTO,
    access: KwpFormWorkflowAccess,
  ): Promise<KwpFormWorkflowDTO> {
    return db.transaction(async (trx) => {
      const submission = await buildWorkflowQuery(id, access, trx).first();
      if (!submission) {
        throw new NotFoundError('KWP form submission not found');
      }

      const nextStatus = nextWorkflowStatus(submission.status, input.action);
      const now = new Date();
      const note = workflowHistoryNote(input);
      await trx('kwp_form_submissions')
        .where('id', id)
        .update({
          status: nextStatus,
          officer_note: workflowOfficerNote(input),
          reviewed_at: input.action === 'START_REVIEW' ? submission.reviewed_at : now,
          reviewed_by: input.action === 'START_REVIEW' ? null : access.actorUserId,
          updated_at: now,
          updated_by: access.actorUserId,
        });
      await trx('kwp_form_status_history').insert({
        submission_id: id,
        status: nextStatus,
        note,
        changed_by: access.actorUserId,
        changed_at: now,
      });

      const updated = await buildWorkflowQuery(id, access, trx).first();
      if (!updated) {
        throw new NotFoundError('KWP form submission not found');
      }
      const historyRows = await listWorkflowHistory(Number(updated.id), trx);
      return toWorkflowDTO(updated, historyRows);
    });
  },

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

    if (submission.form_type === 'KWP03') {
      return {
        ...baseDetail,
        wpmsIssueReport: await getKwp03WpmsIssueReport(Number(submission.id), access),
      };
    }

    if (submission.form_type === 'KWP05') {
      return {
        ...baseDetail,
        calibrationReport: await getKwp05CalibrationReport(Number(submission.id)),
        calibrationItems: await listKwp05CalibrationItems(Number(submission.id), access),
      };
    }

    return {
      ...baseDetail,
      measurementItems: await listEmissionMeasurementItems(Number(submission.id), access),
    };
  },

  async updateKwp01(
    id: number,
    payload: CreateKwp01SubmissionDTO,
    access: KwpFormSubmissionUpdateAccess,
  ): Promise<KwpFormSubmissionDetailDTO> {
    await db.transaction(async (trx) => {
      await assertCanEditReturnedSubmission(id, access, trx);
      const now = new Date();
      const records = toKwp01InsertRecords({
        payload,
        submissionNo: '',
        actorUserId: access.actorUserId,
        now,
      });

      await updateCommonSubmission(id, payload, access, now, trx);
      await trx('kwp01_issue_reports').where('submission_id', id).update(records.issueReport);
      await trx('kwp01_unreported_parameters').where('submission_id', id).delete();
      if (records.unreportedParameters.length > 0) {
        await trx('kwp01_unreported_parameters').insert(
          records.unreportedParameters.map((parameter) => ({
            ...parameter,
            submission_id: id,
          })),
        );
      }
    });
    return getUpdatedSubmissionDetail(id, access);
  },

  async updateKwp02(
    id: number,
    payload: CreateKwp02SubmissionDTO,
    access: KwpFormSubmissionUpdateAccess,
  ): Promise<KwpFormSubmissionDetailDTO> {
    return updateKwpEmissionReport(id, payload, access);
  },

  async updateKwp03(
    id: number,
    payload: CreateKwp03SubmissionDTO,
    access: KwpFormSubmissionUpdateAccess,
  ): Promise<KwpFormSubmissionDetailDTO> {
    await db.transaction(async (trx) => {
      await assertCanEditReturnedSubmission(id, access, trx);
      const now = new Date();
      const records = toKwp03InsertRecords({
        payload,
        submissionNo: '',
        actorUserId: access.actorUserId,
        now,
      });

      await updateCommonSubmission(id, payload, access, now, trx);
      await trx('kwp_form_attachments').where('submission_id', id).delete();
      await trx('kwp03_selected_options').where('submission_id', id).delete();
      await trx('kwp03_wpms_issue_reports')
        .where('submission_id', id)
        .update(records.wpmsIssueReport);

      const issueReport = await trx('kwp03_wpms_issue_reports')
        .where('submission_id', id)
        .first<{ id: number | string }>('id');
      const issueReportId = Number(issueReport?.id);

      if (records.selectedOptions.length > 0) {
        await trx('kwp03_selected_options').insert(
          records.selectedOptions.map((option) => ({
            ...option,
            submission_id: id,
          })),
        );
      }
      if (records.attachments.length > 0) {
        await trx('kwp_form_attachments').insert(
          records.attachments.map((attachment) => ({
            ...attachment,
            submission_id: id,
            related_table: 'kwp03_wpms_issue_reports',
            related_id: issueReportId,
          })),
        );
      }
    });
    return getUpdatedSubmissionDetail(id, access);
  },

  async updateKwp04(
    id: number,
    payload: CreateKwp04SubmissionDTO,
    access: KwpFormSubmissionUpdateAccess,
  ): Promise<KwpFormSubmissionDetailDTO> {
    return updateKwpEmissionReport(id, payload, access);
  },

  async updateKwp05(
    id: number,
    payload: CreateKwp05SubmissionDTO,
    access: KwpFormSubmissionUpdateAccess,
  ): Promise<KwpFormSubmissionDetailDTO> {
    await db.transaction(async (trx) => {
      await assertCanEditReturnedSubmission(id, access, trx);
      const now = new Date();
      const records = toKwp05InsertRecords({
        payload,
        submissionNo: '',
        actorUserId: access.actorUserId,
        now,
      });

      await updateCommonSubmission(id, payload, access, now, trx);
      await trx('kwp_form_attachments').where('submission_id', id).delete();
      await trx('kwp05_calibration_items').where('submission_id', id).delete();
      await trx('kwp05_calibration_reports')
        .where('submission_id', id)
        .update(records.calibrationReport);

      for (const [itemIndex, item] of records.calibrationItems.entries()) {
        const insertedItem = await trx('kwp05_calibration_items')
          .insert({
            ...item,
            submission_id: id,
          })
          .returning<{ id: number | string }[]>('id');
        const itemId = Number(insertedItem[0]?.id);
        const attachments = records.attachmentsByItemIndex.get(itemIndex) ?? [];

        if (attachments.length > 0) {
          await trx('kwp_form_attachments').insert(
            attachments.map((attachment) => ({
              ...attachment,
              submission_id: id,
              related_table: 'kwp05_calibration_items',
              related_id: itemId,
            })),
          );
        }
      }
    });
    return getUpdatedSubmissionDetail(id, access);
  },

  async resubmit(
    id: number,
    input: ResubmitKwpFormSubmissionDTO,
    access: KwpFormWorkflowAccess & { formType: KwpFormSubmissionDetailType },
  ): Promise<KwpFormWorkflowDTO> {
    return db.transaction(async (trx) => {
      await assertCanEditReturnedSubmission(id, access, trx);
      const now = new Date();

      await trx('kwp_form_submissions').where('id', id).update({
        status: 'SUBMITTED',
        submitted_at: now,
        updated_at: now,
        updated_by: access.actorUserId,
      });
      await trx('kwp_form_status_history').insert({
        submission_id: id,
        status: 'SUBMITTED',
        note: input.note ?? null,
        changed_by: access.actorUserId,
        changed_at: now,
      });

      const updated = await buildWorkflowQuery(id, access, trx).first();
      if (!updated) {
        throw new NotFoundError('KWP form submission not found');
      }
      const historyRows = await listWorkflowHistory(Number(updated.id), trx);
      return toWorkflowDTO(updated, historyRows);
    });
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

  async createKwp03(
    payload: CreateKwp03SubmissionDTO,
    access: KwpFormSubmissionAccess,
  ): Promise<CreatedKwpFormSubmissionDTO> {
    return db.transaction(async (trx) => {
      await assertCanCreateForFactory(trx, payload.factoryId, access);

      const now = new Date();
      const submissionNo = await nextSubmissionNo(trx, now);
      const records = toKwp03InsertRecords({
        payload,
        submissionNo,
        actorUserId: access.actorUserId,
        now,
      });

      const inserted = await trx('kwp_form_submissions')
        .insert(records.submission)
        .returning<{ id: number | string }[]>('id');
      const submissionId = Number(inserted[0]?.id);

      const insertedReport = await trx('kwp03_wpms_issue_reports')
        .insert({
          ...records.wpmsIssueReport,
          submission_id: submissionId,
        })
        .returning<{ id: number | string }[]>('id');
      const wpmsIssueReportId = Number(insertedReport[0]?.id);

      if (records.selectedOptions.length > 0) {
        await trx('kwp03_selected_options').insert(
          records.selectedOptions.map((option) => ({
            ...option,
            submission_id: submissionId,
          })),
        );
      }

      if (records.attachments.length > 0) {
        await trx('kwp_form_attachments').insert(
          records.attachments.map((attachment) => ({
            ...attachment,
            submission_id: submissionId,
            related_table: 'kwp03_wpms_issue_reports',
            related_id: wpmsIssueReportId,
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
        form: 'กวภ.03',
        formType: 'KWP03',
        status: 'SUBMITTED',
        submittedAt: now.toISOString(),
        attachmentCount: records.attachments.length,
      };
    });
  },

  async createKwp04(
    payload: CreateKwp04SubmissionDTO,
    access: KwpFormSubmissionAccess,
  ): Promise<CreatedKwpFormSubmissionDTO> {
    return createKwpEmissionReport(payload, access, 'KWP04');
  },

  async createKwp05(
    payload: CreateKwp05SubmissionDTO,
    access: KwpFormSubmissionAccess,
  ): Promise<CreatedKwpFormSubmissionDTO> {
    return db.transaction(async (trx) => {
      await assertCanCreateForFactory(trx, payload.factoryId, access);

      const now = new Date();
      const submissionNo = await nextSubmissionNo(trx, now);
      const records = toKwp05InsertRecords({
        payload,
        submissionNo,
        actorUserId: access.actorUserId,
        now,
      });

      const inserted = await trx('kwp_form_submissions')
        .insert(records.submission)
        .returning<{ id: number | string }[]>('id');
      const submissionId = Number(inserted[0]?.id);

      await trx('kwp05_calibration_reports').insert({
        ...records.calibrationReport,
        submission_id: submissionId,
      });

      let attachmentCount = 0;
      for (const [itemIndex, item] of records.calibrationItems.entries()) {
        const insertedItem = await trx('kwp05_calibration_items')
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
              related_table: 'kwp05_calibration_items',
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
        form: 'กวภ.05',
        formType: 'KWP05',
        status: 'SUBMITTED',
        submittedAt: now.toISOString(),
        calibrationItemCount: records.calibrationItems.length,
        attachmentCount,
      };
    });
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

async function updateKwpEmissionReport(
  id: number,
  payload: CreateKwp02SubmissionDTO | CreateKwp04SubmissionDTO,
  access: KwpFormSubmissionUpdateAccess,
): Promise<KwpFormSubmissionDetailDTO> {
  await db.transaction(async (trx) => {
    await assertCanEditReturnedSubmission(id, access, trx);
    const now = new Date();
    const records = toKwp02InsertRecords({
      payload,
      submissionNo: '',
      actorUserId: access.actorUserId,
      now,
      formType: access.formType === 'KWP04' ? 'KWP04' : 'KWP02',
    });

    await updateCommonSubmission(id, payload, access, now, trx);
    await trx('kwp_form_attachments').where('submission_id', id).delete();
    await trx('kwp_emission_measurement_items').where('submission_id', id).delete();

    for (const [itemIndex, item] of records.measurementItems.entries()) {
      const insertedItem = await trx('kwp_emission_measurement_items')
        .insert({
          ...item,
          submission_id: id,
        })
        .returning<{ id: number | string }[]>('id');
      const itemId = Number(insertedItem[0]?.id);
      const attachments = records.attachmentsByItemIndex.get(itemIndex) ?? [];

      if (attachments.length > 0) {
        await trx('kwp_form_attachments').insert(
          attachments.map((attachment) => ({
            ...attachment,
            submission_id: id,
            related_table: 'kwp_emission_measurement_items',
            related_id: itemId,
          })),
        );
      }
    }
  });
  return getUpdatedSubmissionDetail(id, access);
}

async function getUpdatedSubmissionDetail(
  id: number,
  access: KwpFormSubmissionUpdateAccess,
): Promise<KwpFormSubmissionDetailDTO> {
  return kwpFormSubmissionsRepository.getById(id, {
    actorUserId: access.actorUserId,
    formType: access.formType,
    scope: access.scope,
    regionalAccess: access.regionalAccess,
    publicBaseUrl: access.publicBaseUrl,
    publicPath: access.publicPath,
  });
}

async function assertCanEditReturnedSubmission(
  id: number,
  access: KwpFormSubmissionAccess & {
    formType: KwpFormSubmissionDetailType;
    regionalAccess?: { regions: string[] } | null;
  },
  trx: Knex.Transaction,
): Promise<EditableSubmissionRow> {
  const row = await buildEditableSubmissionQuery(id, access, trx).first();
  if (!row) {
    throw new NotFoundError('KWP form submission not found');
  }
  if (row.status !== 'REVISION_REQUESTED') {
    throw new ConflictError('KWP form submission can be edited only after revision is requested', {
      currentStatus: row.status,
      requiredStatus: 'REVISION_REQUESTED',
    });
  }
  return row;
}

function buildEditableSubmissionQuery(
  id: number,
  access: KwpFormSubmissionAccess & {
    formType: KwpFormSubmissionDetailType;
    regionalAccess?: { regions: string[] } | null;
  },
  knexOrTrx: Knex | Knex.Transaction = db,
): Knex.QueryBuilder<EditableSubmissionRow, EditableSubmissionRow[]> {
  const builder = knexOrTrx<EditableSubmissionRow>('kwp_form_submissions as s')
    .leftJoin('factories as f', function joinFactory() {
      this.on('f.fid', '=', 's.factory_id')
        .orOn('f.code', '=', 's.factory_id')
        .orOn('f.code', '=', 's.factory_registration_no');
    })
    .leftJoin('provinces as p', 'p.id', 'f.province_id')
    .where('s.id', id)
    .where('s.form_type', access.formType)
    .whereNull('s.deleted_at')
    .select('s.id', 's.form_type', 's.status');

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

  return builder as unknown as Knex.QueryBuilder<EditableSubmissionRow, EditableSubmissionRow[]>;
}

async function updateCommonSubmission(
  id: number,
  payload:
    | CreateKwp01SubmissionDTO
    | CreateKwp02SubmissionDTO
    | CreateKwp03SubmissionDTO
    | CreateKwp04SubmissionDTO
    | CreateKwp05SubmissionDTO,
  access: KwpFormSubmissionUpdateAccess,
  now: Date,
  trx: Knex.Transaction,
): Promise<void> {
  await assertCanCreateForFactory(trx, payload.factoryId, access);

  await trx('kwp_form_submissions')
    .where('id', id)
    .update({
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
      updated_at: now,
      updated_by: access.actorUserId,
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

export function buildKwpFormSubmissionWorkflowQueryForTests(
  id: number,
  access: KwpFormWorkflowAccess,
): Knex.QueryBuilder {
  return buildWorkflowQuery(id, access);
}

export function buildKwpFormEditableSubmissionQueryForTests(
  id: number,
  access: KwpFormSubmissionAccess & { formType: KwpFormSubmissionDetailType },
): Knex.QueryBuilder {
  return buildEditableSubmissionQuery(id, access);
}

export function toKwp01InsertRecordsForTests(input: Kwp01InsertInput): Kwp01InsertRecords {
  return toKwp01InsertRecords(input);
}

export function toKwp02InsertRecordsForTests(input: Kwp02InsertInput): Kwp02InsertRecords {
  return toKwp02InsertRecords(input);
}

export function toKwp03InsertRecordsForTests(input: Kwp03InsertInput): Kwp03InsertRecords {
  return toKwp03InsertRecords(input);
}

export function toKwp05InsertRecordsForTests(input: Kwp05InsertInput): Kwp05InsertRecords {
  return toKwp05InsertRecords(input);
}

export function toKwpWorkflowDTOForTests(
  row: SubmissionWorkflowRow,
  historyRows: WorkflowHistoryRow[] = [],
): KwpFormWorkflowDTO {
  return toWorkflowDTO(row, historyRows);
}

export function nextKwpWorkflowStatusForTests(
  currentStatus: KwpFormSubmissionStatus,
  action: KwpFormWorkflowAction,
): KwpFormSubmissionStatus {
  return nextWorkflowStatus(currentStatus, action);
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

function buildWorkflowQuery(
  id: number,
  access: KwpFormWorkflowAccess,
  knexOrTrx: Knex | Knex.Transaction = db,
): Knex.QueryBuilder<SubmissionWorkflowRow, SubmissionWorkflowRow[]> {
  const builder = knexOrTrx<SubmissionWorkflowRow>('kwp_form_submissions as s')
    .leftJoin('factories as f', function joinFactory() {
      this.on('f.fid', '=', 's.factory_id')
        .orOn('f.code', '=', 's.factory_id')
        .orOn('f.code', '=', 's.factory_registration_no');
    })
    .leftJoin('provinces as p', 'p.id', 'f.province_id')
    .where('s.id', id)
    .whereNull('s.deleted_at')
    .select(
      's.id',
      's.submission_no',
      's.form_type',
      's.status',
      's.officer_note',
      's.reviewed_at',
      's.created_at',
      's.updated_at',
      'p.region as province_region',
    );

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

  return builder as unknown as Knex.QueryBuilder<SubmissionWorkflowRow, SubmissionWorkflowRow[]>;
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

async function getKwp03WpmsIssueReport(
  submissionId: number,
  access: KwpFormSubmissionReadAccess,
): Promise<Kwp03WpmsIssueReportDTO> {
  const row = await db<Kwp03WpmsIssueReportRow>('kwp03_wpms_issue_reports')
    .where('submission_id', submissionId)
    .first(
      'id',
      'wastewater_source',
      'receiving_source',
      'treatment_system_type',
      'discharge_point',
      'average_discharge',
      'minimum_discharge',
      'maximum_discharge',
      'reason_detail',
      'problem_date',
      'expected_done_date',
      'total_days',
      'corrective_action',
    );
  const optionRows = await db<Kwp03SelectedOptionRow>('kwp03_selected_options')
    .where('submission_id', submissionId)
    .orderBy('option_group', 'asc')
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc')
    .select('option_group', 'option_value');
  const optionsByGroup = groupKwp03Options(optionRows);
  const reportId = row ? Number(row.id) : null;
  const attachmentsByReportId = await listAttachmentsByRelatedId(
    submissionId,
    'kwp03_wpms_issue_reports',
    reportId === null ? [] : [reportId],
    access,
  );

  return {
    wastewaterSource: row?.wastewater_source ?? null,
    receivingSource: row?.receiving_source ?? null,
    treatmentSystemType: row?.treatment_system_type ?? null,
    dischargePoint: row?.discharge_point ?? null,
    averageDischarge: decimalText(row?.average_discharge ?? null),
    minimumDischarge: decimalText(row?.minimum_discharge ?? null),
    maximumDischarge: decimalText(row?.maximum_discharge ?? null),
    reasonDetail: row?.reason_detail ?? null,
    problemDate: toDateOnly(row?.problem_date ?? null),
    expectedDoneDate: toDateOnly(row?.expected_done_date ?? null),
    totalDays:
      row?.total_days === null || row?.total_days === undefined ? null : Number(row.total_days),
    correctiveAction: row?.corrective_action ?? null,
    instruments: optionsByGroup.INSTRUMENT,
    measurementTimes: optionsByGroup.MEASUREMENT_TIME,
    issueReasons: optionsByGroup.ISSUE_REASON.map(toKwp03IssueReason),
    failedParameters: optionsByGroup.FAILED_PARAMETER,
    attachments: reportId === null ? [] : (attachmentsByReportId.get(reportId) ?? []),
  };
}

async function getKwp05CalibrationReport(submissionId: number): Promise<Kwp05CalibrationReportDTO> {
  const row = await db<Kwp05CalibrationReportRow>('kwp05_calibration_reports')
    .where('submission_id', submissionId)
    .first(
      'business_activity',
      'sampler_name',
      'officer_registration',
      'laboratory_name',
      'laboratory_registration',
      'cems_brand',
      'cems_detail',
      'report_round',
      'report_year',
    );

  return {
    businessActivity: row?.business_activity ?? null,
    samplerName: row?.sampler_name ?? null,
    officerRegistration: row?.officer_registration ?? null,
    laboratoryName: row?.laboratory_name ?? null,
    laboratoryRegistration: row?.laboratory_registration ?? null,
    cemsBrand: row?.cems_brand ?? null,
    cemsDetail: row?.cems_detail ?? null,
    reportRound: row?.report_round ?? null,
    reportYear: row?.report_year ?? null,
  };
}

async function listKwp05CalibrationItems(
  submissionId: number,
  access: KwpFormSubmissionReadAccess,
): Promise<Kwp05CalibrationItemDTO[]> {
  const itemRows = await db<Kwp05CalibrationItemRow>('kwp05_calibration_items')
    .where('submission_id', submissionId)
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc')
    .select(
      'id',
      'parameter_name',
      'start_date',
      'end_date',
      'result',
      'verifier_company',
      'cems_model',
      'link_qr1',
      'link_qr2',
    );
  const attachmentsByItemId = await listAttachmentsByRelatedId(
    submissionId,
    'kwp05_calibration_items',
    itemRows.map((row) => Number(row.id)),
    access,
  );

  return itemRows.map((row) => ({
    id: Number(row.id),
    parameter: row.parameter_name,
    startDate: toDateOnly(row.start_date),
    endDate: toDateOnly(row.end_date),
    result: row.result,
    verifierCompany: row.verifier_company,
    cemsModel: row.cems_model,
    rataReportLink: row.link_qr1,
    calibrationPhotoLink: row.link_qr2,
    attachments: attachmentsByItemId.get(Number(row.id)) ?? [],
  }));
}

async function listAttachmentsByItemId(
  submissionId: number,
  itemIds: number[],
  access: KwpFormSubmissionReadAccess,
): Promise<Map<number, KwpFormAttachmentDTO[]>> {
  return listAttachmentsByRelatedId(
    submissionId,
    'kwp_emission_measurement_items',
    itemIds,
    access,
  );
}

async function listAttachmentsByRelatedId(
  submissionId: number,
  relatedTable: string,
  itemIds: number[],
  access: KwpFormSubmissionReadAccess,
): Promise<Map<number, KwpFormAttachmentDTO[]>> {
  if (itemIds.length === 0) return new Map();

  const rows = await db<KwpAttachmentRow>('kwp_form_attachments')
    .where('submission_id', submissionId)
    .where('related_table', relatedTable)
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

async function listWorkflowHistory(
  submissionId: number,
  knexOrTrx: Knex | Knex.Transaction = db,
): Promise<WorkflowHistoryRow[]> {
  return knexOrTrx<WorkflowHistoryRow>('kwp_form_status_history')
    .where('submission_id', submissionId)
    .orderBy('changed_at', 'asc')
    .orderBy('id', 'asc')
    .select('status', 'note', 'changed_at');
}

function toSubmissionDetailDTO(row: SubmissionDetailRow): KwpFormSubmissionDetailDTO {
  return {
    id: Number(row.id),
    requestNo: row.submission_no,
    form:
      row.form_type === 'KWP05'
        ? 'กวภ.05'
        : row.form_type === 'KWP04'
          ? 'กวภ.04'
          : row.form_type === 'KWP02'
            ? 'กวภ.02'
            : 'กวภ.01',
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

function toWorkflowDTO(
  row: SubmissionWorkflowRow,
  historyRows: WorkflowHistoryRow[],
): KwpFormWorkflowDTO {
  const hasRevisionRequest = historyRows.some((history) => history.status === 'REVISION_REQUESTED');
  const revisionReason = latestRevisionReason(historyRows);
  const steps = workflowSteps(row.status, hasRevisionRequest);
  const currentStep = steps.find((step) => step.status === 'CURRENT') ??
    steps[0] ?? {
      key: 'SUBMITTED',
      label: 'ส่งฟอร์ม',
      status: 'PENDING',
    };
  return {
    id: Number(row.id),
    requestNo: row.submission_no,
    form: KWP_FORM_TYPE_LABELS[row.form_type],
    formType: row.form_type,
    status: row.status,
    statusLabel: KWP_FORM_STATUS_LABELS[row.status],
    revisionReason,
    officerNote: row.officer_note,
    reviewedAt: toIsoString(row.reviewed_at),
    currentStep,
    steps,
    allowedActions: allowedWorkflowActions(row.status),
  };
}

function workflowSteps(
  status: KwpFormSubmissionStatus,
  hasRevisionRequest: boolean,
): KwpFormWorkflowStepDTO[] {
  const revisionStepStatus: KwpFormWorkflowStepDTO['status'] =
    status === 'REVISION_REQUESTED' ? 'CURRENT' : hasRevisionRequest ? 'DONE' : 'SKIPPED';
  const approvedStepStatus: KwpFormWorkflowStepDTO['status'] =
    status === 'APPROVED' ? 'CURRENT' : 'PENDING';

  if (status === 'SUBMITTED') {
    return [
      { key: 'SUBMITTED', label: 'ส่งฟอร์ม', status: 'CURRENT' },
      { key: 'OFFICER_REVIEW', label: 'พิจารณา', status: 'PENDING' },
      { key: 'REVISION_REQUESTED', label: 'ส่งแก้ไข', status: 'PENDING' },
      { key: 'APPROVED', label: 'ผ่านการพิจารณา', status: 'PENDING' },
    ];
  }

  return [
    { key: 'SUBMITTED', label: 'ส่งฟอร์ม', status: 'DONE' },
    {
      key: 'OFFICER_REVIEW',
      label: 'พิจารณา',
      status: status === 'UNDER_REVIEW' ? 'CURRENT' : 'DONE',
    },
    { key: 'REVISION_REQUESTED', label: 'ส่งแก้ไข', status: revisionStepStatus },
    { key: 'APPROVED', label: 'ผ่านการพิจารณา', status: approvedStepStatus },
  ];
}

function allowedWorkflowActions(status: KwpFormSubmissionStatus): KwpFormWorkflowAction[] {
  if (status === 'SUBMITTED') return ['START_REVIEW', 'REQUEST_REVISION'];
  if (status === 'UNDER_REVIEW') return ['REQUEST_REVISION', 'APPROVE'];
  if (status === 'REVISION_REQUESTED') return ['START_REVIEW'];
  return [];
}

function latestRevisionReason(historyRows: WorkflowHistoryRow[]): string | null {
  return (
    [...historyRows]
      .reverse()
      .find((history) => history.status === 'REVISION_REQUESTED' && history.note)?.note ?? null
  );
}

function nextWorkflowStatus(
  currentStatus: KwpFormSubmissionStatus,
  action: KwpFormWorkflowAction,
): KwpFormSubmissionStatus {
  if (!allowedWorkflowActions(currentStatus).includes(action)) {
    throw new BadRequestError('Invalid KWP workflow action for current status', {
      currentStatus,
      action,
      allowedActions: allowedWorkflowActions(currentStatus),
    });
  }

  if (action === 'START_REVIEW') return 'UNDER_REVIEW';
  if (action === 'REQUEST_REVISION') return 'REVISION_REQUESTED';
  return 'APPROVED';
}

function workflowOfficerNote(input: ChangeKwpFormWorkflowStatusDTO): string | null {
  if (input.action === 'REQUEST_REVISION') return input.revisionReason ?? null;
  return input.officerNote ?? null;
}

function workflowHistoryNote(input: ChangeKwpFormWorkflowStatusDTO): string | null {
  if (input.action === 'REQUEST_REVISION') {
    return [input.revisionReason, input.officerNote].filter(Boolean).join('\n') || null;
  }
  return input.officerNote ?? null;
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

function toKwp03InsertRecords(input: Kwp03InsertInput): Kwp03InsertRecords {
  const { payload, submissionNo, actorUserId, now } = input;
  const selectedOptions = [
    ...toKwp03OptionRecords('INSTRUMENT', payload.instruments),
    ...toKwp03OptionRecords('MEASUREMENT_TIME', payload.measurementTimes),
    ...toKwp03OptionRecords('ISSUE_REASON', payload.issueReasons),
    ...toKwp03OptionRecords('FAILED_PARAMETER', payload.failedParameters),
  ];
  const attachments = (payload.attachments ?? []).map((attachment) => ({
    attachment_type: attachment.attachmentType,
    original_file_name: attachment.originalFileName,
    stored_file_name: attachment.storedFileName ?? null,
    mime_type: attachment.mimeType ?? null,
    file_size: attachment.fileSize ?? null,
    storage_path: attachment.storagePath ?? null,
    uploaded_at: now,
    uploaded_by: actorUserId,
  }));

  return {
    submission: toCommonSubmissionRecord(payload, 'KWP03', submissionNo, actorUserId, now),
    wpmsIssueReport: {
      wastewater_source: payload.wastewaterSource ?? null,
      receiving_source: payload.receivingSource ?? null,
      treatment_system_type: payload.treatmentSystemType ?? null,
      discharge_point: payload.dischargePoint ?? null,
      average_discharge: decimalValue(payload.averageDischarge),
      minimum_discharge: decimalValue(payload.minimumDischarge),
      maximum_discharge: decimalValue(payload.maximumDischarge),
      reason_detail: payload.reasonDetail ?? null,
      problem_date: payload.problemDate ?? null,
      expected_done_date: payload.expectedDoneDate ?? null,
      total_days: payload.totalDays ?? null,
      corrective_action: payload.correctiveAction ?? null,
    },
    selectedOptions,
    attachments,
    statusHistory: {
      status: 'SUBMITTED',
      note: null,
      changed_by: actorUserId,
      changed_at: now,
    },
  };
}

function toKwp05InsertRecords(input: Kwp05InsertInput): Kwp05InsertRecords {
  const { payload, submissionNo, actorUserId, now } = input;
  const attachmentsByItemIndex = new Map<number, Array<Record<string, unknown>>>();

  const calibrationItems = payload.calibrationItems.map((item, index) => {
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
      parameter_name: item.parameter,
      start_date: item.startDate ?? null,
      end_date: item.endDate ?? null,
      result: item.result ?? null,
      verifier_company: item.verifierCompany ?? null,
      cems_model: item.cemsModel ?? null,
      link_qr1: item.rataReportLink ?? null,
      link_qr2: item.calibrationPhotoLink ?? null,
      sort_order: index + 1,
    };
  });

  return {
    submission: toCommonSubmissionRecord(payload, 'KWP05', submissionNo, actorUserId, now),
    calibrationReport: {
      business_activity: payload.businessActivity ?? null,
      sampler_name: payload.samplerName ?? null,
      officer_registration: payload.officerRegistration ?? null,
      laboratory_name: payload.laboratoryName ?? null,
      laboratory_registration: payload.laboratoryRegistration ?? null,
      cems_brand: payload.cemsBrand ?? null,
      cems_detail: payload.cemsDetail ?? null,
      report_round: payload.reportRound ?? null,
      report_year: payload.reportYear ?? null,
    },
    calibrationItems,
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
  payload:
    | CreateKwp01SubmissionDTO
    | CreateKwp02SubmissionDTO
    | CreateKwp03SubmissionDTO
    | CreateKwp04SubmissionDTO
    | CreateKwp05SubmissionDTO,
  formType: KwpFormSubmissionDetailType,
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

function toKwp03OptionRecords(
  optionGroup: Kwp03OptionGroup,
  values: readonly string[],
): Array<Record<string, unknown>> {
  return values.map((value, index) => ({
    option_group: optionGroup,
    option_value: value,
    sort_order: index + 1,
  }));
}

function groupKwp03Options(rows: Kwp03SelectedOptionRow[]): Record<Kwp03OptionGroup, string[]> {
  return rows.reduce(
    (groups, row) => ({
      ...groups,
      [row.option_group]: [...groups[row.option_group], row.option_value],
    }),
    {
      INSTRUMENT: [],
      MEASUREMENT_TIME: [],
      ISSUE_REASON: [],
      FAILED_PARAMETER: [],
    } as Record<Kwp03OptionGroup, string[]>,
  );
}

function toKwp03IssueReason(value: string): Kwp03IssueReason {
  if (value === 'ไม่มีการระบายน้ำทิ้งออกนอกโรงงาน') return value;
  if (value === 'ระบบรับส่งข้อมูล ระบบไฟฟ้า อินเทอร์เน็ต ขัดข้อง') return value;
  return 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง';
}

function decimalValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function decimalText(value: number | string | null): string | null {
  if (value === null) return null;
  return String(value);
}

const KWP_FORM_TYPE_LABELS: Record<
  KwpFormSubmissionDetailType,
  'กวภ.01' | 'กวภ.02' | 'กวภ.03' | 'กวภ.04' | 'กวภ.05'
> = {
  KWP01: 'กวภ.01',
  KWP02: 'กวภ.02',
  KWP03: 'กวภ.03',
  KWP04: 'กวภ.04',
  KWP05: 'กวภ.05',
};

const KWP_FORM_STATUS_LABELS: Record<KwpFormSubmissionStatus, string> = {
  DRAFT: 'แบบร่าง',
  SUBMITTED: 'รอพิจารณา',
  UNDER_REVIEW: 'รอพิจารณา',
  APPROVED: 'ผ่านการพิจารณา',
  REJECTED: 'ไม่ผ่านการพิจารณา',
  REVISION_REQUESTED: 'รอโรงงานแก้ไข',
  CANCELLED: 'ยกเลิก',
};
