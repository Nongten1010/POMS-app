import type { Knex } from 'knex';

const REQUESTS_TABLE = 'cems_wpms_connection_requests';
const SEQUENCES_TABLE = 'cems_wpms_direct_request_sequences';
const SUBMISSION_SOURCE_CHECK = 'ck_cems_wpms_requests_submission_source';
const SUBMISSION_SOURCE_DEFAULT = 'df_cems_wpms_requests_submission_source';

const DIRECT_CONNECTION_PERMISSION = {
  code: 'cems_wpms_requests:direct_connect',
  resource: 'cems_wpms_requests',
  action: 'direct_connect',
  description: 'เพิ่มจุดตรวจวัดและเชื่อมต่อทันทีโดยเจ้าหน้าที่',
} as const;

const DIRECT_CONNECTION_ROLES = ['monitoring_kpm', 'admin'] as const;

type IdRow = { id: number };
type RoleRow = IdRow & { code: string };

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REQUESTS_TABLE, (table) => {
    table.specificType(
      'submission_source',
      `VARCHAR(32) NOT NULL CONSTRAINT ${SUBMISSION_SOURCE_DEFAULT} DEFAULT 'OPERATOR_FORM'`,
    );
  });

  await knex.schema.raw(`
    ALTER TABLE ${REQUESTS_TABLE}
    ADD CONSTRAINT ${SUBMISSION_SOURCE_CHECK}
    CHECK (submission_source IN ('OPERATOR_FORM', 'OFFICER_DIRECT_API'));
  `);

  await knex.schema.createTable(SEQUENCES_TABLE, (table) => {
    table.specificType('system_type', 'VARCHAR(8) NOT NULL');
    table.specificType('buddhist_year', 'CHAR(2) NOT NULL');
    table.specificType(
      'last_sequence',
      'INT NOT NULL CONSTRAINT df_cems_wpms_direct_request_sequences_last_sequence DEFAULT 0',
    );
    table.specificType(
      'updated_at',
      'DATETIME2 NOT NULL CONSTRAINT df_cems_wpms_direct_request_sequences_updated_at DEFAULT SYSDATETIME()',
    );
    table.primary(['system_type', 'buddhist_year'], {
      constraintName: 'pk_cems_wpms_direct_request_sequences',
    });
  });

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ck_cems_wpms_direct_request_sequences_system_type
    CHECK (system_type IN ('CEMS', 'WPMS'));
  `);

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ck_cems_wpms_direct_request_sequences_buddhist_year
    CHECK (buddhist_year LIKE '[0-9][0-9]');
  `);

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ck_cems_wpms_direct_request_sequences_last_sequence
    CHECK (last_sequence BETWEEN 0 AND 99999);
  `);

  await knex(SEQUENCES_TABLE).insert(buildSequenceRows());

  const permissionId = await upsertDirectConnectionPermission(knex);
  await upsertDirectConnectionRoleGrants(knex, permissionId);
}

export async function down(knex: Knex): Promise<void> {
  const permission = await knex<IdRow>('permissions')
    .where({ code: DIRECT_CONNECTION_PERMISSION.code })
    .first('id');

  if (permission) {
    await knex('role_permissions').where({ permission_id: permission.id }).del();
    await knex('user_permissions').where({ permission_id: permission.id }).del();
    await knex('permissions').where({ id: permission.id }).del();
  }

  await knex.schema.dropTableIfExists(SEQUENCES_TABLE);

  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = '${SUBMISSION_SOURCE_CHECK}'
        AND parent_object_id = OBJECT_ID('${REQUESTS_TABLE}')
    )
    BEGIN
      ALTER TABLE ${REQUESTS_TABLE} DROP CONSTRAINT ${SUBMISSION_SOURCE_CHECK};
    END;
  `);

  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.default_constraints
      WHERE name = '${SUBMISSION_SOURCE_DEFAULT}'
        AND parent_object_id = OBJECT_ID('${REQUESTS_TABLE}')
    )
    BEGIN
      ALTER TABLE ${REQUESTS_TABLE} DROP CONSTRAINT ${SUBMISSION_SOURCE_DEFAULT};
    END;
  `);

  await knex.schema.alterTable(REQUESTS_TABLE, (table) => {
    table.dropColumn('submission_source');
  });
}

function buildSequenceRows(): Array<{
  system_type: 'CEMS' | 'WPMS';
  buddhist_year: string;
  last_sequence: number;
}> {
  const years = Array.from({ length: 100 }, (_, year) => String(year).padStart(2, '0'));
  return (['CEMS', 'WPMS'] as const).flatMap((systemType) =>
    years.map((buddhistYear) => ({
      system_type: systemType,
      buddhist_year: buddhistYear,
      last_sequence: 0,
    })),
  );
}

async function upsertDirectConnectionPermission(knex: Knex): Promise<number> {
  const existing = await knex<IdRow>('permissions')
    .where({ code: DIRECT_CONNECTION_PERMISSION.code })
    .first('id');

  if (existing) {
    await knex('permissions').where({ id: existing.id }).update({
      resource: DIRECT_CONNECTION_PERMISSION.resource,
      action: DIRECT_CONNECTION_PERMISSION.action,
      description: DIRECT_CONNECTION_PERMISSION.description,
    });
    return Number(existing.id);
  }

  await knex('permissions').insert(DIRECT_CONNECTION_PERMISSION);
  const created = await knex<IdRow>('permissions')
    .where({ code: DIRECT_CONNECTION_PERMISSION.code })
    .first('id');

  if (!created) {
    throw new Error(`Failed to create permission ${DIRECT_CONNECTION_PERMISSION.code}`);
  }

  return Number(created.id);
}

async function upsertDirectConnectionRoleGrants(knex: Knex, permissionId: number): Promise<void> {
  const roles = await knex<RoleRow>('roles')
    .select('id', 'code')
    .whereIn('code', DIRECT_CONNECTION_ROLES);

  for (const role of roles) {
    const existing = await knex('role_permissions')
      .where({ role_id: role.id, permission_id: permissionId })
      .first('role_id');

    if (existing) {
      await knex('role_permissions')
        .where({ role_id: role.id, permission_id: permissionId })
        .update({ scope: 'ALL' });
    } else {
      await knex('role_permissions').insert({
        role_id: role.id,
        permission_id: permissionId,
        scope: 'ALL',
      });
    }
  }
}
