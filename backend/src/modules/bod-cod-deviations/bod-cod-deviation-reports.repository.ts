import type { Knex } from 'knex';
import { db } from '../../config/database';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { buildPublicFileUrl } from '../kwp-form-submissions/kwp-form-attachments.service';
import type {
  BodCodApprovalTrack,
  BodCodApprovalStepStatus,
  BodCodAllowedAction,
  BodCodDeviationAccess,
  BodCodDeviationAttachmentDTO,
  BodCodDeviationAttachmentInput,
  BodCodConnectedMeasurementPointDTO,
  BodCodDeviationFactoryTableRowDTO,
  BodCodDeviationMeasurementDTO,
  BodCodDeviationReportStatus,
  BodCodReportSlotDTO,
  BodCodStatusHistoryDTO,
  BodCodWorkflowStepDTO,
  BodCodDeviationReportTableRowDTO,
  BodCodParameterCode,
  BodCodWorkflowAction,
  CreateBodCodDeviationReportAccess,
  CreateBodCodDeviationReportDTO,
  CreatedBodCodDeviationReportDTO,
  BodCodDeviationReportDetailDTO,
  ChangeBodCodWorkflowStatusDTO,
  ListBodCodDeviationReportsQuery,
  ResubmitBodCodDeviationReportDTO,
} from './bod-cod-deviation-reports.types';

type BodCodApprovalEventAction = BodCodWorkflowAction | 'RESUBMIT_REVISION';

interface FactoryTableRow {
  connected_point_id: number | string;
  source_request_id: number | string;
  source_measurement_point_id: number | string;
  factory_id: string;
  factory_name: string;
  factory_registration_no: string;
  factory_address: string | null;
  point_code: string | null;
  point_name: string;
  point_type: string;
  system_type: string;
  parameters_json: string;
  connected_at: Date | string | null;
  poms_factory_id: number | string | null;
  factory_fid: string | null;
  factory_code: string | null;
  factory_system_detail: string | null;
  province_name: string | null;
  province_region: string | null;
  industrial_estate_name: string | null;
  factory_registration_no_old: string | null;
  address: string | null;
  business_activity: string | null;
  eligible_factory_id: number | string | null;
}

interface ReportTableRow {
  id: number | string;
  report_no: string;
  report_round: number | string;
  report_year: number | string;
  factory_id: number | string | null;
  connected_measurement_point_id: number | string | null;
  point_code: string | null;
  point_name: string | null;
  factory_fid: string | null;
  factory_name: string;
  factory_registration_no: string;
  province_name: string;
  approval_track: BodCodApprovalTrack;
  selected_parameter_code: BodCodParameterCode;
  status: BodCodDeviationReportStatus;
  submitted_at: Date | string | null;
  created_by: number | string | null;
  created_by_username: string | null;
  created_by_prename_th: string | null;
  created_by_first_name: string | null;
  created_by_last_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  measurement_count: number | string | null;
}

interface ReportDetailRow extends ReportTableRow {
  business_activity: string | null;
  address: string | null;
  wastewater_flow_m3_per_hour: number | string | null;
  sampler_name: string | null;
  officer_registration_no: string | null;
  laboratory_name: string | null;
  laboratory_registration_no: string | null;
  lab_report_no: string | null;
  analysis_method: string | null;
  device_brand: string | null;
  device_model: string | null;
  device_serial_no: string | null;
  reporter_name: string | null;
  reporter_position: string | null;
}

interface EditableReportRow extends ReportDetailRow {
  current_step_id: number | string | null;
  current_step_no: number | string | null;
  current_step_status: BodCodApprovalStepStatus | null;
}

interface MeasurementRow {
  id: number | string;
  parameter_code: BodCodParameterCode;
  sample_date: Date | string;
  sample_time: Date | string;
  device_value_mg_l: number | string;
  lab_value_mg_l: number | string;
  deviation_value_mg_l: number | string;
  standard_deviation_mg_l: number | string | null;
  is_within_standard: boolean | number | null;
  sort_order: number | string;
}

interface AttachmentRow {
  id: number | string;
  attachment_type: BodCodDeviationAttachmentInput['attachmentType'];
  original_file_name: string;
  stored_file_name: string | null;
  mime_type: string | null;
  file_size: number | string | null;
  storage_path: string | null;
}

interface ApprovalStepRow {
  id: number | string;
  step_no: number | string;
  track: BodCodApprovalTrack;
  role_code: 'INSPECTOR' | 'REVIEWER' | 'APPROVER';
  role_label: string;
  status: BodCodApprovalStepStatus;
  actor_user_id: number | string | null;
  actor_name: string | null;
  actor_position: string | null;
  decision: string | null;
  comment: string | null;
  decided_at: Date | string | null;
  is_current: boolean | number;
}

interface StatusHistoryReportRow {
  id: number | string;
  approval_track: BodCodApprovalTrack;
  status: BodCodDeviationReportStatus;
  submitted_at: Date | string | null;
  created_at?: Date | string;
  created_by: number | string | null;
  created_by_username: string | null;
  created_by_prename_th: string | null;
  created_by_first_name: string | null;
  created_by_last_name: string | null;
}

interface ApprovalEventRow {
  id: number | string;
  report_id: number | string;
  action: BodCodApprovalEventAction;
  note: string | null;
  actor_user_id: number | string | null;
  actor_username: string | null;
  actor_prename_th: string | null;
  actor_first_name: string | null;
  actor_last_name: string | null;
  created_at: Date | string;
}

export interface LatestReportRow {
  factory_id: number | string | null;
  connected_measurement_point_id: number | string | null;
  point_code: string | null;
  factory_registration_no: string;
  report_round: number | string;
  report_year: number | string;
  report_id: number | string;
  report_no: string;
  status: BodCodDeviationReportStatus;
}

