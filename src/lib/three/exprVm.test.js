import { describe, expect, it } from 'vitest';
import deformation from '../../data/bf2017/rig/deformation.json';
import rebeltrooper from '../../data/bf2017/rig/rebeltrooper.json';
import snowtrooper from '../../data/bf2017/rig/snowtrooper.json';
import golden from './fixtures/exprVm.golden.json';
import { FUNCS, compose, createMachine, decompose, e2q, loadKernel, matinv, matmul, qmul } from './exprVm.js';

// (the golden: bf2-re's tools/expr_eval.py on the Walrus bind pose and two
// bent poses, the three kernels run in this order on one pose; rig-export.py --golden)
const KERNELS = [deformation, rebeltrooper, snowtrooper].map(loadKernel);

const poseOf = (values) => {
  const v = new Map(Object.entries(values).map(([k, x]) => [k, x.slice()]));
  return { v, get: (dof) => (dof != null && v.has(dof) ? v.get(dof) : null), set: (dof, x) => v.set(dof, x.slice()) };
};
// (a quaternion and its negation are one turn)
const close = (a, b, dof) => {
  const tol = 2e-4;
  if (dof.endsWith('.q')) {
    const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
    return d > 1 - tol;
  }
  return a.every((x, i) => Math.abs(x - b[i]) < tol);
};

describe('the expression VM', () => {
  it('holds every function the three kernels call but the one it leaves', () => {
    expect(KERNELS[0].unported).toEqual([]);
    expect(KERNELS[1].unported).toEqual([]);
    expect(KERNELS[2].unported).toEqual(['VerletDICEPlanarCollision']);
  });

  for (const c of golden.cases)
    it(`writes what the reference evaluator writes on the ${c.name} pose`, () => {
      const pose = poseOf(c.pose);
      const writes = {};
      for (const k of KERNELS) {
        const m = createMachine(k, { pose }).run();
        for (const [dof, val] of m.writes) writes[dof] = val;
      }
      // (the two the unported VerletDICEPlanarCollision feeds: bones no site body has)
      const want = Object.keys(c.writes).filter((dof) => !/^Hips_Phys_Ext_Base0[34]\./.test(dof));
      expect(want.length).toBeGreaterThan(40);
      const bad = want.filter((dof) => !writes[dof] || !close(writes[dof], c.writes[dof], dof));
      expect(bad).toEqual([]);
    });

  it('keeps the evaluator’s matrix conventions: rows, row vectors, compose then decompose round-trips', () => {
    const q = e2q([0.3, -0.2, 0.5]);
    const m = compose([1, 2, 3], q, [4, 5, 6]);
    const [s, q2, t] = decompose(m);
    expect(s.map((x) => +x.toFixed(5))).toEqual([1, 2, 3]);
    expect(t).toEqual([4, 5, 6]);
    expect(Math.abs(q.reduce((a, x, i) => a + x * q2[i], 0))).toBeCloseTo(1, 6);
    const id = matmul(m, matinv(m));
    expect(id.map((x) => Math.round(x * 1e6) / 1e6 + 0)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    // (Hamilton: i·j = k)
    expect(qmul([1, 0, 0, 0], [0, 1, 0, 0])).toEqual([0, 0, 1, 0]);
    expect(typeof FUNCS.MotionFilterPositionToLocalSpace).toBe('function');
  });

  it('reads a game state at its asset’s default unless told another', () => {
    const k = KERNELS[1];
    const m = createMachine(k, { pose: poseOf(golden.cases[0].pose) });
    m.load();
    const w = k.gamestates.findIndex((g) => g.name === '3P.LOD.Deform.Expression.Weight.Float');
    expect(m.gamestates.get(0x1000 + w)).toBe(1);
    m.setState('3P.LOD.Deform.Expression.Weight.Float', 0.25);
    expect(m.gamestates.get(0x1000 + w)).toBe(0.25);
  });
});
