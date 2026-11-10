import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { buildKwpFormRequestQueryForTests } from '../../src/modules/kwp-form-reports/kwp-form-reports.repository';
import {
  buildKwpFormEditableSubmissionQueryForTests,
  buildKwpFormSubmissionFactoryAccessQueryForTests,
  buildKwpSubmissionRegionQueryForTests,
  kwpFormSubmissionsRepository as submissions,
} from '../../src/modules/kwp-form-submissions/kwp-form-submissions.repository';
import type { KwpFormSubmissionDetailType } from '../../src/modules/kwp-form-submissions/kwp-form-submissions.types';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

const forms: KwpFormSubmissionDetailType[] = ['KWP01', 'KWP02', 'KWP03', 'KWP04', 'KWP05'];
const east = {
  actorUserId: 42,
  scope: { scope: 'IN_REGION' as const, region: 'ภาคตะวันออก' },
  regionalAccess: null,
};
const read = { publicBaseUrl: 'https://example.com', publicPath: '/uploads' };
const columns = (value: string) => value.split(/\s+/).filter(Boolean);
let fixture: KnexSqliteFixture;
const originalMode = env.FACTORY_PROFILE_MODE;

// SQLite lacks SQL Server OUTER APPLY. Keep its actual predicates and ordering,
// and select the same TOP (1) row through a correlated scalar primary-key join.
function sqliteDialect(sql: string): string {
  return sql
    .replace(
      /OUTER APPLY\s*\(\s*SELECT TOP \(1\) (\w+)\.\*\s+FROM (\w+) AS \1\s+([\s\S]*?)\) AS (ef|f|p|ie)\b/gi,
      (_match, source: string, table: string, body: string, alias: string) => {
        const orderIndex = body.lastIndexOf('ORDER BY');
        const where = body.slice(0, orderIndex);
        const keys = body
          .slice(orderIndex + 'ORDER BY'.length)
          .trim()
          .split(',');
        const selections = keys.map(
          (key, index) => `${key.replace(/\s+(ASC|DESC)$/i, '')} AS sort_${index}`,
        );
        const order = keys.map(
          (key, index) => `sort_${index} ${/\s+DESC$/i.test(key.trim()) ? 'DESC' : 'ASC'}`,
        );
        return `LEFT JOIN ${table} AS ${alias} ON ${alias}.id = (SELECT matched_id FROM (SELECT ${source}.id AS matched_id, ${selections.join(', ')} FROM ${table} AS ${source} ${where}) ORDER BY ${order.join(', ')} LIMIT 1)`;
      },
    )
    .replace(/CONVERT\(VARCHAR\(19\), (\[[^\]]+\]), 126\)/gi, '$1');
}

