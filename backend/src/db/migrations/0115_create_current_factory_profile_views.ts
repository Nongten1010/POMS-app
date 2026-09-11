import type { Knex } from 'knex';

export const config = { transaction: true };

const ELIGIBLE_COLUMNS = {
  factory_name: 'factory_name',
  address: 'address',
  province_name: 'province_name',
  industrial_estate_name: 'industrial_estate_name',
  latitude: 'latitude',
  longitude: 'longitude',
  eia_assessment: 'eia_assessment',
  eia_other: 'eia_other',
  has_eia: 'has_eia',
  project_name: 'project_name',
  business_activity: 'business_activity',
  factory_type_sequence: 'factory_type_sequence',
};

const CONNECTED_COLUMNS = {
  factory_name: 'factory_name',
  factory_address: 'address',
  factory_latitude: 'latitude',
  factory_longitude: 'longitude',
  factory_eia_assessment: 'eia_assessment',
  factory_eia_other: 'eia_other',
  factory_has_eia: 'has_eia',
  factory_project_name: 'project_name',
  factory_front_photos_json: 'front_photos_json',
  factory_logo_json: 'logo_json',
};

const FORM_COLUMNS = {
  factory_name: 'factory_name',
  address: 'address',
  province_name: 'province_name',
  latitude: 'latitude',
  longitude: 'longitude',
  business_activity: 'business_activity',
  project_name: 'project_name',
  eia_other: 'eia_other',
  // eia_info is a historical free-text form value, not the constrained assessment.
  // Preserve its contract until callers explicitly normalize that domain field.
};

const PROFILE_VERSION_COLUMNS =
  ', fp.[revision] AS [factory_profile_revision], fp.[updated_at] AS [factory_profile_updated_at]';

// All identifiers and mappings below are constants owned by this migration.
// sys.columns expands the existing schema in column order; QUOTENAME protects
// unmapped names and prevents duplicate IDs/status fields from SELECT base.*, fp.*.
function createViewSql(
  view: string,
  table: string,
  columns: Record<string, string>,
  join: string,
  extraColumns = '',
): string {
  const replacements = Object.entries(columns)
    .map(
      ([baseColumn, profileColumn]) =>
        `WHEN N'${baseColumn}' THEN N'CASE WHEN fp.[id] IS NOT NULL THEN fp.[${profileColumn}] ELSE base.[${baseColumn}] END AS [${baseColumn}]'`,
    )
    .join('\n            ');
  return `
    IF OBJECT_ID(N'dbo.${table}', N'U') IS NULL
    BEGIN
      THROW 51141, N'Factory profile view source table is missing.', 1;
    END;

    DECLARE @select_list NVARCHAR(MAX);
    SELECT @select_list = STUFF((
      SELECT N', ' + CASE name
            ${replacements}
            ELSE N'base.' + QUOTENAME(name)
          END
      FROM sys.columns
      WHERE object_id = OBJECT_ID(N'dbo.${table}', N'U')
      ORDER BY column_id
      FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, N'');

    DECLARE @definition NVARCHAR(MAX) = N'CREATE VIEW [dbo].[${view}] AS SELECT '
      + @select_list + N'${extraColumns} FROM [dbo].[${table}] AS base ${join}';
    EXEC sys.sp_executesql @definition;
  `;
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(
    createViewSql(
      'current_eligible_factories',
      'eligible_factories',
      ELIGIBLE_COLUMNS,
      'LEFT JOIN [dbo].[factory_profiles] AS fp ON fp.[eligible_factory_id] = base.[id]',
      PROFILE_VERSION_COLUMNS,
    ),
  );
  await knex.schema.raw(
    createViewSql(
      'current_connected_measurement_points',
      'cems_wpms_connected_measurement_points',
      CONNECTED_COLUMNS,
      'LEFT JOIN [dbo].[factory_profiles] AS fp ON fp.[eligible_factory_id] = base.[eligible_factory_id]',
      PROFILE_VERSION_COLUMNS,
    ),
  );
  await knex.schema.raw(
    createViewSql(
      'current_factory_monitoring_point_forms',
      'factory_monitoring_point_forms',
      FORM_COLUMNS,
      'LEFT JOIN [dbo].[eligible_factories] AS ef ON ef.[monitoring_point_form_id] = base.[id] AND ef.[deleted_at] IS NULL ' +
        'LEFT JOIN [dbo].[factory_profiles] AS fp ON fp.[eligible_factory_id] = ef.[id]',
    ),
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (SELECT 1 FROM factory_profiles) OR EXISTS (SELECT 1 FROM factory_profile_events)
    BEGIN
      THROW 51142, N'Factory profiles contain data; retain current views and use a forward migration.', 1;
    END;
    DROP VIEW [dbo].[current_factory_monitoring_point_forms];
    DROP VIEW [dbo].[current_connected_measurement_points];
    DROP VIEW [dbo].[current_eligible_factories];
  `);
}
