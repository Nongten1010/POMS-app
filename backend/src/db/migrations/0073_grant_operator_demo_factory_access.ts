import type { Knex } from 'knex';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';

export const TARGET_OPERATOR_EXTERNAL_ID = '3191000135709';
export const TARGET_FACTORY_FID = '10120000325542';
export const MANUAL_FACTORY_JURISTIC_ID = '9900000009999';

const EXTERNAL_QUERY_TIMEOUT_MS = 300000;

// Keep the schema creation, factory hydration, and access grant atomic.
export const config = { transaction: true } as const;

interface OperatorRow {
  id: number | string;
}

interface FactorySourceRow {
  FID: string | null;
  FACREG: string | null;
  DISPFACREG: string | null;
  FNAME: string | null;
  PROV: string | number | null;
  CLASS: string | null;
  OBJECT: string | null;
  FFLAG: string | number | null;
}

export interface FactoryAccessGrant {
  userId: number;
  factoryFid: string;
  syntheticJuristicId: string;
  factoryName: string;
  provinceId: string;
  oldRegistrationNo: string | null;
  factoryTypeSequence: string | null;
  businessActivity: string | null;
  operationStatus: string;
}

export async function up(knex: Knex): Promise<void> {
  await ensureUserFactoryAccessTable(knex);

  const operator = await knex<OperatorRow>('users')
    .where({ external_id: TARGET_OPERATOR_EXTERNAL_ID, user_type: 'operator' })
    .whereNull('deleted_at')
    .first('id');
  if (!operator) return;

  await grantTargetOperatorFactoryAccess(knex, Number(operator.id));
}

export async function grantTargetOperatorFactoryAccess(knex: Knex, userId: number): Promise<void> {
  const source = await factorySourceDb<FactorySourceRow>(factorySourceTableName())
    .where('FID', TARGET_FACTORY_FID)
    .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
    .first('FID', 'FACREG', 'DISPFACREG', 'FNAME', 'PROV', 'CLASS', 'OBJECT', 'FFLAG');
  if (!source) {
    throw new Error(`Factory ${TARGET_FACTORY_FID} was not found in the DIW factory source`);
  }

  const grant = buildFactoryAccessGrant(userId, source);
  await knex.raw(GRANT_FACTORY_ACCESS_SQL, grantBindings(grant));
}

async function ensureUserFactoryAccessTable(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('user_factory_access')) return;

  await knex.schema.createTable('user_factory_access', (table) => {
    table.bigInteger('user_id').notNullable();
    table.bigInteger('factory_id').notNullable();
    table.specificType('granted_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    table.specificType('revoked_at', 'DATETIME2 NULL');
    table.primary(['user_id', 'factory_id'], { constraintName: 'pk_user_factory_access' });
    table.foreign('user_id', 'fk_ufa_user').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('factory_id', 'fk_ufa_factory').references('id').inTable('factories');
  });
}

export async function down(_knex: Knex): Promise<void> {
  // One-way production data grant: rolling back must not revoke access that may have been
  // confirmed or updated after deployment.
}

export function buildFactoryAccessGrant(
  userId: number,
  source: FactorySourceRow,
): FactoryAccessGrant {
  const fid = normalizedText(source.FID);
  const factoryName = normalizedText(source.FNAME);
  const provinceId = toPomsProvinceId(source.PROV);
  if (fid !== TARGET_FACTORY_FID) {
    throw new Error(`Unexpected factory source FID: ${fid ?? 'missing'}`);
  }
  if (!factoryName) {
    throw new Error(`Factory ${TARGET_FACTORY_FID} is missing FNAME in the DIW factory source`);
  }
  if (!provinceId) {
    throw new Error(`Factory ${TARGET_FACTORY_FID} has an invalid province code`);
  }

  return {
    userId,
    factoryFid: fid,
    syntheticJuristicId: MANUAL_FACTORY_JURISTIC_ID,
    factoryName,
    provinceId,
    oldRegistrationNo: firstDifferentText(TARGET_FACTORY_FID, source.DISPFACREG, source.FACREG),
    factoryTypeSequence: normalizedText(source.CLASS),
    businessActivity: normalizedText(source.OBJECT),
    operationStatus: operationStatus(source.FFLAG),
  };
}

function grantBindings(grant: FactoryAccessGrant): Knex.Value[] {
  return [
    grant.userId,
    grant.factoryFid,
    grant.syntheticJuristicId,
    grant.factoryName,
    grant.provinceId,
    grant.oldRegistrationNo,
    grant.factoryTypeSequence,
    grant.businessActivity,
    grant.operationStatus,
  ];
}

function toPomsProvinceId(value: string | number | null): string | null {
  const text = normalizedText(value);
  if (!text) return null;
  const numeric = Number(text);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 99) return null;
  return `10${String(numeric).padStart(2, '0')}`;
}

function operationStatus(value: string | number | null): string {
  const normalized = normalizedText(value);
  if (normalized === '1') return 'แจ้งประกอบแล้ว';
  if (normalized === '3') return 'หยุดชั่วคราว';
  return normalized ? `สถานะ ${normalized}` : 'ไม่ระบุสถานะ';
}

