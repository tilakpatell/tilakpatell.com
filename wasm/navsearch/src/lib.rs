//! The navgrid's A*, a port of `searchJs` in src/lib/battlefront/navSearch.js
//! (lane X2: docs/stack/webassembly.md). It must give the same cells as the
//! JavaScript for the same grid, so every step is the JavaScript's: the same
//! binary heap and its tie order, g and f stored as f32 (the JavaScript's
//! Float32Arrays) and worked in f64 (its numbers), the same neighbour order.
//! The grid is fixed once built (`walk` and `solid` folded into `open`); the
//! cells a search must avoid are stamped per search, as the JavaScript's
//! Set is asked.

use wasm_bindgen::prelude::*;

const SQRT2: f64 = std::f64::consts::SQRT_2;

#[wasm_bindgen]
pub struct Grid {
    cols: i32,
    rows: i32,
    cell: f64,
    open: Vec<u8>,
    g: Vec<f32>,
    f: Vec<f32>,
    came: Vec<i32>,
    seen: Vec<u32>,
    shut: Vec<u32>,
    avoid: Vec<u32>,
    gen: u32,
    heap: Vec<i32>,
}

#[wasm_bindgen]
impl Grid {
    /// `open`: one byte a cell, 1 where the JavaScript's `walk[i] === 1 && !solid[i]`.
    #[wasm_bindgen(constructor)]
    pub fn new(cols: i32, rows: i32, cell: f64, open: &[u8]) -> Grid {
        let n = (cols.max(0) * rows.max(0)) as usize;
        let mut o = vec![0u8; n];
        let k = open.len().min(n);
        o[..k].copy_from_slice(&open[..k]);
        Grid { cols, rows, cell, open: o, g: vec![0.0; n], f: vec![0.0; n], came: vec![0; n], seen: vec![0; n], shut: vec![0; n], avoid: vec![0; n], gen: 0, heap: Vec::with_capacity(1024) }
    }

    /// The cells from `s` to `goal`, or an empty list for none (no way, or
    /// more than `max` cells expanded). `blocked`: cells to treat as shut.
    pub fn search(&mut self, s: i32, goal: i32, blocked: &[i32], max: u32) -> Vec<i32> {
        let n = self.open.len() as i32;
        if s < 0 || goal < 0 || s >= n || goal >= n {
            return Vec::new();
        }
        self.gen = self.gen.wrapping_add(1);
        if self.gen == 0 {
            // (the stamps wrapped: start them again)
            self.seen.fill(0);
            self.shut.fill(0);
            self.avoid.fill(0);
            self.gen = 1;
        }
        let gen = self.gen;
        for &b in blocked {
            if b >= 0 && b < n {
                self.avoid[b as usize] = gen;
            }
        }
        let cols = self.cols;
        let rows = self.rows;
        let cell = self.cell;
        let gc = goal % cols;
        let gr = goal / cols;
        let h = |i: i32| -> f64 {
            let dx = ((i % cols) - gc).abs() as f64;
            let dz = ((i / cols) - gr).abs() as f64;
            (dx.max(dz) + (SQRT2 - 1.0) * dx.min(dz)) * cell
        };
        self.heap.clear();
        let su = s as usize;
        self.g[su] = 0.0;
        self.f[su] = h(s) as f32;
        self.came[su] = -1;
        self.seen[su] = gen;
        self.push(s);
        let mut expanded: u32 = 0;
        let mut found = false;
        while !self.heap.is_empty() {
            let cur = self.pop();
            let cu = cur as usize;
            if self.shut[cu] == gen {
                continue;
            }
            self.shut[cu] = gen;
            if cur == goal {
                found = true;
                break;
            }
            expanded += 1;
            if expanded > max {
                return Vec::new();
            }
            let c = cur % cols;
            let r = cur / cols;
            for dr in -1i32..=1 {
                for dc in -1i32..=1 {
                    if dr == 0 && dc == 0 {
                        continue;
                    }
                    let cc = c + dc;
                    let rr = r + dr;
                    if cc < 0 || rr < 0 || cc >= cols || rr >= rows {
                        continue;
                    }
                    let ni = rr * cols + cc;
                    let nu = ni as usize;
                    if !self.is_open(ni, gen) || self.shut[nu] == gen {
                        continue;
                    }
                    // no corner cutting: a diagonal needs both sides open
                    if dr != 0 && dc != 0 && (!self.is_open(r * cols + cc, gen) || !self.is_open(rr * cols + c, gen)) {
                        continue;
                    }
                    let ng = self.g[cu] as f64 + if dr != 0 && dc != 0 { cell * SQRT2 } else { cell };
                    if self.seen[nu] == gen && ng >= self.g[nu] as f64 {
                        continue;
                    }
                    self.seen[nu] = gen;
                    self.g[nu] = ng as f32;
                    self.f[nu] = (ng + h(ni)) as f32;
                    self.came[nu] = cur;
                    self.push(ni);
                }
            }
        }
        if !found {
            return Vec::new();
        }
        let mut cells = Vec::new();
        let mut i = goal;
        while i != -1 {
            cells.push(i);
            i = self.came[i as usize];
        }
        cells.reverse();
        cells
    }
}

