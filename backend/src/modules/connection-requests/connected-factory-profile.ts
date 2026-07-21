import { deriveHasEiaFromAssessment } from './connection-request-eia';
import type { ConnectionRequestDTO, RequestDocumentImageInput } from './connection-requests.types';

const FACTORY_FRONT_PHOTO_DOCUMENT_TITLE = 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน';
const FACTORY_LOGO_DOCUMENT_TITLE = 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท';

export interface FactoryProfileSyncSource {
  latitude?: number | null;
  longitude?: number | null;
  eia?: ConnectionRequestDTO['eia'];
  eiaOther?: string | null;
  projectName?: string | null;
  measurementPoints: Array<{
    documentsAndImages?: RequestDocumentImageInput[];
  }>;
}

export type ConnectedFactoryProfilePatch = Partial<{
  factory_latitude: number;
  factory_longitude: number;
  factory_eia_assessment: NonNullable<ConnectionRequestDTO['eia']>;
  factory_eia_other: string | null;
  factory_has_eia: boolean;
  factory_project_name: string;
  factory_front_photos_json: string;
  factory_logo_json: string;
}>;

export type EligibleFactoryProfilePatch = Partial<{
  latitude: number;
  longitude: number;
  eia_assessment: NonNullable<ConnectionRequestDTO['eia']>;
  eia_other: string | null;
  has_eia: boolean;
  project_name: string;
}>;

export function buildConnectedFactoryProfilePatch(
  source: FactoryProfileSyncSource,
): ConnectedFactoryProfilePatch {
  const patch: ConnectedFactoryProfilePatch = {};
  if (hasCompleteFactoryCoordinates(source)) {
    patch.factory_latitude = source.latitude;
    patch.factory_longitude = source.longitude;
  }
  if (source.eia != null) {
    patch.factory_eia_assessment = source.eia;
    patch.factory_eia_other = source.eia === 'อื่นๆ' ? (source.eiaOther ?? null) : null;
    patch.factory_has_eia = deriveHasEiaFromAssessment(source.eia);
  }
  if (source.projectName != null) patch.factory_project_name = source.projectName;

  const factoryDocuments = source.measurementPoints.flatMap(
    (point) => point.documentsAndImages ?? [],
  );
  const frontPhotos = factoryDocuments.filter(
    (document) => document.title === FACTORY_FRONT_PHOTO_DOCUMENT_TITLE,
  );
  if (frontPhotos.length > 0) {
    patch.factory_front_photos_json = JSON.stringify(frontPhotos);
  }
  const logo = factoryDocuments.find((document) => document.title === FACTORY_LOGO_DOCUMENT_TITLE);
  if (logo) patch.factory_logo_json = JSON.stringify(logo);
  return patch;
}

export function buildEligibleFactoryProfilePatch(
  source: FactoryProfileSyncSource,
): EligibleFactoryProfilePatch {
  const patch: EligibleFactoryProfilePatch = {};
  if (hasCompleteFactoryCoordinates(source)) {
    patch.latitude = source.latitude;
    patch.longitude = source.longitude;
  }
  if (source.eia != null) {
    patch.eia_assessment = source.eia;
    patch.eia_other = source.eia === 'อื่นๆ' ? (source.eiaOther ?? null) : null;
    patch.has_eia = deriveHasEiaFromAssessment(source.eia);
  }
  if (source.projectName != null) patch.project_name = source.projectName;
  return patch;
}

function hasCompleteFactoryCoordinates(
  source: FactoryProfileSyncSource,
): source is FactoryProfileSyncSource & { latitude: number; longitude: number } {
  return (
    source.latitude != null &&
    source.longitude != null &&
    Number.isFinite(source.latitude) &&
    Number.isFinite(source.longitude)
  );
}
