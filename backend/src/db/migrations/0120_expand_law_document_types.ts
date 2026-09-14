import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE laws DROP CONSTRAINT ck_laws_document_type;
    ALTER TABLE laws WITH CHECK ADD CONSTRAINT ck_laws_document_type
    CHECK (document_type IN (
      'MINISTERIAL_REGULATION', 'MINISTRY_ANNOUNCEMENT', 'DEPARTMENT_ANNOUNCEMENT',
      'REGULATION_REQUIREMENT', 'OTHER', 'RULE_AND_ANNOUNCEMENT'
    ));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    IF EXISTS (
      SELECT 1 FROM laws
      WHERE document_type IN ('MINISTRY_ANNOUNCEMENT', 'DEPARTMENT_ANNOUNCEMENT')
    )
    BEGIN
      THROW 51200, 'Cannot roll back law document types while new announcement types exist; use a forward migration.', 1;
    END;

    ALTER TABLE laws DROP CONSTRAINT ck_laws_document_type;
    ALTER TABLE laws WITH CHECK ADD CONSTRAINT ck_laws_document_type
    CHECK (document_type IN (
      'MINISTERIAL_REGULATION', 'RULE_AND_ANNOUNCEMENT', 'REGULATION_REQUIREMENT', 'OTHER'
    ));
  `);
}
