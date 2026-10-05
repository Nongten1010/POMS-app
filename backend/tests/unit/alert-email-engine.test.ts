import { describe, expect, it, jest } from '@jest/globals';
import { createAlertEmailEngine } from '../../src/modules/alert-emails/alert-email-engine';
import type { AlertEventDTO } from '../../src/modules/alert-events/alert-events.types';
import type { AlertEmailPoint } from '../../src/modules/alert-emails/alert-email-source.repository';
import type { ActiveAlertEmailPolicy } from '../../src/modules/alert-emails/alert-email-policy';
import type { AlertEmailBatchInput } from '../../src/modules/alert-emails/alert-email-outbox.repository';

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
    stationId: 'S1',
    startedAt: '2026-10-02T11:00:00+07:00',
    endedAt: '2026-10-02T11:59:59+07:00',
    eventDate: '2026-10-02',
    ...changes,
  } as AlertEventDTO;
}
function dependencies(events = [event(1)]) {
  return {
    source: {
      listPoints: jest.fn<() => Promise<AlertEmailPoint[]>>().mockResolvedValue([point]),
      listEvents: jest.fn<() => Promise<AlertEventDTO[]>>().mockImplementation(async () => events),
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
