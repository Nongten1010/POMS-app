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

export interface CreatedKwpFormSubmissionDTO {
  id: number;
  requestNo: string;
  form: 'กวภ.01';
  formType: 'KWP01';
  status: 'SUBMITTED';
  submittedAt: string;
}
