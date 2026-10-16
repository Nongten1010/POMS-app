import type { Knex } from 'knex';
import { describe, expect, it, jest } from '@jest/globals';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0140_expand_connection_request_revision_notes';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';
import {
  changeConnectionRequestStatusSchema,
  reviewConnectionRequestSchema,
} from '../../src/modules/connection-requests/connection-requests.validator';

const revisionCases = [
  { schema: reviewConnectionRequestSchema, payload: { decision: 'REQUEST_REVISION' } },
  { schema: changeConnectionRequestStatusSchema, payload: { action: 'REQUEST_REVISION' } },
  {
    schema: changeConnectionRequestStatusSchema,
    payload: { action: 'RETURN_TO_WAITING_CONNECTION' },
  },
];

type RequestBranch = {
  properties: Record<string, { enum?: string[] }>;
};
type Operation = {
  requestBody: { content: { 'application/json': { schema: { oneOf: RequestBranch[] } } } };
};

describe('connection request revision note capacity', () => {
  it.each(revisionCases)('accepts 2000 units after trim for $payload', ({ schema, payload }) => {
    const note = 'ก้\n '.repeat(500).trimEnd() + 'กก';
    expect(note.length).toBe(2000);
    const result = schema.parse({
      ...payload,
      revisionReason: `  ${note}  `,
      officerNote: `\n${note}\n`,
    });
    expect(result).toMatchObject({ revisionReason: note, officerNote: note });
  });

  it.each(revisionCases)(
    'rejects overflow or blank reasons for $payload',
    ({ schema, payload }) => {
      for (const field of ['revisionReason', 'officerNote']) {
        const result = schema.safeParse({
          ...payload,
          revisionReason: 'กรุณาแก้ไข',
          [field]: 'ก'.repeat(2001),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ path: [field] })]),
          );
        }
      }
      expect(schema.safeParse({ ...payload, revisionReason: ' \n ' }).success).toBe(false);
      expect(schema.parse({ ...payload, revisionReason: 'แก้ไข', officerNote: ' ' })).toMatchObject(
        {
          officerNote: null,
        },
      );
    },
  );

  it('publishes 2000-unit requests while preserving historical response capacity', () => {
    const paths = pomsOpenApiDocument.paths as Record<string, { post: Operation }>;
    const schemas = [
      paths['/cems-wpms-requests/{id}/review'].post,
      paths['/cems-wpms-requests/{id}/status'].post,
    ];
    for (const operation of schemas) {
      const branches = operation.requestBody.content['application/json'].schema.oneOf;
      const revisionBranches = branches.filter((branch) =>
        Object.values(branch.properties).some((field) =>
          field.enum?.some((value) =>
            ['REQUEST_REVISION', 'RETURN_TO_WAITING_CONNECTION'].includes(value),
          ),
        ),
      );
      expect(revisionBranches.length).toBe(operation === schemas[0] ? 1 : 2);
      for (const branch of revisionBranches) {
        expect(branch.properties).toMatchObject({
          revisionReason: { minLength: 1, maxLength: 2000 },
          officerNote: { nullable: true, maxLength: 2000 },
        });
      }
    }
    const components = pomsOpenApiDocument.components as { schemas: Record<string, unknown> };
    expect(components.schemas.ConnectionRequestResponse).toMatchObject({
      properties: {
        data: {
          properties: {
            revisionReason: { maxLength: 5000 },
            officerNote: { maxLength: 5000 },
            statusHistory: { items: { properties: { note: { maxLength: 10001 } } } },
          },
        },
      },
    });
  });

  it('expands request and combined history storage atomically', async () => {
    const raw = jest.fn<(sql: string) => Promise<unknown>>(async () => undefined);
    await up({ schema: { raw } } as unknown as Knex);
    const sql = raw.mock.calls.map(([statement]) => statement).join('\n');
    for (const column of ['revision_reason', 'officer_note', 'note']) {
      expect(sql).toContain(`ALTER COLUMN ${column} NVARCHAR(MAX) NULL`);
    }
    expect(config.transaction).toBe(true);
  });

  it('checks all columns before rollback and refuses to truncate long notes', async () => {
    const raw = jest.fn<(sql: string) => Promise<unknown>>(async () => undefined);
    await down({ schema: { raw } } as unknown as Knex);
    const guard = raw.mock.calls[0][0];
    expect(guard).toContain('DATALENGTH(revision_reason) > 2000');
    expect(guard).toContain('DATALENGTH(officer_note) > 2000');
    expect(guard).toContain('DATALENGTH(note) > 4002');
    expect(guard).toContain('THROW');
    expect(guard).not.toContain('ALTER COLUMN');
    expect(raw.mock.calls[1][0]).toContain('ALTER COLUMN note NVARCHAR(2001) NULL');

    raw.mockReset().mockRejectedValue(new Error('Long notes exist'));
    await expect(down({ schema: { raw } } as unknown as Knex)).rejects.toThrow('Long notes exist');
    expect(raw).toHaveBeenCalledTimes(1);
  });
});