export const bodCodDeviationReportsRepository = {
  async listFactories(
    access: BodCodDeviationAccess,
  ): Promise<{ rows: BodCodDeviationFactoryTableRowDTO[]; total: number }> {
    const rows = await buildFactoryQuery(access);
    const currentYear = currentBuddhistYear();
    const reports = await listCurrentYearReportsForConnectedPoints(rows, currentYear);
    const reportBySlotKey = buildLatestReportSlotMap(reports);
    const data = toConnectedFactoryDTOs(rows, reportBySlotKey, currentYear, access.scope);

    return { rows: data, total: data.length };
  },

  async listReports(
    query: ListBodCodDeviationReportsQuery,
    access: BodCodDeviationAccess,
  ): Promise<{ rows: BodCodDeviationReportTableRowDTO[]; total: number }> {
    const baseQuery = buildReportQuery(query, access);
    const totalRow = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ total: number | string }>('r.id as total')
      .first();
    const total = Number(totalRow?.total ?? 0);

    const rows = await baseQuery.clone().orderBy('r.created_at', 'desc').orderBy('r.id', 'desc');
    const historyByReportId = await listStatusHistoryForReports(rows, access.scope);
    return {
      rows: rows.map((row) =>
        toReportDTO(row, access.scope, historyByReportId.get(Number(row.id)) ?? []),
      ),
      total,
    };
  },

  async createReport(
    input: CreateBodCodDeviationReportDTO,
    access: CreateBodCodDeviationReportAccess,
  ): Promise<CreatedBodCodDeviationReportDTO> {
    return db.transaction(async (trx) => {
      const now = new Date();
      const factoryInternalId = await resolveFactoryInternalId(input, access, trx);
      const approvalTrack = approvalTrackForProvince(input.provinceName);
      const reportNo = await nextReportNo(input.reportYear, trx);
      const inserted = await trx('bod_cod_deviation_reports')
        .insert({
          report_no: reportNo,
          report_round: input.reportRoundNo,
          report_year: input.reportYear,
          factory_id: factoryInternalId,
          connected_measurement_point_id: input.connectedMeasurementPointId ?? null,
          point_code: input.pointCode ?? null,
          point_name: input.pointName ?? null,
          factory_name: input.factoryName,
          factory_registration_no: input.factoryRegistrationNo,
          business_activity: input.businessActivity ?? null,
          address: input.factoryAddress ?? null,
          province_name: input.provinceName,
          approval_track: approvalTrack,
          selected_parameter_code: input.selectedParameterCode,
          wastewater_flow_m3_per_hour: input.wastewaterFlowM3PerHour ?? null,
          sampler_name: input.samplerName ?? null,
          officer_registration_no: input.officerRegistrationNo ?? null,
          laboratory_name: input.laboratoryName ?? null,
          laboratory_registration_no: input.laboratoryRegistrationNo ?? null,
          lab_report_no: input.labReportNo ?? null,
          analysis_method: input.analysisMethod ?? null,
          device_brand: input.deviceBrand ?? null,
          device_model: input.deviceModel ?? null,
          device_serial_no: input.deviceSerialNo ?? null,
          reporter_name: input.reporterName ?? null,
          reporter_position: input.reporterPosition ?? null,
          status: 'SUBMITTED',
          submitted_at: now,
          created_by: access.actorUserId,
          updated_by: access.actorUserId,
          created_at: now,
          updated_at: now,
        })
        .returning('id');
      const reportId = Number(inserted[0]?.id);

      await trx('bod_cod_deviation_measurements').insert(
        input.measurements.map((measurement, index) => {
          const deviationValue = measurement.deviceValueMgL - measurement.labValueMgL;
          const standard = measurement.standardDeviationMgL ?? null;
          return {
            report_id: reportId,
            parameter_code: input.selectedParameterCode,
            sample_date: measurement.sampleDate,
            sample_time: measurement.sampleTime,
            device_value_mg_l: measurement.deviceValueMgL,
            lab_value_mg_l: measurement.labValueMgL,
            standard_deviation_mg_l: standard,
            is_within_standard: standard === null ? null : Math.abs(deviationValue) <= standard,
            sort_order: index + 1,
            created_at: now,
            updated_at: now,
          };
        }),
      );

      if (input.attachments.length > 0) {
        await trx('bod_cod_deviation_attachments').insert(
          input.attachments.map((attachment) => ({
            report_id: reportId,
            attachment_type: attachment.attachmentType,
            original_file_name: attachment.originalFileName,
            stored_file_name: attachment.storedFileName ?? null,
            mime_type: attachment.mimeType ?? null,
            file_size: attachment.fileSize ?? null,
            storage_path: attachment.storagePath ?? null,
            uploaded_by: access.actorUserId,
            uploaded_at: now,
            created_at: now,
            updated_at: now,
          })),
        );
      }

      const steps = approvalStepsForTrack(approvalTrack);
      await trx('bod_cod_approval_steps').insert(
        steps.map((step, index) => ({
          report_id: reportId,
          track: approvalTrack,
          step_no: step.stepNo,
          role_code: step.roleCode,
          role_label: step.roleLabel,
          status: index === 0 ? 'PENDING' : 'WAITING',
          revision_no: 1,
          is_current: index === 0,
          created_at: now,
          updated_at: now,
        })),
      );

      const savedSteps = await listApprovalSteps(reportId, trx);
      const currentStep = currentWorkflowStep(savedSteps);
      return {
        id: reportId,
        reportNo,
        statusCode: 'SUBMITTED',
        approvalTrack,
        currentStep,
        steps: savedSteps,
        allowedActions: allowedActionsFor('SUBMITTED', currentStep, access.scope),
      };
    });
  },

  async resubmitReport(
    id: number,
    input: ResubmitBodCodDeviationReportDTO,
    access: CreateBodCodDeviationReportAccess,
  ): Promise<CreatedBodCodDeviationReportDTO> {
    return db.transaction(async (trx) => {
      const now = new Date();
      const report = await assertCanResubmitReport(id, input, access, trx);
      const approvalTrack = report.approval_track;

      await trx('bod_cod_deviation_reports')
        .where('id', id)
        .update({
          factory_name: input.factoryName,
          business_activity: input.businessActivity ?? null,
          address: input.factoryAddress ?? null,
          province_name: input.provinceName,
          wastewater_flow_m3_per_hour: input.wastewaterFlowM3PerHour ?? null,
          sampler_name: input.samplerName ?? null,
          officer_registration_no: input.officerRegistrationNo ?? null,
          laboratory_name: input.laboratoryName ?? null,
          laboratory_registration_no: input.laboratoryRegistrationNo ?? null,
          lab_report_no: input.labReportNo ?? null,
          analysis_method: input.analysisMethod ?? null,
          device_brand: input.deviceBrand ?? null,
          device_model: input.deviceModel ?? null,
          device_serial_no: input.deviceSerialNo ?? null,
          reporter_name: input.reporterName ?? null,
          reporter_position: input.reporterPosition ?? null,
          status: 'REVISED_PENDING_REVIEW',
          submitted_at: now,
          updated_by: access.actorUserId,
          updated_at: now,
        });

      await softReplaceMeasurements(id, input, now, trx);
      await softReplaceAttachments(id, input, access.actorUserId, now, trx);
      await resetApprovalStepsForResubmission(id, now, trx);
      await insertApprovalEvent(
        id,
        'RESUBMIT_REVISION',
        access.actorUserId,
        input.revisionNote,
        now,
        trx,
      );

      const savedSteps = await listApprovalSteps(id, trx);
      const currentStep = currentWorkflowStep(savedSteps);
      return {
        id,
        reportNo: report.report_no,
        statusCode: 'REVISED_PENDING_REVIEW',
        approvalTrack,
        currentStep,
        steps: savedSteps,
        allowedActions: allowedActionsFor('REVISED_PENDING_REVIEW', currentStep, access.scope),
      };
    });
  },

  async changeWorkflowStatus(
    id: number,
    input: ChangeBodCodWorkflowStatusDTO,
    access: BodCodDeviationAccess,
  ): Promise<CreatedBodCodDeviationReportDTO> {
    return db.transaction(async (trx) => {
      const now = new Date();
      const report = await assertCanChangeWorkflowStatus(id, input, access, trx);
      const currentStepId = Number(report.current_step_id);
      const nextStep =
        input.action === 'APPROVE'
          ? await findNextApprovalStep(id, Number(report.current_step_no), trx)
          : null;
      const nextState = nextWorkflowState(input.action, nextStep !== null);
      const note = workflowActionNote(input);

      await updateCurrentApprovalStep(
        currentStepId,
        nextState.currentStepStatus,
        note,
        access,
        now,
        trx,
      );

      if (nextStep !== null && nextState.nextStepStatus !== null) {
        await markNextApprovalStepCurrent(Number(nextStep.id), nextState.nextStepStatus, now, trx);
      }

      await trx('bod_cod_deviation_reports').where('id', id).update({
        status: nextState.reportStatus,
        updated_by: access.actorUserId,
        updated_at: now,
      });

      await insertApprovalEvent(id, input.action, access.actorUserId, note, now, trx);

      const savedSteps = await listApprovalSteps(id, trx);
      const currentStep = currentWorkflowStep(savedSteps);
      return {
        id,
        reportNo: report.report_no,
        statusCode: nextState.reportStatus,
        approvalTrack: report.approval_track,
        currentStep,
        steps: savedSteps,
        allowedActions: allowedActionsFor(nextState.reportStatus, currentStep, access.scope),
      };
    });
  },

  async getReportById(
    id: number,
    access: BodCodDeviationAccess,
  ): Promise<BodCodDeviationReportDetailDTO> {
    const report = await buildReportDetailQuery(id, access).first();
    if (!report) throw new NotFoundError('BOD/COD deviation report not found');

    const [measurements, attachments, steps, historyByReportId] = await Promise.all([
      listMeasurements(id),
      listAttachments(id, access),
      listApprovalSteps(id),
      listStatusHistoryForReports([report], access.scope),
    ]);
    return toReportDetailDTO(
      report,
      measurements,
      attachments,
      steps,
      historyByReportId.get(Number(report.id)) ?? [],
      access.scope,
    );
  },
};

