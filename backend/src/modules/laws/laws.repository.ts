import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { db } from '../../config/database';
import type {
  CreateLawRecordInput,
  LawCategory,
  LawRecord,
  LawRepository,
  LawType,
  UpdateLawRecordInput,
} from './laws.types';

export const LAWS_TABLE = 'laws';

interface LawRow {
  public_id: string;
  title: string;
  category: LawCategory;
  document_type: LawType;
  published_date: Date | string;
  original_file_name: string;
  mime_type: 'application/pdf';
  file_size: number | string;
  storage_path: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export function createLawsRepository(
  database: Knex = db,
  generateId: () => string = randomUUID,
): LawRepository {
  const findByIdWith = async (executor: Knex | Knex.Transaction, id: string) => {
    const row = await lawQuery(executor).where('public_id', id).whereNull('deleted_at').first();
    return row ? toLawRecord(row) : null;
  };

  return {
    async list(): Promise<LawRecord[]> {
      const rows = await lawQuery(database)
        .whereNull('deleted_at')
        .orderBy('created_at', 'desc')
        .orderBy('public_id', 'desc');
      return rows.map(toLawRecord);
    },

    findById(id: string): Promise<LawRecord | null> {
      return findByIdWith(database, id);
    },

    async create(input: CreateLawRecordInput, actorUserId: number): Promise<LawRecord> {
      const publicId = generateId();
      return database.transaction(async (transaction) => {
        await transaction(LAWS_TABLE).insert({
          public_id: publicId,
          title: input.title,
          category: input.category,
          document_type: input.type,
          published_date: input.publishedDate,
          original_file_name: input.file.fileName,
          mime_type: input.file.mimeType,
          file_size: input.file.fileSize,
          storage_path: input.file.storagePath,
          created_by: actorUserId,
          updated_by: actorUserId,
        });
        const created = await findByIdWith(transaction, publicId);
        if (!created) throw new Error('Created law could not be loaded');
        return created;
      });
    },

    async update(
      id: string,
      input: UpdateLawRecordInput,
      actorUserId: number,
    ): Promise<{ previous: LawRecord; current: LawRecord } | null> {
      return database.transaction(async (transaction) => {
        const previous = await findByIdWith(transaction, id);
        if (!previous) return null;

        const changes: Record<string, unknown> = {
          title: input.title,
          category: input.category,
          document_type: input.type,
          published_date: input.publishedDate,
          updated_by: actorUserId,
          updated_at: transaction.fn.now(),
        };
        if (input.file) {
          changes.original_file_name = input.file.fileName;
          changes.mime_type = input.file.mimeType;
          changes.file_size = input.file.fileSize;
          changes.storage_path = input.file.storagePath;
        }

        const affected = await transaction(LAWS_TABLE)
          .where('public_id', id)
          .whereNull('deleted_at')
          .update(changes);
        if (Number(affected) === 0) return null;
        const current = await findByIdWith(transaction, id);
        return current ? { previous, current } : null;
      });
    },

    async softDelete(id: string, actorUserId: number): Promise<LawRecord | null> {
      return database.transaction(async (transaction) => {
        const previous = await findByIdWith(transaction, id);
        if (!previous) return null;
        const now = transaction.fn.now();
        const affected = await transaction(LAWS_TABLE)
          .where('public_id', id)
          .whereNull('deleted_at')
          .update({ deleted_at: now, updated_at: now, updated_by: actorUserId });
        return Number(affected) === 0 ? null : previous;
      });
    },
  };
}

function lawQuery(executor: Knex | Knex.Transaction) {
  return executor<LawRow>(LAWS_TABLE).select(
    'public_id',
    'title',
    'category',
    'document_type',
    'published_date',
    'original_file_name',
    'mime_type',
    'file_size',
    'storage_path',
    'created_at',
    'updated_at',
  );
}

function toLawRecord(row: LawRow): LawRecord {
  return {
    id: String(row.public_id),
    title: row.title,
    category: row.category,
    type: row.document_type,
    publishedDate: toDateOnly(row.published_date),
    fileName: row.original_file_name,
    fileSize: Number(row.file_size),
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  };
}

function toDateOnly(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function toIsoDateTime(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export const lawsRepository = createLawsRepository();
