// grid-core.js — FishBox ▸ GridBox shared engine.
// The one piece every grid-tile game reuses: a 2D Grid, a seedable RNG, and
// gravity/refill primitives. Game-specific rules (match-3 clearing, 2048
// merging, tetromino locking) live in each game; this is the substrate they
// all stand on. Pure ES module, no DOM — render layer is the game's job.

// --- seedable RNG (mulberry32) -------------------------------------------------
// Deterministic so a board can be replayed / tested. Seed from Date.now() for
// real play, or a fixed int for fuzz tests.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick an integer in [0, n) from an rng() function.
export function randInt(next, n) { return Math.floor(next() * n); }

// --- Grid ----------------------------------------------------------------------
// Row-major flat array of cells. A cell may be any value the game defines; the
// sentinel EMPTY marks a hole (used by gravity/refill). null is never a value.
export const EMPTY = null;

export class Grid {
  constructor(w, h, fill = EMPTY) {
    this.w = w; this.h = h;
    this.cells = new Array(w * h).fill(fill);
  }
  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && x < this.w && y >= 0 && y < this.h; }
  get(x, y) { return this.cells[this.idx(x, y)]; }
  set(x, y, v) { this.cells[this.idx(x, y)] = v; }
  swap(ax, ay, bx, by) {
    const a = this.idx(ax, ay), b = this.idx(bx, by);
    const t = this.cells[a]; this.cells[a] = this.cells[b]; this.cells[b] = t;
  }
  clone() {
    const g = new Grid(this.w, this.h);
    g.cells = this.cells.slice();
    return g;
  }
  forEach(fn) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) fn(this.get(x, y), x, y);
  }
}

// --- gravity + refill ----------------------------------------------------------
// collapseDown: every non-EMPTY cell falls to the lowest free slot in its
// column. Returns true if anything moved. Shared by match-3 (after clears) and
// any future "stuff falls" game.
export function collapseDown(grid) {
  let moved = false;
  for (let x = 0; x < grid.w; x++) {
    let write = grid.h - 1;
    for (let y = grid.h - 1; y >= 0; y--) {
      const v = grid.get(x, y);
      if (v !== EMPTY) {
        if (y !== write) { grid.set(x, write, v); grid.set(x, y, EMPTY); moved = true; }
        write--;
      }
    }
  }
  return moved;
}

// fillEmpty: fill every EMPTY cell using gen(x, y) -> value. Use with a random
// tile generator after collapseDown to top up the board.
export function fillEmpty(grid, gen) {
  grid.forEach((v, x, y) => { if (v === EMPTY) grid.set(x, y, gen(x, y)); });
}
