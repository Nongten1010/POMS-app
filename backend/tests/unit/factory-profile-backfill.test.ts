import { describe, expect, it } from '@jest/globals';
import type { Knex } from 'knex';
import {
  auditFactoryProfiles,
  parseFactoryProfileBackfillOptions,
  runFactoryProfileBackfill,
  type FactoryProfileBackfillSources,
  type FactoryProfileBackfillCandidate,
} from '../../src/modules/factory-profiles/factory-profile-backfill';

const common = {
  factory_name: 'Fictional factory',
  address: 'Fictional address',
  latitude: '13.1000000',
  longitude: '100.2000000',
  eia_assessment: 'ไม่มี',
  eia_other: null,
  has_eia: false,
  project_name: null,
};

function fixture(): FactoryProfileBackfillSources {
  return {
    schemaReady: true,
    eligibleFactories: [
      {
        id: '10',
        source_factory_id: 'SOURCE-A',
        factory_registration_no_new: 'REG-A',
        factory_registration_no_old: 'OLD-A',
        monitoring_point_form_id: null,
        ...common,
        province_name: 'Fictional province',
        industrial_estate_name: null,
        business_activity: null,
        factory_type_sequence: null,
      },
    ],
    connectedPoints: [
      {
        id: '100',
        eligible_factory_id: '10',
        factory_id: 'SOURCE-A',
        factory_registration_no: 'REG-A',
        ...common,
        front_photos_json: '[{"title":"Fictional photo","url":"/fictional/photo"}]',
        logo_json: null,
      },
    ],
    forms: [],
    profiles: [],
  };
}

function fakeDatabase(source: FactoryProfileBackfillSources, lockedSource = source) {
  const operations: Array<{ kind: string; table?: string; sql?: string; values?: unknown }> = [];
  let activeSource = source;
  let nextId = 1000;
  const database = ((table: string) => ({
    where: () => ({ whereNull: () => ({ first: async () => ({ id: 7 }) }) }),
    insert: (values: Record<string, unknown>) => {
      operations.push({ kind: 'insert', table, values });
      if (table === 'factory_profiles') {
        const inserted = { id: String(nextId++), ...values };
        activeSource.profiles.push(
          inserted as unknown as FactoryProfileBackfillSources['profiles'][number],
        );
        return { returning: async () => [{ id: inserted.id }] };
      }
      return Promise.resolve();
    },
  })) as unknown as Knex;
  database.schema = {
    hasTable: async () => source.schemaReady,
    hasColumn: async () => source.schemaReady,
  } as unknown as Knex.SchemaBuilder;
  database.raw = (async (sql: string) => {
    operations.push({ kind: 'select', sql });
    if (sql.includes('FROM eligible_factories')) return activeSource.eligibleFactories;
    if (sql.includes('FROM cems_wpms_connected_measurement_points'))
      return activeSource.connectedPoints;
    if (sql.includes('FROM factory_monitoring_point_forms')) return activeSource.forms;
    if (sql.includes('FROM factory_profiles')) return activeSource.profiles;
    throw new Error('Unexpected query');
  }) as Knex['raw'];
  database.transaction = (async (callback: (trx: Knex.Transaction) => Promise<unknown>) => {
    operations.push({ kind: 'begin' });
    activeSource = lockedSource;
    try {
      const result = await callback(database as Knex.Transaction);
      operations.push({ kind: 'commit' });
      return result;
    } catch (error) {
      operations.push({ kind: 'rollback' });
      throw error;
    }
  }) as Knex['transaction'];
  return { database, operations };
}

