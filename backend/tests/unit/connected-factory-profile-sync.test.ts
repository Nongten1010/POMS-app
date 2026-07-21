import { describe, expect, it } from '@jest/globals';
import {
  buildConnectedFactoryProfilePatch,
  buildEligibleFactoryProfilePatch,
} from '../../src/modules/connection-requests/connected-factory-profile';

const FACTORY_FRONT_PHOTO_TITLE = 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน';
const FACTORY_LOGO_TITLE = 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท';

describe('connected factory profile patch', () => {
  it('updates factory coordinates, EIA, project name, front photos, and logo', () => {
    const source = {
      latitude: 13.7563,
      longitude: 100.5018,
      eia: 'มี EIA',
      eiaOther: null,
      projectName: 'โครงการปรับปรุงโรงงาน',
      measurementPoints: [
        {
          documentsAndImages: [
            { title: FACTORY_FRONT_PHOTO_TITLE, fileUrl: '/files/front-1.jpg' },
            { title: FACTORY_FRONT_PHOTO_TITLE, fileUrl: '/files/front-2.jpg' },
            { title: FACTORY_LOGO_TITLE, fileUrl: '/files/logo.png' },
            { title: 'เอกสารจุดตรวจวัด', fileUrl: '/files/point.pdf' },
          ],
        },
      ],
    };

    expect(buildConnectedFactoryProfilePatch(source as never)).toEqual({
      factory_latitude: 13.7563,
      factory_longitude: 100.5018,
      factory_eia_assessment: 'มี EIA',
      factory_eia_other: null,
      factory_has_eia: true,
      factory_project_name: 'โครงการปรับปรุงโรงงาน',
      factory_front_photos_json: JSON.stringify([
        { title: FACTORY_FRONT_PHOTO_TITLE, fileUrl: '/files/front-1.jpg' },
        { title: FACTORY_FRONT_PHOTO_TITLE, fileUrl: '/files/front-2.jpg' },
      ]),
      factory_logo_json: JSON.stringify({
        title: FACTORY_LOGO_TITLE,
        fileUrl: '/files/logo.png',
      }),
    });
    expect(buildEligibleFactoryProfilePatch(source as never)).toEqual({
      latitude: 13.7563,
      longitude: 100.5018,
      eia_assessment: 'มี EIA',
      eia_other: null,
      has_eia: true,
      project_name: 'โครงการปรับปรุงโรงงาน',
    });
  });

  it('keeps stored values when optional fields are null or only one coordinate is present', () => {
    const source = {
      latitude: 13.7563,
      longitude: null,
      eia: null,
      eiaOther: null,
      projectName: null,
      measurementPoints: [{ documentsAndImages: [{ title: 'เอกสารจุดตรวจวัด' }] }],
    };

    expect(buildConnectedFactoryProfilePatch(source as never)).toEqual({});
    expect(buildEligibleFactoryProfilePatch(source as never)).toEqual({});
  });

  it('stores an other environmental assessment without treating it as has EIA', () => {
    const source = {
      latitude: null,
      longitude: null,
      eia: 'อื่นๆ',
      eiaOther: 'รายงานเฉพาะโครงการ',
      projectName: null,
      measurementPoints: [],
    };

    expect(buildConnectedFactoryProfilePatch(source as never)).toEqual({
      factory_eia_assessment: 'อื่นๆ',
      factory_eia_other: 'รายงานเฉพาะโครงการ',
      factory_has_eia: false,
    });
    expect(buildEligibleFactoryProfilePatch(source as never)).toEqual({
      eia_assessment: 'อื่นๆ',
      eia_other: 'รายงานเฉพาะโครงการ',
      has_eia: false,
    });
  });
});
