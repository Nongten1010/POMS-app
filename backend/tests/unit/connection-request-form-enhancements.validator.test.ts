import { describe, expect, it } from '@jest/globals';
import {
  addParameterRequestSchema,
  addMeasurementPointRequestSchema,
  createConnectionRequestSchema,
  resubmitConnectionRequestSchema,
} from '../../src/modules/connection-requests/connection-requests.validator';

const FIVE_MEBIBYTES = 5 * 1024 * 1024;
const FACTORY_LOGO_TITLE = 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท';

function createCemsPayload() {
  return {
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryRegistrationNo: '3-106-33/50สบ',
    systemType: 'CEMS',
    contactPersons: [
      {
        name: 'สมชาย ใจดี',
        phone: '0812345678',
        email: 'operator@example.com',
      },
    ],
    measurementPoints: [
      {
        pointName: 'ปล่องระบาย A',
        pointType: 'STACK',
        details: {
          monitoringPointKind: 'CEMS',
          legalAnnexNo: ['1', '13'],
          eligibleParameters: ['CS2 (ppm)', 'CS2 (ppb)', 'CS2 (mg/m³)', 'CO (ppm)'],
          exemptedParameters: ['ไม่มี'],
          connectedParameters: ['ไม่มี'],
          pendingParameters: ['CS2 (ppm)', 'CS2 (ppb)', 'CS2 (mg/m³)', 'CO (ppm)'],
          requestedParameters: ['CS2 (ppm)', 'CS2 (ppb)', 'CS2 (mg/m³)'],
          stackShape: 'วงกลม',
          stackDiameter: 1.2,
          primaryFuel: 'ชีวมวล',
          primaryFuelOther: 'แกลบและเศษไม้',
          secondaryFuel: 'ไม่มี',
          combustionControlSystem: 'ระบบปิด',
          hasTreatmentSystem: 'มี',
          treatmentSystem: ['ระบบถุงกรอง', 'อื่นๆ'],
          treatmentSystemOther: 'ระบบเฉพาะของโรงงาน',
          connectionDevice: 'D-POMS Client (ใหม่)',
        },
        documentsAndImages: [
          {
            title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน',
            fileName: 'factory-front-1.png',
            fileUrl: 'https://example.com/files/factory-front-1.png',
            fileType: 'image/png',
            fileSize: 1024,
          },
          {
            title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน',
            fileName: 'factory-front-2.png',
            fileUrl: 'https://example.com/files/factory-front-2.png',
            fileType: 'image/png',
            fileSize: 2048,
          },
          {
            title: FACTORY_LOGO_TITLE,
            fileName: 'logo.png',
            fileUrl: 'https://example.com/files/logo.png',
            fileType: 'image/png',
            fileSize: FIVE_MEBIBYTES,
          },
        ],
        measurementInstruments: {
          converterBrand: null,
          converterModel: null,
          parameters: [],
        },
      },
    ],
  };
}

function createWpmsPayload() {
  const payload = createCemsPayload();

  return {
    ...payload,
    systemType: 'WPMS',
    measurementPoints: [
      {
        ...payload.measurementPoints[0],
        pointName: 'จุดระบายน้ำทิ้ง A',
        pointType: 'WASTEWATER',
        details: {
          monitoringPointKind: 'WPMS',
          eligibleParameters: ['BOD (mg/l)', 'COD (mg/l)'],
          exemptedParameters: ['ไม่มี'],
          connectedParameters: ['ไม่มี'],
          pendingParameters: ['BOD (mg/l)', 'COD (mg/l)'],
          requestedParameters: ['COD (mg/l)'],
          hasTreatmentSystem: 'มี',
          treatmentSystem: ['Activated Sludge', 'อื่นๆ'],
          treatmentSystemOther: 'ระบบเฉพาะของโรงงาน',
          maxTreatmentCapacity: 1000,
          connectionDevice: 'D-POMS Client (ใหม่)',
        },
        documentsAndImages: [
          {
            title: 'ระบบบำบัด',
            fileName: 'treatment-1.pdf',
            fileUrl: 'https://example.com/files/treatment-1.pdf',
            fileType: 'application/pdf',
            fileSize: 1024,
          },
          {
            title: 'ระบบบำบัด',
            fileName: 'treatment-2.pdf',
            fileUrl: 'https://example.com/files/treatment-2.pdf',
            fileType: 'application/pdf',
            fileSize: 2048,
          },
          {
            title: 'ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (WPMS)',
            fileName: 'instrument.png',
            fileUrl: 'https://example.com/files/instrument.png',
            fileType: 'image/png',
            fileSize: 4096,
          },
        ],
      },
    ],
  };
}

