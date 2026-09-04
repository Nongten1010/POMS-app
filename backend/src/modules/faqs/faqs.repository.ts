import { randomUUID } from 'node:crypto';
import { db } from '../../config/database';
import type { FaqCategory, FaqDTO, FaqInput } from './faqs.types';
import { FAQ_CATEGORY_LABELS } from './faqs.types';

interface FaqRow {
  public_id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  updated_date: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

const FAQ_COLUMNS = [
  'public_id',
  'question',
  'answer',
  'category',
  'updated_date',
  'created_at',
  'updated_at',
] as const;

export const faqsRepository = {
  async list(): Promise<FaqDTO[]> {
    const rows = await db<FaqRow>('faqs')
      .whereNull('deleted_at')
      .select(...FAQ_COLUMNS)
      .orderBy('updated_date', 'desc')
      .orderBy('updated_at', 'desc')
      .orderBy('public_id', 'asc');

    return rows.map(toFaqDto);
  },

  async create(input: FaqInput, actorUserId: number): Promise<FaqDTO> {
    const publicId = randomUUID();
    await db('faqs')
      .insert({
        public_id: publicId,
        question: input.question,
        answer: input.answer,
        category: input.category,
        updated_date: input.updatedDate,
        created_by: actorUserId,
        updated_by: actorUserId,
      })
      .returning('public_id');

    const created = await findActiveByPublicId(publicId);
    if (!created) throw new Error('Created FAQ could not be loaded');
    return toFaqDto(created);
  },

  async update(publicId: string, input: FaqInput, actorUserId: number): Promise<FaqDTO | null> {
    const affectedRows = await db('faqs')
      .where('public_id', publicId)
      .whereNull('deleted_at')
      .update({
        question: input.question,
        answer: input.answer,
        category: input.category,
        updated_date: input.updatedDate,
        updated_at: db.fn.now(),
        updated_by: actorUserId,
      });

    if (Number(affectedRows) < 1) return null;
    const updated = await findActiveByPublicId(publicId);
    if (!updated) throw new Error('Updated FAQ could not be loaded');
    return toFaqDto(updated);
  },

  async softDelete(publicId: string, actorUserId: number): Promise<boolean> {
    const now = db.fn.now();
    const affectedRows = await db('faqs')
      .where('public_id', publicId)
      .whereNull('deleted_at')
      .update({
        deleted_at: now,
        updated_at: now,
        updated_by: actorUserId,
      });

    return Number(affectedRows) > 0;
  },
};

async function findActiveByPublicId(publicId: string): Promise<FaqRow | undefined> {
  return db<FaqRow>('faqs')
    .where('public_id', publicId)
    .whereNull('deleted_at')
    .first(...FAQ_COLUMNS);
}

function toFaqDto(row: FaqRow): FaqDTO {
  const categoryLabel = FAQ_CATEGORY_LABELS[row.category];
  if (!categoryLabel) throw new Error('Stored FAQ category is invalid');

  return {
    id: row.public_id,
    question: row.question,
    answer: row.answer,
    category: row.category,
    categoryLabel,
    updatedDate: toDateOnly(row.updated_date),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function toDateOnly(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
