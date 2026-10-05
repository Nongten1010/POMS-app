import { describe, expect, it } from '@jest/globals';
import {
  changeConnectionRequestStatusSchema,
  reviewConnectionRequestSchema,
} from '../../src/modules/connection-requests/connection-requests.validator';

describe('connection request rejection contract', () => {
  it('accepts rejection without a reason', () => {
    expect(changeConnectionRequestStatusSchema.parse({ action: 'REJECT' })).toMatchObject({
      action: 'REJECT',
      officerNote: null,
    });
  });
  it('accepts review rejection with an optional blank reason', () => {
    expect(
      reviewConnectionRequestSchema.parse({
        decision: 'REJECT',
        revisionReason: ' ',
        officerNote: null,
      }),
    ).toMatchObject({ decision: 'REJECT', revisionReason: null, officerNote: null });
  });
});
