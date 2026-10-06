import type { Knex } from 'knex';

export const config = { transaction: true };
export const ACTIVE_REGISTRATION_INDEX = 'uq_eligible_factory_registration_active_new';
const ORIGINAL_REGISTRATION_INDEX = 'uq_eligible_factory_registration_new';

/** Only fixed, connection-local temp names are allowed for SQL Server fixtures. */
export function buildEligibleFactoryRegistrationIndexSql(
  direction: 'up' | 'down',
  mode: 'production' | 'fixture' = 'production',
): string {
  const table =
    mode === 'fixture' ? '[#registration_repair_eligible]' : '[dbo].[eligible_factories]';
  const object =
    mode === 'fixture' ? 'tempdb..#registration_repair_eligible' : 'dbo.eligible_factories';
  const metadata = mode === 'fixture' ? 'tempdb.sys' : 'sys';
  const normalizedFilter = `LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    COALESCE(i.filter_definition, N''), N' ', N''), N'[', N''), N']', N''), N'(', N''), N')', N''),
    NCHAR(9), N''), NCHAR(10), N''), NCHAR(13), N''))`;
  const expectedIndex = (indexId: string, filter: string): string => `
    SELECT 1 FROM ${metadata}.indexes i
    WHERE i.object_id = @object_id AND i.index_id = ${indexId}
      AND i.is_unique = 1 AND i.type = 2 AND i.is_primary_key = 0
      AND i.is_unique_constraint = 0 AND i.has_filter = 1
      AND i.is_disabled = 0 AND i.is_hypothetical = 0 AND i.ignore_dup_key = 0
      AND ${normalizedFilter} = N'${filter}'
      AND (SELECT COUNT(*) FROM ${metadata}.index_columns ic
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          AND ic.key_ordinal > 0) = 1
      AND NOT EXISTS (SELECT 1 FROM ${metadata}.index_columns ic
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          AND ic.is_included_column = 1)
      AND EXISTS (SELECT 1 FROM ${metadata}.index_columns ic
        INNER JOIN ${metadata}.columns c
          ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          AND ic.key_ordinal = 1 AND ic.is_descending_key = 0
          AND c.name = N'factory_registration_no_new')`;
  const header = `
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
IF @@TRANCOUNT = 0
  THROW 51360, 'Eligible registration index replacement requires an explicit transaction', 1;
DECLARE @object_id INT = OBJECT_ID(N'${object}');
IF @object_id IS NULL
  THROW 51361, 'Eligible registration index target table was not found', 1;
DECLARE @old_index_id INT = (SELECT index_id FROM ${metadata}.indexes
  WHERE object_id = @object_id AND name = N'${ORIGINAL_REGISTRATION_INDEX}');
DECLARE @active_index_id INT = (SELECT index_id FROM ${metadata}.indexes
  WHERE object_id = @object_id AND name = N'${ACTIVE_REGISTRATION_INDEX}');
IF @old_index_id IS NOT NULL AND NOT EXISTS (
  ${expectedIndex('@old_index_id', 'factory_registration_no_newisnotnull')}
)
  THROW 51362, 'Original eligible registration index differs from the reviewed shape', 1;
IF @active_index_id IS NOT NULL AND NOT EXISTS (
  ${expectedIndex('@active_index_id', 'deleted_atisnullandfactory_registration_no_newisnotnull')}
)
  THROW 51363, 'Active eligible registration index differs from the reviewed shape', 1;
IF @old_index_id IS NULL AND @active_index_id IS NULL
  THROW 51364, 'No reviewed eligible registration uniqueness index was found', 1;
IF EXISTS (SELECT 1 FROM ${metadata}.foreign_keys fk
  WHERE fk.referenced_object_id = @object_id AND fk.key_index_id = @old_index_id)
  THROW 51366, 'A foreign key depends on the original registration uniqueness index', 1;`;
  return direction === 'up'
    ? `${header}
IF EXISTS (SELECT factory_registration_no_new
  FROM ${table} WITH (UPDLOCK, HOLDLOCK)
  WHERE deleted_at IS NULL AND factory_registration_no_new IS NOT NULL
  GROUP BY factory_registration_no_new HAVING COUNT_BIG(*) > 1)
  THROW 51367, 'Active eligible factories contain duplicate registration numbers', 1;
IF @active_index_id IS NULL
BEGIN
  CREATE UNIQUE INDEX [${ACTIVE_REGISTRATION_INDEX}]
  ON ${table} ([factory_registration_no_new])
  WHERE [deleted_at] IS NULL AND [factory_registration_no_new] IS NOT NULL;
END;
-- Keep active uniqueness enforced continuously while removing the index that
-- incorrectly includes retired history. Foreign keys to the primary id remain.
IF @old_index_id IS NOT NULL
  DROP INDEX [${ORIGINAL_REGISTRATION_INDEX}] ON ${table};
SELECT 'active_registration_uniqueness' AS migration_action;
`
    : `${header}
IF EXISTS (SELECT factory_registration_no_new
  FROM ${table} WITH (UPDLOCK, HOLDLOCK)
  WHERE factory_registration_no_new IS NOT NULL
  GROUP BY factory_registration_no_new HAVING COUNT_BIG(*) > 1)
  THROW 51365, 'Cannot restore global registration uniqueness while history contains duplicates', 1;
IF @old_index_id IS NULL
BEGIN
  CREATE UNIQUE INDEX [${ORIGINAL_REGISTRATION_INDEX}]
  ON ${table} ([factory_registration_no_new])
  WHERE [factory_registration_no_new] IS NOT NULL;
END;
IF @active_index_id IS NOT NULL
  DROP INDEX [${ACTIVE_REGISTRATION_INDEX}] ON ${table};
SELECT 'original_registration_uniqueness' AS migration_action;
`;
}

export async function up(knex: Knex): Promise<void> {
  await knex.raw(buildEligibleFactoryRegistrationIndexSql('up'));
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(buildEligibleFactoryRegistrationIndexSql('down'));
}
