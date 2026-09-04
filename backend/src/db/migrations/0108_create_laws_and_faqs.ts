import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

const LAWS_TABLE = 'laws';
const FAQS_TABLE = 'faqs';
const CATEGORY_VALUES = ['CEMS', 'WPMS', 'OTHER'] as const;
const LAW_DOCUMENT_TYPE_VALUES = [
  'MINISTERIAL_REGULATION',
  'RULE_AND_ANNOUNCEMENT',
  'REGULATION_REQUIREMENT',
  'OTHER',
] as const;

function sqlStringValues(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(LAWS_TABLE, (table) => {
    table.bigIncrements('id').primary();
    table.specificType('public_id', 'UNIQUEIDENTIFIER NOT NULL');
    table.specificType('title', 'NVARCHAR(500) NOT NULL');
    table.specificType('category', 'VARCHAR(32) NOT NULL');
    table.specificType('document_type', 'VARCHAR(64) NOT NULL');
    table.specificType('published_date', 'DATE NOT NULL');
    table.specificType('original_file_name', 'NVARCHAR(255) NOT NULL');
    table.specificType('mime_type', 'VARCHAR(100) NOT NULL');
    table.specificType('file_size', 'BIGINT NOT NULL');
    table.specificType('storage_path', 'NVARCHAR(1000) NOT NULL');
    addAuditColumns(table);
  });

  await knex.schema.createTable(FAQS_TABLE, (table) => {
    table.bigIncrements('id').primary();
    table.specificType('public_id', 'UNIQUEIDENTIFIER NOT NULL');
    table.specificType('question', 'NVARCHAR(1000) NOT NULL');
    table.specificType('answer', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('category', 'VARCHAR(32) NOT NULL');
    table.specificType('updated_date', 'DATE NOT NULL');
    addAuditColumns(table);
  });

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_laws_public_id
    ON ${LAWS_TABLE}(public_id);

    ALTER TABLE ${LAWS_TABLE}
    ADD CONSTRAINT ck_laws_category
    CHECK (category IN (${sqlStringValues(CATEGORY_VALUES)}));

    ALTER TABLE ${LAWS_TABLE}
    ADD CONSTRAINT ck_laws_document_type
    CHECK (document_type IN (${sqlStringValues(LAW_DOCUMENT_TYPE_VALUES)}));

    ALTER TABLE ${LAWS_TABLE}
    ADD CONSTRAINT ck_laws_published_date
    CHECK (published_date BETWEEN '1900-01-01' AND '9999-12-31');

    ALTER TABLE ${LAWS_TABLE}
    ADD CONSTRAINT ck_laws_title
    CHECK (LEN(LTRIM(RTRIM(title))) > 0);

    ALTER TABLE ${LAWS_TABLE}
    ADD CONSTRAINT ck_laws_original_file_name
    CHECK (LEN(LTRIM(RTRIM(original_file_name))) > 0);

    ALTER TABLE ${LAWS_TABLE}
    ADD CONSTRAINT ck_laws_mime_type
    CHECK (mime_type = 'application/pdf');

    ALTER TABLE ${LAWS_TABLE}
    ADD CONSTRAINT ck_laws_file_size
    CHECK (file_size BETWEEN 1 AND 10485760);

    ALTER TABLE ${LAWS_TABLE}
    ADD CONSTRAINT ck_laws_storage_path
    CHECK (
      storage_path LIKE '.private/laws/%'
      AND storage_path NOT LIKE '%..%'
      AND storage_path NOT LIKE '%\\%'
    );

    CREATE INDEX ix_laws_active_title
    ON ${LAWS_TABLE}(title, id)
    INCLUDE (
      public_id,
      category,
      document_type,
      published_date,
      original_file_name,
      mime_type,
      file_size,
      storage_path,
      created_at,
      updated_at
    )
    WHERE deleted_at IS NULL;
  `);

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_faqs_public_id
    ON ${FAQS_TABLE}(public_id);

    ALTER TABLE ${FAQS_TABLE}
    ADD CONSTRAINT ck_faqs_category
    CHECK (category IN (${sqlStringValues(CATEGORY_VALUES)}));

    ALTER TABLE ${FAQS_TABLE}
    ADD CONSTRAINT ck_faqs_updated_date
    CHECK (updated_date BETWEEN '1900-01-01' AND '9999-12-31');

    ALTER TABLE ${FAQS_TABLE}
    ADD CONSTRAINT ck_faqs_question
    CHECK (LEN(LTRIM(RTRIM(question))) > 0);

    ALTER TABLE ${FAQS_TABLE}
    ADD CONSTRAINT ck_faqs_answer
    CHECK (LEN(LTRIM(RTRIM(answer))) > 0);

    CREATE INDEX ix_faqs_active_updated_date
    ON ${FAQS_TABLE}(updated_date DESC, id DESC)
    INCLUDE (public_id, question, category, created_at, updated_at)
    WHERE deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(FAQS_TABLE);
  await knex.schema.dropTableIfExists(LAWS_TABLE);
}
