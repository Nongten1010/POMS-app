import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { createKnexSqliteFixture } from './knex-sqlite-fixture';

/** Real routes/services/repositories; only SQL execution and account identity are isolated. */
export async function createDeviceConfigApiFixture() {
  const previousMode = env.FACTORY_PROFILE_MODE;
  env.FACTORY_PROFILE_MODE = 'legacy';
  const timestamp = '2026-10-28T00:00:00.000Z';
  const nullableRequestFields = Object.fromEntries(
    [
      'industry_main_order',
      'industry_sub_order',
      'business_activity',
      'eia_assessment',
      'eia_other',
      'has_eia',
      'project_name',
      'address',
      'latitude',
      'longitude',
      'contact_email',
      'contact_persons_json',
      'notification_emails_json',
      'officer_notification_emails_json',
      'information_provider_name',
      'information_provider_position',
      'remarks',
      'revision_reason',
      'officer_note',
      'connection_due_at',
      'confirmed_at',
      'verified_at',
      'deleted_at',
    ].map((field) => [field, null]),
  );
  const fixture = await createKnexSqliteFixture(
    db,
    {
      cems_wpms_connection_requests: [101, 102].map((id) => ({
        ...nullableRequestFields,
        id,
        eligible_factory_id: 17,
        request_no: `CEMS-${id}/2569`,
        submission_source: 'OPERATOR_FORM',
        request_type: 'NEW_CONNECTION',
        factory_id: 'fixture-factory',
        factory_name: 'โรงงานทดสอบ',
        factory_registration_no: 'TEST-001',
        system_type: 'CEMS',
        status: id === 101 ? 'WAITING_CONNECTION' : 'CONNECTED',
        contact_name: 'ผู้ทดสอบ',
        contact_phone: '0800000000',
        created_by: 42,
        updated_by: 42,
        created_at: timestamp,
        updated_at: timestamp,
      })),
      cems_wpms_measurement_points: [101, 102].map((requestId, index) => ({
        id: requestId + 100,
        request_id: requestId,
        point_code: `S200${index + 1}`,
        point_name: `ปล่องทดสอบ ${index + 1}`,
        point_type: 'STACK',
        parameters_json: '["CO (ppm)"]',
        instruments_json: null,
        latitude: null,
        longitude: null,
        description: null,
        details_json: null,
        documents_json: null,
        monitoring_point_status: null,
        deleted_at: null,
      })),
      cems_wpms_connected_measurement_points: [
        {
          id: 301,
          source_measurement_point_id: 202,
          source_request_id: 102,
          connected_at: timestamp,
          point_type: 'STACK',
          details_json: null,
          factory_id: 'fixture-factory',
          eligible_factory_id: 17,
          point_name: 'ปล่องทดสอบ 2',
          point_code: 'S2002',
          system_type: 'CEMS',
          parameters_json: '["CO (ppm)"]',
          monitoring_point_status: null,
          instruments_json: null,
          factory_front_photos_json: null,
          factory_logo_json: null,
          documents_json: null,
          deleted_at: null,
        },
      ],
    },
    {
      users: ['id', 'username', 'prename_th', 'first_name', 'last_name'],
      cems_wpms_request_status_history: [
        'id',
        'request_id',
        'status',
        'note',
        'changed_by',
        'changed_at',
      ],
      cems_wpms_request_factory_snapshots: [
        'request_id',
        'deleted_at',
        'province_name',
        'province_code',
      ],
      poms_factory_status_management: ['eligible_factory_id', 'state_json'],
      device_connection_configs: [
        'id',
        'request_id',
        'source_request_id',
        'source_recorded',
        'station_id',
        'device_code',
        'protocol',
        'settings_json',
        'status_management_json',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at',
        'deleted_at',
      ],
      device_measurement_channels: [
        'id',
        'config_id',
        'address_id',
        'data_type',
        'test_mode',
        'value_range_json',
        'alert_low',
        'alert_high',
        'value_format',
        'scale_min',
        'scale_max',
        'gain',
        'offset_value',
        'encoding',
        'parameter_status',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at',
        'deleted_at',
      ],
      alert_parameter_activations: [
        'id',
        'connected_point_id',
        'parameter_code',
        'unit',
        'activated_at',
        'deactivated_at',
      ],
    },
  );
  fixture.execute(`
    CREATE TRIGGER config_audit_defaults AFTER INSERT ON device_connection_configs
    BEGIN
      UPDATE device_connection_configs
      SET created_at = COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)
      WHERE id = NEW.id;
    END;
  `);
  return {
    execute: fixture.execute,
    close: () => {
      fixture.close();
      env.FACTORY_PROFILE_MODE = previousMode;
    },
  };
}
