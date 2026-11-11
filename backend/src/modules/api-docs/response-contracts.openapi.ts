import {
  ALERT_EVENT_ABNORMAL_TYPES,
  ALERT_EVENT_ALERT_TYPES,
  ALERT_EVENT_DISPLAY_SYSTEM_TYPES,
  ALERT_EVENT_NOTIFICATION_STATUSES,
  ALERT_EVENT_POINT_TYPES,
  ALERT_EVENT_SYSTEM_TYPES,
  ALERT_EVENT_THRESHOLD_TYPES,
  type AlertEventDTO,
} from '../alert-events/alert-events.types';

type Schema = Record<string, unknown>;
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const string = { type: 'string' };
const nullableString = { ...string, nullable: true };
const integer = { type: 'integer' };
const nullableNumber = { type: 'number', nullable: true };
const timestamp = { ...string, format: 'date-time' };
const array = (items: Schema): Schema => ({ type: 'array', items });
const object = (
  properties: Record<string, Schema>,
  required = Object.keys(properties),
): Schema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const totalMeta = object({ total: integer });
const envelope = (data: Schema, extra: Record<string, Schema> = {}): Schema =>
  object({ success: { type: 'boolean', enum: [true] }, data, ...extra });

/** Complete the formerly generic responses using the DTOs returned by controllers. */
export function completeResponseContracts(
  paths: Record<string, Schema>,
  schemas: Record<string, Schema>,
): void {
  const alertProperties = {
    id: integer,
    idempotencyKey: string,
    alertType: { ...string, enum: ALERT_EVENT_ALERT_TYPES },
    systemType: { ...string, enum: ALERT_EVENT_SYSTEM_TYPES },
    displaySystemType: { ...string, enum: ALERT_EVENT_DISPLAY_SYSTEM_TYPES },
    factoryId: nullableString,
    factoryName: string,
    factoryRegistrationNo: nullableString,
    stationId: string,
    pointCode: nullableString,
    pointName: string,
    pointType: { ...nullableString, enum: ALERT_EVENT_POINT_TYPES },
    parameterCode: string,
    parameterName: string,
    parameterLabel: { ...string, description: 'ชื่อพารามิเตอร์พร้อมหน่วยเมื่อมี เช่น CO (ppm)' },
    unit: nullableString,
    eventDate: { ...string, format: 'date' },
    eventDateText: string,
    timeRange: nullableString,
    startedAt: { ...timestamp, nullable: true },
    endedAt: { ...timestamp, nullable: true },
    measuredValue: nullableNumber,
    thresholdValue: nullableNumber,
    thresholdType: { ...nullableString, enum: ALERT_EVENT_THRESHOLD_TYPES },
    thresholdLabel: nullableString,
    completenessPercent: nullableNumber,
    completenessPercentText: nullableString,
    consecutiveDays: { ...integer, nullable: true },
    abnormalType: { ...nullableString, enum: ALERT_EVENT_ABNORMAL_TYPES },
    abnormalLabel: nullableString,
    abnormalStreakCount: { ...integer, nullable: true },
    firstAbnormalAt: { ...timestamp, nullable: true },
    confirmedAbnormalAt: { ...timestamp, nullable: true },
    notificationStatus: { ...nullableString, enum: ALERT_EVENT_NOTIFICATION_STATUSES },
    notificationStatusLabel: nullableString,
    sourcePayload: { type: 'object', additionalProperties: true, nullable: true },
    detectedAt: timestamp,
  } satisfies Record<keyof AlertEventDTO, Schema>;

  const formRequest = schemas.MonitoringPointFormRequest.properties as Record<string, Schema>;
  const factoryProperties = formRequest.factory.properties as Record<string, Schema>;
  const pointRequest = formRequest.points.items as Schema;
  const pointProperties = {
    ...(pointRequest.properties as Record<string, Schema>),
    id: integer,
    formId: integer,
    attachments: array(
      object({
        id: integer,
        fileName: string,
        fileUrl: string,
        fileUrlExpiresAt: timestamp,
        fileType: { ...string, description: 'MIME type ของไฟล์แนบ' },
        fileSize: integer,
      }),
    ),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const formProperties = {
    id: integer,
    factory: object(factoryProperties),
    points: array(object(pointProperties)),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const rawRow: Schema = {
    type: 'object',
    additionalProperties: true,
    description:
      'คอลัมน์ดิบของ station หลังกรอง registered parameters; *_value, *_units และ *_status คงค่าจาก source ไม่แปลงหน่วยหรือสถานะ',
    properties: {
      cdate: string,
      ctime: string,
      station_id: string,
    },
  };
  const rawMeta = {
    stationId: string,
    interval: { ...string, enum: ['real', '1m', '5m', '60m', '1day', 'test'] },
    schemaName: string,
    tableName: string,
    count: integer,
    registeredParameters: array({ ...string, description: 'ชื่อพารามิเตอร์พร้อมหน่วย' }),
    returnedColumns: array(string),
  };
  const recipient = object({
    id: integer,
    recipientType: { ...string, enum: ['PROVINCE', 'INDUSTRIAL_ESTATE'] },
    provinceName: nullableString,
    emails: array({ ...string, format: 'email' }),
    isActive: { type: 'boolean' },
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const requestData = (schemas.ConnectionRequestResponse.properties as Record<string, Schema>).data;
  Object.assign(schemas, {
    ConnectionRequestListResponse: envelope(array(requestData), { meta: totalMeta }),
    ParameterTableListResponse: envelope(
      array(
        object({
          schemaName: string,
          tableName: string,
          columnCount: integer,
          rowCount: integer,
        }),
      ),
      { meta: totalMeta },
    ),
    RawParameterRowsResponse: envelope(array(rawRow), {
      meta: object({
        ...rawMeta,
        startDate: { ...string, format: 'date' },
        endDate: { ...string, format: 'date' },
      }),
    }),
    RawParameterLatestResponse: envelope({ ...rawRow, nullable: true }, { meta: object(rawMeta) }),
    EligibleFactoryCandidateListResponse: envelope(array(ref('EligibleFactoryCandidate')), {
      meta: object({ total: integer, page: integer, perPage: integer, totalPages: integer }, [
        'total',
      ]),
    }),
    FactoryFavoriteResponse: envelope(
      object({ factoryId: string, isFavorite: { type: 'boolean' } }),
    ),
    MonitoringPointForm: object(formProperties),
    MonitoringPointFormResponse: envelope(ref('MonitoringPointForm')),
    MonitoringPointFormListResponse: envelope(
      array(
        object({
          id: integer,
          factory: formProperties.factory,
          pointCount: integer,
          cemsPointCount: integer,
          wpmsPointCount: integer,
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
      ),
      { meta: totalMeta },
    ),
    AlertEvent: object(alertProperties),
    AlertEventResponse: envelope(ref('AlertEvent')),
    AlertEventListResponse: envelope(array(ref('AlertEvent')), {
      pagination: object({ page: integer, pageSize: integer, total: integer }),
    }),
    EmailTestResponse: envelope(
      object({ to: { ...string, format: 'email' }, subject: string, sentAt: timestamp }),
    ),
    OfficerNotificationRecipient: recipient,
    OfficerNotificationRecipientResponse: envelope(ref('OfficerNotificationRecipient')),
    OfficerNotificationRecipientListResponse: envelope(array(ref('OfficerNotificationRecipient')), {
      meta: totalMeta,
    }),
  });

  const contracts: [string, string, string][] = [
    ['/cems-wpms-requests', 'get', 'ConnectionRequestListResponse'],
    ...['review', 'status', 'confirm-connection', 'verify-connection'].map(
      (action): [string, string, string] => [
        `/cems-wpms-requests/{id}/${action}`,
        'post',
        'ConnectionRequestResponse',
      ],
    ),
    ['/parameter-values/tables', 'get', 'ParameterTableListResponse'],
    ['/parameter-values/latest', 'get', 'RawParameterLatestResponse'],
    ['/parameter-values', 'get', 'RawParameterRowsResponse'],
    ['/eligible-factories/candidates', 'get', 'EligibleFactoryCandidateListResponse'],
    ['/operator-factories/{factoryId}/favorite', 'put', 'FactoryFavoriteResponse'],
    ['/monitoring-point-forms', 'get', 'MonitoringPointFormListResponse'],
    ['/monitoring-point-forms', 'post', 'MonitoringPointFormResponse'],
    ['/monitoring-point-forms/{id}', 'get', 'MonitoringPointFormResponse'],
    ['/monitoring-point-forms/{id}', 'put', 'MonitoringPointFormResponse'],
    ['/monitoring-point-forms/{id}/select-eligible', 'post', 'CreateEligibleFactoryResponse'],
    ['/alert-events', 'get', 'AlertEventListResponse'],
    ['/alert-events/{id}', 'get', 'AlertEventResponse'],
    ['/alert-events/{id}/status', 'patch', 'AlertEventResponse'],
    ['/email-test/send', 'post', 'EmailTestResponse'],
    ['/officer-notification-email-recipients', 'get', 'OfficerNotificationRecipientListResponse'],
    ['/officer-notification-email-recipients', 'post', 'OfficerNotificationRecipientResponse'],
    [
      '/officer-notification-email-recipients/{id}/emails',
      'post',
      'OfficerNotificationRecipientResponse',
    ],
  ];
  for (const [path, method, name] of contracts) {
    const operation = paths[path][method] as Schema;
    const responses = operation.responses as Record<string, Schema>;
    for (const [status, response] of Object.entries(responses)) {
      if (!status.startsWith('2')) continue;
      const content = response.content as Record<string, Schema>;
      content['application/json'].schema = ref(name);
    }
  }
}
