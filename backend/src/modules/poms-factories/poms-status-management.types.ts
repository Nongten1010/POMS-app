import type { PermissionScopeDetails } from '../auth/permissions';
import type { RegionalAccessDTO } from '../auth/regional-access';

export type Visibility = 'VISIBLE' | 'HIDDEN';
export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED';
export interface ManagedStatus {
  visibility: Visibility;
  connectionStatus: ConnectionStatus;
}
export interface StoredPointStatus extends ManagedStatus {
  parameters: Record<string, Visibility>;
}
export interface StoredFactoryStatus {
  factory: ManagedStatus;
  measurementPoints: Record<string, StoredPointStatus>;
}
export interface StatusPatch {
  visibility?: Visibility;
  connectionStatus?: ConnectionStatus;
}
export interface StatusManagementInput {
  expectedRevision: number;
  factory?: StatusPatch;
  measurementPoints?: Array<
    StatusPatch & {
      connectedPointId: number;
      parameters?: Array<{ parameter: string; visibility: Visibility }>;
    }
  >;
}
export interface StatusActor {
  actorUserId: number;
  roles: string[];
  scope: string | null | undefined | PermissionScopeDetails;
  regionalAccess?: RegionalAccessDTO | null;
}
export interface StatusPoint {
  connectedPointId: number;
  pointCode: string | null;
  pointName: string;
  systemType: 'CEMS' | 'WPMS';
  parameters: Array<{ parameter: string; displayName: string }>;
}
export interface StatusSource {
  eligibleFactoryId: number;
  factoryId: string;
  factoryName: string;
  measurementPoints: StatusPoint[];
}
export interface StatusSnapshot {
  state: StoredFactoryStatus;
  revision: number;
  updatedAt: string | null;
  updatedBy: number | null;
}
export const defaultManagedStatus = (): ManagedStatus => ({
  visibility: 'VISIBLE',
  connectionStatus: 'CONNECTED',
});
export const defaultFactoryStatus = (): StoredFactoryStatus => ({
  factory: defaultManagedStatus(),
  measurementPoints: {},
});

export type PomsDisplayStatus = 'แสดง' | 'ซ่อน' | 'ยกเลิกการเชื่อมต่อ';
export interface PomsManagedStatusDTO extends ManagedStatus {
  status: PomsDisplayStatus;
  effectiveVisibility: Visibility;
  effectiveConnectionStatus: ConnectionStatus;
}
