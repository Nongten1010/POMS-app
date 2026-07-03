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

export interface PaginatedBodCodDeviationTableRowsDTO<T> {
  data: T[];
  meta: {
    total: number;
  };
}
