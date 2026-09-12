import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { pomsFactoriesRepository } from '../../src/modules/poms-factories/poms-factories.repository';
import { pomsFactoriesService } from '../../src/modules/poms-factories/poms-factories.service';

// Registration-only fixture confirmed through the production GET endpoints.
const factoryId = '10700000525488';
const oldRegistration = '3-88(2)-5/48รบ';
const initialMode = env.FACTORY_PROFILE_MODE;
type Query = { toSQL(): { sql: string; method: string } };

afterEach(() => {
  jest.restoreAllMocks();
  env.FACTORY_PROFILE_MODE = initialMode;
});

describe.each(['legacy', 'canonical'] as const)('POMS registration display in %s mode', (mode) => {
  it.each([oldRegistration, null, '   '])(
    'returns the old registration %j, falling back to the new registration when absent',
    async (oldNumber) => {
      env.FACTORY_PROFILE_MODE = mode;
      const expected = oldNumber?.trim() || factoryId;
      const current = {
        eligibleFactoryId: 447,
        factoryId,
        factoryRegistrationNo: factoryId,
        factoryName: 'Registration regression fixture',
        projectName: 'Original project',
      };
      const stored = {
        id: 23,
        eligible_factory_id: 447,
        factory_id: factoryId,
        factory_registration_no: factoryId,
        form_type: 'BASIC_INFO',
        status: 'REVISED_PENDING_REVIEW',
        current_factory_json: JSON.stringify(current),
        proposed_factory_json: JSON.stringify({ ...current, projectName: 'Proposed project' }),
        created_at: '2026-09-12T00:00:00.000Z',
        updated_at: '2026-09-12T00:00:00.000Z',
        submitted_at: '2026-09-12T00:00:00.000Z',
      };
      const originalSnapshots = [stored.current_factory_json, stored.proposed_factory_json];
      const queries: string[] = [];
      jest.spyOn(db.client, 'runner').mockImplementation(((query: Query) => ({
        run: async () => {
          const { sql, method } = query.toSQL();
          queries.push(sql);
          if (sql.includes('[poms_factory_edit_request_events]')) return [];
          if (sql.includes('[req].[contact_name]')) return undefined;
          if (sql.includes('[poms_factory_edit_requests] as [req]')) {
            const row = {
              ...stored,
              ...(sql.includes('[ef].[factory_registration_no_old]')
                ? { factory_registration_no_old: oldNumber, factory_registration_no_new: factoryId }
                : {}),
            };
            return method === 'first' ? row : [row];
          }
          if (sql.includes('[poms_factory_edit_requests]')) return [];
          return [
            {
              connected_point_id: 1,
              eligible_factory_id: 447,
              factory_id: factoryId,
              factory_registration_no: factoryId,
              factory_registration_no_new: factoryId,
              factory_registration_no_old: oldNumber,
              factory_name: current.factoryName,
              system_type: 'WPMS',
              point_type: 'WASTEWATER',
              updated_at: stored.updated_at,
            },
          ];
        },
      })) as never);

      const form = await pomsFactoriesService.getFactoryForm(factoryId, 1, 'ALL', {
        formType: 'BASIC_INFO',
        systemType: 'WPMS',
      });
      const request = await pomsFactoriesService.getEditRequest(23, 1, 'ALL');
      const list = await pomsFactoriesService.listEditRequests({ search: expected }, 1, 'ALL');
      const open = await pomsFactoriesRepository.findOpenEditRequestForFactory(447, 'BASIC_INFO');

      expect({
        form: form.factoryRegistrationNo,
        request: request.factoryRegistrationNo,
        currentFactory: request.currentFactory.factoryRegistrationNo,
        proposedFactory: request.proposedFactory.factoryRegistrationNo,
      }).toEqual({
        form: expected,
        request: expected,
        currentFactory: expected,
        proposedFactory: expected,
      });
      expect(form.factoryId).toBe(factoryId);
      expect(request.factoryId).toBe(factoryId);
      expect(list.data[0].factoryRegistrationNo).toBe(expected);
      expect(open?.factoryRegistrationNo).toBe(expected);
      expect(request.currentFactory.projectName).toBe('Original project');
      expect(request.proposedFactory.projectName).toBe('Proposed project');
      expect([stored.current_factory_json, stored.proposed_factory_json]).toEqual(
        originalSnapshots,
      );
      expect(queries.every((sql) => sql.startsWith('select '))).toBe(true);
      expect(
        queries.find((sql) => sql.includes('[poms_factory_edit_requests] as [req]')),
      ).toContain('[ef].[factory_registration_no_old]');
    },
  );
});
