import { describe, expect, it, jest } from '@jest/globals';
import {
  createAlertEmailEngine,
  pointMatchesAlertEmailEvent,
} from '../../src/modules/alert-emails/alert-email-engine';
import type { AlertEventDTO } from '../../src/modules/alert-events/alert-events.types';
import type { AlertEmailPoint } from '../../src/modules/alert-emails/alert-email-source.repository';
import type { ActiveAlertEmailPolicy } from '../../src/modules/alert-emails/alert-email-policy';
import type { AlertEmailBatchInput } from '../../src/modules/alert-emails/alert-email-outbox.repository';
import { renderAlertEmail } from '../../src/modules/alert-emails/alert-email-template';

const policy: ActiveAlertEmailPolicy = {
  enabled: true,
  recipientMode: 'POINT_OFFICERS_AND_FACTORY',
  completenessPolicy: 'ON_TIME',
  exemptDayPolicy: 'RESET',
  dailyFormat: 'BY_TYPE',
  abnormalMode: 'PREVIOUS_DAY',
  abnormalReadings: 5,
  hourlyDelayMinutes: 5,
};
const point: AlertEmailPoint = {
  id: 1,
  factoryId: 'F1',
  factoryName: 'Factory',
  factoryRegistrationNo: 'REG1',
  stationId: 'S1',
  pointCode: 'S1',
  pointName: 'Stack',
  pointType: 'STACK',
  systemType: 'CEMS',
  connectedAt: null,
  officerEmails: ['officer@example.com'],
  factoryEmails: ['factory@example.com'],
};
function event(id: number, changes: Partial<AlertEventDTO> = {}): AlertEventDTO {
  return {
    id,
    alertType: 'STANDARD_EXCEEDED',
    systemType: 'CEMS',
    factoryId: 'F1',
    factoryName: 'Factory',
    factoryRegistrationNo: 'REG1',
    stationId: 'S1',
    pointName: 'Stack',
    parameterCode: 'SO2',
    parameterName: 'SO2',
    parameterLabel: 'SO2 (ppm)',
    unit: 'ppm',
    measuredValue: 125,
    thresholdValue: 120,
    thresholdType: 'STANDARD',
    startedAt: '2026-10-02T11:00:00+07:00',
    endedAt: '2026-10-02T11:59:59+07:00',
    eventDate: '2026-10-02',
    detectedAt: '2026-10-02T11:59:59+07:00',
    ...changes,
  } as AlertEventDTO;
}
function dependencies(events = [event(1)]) {
  return {
    source: {
      listPoints: jest.fn<() => Promise<AlertEmailPoint[]>>().mockResolvedValue([point]),
      listEvents: jest
        .fn<
          (input: {
            cadence: 'HOURLY' | 'DAILY';
            startAt: string;
            endAt: string;
          }) => Promise<AlertEventDTO[]>
        >()
        .mockImplementation(async () => events),
    },
    outbox: {
      listBatchedEventIds: jest
        .fn<
          (recipient: string, cadence: 'HOURLY' | 'DAILY', eventIds: number[]) => Promise<number[]>
        >()
        .mockResolvedValue([]),
      enqueue: jest
        .fn<
          (
            input: AlertEmailBatchInput,
          ) => Promise<{ batchId: number; deliveryId: number; created: boolean }>
        >()
        .mockResolvedValue({ batchId: 1, deliveryId: 1, created: true }),
    },
    render: jest
      .fn<
        (input: { events: AlertEventDTO[]; scheduledAt: string }) => {
          subject: string;
          text: string;
          html: string;
        }
      >()
      .mockReturnValue({ subject: 'subject', text: 'text', html: '<p>text</p>' }),
    prepareDaily: jest
      .fn<
        (
          point: AlertEmailPoint,
          date: string,
          policy: ActiveAlertEmailPolicy,
          now: Date,
        ) => Promise<number[]>
      >()
      .mockResolvedValue([]),
  };
}
describe('alert email scheduled engine', () => {
  it('matches station case changes within the same factory and system without widening ownership', () => {
    expect(pointMatchesAlertEmailEvent({ ...point, stationId: 's1' }, event(1))).toBe(true);
    expect(
      pointMatchesAlertEmailEvent({ ...point, stationId: 's1' }, event(1, { factoryId: 'F2' })),
    ).toBe(false);
    expect(
      pointMatchesAlertEmailEvent({ ...point, stationId: 's1' }, event(1, { systemType: 'WPMS' })),
    ).toBe(false);
    expect(
      pointMatchesAlertEmailEvent({ ...point, stationId: 's1' }, event(1, { stationId: 'S2' })),
    ).toBe(false);
  });
  it('does not touch data or mail when disabled', async () => {
    const deps = dependencies();
    await createAlertEmailEngine(deps).run(new Date('2026-10-02T12:05:00+07:00'), {
      enabled: false,
    });
    expect(deps.source.listPoints).not.toHaveBeenCalled();
    expect(deps.outbox.enqueue).not.toHaveBeenCalled();
  });
  it('queues separate primary recipients with mandatory CC for the completed hour', async () => {
    const deps = dependencies();
    const result = await createAlertEmailEngine(deps).run(
      new Date('2026-10-02T12:05:00+07:00'),
      policy,
    );
    expect(result.queued).toBe(2);
    expect(deps.outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        cadence: 'HOURLY',
        recipient: 'officer@example.com',
        cc: ['diw.iemc@gmail.com'],
        scheduledAt: '2026-10-02T05:05:00.000Z',
        eventIds: [1],
      }),
    );
    expect(deps.outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'factory@example.com' }),
    );
  });

  it('loads context only for pending events and freezes the rendered PDF content in the new batch', async () => {
    const deps = dependencies([event(1), event(2)]);
    deps.outbox.listBatchedEventIds.mockResolvedValue([1]);
    const context = { 2: { factoryProvinceName: 'ระยอง', reportingStartedOn: null } };
    const loadRenderContext = jest
      .fn<(events: AlertEventDTO[]) => Promise<typeof context>>()
      .mockResolvedValue(context);
    await createAlertEmailEngine({ ...deps, source: { ...deps.source, loadRenderContext } }).run(
      new Date('2026-10-02T12:05:00+07:00'),
      policy,
    );
    expect(loadRenderContext).toHaveBeenCalledWith([event(2)]);
    expect(deps.render).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [event(2)],
        contextByEventId: context,
      }),
    );
    expect(deps.outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'subject',
        text: 'text',
        html: '<p>text</p>',
        eventIds: [2],
      }),
    );
  });
  it('does not render or queue an email when real rendering metadata cannot be read', async () => {
    const deps = dependencies();
    const loadRenderContext = jest
      .fn<(events: AlertEventDTO[]) => Promise<Record<number, never>>>()
      .mockRejectedValue(new Error('metadata read failed'));
    const result = await createAlertEmailEngine({
      ...deps,
      source: { ...deps.source, loadRenderContext },
    }).run(new Date('2026-10-02T12:05:00+07:00'), policy);
    expect(result).toMatchObject({ queued: 0, errors: 2 });
    expect(deps.render).not.toHaveBeenCalled();
    expect(deps.outbox.enqueue).not.toHaveBeenCalled();
  });

  it('leaves an already queued batch immutable without reading fresh metadata or rendering', async () => {
    const deps = dependencies();
    deps.outbox.listBatchedEventIds.mockResolvedValue([1]);
    const loadRenderContext =
      jest.fn<(events: AlertEventDTO[]) => Promise<Record<number, never>>>();
    await createAlertEmailEngine({ ...deps, source: { ...deps.source, loadRenderContext } }).run(
      new Date('2026-10-02T12:05:00+07:00'),
      policy,
    );
    expect(loadRenderContext).not.toHaveBeenCalled();
    expect(deps.render).not.toHaveBeenCalled();
    expect(deps.outbox.enqueue).not.toHaveBeenCalled();
  });
  it('excludes future windows, daily rows from hourly batches and a different factory', async () => {
    const deps = dependencies([
      event(1, { endedAt: '2026-10-02T12:59:59+07:00' }),
      event(2, { factoryId: 'F2' }),
      event(3, { alertType: 'DAILY_COMPLETENESS_LOW' }),
    ]);
    await createAlertEmailEngine(deps).run(new Date('2026-10-02T12:05:00+07:00'), policy);
    expect(deps.outbox.enqueue).not.toHaveBeenCalled();
  });
  it('subtracts already batched events so a late arrival does not resend the first one', async () => {
    const deps = dependencies([event(1), event(2)]);
    deps.outbox.listBatchedEventIds.mockResolvedValue([1]);
    await createAlertEmailEngine(deps).run(new Date('2026-10-02T12:05:00+07:00'), policy);
    expect(deps.outbox.enqueue).toHaveBeenCalledWith(expect.objectContaining({ eventIds: [2] }));
    expect(deps.render).toHaveBeenCalledWith(expect.objectContaining({ events: [event(2)] }));
  });
  it.each(['11:59:59', '12:01:00', '12:06:00', '12:59:59'])(
    'keeps hourly events pending outside the zero-delay round at %s',
    async (time) => {
      const deps = dependencies();
      await createAlertEmailEngine(deps).run(new Date(`2026-10-02T${time}+07:00`), {
        ...policy,
        hourlyDelayMinutes: 0,
      });
      expect(deps.outbox.enqueue).not.toHaveBeenCalled();
      expect(deps.source.listEvents).not.toHaveBeenCalledWith(
        expect.objectContaining({ cadence: 'HOURLY' }),
      );
    },
  );
  it.each(['12:00:00', '12:00:59'])(
    'queues the completed measurement hour during the clock-hour round at %s',
    async (time) => {
      const deps = dependencies();
      await createAlertEmailEngine(deps).run(new Date(`2026-10-02T${time}+07:00`), {
        ...policy,
        hourlyDelayMinutes: 0,
      });
      expect(deps.outbox.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledAt: '2026-10-02T05:00:00.000Z',
          periodStart: '2026-10-02T04:00:00.000Z',
          periodEnd: '2026-10-02T05:00:00.000Z',
          eventIds: [1],
        }),
      );
    },
  );
  it.each([
    undefined,
    null,
    '',
    'invalid',
    '2026-10-02',
    '2026-10-02T11:59:59',
    '2026-02-30T11:59:59+07:00',
    '2026-10-02T12:00:01+07:00',
  ])(
    'does not include missing, invalid or post-boundary detection %s after a same-round restart',
    async (detectedAt) => {
      const deps = dependencies([event(1, { detectedAt: detectedAt as unknown as string })]);
      await createAlertEmailEngine(deps).run(new Date('2026-10-02T12:00:30+07:00'), {
        ...policy,
        hourlyDelayMinutes: 0,
      });
      expect(deps.outbox.enqueue).not.toHaveBeenCalled();
    },
  );
  it('includes an event detected exactly on the round boundary', async () => {
    const deps = dependencies([event(1, { detectedAt: '2026-10-02T12:00:00+07:00' })]);
    await createAlertEmailEngine(deps).run(new Date('2026-10-02T12:00:30+07:00'), {
      ...policy,
      hourlyDelayMinutes: 0,
    });
    expect(deps.outbox.enqueue).toHaveBeenCalledWith(expect.objectContaining({ eventIds: [1] }));
  });
  it('queues a late event only in the next clock-hour round without repeating prior events or changing measurement time', async () => {
    const events = [event(1)];
    const deps = dependencies(events);
    const alreadyBatched = new Set<number>();
    deps.outbox.listBatchedEventIds.mockImplementation(async (_recipient, _cadence, ids) =>
      ids.filter((id) => alreadyBatched.has(id)),
    );
    deps.outbox.enqueue.mockImplementation(async (input) => {
      input.eventIds.forEach((id) => alreadyBatched.add(id));
      return { batchId: 1, deliveryId: 1, created: true };
    });
    const engine = createAlertEmailEngine({ ...deps, render: renderAlertEmail });
    const hourlyPolicy: ActiveAlertEmailPolicy = {
      ...policy,
      recipientMode: 'POINT_OFFICERS',
      hourlyDelayMinutes: 0,
    };
    expect((await engine.run(new Date('2026-10-02T12:00:00+07:00'), hourlyPolicy)).queued).toBe(1);
    events.push(event(2, { detectedAt: '2026-10-02T12:06:00+07:00' }));
    expect((await engine.run(new Date('2026-10-02T12:06:00+07:00'), hourlyPolicy)).queued).toBe(0);
    expect((await engine.run(new Date('2026-10-02T13:00:00+07:00'), hourlyPolicy)).queued).toBe(1);
    expect(deps.outbox.enqueue).toHaveBeenCalledTimes(2);
    expect(deps.outbox.enqueue).toHaveBeenLastCalledWith(
      expect.objectContaining({
        scheduledAt: '2026-10-02T06:00:00.000Z',
        periodStart: '2026-10-02T04:00:00.000Z',
        periodEnd: '2026-10-02T05:00:00.000Z',
        eventIds: [2],
        subject: expect.stringContaining('เวลา 11.00 น.'),
        text: expect.stringContaining('เวลา 11.00 น.'),
      }),
    );
    expect((await engine.run(new Date('2026-10-02T13:00:30+07:00'), hourlyPolicy)).queued).toBe(0);
  });
  it('keeps an UNKNOWN delivery event batched while queuing only a late unbatched event in the next hourly round', async () => {
    const eventWithUnknownDelivery = event(1);
    const lateEvent = event(2, { detectedAt: '2026-10-02T12:06:00+07:00' });
    const deps = dependencies([eventWithUnknownDelivery, lateEvent]);
    // The persisted mapping remains present for UNKNOWN delivery outcomes.
    deps.outbox.listBatchedEventIds.mockResolvedValue([eventWithUnknownDelivery.id]);
    const render = jest.fn<typeof renderAlertEmail>().mockImplementation(renderAlertEmail);
    const result = await createAlertEmailEngine({ ...deps, render }).run(
      new Date('2026-10-02T13:00:00+07:00'),
      { ...policy, recipientMode: 'POINT_OFFICERS', hourlyDelayMinutes: 0 },
    );
    expect(result.queued).toBe(1);
    expect(deps.outbox.listBatchedEventIds).toHaveBeenCalledWith(
      'officer@example.com',
      'HOURLY',
      [1, 2],
    );
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({ events: [lateEvent], scheduledAt: '2026-10-02T06:00:00.000Z' }),
    );
    expect(deps.outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(deps.outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventIds: [2],
        scheduledAt: '2026-10-02T06:00:00.000Z',
        periodStart: '2026-10-02T04:00:00.000Z',
        subject: expect.stringContaining('เวลา 11.00 น.'),
      }),
    );
  });
  it('retains the configured five-minute delay while refusing hourly batches between rounds', async () => {
    const deps = dependencies();
    const engine = createAlertEmailEngine(deps);
    expect((await engine.run(new Date('2026-10-02T12:04:00+07:00'), policy)).queued).toBe(0);
    expect((await engine.run(new Date('2026-10-02T12:05:00+07:00'), policy)).queued).toBe(2);
    const callsAtRound = deps.outbox.enqueue.mock.calls.length;
    expect((await engine.run(new Date('2026-10-02T12:06:00+07:00'), policy)).queued).toBe(0);
    expect(deps.outbox.enqueue.mock.calls).toHaveLength(callsAtRound);
  });
  it('prepares each point daily once after success and groups case 4/5 by system', async () => {
    const deps = dependencies([
      event(5, {
        alertType: 'CONSECUTIVE_NO_REPORT',
        eventDate: '2026-10-01',
        startedAt: '2026-10-01T00:00:00+07:00',
        endedAt: '2026-10-01T23:59:59+07:00',
      }),
    ]);
    const engine = createAlertEmailEngine(deps);
    deps.prepareDaily.mockResolvedValue([5]);
    await engine.run(new Date('2026-10-02T09:00:00+07:00'), policy);
    await engine.run(new Date('2026-10-02T09:01:00+07:00'), policy);
    expect(deps.prepareDaily).toHaveBeenCalledTimes(1);
    expect(deps.prepareDaily).toHaveBeenCalledWith(point, '2026-10-01', policy, expect.any(Date));
    expect(deps.outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        cadence: 'DAILY',
        systemType: 'CEMS',
        scheduledAt: '2026-10-02T02:00:00.000Z',
      }),
    );
  });
  it('does not send legacy daily events or daily events prepared under a different policy', async () => {
    const deps = dependencies([
      event(5, {
        alertType: 'CONSECUTIVE_NO_REPORT',
        eventDate: '2026-10-01',
        startedAt: '2026-10-01T00:00:00+07:00',
        endedAt: '2026-10-01T23:59:59+07:00',
      }),
    ]);
    await createAlertEmailEngine(deps).run(new Date('2026-10-02T09:00:00+07:00'), policy);
    expect(deps.outbox.enqueue).not.toHaveBeenCalled();
  });
  it('retries failed daily preparation and keeps other recipients progressing', async () => {
    const deps = dependencies();
    deps.prepareDaily.mockRejectedValueOnce(new Error('source unavailable'));
    const engine = createAlertEmailEngine(deps);
    expect((await engine.run(new Date('2026-10-02T12:05:00+07:00'), policy)).errors).toBe(1);
    await engine.run(new Date('2026-10-02T12:06:00+07:00'), policy);
    expect(deps.prepareDaily).toHaveBeenCalledTimes(2);
  });
});