impl Grid {
    #[inline]
    fn is_open(&self, i: i32, gen: u32) -> bool {
        let u = i as usize;
        self.open[u] == 1 && self.avoid[u] != gen
    }

    // the JavaScript heap's push and pop, step for step (its ties broken the same way)
    #[inline]
    fn push(&mut self, i: i32) {
        self.heap.push(i);
        let mut k = self.heap.len() - 1;
        while k > 0 {
            let p = (k - 1) >> 1;
            if self.f[self.heap[p] as usize] <= self.f[self.heap[k] as usize] {
                break;
            }
            self.heap.swap(p, k);
            k = p;
        }
    }

    #[inline]
    fn pop(&mut self) -> i32 {
        let top = self.heap[0];
        let last = self.heap.pop().unwrap();
        let len = self.heap.len();
        if len > 0 {
            self.heap[0] = last;
            let mut k = 0;
            loop {
                let l = 2 * k + 1;
                let r = l + 1;
                let mut m = k;
                if l < len && self.f[self.heap[l] as usize] < self.f[self.heap[m] as usize] {
                    m = l;
                }
                if r < len && self.f[self.heap[r] as usize] < self.f[self.heap[m] as usize] {
                    m = r;
                }
                if m == k {
                    break;
                }
                self.heap.swap(m, k);
                k = m;
            }
        }
        top
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn grid(cols: i32, rows: i32, walls: &[(i32, i32)]) -> Grid {
        let mut open = vec![1u8; (cols * rows) as usize];
        for &(c, r) in walls {
            open[(r * cols + c) as usize] = 0;
        }
        Grid::new(cols, rows, 2.0, &open)
    }

    #[test]
    fn a_straight_way() {
        let mut g = grid(5, 1, &[]);
        assert_eq!(g.search(0, 4, &[], 1000), vec![0, 1, 2, 3, 4]);
    }

    #[test]
    fn round_a_wall_without_cutting_its_corner() {
        // a wall down column 1 but for its last row
        let mut g = grid(3, 3, &[(1, 0), (1, 1)]);
        let p = g.search(0, 2, &[], 1000);
        assert_eq!(p.first(), Some(&0));
        assert_eq!(p.last(), Some(&2));
        assert!(p.contains(&7), "through the gap: {:?}", p);
    }

    #[test]
    fn none_when_shut_in_or_over_the_budget() {
        let mut g = grid(3, 1, &[(1, 0)]);
        assert!(g.search(0, 2, &[], 1000).is_empty());
        let mut h = grid(50, 1, &[]);
        assert!(h.search(0, 49, &[], 10).is_empty());
    }

    #[test]
    fn blocked_cells_are_shut_for_that_search_only() {
        let mut g = grid(3, 1, &[]);
        assert!(g.search(0, 2, &[1], 1000).is_empty());
        assert_eq!(g.search(0, 2, &[], 1000), vec![0, 1, 2]);
    }

    #[test]
    fn out_of_range_is_none() {
        let mut g = grid(2, 2, &[]);
        assert!(g.search(-1, 3, &[], 10).is_empty());
        assert!(g.search(0, 4, &[], 10).is_empty());
    }
}
