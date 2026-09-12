import type {
  PomsFactoryContactsSnapshot,
  PomsFactoryFormContactsDTO,
  PomsMeasurementPointDTO,
} from './poms-factories.types';

export function contactSnapshot(
  source: PomsFactoryFormContactsDTO | null,
  points: PomsMeasurementPointDTO[],
  systemType: 'CEMS' | 'WPMS' | null,
): PomsFactoryContactsSnapshot {
  const scoped = points.filter((point) => systemType === null || point.systemType === systemType);
  return {
    systemType,
    contactPersons: (source?.contactPersons ?? []).map((contact) => ({ ...contact })),
    notificationEmails: [...(source?.notificationEmails ?? [])],
    officerNotificationEmails: [
      ...new Set(
        scoped.flatMap(
          (point) => point.officerNotificationEmails ?? source?.officerNotificationEmails ?? [],
        ),
      ),
    ].sort(),
  };
}

export function contactsChanged(
  before: PomsFactoryContactsSnapshot | null | undefined,
  after: PomsFactoryContactsSnapshot | null | undefined,
): boolean {
  return Boolean(before && after && JSON.stringify(before) !== JSON.stringify(after));
}