export function buildBodCodDeviationFactoryQueryForTests(access: BodCodDeviationAccess) {
  return buildFactoryQuery(access);
}

export function buildBodCodDeviationReportQueryForTests(
  query: ListBodCodDeviationReportsQuery,
  access: BodCodDeviationAccess,
) {
  return buildReportQuery(query, access);
}

export function buildBodCodDeviationLatestReportSlotMapForTests(reports: LatestReportRow[]) {
  return buildLatestReportSlotMap(reports);
}

export function buildBodCodDeviationReportDetailQueryForTests(
  id: number,
  access: BodCodDeviationAccess,
) {
  return buildReportDetailQuery(id, access);
}

export function buildBodCodApprovalStepsForTests(approvalTrack: BodCodApprovalTrack) {
  return approvalStepsForTrack(approvalTrack);
}

export function buildBodCodCreateAccessQueryForTests(
  input: Pick<CreateBodCodDeviationReportDTO, 'factoryId' | 'factoryRegistrationNo'>,
  access: CreateBodCodDeviationReportAccess,
) {
  return buildCreateAccessQuery(input, access);
}

export function buildBodCodFactoryInternalIdQueryForTests(
  input: Pick<CreateBodCodDeviationReportDTO, 'factoryId' | 'factoryRegistrationNo'>,
  access: CreateBodCodDeviationReportAccess,
) {
  return buildCreateAccessQuery(input, access);
}

export function buildBodCodResubmissionAccessQueryForTests(
  id: number,
  access: CreateBodCodDeviationReportAccess,
) {
  return buildEditableReportQuery(id, access);
}

export function buildBodCodReportStatusLabelForTests(
  status: BodCodDeviationReportStatus,
  scope?: string | null,
) {
  return reportStatusLabel(status, scope);
}

export function buildBodCodStatusHistoryForTests(
  reportRows: StatusHistoryReportRow[],
  eventRows: ApprovalEventRow[],
  scope?: string | null,
) {
  return buildStatusHistoryByReportId(reportRows, eventRows, scope);
}

export function buildBodCodAllowedActionsForTests(
  status: BodCodDeviationReportStatus,
  currentStep: BodCodWorkflowStepDTO | null,
  scope?: string | null,
) {
  return allowedActionsFor(status, currentStep, scope);
}

export function buildBodCodNextWorkflowStateForTests(
  action: BodCodWorkflowAction,
  hasNextStep: boolean,
) {
  return nextWorkflowState(action, hasNextStep);
}

export function buildBodCodResubmissionWorkflowResetQueriesForTests(reportId: number, now: Date) {
  return {
    resetAllSteps: buildResetApprovalStepsForResubmissionQuery(reportId, now),
    restartFirstStep: buildRestartFirstApprovalStepForResubmissionQuery(reportId, now),
  };
}

function buildFactoryQuery(
  access: BodCodDeviationAccess,
): Knex.QueryBuilder<FactoryTableRow, FactoryTableRow[]> {
  const builder = db<FactoryTableRow>('cems_wpms_connected_measurement_points as cp')
    .leftJoin('factories as f', function joinPomsFactory() {
      this.on('f.fid', '=', 'cp.factory_id')
        .orOn('f.code', '=', 'cp.factory_id')
        .orOn('f.code', '=', 'cp.factory_registration_no');
    })
    .leftJoin('provinces as p', 'p.id', 'f.province_id')
    .leftJoin('industrial_estates as ie', 'ie.id', 'f.industrial_estate_id')
    .leftJoin('eligible_factories as ef', function joinEligibleFactory() {
      this.on(function joinFactoryKeys() {
        this.on('ef.factory_registration_no_new', '=', 'cp.factory_registration_no')
          .orOn('ef.factory_registration_no_new', '=', 'cp.factory_id')
          .orOn('ef.source_factory_id', '=', 'cp.factory_id')
          .orOn('ef.source_factory_id', '=', 'f.fid')
          .orOn('ef.factory_registration_no_new', '=', 'f.code');
      }).andOnNull('ef.deleted_at');
    })
    .whereNull('cp.deleted_at')
    .select(
      'cp.id as connected_point_id',
      'cp.source_request_id',
      'cp.source_measurement_point_id',
      'cp.factory_id',
      'cp.factory_name',
      'cp.factory_registration_no',
      'cp.factory_address',
      'cp.point_code',
      'cp.point_name',
      'cp.point_type',
      'cp.system_type',
      'cp.parameters_json',
      'cp.connected_at',
      'f.id as poms_factory_id',
      'f.fid as factory_fid',
      'f.code as factory_code',
      'f.system_detail as factory_system_detail',
      'p.name_th as province_name',
      'p.region as province_region',
      'ie.name_th as industrial_estate_name',
      'ef.factory_registration_no_old',
      'ef.address',
      'ef.business_activity',
      'ef.id as eligible_factory_id',
    )
    .orderBy('cp.factory_name', 'asc')
    .orderBy('cp.factory_id', 'asc')
    .orderBy('cp.point_code', 'asc')
    .orderBy('cp.point_name', 'asc');

  applyFactoryAccessFilter(builder, access);
  applyRegionalAccessFilter(builder, access.regionalAccess);

  return builder as unknown as Knex.QueryBuilder<FactoryTableRow, FactoryTableRow[]>;
}

function buildReportQuery(
  query: ListBodCodDeviationReportsQuery,
  access: BodCodDeviationAccess,
): Knex.QueryBuilder<ReportTableRow, ReportTableRow[]> {
  const measurementCounts = db('bod_cod_deviation_measurements')
    .whereNull('deleted_at')
    .select('report_id')
    .count<{ report_id: number | string; measurement_count: number | string }[]>({
      measurement_count: '*',
    })
    .groupBy('report_id')
    .as('m');

  const builder = db<ReportTableRow>('bod_cod_deviation_reports as r')
    .leftJoin('factories as f', function joinReportFactory() {
      this.on('f.id', '=', 'r.factory_id')
        .orOn('f.fid', '=', 'r.factory_registration_no')
        .orOn('f.code', '=', 'r.factory_registration_no');
    })
    .leftJoin('provinces as p', 'p.name_th', 'r.province_name')
    .leftJoin('users as cu', 'cu.id', 'r.created_by')
    .leftJoin(measurementCounts, 'm.report_id', 'r.id')
    .whereNull('r.deleted_at')
    .select(
      'r.id',
      'r.report_no',
      'r.report_round',
      'r.report_year',
      'r.factory_id',
      'r.connected_measurement_point_id',
      'r.point_code',
      'r.point_name',
      'f.fid as factory_fid',
      'r.factory_name',
      'r.factory_registration_no',
      'r.province_name',
      'r.approval_track',
      'r.selected_parameter_code',
      'r.status',
      'r.submitted_at',
      'r.created_by',
      'cu.username as created_by_username',
      'cu.prename_th as created_by_prename_th',
      'cu.first_name as created_by_first_name',
      'cu.last_name as created_by_last_name',
      'r.created_at',
      'r.updated_at',
      'm.measurement_count',
    );

  if (query.status) builder.where('r.status', query.status);
  if (query.parameterCode) builder.where('r.selected_parameter_code', query.parameterCode);
  if (query.factoryId) {
    const factoryId = query.factoryId;
    builder.where((factoryBuilder) => {
      factoryBuilder
        .where('r.factory_id', factoryId)
        .orWhere('f.fid', factoryId)
        .orWhere('f.code', factoryId)
        .orWhere('r.factory_registration_no', factoryId);
    });
  }

  applyReportAccessFilter(builder, access);
  applyRegionalAccessFilter(builder, access.regionalAccess);

  return builder as unknown as Knex.QueryBuilder<ReportTableRow, ReportTableRow[]>;
}

