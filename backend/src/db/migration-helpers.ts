import type { Knex } from 'knex';

/**
 * Helpers สำหรับ Knex migrations — รวม MSSQL-specific patterns ที่ใช้บ่อย
 * - DATETIME2 + SYSDATETIME() default (Asia/Bangkok timezone, server-local)
 * - audit columns (created_at, updated_at, created_by, updated_by, deleted_at)
 */

export function addTimestamps(table: Knex.CreateTableBuilder): void {
  table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
  table.specificType('updated_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
}

export function addSoftDelete(table: Knex.CreateTableBuilder): void {
  table.specificType('deleted_at', 'DATETIME2 NULL');
}

/**
 * Audit columns: created_at, updated_at, created_by, updated_by, deleted_at
 * NOTE: created_by/updated_by เป็น BIGINT NULL — ไม่ใส่ FK constraint
 * เพื่อหลีกเลี่ยง circular FK กับ users table (users.created_by → users.id)
 */
export function addAuditColumns(table: Knex.CreateTableBuilder): void {
  addTimestamps(table);
  table.bigInteger('created_by').nullable();
  table.bigInteger('updated_by').nullable();
  addSoftDelete(table);
}