beforeEach(async () => {
  fixture = await createKnexSqliteFixture(
    db,
    {
      provinces: [
        { id: '1000', name_th: 'กรุงเทพมหานคร', region: 'ภาคกลาง' },
        { id: '1021', name_th: 'ระยอง', region: 'ภาคตะวันออก' },
      ],
      industrial_estates: [{ id: 1, name_th: 'นิคมตะวันออก', code: 'EAST' }],
      factories: [
        {
          id: 1,
          fid: 'F-EAST',
          code: 'OLD-EAST',
          name: 'East',
          province_id: '1000',
          deleted_at: null,
        },
        {
          id: 2,
          fid: 'F-CENTRAL',
          code: 'OLD-CENTRAL',
          name: 'Central',
          province_id: '1000',
          deleted_at: null,
        },
      ],
      eligible_factories: [
        {
          id: 1,
          source_factory_id: 'F-EAST',
          factory_registration_no_new: 'NEW-EAST',
          factory_registration_no_old: 'OLD-EAST',
          province_name: 'ระยอง',
          industrial_estate_name: 'นิคมตะวันออก',
          deleted_at: null,
        },
        {
          id: 2,
          source_factory_id: 'F-CENTRAL',
          factory_registration_no_new: 'NEW-CENTRAL',
          factory_registration_no_old: 'OLD-CENTRAL',
          province_name: 'กรุงเทพมหานคร',
          deleted_at: null,
        },
      ],
      cems_wpms_connected_measurement_points: [
        {
          id: 1,
          factory_id: 'F-EAST',
          factory_registration_no: 'NEW-EAST',
          eligible_factory_id: 1,
          deleted_at: null,
        },
        {
          id: 2,
          factory_id: 'F-CENTRAL',
          factory_registration_no: 'NEW-CENTRAL',
          eligible_factory_id: 2,
          deleted_at: null,
        },
      ],
      kwp_form_submissions: forms.flatMap((form, index) => [
        {
          id: index + 1,
          form_type: form,
          factory_id: 'F-EAST',
          factory_registration_no: 'OLD-EAST',
          connected_point_id: 1,
          submission_region_name: 'ภาคกลาง',
          submission_no: `F0${index + 1}-07-0001/2569`,
          status: 'SUBMITTED',
          deleted_at: null,
        },
        {
          id: index + 11,
          form_type: form,
          factory_id: 'F-CENTRAL',
          factory_registration_no: 'OLD-CENTRAL',
          connected_point_id: 2,
          submission_region_name: 'ภาคตะวันออก',
          submission_no: `F0${index + 1}-03-0001/2569`,
          status: 'SUBMITTED',
          deleted_at: null,
        },
      ]),
    },
    {
      factories: columns('industrial_estate_id juristic_id'),
      eligible_factories: columns('factory_type_sequence industrial_estate_name'),
      kwp_form_submissions:
        columns(`factory_name factory_address industry_type point_code point_name point_type
        production_stack primary_fuel secondary_fuel combustion_system production_capacity production_capacity_unit
        contact_name contact_phone contact_email reporter_name reporter_position attachment_link sampling_photo_link
        lab_report_link report_round report_year submitted_at created_at updated_at officer_note reviewed_at reviewed_by updated_by`),
      kwp01_issue_reports: columns(
        'submission_id issue_reason reason_detail problem_date expected_done_date problem_datetime expected_done_datetime total_days total_hours corrective_action',
      ),
      kwp01_unreported_parameters: columns('id submission_id parameter_name sort_order'),
      kwp03_wpms_issue_reports: columns(
        'id submission_id wastewater_source receiving_source treatment_system_type discharge_point average_discharge minimum_discharge maximum_discharge reason_detail problem_date expected_done_date problem_datetime expected_done_datetime total_days total_hours corrective_action',
      ),
      kwp03_selected_options: columns('id submission_id option_group option_value sort_order'),
      kwp05_calibration_reports: columns(
        'submission_id business_activity sampler_name officer_registration laboratory_name laboratory_registration cems_brand cems_detail report_round report_year',
      ),
      kwp05_calibration_items: columns(
        'id submission_id parameter_name parameters_json start_date end_date result verifier_company cems_model link_qr1 link_qr2 sort_order',
      ),
      kwp_emission_measurement_items: columns(
        'id submission_id pollutant report_condition sample_date measured_value measured_value_text unit laboratory_no report_no method sort_order',
      ),
      kwp_form_attachments: columns(
        'id submission_id related_table related_id attachment_type original_file_name stored_file_name mime_type file_size storage_path uploaded_at uploaded_by deleted_at',
      ),
      kwp_form_status_history: columns('id submission_id status note changed_by changed_at'),
      users: columns('id username prename_th first_name last_name'),
      user_juristics: columns('user_id juristic_id revoked_at'),
      user_factory_access: columns('user_id factory_id revoked_at'),
    },
  );
  fixture.execute('CREATE VIEW current_eligible_factories AS SELECT * FROM eligible_factories');
  fixture.execute(
    'CREATE VIEW current_connected_measurement_points AS SELECT * FROM cems_wpms_connected_measurement_points',
  );
  const runner = jest.mocked(db.client.runner);
  const run = runner.getMockImplementation();
  if (!run) throw new Error('Expected the SQLite query runner');
  runner.mockImplementation((builder: unknown) => {
    const compiled = (builder as Knex.QueryBuilder).toSQL();
    return run({ toSQL: () => ({ ...compiled, sql: sqliteDialect(compiled.sql) }) });
  });
});

