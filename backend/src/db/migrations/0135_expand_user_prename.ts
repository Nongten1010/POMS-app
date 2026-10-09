import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw('ALTER TABLE users ALTER COLUMN prename_th NVARCHAR(64) NULL;');
}

export async function down(knex: Knex): Promise<void> {
  // DATALENGTH includes trailing spaces and measures NVARCHAR's UTF-16 storage.
  // Keep writes blocked until the transaction finishes shrinking the column.
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1 FROM users WITH (TABLOCKX, HOLDLOCK)
      WHERE DATALENGTH(prename_th) > 32
    )
    BEGIN
      THROW 50135, 'Cannot shrink users.prename_th while longer values exist.', 1;
    END;
  `);
  await knex.schema.raw('ALTER TABLE users ALTER COLUMN prename_th NVARCHAR(16) NULL;');
}
