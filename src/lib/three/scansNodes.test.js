import { describe, expect, it } from 'vitest';
import * as glsl from './scans';
import * as nodes from './scansNodes';

describe('scansNodes, the twin of scans', () => {
  it('the same scans and roles', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(nodes.SCANS).toBe(glsl.SCANS);
    for (const role of ['sand', 'snow', 'nothing']) expect(nodes.scanOf(role)).toBe(glsl.scanOf(role));
  });
});
