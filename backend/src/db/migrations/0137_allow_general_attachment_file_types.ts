import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE factory_monitoring_point_attachments DROP CONSTRAINT ck_fmp_attachments_mime_type;
    ALTER TABLE factory_monitoring_point_attachments ALTER COLUMN mime_type VARCHAR(128) NOT NULL;
    ALTER TABLE factory_monitoring_point_attachments WITH CHECK
      ADD CONSTRAINT ck_fmp_attachments_mime_type CHECK (LEN(mime_type) > 0 AND mime_type LIKE '%/%');
    ALTER TABLE laws DROP CONSTRAINT ck_laws_mime_type;
    ALTER TABLE laws WITH CHECK
      ADD CONSTRAINT ck_laws_mime_type CHECK (LEN(mime_type) > 0 AND mime_type LIKE '%/%');
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Refuse a rollback that would invalidate or remove files accepted after this migration.
  await knex.schema.raw(`
    IF EXISTS (SELECT 1 FROM factory_monitoring_point_attachments WHERE mime_type NOT IN ('image/jpeg', 'image/png', 'application/pdf'))
      OR EXISTS (SELECT 1 FROM laws WHERE mime_type <> 'application/pdf')
      THROW 50000, 'Cannot roll back general uploads while new file types exist; retain migration or migrate those records first.', 1;

    ALTER TABLE factory_monitoring_point_attachments DROP CONSTRAINT ck_fmp_attachments_mime_type;
    ALTER TABLE factory_monitoring_point_attachments ALTER COLUMN mime_type VARCHAR(64) NOT NULL;
    ALTER TABLE factory_monitoring_point_attachments WITH CHECK
      ADD CONSTRAINT ck_fmp_attachments_mime_type CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf'));
    ALTER TABLE laws DROP CONSTRAINT ck_laws_mime_type;
    ALTER TABLE laws WITH CHECK
      ADD CONSTRAINT ck_laws_mime_type CHECK (mime_type = 'application/pdf');
  `);
}
