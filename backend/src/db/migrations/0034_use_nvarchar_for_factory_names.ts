import type { Knex } from 'knex';

const factoryNameColumns = [
  { table: 'factories', column: 'name', nullable: false },
  { table: 'eligible_factories', column: 'factory_name', nullable: false },
  { table: 'cems_wpms_connection_requests', column: 'factory_name', nullable: false },
  { table: 'cems_wpms_connected_measurement_points', column: 'factory_name', nullable: false },
] as const;

export async function up(knex: Knex): Promise<void> {
  for (const item of factoryNameColumns) {
    await alterFactoryNameColumn(knex, item.table, item.column, item.nullable, 'NVARCHAR(500)');
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const item of factoryNameColumns) {
    await alterFactoryNameColumn(knex, item.table, item.column, item.nullable, 'VARCHAR(500)');
  }
}

async function alterFactoryNameColumn(
  knex: Knex,
  tableName: string,
  columnName: string,
  nullable: boolean,
  sqlType: 'NVARCHAR(500)' | 'VARCHAR(500)',
): Promise<void> {
  const nullability = nullable ? 'NULL' : 'NOT NULL';
  await knex.schema.raw(`
    IF OBJECT_ID(N'${tableName}', N'U') IS NOT NULL
      AND COL_LENGTH(N'${tableName}', N'${columnName}') IS NOT NULL
    BEGIN
      ALTER TABLE ${tableName}
      ALTER COLUMN ${columnName} ${sqlType} ${nullability};
    END
  `);
}