function buildReportDetailQuery(
  id: number,
  access: BodCodDeviationAccess,
): Knex.QueryBuilder<ReportDetailRow, ReportDetailRow[]> {
  const builder = buildReportQuery({}, access)
    .where('r.id', id)
    .select(
      'r.business_activity',
      'r.address',
      'r.wastewater_flow_m3_per_hour',
      'r.sampler_name',
      'r.officer_registration_no',
      'r.laboratory_name',
      'r.laboratory_registration_no',
      'r.lab_report_no',
      'r.analysis_method',
      'r.device_brand',
      'r.device_model',
      'r.device_serial_no',
      'r.reporter_name',
      'r.reporter_position',
    );

  return builder as unknown as Knex.QueryBuilder<ReportDetailRow, ReportDetailRow[]>;
}

function buildCreateAccessQuery(
  input: Pick<CreateBodCodDeviationReportDTO, 'factoryId' | 'factoryRegistrationNo'>,
  access: CreateBodCodDeviationReportAccess,
  connection: Knex | Knex.Transaction = db,
): Knex.QueryBuilder {
  const builder = connection('factories as f').select('f.id').first();
  if (access.scope === 'OWN_FACTORY') {
    builder
      .join('user_juristics as uj', 'uj.juristic_id', 'f.juristic_id')
      .where('uj.user_id', access.actorUserId)
      .whereNull('uj.revoked_at');
  }
  builder.where((factoryBuilder) => {
    const factoryId = input.factoryId ?? '';
    const numericFactoryId = numericIdOrNull(factoryId);
    if (numericFactoryId !== null) factoryBuilder.orWhere('f.id', numericFactoryId);
    if (factoryId) {
      factoryBuilder.orWhere('f.fid', factoryId).orWhere('f.code', factoryId);
    }
    factoryBuilder
      .orWhere('f.fid', input.factoryRegistrationNo)
      .orWhere('f.code', input.factoryRegistrationNo);
  });
  return builder;
}

async function resolveFactoryInternalId(
  input: CreateBodCodDeviationReportDTO,
  access: CreateBodCodDeviationReportAccess,
  trx: Knex.Transaction,
): Promise<number | null> {
  const row = await buildCreateAccessQuery(input, access, trx);
  if (!row) {
    if (access.scope === 'OWN_FACTORY') {
      throw new ForbiddenError('Factory is not available for this user');
    }
    return null;
  }
  return toNumberOrNull((row as { id?: number | string | null }).id ?? null);
}

async function assertCanResubmitReport(
  id: number,
  input: ResubmitBodCodDeviationReportDTO,
  access: CreateBodCodDeviationReportAccess,
  trx: Knex.Transaction,
): Promise<EditableReportRow> {
  if (access.scope !== 'OWN_FACTORY') {
    throw new ForbiddenError('Only own-factory operators can resubmit BOD/COD reports');
  }

  const row = await buildEditableReportQuery(id, access, trx).first();
  if (!row) throw new NotFoundError('BOD/COD deviation report not found');
  if (row.status !== 'REVISION_REQUESTED') {
    throw new ConflictError(
      'BOD/COD deviation report can be resubmitted only after revision is requested',
      {
        currentStatus: row.status,
        requiredStatus: 'REVISION_REQUESTED',
      },
    );
  }
  if (row.current_step_status !== 'REVISION_REQUESTED' || row.current_step_id === null) {
    throw new ConflictError('BOD/COD deviation report does not have a current revision step');
  }
  assertResubmissionIdentityMatches(row, input);
  return row;
}

async function assertCanChangeWorkflowStatus(
  id: number,
  input: ChangeBodCodWorkflowStatusDTO,
  access: BodCodDeviationAccess,
  trx: Knex.Transaction,
): Promise<EditableReportRow> {
  const row = await buildEditableReportQuery(id, access, trx).first();
  if (!row) throw new NotFoundError('BOD/COD deviation report not found');

  const currentStep = editableCurrentStep(row);
  const allowedActions = allowedActionsFor(row.status, currentStep, access.scope);
  if (!allowedActions.includes(input.action)) {
    throw new ConflictError('BOD/COD workflow action is not allowed for current status', {
      currentStatus: row.status,
      currentStepStatus: row.current_step_status,
      allowedActions,
    });
  }

  if (row.current_step_id === null || row.current_step_no === null) {
    throw new ConflictError('BOD/COD deviation report does not have a current approval step', {
      currentStatus: row.status,
      allowedActions,
    });
  }

  return row;
}

function editableCurrentStep(row: EditableReportRow): BodCodWorkflowStepDTO | null {
  if (row.current_step_no === null || row.current_step_status === null) return null;
  const currentStepId = toNumberOrNull(row.current_step_id);
  return {
    ...(currentStepId === null ? {} : { id: currentStepId }),
    stepNo: Number(row.current_step_no),
    roleCode: 'INSPECTOR',
    roleLabel: '',
    status: row.current_step_status,
    isCurrent: true,
  };
}

function buildEditableReportQuery(
  id: number,
  access: CreateBodCodDeviationReportAccess,
  connection: Knex | Knex.Transaction = db,
): Knex.QueryBuilder<EditableReportRow, EditableReportRow[]> {
  const builder = connection<EditableReportRow>('bod_cod_deviation_reports as r')
    .leftJoin('factories as f', function joinReportFactory() {
      this.on('f.id', '=', 'r.factory_id')
        .orOn('f.fid', '=', 'r.factory_registration_no')
        .orOn('f.code', '=', 'r.factory_registration_no');
    })
    .leftJoin('provinces as p', 'p.name_th', 'r.province_name')
    .leftJoin('bod_cod_approval_steps as s', function joinCurrentStep() {
      this.on('s.report_id', '=', 'r.id')
        .andOn('s.is_current', '=', db.raw('?', [true]))
        .andOnNull('s.deleted_at');
    })
    .where('r.id', id)
    .whereNull('r.deleted_at')
    .select(
      'r.id',
      'r.report_no',
      'r.report_round',
      'r.report_year',
      'r.factory_id',
      'r.connected_measurement_point_id',
      'r.point_code',
      'r.point_name',
      'f.fid as factory_fid',
      'r.factory_name',
      'r.factory_registration_no',
      'r.province_name',
      'r.approval_track',
      'r.selected_parameter_code',
      'r.status',
      'r.submitted_at',
      'r.created_at',
      'r.updated_at',
      'r.business_activity',
      'r.address',
      'r.wastewater_flow_m3_per_hour',
      'r.sampler_name',
      'r.officer_registration_no',
      'r.laboratory_name',
      'r.laboratory_registration_no',
      'r.lab_report_no',
      'r.analysis_method',
      'r.device_brand',
      'r.device_model',
      'r.device_serial_no',
      'r.reporter_name',
      'r.reporter_position',
      's.id as current_step_id',
      's.step_no as current_step_no',
      's.status as current_step_status',
    );

  applyReportAccessFilter(builder, access);
  applyRegionalAccessFilter(builder, access.regionalAccess);

  return builder as unknown as Knex.QueryBuilder<EditableReportRow, EditableReportRow[]>;
}

