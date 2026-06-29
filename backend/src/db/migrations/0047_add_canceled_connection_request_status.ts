import type { Knex } from 'knex';

const CONSTRAINT_NAME = 'ck_cems_wpms_requests_status';

const STATUSES_WITH_CANCELED = [
  'PENDING_DESIGN_REVIEW',
  'WAITING_CONNECTION',
  'WAITING_FACTORY_REVISION',
  'REVISED_PENDING_DESIGN_REVIEW',
  'CONNECTION_CONFIRMED',
  'CONNECTED',
  'CANCELED',
];

const STATUSES_WITHOUT_CANCELED = STATUSES_WITH_CANCELED.filter((status) => status !== 'CANCELED');

export async function up(knex: Knex): Promise<void> {
  await replaceStatusConstraint(knex, STATUSES_WITH_CANCELED);
}

export async function down(knex: Knex): Promise<void> {
  await replaceStatusConstraint(knex, STATUSES_WITHOUT_CANCELED);
}

async function replaceStatusConstraint(knex: Knex, statuses: string[]): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = '${CONSTRAINT_NAME}'
        AND parent_object_id = OBJECT_ID('cems_wpms_connection_requests')
    )
    BEGIN
      ALTER TABLE cems_wpms_connection_requests DROP CONSTRAINT ${CONSTRAINT_NAME};
    END;
  `);

  await knex.schema.raw(`
    ALTER TABLE cems_wpms_connection_requests
    ADD CONSTRAINT ${CONSTRAINT_NAME}
    CHECK (status IN (${statuses.map((status) => `'${status}'`).join(', ')}));
  `);
}
