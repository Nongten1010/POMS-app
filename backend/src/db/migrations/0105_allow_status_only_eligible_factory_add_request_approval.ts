import type { Knex } from 'knex';

const TABLE_NAME = 'eligible_factory_add_requests';
const REVIEW_STATE_CONSTRAINT = 'ck_eligible_factory_add_requests_review_state';
const SUBMITTED_INDEX = 'ix_eligible_factory_add_requests_submitted';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE ${TABLE_NAME}
    DROP CONSTRAINT ${REVIEW_STATE_CONSTRAINT};

    ALTER TABLE ${TABLE_NAME}
    WITH CHECK ADD CONSTRAINT ${REVIEW_STATE_CONSTRAINT}
    CHECK (
      (
        status = 'PENDING_REVIEW'
        AND is_open = 1
        AND reviewed_by IS NULL
        AND reviewed_at IS NULL
        AND officer_note IS NULL
        AND eligible_factory_id IS NULL
      )
      OR (
        status = 'APPROVED'
        AND is_open = 0
        AND reviewed_by IS NOT NULL
        AND reviewed_at IS NOT NULL
      )
      OR (
        status = 'REJECTED'
        AND is_open = 0
        AND reviewed_by IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND officer_note IS NOT NULL
        AND LEN(LTRIM(RTRIM(officer_note))) > 0
        AND eligible_factory_id IS NULL
      )
    );

    CREATE INDEX ${SUBMITTED_INDEX}
    ON ${TABLE_NAME}(submitted_at DESC, id DESC)
    WHERE deleted_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    DROP INDEX ${SUBMITTED_INDEX} ON ${TABLE_NAME};

    ALTER TABLE ${TABLE_NAME}
    DROP CONSTRAINT ${REVIEW_STATE_CONSTRAINT};

    ALTER TABLE ${TABLE_NAME}
    WITH CHECK ADD CONSTRAINT ${REVIEW_STATE_CONSTRAINT}
    CHECK (
      (
        status = 'PENDING_REVIEW'
        AND is_open = 1
        AND reviewed_by IS NULL
        AND reviewed_at IS NULL
        AND officer_note IS NULL
        AND eligible_factory_id IS NULL
      )
      OR (
        status = 'APPROVED'
        AND is_open = 0
        AND reviewed_by IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND eligible_factory_id IS NOT NULL
      )
      OR (
        status = 'REJECTED'
        AND is_open = 0
        AND reviewed_by IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND officer_note IS NOT NULL
        AND LEN(LTRIM(RTRIM(officer_note))) > 0
        AND eligible_factory_id IS NULL
      )
    );
  `);
}
