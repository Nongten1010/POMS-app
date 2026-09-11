import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
const mode = { canonical: true };
jest.mock('../../src/modules/factory-profiles/factory-profile-mode', () => ({
  isCanonicalFactoryProfilesEnabled: () => mode.canonical,
}));
import {
  createFactoryProfileFromEligibleInTransaction,
  lockFactoryProfileInTransaction,
  projectFactoryProfileToMonitoringFormInTransaction,
  updateFactoryProfileInTransaction,
} from '../../src/modules/factory-profiles/factory-profiles.repository';

describe('canonical factory profile persistence', () => {
  beforeEach(() => {
    mode.canonical = true;
  });
  it('updates one profile, compatibility projections and audit, preserving point versions and history', async () => {
    const h = harness();
    await updateFactoryProfileInTransaction(
      h.trx,
      7,
      { project_name: 'Approved', front_photos_json: null, logo_json: null },
      9,
      'POMS_APPROVAL',
      3,
    );
    expect(h.profile).toMatchObject({ revision: 4, project_name: 'Approved', logo_json: null });
    for (const table of [
      'eligible_factories',
      'cems_wpms_connected_measurement_points',
      'factory_monitoring_point_forms',
      'factory_profile_events',
    ]) {
      expect(h.writes.some((w) => w.table === table)).toBe(true);
    }
    expect(
      h.writes.find((w) => w.table === 'cems_wpms_connected_measurement_points')?.values,
    ).toMatchObject({ factory_project_name: 'Approved', factory_logo_json: null });
    expect(
      h.writes.find((w) => w.table === 'cems_wpms_connected_measurement_points')?.values,
    ).not.toHaveProperty('updated_at');
    expect(h.writes.some((w) => /requests|^factories$/.test(w.table))).toBe(false);
  });
  it('repairs a full form replacement from the unchanged profile without touching point versions or profile history', async () => {
    const h = harness();
    await updateFactoryProfileInTransaction(
      h.trx,
      7,
      { project_name: 'Original' },
      9,
      'monitoring-point-form',
    );
    expect(h.writes).toEqual([]);
    await projectFactoryProfileToMonitoringFormInTransaction(h.trx, 7, 9);
    expect(h.writes).toEqual([
      expect.objectContaining({
        table: 'factory_monitoring_point_forms',
        values: expect.objectContaining({
          project_name: 'Original',
          eia_info: 'มี',
          factory_name: 'Factory',
        }),
      }),
    ]);
    expect(h.profile.revision).toBe(3);
  });
  it('does not advance the profile for an unchanged proposal', async () => {
    const h = harness();
    await updateFactoryProfileInTransaction(
      h.trx,
      7,
      { project_name: 'Original' },
      9,
      'POMS_APPROVAL',
    );
    expect(h.writes).toEqual([]);
  });
  it('rejects a stale revision before any write', async () => {
    const h = harness();
    await expect(
      updateFactoryProfileInTransaction(h.trx, 7, { project_name: 'Stale' }, 9, 'POMS_APPROVAL', 2),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(h.writes).toEqual([]);
  });
  it.each(['missingProfile', 'missingEligible'] as const)(
    'refuses %s instead of guessing',
    async (key) => {
      const h = harness({ [key]: true });
      await expect(lockFactoryProfileInTransaction(h.trx, 7)).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(h.writes).toEqual([]);
    },
  );
  it('throws to abort the caller transaction if a projection write fails', async () => {
    const h = harness({ failEligibleUpdate: true });
    await expect(
      updateFactoryProfileInTransaction(h.trx, 7, { project_name: 'Failed' }, 9, 'POMS_APPROVAL'),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(h.writes.some((w) => w.table === 'factory_profile_events')).toBe(false);
  });
  it('derives EIA flags and rejects incomplete coordinate patches', async () => {
    const h = harness();
    await updateFactoryProfileInTransaction(
      h.trx,
      7,
      { eia_assessment: 'ไม่มี', eia_other: 'stale', has_eia: true },
      9,
      'FORM',
    );
    expect(h.profile).toMatchObject({ eia_assessment: 'ไม่มี', eia_other: null, has_eia: false });
    await expect(
      updateFactoryProfileInTransaction(h.trx, 7, { latitude: 14 }, 9, 'FORM'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it.each(['มี IEE', 'มี EIA', 'มี EHIA'])(
    'accepts existing EIA category %s',
    async (assessment) => {
      const h = harness();
      await updateFactoryProfileInTransaction(h.trx, 7, { eia_assessment: assessment }, 9, 'FORM');
      expect(h.profile).toMatchObject({
        eia_assessment: assessment,
        has_eia: true,
        eia_other: null,
      });
    },
  );
  it('creates the initial profile and audit on eligible selection', async () => {
    const h = harness({ missingProfile: true });
    await createFactoryProfileFromEligibleInTransaction(h.trx, 7, 9, 'SELECT_ELIGIBLE');
    expect(h.writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'factory_profiles',
          values: expect.objectContaining({
            eligible_factory_id: 7,
            factory_name: 'Factory',
            revision: 1,
          }),
        }),
        expect.objectContaining({
          table: 'factory_profile_events',
          values: expect.objectContaining({ revision: 1, before_json: null }),
        }),
      ]),
    );
  });
  it('preserves the existing profile while repairing restored eligible and linked form projections', async () => {
    const h = harness({
      eligibleValues: { factory_name: 'Old imported name', project_name: 'Old project' },
    });
    await createFactoryProfileFromEligibleInTransaction(h.trx, 7, 9, 'RESTORE_ELIGIBLE');
    expect(h.profile).toMatchObject({
      factory_name: 'Factory',
      project_name: 'Original',
      revision: 3,
    });
    expect(
      h.writes.some((w) => w.table === 'factory_profiles' || w.table === 'factory_profile_events'),
    ).toBe(false);
    for (const table of ['eligible_factories', 'factory_monitoring_point_forms']) {
      expect(h.writes.find((w) => w.table === table)?.values).toMatchObject({
        factory_name: 'Factory',
        project_name: 'Original',
      });
    }
    expect(
      h.writes.find((w) => w.table === 'cems_wpms_connected_measurement_points')?.values,
    ).toMatchObject({ factory_project_name: 'Original' });
  });
  it('projects normalized initial EIA values into eligible and linked form in the selection transaction', async () => {
    const h = harness({
      missingProfile: true,
      eligibleValues: { eia_assessment: 'ไม่มี', has_eia: true, eia_other: 'stale' },
    });
    await createFactoryProfileFromEligibleInTransaction(h.trx, 7, 9, 'SELECT_ELIGIBLE');
    expect(h.writes.find((w) => w.table === 'eligible_factories')?.values).toMatchObject({
      eia_assessment: 'ไม่มี',
      has_eia: false,
      eia_other: null,
    });
    expect(
      h.writes.find((w) => w.table === 'factory_monitoring_point_forms')?.values,
    ).toMatchObject({ eia_info: 'ไม่มี', eia_other: null });
  });
  it.each(['08800 / 08801,08802', null])(
    'projects factory type %s using the form representation',
    async (factoryType) => {
      const h = harness();
      await updateFactoryProfileInTransaction(
        h.trx,
        7,
        { factory_type_sequence: factoryType, project_name: 'Updated' },
        9,
        'FORM',
      );
      expect(
        h.writes.find((w) => w.table === 'factory_monitoring_point_forms')?.values,
      ).toMatchObject({
        factory_type_main: factoryType ? '08800' : null,
        factory_type_sub: factoryType ? '08801,08802' : null,
      });
    },
  );
  it.each([false, true])(
    'aborts the selection transaction when linked form projection fails (new: %s)',
    async (missingProfile) => {
      const h = harness({ missingProfile, failFormUpdate: true });
      await expect(
        h.transaction(() =>
          createFactoryProfileFromEligibleInTransaction(h.trx, 7, 9, 'SELECT_ELIGIBLE'),
        ),
      ).rejects.toThrow('Form projection failed');
      expect(h.writes).toEqual([]);
      expect(h.profile.revision).toBe(3);
    },
  );
  it('does not query canonical storage in legacy mode', async () => {
    mode.canonical = false;
    const h = harness();
    await createFactoryProfileFromEligibleInTransaction(h.trx, 7, 9, 'SELECT_ELIGIBLE');
    await updateFactoryProfileInTransaction(
      h.trx,
      7,
      { project_name: 'Legacy' },
      9,
      'POMS_APPROVAL',
    );
    expect(await lockFactoryProfileInTransaction(h.trx, 7)).toBeNull();
    expect(h.queries).toEqual([]);
  });
});

function harness(
  o: {
    missingProfile?: boolean;
    missingEligible?: boolean;
    failEligibleUpdate?: boolean;
    failFormUpdate?: boolean;
    eligibleValues?: Record<string, unknown>;
  } = {},
) {
  const profile: Record<string, unknown> = {
    id: 12,
    eligible_factory_id: 7,
    factory_name: 'Factory',
    address: 'Address',
    province_name: 'ระยอง',
    industrial_estate_name: null,
    latitude: 13,
    longitude: 100,
    eia_assessment: 'มี',
    eia_other: null,
    has_eia: true,
    project_name: 'Original',
    business_activity: null,
    factory_type_sequence: null,
    front_photos_json: '[{"fileUrl":"/fixture/front.png"}]',
    logo_json: '{"fileUrl":"/fixture/logo.png"}',
    revision: 3,
    updated_at: '2026-09-01T00:00:00Z',
  };
  const eligible = { ...profile, id: 7, monitoring_point_form_id: 5, ...o.eligibleValues };
  const writes: Array<{ table: string; values: Record<string, unknown> }> = [];
  const queries: string[] = [];
  const trx = Object.assign(
    (table: string) => {
      queries.push(table);
      const q: Record<string, unknown> = {};
      for (const method of ['where', 'whereNull', 'forUpdate', 'select', 'whereIn'])
        q[method] = () => q;
      q.first = async () =>
        table === 'factory_profiles'
          ? o.missingProfile
            ? undefined
            : { ...profile }
          : table === 'eligible_factories'
            ? o.missingEligible
              ? undefined
              : eligible
            : undefined;
      q.update = async (values: Record<string, unknown>) => {
        if (table === 'factory_monitoring_point_forms' && o.failFormUpdate)
          throw new Error('Form projection failed');
        writes.push({ table, values });
        if (table === 'factory_profiles') Object.assign(profile, values);
        return table === 'eligible_factories' && o.failEligibleUpdate ? 0 : 1;
      };
      q.insert = (values: Record<string, unknown>) => {
        writes.push({ table, values });
        return Object.assign(Promise.resolve([12]), { returning: async () => [{ id: 12 }] });
      };
      return q;
    },
    { fn: { now: () => '2026-09-11T00:00:00Z' } },
  ) as unknown as Knex.Transaction;
  const transaction = async (operation: () => Promise<void>) => {
    const before = { ...profile };
    try {
      await operation();
    } catch (error) {
      Object.assign(profile, before);
      writes.splice(0);
      throw error;
    }
  };
  return { trx, writes, queries, profile, transaction };
}
