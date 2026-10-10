import { describe, expect, it } from 'vitest';
import { fileFor } from './bf2-dev.mjs';

describe('the /bf2/ dev route', () => {
  it('maps a path under the web root and refuses one that climbs out', () => {
    expect(fileFor('/x/web', '/bf2/maps/index.json?v=1')).toBe('/x/web/maps/index.json');
    expect(fileFor('/x/web', '/bf2/../secret')).toBeNull();
    expect(fileFor('/x/web', '/bf2/%2e%2e/secret')).toBeNull();
  });
});
