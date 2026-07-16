import { describe, expect, it } from '@jest/globals';
import {
  CONNECTION_REQUEST_STATUS,
  CONNECTION_REQUEST_STATUS_LABELS,
} from '../../src/modules/connection-requests/connection-requests.types';

describe('connection request status labels', () => {
  it('renames connection-stage labels without changing their status codes', () => {
    expect(CONNECTION_REQUEST_STATUS.WAITING_CONNECTION).toBe('WAITING_CONNECTION');
    expect(CONNECTION_REQUEST_STATUS_LABELS.WAITING_CONNECTION).toBe('รอโรงงานตั้งค่าอุปกรณ์');

    expect(CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED).toBe('CONNECTION_CONFIRMED');
    expect(CONNECTION_REQUEST_STATUS_LABELS.CONNECTION_CONFIRMED).toBe('รอเชื่อมต่อ');
  });
});