function assertResubmissionIdentityMatches(
  row: EditableReportRow,
  input: ResubmitBodCodDeviationReportDTO,
): void {
  const mismatches = [
    [Number(row.report_round) !== input.reportRoundNo, 'reportRoundNo'],
    [Number(row.report_year) !== input.reportYear, 'reportYear'],
    [row.factory_registration_no !== input.factoryRegistrationNo, 'factoryRegistrationNo'],
    [
      toNumberOrNull(row.connected_measurement_point_id) !==
        (input.connectedMeasurementPointId ?? null),
      'connectedMeasurementPointId',
    ],
    [(row.point_code ?? null) !== (input.pointCode ?? null), 'pointCode'],
    [row.selected_parameter_code !== input.selectedParameterCode, 'selectedParameterCode'],
  ]
    .filter(([isMismatch]) => isMismatch)
    .map(([, field]) => field);

  if (mismatches.length > 0) {
    throw new ConflictError(
      'BOD/COD report identity fields cannot be changed during resubmission',
      {
        fields: mismatches,
      },
    );
  }
}

async function softReplaceMeasurements(
  reportId: number,
  input: ResubmitBodCodDeviationReportDTO,
  now: Date,
  trx: Knex.Transaction,
): Promise<void> {
  await trx('bod_cod_deviation_measurements')
    .where('report_id', reportId)
    .whereNull('deleted_at')
    .update({ deleted_at: now, updated_at: now });

  await trx('bod_cod_deviation_measurements').insert(
    input.measurements.map((measurement, index) => {
      const deviationValue = measurement.deviceValueMgL - measurement.labValueMgL;
      const standard = measurement.standardDeviationMgL ?? null;
      return {
        report_id: reportId,
        parameter_code: input.selectedParameterCode,
        sample_date: measurement.sampleDate,
        sample_time: measurement.sampleTime,
        device_value_mg_l: measurement.deviceValueMgL,
        lab_value_mg_l: measurement.labValueMgL,
        standard_deviation_mg_l: standard,
        is_within_standard: standard === null ? null : Math.abs(deviationValue) <= standard,
        sort_order: index + 1,
        created_at: now,
        updated_at: now,
      };
    }),
  );
}

async function softReplaceAttachments(
  reportId: number,
  input: ResubmitBodCodDeviationReportDTO,
  actorUserId: number,
  now: Date,
  trx: Knex.Transaction,
): Promise<void> {
  await trx('bod_cod_deviation_attachments')
    .where('report_id', reportId)
    .whereNull('deleted_at')
    .update({ deleted_at: now, updated_at: now });

  if (input.attachments.length === 0) return;

  await trx('bod_cod_deviation_attachments').insert(
    input.attachments.map((attachment) => ({
      report_id: reportId,
      attachment_type: attachment.attachmentType,
      original_file_name: attachment.originalFileName,
      stored_file_name: attachment.storedFileName ?? null,
      mime_type: attachment.mimeType ?? null,
      file_size: attachment.fileSize ?? null,
      storage_path: attachment.storagePath ?? null,
      uploaded_by: actorUserId,
      uploaded_at: now,
      created_at: now,
      updated_at: now,
    })),
  );
}

async function resetApprovalStepsForResubmission(
  reportId: number,
  now: Date,
  trx: Knex.Transaction,
): Promise<void> {
  await buildResetApprovalStepsForResubmissionQuery(reportId, now, trx);
  await buildRestartFirstApprovalStepForResubmissionQuery(reportId, now, trx);
}

function buildResetApprovalStepsForResubmissionQuery(
  reportId: number,
  now: Date,
  connection: Knex | Knex.Transaction = db,
): Knex.QueryBuilder {
  return connection('bod_cod_approval_steps')
    .where('report_id', reportId)
    .whereNull('deleted_at')
    .update({
      status: 'WAITING',
      is_current: false,
      actor_user_id: null,
      actor_name: null,
      actor_position: null,
      decision: null,
      comment: null,
      decided_at: null,
      updated_at: now,
    });
}

function buildRestartFirstApprovalStepForResubmissionQuery(
  reportId: number,
  now: Date,
  connection: Knex | Knex.Transaction = db,
): Knex.QueryBuilder {
  return connection('bod_cod_approval_steps')
    .where('report_id', reportId)
    .where('step_no', 1)
    .whereNull('deleted_at')
    .update({
      status: 'PENDING',
      is_current: true,
      updated_at: now,
    });
}

async function findNextApprovalStep(
  reportId: number,
  currentStepNo: number,
  trx: Knex.Transaction,
): Promise<Pick<ApprovalStepRow, 'id' | 'step_no'> | null> {
  const row = await trx<ApprovalStepRow>('bod_cod_approval_steps')
    .where('report_id', reportId)
    .where('step_no', '>', currentStepNo)
    .whereNull('deleted_at')
    .select('id', 'step_no')
    .orderBy('step_no', 'asc')
    .first();
  return row ?? null;
}

function nextWorkflowState(
  action: BodCodWorkflowAction,
  hasNextStep: boolean,
): {
  currentStepStatus: BodCodApprovalStepStatus;
  nextStepStatus: BodCodApprovalStepStatus | null;
  reportStatus: BodCodDeviationReportStatus;
  closesWorkflow: boolean;
} {
  if (action === 'REQUEST_REVISION') {
    return {
      currentStepStatus: 'REVISION_REQUESTED',
      nextStepStatus: null,
      reportStatus: 'REVISION_REQUESTED',
      closesWorkflow: false,
    };
  }
  if (action === 'REJECT') {
    return {
      currentStepStatus: 'REJECTED',
      nextStepStatus: null,
      reportStatus: 'REJECTED',
      closesWorkflow: true,
    };
  }
  return hasNextStep
    ? {
        currentStepStatus: 'APPROVED',
        nextStepStatus: 'PENDING',
        reportStatus: 'WAITING_APPROVAL',
        closesWorkflow: false,
      }
    : {
        currentStepStatus: 'APPROVED',
        nextStepStatus: null,
        reportStatus: 'APPROVED',
        closesWorkflow: true,
      };
}

function workflowActionNote(input: ChangeBodCodWorkflowStatusDTO): string | null {
  return input.action === 'REQUEST_REVISION'
    ? (input.revisionReason ?? null)
    : (input.officerNote ?? null);
}

async function updateCurrentApprovalStep(
  stepId: number,
  status: BodCodApprovalStepStatus,
  note: string | null,
  access: BodCodDeviationAccess,
  now: Date,
  trx: Knex.Transaction,
): Promise<void> {
  await trx('bod_cod_approval_steps')
    .where('id', stepId)
    .update({
      status,
      is_current: status === 'REVISION_REQUESTED',
      actor_user_id: access.actorUserId,
      decision: status,
      comment: note,
      decided_at: now,
      updated_at: now,
    });
}

