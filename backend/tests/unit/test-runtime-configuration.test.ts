import { describe, expect, it } from '@jest/globals';
import { logger } from '../../src/config/logger';

describe('test runtime configuration', () => {
  it('does not open rotating file transports inside Jest workers', () => {
    expect(logger.transports.map((transport) => transport.constructor.name)).toEqual(['Console']);
    expect(logger.transports[0]?.silent).toBe(true);
  });
});
