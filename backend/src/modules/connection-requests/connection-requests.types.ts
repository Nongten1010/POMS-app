export const CONNECTION_REQUEST_STATUS = {
  PENDING_DESIGN_REVIEW: 'PENDING_DESIGN_REVIEW',
  WAITING_CONNECTION: 'WAITING_CONNECTION',
  WAITING_FACTORY_REVISION: 'WAITING_FACTORY_REVISION',
  REVISED_PENDING_DESIGN_REVIEW: 'REVISED_PENDING_DESIGN_REVIEW',
  CONNECTION_CONFIRMED: 'CONNECTION_CONFIRMED',
  CONNECTED: 'CONNECTED',
} as const;

export type ConnectionRequestStatus =
  (typeof CONNECTION_REQUEST_STATUS)[keyof typeof CONNECTION_REQUEST_STATUS];

export const CONNECTION_REQUEST_STATUS_LABELS: Record<ConnectionRequestStatus, string> = {
  [CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW]: 'รอพิจารณาแบบ',
  [CONNECTION_REQUEST_STATUS.WAITING_CONNECTION]: 'รอเชื่อมต่อ',
  [CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION]: 'รอโรงงานแก้ไข',
  [CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW]: 'แก้ไขแล้ว/รอพิจารณาแบบ',
  [CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED]: 'ยืนยันการเชื่อมต่อ',
  [CONNECTION_REQUEST_STATUS.CONNECTED]: 'เชื่อมต่อแล้ว',
};

export type ConnectionSystemType = 'CEMS' | 'WPMS';
export type MeasurementPointType = 'STACK' | 'WASTEWATER' | 'OTHER';

export interface MeasurementPointInput {
  pointName: string;
  pointCode?: string | null;
  pointType: MeasurementPointType;
  latitude?: number | null;
  longitude?: number | null;
  parameters: string[];
  description?: string | null;
}

export interface CreateConnectionRequestInput {
  factoryId: string;
  factoryName: string;
  factoryRegistrationNo: string;
  systemType: ConnectionSystemType;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  measurementPoints: MeasurementPointInput[];
  remarks?: string | null;
}

export type ResubmitConnectionRequestInput = CreateConnectionRequestInput;

export interface ListConnectionRequestsQuery {
  status?: ConnectionRequestStatus;
}

export interface ReviewConnectionRequestInput {
  decision: 'APPROVE_DESIGN' | 'REQUEST_REVISION';
  revisionReason?: string | null;
  officerNote?: string | null;
}

export interface ConfirmConnectionInput {
  confirmedAt?: string;
  note?: string | null;
}

export interface VerifyConnectionInput {
  verifiedAt?: string;
  note?: string | null;
}

export interface MeasurementPointDTO extends MeasurementPointInput {
  id: number;
}

export interface StatusHistoryDTO {
  id: number;
  status: ConnectionRequestStatus;
  statusLabel: string;
  note: string | null;
  changedBy: number;
  changedAt: string;
}

export interface ConnectionRequestDTO {
  id: number;
  requestNo: string;
  factoryId: string;
  factoryName: string;
  factoryRegistrationNo: string;
  systemType: ConnectionSystemType;
  status: ConnectionRequestStatus;
  statusLabel: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  remarks: string | null;
  revisionReason: string | null;
  officerNote: string | null;
  connectionDueAt: string | null;
  confirmedAt: string | null;
  verifiedAt: string | null;
  measurementPoints: MeasurementPointDTO[];
  statusHistory: StatusHistoryDTO[];
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedConnectionRequestsDTO {
  data: ConnectionRequestDTO[];
  meta: {
    total: number;
  };
}
