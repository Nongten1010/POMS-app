import type { RegionalAccessDTO } from '../auth/regional-access';

export const BOD_COD_DEVIATION_REPORT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'WAITING_APPROVAL',
  'APPROVED',
  'REVISION_REQUESTED',
  'CANCELLED',
] as const;

export type BodCodDeviationReportStatus = (typeof BOD_COD_DEVIATION_REPORT_STATUSES)[number];
export type BodCodReportSlotStatus = BodCodDeviationReportStatus | 'NOT_SUBMITTED';
export type BodCodParameterCode = 'BOD' | 'COD';
export type BodCodApprovalTrack = 'CENTRAL' | 'REGIONAL';
export type BodCodApprovalStepStatus = 'PENDING' | 'WAITING' | 'APPROVED' | 'REVISION_REQUESTED';
export type BodCodApprovalRoleCode = 'INSPECTOR' | 'REVIEWER' | 'APPROVER';
export type BodCodAllowedAction = 'CANCEL' | 'START_REVIEW' | 'APPROVE' | 'REQUEST_REVISION';

export interface BodCodDeviationAccess {
  actorUserId: number;
  scope: string | null | undefined;
  regionalAccess?: RegionalAccessDTO | null;
}

export interface ListBodCodDeviationReportsQuery {
  status?: BodCodDeviationReportStatus;
  parameterCode?: BodCodParameterCode;
  factoryId?: string;
}

export interface BodCodDeviationAttachmentInput {
  attachmentType: 'SAMPLE_PHOTO' | 'DEVICE_PHOTO' | 'LAB_REPORT';
  originalFileName: string;
  storedFileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  storagePath?: string | null;
}

export interface BodCodDeviationMeasurementInput {
  sampleDate: string;
  sampleTime: string;
  deviceValueMgL: number;
  labValueMgL: number;
  standardDeviationMgL?: number | null;
}

export interface CreateBodCodDeviationReportDTO {
  reportRoundNo: number;
  reportYear: number;
  factoryId?: string | null;
  factoryName: string;
  factoryRegistrationNo: string;
  businessActivity?: string | null;
  factoryAddress?: string | null;
  provinceName: string;
  connectedMeasurementPointId?: number | null;
  pointCode?: string | null;
  pointName?: string | null;
  wastewaterFlowM3PerHour?: number | null;
  samplerName?: string | null;
  officerRegistrationNo?: string | null;
  laboratoryName?: string | null;
  laboratoryRegistrationNo?: string | null;
  labReportNo?: string | null;
  analysisMethod?: string | null;
  deviceBrand?: string | null;
  deviceModel?: string | null;
  deviceSerialNo?: string | null;
  selectedParameterCode: BodCodParameterCode;
  reporterName?: string | null;
  reporterPosition?: string | null;
  measurements: BodCodDeviationMeasurementInput[];
  attachments: BodCodDeviationAttachmentInput[];
}

export interface ResubmitBodCodDeviationReportDTO extends CreateBodCodDeviationReportDTO {
  revisionNote?: string | null;
}

export interface CreateBodCodDeviationReportAccess extends BodCodDeviationAccess {
  scope: string | null | undefined;
}

export interface BodCodDeviationFactoryTableRowDTO {
  id: string;
  factoryId: string;
  factoryName: string;
  factoryRegistration: string;
  newRegistrationNo: string;
  oldRegistrationNo: string | null;
  industryType: string | null;
  province: string | null;
  provinceName: string | null;
  regionName: string | null;
  industrialEstateName: string | null;
  address: string | null;
  eligibleFactoryId: number | null;
  monitoringPointCount: number;
  measurementPoints: BodCodConnectedMeasurementPointDTO[];
  latestReportId: number | null;
  latestReportNo: string | null;
  latestReportStatus: BodCodDeviationReportStatus | null;
  latestReportStatusLabel: string | null;
}

export interface BodCodReportSlotDTO {
  roundNo: 1 | 2;
  year: number;
  status: BodCodReportSlotStatus;
  statusLabel: string;
  reportId: number | null;
  reportNo: string | null;
}

export interface BodCodConnectedMeasurementPointDTO {
  id: number;
  stationId: string;
  code: string | null;
  name: string;
  type: string;
  parameters: string;
  parameterCodes: string[];
  round1Status: string;
  round2Status: string;
  pointCode: string | null;
  pointName: string;
  pointType: string;
  systemType: string;
  reportSlots: BodCodReportSlotDTO[];
}

export interface BodCodDeviationReportTableRowDTO {
  id: number;
  reportNo: string;
  reportRound: string;
  reportRoundNo: number;
  reportYear: number;
  year: number;
  selectedParameterCode: BodCodParameterCode;
  selectedParameterLabel: string;
  factoryId: string | null;
  factoryName: string;
  factoryRegistration: string;
  factoryRegistrationNo: string;
  monitoringPointId: number | null;
  monitoringPointCode: string | null;
  monitoringPointName: string | null;
  province: string;
  provinceName: string;
  approvalTrack: BodCodApprovalTrack;
  status: string;
  statusCode: BodCodDeviationReportStatus;
  statusLabel: string;
  submittedDate: string;
  reviewedDate: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  measurementCount: number;
}

export interface BodCodDeviationMeasurementDTO {
  id: number;
  parameterCode: BodCodParameterCode;
  sampleDate: string;
  sampleTime: string;
  deviceValueMgL: number;
  labValueMgL: number;
  deviationValueMgL: number;
  standardDeviationMgL: number | null;
  isWithinStandard: boolean | null;
  sortOrder: number;
}

export interface BodCodDeviationAttachmentDTO {
  id: number;
  attachmentType: 'SAMPLE_PHOTO' | 'DEVICE_PHOTO' | 'LAB_REPORT';
  originalFileName: string;
  storedFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  storagePath: string | null;
}

export interface BodCodWorkflowStepDTO {
  id?: number;
  stepNo: number;
  roleCode: BodCodApprovalRoleCode;
  roleLabel: string;
  status: BodCodApprovalStepStatus;
  actorUserId?: number | null;
  actorName?: string | null;
  actorPosition?: string | null;
  decision?: string | null;
  comment?: string | null;
  decidedAt?: string | null;
  isCurrent: boolean;
}

export interface BodCodWorkflowFieldsDTO {
  approvalTrack: BodCodApprovalTrack;
  currentStep: BodCodWorkflowStepDTO | null;
  steps: BodCodWorkflowStepDTO[];
  allowedActions: BodCodAllowedAction[];
}

export interface CreatedBodCodDeviationReportDTO extends BodCodWorkflowFieldsDTO {
  id: number;
  reportNo: string;
  statusCode: BodCodDeviationReportStatus;
}

export interface BodCodDeviationReportDetailDTO
  extends
    BodCodWorkflowFieldsDTO,
    Omit<BodCodDeviationReportTableRowDTO, 'measurementCount' | 'approvalTrack'> {
  businessActivity: string | null;
  factoryAddress: string | null;
  wastewaterFlowM3PerHour: number | null;
  samplerName: string | null;
  officerRegistrationNo: string | null;
  laboratoryName: string | null;
  laboratoryRegistrationNo: string | null;
  labReportNo: string | null;
  analysisMethod: string | null;
  deviceBrand: string | null;
  deviceModel: string | null;
  deviceSerialNo: string | null;
  reporterName: string | null;
  reporterPosition: string | null;
  measurements: BodCodDeviationMeasurementDTO[];
  attachments: BodCodDeviationAttachmentDTO[];
}

export interface PaginatedBodCodDeviationTableRowsDTO<T> {
  data: T[];
  meta: {
    total: number;
  };
}
