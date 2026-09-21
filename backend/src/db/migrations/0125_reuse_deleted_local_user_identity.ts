import type { Knex } from 'knex';

export const config = { transaction: true };

const FILTERED_INDEX_OPTIONS = `
  SET ANSI_NULLS, ANSI_PADDING, ANSI_WARNINGS, ARITHABORT,
    CONCAT_NULL_YIELDS_NULL, QUOTED_IDENTIFIER ON;
  SET NUMERIC_ROUNDABORT OFF;
`;

export async function up(knex: Knex): Promise<void> {
  // Replace uniqueness rules only; historical users and every user_id reference stay intact.
  await knex.raw(`
    ${FILTERED_INDEX_OPTIONS}

    IF EXISTS (
      SELECT 1 FROM sys.key_constraints
      WHERE parent_object_id = OBJECT_ID('users')
        AND name = 'uq_users_provider' AND type = 'UQ'
    )
    BEGIN
      ALTER TABLE users DROP CONSTRAINT uq_users_provider;
    END
    ELSE
    BEGIN
      DROP INDEX uq_users_provider ON users;
    END;

    CREATE UNIQUE INDEX uq_users_provider
      ON users(identity_provider, external_id)
      WHERE identity_provider = 'local' AND deleted_at IS NULL;

    CREATE UNIQUE INDEX uq_users_external_provider
      ON users(identity_provider, external_id)
      WHERE identity_provider <> 'local';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ${FILTERED_INDEX_OPTIONS}

    -- Keep the check and schema change serialized with concurrent account creation.
    IF EXISTS (
      SELECT 1 FROM users WITH (TABLOCKX, HOLDLOCK)
      GROUP BY identity_provider, external_id
      HAVING COUNT_BIG(*) > 1
    )
    BEGIN
      THROW 51125, 'Cannot restore reserved user identities after username reuse; retain current indexes and use a forward migration.', 1;
    END;

    DROP INDEX uq_users_provider ON users;
    DROP INDEX uq_users_external_provider ON users;

    ALTER TABLE users ADD CONSTRAINT uq_users_provider
      UNIQUE (identity_provider, external_id);
  `);
}
