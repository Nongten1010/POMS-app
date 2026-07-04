export const KWP01_ISSUE_REASONS = [
  'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
  'หยุดหน่วยการผลิต',
] as const;

export type Kwp01IssueReason = (typeof KWP01_ISSUE_REASONS)[number];

export interface KwpFormSubmissionAccess {
  actorUserId: number;
  scope: string | null | undefined;
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

export interface CreatedKwpFormSubmissionDTO {
  id: number;
  requestNo: string;
  form: 'กวภ.01' | 'กวภ.02' | 'กวภ.04';
  formType: 'KWP01' | 'KWP02' | 'KWP04';
  status: 'SUBMITTED';
  submittedAt: string;
  measurementItemCount?: number;
  attachmentCount?: number;
}
