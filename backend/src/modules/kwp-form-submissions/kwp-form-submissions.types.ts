export const KWP01_ISSUE_REASONS = [
  'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
  'หยุดหน่วยการผลิต',
] as const;

export type Kwp01IssueReason = (typeof KWP01_ISSUE_REASONS)[number];
export type KwpFormSubmissionDetailType = 'KWP01' | 'KWP02' | 'KWP04' | 'KWP05';

export interface KwpFormSubmissionAccess {
  actorUserId: number;
  scope: string | null | undefined;
}

export interface KwpFormSubmissionReadAccess extends KwpFormSubmissionAccess {
  formType: KwpFormSubmissionDetailType;
  regionalAccess?: { regions: string[] } | null;
  publicBaseUrl: string;
  publicPath: string;
}

export interface CreateKwp01SubmissionDTO {
  factoryId: string;
  factoryName: string;
  factoryRegistrationNo?: string | null;
  factoryAddress?: string | null;
  industryType?: string | null;
  connectedPointId?: number | null;
  pointCode?: string | null;
  pointName?: string | null;
  pointType?: string | null;
  productionStack?: string | null;
  primaryFuel?: string | null;
  secondaryFuel?: string | null;
  combustionSystem?: string | null;
  productionCapacity?: string | null;
  productionCapacityUnit?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  issueReason: Kwp01IssueReason;
  reasonDetail?: string | null;
  problemDate?: string | null;
  expectedDoneDate?: string | null;
  totalDays?: number | null;
  unreportedParameters: string[];
  correctiveAction?: string | null;
  reporterName?: string | null;
  reporterPosition?: string | null;
}

export interface KwpFormAttachmentInput {
  attachmentType: string;
  originalFileName: string;
  storedFileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  storagePath?: string | null;
}

export interface KwpEmissionMeasurementItemInput {
  pollutant: string;
  sampleDate?: string | null;
  measuredValue?: string | number | null;
  unit?: string | null;
  laboratoryNo?: string | null;
  reportNo?: string | null;
  method?: string | null;
  attachments?: KwpFormAttachmentInput[];
}

export interface CreateKwp02SubmissionDTO {
  factoryId: string;
  factoryName: string;
  factoryRegistrationNo?: string | null;
  factoryAddress?: string | null;
  industryType?: string | null;
  connectedPointId?: number | null;
  pointCode?: string | null;
  pointName?: string | null;
  pointType?: string | null;
  productionStack?: string | null;
  primaryFuel?: string | null;
  secondaryFuel?: string | null;
  combustionSystem?: string | null;
  productionCapacity?: string | null;
  productionCapacityUnit?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  measurementItems: KwpEmissionMeasurementItemInput[];
  reporterName?: string | null;
  reporterPosition?: string | null;
}

export type CreateKwp04SubmissionDTO = CreateKwp02SubmissionDTO;

export interface Kwp05CalibrationItemInput {
  parameter: string;
  startDate?: string | null;
  endDate?: string | null;
  result?: string | null;
  verifierCompany?: string | null;
  cemsModel?: string | null;
  rataReportLink?: string | null;
  calibrationPhotoLink?: string | null;
  attachments?: KwpFormAttachmentInput[];
}

export interface CreateKwp05SubmissionDTO {
  factoryId: string;
  factoryName: string;
  factoryRegistrationNo?: string | null;
  factoryAddress?: string | null;
  industryType?: string | null;
  connectedPointId?: number | null;
  pointCode?: string | null;
  pointName?: string | null;
  pointType?: string | null;
  productionStack?: string | null;
  primaryFuel?: string | null;
  secondaryFuel?: string | null;
  combustionSystem?: string | null;
  productionCapacity?: string | null;
  productionCapacityUnit?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  businessActivity?: string | null;
  samplerName?: string | null;
  officerRegistration?: string | null;
  laboratoryName?: string | null;
  laboratoryRegistration?: string | null;
  cemsBrand?: string | null;
  cemsDetail?: string | null;
  reportRound?: string | null;
  reportYear?: string | null;
  calibrationItems: Kwp05CalibrationItemInput[];
  reporterName?: string | null;
  reporterPosition?: string | null;
}

export interface CreatedKwpFormSubmissionDTO {
  id: number;
  requestNo: string;
  form: 'กวภ.01' | 'กวภ.02' | 'กวภ.04' | 'กวภ.05';
  formType: KwpFormSubmissionDetailType;
  status: 'SUBMITTED';
  submittedAt: string;
  measurementItemCount?: number;
  calibrationItemCount?: number;
  attachmentCount?: number;
}

export interface KwpFormAttachmentDTO {
  id: number;
  attachmentType: string;
  originalFileName: string;
  storedFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  storagePath: string | null;
  fileUrl: string | null;
  uploadedAt: string;
  uploadedBy: number | null;
}

export interface KwpEmissionMeasurementItemDTO {
  id: number;
  pollutant: string;
  sampleDate: string | null;
  measuredValue: string | null;
  numericValue: number | null;
  unit: string | null;
  laboratoryNo: string | null;
  reportNo: string | null;
  method: string | null;
  attachments: KwpFormAttachmentDTO[];
}

export interface Kwp01IssueReportDTO {
  issueReason: Kwp01IssueReason;
  reasonDetail: string | null;
  problemDate: string | null;
  expectedDoneDate: string | null;
  totalDays: number | null;
  correctiveAction: string | null;
  unreportedParameters: string[];
}

export interface Kwp05CalibrationReportDTO {
  businessActivity: string | null;
  samplerName: string | null;
  officerRegistration: string | null;
  laboratoryName: string | null;
  laboratoryRegistration: string | null;
  cemsBrand: string | null;
  cemsDetail: string | null;
  reportRound: string | null;
  reportYear: string | null;
}

export interface Kwp05CalibrationItemDTO {
  id: number;
  parameter: string;
  startDate: string | null;
  endDate: string | null;
  result: string | null;
  verifierCompany: string | null;
  cemsModel: string | null;
  rataReportLink: string | null;
  calibrationPhotoLink: string | null;
  attachments: KwpFormAttachmentDTO[];
}

export interface KwpFormSubmissionDetailDTO {
  id: number;
  requestNo: string;
  form: 'กวภ.01' | 'กวภ.02' | 'กวภ.04' | 'กวภ.05';
  formType: KwpFormSubmissionDetailType;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  factoryId: string | null;
  factoryName: string;
  factoryRegistrationNo: string | null;
  factoryAddress: string | null;
  industryType: string | null;
  connectedPointId: number | null;
  pointCode: string | null;
  pointName: string | null;
  pointType: string | null;
  productionStack: string | null;
  primaryFuel: string | null;
  secondaryFuel: string | null;
  combustionSystem: string | null;
  productionCapacity: string | null;
  productionCapacityUnit: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  reporterName: string | null;
  reporterPosition: string | null;
  issueReport?: Kwp01IssueReportDTO;
  measurementItems?: KwpEmissionMeasurementItemDTO[];
  calibrationReport?: Kwp05CalibrationReportDTO;
  calibrationItems?: Kwp05CalibrationItemDTO[];
}
