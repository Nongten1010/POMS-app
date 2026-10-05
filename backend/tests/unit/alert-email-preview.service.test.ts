import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('../../src/modules/alert-events/alert-events.service', () => ({
  alertEventsService: { getById: jest.fn() },
}));
jest.mock('../../src/modules/alert-emails/alert-email-template', () => ({
  renderAlertEmail: jest.fn(),
}));
jest.mock('../../src/modules/alert-emails/alert-email-source.repository', () => ({
  alertEmailSourceRepository: { loadRenderContext: jest.fn() },
}));
import { alertEmailSourceRepository } from '../../src/modules/alert-emails/alert-email-source.repository';
import { alertEventsService } from '../../src/modules/alert-events/alert-events.service';
import { renderAlertEmail } from '../../src/modules/alert-emails/alert-email-template';
import {
  alertEmailPreviewService,
  alertEmailPreviewSchema,
} from '../../src/modules/alert-emails/alert-email-preview';
import type { AlertEventDTO } from '../../src/modules/alert-events/alert-events.types';
const getById = jest.mocked(alertEventsService.getById);
const render = jest.mocked(renderAlertEmail);
const loadContext = jest.mocked(alertEmailSourceRepository.loadRenderContext);

describe('alert email preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadContext.mockResolvedValue({});
  });
  it('requires unique event IDs, bounded lists, an actual date and explicit timezone', () => {
    expect(
      alertEmailPreviewSchema.safeParse({
        eventIds: [1, 1],
        scheduledAt: '2026-10-02T09:00:00+07:00',
      }).success,
    ).toBe(false);
    expect(
      alertEmailPreviewSchema.safeParse({ eventIds: [], scheduledAt: '2026-10-02T09:00:00+07:00' })
        .success,
    ).toBe(false);
    expect(
      alertEmailPreviewSchema.safeParse({
        eventIds: [1],
        scheduledAt: '2026-10-02T09:00:00',
        to: 'other@example.com',
      }).success,
    ).toBe(false);
    expect(
      alertEmailPreviewSchema.safeParse({ eventIds: [1], scheduledAt: '2026-02-30T09:00:00+07:00' })
        .success,
    ).toBe(false);
    expect(
      alertEmailPreviewSchema.safeParse({ eventIds: [1], scheduledAt: '2026-10-02T09:00:00+07:00' })
        .success,
    ).toBe(true);
  });
  it('checks every event against actor scope before rendering any content', async () => {
    getById.mockRejectedValue(new Error('out of scope'));
    await expect(
      alertEmailPreviewService.preview(
        { eventIds: [1], scheduledAt: '2026-10-02T09:00:00+07:00' },
        { userId: 7, scope: { scope: 'OWN_FACTORY' }, regionalAccess: null },
      ),
    ).rejects.toThrow('out of scope');
    expect(render).not.toHaveBeenCalled();
    expect(loadContext).not.toHaveBeenCalled();
    expect(getById).toHaveBeenCalledWith(1, 7, { scope: 'OWN_FACTORY' }, null, false);
  });
  it('returns a preview only after the requested measurement window ends', async () => {
    getById.mockResolvedValue({ id: 1, endedAt: '2026-10-02T11:59:59+07:00' } as AlertEventDTO);
    render.mockReturnValue({ subject: '[D-POMS]', text: 'example', html: '<p>example</p>' });
    await expect(
      alertEmailPreviewService.preview(
        { eventIds: [1], scheduledAt: '2026-10-02T11:05:00+07:00' },
        { userId: 7, scope: { scope: 'ALL' }, regionalAccess: null },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(render).not.toHaveBeenCalled();
    const result = await alertEmailPreviewService.preview(
      { eventIds: [1], scheduledAt: '2026-10-02T12:05:00+07:00' },
      { userId: 7, scope: { scope: 'ALL' }, regionalAccess: null },
    );
    expect(result).toMatchObject({
      eventCount: 1,
      scheduledAt: '2026-10-02T12:05:00+07:00',
      subject: '[D-POMS]',
    });
  });
  it('converts invalid grouping to a public validation error', async () => {
    getById.mockResolvedValue({ id: 1, endedAt: null } as AlertEventDTO);
    render.mockImplementation(() => {
      throw new Error('internal grouping details');
    });
    await expect(
      alertEmailPreviewService.preview(
        { eventIds: [1], scheduledAt: '2026-10-02T09:00:00+07:00' },
        { userId: 7, scope: { scope: 'ALL' }, regionalAccess: null },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
  it('uses the original validated Bangkok measurement window when a legacy DATETIME2 lost its offset', async () => {
    getById.mockResolvedValue({
      id: 1,
      alertType: 'STANDARD_EXCEEDED',
      systemType: 'CEMS',
      stationId: 'S1',
      parameterCode: 'co',
      unit: 'ppm',
      startedAt: '2026-10-02T11:00:00Z',
      endedAt: '2026-10-02T11:59:59Z',
      sourcePayload: {
        systemType: 'CEMS',
        stationId: 'S1',
        parameterCode: 'co',
        unit: 'ppm',
        eventDate: '2026-10-02',
        time: '11:00',
        measuredValue: 12,
        thresholdValue: 10,
        thresholdType: 'STANDARD',
      },
    } as unknown as AlertEventDTO);
    render.mockReturnValue({ subject: '[D-POMS]', text: 'example', html: '<p>example</p>' });
    await alertEmailPreviewService.preview(
      { eventIds: [1], scheduledAt: '2026-10-02T12:05:00+07:00' },
      { userId: 7, scope: 'ALL', regionalAccess: null },
    );
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [
          expect.objectContaining({
            startedAt: '2026-10-02T11:00:00+07:00',
            endedAt: '2026-10-02T11:59:59+07:00',
          }),
        ],
      }),
    );
  });
  it('reads real rendering metadata only after every requested event passes access checks', async () => {
    getById.mockResolvedValueOnce({ id: 1, endedAt: null } as AlertEventDTO);
    getById.mockResolvedValueOnce({ id: 2, endedAt: null } as AlertEventDTO);
    const context = { 1: { factoryProvinceName: 'ระยอง', reportingStartedOn: '2026-09-15' } };
    loadContext.mockResolvedValue(context);
    render.mockReturnValue({ subject: 'PDF subject', text: 'PDF body', html: '<p>PDF body</p>' });
    await alertEmailPreviewService.preview(
      { eventIds: [1, 2], scheduledAt: '2026-10-02T09:00:00+07:00' },
      { userId: 7, scope: 'ALL', regionalAccess: null },
    );
    expect(loadContext).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 2 }),
    ]);
    expect(loadContext.mock.invocationCallOrder[0]).toBeGreaterThan(
      Math.max(...getById.mock.invocationCallOrder),
    );
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ contextByEventId: context }));
  });
  it('does not read metadata when another requested event is outside actor scope', async () => {
    getById.mockResolvedValueOnce({ id: 1, endedAt: null } as AlertEventDTO);
    getById.mockRejectedValueOnce(new Error('out of scope'));
    await expect(
      alertEmailPreviewService.preview(
        { eventIds: [1, 2], scheduledAt: '2026-10-02T09:00:00+07:00' },
        { userId: 7, scope: 'OWN_FACTORY', regionalAccess: null },
      ),
    ).rejects.toThrow('out of scope');
    expect(loadContext).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });
  it('does not render when reading real metadata fails', async () => {
    getById.mockResolvedValue({ id: 1, endedAt: null } as AlertEventDTO);
    loadContext.mockRejectedValue(new Error('metadata read failed'));
    await expect(
      alertEmailPreviewService.preview(
        { eventIds: [1], scheduledAt: '2026-10-02T09:00:00+07:00' },
        { userId: 7, scope: 'ALL', regionalAccess: null },
      ),
    ).rejects.toThrow('metadata read failed');
    expect(render).not.toHaveBeenCalled();
  });
});
