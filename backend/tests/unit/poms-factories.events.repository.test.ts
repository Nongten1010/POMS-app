import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { pomsFactoriesRepository } from '../../src/modules/poms-factories/poms-factories.repository';

type Query = { toSQL(): { sql: string; bindings: unknown[] } };

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POMS factory edit-request event actors', () => {
  it.each([
    ['สมชาย', 'ใจดี', 'สมชาย ใจดี'],
    ['  สมชาย  ', '  ใจดี  ', 'สมชาย ใจดี'],
    ['สมชาย', '', 'สมชาย'],
    [null, 'ใจดี', 'ใจดี'],
    [null, null, null],
    ['  ', '', null],
  ])(
    'returns actor name for %j / %j alongside the actor user ID',
    async (firstName, lastName, expectedName) => {
      const queries: ReturnType<Query['toSQL']>[] = [];
      jest.spyOn(db.client, 'runner').mockImplementation(((query: Query) => ({
        run: async () => {
          const compiled = query.toSQL();
          queries.push(compiled);
          if (compiled.sql.includes('[poms_factory_edit_request_events]')) {
            return [
              {
                id: 1,
                request_id: 11,
                action: 'SUBMIT',
                from_status: null,
                to_status: 'PENDING_REVIEW',
                event_note: null,
                actor_user_id: 42,
                actor_first_name: firstName,
                actor_last_name: lastName,
                created_at: '2026-09-12T00:00:00.000Z',
              },
            ];
          }
          return requestRow();
        },
      })) as never);

      const result = await pomsFactoriesRepository.findEditRequestById(11, {
        actorUserId: 42,
        scope: 'ALL',
      });

      expect(result?.events).toEqual([
        expect.objectContaining({ actorUserId: 42, actorName: expectedName }),
      ]);

      expect(queries).toHaveLength(2);
      const eventQuery = queries[1];
      expect(eventQuery.sql).toContain(
        'left join [users] as [actor] on [actor].[id] = [poms_factory_edit_request_events].[actor_user_id]',
      );
      expect(eventQuery.sql).toContain('[actor].[first_name] as [actor_first_name]');
      expect(eventQuery.sql).toContain('[actor].[last_name] as [actor_last_name]');
      expect(eventQuery.sql).toContain('[poms_factory_edit_request_events].*');
      expect(eventQuery.sql).not.toContain('[actor].*');
      expect(eventQuery.sql).toContain('[poms_factory_edit_request_events].[request_id] in (?)');
      expect(eventQuery.bindings).toEqual([11]);
      expect(eventQuery.sql).toContain('[poms_factory_edit_request_events].[deleted_at] is null');
      expect(eventQuery.sql).toContain(
        'order by [poms_factory_edit_request_events].[created_at] asc, [poms_factory_edit_request_events].[id] asc',
      );
    },
  );
});

function requestRow() {
  const profile = {
    eligibleFactoryId: 7,
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
  };
  return {
    id: 11,
    request_no: 'PFE-20260912-0001',
    eligible_factory_id: 7,
    factory_id: profile.factoryId,
    factory_registration_no: '3-106-33/50สบ',
    form_type: 'BASIC_INFO',
    status: 'PENDING_REVIEW',
    revision_no: 0,
    is_open: 1,
    current_factory_json: JSON.stringify(profile),
    proposed_factory_json: JSON.stringify(profile),
    submitted_by: 42,
    submitted_at: '2026-09-12T00:00:00.000Z',
    created_by: 42,
    created_at: '2026-09-12T00:00:00.000Z',
    updated_at: '2026-09-12T00:00:00.000Z',
  };
}
