import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: jest.fn() } }));
jest.mock('../../src/config/smtp', () => ({
  buildSmtpTransportOptions: jest.fn(),
  getDefaultMailFrom: jest.fn(),
}));
jest.mock('../../src/config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.mock('../../src/config/database', () => ({ db: jest.fn() }));
jest.mock('../../src/modules/alert-emails/alert-email-engine', () => ({
  createAlertEmailEngine: jest.fn(),
}));
jest.mock('../../src/modules/alert-emails/alert-email.worker', () => ({
  createAlertEmailWorker: jest.fn(),
}));
jest.mock('../../src/modules/alert-emails/alert-email-dispatch', () => ({
  dispatchNextAlertEmail: jest.fn(),
}));
jest.mock('../../src/modules/alert-emails/alert-email-source.repository', () => ({
  alertEmailSourceRepository: { listPoints: jest.fn(), listEvents: jest.fn() },
}));
jest.mock('../../src/modules/alert-emails/alert-email-outbox.repository', () => ({
  alertEmailOutboxRepository: {},
}));
jest.mock('../../src/modules/alert-emails/alert-email-measurements', () => ({
  loadAlertEmailParameters: jest.fn(),
}));
jest.mock('../../src/modules/alert-emails/alert-email-daily-detector', () => ({
  buildDailyAlertCandidates: jest.fn(),
}));
jest.mock('../../src/modules/alert-emails/alert-email-daily.repository', () => ({
  alertEmailDailyRepository: { create: jest.fn() },
}));
jest.mock('../../src/modules/alert-emails/alert-email-template', () => ({
  renderAlertEmail: jest.fn(),
}));
jest.mock('../../src/modules/alert-emails/alert-email-eligibility', () => ({
  isAlertEmailJobEligible: jest.fn(),
}));
jest.mock('../../src/modules/device-connections/device-connections.service', () => ({
  deviceConnectionsService: { listActiveSettingsForIntegration: jest.fn() },
}));
jest.mock('../../src/modules/alert-emails/alert-parameter-activations.repository', () => ({
  listActiveAlertParameterActivations: jest.fn(),
}));
jest.mock('../../src/modules/alert-events/alert-events.repository', () => ({
  toAlertEventDTO: jest.fn(),
}));

import nodemailer from 'nodemailer';
import { buildSmtpTransportOptions, getDefaultMailFrom } from '../../src/config/smtp';
import { logger } from '../../src/config/logger';
import { db } from '../../src/config/database';
import { startAlertEmailWorker } from '../../src/modules/alert-emails/alert-email-runtime';
import { createAlertEmailWorker } from '../../src/modules/alert-emails/alert-email.worker';
import { createAlertEmailEngine } from '../../src/modules/alert-emails/alert-email-engine';
import { dispatchNextAlertEmail } from '../../src/modules/alert-emails/alert-email-dispatch';
import { alertEmailSourceRepository } from '../../src/modules/alert-emails/alert-email-source.repository';
import { loadAlertEmailParameters } from '../../src/modules/alert-emails/alert-email-measurements';
import { buildDailyAlertCandidates } from '../../src/modules/alert-emails/alert-email-daily-detector';
import { alertEmailDailyRepository } from '../../src/modules/alert-emails/alert-email-daily.repository';
import { isAlertEmailJobEligible } from '../../src/modules/alert-emails/alert-email-eligibility';
import { toAlertEventDTO } from '../../src/modules/alert-events/alert-events.repository';
import { deviceConnectionsService } from '../../src/modules/device-connections/device-connections.service';
import { listActiveAlertParameterActivations } from '../../src/modules/alert-emails/alert-parameter-activations.repository';
import type { AlertEventDTO } from '../../src/modules/alert-events/alert-events.types';
import type { AlertEmailJob } from '../../src/modules/alert-emails/alert-email-outbox.repository';
import type { AlertEmailPoint } from '../../src/modules/alert-emails/alert-email-source.repository';

const settings = {
  ALERT_EMAIL_ENABLED: 'true',
  ALERT_EMAIL_RECIPIENT_MODE: 'POINT_OFFICERS',
  ALERT_EMAIL_COMPLETENESS_POLICY: 'ON_TIME',
  ALERT_EMAIL_EXEMPT_DAY_POLICY: 'RESET',
  ALERT_EMAIL_DAILY_FORMAT: 'BY_TYPE',
  ALERT_EMAIL_ABNORMAL_MODE: 'PREVIOUS_DAY',
  ALERT_EMAIL_ABNORMAL_READINGS: '5',
  ALERT_EMAIL_HOURLY_DELAY_MINUTES: '5',
};
const handle = { runOnce: jest.fn<() => Promise<void>>(), stop: jest.fn<() => Promise<void>>() };
const sendMail = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const close = jest.fn();
const engineRun = jest.fn<ReturnType<typeof createAlertEmailEngine>['run']>();
const select = jest.fn<() => Promise<unknown[]>>();
const whereIn = jest.fn<(...args: unknown[]) => unknown>();
const whereNull = jest.fn<(...args: unknown[]) => unknown>();
const query = { whereIn, whereNull, select };
const point = {
  id: 55,
  systemType: 'CEMS',
  stationId: 'S1',
  officerEmails: ['one@example.test'],
} as AlertEmailPoint;
const event = {
  id: 10,
  alertType: 'STANDARD_EXCEEDED',
  systemType: 'CEMS',
  stationId: 'S1',
  parameterCode: 'co2',
  unit: 'ppm',
  startedAt: '2026-10-04T11:00:00.000Z',
} as AlertEventDTO;
const job = {
  id: 2,
  eventIds: [10],
  cadence: 'HOURLY',
  periodStart: '2026-10-04T04:00:00.000Z',
} as AlertEmailJob;
const registryConfigs = jest.mocked(deviceConnectionsService.listActiveSettingsForIntegration);
const registryActivations = jest.mocked(listActiveAlertParameterActivations);

function workerDependencies() {
  return jest.mocked(createAlertEmailWorker).mock.calls[0][1];
}
function engineDependencies() {
  return jest.mocked(createAlertEmailEngine).mock.calls[0][0];
}
function dispatchDependencies() {
  return jest.mocked(dispatchNextAlertEmail).mock.calls[0][0];
}

describe('startAlertEmailWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    handle.runOnce.mockResolvedValue(undefined);
    handle.stop.mockResolvedValue(undefined);
    jest.mocked(createAlertEmailWorker).mockReturnValue(handle);
    jest.mocked(createAlertEmailEngine).mockReturnValue({ run: engineRun });
    engineRun.mockResolvedValue({ queued: 0, skipped: 0, errors: 0 });
    jest.mocked(buildSmtpTransportOptions).mockReturnValue({ host: 'smtp.example.test' });
    jest.mocked(getDefaultMailFrom).mockReturnValue('alerts@example.test');
    jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail, close } as never);
    sendMail.mockResolvedValue({
      accepted: ['one@example.test'],
      rejected: [],
      messageId: 'message-1',
    });
    jest.mocked(dispatchNextAlertEmail).mockResolvedValue({ claimed: false });
    jest.mocked(loadAlertEmailParameters).mockResolvedValue([]);
    jest.mocked(buildDailyAlertCandidates).mockReturnValue([]);
    jest.mocked(alertEmailSourceRepository.listPoints).mockResolvedValue([point]);
    jest.mocked(isAlertEmailJobEligible).mockResolvedValue(true);
    jest.mocked(toAlertEventDTO).mockImplementation((row) => ({ ...event, id: Number(row.id) }));
    registryConfigs.mockResolvedValue([
      {
        updatedAt: '2026-10-01T00:00:00.000Z',
        channels: [{ dataType: 'CO₂ (ppm)', testMode: false }],
      } as never,
    ]);
    registryActivations.mockResolvedValue([
      { parameterCode: 'co2', unit: 'ppm', activatedAt: '2026-10-01T00:00:00.000Z' },
    ]);
    (db as unknown as jest.Mock).mockReturnValue(query);
    whereIn.mockReturnValue(query);
    whereNull.mockReturnValue(query);
    select.mockResolvedValue([{ id: 10, evidence_json: null }]);
  });

  it('disabled policy never creates a transport or engine and never queries SQL or dispatches mail', async () => {
    const worker = startAlertEmailWorker({ ALERT_EMAIL_ENABLED: 'false' });
    await worker.runOnce();
    await workerDependencies().prepare(new Date(), {} as never);
    await workerDependencies().dispatch();
    workerDependencies().reportError('DISPATCH_FAILED');
    await worker.stop();
    expect(jest.mocked(createAlertEmailWorker).mock.calls[0][0]).toEqual({ enabled: false });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(buildSmtpTransportOptions).not.toHaveBeenCalled();
    expect(createAlertEmailEngine).not.toHaveBeenCalled();
    expect(db).not.toHaveBeenCalled();
    expect(dispatchNextAlertEmail).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rejects incomplete explicit business policy before touching SMTP or SQL', () => {
    expect(() => startAlertEmailWorker({ ALERT_EMAIL_ENABLED: 'true' })).toThrow();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(db).not.toHaveBeenCalled();
  });

  it('requires configured SMTP and From with a generic error', () => {
    jest.mocked(buildSmtpTransportOptions).mockReturnValue(null);
    expect(() => startAlertEmailWorker(settings)).toThrow('Alert email SMTP is not configured');
    jest.mocked(buildSmtpTransportOptions).mockImplementation(() => {
      throw new Error('password=hidden');
    });
    expect(() => startAlertEmailWorker(settings)).toThrow('Alert email SMTP is not configured');
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('does not start when From is missing even if transport settings exist', () => {
    jest.mocked(getDefaultMailFrom).mockReturnValue(undefined);
    expect(() => startAlertEmailWorker(settings)).toThrow('Alert email SMTP is not configured');
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('wires a bounded SMTP transport and starts one initial worker tick', async () => {
    const worker = startAlertEmailWorker(settings);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 30_000,
        greetingTimeout: 15_000,
        socketTimeout: 60_000,
      }),
    );
    expect(handle.runOnce).toHaveBeenCalledTimes(1);
    await workerDependencies().dispatch();
    await dispatchDependencies().transport.send({
      to: 'one@example.test',
      cc: ['diw.iemc@gmail.com'],
      subject: 'sample',
      text: 'plain',
      html: '<table></table>',
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'alerts@example.test', cc: ['diw.iemc@gmail.com'] }),
    );
    await worker.stop();
    expect(handle.stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('persists each daily candidate and supplies current-policy event IDs to the engine', async () => {
    startAlertEmailWorker(settings);
    const parameters = [{ code: 'co2', name: 'CO₂', unit: 'ppm', samples: [], dailySummaries: [] }];
    jest.mocked(loadAlertEmailParameters).mockResolvedValue(parameters);
    jest
      .mocked(buildDailyAlertCandidates)
      .mockReturnValue([{ idempotency_key: 'one' }, { idempotency_key: 'two' }] as never);
    jest
      .mocked(alertEmailDailyRepository.create)
      .mockResolvedValueOnce({ id: 11 } as AlertEventDTO)
      .mockResolvedValueOnce({ id: 12 } as AlertEventDTO);
    const policy = jest.mocked(createAlertEmailWorker).mock.calls[0][0];
    const now = new Date('2026-10-05T02:00:00Z');
    expect(
      await engineDependencies().prepareDaily(point, '2026-10-04', policy as never, now),
    ).toEqual([11, 12]);
    expect(buildDailyAlertCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        parameters,
        detectedAt: now.toISOString(),
        completenessPolicy: 'ON_TIME',
        exemptDayPolicy: 'RESET',
        abnormalReadings: 5,
      }),
    );
  });

  it('fetches all event IDs in bounded SQL queries and delegates complete batch eligibility using fresh points', async () => {
    startAlertEmailWorker(settings);
    await workerDependencies().dispatch();
    const manyIds = Array.from({ length: 1001 }, (_, index) => index + 1);
    select
      .mockResolvedValueOnce([{ id: 1, evidence_json: '{"completenessPolicy":"ON_TIME"}' }])
      .mockResolvedValueOnce([{ id: 1001, evidence_json: 'bad-json' }]);
    expect(await dispatchDependencies().isRecipientEligible({ ...job, eventIds: manyIds })).toBe(
      true,
    );
    expect(whereIn).toHaveBeenNthCalledWith(1, 'id', manyIds.slice(0, 1000));
    expect(whereIn).toHaveBeenNthCalledWith(2, 'id', [1001]);
    expect(whereNull).toHaveBeenCalledWith('deleted_at');
    const dependencies = jest.mocked(isAlertEmailJobEligible).mock.calls[0][2];
    expect(dependencies.events).toEqual([
      { event: expect.objectContaining({ id: 1 }), evidence: { completenessPolicy: 'ON_TIME' } },
      { event: expect.objectContaining({ id: 1001 }), evidence: null },
    ]);
    expect(alertEmailSourceRepository.listPoints).toHaveBeenCalledTimes(1);
  });

  it('checks exact registered units, canonical Unicode parameter names, trusted activation and test mode before SMTP', async () => {
    startAlertEmailWorker(settings);
    await workerDependencies().dispatch();
    await dispatchDependencies().isRecipientEligible(job);
    const check = jest.mocked(isAlertEmailJobEligible).mock.calls[0][2].hasActiveParameter;
    expect(await check(event)).toBe(true);
    expect(await check({ ...event, unit: '%' })).toBe(false);
    expect(await check({ ...event, unit: null })).toBe(false);
    expect(deviceConnectionsService.listActiveSettingsForIntegration).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('keeps a completed-hour event eligible after its device configuration is edited', async () => {
    startAlertEmailWorker(settings);
    await workerDependencies().dispatch();
    registryConfigs.mockResolvedValue([
      {
        updatedAt: '2026-10-05T06:00:00Z',
        channels: [{ dataType: 'CO₂ (ppm)', testMode: false }],
      } as never,
    ]);
    await dispatchDependencies().isRecipientEligible(job);
    const check = jest.mocked(isAlertEmailJobEligible).mock.calls[0][2].hasActiveParameter;
    expect(await check(event)).toBe(true);
    expect(registryActivations).toHaveBeenCalledWith(55);
  });

  it('skips hourly mail when activation evidence is unavailable', async () => {
    registryActivations.mockResolvedValue([]);
    startAlertEmailWorker(settings);
    await workerDependencies().dispatch();
    await dispatchDependencies().isRecipientEligible(job);
    const check = jest.mocked(isAlertEmailJobEligible).mock.calls[0][2].hasActiveParameter;
    expect(await check(event)).toBe(false);
  });

  it('uses daily event time for registry ownership and rejects missing or ambiguous daily time', async () => {
    startAlertEmailWorker(settings);
    await workerDependencies().dispatch();
    await dispatchDependencies().isRecipientEligible({ ...job, cadence: 'DAILY' });
    const check = jest.mocked(isAlertEmailJobEligible).mock.calls[0][2].hasActiveParameter;
    expect(await check({ ...event, startedAt: '2026-10-03T17:00:00.000Z' })).toBe(true);
    expect(await check({ ...event, startedAt: null })).toBe(false);
    expect(await check({ ...event, startedAt: '2026-10-03T17:00:00' })).toBe(false);
  });
  it('checks a legacy daily event against the carried activation of its replacement live point', async () => {
    jest.mocked(alertEmailSourceRepository.listPoints).mockResolvedValue([
      {
        ...point,
        id: 99,
        stationId: 's1',
        factoryId: 'factory-1',
        connectedAt: '2026-10-04T10:00:00+07:00',
      },
    ]);
    startAlertEmailWorker(settings);
    await workerDependencies().dispatch();
    await dispatchDependencies().isRecipientEligible({ ...job, cadence: 'DAILY' });
    const check = jest.mocked(isAlertEmailJobEligible).mock.calls[0][2].hasActiveParameter;
    expect(
      await check({
        ...event,
        factoryId: 'factory-1',
        alertType: 'DAILY_COMPLETENESS_LOW',
        startedAt: '2026-10-03T17:00:00.000Z',
      }),
    ).toBe(true);
    expect(registryActivations).toHaveBeenCalledWith(99);
    expect(registryActivations).not.toHaveBeenCalledWith(55);
    expect(await check({ ...event, factoryId: 'other-factory' })).toBe(false);
  });

  it('treats array, null, and primitive evidence as unavailable rather than an authorization policy', async () => {
    startAlertEmailWorker(settings);
    await workerDependencies().dispatch();
    select.mockResolvedValue([
      { id: 1, evidence_json: '[]' },
      { id: 2, evidence_json: 'null' },
      { id: 3, evidence_json: '"ON_TIME"' },
    ]);
    await dispatchDependencies().isRecipientEligible({ ...job, eventIds: [1, 2, 3] });
    expect(
      jest
        .mocked(isAlertEmailJobEligible)
        .mock.calls[0][2].events.every((item) => item.evidence === null),
    ).toBe(true);
  });

  it('normalizes valid transport address records and discards malformed result records', async () => {
    startAlertEmailWorker(settings);
    await workerDependencies().dispatch();
    sendMail.mockResolvedValue({
      messageId: 'message-1',
      accepted: [{ address: 'one@example.test' }, null, 3, {}],
      rejected: undefined,
    });
    expect(
      await dispatchDependencies().transport.send({
        to: 'one@example.test',
        cc: ['diw.iemc@gmail.com'],
        subject: 'sample',
        text: 'plain',
        html: '<table></table>',
      }),
    ).toEqual({
      messageId: 'message-1',
      accepted: ['one@example.test'],
      rejected: [],
    });
  });

  it.each([
    {
      updatedAt: '2026-10-04T06:00:00Z',
      activatedAt: '2026-10-04T06:00:00Z',
      dataType: 'CO₂ (ppm)',
      testMode: false,
    },
    {
      updatedAt: '2026-10-01T00:00:00',
      activatedAt: '2026-10-01T00:00:00',
      dataType: 'CO₂ (ppm)',
      testMode: false,
    },
    { updatedAt: 'bad-dateZ', activatedAt: 'bad-dateZ', dataType: 'CO₂ (ppm)', testMode: false },
    { updatedAt: '2026-10-01T00:00:00Z', dataType: 'CO₂ (ppm)', testMode: true },
    { updatedAt: '2026-10-01T00:00:00Z', dataType: 'CO₂', testMode: false },
    { updatedAt: '2026-10-01T00:00:00Z', dataType: 'NOx (ppm)', testMode: false },
    { updatedAt: '2026-10-01T00:00:00Z', dataType: 'ภาษาไทย (ppm)', testMode: false },
  ])('rejects a new, ambiguous, missing-unit, or test registration: %j', async (registration) => {
    startAlertEmailWorker(settings);
    await workerDependencies().dispatch();
    registryConfigs.mockResolvedValue([
      {
        updatedAt: registration.updatedAt,
        channels: [{ dataType: registration.dataType, testMode: registration.testMode }],
      } as never,
    ]);
    if (typeof registration.activatedAt === 'string')
      registryActivations.mockResolvedValue([
        { parameterCode: 'co2', unit: 'ppm', activatedAt: registration.activatedAt },
      ]);
    await dispatchDependencies().isRecipientEligible(job);
    const check = jest.mocked(isAlertEmailJobEligible).mock.calls[0][2].hasActiveParameter;
    expect(await check(event)).toBe(false);
  });

  it('logs generic preparation or dispatch status codes without sensitive mail data', async () => {
    startAlertEmailWorker(settings);
    engineRun.mockResolvedValue({ queued: 1, skipped: 2, errors: 3 });
    await workerDependencies().prepare(
      new Date(),
      jest.mocked(createAlertEmailWorker).mock.calls[0][0] as never,
    );
    jest
      .mocked(dispatchNextAlertEmail)
      .mockResolvedValue({ claimed: true, deliveryId: 55, status: 'UNKNOWN' });
    await workerDependencies().dispatch();
    workerDependencies().reportError('DISPATCH_FAILED');
    const logged = JSON.stringify(jest.mocked(logger.warn).mock.calls);
    expect(logged).toContain('PREPARATION_FAILED');
    expect(logged).toContain('UNKNOWN');
    expect(logged).toContain('DISPATCH_FAILED');
    expect(logged).not.toMatch(/one@example|smtp\.example|<table|password|dbPass/);
  });
});