function firstDifferentText(
  excluded: string,
  ...values: Array<string | number | null | undefined>
): string | null {
  for (const value of values) {
    const normalized = normalizedText(value);
    if (normalized && normalized !== excluded) return normalized;
  }
  return null;
}

function normalizedText(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

const GRANT_FACTORY_ACCESS_SQL = `
DECLARE @user_id BIGINT = ?;
DECLARE @factory_fid VARCHAR(20) = ?;
DECLARE @synthetic_juristic_id VARCHAR(13) = ?;
DECLARE @factory_name NVARCHAR(500) = ?;
DECLARE @province_id VARCHAR(8) = ?;
DECLARE @old_registration_no NVARCHAR(64) = ?;
DECLARE @factory_type_sequence NVARCHAR(128) = ?;
DECLARE @business_activity NVARCHAR(MAX) = ?;
DECLARE @operation_status NVARCHAR(64) = ?;
DECLARE @province_name NVARCHAR(128);
DECLARE @juristic_db_id BIGINT;
DECLARE @factory_db_id BIGINT;

SELECT @province_name = name_th
FROM provinces
WHERE id = @province_id;

IF @province_name IS NULL
  THROW 51073, 'Target factory province is not provisioned in POMS', 1;

SELECT TOP (1)
  @factory_db_id = id,
  @juristic_db_id = juristic_id
FROM factories
WHERE fid = @factory_fid
ORDER BY CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END, id;

IF @juristic_db_id IS NULL
BEGIN
  SELECT @juristic_db_id = id
  FROM juristics
  WHERE juristic_id = @synthetic_juristic_id;

  IF @juristic_db_id IS NULL
  BEGIN
    INSERT INTO juristics (
      juristic_id,
      name_th,
      name_en,
      created_by,
      updated_by
    )
    VALUES (
      @synthetic_juristic_id,
      @factory_name,
      NULL,
      @user_id,
      @user_id
    );
    SET @juristic_db_id = SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    UPDATE juristics
    SET name_th = @factory_name,
        deleted_at = NULL,
        updated_by = @user_id,
        updated_at = SYSDATETIME()
    WHERE id = @juristic_db_id;
  END;

  INSERT INTO factories (
    fid,
    code,
    name,
    juristic_id,
    province_id,
    system_id,
    verify_status,
    is_active,
    created_by,
    updated_by
  )
  VALUES (
    @factory_fid,
    @factory_fid,
    @factory_name,
    @juristic_db_id,
    @province_id,
    12,
    0,
    1,
    @user_id,
    @user_id
  );
  SET @factory_db_id = SCOPE_IDENTITY();
END
ELSE
BEGIN
  UPDATE factories
  SET name = COALESCE(NULLIF(name, N''), @factory_name),
      is_active = 1,
      deleted_at = NULL,
      updated_by = @user_id,
      updated_at = SYSDATETIME()
  WHERE id = @factory_db_id;

  UPDATE juristics
  SET deleted_at = NULL,
      updated_by = @user_id,
      updated_at = SYSDATETIME()
  WHERE id = @juristic_db_id
    AND deleted_at IS NOT NULL;
END;

IF EXISTS (
  SELECT 1
  FROM eligible_factories
  WHERE factory_registration_no_new = @factory_fid
)
BEGIN
  UPDATE eligible_factories
  SET source_factory_id = @factory_fid,
      factory_name = @factory_name,
      factory_registration_no_old = COALESCE(@old_registration_no, factory_registration_no_old),
      factory_type_sequence = COALESCE(@factory_type_sequence, factory_type_sequence),
      province_name = @province_name,
      business_activity = COALESCE(@business_activity, business_activity),
      operation_status = @operation_status,
      deleted_at = NULL,
      updated_by = @user_id,
      updated_at = SYSDATETIME()
  WHERE factory_registration_no_new = @factory_fid;
END
ELSE
BEGIN
  INSERT INTO eligible_factories (
    source_system,
    source_factory_id,
    factory_registration_no_new,
    factory_registration_no_old,
    factory_name,
    factory_type_sequence,
    province_name,
    business_activity,
    operation_status,
    selected_reason,
    selected_by,
    created_by,
    updated_by
  )
  VALUES (
    'diw.fac_import',
    @factory_fid,
    @factory_fid,
    @old_registration_no,
    @factory_name,
    @factory_type_sequence,
    @province_name,
    @business_activity,
    @operation_status,
    N'เพิ่มสิทธิ์โรงงานให้ผู้ประกอบการตามคำขอ',
    @user_id,
    @user_id,
    @user_id
  );
END;

IF NOT EXISTS (
  SELECT 1
  FROM user_factory_access
  WHERE user_id = @user_id
    AND factory_id = @factory_db_id
)
BEGIN
  INSERT INTO user_factory_access (user_id, factory_id)
  VALUES (@user_id, @factory_db_id);
END;
`;
