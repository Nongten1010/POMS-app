type Schema = Record<string, unknown>;

export function extendKwpCurrentLocationDocs(paths: Record<string, Schema>): void {
  const policy =
    'กวภ.01–05 ใช้จังหวัดปัจจุบันของโรงงานและ provinces.region ชุดเดียวกันสำหรับรายการ รายละเอียด การแก้ไข ส่งกลับหลังแก้ไข และ workflow ทั้ง legacy/canonical mode. หา active connected point และ eligible factory ปัจจุบันก่อน; fallback ไป factory master เฉพาะเมื่อไม่มี eligible row. ตรวจ scope ของ view/edit/approve แยกตาม action และใช้พื้นที่รายเมนูก่อน profile; ไม่มีพื้นที่ต้อง fail closed. submission_region_name เป็นประวัติตอนออกเลข ไม่ใช้กรองสิทธิ์. คำขอใหม่ออกเลขจากภาคปัจจุบัน ส่วนเลขเอกสารและ snapshot เดิมคงอยู่';
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!path.startsWith('/kwp-form-') || path === '/kwp-form-submissions/attachments') continue;
    for (const method of ['get', 'post', 'patch']) {
      const operation = pathItem[method] as Schema | undefined;
      if (operation) operation.description = `${String(operation.description ?? '')}\n\n${policy}`;
    }
  }
}

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const text = { type: 'string', nullable: true };
const integer = { type: 'integer', nullable: true };
const strings = { type: 'array', items: { type: 'string' } };
const array = (items: Schema): Schema => ({ type: 'array', items });
const envelope = (data: Schema): Schema => ({
  type: 'object',
  required: ['success', 'data'],
  properties: { success: { type: 'boolean', enum: [true] }, data },
});