describe('guarded canonical factory profile audit', () => {
  it('seeds connected factory data and assets only when both current sources agree', () => {
    const source = fixture();
    const plan = auditFactoryProfiles(source);
    expect(plan.report.conflicts).toEqual([]);
    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0]).toMatchObject({
      eligible_factory_id: '10',
      ...common,
      front_photos_json: source.connectedPoints[0].front_photos_json,
    });
    expect(plan.report.counts.missingProfiles).toBe(1);
    expect(plan.report.readyForCanonical).toBe(false);
  });

  it('preserves exact BIGINT identifiers without converting through JS numbers', () => {
    const source = fixture();
    source.eligibleFactories[0].id = '9007199254740993';
    source.connectedPoints[0].eligible_factory_id = '9007199254740993';
    expect(auditFactoryProfiles(source).candidates[0].eligible_factory_id).toBe('9007199254740993');
  });

  it('allows only surrounding whitespace and equivalent decimal representation', () => {
    const source = fixture();
    source.connectedPoints[0].factory_name = `  ${common.factory_name}  `;
    source.connectedPoints[0].latitude = 13.1;
    expect(auditFactoryProfiles(source).report.conflicts).toEqual([]);
  });

  it.each(['factory_name', 'address', 'latitude', 'eia_other', 'project_name'] as const)(
    'blocks differences in %s, including null values, without choosing the newest point',
    (field) => {
      const source = fixture();
      source.connectedPoints[0][field] = field === 'latitude' ? null : 'Different value';
      const plan = auditFactoryProfiles(source);
      expect(plan.candidates).toEqual([]);
      expect(plan.report.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'CONNECTED_ELIGIBLE_MISMATCH',
            fields: expect.arrayContaining([field]),
          }),
        ]),
      );
    },
  );

  it('does not normalize internal address spacing or punctuation', () => {
    const source = fixture();
    source.connectedPoints[0].address = 'Fictional  address';
    expect(auditFactoryProfiles(source).report.conflicts[0].fields).toContain('address');
  });

  it('requires all connected points to agree including their factory assets', () => {
    const source = fixture();
    source.connectedPoints.push({
      ...source.connectedPoints[0],
      id: '101',
      logo_json: '{"url":"different"}',
    });
    const plan = auditFactoryProfiles(source);
    expect(plan.report.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CONNECTED_POINTS_MISMATCH',
          connectedPointIds: ['100', '101'],
          fields: ['logo_json'],
        }),
      ]),
    );
    expect(plan.candidates).toEqual([]);
  });

  it('rejects malformed asset JSON even if copied identically across points', () => {
    const source = fixture();
    source.connectedPoints[0].logo_json = 'malformed';
    expect(auditFactoryProfiles(source).report.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_PROFILE_VALUE', fields: ['logo_json'] }),
      ]),
    );
  });

  const invalidConsistentProfiles: Array<{
    label: string;
    patch: Partial<FactoryProfileBackfillCandidate>;
    fields: string[];
  }> = [
    { label: 'missing latitude', patch: { latitude: null }, fields: ['latitude', 'longitude'] },
    { label: 'missing longitude', patch: { longitude: null }, fields: ['latitude', 'longitude'] },
    ...['มี', 'มี IEE', 'มี EIA', 'มี EHIA'].map((assessment) => ({
      label: `${assessment} with negative EIA flag`,
      patch: { eia_assessment: assessment, has_eia: false },
      fields: ['eia_assessment', 'has_eia'],
    })),
    ...['ไม่มี', 'อื่นๆ'].map((assessment) => ({
      label: `${assessment} with positive EIA flag`,
      patch: { eia_assessment: assessment, has_eia: true },
      fields: ['eia_assessment', 'has_eia'],
    })),
    {
      label: 'assessment with missing flag',
      patch: { has_eia: null },
      fields: ['eia_assessment', 'has_eia'],
    },
    {
      label: 'flag without assessment',
      patch: { eia_assessment: null },
      fields: ['eia_assessment', 'has_eia'],
    },
    {
      label: 'other text without other assessment',
      patch: { eia_other: 'Preserve this text' },
      fields: ['eia_assessment', 'eia_other'],
    },
    {
      label: 'blank other text without other assessment',
      patch: { eia_other: '' },
      fields: ['eia_assessment', 'eia_other'],
    },
    {
      label: 'other text without assessment',
      patch: { eia_assessment: null, has_eia: null, eia_other: 'Preserve this text' },
      fields: ['eia_assessment', 'eia_other'],
    },
    {
      label: 'photo object instead of array',
      patch: { front_photos_json: '{}' },
      fields: ['front_photos_json'],
    },
    { label: 'logo array instead of object', patch: { logo_json: '[]' }, fields: ['logo_json'] },
  ];

  it.each(invalidConsistentProfiles)(
    'blocks $label even when every stored copy agrees, without repairing values',
    ({ patch, fields }) => {
      const source = fixture();
      const candidate = { ...auditFactoryProfiles(source).candidates[0], ...patch };
      const { front_photos_json, logo_json, ...sharedPatch } = patch;
      Object.assign(source.eligibleFactories[0], sharedPatch);
      Object.assign(source.connectedPoints[0], sharedPatch);
      if (front_photos_json !== undefined)
        source.connectedPoints[0].front_photos_json = front_photos_json;
      if (logo_json !== undefined) source.connectedPoints[0].logo_json = logo_json;
      const before = JSON.stringify(source);
      const plan = auditFactoryProfiles(source);
      expect(plan.candidates).toEqual([]);
      expect(plan.report.conflicts).toEqual([
        { code: 'INVALID_PROFILE_VALUE', eligibleFactoryIds: ['10'], fields },
      ]);
      expect(JSON.stringify(source)).toBe(before);
      source.profiles.push({ id: '1000', ...candidate, revision: '1' });
      expect(auditFactoryProfiles(source).report.readyForCanonical).toBe(false);
    },
  );

  it.each<Partial<FactoryProfileBackfillCandidate>>([
    { latitude: null, longitude: null },
    { latitude: 0, longitude: 0 },
    { eia_assessment: null, has_eia: null, eia_other: null },
    { eia_assessment: 'ไม่มี', has_eia: 0 },
    { eia_assessment: 'มี', has_eia: 1 },
    { eia_assessment: 'มี IEE', has_eia: true },
    { eia_assessment: 'มี EIA', has_eia: true },
    { eia_assessment: 'มี EHIA', has_eia: true },
    { eia_assessment: 'อื่นๆ', has_eia: false, eia_other: null },
    { eia_assessment: 'อื่นๆ', has_eia: 0, eia_other: 'Preserve this text' },
    { eia_assessment: 'อื่นๆ', has_eia: false, eia_other: '' },
  ])('preserves a valid canonical profile combination %j', (patch) => {
    const source = fixture();
    Object.assign(source.eligibleFactories[0], patch);
    Object.assign(source.connectedPoints[0], patch);
    const before = JSON.stringify(source);
    const plan = auditFactoryProfiles(source);
    expect(plan.report.conflicts).toEqual([]);
    expect(plan.candidates[0]).toMatchObject(patch);
    expect(JSON.stringify(source)).toBe(before);
    source.profiles.push({ id: '1000', ...plan.candidates[0], revision: '1' });
    expect(auditFactoryProfiles(source).report.readyForCanonical).toBe(true);
  });

  it('accepts empty photo arrays and logo objects without changing the stored JSON', () => {
    const source = fixture();
    source.connectedPoints[0].front_photos_json = '[]';
    source.connectedPoints[0].logo_json = '{ "url": "/fictional/logo" }';
    const plan = auditFactoryProfiles(source);
    expect(plan.report.conflicts).toEqual([]);
    expect(plan.candidates[0].front_photos_json).toBe('[]');
    expect(plan.candidates[0].logo_json).toBe('{ "url": "/fictional/logo" }');
  });

  it('uses eligible values for unconnected factories and never invents assets', () => {
    const source = fixture();
    source.connectedPoints = [];
    expect(auditFactoryProfiles(source).candidates[0]).toMatchObject({
      ...common,
      front_photos_json: null,
      logo_json: null,
    });
  });

  it('does not relink orphan points from a matching name or registration', () => {
    const source = fixture();
    source.connectedPoints[0].eligible_factory_id = null;
    expect(auditFactoryProfiles(source).report.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CONNECTED_POINT_MISSING_LINK',
          connectedPointIds: ['100'],
        }),
      ]),
    );
    expect(source.connectedPoints[0].eligible_factory_id).toBeNull();
  });

  it('rejects a point whose aliases identify a different factory than its FK', () => {
    const source = fixture();
    source.eligibleFactories.push({
      ...source.eligibleFactories[0],
      id: '20',
      source_factory_id: 'SOURCE-B',
      factory_registration_no_new: 'REG-B',
      factory_registration_no_old: null,
    });
    source.connectedPoints[0].factory_id = 'SOURCE-B';
    expect(auditFactoryProfiles(source).report.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CONNECTED_POINT_IDENTITY_MISMATCH',
          eligibleFactoryIds: ['10', '20'],
        }),
      ]),
    );
  });

  it('detects cross-column alias collisions without printing alias or factory values', () => {
    const source = fixture();
    source.eligibleFactories.push({
      ...source.eligibleFactories[0],
      id: '20',
      source_factory_id: 'REG-A',
      factory_registration_no_new: 'REG-B',
      factory_registration_no_old: null,
    });
    const report = auditFactoryProfiles(source).report;
    expect(report.counts.identityCollisions).toBeGreaterThan(0);
    expect(report.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AMBIGUOUS_FACTORY_ALIAS',
          eligibleFactoryIds: ['10', '20'],
        }),
      ]),
    );
    const output = JSON.stringify(report);
    for (const secret of ['REG-A', 'Fictional factory', 'Fictional address', '/fictional/photo']) {
      expect(output).not.toContain(secret);
    }
  });

  it('detects connected aliases shared across factories even when absent from eligible aliases', () => {
    const source = fixture();
    source.eligibleFactories.push({
      ...source.eligibleFactories[0],
      id: '20',
      source_factory_id: 'SOURCE-B',
      factory_registration_no_new: 'REG-B',
      factory_registration_no_old: null,
    });
    source.connectedPoints[0].factory_id = 'UNLISTED-ALIAS';
    source.connectedPoints.push({
      ...source.connectedPoints[0],
      id: '200',
      eligible_factory_id: '20',
      factory_registration_no: 'REG-B',
    });
    const plan = auditFactoryProfiles(source);
    expect(plan.report.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AMBIGUOUS_FACTORY_ALIAS',
          eligibleFactoryIds: ['10', '20'],
        }),
      ]),
    );
    expect(plan.candidates).toEqual([]);
  });

  it('does not merge factories solely because names match', () => {
    const source = fixture();
    source.eligibleFactories.push({
      ...source.eligibleFactories[0],
      id: '20',
      source_factory_id: 'SOURCE-B',
      factory_registration_no_new: 'REG-B',
      factory_registration_no_old: null,
    });
    expect(auditFactoryProfiles(source).candidates.map((row) => row.eligible_factory_id)).toEqual([
      '10',
      '20',
    ]);
  });

  it('blocks mismatched shared fields in the explicitly linked current form', () => {
    const source = fixture();
    source.eligibleFactories[0].monitoring_point_form_id = '50';
    source.forms.push({
      id: '50',
      ...common,
      factory_name: 'Form value',
      province_name: 'Fictional province',
      business_activity: null,
      factory_type_main: null,
      factory_type_sub: null,
      factory_registration_no_new: 'REG-A',
      factory_registration_no_old: 'OLD-A',
    });
    expect(auditFactoryProfiles(source).report.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'LINKED_FORM_MISMATCH',
          formIds: ['50'],
          fields: ['factory_name'],
        }),
      ]),
    );
  });

  it.each([
    ['88', '00088', null],
    ['88 / 1,2', '00088', '00001,00002'],
    ['88 / 88,1,1', '00088', '00001'],
  ] as const)(
    'accepts equivalent projected factory type %s without rewriting source values',
    (type, main, sub) => {
      const source = fixture();
      source.eligibleFactories[0].factory_type_sequence = type;
      source.eligibleFactories[0].monitoring_point_form_id = '50';
      source.forms.push({
        id: '50',
        ...common,
        province_name: 'Fictional province',
        business_activity: null,
        factory_type_main: main,
        factory_type_sub: sub,
        factory_registration_no_new: 'REG-A',
        factory_registration_no_old: 'OLD-A',
      });
      const before = JSON.stringify(source);
      const plan = auditFactoryProfiles(source);
      expect(plan.report.conflicts).toEqual([]);
      expect(plan.candidates[0].factory_type_sequence).toBe(type);
      expect(JSON.stringify(source)).toBe(before);
      source.profiles.push({ id: '1000', ...plan.candidates[0], revision: '1' });
      expect(auditFactoryProfiles(source).report.readyForCanonical).toBe(true);
    },
  );

  it('compares existing profile type using the same domain normalization without replacing its raw code', () => {
    const source = fixture();
    source.eligibleFactories[0].factory_type_sequence = '88';
    const candidate = auditFactoryProfiles(source).candidates[0];
    source.profiles.push({
      id: '1000',
      ...candidate,
      factory_type_sequence: '00088',
      revision: '7',
    });
    const before = JSON.stringify(source);
    const plan = auditFactoryProfiles(source);
    expect(plan.report.conflicts).toEqual([]);
    expect(plan.report.readyForCanonical).toBe(true);
    expect(plan.candidates).toEqual([]);
    expect(JSON.stringify(source)).toBe(before);
  });

  it.each([
    ['00089', null],
    ['00088', '00002'],
  ] as const)(
    'continues rejecting different main or subclass codes in linked forms',
    (main, sub) => {
      const source = fixture();
      source.eligibleFactories[0].factory_type_sequence = '88 / 1';
      source.eligibleFactories[0].monitoring_point_form_id = '50';
      source.forms.push({
        id: '50',
        ...common,
        province_name: 'Fictional province',
        business_activity: null,
        factory_type_main: main,
        factory_type_sub: sub,
        factory_registration_no_new: 'REG-A',
        factory_registration_no_old: 'OLD-A',
      });
      const plan = auditFactoryProfiles(source);
      expect(plan.report.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'LINKED_FORM_MISMATCH',
            fields: ['factory_type_sequence'],
          }),
        ]),
      );
      expect(plan.candidates).toEqual([]);
    },
  );

  it('blocks missing linked forms and shared form ownership', () => {
    const source = fixture();
    source.eligibleFactories[0].monitoring_point_form_id = '50';
    source.eligibleFactories.push({
      ...source.eligibleFactories[0],
      id: '20',
      source_factory_id: 'SOURCE-B',
      factory_registration_no_new: 'REG-B',
      factory_registration_no_old: null,
    });
    const codes = auditFactoryProfiles(source).report.conflicts.map((row) => row.code);
    expect(codes).toContain('LINKED_FORM_MISSING');
    expect(codes).toContain('AMBIGUOUS_FORM_LINK');
  });

  it('does not audit unlinked draft forms as if they were current factory profiles', () => {
    const source = fixture();
    source.forms.push({
      id: '50',
      ...common,
      province_name: null,
      business_activity: null,
      factory_type_main: null,
      factory_type_sub: null,
      factory_registration_no_new: '',
      factory_registration_no_old: null,
    });
    expect(auditFactoryProfiles(source).report.conflicts).toEqual([]);
  });

  it('never overwrites existing profiles and reports legacy drift', () => {
    const source = fixture();
    const candidate = auditFactoryProfiles(source).candidates[0];
    source.profiles.push({
      id: '1000',
      ...candidate,
      factory_name: 'Canonical value',
      revision: '9',
    });
    const plan = auditFactoryProfiles(source);
    expect(plan.candidates).toEqual([]);
    expect(plan.report.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'EXISTING_PROFILE_DRIFT',
          profileIds: ['1000'],
          fields: ['factory_name'],
        }),
      ]),
    );
    expect(source.profiles[0].revision).toBe('9');
  });

  it('reports readiness only when schema, profiles and identity integrity are complete', () => {
    const source = fixture();
    source.profiles.push({
      id: '1000',
      ...auditFactoryProfiles(source).candidates[0],
      revision: '1',
    });
    expect(auditFactoryProfiles(source).report.readyForCanonical).toBe(true);
    source.schemaReady = false;
    expect(auditFactoryProfiles(source).report.readyForCanonical).toBe(false);
  });
});

