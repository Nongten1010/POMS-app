import type { Knex } from 'knex';

const REQUESTS_TABLE = 'poms_factory_edit_requests';
const EVENTS_TABLE = 'poms_factory_edit_request_events';

const REQUEST_STATUS_CONSTRAINT = 'ck_poms_factory_edit_requests_status';
const REQUEST_STATE_CONSTRAINT = 'ck_poms_factory_edit_requests_state';
const EVENT_ACTION_CONSTRAINT = 'ck_poms_factory_edit_request_events_action';
const EVENT_FROM_STATUS_CONSTRAINT = 'ck_poms_factory_edit_request_events_from_status';
const EVENT_TO_STATUS_CONSTRAINT = 'ck_poms_factory_edit_request_events_to_status';
const EVENT_TRANSITION_CONSTRAINT = 'ck_poms_factory_edit_request_events_transition';

const BASE_STATUS_VALUES = [
  'PENDING_REVIEW',
  'REVISION_REQUESTED',
  'REVISED_PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
] as const;
const CANCELLATION_STATUS_VALUES = [...BASE_STATUS_VALUES, 'CANCELLED'] as const;
const BASE_ACTION_VALUES = ['SUBMIT', 'RESUBMIT', 'APPROVE', 'REQUEST_REVISION', 'REJECT'] as const;
const CANCELLATION_ACTION_VALUES = [...BASE_ACTION_VALUES, 'CANCEL'] as const;

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await replaceConstraints(knex, true);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM ${REQUESTS_TABLE}
      WHERE status = 'CANCELLED'
    )
    OR EXISTS (
      SELECT 1
      FROM ${EVENTS_TABLE}
      WHERE action = 'CANCEL'
         OR from_status = 'CANCELLED'
         OR to_status = 'CANCELLED'
    )
    BEGIN
      THROW 50001, 'Cannot roll back POMS factory edit request cancellation while its data exists', 1;
    END;
  `);

  await replaceConstraints(knex, false);
}

async function replaceConstraints(knex: Knex, allowCancellation: boolean): Promise<void> {
  const statuses = allowCancellation ? CANCELLATION_STATUS_VALUES : BASE_STATUS_VALUES;
  const terminalStatuses = allowCancellation
    ? (['APPROVED', 'REJECTED', 'CANCELLED'] as const)
    : (['APPROVED', 'REJECTED'] as const);
  const actions = allowCancellation ? CANCELLATION_ACTION_VALUES : BASE_ACTION_VALUES;
  const cancellationTransition = allowCancellation
    ? `
      OR (
        action = 'CANCEL'
        AND from_status IN ('PENDING_REVIEW', 'REVISION_REQUESTED', 'REVISED_PENDING_REVIEW')
        AND to_status = 'CANCELLED'
      )`
    : '';

  await knex.schema.raw(`
    ALTER TABLE ${EVENTS_TABLE} DROP CONSTRAINT ${EVENT_TRANSITION_CONSTRAINT};
    ALTER TABLE ${EVENTS_TABLE} DROP CONSTRAINT ${EVENT_FROM_STATUS_CONSTRAINT};
    ALTER TABLE ${EVENTS_TABLE} DROP CONSTRAINT ${EVENT_TO_STATUS_CONSTRAINT};
    ALTER TABLE ${EVENTS_TABLE} DROP CONSTRAINT ${EVENT_ACTION_CONSTRAINT};
    ALTER TABLE ${REQUESTS_TABLE} DROP CONSTRAINT ${REQUEST_STATE_CONSTRAINT};
    ALTER TABLE ${REQUESTS_TABLE} DROP CONSTRAINT ${REQUEST_STATUS_CONSTRAINT};

    ALTER TABLE ${REQUESTS_TABLE}
    WITH CHECK ADD CONSTRAINT ${REQUEST_STATUS_CONSTRAINT}
    CHECK (status IN (${sqlStringValues(statuses)}));

    ALTER TABLE ${REQUESTS_TABLE}
    WITH CHECK ADD CONSTRAINT ${REQUEST_STATE_CONSTRAINT}
    CHECK (
      (status IN ('PENDING_REVIEW', 'REVISION_REQUESTED', 'REVISED_PENDING_REVIEW') AND is_open = 1)
      OR (status IN (${sqlStringValues(terminalStatuses)}) AND is_open = 0)
    );

    ALTER TABLE ${EVENTS_TABLE}
    WITH CHECK ADD CONSTRAINT ${EVENT_ACTION_CONSTRAINT}
    CHECK (action IN (${sqlStringValues(actions)}));

    ALTER TABLE ${EVENTS_TABLE}
    WITH CHECK ADD CONSTRAINT ${EVENT_FROM_STATUS_CONSTRAINT}
    CHECK (from_status IS NULL OR from_status IN (${sqlStringValues(statuses)}));

    ALTER TABLE ${EVENTS_TABLE}
    WITH CHECK ADD CONSTRAINT ${EVENT_TO_STATUS_CONSTRAINT}
    CHECK (to_status IN (${sqlStringValues(statuses)}));

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
      )${cancellationTransition}
    );

    ALTER TABLE ${REQUESTS_TABLE} CHECK CONSTRAINT ${REQUEST_STATUS_CONSTRAINT};
    ALTER TABLE ${REQUESTS_TABLE} CHECK CONSTRAINT ${REQUEST_STATE_CONSTRAINT};
    ALTER TABLE ${EVENTS_TABLE} CHECK CONSTRAINT ${EVENT_ACTION_CONSTRAINT};
    ALTER TABLE ${EVENTS_TABLE} CHECK CONSTRAINT ${EVENT_FROM_STATUS_CONSTRAINT};
    ALTER TABLE ${EVENTS_TABLE} CHECK CONSTRAINT ${EVENT_TO_STATUS_CONSTRAINT};
    ALTER TABLE ${EVENTS_TABLE} CHECK CONSTRAINT ${EVENT_TRANSITION_CONSTRAINT};
  `);
}

function sqlStringValues(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}
