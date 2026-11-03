import type { CreateIntegrationAlertEventInput } from './alert-events.types';

/** Shared event shape; selecting a producer never changes the public event contract. */
export function toAlertEventInsertPayload(input: CreateIntegrationAlertEventInput) {
  return {
    idempotency_key: input.idempotencyKey,
    alert_type: input.alertType,
    system_type: input.systemType,
    display_system_type: input.displaySystemType,
    factory_id: input.factoryId ?? null,
    factory_name: input.factoryName ?? '',
    factory_registration_no: input.factoryRegistrationNo ?? null,
    connected_measurement_point_id: input.connectedMeasurementPointId ?? null,
    station_id: input.stationId,
    point_code: input.pointCode ?? null,
    point_name: input.pointName,
    point_type: input.pointType ?? null,
    parameter_code: input.parameterCode,
    parameter_name: input.parameterName,
    parameter_label: input.parameterLabel,
    unit: input.unit,
    event_date: input.eventDate,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    measured_value: input.measuredValue,
    threshold_value: input.thresholdValue,
    threshold_type: input.thresholdType,
    notification_status: input.notificationStatus ?? 'AUTO',
    source_payload_json: input.sourcePayload ? JSON.stringify(input.sourcePayload) : null,
  };
}
