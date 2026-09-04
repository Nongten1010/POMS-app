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
}

export interface FaqDTO extends FaqInput {
  id: string;
  categoryLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeletedFaqDTO {
  id: string;
  deleted: true;
}
