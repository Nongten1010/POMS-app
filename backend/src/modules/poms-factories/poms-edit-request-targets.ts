import { isDeepStrictEqual } from 'node:util';
import type {
  PomsEditRequestTargetPoint,
  PomsFactoryEditRequestSummaryDTO,
  PomsMeasurementPointDTO,
} from './poms-factories.types';

type TargetSummary = Pick<
  PomsFactoryEditRequestSummaryDTO,
  'targetMeasurementPoints' | 'targetMeasurementPointsSource'
>;

function parse(value: string | null | undefined): unknown {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function points(value: string | null): PomsMeasurementPointDTO[] | null {
  const parsed = parse(value);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (point) =>
        point &&
        Number.isSafeInteger(point.connectedPointId) &&
        point.connectedPointId > 0 &&
        ['CEMS', 'WPMS'].includes(point.systemType) &&
        typeof point.pointName === 'string' &&
        (point.pointCode == null || typeof point.pointCode === 'string') &&
        (point.documentsAndImages == null ||
          (Array.isArray(point.documentsAndImages) &&
            point.documentsAndImages.every(
              (document: unknown) => document && typeof document === 'object',
            ))),
    ) ||
    new Set(parsed.map((point) => point.connectedPointId)).size !== parsed.length
  )
    return null;
  return parsed;
}

function summarize(point: PomsMeasurementPointDTO): PomsEditRequestTargetPoint {
  return {
    connectedPointId: point.connectedPointId,
    systemType: point.systemType,
    pointCode: point.pointCode ?? null,
    pointName: point.pointName,
  };
}

/** Exact submitted IDs take precedence. Legacy differences are explicitly labelled inference. */
export function resolveEditRequestTargets(input: {
  formType: string;
  submittedIds: string | null | undefined;
  currentPoints: string | null;
  proposedPoints: string | null;
  currentContacts?: string | null;
  proposedContacts?: string | null;
}): TargetSummary {
  const empty = (source: TargetSummary['targetMeasurementPointsSource']): TargetSummary => ({
    targetMeasurementPoints: [],
    targetMeasurementPointsSource: source,
  });
  if (input.formType === 'BASIC_INFO') return empty('NOT_APPLICABLE');
  const proposed = points(input.proposedPoints);
  if (!proposed) return empty('UNKNOWN');
  const byId = new Map(proposed.map((point) => [point.connectedPointId, point]));
  if (input.submittedIds != null) {
    const ids = parse(input.submittedIds);
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      !ids.every((id) => Number.isSafeInteger(id) && id > 0 && byId.has(id)) ||
      new Set(ids).size !== ids.length
    )
      return empty('UNKNOWN');
    const selected: PomsEditRequestTargetPoint[] = [];
    for (const id of ids) {
      const point = byId.get(id);
      if (!point) return empty('UNKNOWN');
      selected.push(summarize(point));
    }
    return {
      targetMeasurementPoints: selected,
      targetMeasurementPointsSource: 'SUBMITTED',
    };
  }
  const current = points(input.currentPoints);
  if (
    !current ||
    current.length !== proposed.length ||
    !current.every((point) => byId.has(point.connectedPointId))
  )
    return empty('UNKNOWN');
  const beforeById = new Map(current.map((point) => [point.connectedPointId, point]));
  // Root contact updates can fan out to every point of a system. They do not identify selected IDs.
  const contactsUnchanged = isDeepStrictEqual(
    parse(input.currentContacts),
    parse(input.proposedContacts),
  );
  const fields: (keyof PomsMeasurementPointDTO)[] = [
    'pointName',
    'monitoringPointStatus',
    'details',
    'measurementInstruments',
    ...(contactsUnchanged ? ['officerNotificationEmails' as const] : []),
  ];
  const changed = proposed.filter((point) => {
    const before = beforeById.get(point.connectedPointId);
    if (!before) return false;
    return (
      fields.some((field) => !isDeepStrictEqual(before[field] ?? null, point[field] ?? null)) ||
      !isDeepStrictEqual(pointDocuments(before), pointDocuments(point))
    );
  });
  return changed.length
    ? {
        targetMeasurementPoints: changed.map(summarize),
        targetMeasurementPointsSource: 'SNAPSHOT_DIFF',
      }
    : empty('UNKNOWN');
}

function pointDocuments(point: PomsMeasurementPointDTO) {
  // Factory-level photos/logos are replicated into point snapshots by the form mapper.
  return (point.documentsAndImages ?? []).filter(
    (document) =>
      document.title !== 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน' &&
      document.title !== 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท',
  );
}