async function markNextApprovalStepCurrent(
  stepId: number,
  status: BodCodApprovalStepStatus,
  now: Date,
  trx: Knex.Transaction,
): Promise<void> {
  await trx('bod_cod_approval_steps').where('id', stepId).update({
    status,
    is_current: true,
    updated_at: now,
  });
}

async function insertApprovalEvent(
  reportId: number,
  action: BodCodApprovalEventAction,
  actorUserId: number,
  note: string | null | undefined,
  now: Date,
  trx: Knex.Transaction,
): Promise<void> {
  await trx('bod_cod_approval_events').insert({
    report_id: reportId,
    action,
    actor_user_id: actorUserId,
    note: note ?? null,
    created_at: now,
  });
}

function applyFactoryAccessFilter(builder: Knex.QueryBuilder, access: BodCodDeviationAccess): void {
  if (access.scope !== 'OWN_FACTORY') return;
  builder
    .join('user_juristics as uj', 'uj.juristic_id', 'f.juristic_id')
    .where('uj.user_id', access.actorUserId)
    .whereNull('uj.revoked_at');
}

function applyReportAccessFilter(builder: Knex.QueryBuilder, access: BodCodDeviationAccess): void {
  if (access.scope !== 'OWN_FACTORY') return;
  builder
    .join('user_juristics as uj', 'uj.juristic_id', 'f.juristic_id')
    .where('uj.user_id', access.actorUserId)
    .whereNull('uj.revoked_at');
}

function applyRegionalAccessFilter(
  builder: Knex.QueryBuilder,
  regionalAccess: BodCodDeviationAccess['regionalAccess'],
): void {
  const regions = [
    ...new Set((regionalAccess?.regions ?? []).map((region) => region.trim())),
  ].filter(Boolean);
  if (regions.length === 0) return;
  builder.whereIn('p.region', regions);
}

async function listCurrentYearReportsForConnectedPoints(
  rows: FactoryTableRow[],
  year: number,
): Promise<LatestReportRow[]> {
  const pointIds = rows
    .map((row) => row.connected_point_id)
    .filter((id): id is number | string => id !== null);
  const pointCodes = rows
    .map((row) => row.point_code)
    .filter((code): code is string => Boolean(code));
  if (pointIds.length === 0 && pointCodes.length === 0) return [];

  return db<LatestReportRow>('bod_cod_deviation_reports')
    .whereNull('deleted_at')
    .where('report_year', year)
    .where((builder) => {
      if (pointIds.length > 0) builder.whereIn('connected_measurement_point_id', pointIds);
      if (pointCodes.length > 0) builder.orWhereIn('point_code', pointCodes);
    })
    .select(
      'factory_id',
      'connected_measurement_point_id',
      'point_code',
      'factory_registration_no',
      'report_round',
      'report_year',
      'id as report_id',
      'report_no',
      'status',
    )
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');
}

function toConnectedFactoryDTOs(
  rows: FactoryTableRow[],
  reportBySlotKey: Map<string, LatestReportRow>,
  year: number,
  scope: string | null | undefined,
): BodCodDeviationFactoryTableRowDTO[] {
  const factories = new Map<
    string,
    { firstRow: FactoryTableRow; points: BodCodConnectedMeasurementPointDTO[] }
  >();

  for (const row of rows) {
    const factoryId = connectedFactoryId(row);
    const current = factories.get(factoryId) ?? { firstRow: row, points: [] };
    const reportSlots = buildReportSlots(row, reportBySlotKey, year, scope);
    const parameterCodes = parseParameters(row.parameters_json);
    current.points = [
      ...current.points,
      {
        id: Number(row.connected_point_id),
        stationId: row.point_code ?? row.point_name,
        code: row.point_code,
        name: row.point_name,
        type: row.system_type,
        parameters: parameterCodes.join(', '),
        parameterCodes,
        round1Status: reportSlots[0]?.statusLabel ?? 'ยังไม่ยื่น',
        round2Status: reportSlots[1]?.statusLabel ?? 'ยังไม่ยื่น',
        pointCode: row.point_code,
        pointName: row.point_name,
        pointType: row.point_type,
        systemType: row.system_type,
        reportSlots,
      },
    ];
    factories.set(factoryId, current);
  }

  return [...factories.entries()].map(([factoryId, factory]) =>
    toFactoryDTO(factoryId, factory.firstRow, factory.points),
  );
}

function buildReportSlots(
  row: FactoryTableRow,
  reportBySlotKey: Map<string, LatestReportRow>,
  year: number,
  scope: string | null | undefined,
): BodCodReportSlotDTO[] {
  return ([1, 2] as const).map((roundNo) => {
    const report =
      reportBySlotKey.get(reportSlotKey(row.connected_point_id, roundNo)) ??
      reportBySlotKey.get(reportSlotKey(row.point_code, roundNo));
    return {
      roundNo,
      year,
      status: report?.status ?? 'NOT_SUBMITTED',
      statusLabel: report ? reportStatusLabel(report.status, scope) : 'ยังไม่ยื่น',
      reportId: toNumberOrNull(report?.report_id ?? null),
      reportNo: report?.report_no ?? null,
    };
  });
}

function buildLatestReportSlotMap(reports: LatestReportRow[]): Map<string, LatestReportRow> {
  const reportBySlotKey = new Map<string, LatestReportRow>();
  for (const report of reports) {
    for (const key of reportSlotKeysForReport(report)) {
      if (!reportBySlotKey.has(key)) {
        reportBySlotKey.set(key, report);
      }
    }
  }
  return reportBySlotKey;
}

async function nextReportNo(reportYear: number, trx: Knex.Transaction): Promise<string> {
  const row = await trx('bod_cod_deviation_reports')
    .where('report_year', reportYear)
    .count<{ total: number | string }>('id as total')
    .first();
  const nextSequence = Number(row?.total ?? 0) + 1;
  return `BODCOD-${reportYear}-${String(nextSequence).padStart(4, '0')}`;
}

function approvalTrackForProvince(provinceName: string): BodCodApprovalTrack {
  return provinceName.trim() === 'กรุงเทพมหานคร' ? 'CENTRAL' : 'REGIONAL';
}

function approvalStepsForTrack(
  approvalTrack: BodCodApprovalTrack,
): Array<Pick<BodCodWorkflowStepDTO, 'stepNo' | 'roleCode' | 'roleLabel'>> {
  if (approvalTrack === 'CENTRAL') {
    return [
      { stepNo: 1, roleCode: 'INSPECTOR', roleLabel: 'เจ้าหน้าที่กฝม.' },
      { stepNo: 2, roleCode: 'REVIEWER', roleLabel: 'ผอ.กฝม. (ทบทวน)' },
      { stepNo: 3, roleCode: 'APPROVER', roleLabel: 'ผอ.กวภ. (อนุมัติ)' },
    ];
  }
  return [
    { stepNo: 1, roleCode: 'INSPECTOR', roleLabel: 'เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์' },
    { stepNo: 2, roleCode: 'APPROVER', roleLabel: 'ผอ.ศูนย์ (อนุมัติ)' },
  ];
}

function approvalStepRoleLabel(approvalTrack: BodCodApprovalTrack, stepNo: number): string | null {
  return (
    approvalStepsForTrack(approvalTrack).find((step) => step.stepNo === stepNo)?.roleLabel ?? null
  );
}

