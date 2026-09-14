import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('faqs', (table) => {
    table.specificType('links_json', 'NVARCHAR(MAX) NULL');
    table.specificType('attachments_json', 'NVARCHAR(MAX) NULL');
  });
  await knex.raw(
    `ALTER TABLE faqs ADD CONSTRAINT ck_faqs_links_json CHECK (links_json IS NULL OR ISJSON(links_json) = 1)`,
  );
  await knex.raw(
    `ALTER TABLE faqs ADD CONSTRAINT ck_faqs_attachments_json CHECK (attachments_json IS NULL OR ISJSON(attachments_json) = 1)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE faqs DROP CONSTRAINT ck_faqs_links_json, ck_faqs_attachments_json');
  await knex.schema.alterTable('faqs', (table) =>
    table.dropColumns('links_json', 'attachments_json'),
  );
}
