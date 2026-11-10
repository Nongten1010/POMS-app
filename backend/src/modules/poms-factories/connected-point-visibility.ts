import { approvedParameterLabel, parameterKey } from './poms-measurement-point-parameters';
import type { StoredFactoryStatus } from './poms-status-management.types';

export function isExcludedMonitoringPointStatus(status: string | null | undefined): boolean {
  return ['ได้รับการยกเว้นทั้งหมด', 'อยู่ระหว่างขยายเวลา'].includes(status?.trim() ?? '');
}

/** Home and general information share parent-first visibility of current connected points. */
export function connectedPointVisibility(input: {
  connectedPointId: number | string;
  parameters: string[];
  managementState: StoredFactoryStatus | null;
  monitoringPointStatus?: string | null;
  factoryIsActive?: boolean | number | null;
}) {
  const { managementState: state, parameters: registered } = input;
  const own = state?.measurementPoints?.[String(input.connectedPointId)];
  const factoryVisible =
    input.factoryIsActive !== false &&
    input.factoryIsActive !== 0 &&
    state?.factory?.visibility !== 'HIDDEN' &&
    state?.factory?.connectionStatus !== 'DISCONNECTED';
  const savedParameters = Object.entries(own?.parameters ?? {});
  const visibleParameters = registered.filter(
    (parameter) =>
      !savedParameters.some(
        ([saved, visibility]) =>
          visibility === 'HIDDEN' &&
          (parameterKey(saved) === parameterKey(parameter) ||
            approvedParameterLabel(saved, registered) === parameter),
      ),
  );
  const pointVisible =
    factoryVisible &&
    !isExcludedMonitoringPointStatus(input.monitoringPointStatus) &&
    own?.visibility !== 'HIDDEN' &&
    own?.connectionStatus !== 'DISCONNECTED' &&
    (registered.length === 0 || visibleParameters.length > 0);
  return {
    factoryVisible,
    pointVisible,
    fullyExempt: input.monitoringPointStatus?.trim() === 'ได้รับการยกเว้นทั้งหมด',
    parameters: pointVisible ? visibleParameters : [],
  };
}