async function listMeasurements(reportId: number): Promise<BodCodDeviationMeasurementDTO[]> {
  const rows = await db<MeasurementRow>('bod_cod_deviation_measurements')
    .where('report_id', reportId)
    .whereNull('deleted_at')
    .select(
      'id',
      'parameter_code',
      'sample_date',
      'sample_time',
      'device_value_mg_l',
      'lab_value_mg_l',
      'deviation_value_mg_l',
      'standard_deviation_mg_l',
      'is_within_standard',
      'sort_order',
    )
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc');
  return rows.map(toMeasurementDTO);
}

async function listAttachments(
  reportId: number,
  access: BodCodDeviationAccess,
): Promise<BodCodDeviationAttachmentDTO[]> {
  const rows = await db<AttachmentRow>('bod_cod_deviation_attachments')
    .where('report_id', reportId)
    .whereNull('deleted_at')
    .select(
      'id',
      'attachment_type',
      'original_file_name',
      'stored_file_name',
      'mime_type',
      'file_size',
      'storage_path',
    )
    .orderBy('id', 'asc');
  return rows.map((row) => toAttachmentDTO(row, access));
}

async function listApprovalSteps(
  reportId: number,
  connection: Knex | Knex.Transaction = db,
): Promise<BodCodWorkflowStepDTO[]> {
  const rows = await connection<ApprovalStepRow>('bod_cod_approval_steps')
    .where('report_id', reportId)
    .whereNull('deleted_at')
    .select(
      'id',
      'step_no',
      'track',
      'role_code',
      'role_label',
      'status',
      'actor_user_id',
      'actor_name',
      'actor_position',
      'decision',
      'comment',
      'decided_at',
      'is_current',
    )
    .orderBy('step_no', 'asc');
  return rows.map(toApprovalStepDTO);
}

async function listStatusHistoryForReports(
  reportRows: StatusHistoryReportRow[],
  scope?: string | null,
): Promise<Map<number, BodCodStatusHistoryDTO[]>> {
  if (reportRows.length === 0) return new Map();

  const rows = await db<ApprovalEventRow>('bod_cod_approval_events as e')
    .leftJoin('users as u', 'u.id', 'e.actor_user_id')
    .whereIn(
      'e.report_id',
      reportRows.map((row) => row.id),
    )
    .select(
      'e.id',
      'e.report_id',
      'e.action',
      'e.note',
      'e.actor_user_id',
      'u.username as actor_username',
      'u.prename_th as actor_prename_th',
      'u.first_name as actor_first_name',
      'u.last_name as actor_last_name',
      'e.created_at',
    )
    .orderBy('e.report_id', 'asc')
    .orderBy('e.created_at', 'asc')
    .orderBy('e.id', 'asc');

  return buildStatusHistoryByReportId(reportRows, rows, scope);
}

function toFactoryDTO(
  factoryId: string,
  row: FactoryTableRow,
  measurementPoints: BodCodConnectedMeasurementPointDTO[],
): BodCodDeviationFactoryTableRowDTO {
  const latestSlot = measurementPoints
    .flatMap((point) => point.reportSlots)
    .find((slot) => slot.reportId !== null);
  return {
    id: factoryId,
    factoryId,
    factoryName: row.factory_name,
    factoryRegistration: row.factory_registration_no,
    newRegistrationNo: row.factory_registration_no,
    oldRegistrationNo: row.factory_registration_no_old,
    industryType: row.business_activity ?? row.factory_system_detail,
    province: row.province_name,
    provinceName: row.province_name,
    regionName: row.province_region,
    industrialEstateName: row.industrial_estate_name,
    address: row.address ?? row.factory_address,
    eligibleFactoryId: toNumberOrNull(row.eligible_factory_id),
    monitoringPointCount: measurementPoints.length,
    measurementPoints,
    latestReportId: latestSlot?.reportId ?? null,
    latestReportNo: latestSlot?.reportNo ?? null,
    latestReportStatus:
      latestSlot?.status === 'NOT_SUBMITTED' ? null : (latestSlot?.status ?? null),
    latestReportStatusLabel:
      latestSlot?.status === 'NOT_SUBMITTED' ? null : (latestSlot?.statusLabel ?? null),
  };
}

function toReportDTO(
  row: ReportTableRow,
  scope: string | null | undefined,
  statusHistory: BodCodStatusHistoryDTO[],
): BodCodDeviationReportTableRowDTO {
  const reportRoundNo = Number(row.report_round);
  const statusLabel = reportStatusLabel(row.status, scope);
  return {
    id: Number(row.id),
    reportNo: row.report_no,
    reportRound: reportRoundLabel(reportRoundNo),
    reportRoundNo,
    reportYear: Number(row.report_year),
    year: Number(row.report_year),
    selectedParameterCode: row.selected_parameter_code,
    selectedParameterLabel: parameterLabel(row.selected_parameter_code),
    factoryId: row.factory_fid ?? (row.factory_id == null ? null : String(row.factory_id)),
    factoryName: row.factory_name,
    factoryRegistration: row.factory_registration_no,
    factoryRegistrationNo: row.factory_registration_no,
    monitoringPointId: toNumberOrNull(row.connected_measurement_point_id),
    monitoringPointCode: row.point_code,
    monitoringPointName: row.point_name,
    province: row.province_name,
    provinceName: row.province_name,
    approvalTrack: row.approval_track,
    status: statusLabel,
    statusCode: row.status,
    statusLabel,
    submittedDate: formatThaiDate(row.submitted_at),
    reviewedDate: reviewedDateLabel(row.status, row.updated_at),
    submittedAt: toDateTimeString(row.submitted_at),
    createdAt: toDateTimeString(row.created_at) ?? '',
    updatedAt: toDateTimeString(row.updated_at) ?? '',
    measurementCount: Number(row.measurement_count ?? 0),
    statusHistory,
  };
}

function toReportDetailDTO(
  row: ReportDetailRow,
  measurements: BodCodDeviationMeasurementDTO[],
  attachments: BodCodDeviationAttachmentDTO[],
  steps: BodCodWorkflowStepDTO[],
  statusHistory: BodCodStatusHistoryDTO[],
  scope: string | null | undefined,
): BodCodDeviationReportDetailDTO {
  const base = toReportDTO(row, scope, statusHistory);
  const currentStep = currentWorkflowStep(steps);
  return {
    ...base,
    businessActivity: row.business_activity,
    factoryAddress: row.address,
    wastewaterFlowM3PerHour: toNumberOrNull(row.wastewater_flow_m3_per_hour),
    samplerName: row.sampler_name,
    officerRegistrationNo: row.officer_registration_no,
    laboratoryName: row.laboratory_name,
    laboratoryRegistrationNo: row.laboratory_registration_no,
    labReportNo: row.lab_report_no,
    analysisMethod: row.analysis_method,
    deviceBrand: row.device_brand,
    deviceModel: row.device_model,
    deviceSerialNo: row.device_serial_no,
    reporterName: row.reporter_name,
    reporterPosition: row.reporter_position,
    approvalTrack: row.approval_track,
    currentStep,
    steps,
    allowedActions: allowedActionsFor(row.status, currentStep, scope),
    measurements,
    attachments,
  };
}

function toMeasurementDTO(row: MeasurementRow): BodCodDeviationMeasurementDTO {
  return {
    id: Number(row.id),
    parameterCode: row.parameter_code,
    sampleDate: toDateOnlyString(row.sample_date),
    sampleTime: toTimeString(row.sample_time),
    deviceValueMgL: Number(row.device_value_mg_l),
    labValueMgL: Number(row.lab_value_mg_l),
    deviationValueMgL: Number(row.deviation_value_mg_l),
    standardDeviationMgL: toNumberOrNull(row.standard_deviation_mg_l),
    isWithinStandard: row.is_within_standard === null ? null : Boolean(row.is_within_standard),
    sortOrder: Number(row.sort_order),
  };
}

