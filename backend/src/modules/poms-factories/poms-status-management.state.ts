import { ConflictError, NotFoundError } from '../../shared/errors/AppError';
import {
  defaultManagedStatus,
  defaultFactoryStatus,
  type PomsManagedStatusDTO,
  type ManagedStatus,
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
  const next = structuredClone(current.state);
  if (input.factory) next.factory = { ...next.factory, ...input.factory };
  for (const patch of input.measurementPoints ?? []) {
    const point = source.measurementPoints.find(
      (p) => p.connectedPointId === patch.connectedPointId,
    );
    if (!point)
      throw new NotFoundError('Connected measurement point does not belong to this POMS factory');
    const key = String(point.connectedPointId);
    const prior = next.measurementPoints[key] ?? { ...defaultManagedStatus(), parameters: {} };
    const status = { ...prior, parameters: { ...prior.parameters } };
    if (patch.visibility !== undefined) status.visibility = patch.visibility;
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
  return next;
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
  const factory = snapshot.state.factory;
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
      const own = snapshot.state.measurementPoints[String(point.connectedPointId)] ?? {
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

/** Shared by current POMS reads; workflow monitoringPointStatus remains independent. */
export function readPomsManagedStatus(
  stateJson?: string | null,
  connectedPointId?: number,
): PomsManagedStatusDTO {
  const state: StoredFactoryStatus = stateJson ? JSON.parse(stateJson) : defaultFactoryStatus();
  const factory = { ...defaultManagedStatus(), ...state.factory };
  if (connectedPointId === undefined) return managedStatusDTO(factory);
  const point = state.measurementPoints?.[String(connectedPointId)];
  return managedStatusDTO(
    {
      visibility: point?.visibility ?? 'VISIBLE',
      connectionStatus: point?.connectionStatus ?? 'CONNECTED',
    },
    factory,
  );
}