describe('CEMS/WPMS monitoring-point form enhancements', () => {
  it('accepts a CEMS add-parameter request without documents', () => {
    const payload = createCemsPayload();

    const result = addParameterRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...payload.measurementPoints[0],
          pointCode: 'S0001',
          documentsAndImages: [],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('accepts a legacy CEMS add-parameter request without documents', () => {
    const payload = createCemsPayload();

    const result = createConnectionRequestSchema.safeParse({
      ...payload,
      requestType: 'ADD_PARAMETER',
      measurementPoints: [
        {
          ...payload.measurementPoints[0],
          pointCode: 'S0001',
          documentsAndImages: [],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('applies add-parameter section rules when the legacy create route declares that type', () => {
    const result = createConnectionRequestSchema.safeParse({
      ...createCemsPayload(),
      requestType: 'ADD_PARAMETER',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'pointCode'],
          }),
        ]),
      );
    }
  });

  it('accepts the new CEMS contract and derives requested CS2 parameters from pending parameters', () => {
    const result = addMeasurementPointRequestSchema.safeParse(createCemsPayload());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurementPoints[0].parameters).toEqual([
        'CS2 (ppm)',
        'CS2 (ppb)',
        'CS2 (mg/m³)',
      ]);
      expect(result.data.measurementPoints[0].details).toMatchObject({
        legalAnnexNo: ['1', '13'],
        combustionControlSystem: 'ระบบปิด',
        treatmentSystem: ['ระบบถุงกรอง', 'อื่นๆ'],
        connectionDevice: 'D-POMS Client (ใหม่)',
      });
    }
  });

  it('accepts multiple WPMS treatment systems and multiple document rows per non-logo title', () => {
    const result = addMeasurementPointRequestSchema.safeParse(createWpmsPayload());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurementPoints[0].parameters).toEqual(['COD (mg/l)']);
      expect(result.data.measurementPoints[0].documentsAndImages).toHaveLength(3);
      expect(result.data.measurementPoints[0].details).toMatchObject({
        treatmentSystem: ['Activated Sludge', 'อื่นๆ'],
        treatmentSystemOther: 'ระบบเฉพาะของโรงงาน',
      });
    }
  });

  it('keeps accepting a legacy single treatment-system string', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];

    expect(
      addMeasurementPointRequestSchema.safeParse({
        ...payload,
        measurementPoints: [
          {
            ...point,
            details: {
              ...point.details,
              treatmentSystem: 'ระบถุงกรอง',
            },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it('accepts an empty treatment-system array when the form selects ไม่มี', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];

    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          details: {
            ...point.details,
            hasTreatmentSystem: 'ไม่มี',
            treatmentSystem: [],
            treatmentSystemOther: null,
          },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ['CEMS', createCemsPayload()],
    ['WPMS', createWpmsPayload()],
  ])('requires treatmentSystemOther when %s selects อื่นๆ', (_systemType, payload) => {
    const point = payload.measurementPoints[0];
    const { treatmentSystemOther: _treatmentSystemOther, ...details } = point.details;

    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [{ ...point, details }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'treatmentSystemOther'],
          }),
        ]),
      );
    }
  });

  it('requires biomass details for both primary and secondary fuels', () => {
    const payload = createCemsPayload();
    payload.measurementPoints[0].details.primaryFuelOther = '';
    payload.measurementPoints[0].details.secondaryFuel = 'Biomass';

    const result = addMeasurementPointRequestSchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'primaryFuelOther'],
          }),
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'secondaryFuelOther'],
          }),
        ]),
      );
    }
  });

  it('rejects requested parameters that are not still pending', () => {
    const payload = createCemsPayload();
    payload.measurementPoints[0].details.requestedParameters = ['NOx (ppm)'];

    const result = addMeasurementPointRequestSchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'requestedParameters'],
          }),
        ]),
      );
    }
  });

  it('rejects instrument parameters that do not match requestedParameters', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];

    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          parameters: ['NOx (ppm)'],
          measurementInstruments: {
            ...point.measurementInstruments,
            parameters: [{ parameter: 'NOx (ppm)' }],
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'measurementInstruments', 'parameters'],
          }),
        ]),
      );
    }
  });

  it('rejects treatment choices that contradict hasTreatmentSystem ไม่มี', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];

    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          details: {
            ...point.details,
            hasTreatmentSystem: 'ไม่มี',
            treatmentSystem: ['อื่นๆ'],
            treatmentSystemOther: null,
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'treatmentSystem'],
          }),
        ]),
      );
    }
  });

  it('requires the Other treatment detail even when hasTreatmentSystem is omitted', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];
    const { hasTreatmentSystem: _hasTreatmentSystem, ...details } = point.details;

    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          details: {
            ...details,
            treatmentSystem: ['อื่นๆ'],
            treatmentSystemOther: null,
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'treatmentSystemOther'],
          }),
        ]),
      );
    }
  });

  it('rejects an unsupported hasTreatmentSystem value', () => {
    const payload = createWpmsPayload();
    payload.measurementPoints[0].details.hasTreatmentSystem = 'unknown';

    const result = addMeasurementPointRequestSchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'hasTreatmentSystem'],
          }),
        ]),
      );
    }
  });

  it('accepts a blank control-system value but rejects values outside the dropdown contract', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];
    const blankResult = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          details: { ...point.details, combustionControlSystem: null },
        },
      ],
    });
    const invalidResult = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          details: { ...point.details, combustionControlSystem: 'arbitrary value' },
        },
      ],
    });

    expect(blankResult.success).toBe(true);
    expect(invalidResult.success).toBe(false);
  });

  it('does not derive the display-only ไม่มี option as a measurement parameter', () => {
    const payload = createCemsPayload();
    payload.measurementPoints[0].details.pendingParameters = ['ไม่มี'];
    payload.measurementPoints[0].details.requestedParameters = [];

    const result = addMeasurementPointRequestSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurementPoints[0].parameters).toEqual([]);
      expect(result.data.measurementPoints[0].details).toMatchObject({
        pendingParameters: ['ไม่มี'],
      });
    }
  });

  it('rejects ไม่มี mixed with real parameter options', () => {
    const payload = createCemsPayload();
    payload.measurementPoints[0].details.pendingParameters = ['ไม่มี', 'CO (ppm)'];
    payload.measurementPoints[0].details.requestedParameters = [];

    const result = addMeasurementPointRequestSchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'pendingParameters'],
          }),
        ]),
      );
    }
  });

  it('rejects CEMS legal-annex numbers outside 1-13', () => {
    const payload = createCemsPayload();
    payload.measurementPoints[0].details.legalAnnexNo = ['14'];

    const result = addMeasurementPointRequestSchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'legalAnnexNo'],
          }),
        ]),
      );
    }
  });

  it('rejects document metadata above 5 MB', () => {
    const payload = createCemsPayload();
    payload.measurementPoints[0].documentsAndImages[0].fileSize = FIVE_MEBIBYTES + 1;

    const result = addMeasurementPointRequestSchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'documentsAndImages', 0, 'fileSize'],
          }),
        ]),
      );
    }
  });

  it('rejects more than one company-logo document per monitoring point', () => {
    const payload = createCemsPayload();
    payload.measurementPoints[0].documentsAndImages.push({
      title: FACTORY_LOGO_TITLE,
      fileName: 'logo-duplicate.png',
      fileUrl: 'https://example.com/files/logo-duplicate.png',
      fileType: 'image/png',
      fileSize: 1024,
    });

    const result = addMeasurementPointRequestSchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'documentsAndImages'],
          }),
        ]),
      );
    }
  });

  it('rejects more than one company logo across all points in the same request', () => {
    const payload = createCemsPayload();
    const firstPoint = payload.measurementPoints[0];
    const logo = firstPoint.documentsAndImages.find(
      (document) => document.title === FACTORY_LOGO_TITLE,
    );

    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        firstPoint,
        {
          ...firstPoint,
          pointName: 'ปล่องระบาย B',
          documentsAndImages: logo ? [logo] : [],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 1, 'documentsAndImages'],
          }),
        ]),
      );
    }
  });

  it.each([
    ['link', 'javascript:alert(1)'],
    ['fileUrl', 'data:text/html,<script>alert(1)</script>'],
  ])('rejects unsafe %s URL schemes in submitted document metadata', (field, value) => {
    const payload = createCemsPayload();
    const document = payload.measurementPoints[0].documentsAndImages[0];
    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...payload.measurementPoints[0],
          documentsAndImages: [{ ...document, [field]: value }],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects zero-byte document metadata', () => {
    const payload = createCemsPayload();
    payload.measurementPoints[0].documentsAndImages[0].fileSize = 0;

    expect(addMeasurementPointRequestSchema.safeParse(payload).success).toBe(false);
  });

  it('drops empty frontend document placeholders before persistence', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];
    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          documentsAndImages: [
            ...point.documentsAndImages,
            {
              title: 'ระบบบำบัด',
              description: null,
              link: null,
              fileName: null,
              fileUrl: null,
              fileType: null,
              fileSize: null,
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurementPoints[0].documentsAndImages).toHaveLength(3);
      expect(result.data.measurementPoints[0].documentsAndImages).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ title: 'ระบบบำบัด' })]),
      );
    }
  });

  it('treats whitespace-only placeholder metadata as empty', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];
    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          documentsAndImages: [
            ...point.documentsAndImages,
            {
              title: 'ระบบบำบัด',
              description: '   ',
              link: null,
              fileName: null,
              fileUrl: null,
              fileType: null,
              fileSize: null,
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurementPoints[0].documentsAndImages).toHaveLength(3);
    }
  });

  it('drops a frontend placeholder that only carries static guidance text', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];
    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          documentsAndImages: [
            ...point.documentsAndImages,
            {
              title: 'ข้อมูลรายละเอียดการรายงานค่าที่สภาวะมาตรฐาน',
              description: 'ข้อความแนะนำคงที่จาก frontend',
              link: null,
              fileName: null,
              fileUrl: null,
              fileType: null,
              fileSize: null,
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurementPoints[0].documentsAndImages).toHaveLength(3);
    }
  });

  it('does not let empty document placeholders satisfy the CEMS document section', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];
    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          documentsAndImages: [
            {
              title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน',
              description: null,
              link: null,
              fileName: null,
              fileUrl: null,
              fileType: null,
              fileSize: null,
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'documentsAndImages'],
          }),
        ]),
      );
    }
  });

  it('rejects malformed document objects instead of silently treating them as placeholders', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];
    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          documentsAndImages: [
            ...point.documentsAndImages,
            {
              title: 'เอกสารผิดรูปแบบ',
              fileSize: -99,
              unexpected: 'must not be ignored',
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'documentsAndImages', 3],
          }),
        ]),
      );
    }
  });

  it('does not count file metadata without a link or fileUrl as a real CEMS document', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];
    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          documentsAndImages: [
            {
              title: 'เอกสารที่ยังไม่ได้อัปโหลด',
              fileName: 'missing-upload.pdf',
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'documentsAndImages', 0, 'fileUrl'],
          }),
        ]),
      );
    }
  });

  it('applies the same add-point rules when a revised request is resubmitted', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];
    const result = resubmitConnectionRequestSchema.safeParse({
      ...payload,
      requestType: 'ADD_MEASUREMENT_POINT',
      measurementPoints: [
        {
          ...point,
          details: {
            ...point.details,
            legalAnnexNo: ['14'],
            pendingParameters: ['CO (ppm)'],
            requestedParameters: ['NOx (ppm)'],
            primaryFuel: 'ชีวมวล',
            primaryFuelOther: null,
            treatmentSystem: ['อื่นๆ'],
            treatmentSystemOther: null,
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'legalAnnexNo'],
          }),
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'requestedParameters'],
          }),
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'primaryFuelOther'],
          }),
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'treatmentSystemOther'],
          }),
        ]),
      );
    }
  });

  it('preserves an omitted request type until the resubmit service resolves the original type', () => {
    const payload = createCemsPayload();
    const result = resubmitConnectionRequestSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requestType).toBeUndefined();
    }
  });

  it.each(['มี IEE', 'มี EIA', 'มี EHIA'] as const)(
    'accepts the frontend environmental assessment value %s without losing it',
    (eia) => {
      const result = addMeasurementPointRequestSchema.safeParse({
        ...createCemsPayload(),
        eia,
        eiaOther: null,
        hasEia: true,
        projectName: 'โครงการทดสอบ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject({
          eia,
          eiaOther: null,
          hasEia: true,
          projectName: 'โครงการทดสอบ',
        });
      }
    },
  );

  it('accepts and preserves the frontend Other environmental assessment detail', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...createCemsPayload(),
      eia: 'อื่นๆ',
      eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
      hasEia: false,
      projectName: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        eia: 'อื่นๆ',
        eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
        hasEia: false,
      });
    }
  });

  it('rejects a missing Other environmental assessment detail', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...createCemsPayload(),
      eia: 'อื่นๆ',
      eiaOther: null,
      hasEia: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ['eiaOther'] })]),
      );
    }
  });

  it('rejects a frontend environmental assessment that contradicts hasEia', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...createCemsPayload(),
      eia: 'ไม่มี',
      eiaOther: null,
      hasEia: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ['hasEia'] })]),
      );
    }
  });

  it('accepts CEMS regulation-clause tags as a string array', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];

    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          details: {
            ...point.details,
            exemptedParameterRegulationClauses: ['ข้อ 5 (1)', 'ข้อ 7'],
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurementPoints[0].details).toMatchObject({
        exemptedParameterRegulationClauses: ['ข้อ 5 (1)', 'ข้อ 7'],
      });
    }
  });

  it('rejects a non-string CEMS regulation-clause tag list', () => {
    const payload = createCemsPayload();
    const point = payload.measurementPoints[0];

    const result = addMeasurementPointRequestSchema.safeParse({
      ...payload,
      measurementPoints: [
        {
          ...point,
          details: {
            ...point.details,
            exemptedParameterRegulationClauses: 7,
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'exemptedParameterRegulationClauses'],
          }),
        ]),
      );
    }
  });
});
