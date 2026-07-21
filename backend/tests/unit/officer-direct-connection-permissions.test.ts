import { describe, expect, it } from '@jest/globals';
import { PERMISSIONS } from '../../src/db/seeds/05_permissions';
import { groupPermissions } from '../../src/modules/auth/permissions';

const DIRECT_CONNECTION_PERMISSION = 'cems_wpms_requests:direct_connect';

describe('officer direct-connection permission', () => {
  it('is provisioned as a dedicated backend permission', () => {
    expect(PERMISSIONS).toContainEqual({
      code: DIRECT_CONNECTION_PERMISSION,
      resource: 'cems_wpms_requests',
      action: 'direct_connect',
      description: 'เพิ่มจุดตรวจวัดและเชื่อมต่อทันทีโดยเจ้าหน้าที่',
    });
  });

  it('is exposed through the connection permission group', () => {
    expect(
      groupPermissions({
        [DIRECT_CONNECTION_PERMISSION]: 'ALL',
      }),
    ).toEqual({
      connection: {
        data: 'ALL',
        direct_connect: true,
      },
    });
  });
});
