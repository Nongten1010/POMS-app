import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { db } from '../../config/database';
import type { FaqCategory, FaqDTO, FaqWriteInput, StoredFaqAttachment } from './faqs.types';
import { FAQ_CATEGORY_LABELS } from './faqs.types';
import { AppError, ConflictError } from '../../shared/errors/AppError';

interface FaqRow {
  public_id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  updated_date: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  links_json?: string | null;
  attachments_json?: string | null;
}

const FAQ_COLUMNS = [
  'public_id',
  'question',
  'answer',
  'category',
  'updated_date',
  'created_at',
  'updated_at',
  'links_json',
  'attachments_json',
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

  async create(input: FaqWriteInput, actorUserId: number): Promise<FaqDTO> {
    return db.transaction(async (connection) => {
      const publicId = randomUUID();
      await connection('faqs')
        .insert({
          public_id: publicId,
          question: input.question,
          answer: input.answer,
          category: input.category,
          updated_date: input.updatedDate,
          created_by: actorUserId,
          updated_by: actorUserId,
          links_json: JSON.stringify(input.links ?? []),
          attachments_json: JSON.stringify(input.newAttachments ?? []),
        })
        .returning('public_id');

      const created = await findActiveByPublicId(publicId, connection);
      if (!created) throw new Error('Created FAQ could not be loaded');
      return toFaqDto(created);
    });
  },

  async update(
    publicId: string,
    input: FaqWriteInput,
    actorUserId: number,
  ): Promise<FaqDTO | null> {
    return db.transaction(async (connection) => {
      const changesAttachments =
        input.attachmentIds !== undefined || input.newAttachments !== undefined;
      const current = changesAttachments
        ? await findActiveByPublicId(publicId, connection)
        : undefined;
      if (changesAttachments && !current) return null;
      const query = connection('faqs').where('public_id', publicId).whereNull('deleted_at');
      let attachments: StoredFaqAttachment[] | undefined;
      if (current) {
        const previous: StoredFaqAttachment[] = JSON.parse(current.attachments_json ?? '[]');
        const ids = input.attachmentIds ?? previous.map((file) => file.id);
        const retained = ids.map((id) => {
          const file = previous.find((file) => file.id === id);
          if (!file)
            throw new AppError(
              'ไฟล์แนบไม่อยู่ในคำถามนี้ กรุณาโหลดข้อมูลใหม่',
              400,
              'VALIDATION_ERROR',
              { attachmentIds: 'Unknown attachment id' },
            );
          return file;
        });
        attachments = [...retained, ...(input.newAttachments ?? [])];
        if (attachments.length > 10)
          throw new AppError('แนบได้สูงสุด 10 ไฟล์ต่อคำถาม', 400, 'VALIDATION_ERROR', {
            files: 'Maximum 10 attachments',
          });
        // Detect concurrent attachment edits before replacing the stored list.
        if (current.attachments_json == null) query.whereNull('attachments_json');
        else query.where('attachments_json', current.attachments_json);
      }
      const affectedRows = await query.update({
        question: input.question,
        answer: input.answer,
        category: input.category,
        updated_date: input.updatedDate,
        updated_at: db.fn.now(),
        updated_by: actorUserId,
        ...(input.links === undefined ? {} : { links_json: JSON.stringify(input.links) }),
        ...(attachments === undefined ? {} : { attachments_json: JSON.stringify(attachments) }),
      });

      if (Number(affectedRows) < 1 && current)
        throw new ConflictError('FAQ changed; reload before saving');
      if (Number(affectedRows) < 1) return null;
      const updated = await findActiveByPublicId(publicId, connection);
      if (!updated) throw new Error('Updated FAQ could not be loaded');
      return toFaqDto(updated);
    });
  },

  async findAttachment(
    publicId: string,
    attachmentId: string,
  ): Promise<StoredFaqAttachment | undefined> {
    const row = await findActiveByPublicId(publicId);
    const attachments: StoredFaqAttachment[] = JSON.parse(row?.attachments_json ?? '[]');
    return attachments.find((file) => file.id === attachmentId);
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

async function findActiveByPublicId(
  publicId: string,
  connection: Knex = db,
): Promise<FaqRow | undefined> {
  return connection<FaqRow>('faqs')
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
    links: JSON.parse(row.links_json ?? '[]'),
    attachments: (JSON.parse(row.attachments_json ?? '[]') as StoredFaqAttachment[]).map(
      ({ storagePath: _storagePath, ...file }) => ({
        ...file,
        downloadUrl: `/api/v1/faqs/${row.public_id}/attachments/${file.id}`,
      }),
    ),
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
