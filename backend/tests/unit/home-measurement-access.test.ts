import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import {
  CONNECTION_REQUEST_STATUS,
  type ConnectedMeasurementPointDetailDTO,
} from '../../src/modules/connection-requests/connection-requests.types';
import { parameterValuesService } from '../../src/modules/parameter-values/parameter-values.service';

const point: ConnectedMeasurementPointDetailDTO = {
  id: 1,
  requestId: 1,
  requestNo: 'TEST',
  factory: null,
  type: 'CEMS',
  status: 'แสดง',
  statusCode: CONNECTION_REQUEST_STATUS.CONNECTED,
  connectedAt: '2025-12-29T17:00:00Z',
  deviceConfigs: [],
  point: {
    id: 1,
    pointName: 'จุดทดสอบ',
    pointCode: 'S0001',
    pointType: 'STACK',
    parameters: ['CO (ppm)', 'CO (%)', 'NOx (ppm)'],
    latitude: null,
    longitude: null,
    description: null,
  },
};

const calls = [
  () =>
    connectionRequestsService.getMeasurementStatistics('S0001', { date: '2026-09-23' }, 42, 'ALL'),
  () => connectionRequestsService.getCalendarStatus('S0001', { month: '2026-09' }, 42, 'ALL'),
  () =>
    connectionRequestsService.getCalendarStatusDetails(
      'S0001',
      {
        year: '2026',
        summaryType: 'lowData',
        parameterCode: 'CO',
        unit: 'ppm',
      },
      42,
      'ALL',
    ),
];

beforeEach(() => {
  jest
    .spyOn(connectionRequestsService, 'listConnectedMeasurementPoints')
    .mockResolvedValue({ data: [point], meta: { total: 1 } });
  jest.spyOn(connectionRequestsRepository, 'getHomeMeasurementPointVisibility').mockResolvedValue({
    factoryVisible: true,
    pointVisible: true,
    fullyExempt: false,
    parameters: ['CO (ppm)'],
    measurementInstruments: null,
  });
  for (const method of [
    'measurementStatistics',
    'calendarStatus',
    'calendarStatusDetails',
  ] as const) {
    jest
      .spyOn(parameterValuesService, method)
      .mockRejectedValue(new Error('MEASUREMENT_QUERY_REACHED'));
  }
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('home statistics access and visible parameter boundary', () => {
  it.each(calls)('rejects hidden or exempt stations before reading measurements', async (call) => {
    for (const blocked of [
      { factoryVisible: false },
      { pointVisible: false },
      { fullyExempt: true },
    ]) {
      jest
        .mocked(connectionRequestsRepository.getHomeMeasurementPointVisibility)
        .mockResolvedValue({
          factoryVisible: true,
          pointVisible: true,
          fullyExempt: false,
          parameters: ['CO (ppm)'],
          measurementInstruments: null,
          ...blocked,
        });
      await expect(call()).rejects.toMatchObject({ statusCode: 404 });
    }
    expect(parameterValuesService.measurementStatistics).not.toHaveBeenCalled();
    expect(parameterValuesService.calendarStatus).not.toHaveBeenCalled();
    expect(parameterValuesService.calendarStatusDetails).not.toHaveBeenCalled();
  });

  it.each(calls)(
    'passes only visible unit-specific parameters and the connection date',
    async (call) => {
      await expect(call()).rejects.toThrow('MEASUREMENT_QUERY_REACHED');
      const invoked = [
        parameterValuesService.measurementStatistics,
        parameterValuesService.calendarStatus,
        parameterValuesService.calendarStatusDetails,
      ].find((fn) => jest.mocked(fn).mock.calls.length);
      expect(invoked).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          allowedParameterLabels: ['CO (ppm)'],
          expectedStartDate: '2025-12-30',
          parameterEvaluations: [
            {
              parameter: 'CO (ppm)',
              standardCriteria: null,
              eiaCriteria: null,
              channelStatus: null,
            },
          ],
        }),
      );
    },
  );
});