function toAttachmentDTO(
  row: AttachmentRow,
  access: BodCodDeviationAccess,
): BodCodDeviationAttachmentDTO {
  return {
    id: Number(row.id),
    attachmentType: row.attachment_type,
    originalFileName: row.original_file_name,
    storedFileName: row.stored_file_name,
    mimeType: row.mime_type,
    fileSize: toNumberOrNull(row.file_size),
    storagePath: row.storage_path,
    fileUrl:
      row.storage_path && access.publicBaseUrl && access.publicPath
        ? buildPublicFileUrl(access.publicBaseUrl, access.publicPath, row.storage_path)
        : null,
  };
}

function toApprovalStepDTO(row: ApprovalStepRow): BodCodWorkflowStepDTO {
  return {
    id: Number(row.id),
    stepNo: Number(row.step_no),
    roleCode: row.role_code,
    roleLabel: approvalStepRoleLabel(row.track, Number(row.step_no)) ?? row.role_label,
    status: row.status,
    actorUserId: toNumberOrNull(row.actor_user_id),
    actorName: row.actor_name,
    actorPosition: row.actor_position,
    decision: row.decision,
    comment: row.comment,
    decidedAt: toDateTimeString(row.decided_at),
    isCurrent: Boolean(row.is_current),
  };
}

function currentWorkflowStep(steps: BodCodWorkflowStepDTO[]): BodCodWorkflowStepDTO | null {
  return steps.find((step) => step.isCurrent) ?? null;
}

function allowedActionsFor(
  status: BodCodDeviationReportStatus,
  currentStep: BodCodWorkflowStepDTO | null,
  scope: string | null | undefined,
): BodCodAllowedAction[] {
  if (status === 'APPROVED' || status === 'REJECTED' || status === 'CANCELLED') return [];
  if (scope === 'OWN_FACTORY') return ['CANCEL'];
  return currentStep?.status === 'PENDING' ? ['APPROVE', 'REQUEST_REVISION', 'REJECT'] : [];
}

function connectedFactoryId(row: FactoryTableRow): string {
  return row.factory_fid ?? row.factory_id;
}

function reportSlotKey(pointId: number | string | null, roundNo: number | string): string {
  return `${pointId ?? ''}:${roundNo}`;
}

function reportSlotKeysForReport(report: LatestReportRow): string[] {
  return [
    reportSlotKey(report.connected_measurement_point_id, report.report_round),
    reportSlotKey(report.point_code, report.report_round),
  ].filter((key, index, keys) => key !== ':' && keys.indexOf(key) === index);
}

function currentBuddhistYear(): number {
  return new Date().getFullYear() + 543;
}

function parseParameters(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((parameter): parameter is string => typeof parameter === 'string')
      : [];
  } catch {
    return [];
  }
}

function parameterLabel(code: BodCodParameterCode): string {
  return code === 'BOD' ? 'BOD (mg/l)' : 'COD (mg/l)';
}

function reportRoundLabel(roundNo: number): string {
  return `ครั้งที่ ${roundNo}`;
}

function reportStatusLabel(status: BodCodDeviationReportStatus, scope?: string | null): string {
  if (
    scope === 'OWN_FACTORY' &&
    (status === 'SUBMITTED' || status === 'REVISED_PENDING_REVIEW' || status === 'WAITING_APPROVAL')
  ) {
    return 'รอพิจารณา';
  }

  const labels: Record<BodCodDeviationReportStatus, string> = {
    DRAFT: 'แบบร่าง',
    SUBMITTED: 'ส่งรายงานแล้ว',
    REVISED_PENDING_REVIEW: 'แก้ไขแล้ว/รอพิจารณา',
    WAITING_APPROVAL: 'รออนุมัติ',
    APPROVED: 'ผ่านการพิจารณา',
    REJECTED: 'ไม่ผ่านการพิจารณา',
    REVISION_REQUESTED: 'รอโรงงานแก้ไข',
    CANCELLED: 'ยกเลิก',
  };
  return labels[status];
}

function buildStatusHistoryByReportId(
  reportRows: StatusHistoryReportRow[],
  eventRows: ApprovalEventRow[],
  scope?: string | null,
): Map<number, BodCodStatusHistoryDTO[]> {
  const eventsByReportId = eventRows.reduce((map, row) => {
    const reportId = Number(row.report_id);
    const current = map.get(reportId) ?? [];
    map.set(reportId, [...current, row]);
    return map;
  }, new Map<number, ApprovalEventRow[]>());

  return reportRows.reduce((map, reportRow) => {
    const reportId = Number(reportRow.id);
    const rows = eventsByReportId.get(reportId) ?? [];
    const history: BodCodStatusHistoryDTO[] = [
      toSubmittedStatusHistoryDTO(reportRow, scope),
      ...rows.map((row) => toEventStatusHistoryDTO(row, eventStatus(row.action), scope)),
    ];
    map.set(reportId, history);
    return map;
  }, new Map<number, BodCodStatusHistoryDTO[]>());
}

function toSubmittedStatusHistoryDTO(
  row: StatusHistoryReportRow,
  scope?: string | null,
): BodCodStatusHistoryDTO {
  const changedAt = row.submitted_at ?? row.created_at ?? new Date(0);
  return {
    id: Number(row.id),
    status: 'SUBMITTED',
    statusLabel: reportStatusLabel('SUBMITTED', scope),
    note: null,
    changedById: toNumberOrNull(row.created_by),
    changedBy: displayUserName({
      prename: row.created_by_prename_th,
      firstName: row.created_by_first_name,
      lastName: row.created_by_last_name,
      username: row.created_by_username,
    }),
    changedAt: new Date(changedAt).toISOString(),
    changedDate: formatThaiDate(changedAt),
  };
}

function toEventStatusHistoryDTO(
  row: ApprovalEventRow,
  status: BodCodDeviationReportStatus,
  scope?: string | null,
): BodCodStatusHistoryDTO {
  return {
    id: Number(row.id),
    status,
    statusLabel: reportStatusLabel(status, scope),
    note: row.note,
    changedById: toNumberOrNull(row.actor_user_id),
    changedBy: displayUserName({
      prename: row.actor_prename_th,
      firstName: row.actor_first_name,
      lastName: row.actor_last_name,
      username: row.actor_username,
    }),
    changedAt: new Date(row.created_at).toISOString(),
    changedDate: formatThaiDate(row.created_at),
  };
}

function eventStatus(action: BodCodApprovalEventAction): BodCodDeviationReportStatus {
  if (action === 'REQUEST_REVISION') return 'REVISION_REQUESTED';
  if (action === 'RESUBMIT_REVISION') return 'SUBMITTED';
  if (action === 'REJECT') return 'REJECTED';
  return 'APPROVED';
}

function displayUserName(input: {
  prename: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}): string | null {
  const fullName = [input.prename, input.firstName, input.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fullName || input.username;
}

function reviewedDateLabel(status: BodCodDeviationReportStatus, updatedAt: Date | string): string {
  if (status === 'DRAFT' || status === 'SUBMITTED' || status === 'REVISED_PENDING_REVIEW') {
    return '-';
  }
  return formatThaiDate(updatedAt);
}

function formatThaiDate(value: Date | string | null): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

function toNumberOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function numericIdOrNull(value: string | number | null): number | null {
  if (value === null) return null;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function toDateTimeString(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toDateOnlyString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toTimeString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(11, 16);
  return String(value).slice(0, 5);
}
