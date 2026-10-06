import { describe, expect, it } from 'vitest';
import { GRADE_AT, gpuGrade, gpuScore } from './gpuGrade';

// Renderer strings as the browsers give them (Chrome and Edge through
// ANGLE on Windows, macOS and Linux; Firefox's rounded ones; Safari's one).
const d3d = (name) => `ANGLE (NVIDIA, NVIDIA ${name} (0x00002B85) Direct3D11 vs_5_0 ps_5_0, D3D11)`;
const amd = (name) => `ANGLE (AMD, AMD ${name} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
const intel = (name) => `ANGLE (Intel, Intel(R) ${name} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
const metal = (chip) => `ANGLE (Apple, ANGLE Metal Renderer: Apple ${chip}, Unspecified Version)`;

describe('grading a graphics chip by its name', () => {
  it('puts the flagships and the strong cards at the top', () => {
    for (const name of ['GeForce RTX 5090', 'GeForce RTX 5080', 'GeForce RTX 4090', 'GeForce RTX 4080 SUPER', 'GeForce RTX 4070', 'GeForce RTX 3080 Ti', 'GeForce RTX 3070', 'GeForce RTX 2080 Ti', 'RTX A6000', 'RTX 6000 Ada Generation', 'TITAN RTX']) {
      expect(gpuGrade(d3d(name)), name).toBe('ultra');
    }
    for (const name of ['Radeon RX 7900 XTX', 'Radeon RX 6800 XT', 'Radeon RX 9070 XT']) expect(gpuGrade(amd(name)), name).toBe('ultra');
    for (const chip of ['M1 Max', 'M2 Ultra', 'M3 Max', 'M4 Max']) expect(gpuGrade(metal(chip)), chip).toBe('ultra');
    expect(gpuGrade('ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 4080/PCIe/SSE2, OpenGL 4.5.0)')).toBe('ultra');
  });

  it('keeps the ordinary graphics cards and the better built-in chips in the middle of the desktop range', () => {
    for (const name of ['GeForce RTX 3060', 'GeForce RTX 4060 Laptop GPU', 'GeForce RTX 2060', 'GeForce GTX 1080 Ti', 'GeForce GTX 1660 SUPER', 'GeForce GTX 1650', 'Quadro P2000']) {
      expect(gpuGrade(d3d(name)), name).toBe('high');
    }
    for (const name of ['Radeon RX 6600', 'Radeon RX 580 2048SP', 'Radeon RX 5700 XT', 'Radeon(TM) 780M']) expect(gpuGrade(amd(name)), name).toBe('high');
    for (const name of ['Arc(TM) A770 Graphics', 'Arc(TM) Graphics']) expect(gpuGrade(intel(name)), name).toBe('high');
    for (const chip of ['M1', 'M2 Pro', 'M3', 'M4 Pro']) expect(gpuGrade(metal(chip)), chip).toBe('high');
    expect(gpuGrade('ANGLE (Qualcomm, Qualcomm(R) Adreno(TM) X1-85 GPU Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('high');
  });

  it('marks the weak ones down', () => {
    for (const name of ['GeForce GTX 750 Ti', 'GeForce MX450', 'GeForce GT 1030']) expect(gpuGrade(d3d(name)), name).toBe('mid');
    for (const name of ['UHD Graphics 620', 'HD Graphics 4000', 'UHD Graphics 770', 'Iris(R) Xe Graphics']) expect(gpuGrade(intel(name)), name).toBe('mid');
    for (const name of ['Radeon(TM) Vega 8 Graphics', 'Radeon R7 200 Series']) expect(gpuGrade(amd(name)), name).toBe('mid');
  });

  it('says it does not know when the browser has rounded the name off', () => {
    expect(gpuGrade('NVIDIA GeForce GTX 980, or similar')).toBe(null);
    expect(gpuGrade('Radeon R9 200 Series, or similar')).toBe(null);
    expect(gpuGrade('Apple M1, or similar')).toBe(null);
    expect(gpuGrade('Apple GPU')).toBe(null);
    expect(gpuGrade('')).toBe(null);
    expect(gpuGrade(undefined)).toBe(null);
    expect(gpuGrade('ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(null);
  });

  it('leaves software WebGL to the device tier', () => {
    expect(gpuGrade('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)')).toBe(null);
    expect(gpuGrade('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(null);
    expect(gpuGrade('ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(null);
  });

  it('scores a laptop part below the desktop card of the same name', () => {
    expect(gpuScore(d3d('GeForce RTX 4070 Laptop GPU'))).toBeLessThan(gpuScore(d3d('GeForce RTX 4070')));
    expect(gpuScore(amd('Radeon RX 6800M'))).toBeLessThan(gpuScore(amd('Radeon RX 6800')));
  });

  it('orders the generations and the classes the way they really fall', () => {
    const s = (name) => gpuScore(d3d(name));
    expect(s('GeForce RTX 5090')).toBeGreaterThan(s('GeForce RTX 4090'));
    expect(s('GeForce RTX 4090')).toBeGreaterThan(s('GeForce RTX 4080'));
    expect(s('GeForce RTX 4080')).toBeGreaterThan(s('GeForce RTX 3080'));
    expect(s('GeForce RTX 3060 Ti')).toBeGreaterThan(s('GeForce RTX 3060'));
    expect(s('GeForce RTX 3060')).toBeGreaterThan(s('GeForce GTX 1060'));
    expect(s('GeForce GTX 1080')).toBeGreaterThan(s('GeForce GTX 1060'));
    // a generation the table has never heard of still lands above the last
    expect(s('GeForce RTX 6090')).toBeGreaterThan(s('GeForce RTX 5090'));
    expect(gpuScore(metal('M3 Max'))).toBeGreaterThan(gpuScore(metal('M3 Pro')));
    expect(gpuScore(metal('M3 Pro'))).toBeGreaterThan(gpuScore(metal('M3')));
  });

  it('draws the lines where GRADE_AT says', () => {
    expect(gpuScore(d3d('GeForce RTX 5090'))).toBeGreaterThanOrEqual(GRADE_AT.ultra);
    expect(gpuScore(d3d('GeForce RTX 3060'))).toBeLessThan(GRADE_AT.ultra);
    expect(gpuScore(d3d('GeForce RTX 3060'))).toBeGreaterThanOrEqual(GRADE_AT.high);
    expect(gpuScore(intel('UHD Graphics 620'))).toBeLessThan(GRADE_AT.high);
  });
});