afterEach(() => {
  fixture?.close();
  env.FACTORY_PROFILE_MODE = originalMode;
});

describe.each(['legacy', 'canonical'] as const)('KWP current region in %s mode', (mode) => {
  beforeEach(() => {
    env.FACTORY_PROFILE_MODE = mode;
  });

  it('reads stored KWP04 conditions, returns null for old rows and omits them for KWP02', async () => {
    await db('kwp_emission_measurement_items').insert([
      { id: 1, submission_id: 4, pollutant: 'CO (ppm)', report_condition: '11(3)', sort_order: 1 },
      { id: 2, submission_id: 4, pollutant: 'NOx (ppm)', report_condition: null, sort_order: 2 },
      { id: 3, submission_id: 2, pollutant: 'BOD (mg/l)', report_condition: null, sort_order: 1 },
    ]);
    const detail = await submissions.getById(4, { ...east, ...read, formType: 'KWP04' });
    expect(detail.measurementItems).toMatchObject([
      { pollutant: 'CO (ppm)', reportCondition: '11(3)' },
      { pollutant: 'NOx (ppm)', reportCondition: null },
    ]);
    const kwp02 = await submissions.getById(2, { ...east, ...read, formType: 'KWP02' });
    expect(kwp02.measurementItems).toHaveLength(1);
    expect(kwp02.measurementItems?.[0]).not.toHaveProperty('reportCondition');
  });

  it.each(forms)(
    '%s listed in the east opens and can be approved despite a central numbering snapshot',
    async (formType) => {
      const listed = await buildKwpFormRequestQueryForTests({ formType }, east)
        .clearSelect()
        .select('s.id');
      expect(listed).toEqual([{ id: forms.indexOf(formType) + 1 }]);
      const id = Number(listed[0].id);
      const access = { ...east, ...read, formType };
      await expect(submissions.getById(id, access)).resolves.toMatchObject({ id, formType });
      const workflowAccess = { ...east, canApprove: true, approveScope: east.scope };
      await expect(submissions.getWorkflow(id, workflowAccess)).resolves.toMatchObject({
        allowedActions: expect.arrayContaining(['APPROVE']),
      });
      await expect(
        submissions.changeWorkflowStatus(id, { action: 'APPROVE' }, workflowAccess),
      ).resolves.toMatchObject({ status: 'APPROVED' });
      expect(
        await db('kwp_form_submissions')
          .where('id', id)
          .first('submission_no', 'submission_region_name'),
      ).toEqual({
        submission_no: `F0${forms.indexOf(formType) + 1}-07-0001/2569`,
        submission_region_name: 'ภาคกลาง',
      });
    },
  );

  it.each(forms)(
    '%s outside the east stays inaccessible even with an eastern numbering snapshot',
    async (formType) => {
      const id = forms.indexOf(formType) + 11;
      await expect(submissions.getById(id, { ...east, ...read, formType })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(submissions.getWorkflow(id, east)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        submissions.changeWorkflowStatus(
          id,
          { action: 'APPROVE' },
          { ...east, canApprove: true, approveScope: east.scope },
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(await db('kwp_form_submissions').where('id', id).first('status')).toEqual({
        status: 'SUBMITTED',
      });
    },
  );

  it('uses the same current province for edit access, creation access and new numbering', async () => {
    await expect(
      buildKwpFormEditableSubmissionQueryForTests(1, { ...east, formType: 'KWP01' })
        .clearSelect()
        .select('s.id')
        .first(),
    ).resolves.toEqual({ id: 1 });
    await expect(
      buildKwpFormSubmissionFactoryAccessQueryForTests('F-EAST', east).first(),
    ).resolves.toEqual({ id: 1 });
    await expect(buildKwpSubmissionRegionQueryForTests('F-EAST').first()).resolves.toEqual({
      region_name: 'ภาคตะวันออก',
    });
  });

  it('keeps view and approve scopes independent', async () => {
    const access = {
      ...east,
      canApprove: true,
      approveScope: { scope: 'IN_REGION' as const, region: 'ภาคกลาง' },
    };
    const workflow = await submissions.getWorkflow(1, access);
    expect(workflow.allowedActions).not.toContain('APPROVE');
    await expect(
      submissions.changeWorkflowStatus(1, { action: 'APPROVE' }, access),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      submissions.changeWorkflowStatus(1, { action: 'APPROVE' }, { ...east, canApprove: false }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it.each([
    { scope: 'IN_PROVINCE' as const, province: 'ระยอง' },
    { scope: 'IN_ESTATE' as const, estateCode: 'EAST' },
  ])('uses current location for $scope across read, edit and create checks', async (scope) => {
    const access = { ...east, scope };
    await expect(
      submissions.getById(1, { ...access, ...read, formType: 'KWP01' }),
    ).resolves.toMatchObject({ id: 1 });
    await expect(
      buildKwpFormEditableSubmissionQueryForTests(1, { ...access, formType: 'KWP01' })
        .clearSelect()
        .select('s.id')
        .first(),
    ).resolves.toEqual({ id: 1 });
    await expect(
      buildKwpFormSubmissionFactoryAccessQueryForTests('F-EAST', access).first(),
    ).resolves.toEqual({ id: 1 });
  });

  it('fails closed when a region is unassigned or the active eligible province is missing', async () => {
    const unassigned = { ...east, scope: { scope: 'IN_REGION' as const } };
    await expect(
      buildKwpFormRequestQueryForTests({}, unassigned).clearSelect().select('s.id'),
    ).resolves.toEqual([]);
    await expect(
      submissions.getById(1, { ...unassigned, ...read, formType: 'KWP01' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    fixture.execute('UPDATE eligible_factories SET province_name = NULL WHERE id = 1');
    await expect(
      buildKwpFormRequestQueryForTests({}, east).clearSelect().select('s.id'),
    ).resolves.toEqual([]);
    await expect(
      submissions.getById(1, { ...east, ...read, formType: 'KWP01' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('resolves old registrations when the submission has no connected point', async () => {
    fixture.execute(
      "UPDATE kwp_form_submissions SET connected_point_id = NULL, factory_id = 'LEGACY-ID' WHERE id = 1",
    );
    await expect(
      submissions.getById(1, { ...east, ...read, formType: 'KWP01' }),
    ).resolves.toMatchObject({ id: 1 });
  });

  it('prioritizes the active connected point identity over conflicting submission identifiers', async () => {
    fixture.execute(
      "UPDATE kwp_form_submissions SET factory_id = 'F-CENTRAL', factory_registration_no = 'OLD-CENTRAL' WHERE id = 1",
    );
    await expect(
      submissions.getById(1, { ...east, ...read, formType: 'KWP01' }),
    ).resolves.toMatchObject({ id: 1 });
    await expect(
      submissions.getById(1, {
        ...east,
        scope: { scope: 'IN_REGION', region: 'ภาคกลาง' },
        ...read,
        formType: 'KWP01',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('retains OWN_FACTORY assignments against the resolved current factory', async () => {
    const own = { ...east, scope: 'OWN_FACTORY' };
    await expect(
      submissions.getById(1, { ...own, ...read, formType: 'KWP01' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    fixture.execute('INSERT INTO user_factory_access (user_id, factory_id) VALUES (42, 1)');
    await expect(
      submissions.getById(1, { ...own, ...read, formType: 'KWP01' }),
    ).resolves.toMatchObject({ id: 1 });
    await expect(
      submissions.getById(11, { ...own, ...read, formType: 'KWP01' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('falls back to the master location only when no active eligible row exists', async () => {
    fixture.execute("UPDATE eligible_factories SET deleted_at = 'deleted' WHERE id = 1");
    await expect(
      submissions.getById(1, { ...east, ...read, formType: 'KWP01' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      submissions.getById(1, {
        ...east,
        scope: { scope: 'IN_REGION', region: 'ภาคกลาง' },
        ...read,
        formType: 'KWP01',
      }),
    ).resolves.toMatchObject({ id: 1 });
  });
});
