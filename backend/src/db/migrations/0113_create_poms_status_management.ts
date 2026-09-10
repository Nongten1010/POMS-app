import type { Knex } from 'knex';
const STATUS = 'poms_factory_status_management';
const EVENTS = 'poms_factory_status_events';
export const config = { transaction: true };
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(STATUS, (table) => {
    table
      .bigInteger('eligible_factory_id')
      .notNullable()
      .primary()
      .references('id')
      .inTable('eligible_factories');
    table.specificType('state_json', 'NVARCHAR(MAX) NOT NULL');
    table.integer('revision').notNullable();
    table.specificType('updated_at', 'DATETIME2 NOT NULL');
    table.bigInteger('updated_by').notNullable().references('id').inTable('users');
  });
  await knex.schema.createTable(EVENTS, (table) => {
    table.bigIncrements('id').primary();
    table
      .bigInteger('eligible_factory_id')
      .notNullable()
      .references('id')
      .inTable('eligible_factories');
    table.integer('revision').notNullable();
    table.bigInteger('actor_user_id').notNullable().references('id').inTable('users');
    table.specificType('reason', 'NVARCHAR(1000) NOT NULL');
    table.specificType('before_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('after_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('changes_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL');
    table.unique(['eligible_factory_id', 'revision'], 'uq_poms_factory_status_event_revision');
  });
  await knex.schema
    .raw(`ALTER TABLE ${STATUS} ADD CONSTRAINT ck_poms_factory_status_json CHECK (ISJSON(state_json) = 1);
    ALTER TABLE ${STATUS} ADD CONSTRAINT ck_poms_factory_status_revision CHECK (revision > 0);
    ALTER TABLE ${EVENTS} ADD CONSTRAINT ck_poms_factory_status_event_json CHECK (ISJSON(before_json) = 1 AND ISJSON(after_json) = 1 AND ISJSON(changes_json) = 1);
    ALTER TABLE ${EVENTS} ADD CONSTRAINT ck_poms_factory_status_event_revision CHECK (revision > 0);
    ALTER TABLE ${EVENTS} ADD CONSTRAINT ck_poms_factory_status_reason CHECK (LEN(LTRIM(RTRIM(reason))) > 0);`);
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(EVENTS);
  await knex.schema.dropTable(STATUS);
}
