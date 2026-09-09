import type { Knex } from 'knex';

const EVENTS_TABLE = 'poms_factory_edit_request_events';
const EVENT_TRANSITION_CONSTRAINT = 'ck_poms_factory_edit_request_events_transition';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await replaceTransitionConstraint(knex, true);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1 FROM ${EVENTS_TABLE}
      WHERE action = 'CANCEL' AND from_status = 'REJECTED'
    )
    BEGIN
      THROW 50001, 'Cannot roll back rejected-request cancellation while its audit data exists', 1;
    END;
  `);
  await replaceTransitionConstraint(knex, false);
}

async function replaceTransitionConstraint(knex: Knex, allowRejected: boolean): Promise<void> {
  const cancellableStatuses =
    "'PENDING_REVIEW', 'REVISION_REQUESTED', 'REVISED_PENDING_REVIEW'" +
    (allowRejected ? ", 'REJECTED'" : '');
  await knex.schema.raw(`
    ALTER TABLE ${EVENTS_TABLE} DROP CONSTRAINT ${EVENT_TRANSITION_CONSTRAINT};
    ALTER TABLE ${EVENTS_TABLE}
    WITH CHECK ADD CONSTRAINT ${EVENT_TRANSITION_CONSTRAINT}
    CHECK (
      (action = 'SUBMIT' AND from_status IS NULL AND to_status = 'PENDING_REVIEW')
      OR (
        action = 'RESUBMIT'
        AND from_status = 'REVISION_REQUESTED'
        AND to_status = 'REVISED_PENDING_REVIEW'
      )
      OR (
        action = 'REQUEST_REVISION'
        AND from_status IN ('PENDING_REVIEW', 'REVISED_PENDING_REVIEW')
        AND to_status = 'REVISION_REQUESTED'
      )
      OR (
        action = 'APPROVE'
        AND from_status IN ('PENDING_REVIEW', 'REVISED_PENDING_REVIEW')
        AND to_status = 'APPROVED'
      )
      OR (
        action = 'REJECT'
        AND from_status IN ('PENDING_REVIEW', 'REVISED_PENDING_REVIEW')
        AND to_status = 'REJECTED'
      )
      OR (
        action = 'CANCEL'
        AND from_status IN (${cancellableStatuses})
        AND to_status = 'CANCELLED'
      )
    );

    ALTER TABLE ${EVENTS_TABLE} CHECK CONSTRAINT ${EVENT_TRANSITION_CONSTRAINT};
  `);
}
