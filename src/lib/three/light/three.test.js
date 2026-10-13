import { describe, expect, it } from 'vitest';
import { countAsNumber, fixClusteredCounts } from './three.js';

describe('a storage buffer’s count', () => {
  it('is made the buffer’s own count when three was handed an array for it', () => {
    const node = { bufferCount: new Int32Array(76800), value: { count: 19200 } };
    expect(countAsNumber(node).bufferCount).toBe(19200);
    // (a count that is a number already is three's own, and stays)
    expect(countAsNumber({ bufferCount: 6, value: { count: 99 } }).bufferCount).toBe(6);
    expect(countAsNumber({ bufferCount: new Float32Array(4) }).bufferCount).toBe(0);
    expect(countAsNumber(null)).toBe(null);
  });

  it('the clustered lights’ index buffer has a number for its count, on three’s own node', async () => {
    const { default: ClusteredLightsNode } = await import('three/addons/tsl/lighting/ClusteredLightsNode.js');
    fixClusteredCounts(ClusteredLightsNode);
    fixClusteredCounts(ClusteredLightsNode); // (once, however often it is asked)
    const node = new ClusteredLightsNode(8, 32, 4, 8);
    node.create(64, 64);
    const indexes = node._lightIndexes;
    expect(indexes.value.array).toBeInstanceOf(Int32Array);
    expect(typeof indexes.bufferCount).toBe('number');
    expect(indexes.bufferCount).toBe(indexes.value.count);
    // (what three's shader builder asks of it for every shader that reads it: cheap, and no text made of the array)
    expect(indexes.bufferCount > 0).toBe(true);
  });
});
