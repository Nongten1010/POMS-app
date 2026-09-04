export const LAW_CATEGORIES = ['CEMS', 'WPMS', 'OTHER'] as const;
export type LawCategory = (typeof LAW_CATEGORIES)[number];

export const LAW_TYPES = [
  'MINISTERIAL_REGULATION',
  'RULE_AND_ANNOUNCEMENT',
  'REGULATION_REQUIREMENT',
  'OTHER',
] as const;
export type LawType = (typeof LAW_TYPES)[number];

export const LAW_CATEGORY_LABELS: Record<LawCategory, string> = {
  CEMS: 'CEMS',
  WPMS: 'WPMS',
  OTHER: 'อื่นๆ',
};

export const LAW_TYPE_LABELS: Record<LawType, string> = {
  MINISTERIAL_REGULATION: 'กฎกระทรวง',
  RULE_AND_ANNOUNCEMENT: 'กฎและประกาศ',
  REGULATION_REQUIREMENT: 'ระเบียบ ข้อบังคับ และข้อกำหนด',
  OTHER: 'อื่นๆ',
};

export interface LawInput {
  title: string;
  category: LawCategory;
  type: LawType;
  publishedDate: string;
}

export interface UploadedLawFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface StoredLawFile {
  fileName: string;
  fileSize: number;
  mimeType: 'application/pdf';
  storagePath: string;
}

export interface LawRecord extends LawInput, StoredLawFile {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface LawDTO {
  id: string;
  title: string;
  category: LawCategory;
  categoryLabel: string;
  type: LawType;
  typeLabel: string;
  publishedDate: string;
  file: {
    fileName: string;
    fileSize: number;
    mimeType: 'application/pdf';
    downloadUrl: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LawFileContent {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: 'application/pdf';
}

export interface CreateLawRecordInput extends LawInput {
  file: StoredLawFile;
}

export interface UpdateLawRecordInput extends LawInput {
  file?: StoredLawFile;
}

export interface LawRepository {
  list(): Promise<LawRecord[]>;
  findById(id: string): Promise<LawRecord | null>;
  create(input: CreateLawRecordInput, actorUserId: number): Promise<LawRecord>;
  update(
    id: string,
    input: UpdateLawRecordInput,
    actorUserId: number,
  ): Promise<{ previous: LawRecord; current: LawRecord } | null>;
  softDelete(id: string, actorUserId: number): Promise<LawRecord | null>;
}

export interface LawFileStorage {
  save(file: UploadedLawFile): Promise<StoredLawFile>;
  remove(storagePath: string): Promise<void>;
  getContent(file: StoredLawFile): Promise<LawFileContent>;
}
