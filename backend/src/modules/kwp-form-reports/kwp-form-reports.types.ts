import type { RegionalAccessDTO } from '../auth/regional-access';

export const KWP_FORM_TYPES = ['KWP01', 'KWP02', 'KWP03', 'KWP04', 'KWP05'] as const;
export type KwpFormType = (typeof KWP_FORM_TYPES)[number];

export const KWP_FORM_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'REVISION_REQUESTED',
  'CANCELLED',
] as const;
export type KwpFormStatus = (typeof KWP_FORM_STATUSES)[number];

export interface KwpFormReportAccess {
  actorUserId: number;
  scope: string | null | undefined;
  regionalAccess?: RegionalAccessDTO | null;
}

export interface ListKwpFormRequestsQuery {
  formType?: KwpFormType;
  status?: KwpFormStatus;
  factoryId?: string;
}

export interface KwpFormFactoryTableRowDTO {
  id: string;
  factoryId: string;
  factoryName: string;
  newRegistrationNo: string;
  oldRegistrationNo: string | null;
  industryType: string | null;
  province: string | null;
  address: string | null;
  monitoringPointCount: number;
}

export interface KwpFormStatusHistoryDTO {
  id: number;
  status: KwpFormStatus;
  statusLabel: string;
  note: string | null;
  changedById: number | null;
  changedBy: string | null;
  changedAt: string;
  changedDate: string;
}

export interface KwpFormRequestTableRowDTO {
  id: number;
  factoryId: string | null;
  factoryName: string;
  factoryRegistration: string | null;
  industryType: string | null;
  factoryAddress: string | null;
  province: string | null;
  type: 'CEMS' | 'WPMS' | string | null;
  monitoringPointCode: string | null;
  monitoringPointName: string | null;
  requestNo: string;
  form: string;
  formType: KwpFormType;
  submittedDate: string;
  reviewedDate: string;
  status: string;
  statusCode: KwpFormStatus;
  revisionNote: string | null;
  statusHistory: KwpFormStatusHistoryDTO[];
}

export interface PaginatedKwpFormTableRowsDTO<T> {
  data: T[];
  meta: {
    total: number;
  };
}