export function extendKwpHandoffSchemas(schemas: Record<string, Schema>): void {
  const properties = (name: string) => schemas[name].properties as Record<string, Schema>;
  const reportCondition = {
    type: 'string',
    enum: ['4(1)', '4(2)', '11(3)', '16'],
    description: 'รายงานตามเงื่อนไข เฉพาะ กวภ.04; บังคับเลือกต่อรายการ ไม่มีค่าเริ่มต้น',
    example: '4(1)',
  };
  const measurementItems = properties('Kwp02Or04Request').measurementItems;
  const measurementItem = measurementItems.items as Schema;
  schemas.Kwp04Request = {
    ...schemas.Kwp02Or04Request,
    properties: {
      ...properties('Kwp02Or04Request'),
      measurementItems: {
        ...measurementItems,
        items: {
          ...measurementItem,
          required: ['pollutant', 'reportCondition'],
          properties: {
            ...(measurementItem.properties as Record<string, Schema>),
            reportCondition,
          },
        },
      },
    },
  };
  schemas.KwpCreatedResponse = envelope({
    type: 'object',
    properties: {
      id: { type: 'integer' },
      requestNo: { type: 'string' },
      form: { type: 'string' },
      formType: { type: 'string', enum: ['KWP01', 'KWP02', 'KWP03', 'KWP04', 'KWP05'] },
      status: { type: 'string', enum: ['SUBMITTED'] },
      submittedAt: { type: 'string', format: 'date-time' },
      measurementItemCount: { type: 'integer' },
      calibrationItemCount: { type: 'integer' },
      attachmentCount: { type: 'integer' },
    },
  });
  schemas.KwpAttachmentUploadResponse = envelope({
    type: 'object',
    properties: {
      originalFileName: { type: 'string' },
      storedFileName: { type: 'string' },
      mimeType: { type: 'string', maxLength: 128 },
      fileSize: { type: 'integer', minimum: 1, maximum: 10485760 },
      storagePath: { type: 'string', description: 'path ผูกผู้ใช้อัปโหลด ห้ามสร้างเอง' },
      fileUrl: { type: 'string', format: 'uri' },
    },
  });
  schemas.KwpAttachmentDetail = {
    type: 'object',
    properties: {
      ...properties('KwpAttachmentMetadata'),
      id: { type: 'integer' },
      fileUrl: { ...text, format: 'uri' },
      uploadedAt: { type: 'string', format: 'date-time' },
      uploadedBy: integer,
    },
  };
  const attachments = array(ref('KwpAttachmentDetail'));
  const kwp01 = properties('Kwp01Request');
  const issueProperties = Object.fromEntries(
    [
      'issueReason',
      'reasonDetail',
      'problemDate',
      'expectedDoneDate',
      'totalDays',
      'unreportedParameters',
      'correctiveAction',
    ].map((key) => [key, kwp01[key]]),
  );
  const kwp03 = properties('Kwp03Request');
  const wpmsProperties = Object.fromEntries(
    [
      'instruments',
      'measurementTimes',
      'issueReasons',
      'reasonDetail',
      'problemDate',
      'expectedDoneDate',
      'totalDays',
      'failedParameters',
      'correctiveAction',
      'wastewaterSource',
      'receivingSource',
      'treatmentSystemType',
      'dischargePoint',
      'averageDischarge',
      'minimumDischarge',
      'maximumDischarge',
    ].map((key) => [key, kwp03[key]]),
  );
  const measurement = (properties('Kwp02Or04Request').measurementItems.items as Schema)
    .properties as Record<string, Schema>;
  const calibration = (properties('Kwp05Request').calibrationItems.items as Schema)
    .properties as Record<string, Schema>;
  schemas.KwpSubmissionDetail = {
    type: 'object',
    required: ['id', 'requestNo', 'formType', 'status', 'submittedAt'],
    properties: {
      ...properties('KwpBaseRequest'),
      factoryId: text,
      id: { type: 'integer' },
      requestNo: { type: 'string' },
      form: { type: 'string' },
      formType: { type: 'string', enum: ['KWP01', 'KWP02', 'KWP03', 'KWP04', 'KWP05'] },
      status: {
        type: 'string',
        enum: [
          'DRAFT',
          'SUBMITTED',
          'UNDER_REVIEW',
          'REVISION_REQUESTED',
          'APPROVED',
          'REJECTED',
          'CANCELLED',
        ],
      },
      submittedAt: { ...text, format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      attachmentLink: { ...text, description: 'KWP01/03; null เมื่อยังไม่มีหรือล้างแล้ว' },
      attachments,
      reportRound: integer,
      reportYear: { ...integer, description: 'KWP02/04 ปี พ.ศ. ข้อมูลเก่าเป็น null' },
      samplingPhotoLink: text,
      labReportLink: text,
      issueReport: { type: 'object', properties: { ...issueProperties, totalHours: integer } },
      wpmsIssueReport: {
        type: 'object',
        properties: { ...wpmsProperties, totalHours: integer, attachments },
      },
      measurementItems: array({
        type: 'object',
        properties: {
          ...measurement,
          id: { type: 'integer' },
          numericValue: { type: 'number', nullable: true },
          attachments,
        },
      }),
      calibrationReport: {
        type: 'object',
        properties: Object.fromEntries(
          [
            'businessActivity',
            'samplerName',
            'officerRegistration',
            'laboratoryName',
            'laboratoryRegistration',
            'cemsBrand',
            'cemsDetail',
            'reportRound',
            'reportYear',
          ].map((key) => [key, text]),
        ),
      },
      calibrationItems: array({
        type: 'object',
        properties: { ...calibration, id: { type: 'integer' }, attachments },
      }),
    },
  };
  schemas.KwpSubmissionDetailResponse = envelope(ref('KwpSubmissionDetail'));
  const detailItems = properties('KwpSubmissionDetail').measurementItems;
  const detailItem = detailItems.items as Schema;
  schemas.Kwp04SubmissionDetail = {
    ...schemas.KwpSubmissionDetail,
    required: [...(schemas.KwpSubmissionDetail.required as string[]), 'measurementItems'],
    properties: {
      ...properties('KwpSubmissionDetail'),
      formType: { type: 'string', enum: ['KWP04'] },
      measurementItems: {
        ...detailItems,
        items: {
          ...detailItem,
          required: ['id', 'pollutant', 'reportCondition'],
          properties: {
            ...(detailItem.properties as Record<string, Schema>),
            reportCondition: {
              ...reportCondition,
              nullable: true,
              enum: [...reportCondition.enum, null],
              description: 'รายงานตามเงื่อนไขของแต่ละรายการ; ข้อมูลเก่าเป็น null ไม่เดาค่าให้',
            },
          },
        },
      },
    },
  };
  schemas.Kwp04SubmissionDetailResponse = {
    ...envelope(ref('Kwp04SubmissionDetail')),
    example: {
      success: true,
      data: {
        id: 14,
        requestNo: 'F04-04-0001/2569',
        formType: 'KWP04',
        status: 'REVISION_REQUESTED',
        submittedAt: '2026-11-10T04:00:00.000Z',
        measurementItems: [
          { id: 81, pollutant: 'CO (ppm)', reportCondition: '4(1)' },
          { id: 82, pollutant: 'NOx (ppm)', reportCondition: '16' },
        ],
      },
    },
  };
  const step = {
    type: 'object',
    properties: {
      key: { type: 'string', enum: ['SUBMITTED', 'REVISION_REQUESTED'] },
      label: { type: 'string' },
      status: { type: 'string', enum: ['DONE', 'CURRENT', 'PENDING', 'SKIPPED'] },
    },
  };
  schemas.KwpWorkflowResponse = envelope({
    type: 'object',
    properties: {
      id: { type: 'integer' },
      requestNo: { type: 'string' },
      form: { type: 'string' },
      formType: properties('KwpSubmissionDetail').formType,
      status: properties('KwpSubmissionDetail').status,
      statusLabel: { type: 'string' },
      revisionReason: text,
      officerNote: text,
      reviewedAt: { ...text, format: 'date-time' },
      currentStep: step,
      steps: array(step),
      allowedActions: {
        ...array({
          type: 'string',
          enum: ['REQUEST_REVISION', 'APPROVE', 'REJECT', 'RESUBMIT', 'CANCEL'],
        }),
        description:
          'REJECT แสดงให้เจ้าหน้าที่ที่มีบทบาทและ kwp_forms:approve ใน data scope ที่อนุมัติได้ทุกสถานะ; action อื่นคงเงื่อนไขเดิม',
      },
    },
  });
  schemas.KwpEligibleMeasurementPoint = {
    type: 'object',
    properties: {
      connectedPointId: integer,
      pointCode: text,
      pointName: { type: 'string' },
      pointType: { type: 'string', enum: ['CEMS', 'WPMS'] },
      parameterDetails: {
        ...strings,
        description:
          'พารามิเตอร์ที่เข้าข่ายทั้งหมด รวมรายการที่ยกเว้น; ป้ายชื่อพร้อมหน่วย; [] หากไม่มีข้อมูลที่จับคู่ได้แน่นอน',
      },
      parameterInstrumentDetails: array({
        type: 'object',
        properties: { parameter: { type: 'string' }, cemsModel: text },
      }),
      ...Object.fromEntries(
        [
          'primaryFuel',
          'secondaryFuel',
          'productionStack',
          'combustionSystem',
          'productionCapacity',
          'productionCapacityUnit',
          'cemsModel',
          'wastewaterSource',
          'receivingSource',
          'treatmentSystemType',
          'dischargePoint',
        ].map((key) => [key, text]),
      ),
      instruments: strings,
      measurementTimes: strings,
      ...Object.fromEntries(
        ['averageDischarge', 'minimumDischarge', 'maximumDischarge'].map((key) => [
          key,
          { oneOf: [{ type: 'number' }, { type: 'string' }], nullable: true },
        ]),
      ),
    },
  };
  schemas.KwpEligibleMeasurementPointsResponse = {
    ...envelope(array(ref('KwpEligibleMeasurementPoint'))),
    properties: {
      ...(envelope(array(ref('KwpEligibleMeasurementPoint'))).properties as Schema),
      meta: { type: 'object', properties: { total: { type: 'integer' } } },
    },
  };
}