describe('backfill execution safety', () => {
  it('defaults to SELECT-only dry run and hides candidate values', async () => {
    const { database, operations } = fakeDatabase(fixture());
    const report = await runFactoryProfileBackfill(database);
    expect(report.mode).toBe('dry-run');
    expect(operations.every((operation) => operation.kind === 'select')).toBe(true);
    expect(JSON.stringify(report)).not.toContain('Fictional factory');
    expect(JSON.stringify(report)).not.toContain('/fictional/photo');
  });

  it('refuses apply if the initial audit contains unresolved conflicts', async () => {
    const source = fixture();
    source.connectedPoints[0].address = null;
    const { database, operations } = fakeDatabase(source);
    await expect(
      runFactoryProfileBackfill(database, { apply: true, actorUserId: 7, batchSize: 50 }),
    ).rejects.toThrow('conflicts');
    expect(operations.some((operation) => operation.kind === 'insert')).toBe(false);
  });

  it('refuses apply before any writes when matching sources contain an invalid coordinate pair', async () => {
    const source = fixture();
    source.eligibleFactories[0].latitude = null;
    source.connectedPoints[0].latitude = null;
    const { database, operations } = fakeDatabase(source);
    await expect(
      runFactoryProfileBackfill(database, { apply: true, actorUserId: 7, batchSize: 50 }),
    ).rejects.toThrow('conflicts');
    expect(operations.every((operation) => operation.kind === 'select')).toBe(true);
  });

  it('repeats the audit under transaction locks and refuses concurrent source drift', async () => {
    const before = fixture();
    const changed = fixture();
    changed.connectedPoints[0].address = 'Changed while planning';
    const { database, operations } = fakeDatabase(before, changed);
    await expect(
      runFactoryProfileBackfill(database, { apply: true, actorUserId: 7, batchSize: 50 }),
    ).rejects.toThrow('conflicts');
    expect(operations.some((operation) => operation.kind === 'insert')).toBe(false);
    expect(operations.at(-1)?.kind).toBe('rollback');
    const locked = operations.filter(
      (operation) => operation.kind === 'select' && operation.sql?.includes('UPDLOCK'),
    );
    expect(locked).toHaveLength(4);
    expect(locked.every((operation) => operation.sql?.includes('HOLDLOCK'))).toBe(true);
  });

  it('inserts profiles plus version events in a single transaction and reruns idempotently', async () => {
    const { database, operations } = fakeDatabase(fixture());
    const options = { apply: true, actorUserId: 7, batchSize: 50 };
    const first = await runFactoryProfileBackfill(database, options);
    expect(first.insertedProfiles).toBe(1);
    expect(first.readyForCanonical).toBe(true);
    expect(
      operations
        .filter((operation) => operation.kind === 'insert')
        .map((operation) => operation.table),
    ).toEqual(['factory_profiles', 'factory_profile_events']);
    expect(
      operations.find((operation) => operation.table === 'factory_profile_events')?.values,
    ).toMatchObject({
      source: 'factory-profile-backfill',
      revision: 1,
      actor_user_id: 7,
      before_json: null,
    });
    const second = await runFactoryProfileBackfill(database, options);
    expect(second.insertedProfiles).toBe(0);
  });

  it('bounds writes per run while keeping readiness false until every profile exists', async () => {
    const source = fixture();
    source.eligibleFactories.push({
      ...source.eligibleFactories[0],
      id: '20',
      source_factory_id: 'SOURCE-B',
      factory_registration_no_new: 'REG-B',
      factory_registration_no_old: null,
    });
    const { database } = fakeDatabase(source);
    const report = await runFactoryProfileBackfill(database, {
      apply: true,
      actorUserId: 7,
      batchSize: 1,
    });
    expect(report.insertedProfiles).toBe(1);
    expect(report.counts.missingProfiles).toBe(1);
    expect(report.readyForCanonical).toBe(false);
  });

  it('refuses apply without migrated schema and never creates tables automatically', async () => {
    const source = fixture();
    source.schemaReady = false;
    const { database, operations } = fakeDatabase(source);
    await expect(
      runFactoryProfileBackfill(database, { apply: true, actorUserId: 7, batchSize: 50 }),
    ).rejects.toThrow('schema');
    expect(operations.some((operation) => operation.kind === 'insert')).toBe(false);
  });

  it.each([
    'current_eligible_factories',
    'current_connected_measurement_points',
    'current_factory_monitoring_point_forms',
    'source_factory_profile_revision',
    'cems_wpms_connection_requests.source_factory_profile_revision',
  ])(
    'refuses canonical readiness and apply when schema dependency %s is missing',
    async (missing) => {
      const source = fixture();
      source.profiles.push({
        id: '1000',
        ...auditFactoryProfiles(source).candidates[0],
        revision: '1',
      });
      const { database, operations } = fakeDatabase(source);
      database.schema.hasTable = (async (table: string) =>
        table !== missing) as Knex.SchemaBuilder['hasTable'];
      database.schema.hasColumn = (async (table: string, column: string) =>
        column !== missing && `${table}.${column}` !== missing) as Knex.SchemaBuilder['hasColumn'];
      const report = await runFactoryProfileBackfill(database);
      expect(report.schemaReady).toBe(false);
      expect(report.readyForCanonical).toBe(false);
      await expect(
        runFactoryProfileBackfill(database, { apply: true, actorUserId: 7 }),
      ).rejects.toThrow('schema');
      expect(operations.some((operation) => operation.kind === 'insert')).toBe(false);
    },
  );

  it.each([0, -1, 1001, 1.5, Number.NaN])(
    'rejects invalid batch size %s before reading data',
    async (batchSize) => {
      const { database, operations } = fakeDatabase(fixture());
      await expect(
        runFactoryProfileBackfill(database, { apply: true, actorUserId: 7, batchSize }),
      ).rejects.toThrow();
      expect(operations).toEqual([]);
    },
  );

  it('parses explicit apply authority and rejects unknown or contradictory flags', () => {
    expect(parseFactoryProfileBackfillOptions([])).toEqual({ apply: false, batchSize: 100 });
    expect(
      parseFactoryProfileBackfillOptions(['--apply', '--actor-id', '7', '--batch-size', '25']),
    ).toEqual({ apply: true, actorUserId: 7, batchSize: 25 });
    for (const args of [
      ['--apply'],
      ['--force'],
      ['--apply', '--dry-run'],
      ['--batch-size'],
      ['--batch-size', '1e2'],
      ['--apply', '--apply'],
    ]) {
      expect(() => parseFactoryProfileBackfillOptions(args)).toThrow();
    }
  });
});
