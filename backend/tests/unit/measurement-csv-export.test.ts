import { describe, expect, it } from '@jest/globals';
import { Readable } from 'node:stream';
import { createMeasurementCsvExport } from '../../src/modules/parameter-values/measurement-csv-export';

describe('createMeasurementCsvExport', () => {
  it('streams an authorized hourly export as the agreed UTF-8 CSV contract', async () => {
    const result = createMeasurementCsvExport({
      stationId: 'S0199',
      factoryName: 'โรงไฟฟ้าพระนครเหนือ ชุดที่ 2',
      frequency: 'hourly',
      startDate: '2026-08-09',
      endDate: '2026-08-09',
      registeredParameters: ['CO (ppm)', 'Flow Rate (m3/hr)'],
      requestedParameters: ['CO (ppm)', 'Flow Rate (m3/hr)'],
      rows: [
        {
          cdate: '2026-08-09',
          ctime: '00:00:00',
          co_value: 76.74,
          co_status: 1,
          flow_value: 94.2,
          flow_status: 'Normal',
        },
      ],
    });

    expect(result.filename).toBe('measurement-S0199-hourly-2026-08-09-2026-08-09.csv');
    expect(result.contentType).toBe('text/csv; charset=utf-8');
    await expect(readStream(result.stream)).resolves.toBe(
      '\uFEFFdate_time,factory_name,meas_code,CO (ppm),Flow Rate (m3/hr)\r\n' +
        '2026-08-09 00:00:00,โรงไฟฟ้าพระนครเหนือ ชุดที่ 2,S0199,76.74,94.20\r\n',
    );
  });

  it('canonicalizes requested parameters with unit-sensitive matching and preserves request order', async () => {
    const result = createMeasurementCsvExport({
      stationId: 'S0199',
      factoryName: 'โรงงานทดสอบ',
      frequency: 'hourly',
      startDate: '2026-08-09',
      endDate: '2026-08-09',
      registeredParameters: ['CO2 (%)', 'CO2 (ppm)'],
      requestedParameters: [' co2 (PPM) ', 'CO2 (ppm)', 'co2 (%)'],
      rows: [
        {
          cdate: '2026-08-09',
          ctime: '01:00:00',
          co2_percent_value: 10.4,
          co2_percent_status: 'Normal',
          co2_ppm_value: 530,
          co2_ppm_status: 'Normal',
        },
      ],
    });

    await expect(readStream(result.stream)).resolves.toBe(
      '\uFEFFdate_time,factory_name,meas_code,CO2 (ppm),CO2 (%)\r\n' +
        '2026-08-09 01:00:00,โรงงานทดสอบ,S0199,530.00,10.40\r\n',
    );
  });

  it('exports normal measurements as numbers and non-normal statuses in the same cells', async () => {
    const result = createMeasurementCsvExport({
      stationId: 'S0199',
      factoryName: 'โรงงานทดสอบ',
      frequency: 'hourly',
      startDate: '2026-08-09',
      endDate: '2026-08-09',
      registeredParameters: [
        'CO (ppm)',
        'NOx (ppm)',
        'SO2 (ppm)',
        'Flow Rate (m3/hr)',
        'Temp. (°C)',
        'O2 (%)',
      ],
      requestedParameters: ['all'],
      rows: [
        {
          cdate: '2026-08-09',
          ctime: '02:00:00',
          co_value: 12.345,
          co_status: 1,
          nox_value: 88.2,
          nox_status: 4,
          so2_value: 3.2,
          so2_status: 0,
          flow_value: 44.4,
          flow_status: 9,
          temp_value: 31.5,
          temp_status: 'unexpected-state',
          o2_value: 10.2,
          o2_status: null,
        },
        {
          cdate: '2026-08-09',
          ctime: '03:00:00',
          data_completeness_percent: 79,
          co_value: 22.2,
          co_status: 1,
          nox_value: 99.9,
          nox_status: 'Maintenance',
        },
      ],
    });

    await expect(readStream(result.stream)).resolves.toBe(
      '\uFEFFdate_time,factory_name,meas_code,CO (ppm),NOx (ppm),SO2 (ppm),Flow Rate (m3/hr),Temp. (°C),O2 (%)\r\n' +
        '2026-08-09 02:00:00,โรงงานทดสอบ,S0199,12.35,Maintenance,NoData,No Discharge,Etc.,10.20\r\n' +
        '2026-08-09 03:00:00,โรงงานทดสอบ,S0199,,,,,,\r\n',
    );
  });

  it('treats the Ok source status as normal and exports its numeric value', async () => {
    const result = createMeasurementCsvExport({
      stationId: 'S0199',
      factoryName: 'โรงงานทดสอบ',
      frequency: 'hourly',
      startDate: '2026-08-09',
      endDate: '2026-08-09',
      registeredParameters: ['CO (ppm)'],
      requestedParameters: ['all'],
      rows: [
        {
          cdate: '2026-08-09',
          ctime: '04:00:00',
          co_value: 33.3,
          co_status: 'Ok',
        },
      ],
    });

    await expect(readStream(result.stream)).resolves.toContain(
      '2026-08-09 04:00:00,โรงงานทดสอบ,S0199,33.30\r\n',
    );
  });

  it('sorts daily rows oldest first, preserves duplicate timestamps, and defaults missing time to midnight', async () => {
    const result = createMeasurementCsvExport({
      stationId: 'W2001',
      factoryName: 'โรงงานทดสอบ',
      frequency: 'daily',
      startDate: '2026-08-09',
      endDate: '2026-08-10',
      registeredParameters: ['BOD (mg/l)'],
      requestedParameters: ['all'],
      rows: [
        { cdate: '2026-08-10', bod_value: 4, bod_status: 1 },
        { cdate: '2026-08-09', ctime: '12:00:00', bod_value: 2, bod_status: 1 },
        { cdate: '2026-08-09', ctime: '12:00:00', bod_value: 3, bod_status: 1 },
      ],
    });

    await expect(readStream(result.stream)).resolves.toBe(
      '\uFEFFdate_time,factory_name,meas_code,BOD (mg/l)\r\n' +
        '2026-08-09 12:00:00,โรงงานทดสอบ,W2001,2.00\r\n' +
        '2026-08-09 12:00:00,โรงงานทดสอบ,W2001,3.00\r\n' +
        '2026-08-10 00:00:00,โรงงานทดสอบ,W2001,4.00\r\n',
    );
  });

  it('uses RFC 4180 escaping and neutralizes spreadsheet formulas in string cells', async () => {
    const result = createMeasurementCsvExport({
      stationId: 'S0199',
      factoryName: '=SUM(1,2) "ทดสอบ"',
      frequency: 'hourly',
      startDate: '2026-08-09',
      endDate: '2026-08-09',
      registeredParameters: ['CO (ppm)'],
      requestedParameters: ['all'],
      rows: [{ cdate: '2026-08-09', ctime: '00:00:00', co_value: 1, co_status: 1 }],
    });

    await expect(readStream(result.stream)).resolves.toContain(
      '2026-08-09 00:00:00,"\'=SUM(1,2) ""ทดสอบ""",S0199,1.00\r\n',
    );
  });

  it('sanitizes annual station identifiers before using them in the download filename', () => {
    const result = createMeasurementCsvExport({
      stationId: 'CEMS-0001/2569',
      factoryName: 'โรงงานทดสอบ',
      frequency: 'daily',
      startDate: '2026-08-09',
      endDate: '2026-08-09',
      registeredParameters: ['CO (ppm)'],
      requestedParameters: ['all'],
      rows: [{ cdate: '2026-08-09', co_value: 1, co_status: 1 }],
    });

    expect(result.filename).toBe('measurement-CEMS-0001-2569-daily-2026-08-09-2026-08-09.csv');
  });

  it('adds source units to bare registered parameters and canonicalizes the flow-rate label', async () => {
    const result = createMeasurementCsvExport({
      stationId: 'S0199',
      factoryName: 'โรงงานทดสอบ',
      frequency: 'hourly',
      startDate: '2026-08-09',
      endDate: '2026-08-09',
      registeredParameters: ['CO', 'Flow'],
      requestedParameters: ['CO (ppm)', 'Flow Rate (m3/hr)'],
      rows: [
        {
          cdate: '2026-08-09',
          ctime: '00:00:00',
          co_value: 1,
          co_units: 'ppm',
          co_status: 1,
          flow_value: 2,
          flow_units: 'm3/hr',
          flow_status: 1,
        },
      ],
    });

    await expect(readStream(result.stream)).resolves.toContain(
      'date_time,factory_name,meas_code,CO (ppm),Flow Rate (m3/hr)\r\n',
    );
  });

  it('does not export a generic source column when its unit differs from the selected parameter', async () => {
    const result = createMeasurementCsvExport({
      stationId: 'S0199',
      factoryName: 'โรงงานทดสอบ',
      frequency: 'hourly',
      startDate: '2026-08-09',
      endDate: '2026-08-09',
      registeredParameters: ['CO2 (%)', 'CO2 (ppm)'],
      requestedParameters: ['CO2 (ppm)'],
      rows: [
        {
          cdate: '2026-08-09',
          ctime: '00:00:00',
          co2_value: 10.4,
          co2_units: '%',
          co2_status: 1,
        },
      ],
    });

    await expect(readStream(result.stream)).resolves.toContain(
      '2026-08-09 00:00:00,โรงงานทดสอบ,S0199,\r\n',
    );
  });

  it('treats a whitespace-only source status as empty when a numeric value exists', async () => {
    const result = createMeasurementCsvExport({
      stationId: 'S0199',
      factoryName: 'โรงงานทดสอบ',
      frequency: 'hourly',
      startDate: '2026-08-09',
      endDate: '2026-08-09',
      registeredParameters: ['CO (ppm)'],
      requestedParameters: ['all'],
      rows: [
        {
          cdate: '2026-08-09',
          ctime: '00:00:00',
          co_value: 1,
          co_status: '   ',
        },
      ],
    });

    await expect(readStream(result.stream)).resolves.toContain(
      '2026-08-09 00:00:00,โรงงานทดสอบ,S0199,1.00\r\n',
    );
  });
});

async function readStream(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8');
}
