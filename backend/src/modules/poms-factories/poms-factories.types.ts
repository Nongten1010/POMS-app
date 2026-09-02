import type { ConnectionRequestEiaAssessment } from '../connection-requests/connection-request-eia';
import type {
  MeasurementInstrumentsInput,
  MeasurementPointDetailsInput,
  RequestDocumentImageInput,
} from '../connection-requests/connection-requests.types';
import type { MonitoringPointStatus } from '../monitoring-point-forms/monitoring-point-forms.types';

export const POMS_FACTORY_EDIT_REQUEST_STATUS = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
  REVISED_PENDING_REVIEW: 'REVISED_PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const POMS_FACTORY_EDIT_REQUEST_FORM_TYPE = {
  BASIC_INFO: 'BASIC_INFO',
  MEASUREMENT_POINTS: 'MEASUREMENT_POINTS',
} as const;

export type PomsFactoryEditRequestStatus =
  (typeof POMS_FACTORY_EDIT_REQUEST_STATUS)[keyof typeof POMS_FACTORY_EDIT_REQUEST_STATUS];
export type PomsFactoryEditRequestFormType =
  (typeof POMS_FACTORY_EDIT_REQUEST_FORM_TYPE)[keyof typeof POMS_FACTORY_EDIT_REQUEST_FORM_TYPE];

export const POMS_FACTORY_EDIT_REQUEST_STATUS_LABELS: Record<PomsFactoryEditRequestStatus, string> =
  {
    [POMS_FACTORY_EDIT_REQUEST_STATUS.PENDING_REVIEW]: 'รอพิจารณา',
    [POMS_FACTORY_EDIT_REQUEST_STATUS.REVISION_REQUESTED]: 'ส่งกลับให้แก้ไข',
    [POMS_FACTORY_EDIT_REQUEST_STATUS.REVISED_PENDING_REVIEW]: 'แก้ไขแล้ว รอพิจารณา',
    [POMS_FACTORY_EDIT_REQUEST_STATUS.APPROVED]: 'อนุมัติแล้ว',
    [POMS_FACTORY_EDIT_REQUEST_STATUS.REJECTED]: 'ไม่อนุมัติ',
  };

export const POMS_FACTORY_EDIT_REQUEST_ACTION = {
  SUBMIT: 'SUBMIT',
  RESUBMIT: 'RESUBMIT',
  APPROVE: 'APPROVE',
  REQUEST_REVISION: 'REQUEST_REVISION',
  REJECT: 'REJECT',
} as const;

export type PomsFactoryEditRequestAction =
  (typeof POMS_FACTORY_EDIT_REQUEST_ACTION)[keyof typeof POMS_FACTORY_EDIT_REQUEST_ACTION];

export interface PomsFactoryProfileDTO {
  eligibleFactoryId: number;
  factoryId: string;
  factoryRegistrationNo: string;
  factoryName: string;
  industryMainOrder: string | null;
  industryMainOrderLabel: string | null;
  industrySubOrder: string | null;
  businessActivity: string | null;
  factoryAddress: string | null;
  provinceName: string | null;
  industrialEstateName: string | null;
  latitude: number | null;
  longitude: number | null;
  eia: ConnectionRequestEiaAssessment | null;
  eiaOther: string | null;
  projectName: string | null;
  factoryFrontPhotos: RequestDocumentImageInput[];
  factoryLogo: RequestDocumentImageInput | null;
  updatedAt: string;
}

export interface PomsFactorySummaryDTO extends PomsFactoryProfileDTO {
  systemTypes: Array<'CEMS' | 'WPMS'>;
  measurementPointCount: number;
  pendingEditRequestCount: number;
}

export interface PomsMeasurementPointDTO {
  connectedPointId: number;
  sourceMeasurementPointId: number;
  eligibleFactoryId: number;
  factoryId: string;
  factoryName: string;
  systemType: 'CEMS' | 'WPMS';
  pointName: string;
  pointCode: string | null;
  pointType: 'STACK' | 'WASTEWATER' | 'OTHER';
  parameters: string[];
  monitoringPointStatus: MonitoringPointStatus | null;
  details: MeasurementPointDetailsInput | null;
  documentsAndImages: RequestDocumentImageInput[];
  measurementInstruments: MeasurementInstrumentsInput | null;
  updatedAt: string;
}

export interface PomsFactoryDetailDTO extends PomsFactorySummaryDTO {
  measurementPoints: PomsMeasurementPointDTO[];
}

export interface CreatePomsFactoryEditRequestInput {
  formType?: typeof POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.BASIC_INFO;
  factoryName: string;
  factoryAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  eia?: ConnectionRequestEiaAssessment | null;
  eiaOther?: string | null;
  projectName?: string | null;
  factoryFrontPhotos?: RequestDocumentImageInput[];
  factoryLogo?: RequestDocumentImageInput | null;
  note?: string | null;
}

export interface PomsMeasurementPointPatchInput {
  connectedPointId: number;
  pointName?: string;
  monitoringPointStatus?: MonitoringPointStatus | null;
  details?: MeasurementPointDetailsInput | null;
  documentsAndImages?: RequestDocumentImageInput[];
  measurementInstruments?: MeasurementInstrumentsInput | null;
}

export interface CreatePomsFactoryMeasurementPointsEditRequestInput {
  formType: typeof POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS;
  measurementPoints: PomsMeasurementPointPatchInput[];
  note?: string | null;
}

export type CreateAnyPomsFactoryEditRequestInput =
  | CreatePomsFactoryEditRequestInput
  | CreatePomsFactoryMeasurementPointsEditRequestInput;

export type ResubmitPomsFactoryEditRequestInput = CreateAnyPomsFactoryEditRequestInput;

export interface ReviewPomsFactoryEditRequestInput {
  decision: 'APPROVE' | 'REQUEST_REVISION' | 'REJECT';
  revisionReason?: string | null;
  officerNote?: string | null;
}

export interface PomsFactoryReviewActorContext {
  userType?: 'citizen' | 'operator' | 'officer' | 'admin';
  roles: string[];
}

export interface PomsFactoryEditRequestEventDTO {
  id: number;
  action: PomsFactoryEditRequestAction;
  fromStatus: PomsFactoryEditRequestStatus | null;
  toStatus: PomsFactoryEditRequestStatus;
  note: string | null;
  actorUserId: number;
  createdAt: string;
}

export interface PomsFactoryEditRequestDTO {
  id: number;
  requestNo: string;
  eligibleFactoryId: number;
  factoryId: string;
  factoryRegistrationNo: string;
  factoryName: string;
  formType: PomsFactoryEditRequestFormType;
  status: PomsFactoryEditRequestStatus;
  statusLabel: string;
  revisionNo: number;
  isOpen: boolean;
  requestNote: string | null;
  revisionReason: string | null;
  officerNote: string | null;
  currentFactory: PomsFactoryProfileDTO;
  proposedFactory: PomsFactoryProfileDTO;
  currentMeasurementPoints: PomsMeasurementPointDTO[] | null;
  proposedMeasurementPoints: PomsMeasurementPointDTO[] | null;
  submittedBy: number;
  reviewedBy: number | null;
  submittedAt: string;
  reviewedAt: string | null;
  approvedAt: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  events: PomsFactoryEditRequestEventDTO[];
}

export interface ListPomsFactoryEditRequestsQuery {
  status?: PomsFactoryEditRequestStatus;
  factoryId?: string;
  search?: string;
}
