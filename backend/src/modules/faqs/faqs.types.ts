export const FAQ_CATEGORIES = ['CEMS', 'WPMS', 'OTHER'] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export const FAQ_CATEGORY_LABELS: Readonly<Record<FaqCategory, string>> = {
  CEMS: 'CEMS',
  WPMS: 'WPMS',
  OTHER: 'อื่นๆ',
};

export interface FaqInput {
  question: string;
  answer: string;
  category: FaqCategory;
  updatedDate: string;
  links?: string[];
  attachmentIds?: string[];
}

export interface FaqAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
}

export interface StoredFaqAttachment extends Omit<FaqAttachment, 'downloadUrl'> {
  storagePath: string;
}

export interface FaqWriteInput extends FaqInput {
  newAttachments?: StoredFaqAttachment[];
}

export interface FaqDTO extends Omit<FaqInput, 'attachmentIds' | 'links'> {
  id: string;
  links: string[];
  attachments: FaqAttachment[];
  categoryLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeletedFaqDTO {
  id: string;
  deleted: true;
}
