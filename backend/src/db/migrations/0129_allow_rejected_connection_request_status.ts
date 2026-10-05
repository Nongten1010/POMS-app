import type { Knex } from 'knex';

export const config = { transaction: true };
const constraintName = 'ck_cems_wpms_requests_status';
const existingStatuses = [
  'PENDING_DESIGN_REVIEW',
  'WAITING_CONNECTION',
  'WAITING_FACTORY_REVISION',
  'REVISED_PENDING_DESIGN_REVIEW',
  'CONNECTION_CONFIRMED',
  'CONNECTED',
  'CANCELED',
];

export async function up(knex: Knex): Promise<void> {
  await replaceStatusConstraint(knex, [...existingStatuses, 'REJECTED']);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (SELECT 1 FROM cems_wpms_connection_requests WHERE status = 'REJECTED')
      THROW 50001, 'Cannot remove REJECTED status while rejected connection requests exist', 1;
  `);
  await replaceStatusConstraint(knex, existingStatuses);
}

async function replaceStatusConstraint(knex: Knex, statuses: string[]): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1 FROM sys.check_constraints
      WHERE name = '${constraintName}'
        AND parent_object_id = OBJECT_ID('cems_wpms_connection_requests')
    )
      ALTER TABLE cems_wpms_connection_requests DROP CONSTRAINT ${constraintName};
    ALTER TABLE cems_wpms_connection_requests WITH CHECK ADD CONSTRAINT ${constraintName}
      CHECK (status IN (${statuses.map((status) => `'${status}'`).join(', ')}));
    ALTER TABLE cems_wpms_connection_requests CHECK CONSTRAINT ${constraintName};
  `);
}
