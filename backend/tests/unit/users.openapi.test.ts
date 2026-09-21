import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

const paths = pomsOpenApiDocument.paths as Record<
  string,
  Record<
    string,
    {
      responses: Record<string, { description: string }>;
      description: string;
      security: unknown;
    }
  >
>;

describe('managed user identity conflict contract', () => {
  it.each([
    ['/users/local-accounts', 'post'],
    ['/users', 'post'],
    ['/users/{id}', 'patch'],
  ] as const)('documents 409 and a safe error for %s %s', (path, method) => {
    const operation = paths[path][method];
    expect(operation.responses['409']).toMatchObject({
      content: {
        'application/json': {
          example: {
            success: false,
            error: { code: 'CONFLICT', message: 'External ID already exists' },
          },
        },
      },
    });
    expect(operation.responses['409'].description).toContain('inactive/suspended');
    expect(operation.responses['409'].description).toContain(
      'provider อื่นยังสงวน account key รวมบัญชีที่ soft-delete แล้ว',
    );
    expect(operation.description).toContain(
      'ใช้ชื่อเดิมซ้ำได้หลังบัญชีเดิมถูก soft-delete แล้วเท่านั้น',
    );
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
  });

  it('documents a new local account and credentials when reusing a deleted username', () => {
    const created = paths['/users/local-accounts'].post.responses['201'];

    expect(created.description).toContain('user ID ใหม่');
    expect(created.description).toContain('password, profile, role และ permissions จากคำขอใหม่');
    expect(created.description).toContain(
      'ไม่คืนชีพหรือรับรหัสผ่าน สิทธิ์ หรือประวัติจากบัญชีเดิม',
    );
  });

  it('keeps the current user ID when PATCH reuses a deleted local username', () => {
    const operation = paths['/users/{id}'].patch;

    expect(operation.responses['200']).toBeDefined();
    expect(operation.description).toContain('คง user ID ของบัญชีที่กำลังแก้ไข');
    expect(operation.description).toContain('ไม่รับสิทธิ์/ประวัติจากบัญชีที่ลบแล้ว');
    expect(operation.description).toContain('provider อื่นเปลี่ยน identity ไม่ได้');
  });

  it('documents that only soft deletion releases a local username', () => {
    const operation = paths['/users/{id}'].delete;

    expect(operation.responses['204']).toBeDefined();
    expect(operation.description).toContain('เก็บข้อมูลและประวัติเดิมไว้');
    expect(operation.description).toContain('การตั้ง inactive/suspended อย่างเดียวไม่คืนชื่อ');
    expect(operation.description).toContain('provider อื่นยังสงวน account key หลังลบ');
  });
});
