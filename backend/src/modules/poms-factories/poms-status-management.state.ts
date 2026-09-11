import { ConflictError, NotFoundError } from '../../shared/errors/AppError';
import {
  defaultManagedStatus,
  defaultFactoryStatus,
  type PomsManagedStatusDTO,
  type ManagedStatus,
  type Visibility,
  type StatusManagementInput,
  type StatusSnapshot,
  type StatusSource,
  type StoredFactoryStatus,
} from './poms-status-management.types';

export function applyStatusManagementPatch(
  source: StatusSource,
  current: StatusSnapshot,
  input: StatusManagementInput,
): StoredFactoryStatus {
  if (input.expectedRevision !== current.revision)
    throw new ConflictError('Status has changed; reload status-management before saving');
  const next = structuredClone(resolveStatusState(current.state, statusPointScopes(source)));
  if (input.factory) next.factory = { ...next.factory, ...input.factory };
  if (input.factory?.visibility !== undefined) {
    const visibility = input.factory.visibility;
    for (const point of source.measurementPoints) {
      const key = String(point.connectedPointId);
      const own = next.measurementPoints[key] ?? { ...defaultManagedStatus(), parameters: {} };
      next.measurementPoints[key] = {
        ...own,
        visibility: input.factory.visibility,
        parameters: {
          ...own.parameters,
          ...Object.fromEntries(
            point.parameters.map((parameter) => [parameter.parameter, visibility]),
          ),
        },
      };
    }
  }
  for (const patch of input.measurementPoints ?? []) {
    const point = source.measurementPoints.find(
      (p) => p.connectedPointId === patch.connectedPointId,
    );
    if (!point)
      throw new NotFoundError('Connected measurement point does not belong to this POMS factory');
    const key = String(point.connectedPointId);
    const prior = next.measurementPoints[key] ?? { ...defaultManagedStatus(), parameters: {} };
    const status = { ...prior, parameters: { ...prior.parameters } };
    if (patch.visibility !== undefined) {
      const visibility = patch.visibility;
      status.visibility = patch.visibility;
      status.parameters = {
        ...status.parameters,
        ...Object.fromEntries(
          point.parameters.map((parameter) => [parameter.parameter, visibility]),
        ),
      };
    }
    if (patch.connectionStatus !== undefined) status.connectionStatus = patch.connectionStatus;
    for (const value of patch.parameters ?? []) {
      const parameter = point.parameters.find((p) => p.parameter === value.parameter);
      if (!parameter)
        throw new NotFoundError('Parameter is not connected to this measurement point');
      Object.defineProperty(status.parameters, parameter.parameter, {
        value: value.visibility,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    next.measurementPoints[key] = status;
  }
  return resolveStatusState(next, statusPointScopes(source));
}

export interface StatusPointScope {
  connectedPointId: number;
  parameters: readonly string[];
}

function statusPointScopes(source: StatusSource): StatusPointScope[] {
  return source.measurementPoints.map((point) => ({
    connectedPointId: point.connectedPointId,
    parameters: point.parameters.map((parameter) => parameter.parameter),
  }));
}

/** Resolve only current children: removed points/parameters cannot hold a parent open. */
function resolveStatusState(
  state: StoredFactoryStatus,
  points: readonly StatusPointScope[],
): StoredFactoryStatus {
  const factory = { ...defaultManagedStatus(), ...state.factory };
  const measurementPoints = { ...state.measurementPoints };
  for (const point of points) {
    const key = String(point.connectedPointId);
    const saved = state.measurementPoints?.[key];
    const fallback = saved?.visibility ?? factory.visibility;
    const parameters = {
      ...saved?.parameters,
      ...Object.fromEntries(
        point.parameters.map((parameter) => [
          parameter,
          saved?.parameters && Object.hasOwn(saved.parameters, parameter)
            ? (saved.parameters[parameter] ?? fallback)
            : fallback,
        ]),
      ),
    };
    const visibility: Visibility = point.parameters.length
      ? point.parameters.some((parameter) => parameters[parameter] === 'VISIBLE')
        ? 'VISIBLE'
        : 'HIDDEN'
      : fallback;
    measurementPoints[key] = {
      visibility,
      connectionStatus: saved?.connectionStatus ?? 'CONNECTED',
      parameters,
    };
  }
  // Disconnect remains a separate command; a disconnected child cannot make a parent visible.
  const connected = points
    .map((point) => measurementPoints[String(point.connectedPointId)])
    .filter((point) => point.connectionStatus === 'CONNECTED');
  if (connected.length)
    factory.visibility = connected.some((point) => point.visibility === 'VISIBLE')
      ? 'VISIBLE'
      : 'HIDDEN';
  return { factory, measurementPoints };
}

export function effectiveStatus(own: ManagedStatus, parent?: ManagedStatus): ManagedStatus {
  return {
    visibility:
      own.visibility === 'HIDDEN' || parent?.visibility === 'HIDDEN' ? 'HIDDEN' : 'VISIBLE',
    connectionStatus:
      own.connectionStatus === 'DISCONNECTED' || parent?.connectionStatus === 'DISCONNECTED'
        ? 'DISCONNECTED'
        : 'CONNECTED',
  };
}

export function statusManagementDTO(source: StatusSource, snapshot: StatusSnapshot) {
  const state = resolveStatusState(snapshot.state, statusPointScopes(source));
  const factory = state.factory;
  return {
    eligibleFactoryId: source.eligibleFactoryId,
    factoryId: source.factoryId,
    factoryName: source.factoryName,
    revision: snapshot.revision,
    updatedAt: snapshot.updatedAt,
    updatedBy: snapshot.updatedBy,
    factory: {
      ...managedStatusDTO(factory),
      connectionStatusLabel:
        factory.connectionStatus === 'DISCONNECTED' ? 'ยกเลิกการเชื่อมต่อ' : 'เชื่อมต่อแล้ว',
    },
    measurementPoints: source.measurementPoints.map((point) => {
      const own = state.measurementPoints[String(point.connectedPointId)] ?? {
        ...defaultManagedStatus(),
        parameters: {},
      };
      const effective = effectiveStatus(own, factory);
      return {
        connectedPointId: point.connectedPointId,
        pointCode: point.pointCode,
        pointName: point.pointName,
        systemType: point.systemType,
        visibility: own.visibility,
        connectionStatus: own.connectionStatus,
        status: managedStatusDTO(own, factory).status,
        effectiveVisibility: effective.visibility,
        effectiveConnectionStatus: effective.connectionStatus,
        parameters: point.parameters.map((parameter) => {
          const visibility = Object.hasOwn(own.parameters, parameter.parameter)
            ? (own.parameters[parameter.parameter] ?? 'VISIBLE')
            : 'VISIBLE';
          return {
            ...parameter,
            visibility,
            effectiveVisibility:
              visibility === 'HIDDEN' || effective.visibility === 'HIDDEN' ? 'HIDDEN' : 'VISIBLE',
          };
        }),
      };
    }),
  };
}

export function managedStatusDTO(own: ManagedStatus, parent?: ManagedStatus): PomsManagedStatusDTO {
  const effective = effectiveStatus(own, parent);
  return {
    ...own,
    effectiveVisibility: effective.visibility,
    effectiveConnectionStatus: effective.connectionStatus,
    status:
      effective.connectionStatus === 'DISCONNECTED'
        ? 'ยกเลิกการเชื่อมต่อ'
        : effective.visibility === 'HIDDEN'
          ? 'ซ่อน'
          : 'แสดง',
  };
}

/** A complete current factory scope is required, including children with no saved overrides. */
export function readPomsManagedStatuses(
  stateJson: string | null | undefined,
  points: readonly StatusPointScope[],
) {
  const stored: StoredFactoryStatus = stateJson ? JSON.parse(stateJson) : defaultFactoryStatus();
  const state = resolveStatusState(stored, points);
  return {
    factory: managedStatusDTO(state.factory),
    measurementPoints: new Map(
      points.map((point) => {
        const own = state.measurementPoints[String(point.connectedPointId)];
        return [
          point.connectedPointId,
          managedStatusDTO(
            { visibility: own.visibility, connectionStatus: own.connectionStatus },
            state.factory,
          ),
        ] as const;
      }),
    ),
  };
}
