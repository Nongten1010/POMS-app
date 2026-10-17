import type { Knex } from 'knex';

export const config = { transaction: true };

function actorColumns(table: Knex.CreateTableBuilder, prefix: string): void {
  const id = table.bigInteger(`${prefix}_id`).references('id').inTable('users');
  const name = table.string(`${prefix}_name`, 512);
  const code = table.string(`${prefix}_role_code`, 64);
  const label = table.string(`${prefix}_role_label`, 128);
  for (const column of [id, name, code, label]) column.notNullable();
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chat_ticket_sequences', (table) => {
    table.integer('year').primary();
    table.integer('last_number').notNullable();
    table.check('last_number >= 1 AND last_number <= 99999', [], 'ck_chat_sequence_range');
  });
  await knex.schema.createTable('chat_tickets', (table) => {
    table.bigIncrements('id').primary();
    table.string('ticket_no', 16).notNullable().unique();
    table
      .bigInteger('eligible_factory_id')
      .notNullable()
      .references('id')
      .inTable('eligible_factories');
    table
      .bigInteger('eligible_point_id')
      .nullable()
      .references('id')
      .inTable('factory_monitoring_points');
    table
      .bigInteger('connected_point_id')
      .nullable()
      .references('id')
      .inTable('cems_wpms_connected_measurement_points');
    table.string('topic_code', 40).notNullable();
    table.string('topic_label', 128).notNullable();
    table.string('factory_name', 500).notNullable();
    table.string('factory_registration_no', 100).notNullable();
    table.string('province_name', 128).notNullable();
    table.string('region_name', 100).nullable();
    table.string('point_system_type', 4).nullable();
    table.string('point_code', 100).nullable();
    table.string('point_name', 255).nullable();
    table.string('status', 6).notNullable().defaultTo('open');
    table.bigInteger('opened_by').notNullable().references('id').inTable('users');
    table.string('opened_by_name', 512).notNullable();
    table.string('opened_by_role_code', 64).notNullable();
    table.string('opened_by_role_label', 128).notNullable();
    table.specificType('opened_at', 'DATETIME2').notNullable();
    table.bigInteger('closed_by').nullable().references('id').inTable('users');
    table.string('closed_by_name', 512).nullable();
    table.string('closed_by_role_code', 64).nullable();
    table.string('closed_by_role_label', 128).nullable();
    table.specificType('closed_at', 'DATETIME2').nullable();
    table.specificType('last_message_at', 'DATETIME2').notNullable();
    table.string('creation_key', 128).notNullable();
    table.string('creation_hash', 64).notNullable();
    table.unique(['opened_by', 'creation_key'], { indexName: 'uq_chat_ticket_creation' });
    table.check(
      'eligible_point_id IS NULL OR connected_point_id IS NULL',
      [],
      'ck_chat_ticket_single_point',
    );
    table.check("status IN ('open', 'closed')", [], 'ck_chat_ticket_status');
    table.index(['eligible_factory_id', 'last_message_at', 'id'], 'ix_chat_ticket_factory_latest');
    table.index(['last_message_at', 'id'], 'ix_chat_ticket_latest');
  });
  await knex.schema.createTable('chat_messages', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('ticket_id').notNullable().references('id').inTable('chat_tickets');
    actorColumns(table, 'sender');
    table.string('body', 2000).notNullable();
    table.specificType('created_at', 'DATETIME2').notNullable();
    table.string('idempotency_key', 128).nullable();
    table.string('request_hash', 64).nullable();
    table.index(['ticket_id', 'id'], 'ix_chat_messages_ticket_order');
  });
  await knex.schema.raw(
    'CREATE UNIQUE INDEX uq_chat_message_idempotency ON chat_messages(sender_id, ticket_id, idempotency_key) WHERE idempotency_key IS NOT NULL',
  );
  await knex.schema.createTable('chat_ticket_events', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('ticket_id').notNullable().references('id').inTable('chat_tickets');
    table.string('event_type', 6).notNullable();
    actorColumns(table, 'actor');
    table.specificType('created_at', 'DATETIME2').notNullable();
    table.check("event_type IN ('opened', 'closed')", [], 'ck_chat_event_type');
    table.unique(['ticket_id', 'event_type'], { indexName: 'uq_chat_ticket_event_type' });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('chat_ticket_events');
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_tickets');
  await knex.schema.dropTableIfExists('chat_ticket_sequences');
}
