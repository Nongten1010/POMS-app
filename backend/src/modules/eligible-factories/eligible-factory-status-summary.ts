import type { MonitoringPointSystemType } from '../monitoring-point-forms/monitoring-point-forms.types';
import type { EligibleFactoryConnectionStatusSummary } from './eligible-factories.types';

interface ConnectionStatusPoint {
  systemType: MonitoringPointSystemType;
  monitoringPointStatus?: string | null;
}

export function deriveConnectionStatusSummary(
  points: readonly ConnectionStatusPoint[],
  systemType: MonitoringPointSystemType,
): EligibleFactoryConnectionStatusSummary {
  const systemPoints = points.filter((point) => point.systemType === systemType);

  if (systemPoints.length === 0) return 'ยังไม่แล้วเสร็จ';
  if (systemPoints.every((point) => point.monitoringPointStatus === 'เชื่อมต่อครบแล้ว')) {
    return 'เชื่อมต่อครบถ้วน';
  }
  if (systemPoints.every((point) => point.monitoringPointStatus === 'ได้รับการยกเว้นทั้งหมด')) {
    return 'ได้รับยกเว้นทั้งหมด';
  }

  return 'ยังไม่แล้วเสร็จ';
}
