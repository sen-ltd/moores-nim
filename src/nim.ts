// Moore's Nim_k and Exact k-Nim: rules, closed forms, and exhaustive solvers.
//
// A position is a vector x of n pile sizes. A move picks a set S of nonempty
// piles and lowers every pile in S by a positive amount.
//   Moore's Nim  (Nim≤_{n,k}, Moore 1910):        1 ≤ |S| ≤ k
//   Exact k-Nim (Nim=_{n,k}, Boros et al. 2017):  |S| = k
// Whoever makes the last move wins. No dependencies.

export type Kind = 'moore' | 'exact';
export interface Game { kind: Kind; n: number; k: number }
export type Pos = readonly number[];

const binom2 = (a: number) => (a * (a - 1)) / 2; // C(a, 2)

// ------------------------------------------------------------ Moore's M(x)

/** Column sums of the binary digits of x, each reduced mod (k+1), lowest bit first. */
export function mooreDigits(x: Pos, k: number): number[] {
  const top = Math.max(0, ...x);
  const out: number[] = [];
  for (let j = 0; 2 ** j <= top; j++) {
    let c = 0;
    for (const v of x) c += Math.floor(v / 2 ** j) % 2;
    out.push(c % (k + 1));
  }
  return out;
}

/** M(x) = Σ_j y_j (k+1)^j. Moore: x is a P-position iff M(x) = 0. */
export function mooreM(x: Pos, k: number): number {
  return mooreDigits(x, k).reduce((acc, d, j) => acc + d * (k + 1) ** j, 0);
}

/**
 * A move of Nim≤_{n,k} to a position with M = 0, built column by column from
 * the top bit (Moore's proof). Returns null when M(x) = 0 already.
 * A pile becomes "touched" the first time one of its 1-bits is cleared; below
 * that bit its digits are free. At each column with residue a = (sum of the
 * untouched bits) mod (k+1): if a + t ≥ k+1 (t = touched so far) set k+1−a
 * touched bits to 1; otherwise clear a untouched 1-bits, touching a new piles.
 * Either way at most k piles get touched.
 */
export function mooreWinningMove(x: Pos, k: number): number[] | null {
  if (mooreM(x, k) === 0) return null;
  const n = x.length;
  const top = Math.max(...x);
  let J = 0;
  while (2 ** (J + 1) <= top) J++;
  const touched: boolean[] = new Array(n).fill(false);
  const bits: number[][] = x.map((v) => {
    const b: number[] = [];
    for (let j = 0; j <= J; j++) b.push(Math.floor(v / 2 ** j) % 2);
    return b;
  });
  for (let j = J; j >= 0; j--) {
    const untouchedOnes: number[] = [];
    const touchedIdx: number[] = [];
    for (let i = 0; i < n; i++) {
      if (touched[i]) touchedIdx.push(i);
      else if (bits[i][j]) untouchedOnes.push(i);
    }
    const a = untouchedOnes.length % (k + 1);
    for (const i of touchedIdx) bits[i][j] = 0;
    if (a === 0) continue;
    if (a + touchedIdx.length >= k + 1) {
      for (let q = 0; q < k + 1 - a; q++) bits[touchedIdx[q]][j] = 1;
    } else {
      for (let q = 0; q < a; q++) {
        const i = untouchedOnes[q];
        bits[i][j] = 0;
        touched[i] = true;
      }
    }
  }
  return bits.map((b) => b.reduce((acc, d, j) => acc + d * 2 ** j, 0));
}

// ------------------------------------------------------- the JM formula

/**
 * Jenkyns–Mayberry formula in the form of Boros–Gurvich–Kitrossky–Makino:
 *   U(m, y, h) = h                                      if m ≤ C(y+1, 2)   ("long")
 *              = C(y+1,2) + ((m − C(y+1,2) − 1) mod (y+1))  otherwise   ("short")
 */
export function jm(m: number, y: number, h: number): number {
  const c = binom2(y + 1);
  if (m <= c) return h;
  return c + ((m - c - 1) % (y + 1));
}

/** SG of Moore's Nim≤_{k+1,k} (Jenkyns–Mayberry 1980). Height h = Σx. */
export function sgMooreNminus1(x: Pos): number {
  const m = Math.min(...x);
  const h = x.reduce((a, b) => a + b, 0);
  return jm(m, h - x.length * m, h);
}

// ------------------------------------------------------- Tetris function

/** T_{n,k}(x) by its definition-free greedy: lower the k largest piles by 1 until fewer than k are nonempty. */
export function tetrisGreedy(x: Pos, k: number): number {
  const a = x.slice().sort((p, q) => q - p);
  let t = 0;
  while (a.length >= k && a[k - 1] > 0) {
    // lower the k largest by the largest amount that keeps the order, at least 1
    const next = k < a.length ? a[k] : 0;
    const step = Math.max(1, a[k - 1] - next);
    for (let i = 0; i < k; i++) a[i] -= step;
    t += step;
    a.sort((p, q) => q - p);
  }
  return t;
}

/** The paper's x̄: empty the n−k smallest piles onto the k largest, one token at a time, each onto the smallest (ties: largest index). */
export function barByTokens(x: Pos, k: number): number[] {
  const n = x.length;
  const a = x.slice().sort((p, q) => p - q);
  let s = 0;
  for (let i = 0; i < n - k; i++) { s += a[i]; a[i] = 0; }
  for (; s > 0; s--) {
    let best = n - k;
    for (let i = n - k; i < n; i++) if (a[i] <= a[best]) best = i;
    a[best]++;
  }
  return a;
}

/** x̄ in O(n) by the volume formula of the paper's Theorem 4 (1-based indices there). */
export function barFast(x: Pos, k: number): number[] {
  const n = x.length;
  const a = x.slice().sort((p, q) => p - q);
  const X = (i: number) => a[i - 1]; // 1-based
  let s = 0;
  for (let i = 1; i <= n - k; i++) s += X(i);
  const S: number[] = [0];
  for (let i = 1; i <= k - 1; i++) S.push(S[i - 1] + i * (X(n - k + i + 1) - X(n - k + i)));
  let l = 0;
  for (let i = 1; i <= k - 1; i++) if (S[i] <= s) l = i;
  const r = s - S[l];
  const alpha = Math.floor(r / (l + 1));
  const beta = r % (l + 1);
  const base = X(n - k + l + 1);
  const out: number[] = [];
  for (let i = 1; i <= n; i++) {
    if (i <= n - k) out.push(0);
    else if (i <= n - k + 1 + l - beta) out.push(base + alpha);
    else if (i <= n - k + 1 + l) out.push(base + alpha + 1);
    else out.push(X(i));
  }
  return out;
}

/** T_{n,k}(x) = x̄_{n−k+1}, in O(n log n) (O(n) after sorting). */
export function tetris(x: Pos, k: number): number {
  return barFast(x, k)[x.length - k];
}

/** T by the volume criterion: the unique g with kg ≤ Σ min(x_i, g) and Σ min(x_i, g+1) < k(g+1). */
export function tetrisVolume(x: Pos, k: number): number {
  const vol = (g: number) => x.reduce((acc, v) => acc + Math.min(v, g), 0);
  let lo = 0;
  let hi = Math.floor(x.reduce((a, b) => a + b, 0) / k); // T can exceed max x when n > k
  while (lo < hi) {
    const g = Math.ceil((lo + hi) / 2);
    if (k * g <= vol(g)) lo = g; else hi = g - 1;
  }
  return lo;
}

// ------------------------------------------------------- Exact k-Nim SG

/**
 * SG of Exact k-Nim when 2k ≥ n (Boros–Gurvich–Ho–Makino–Mursič):
 *   n < 2k:          G = T(x)
 *   n = 2k, k ≥ 2:   G = U(m, T(x − m), T(x))  (the JM formula with height T)
 * null when no closed form is known (n > 2k, or n = 2, k = 1 where G = x1 xor x2).
 */
export function sgExact(x: Pos, k: number): number | null {
  const n = x.length;
  if (n < 2 * k) return tetris(x, k);
  if (n === 2 * k && k >= 2) {
    const m = Math.min(...x);
    return jm(m, tetris(x.map((v) => v - m), k), tetris(x, k));
  }
  if (k === 1) return x.reduce((a, b) => a ^ b, 0);
  return null;
}

/** The theorem-2 formula exactly as printed (u, m, y, z, v), kept separate so the tests can compare the two transcriptions. */
export function sgExactPrinted(x: Pos, k: number): number {
  const m = Math.min(...x);
  const u = tetris(x, k);
  const y = tetris(x.map((v) => v - m), k);
  const z = 1 + binom2(y + 1);
  const v = z - 1 + (((m - z) % (y + 1)) + (y + 1)) % (y + 1);
  return m < z ? u : v;
}

// ------------------------------------------------------- moves

export function sizeOk(g: Game, size: number): boolean {
  return g.kind === 'moore' ? size >= 1 && size <= g.k : size === g.k;
}

export function isLegal(g: Game, from: Pos, to: Pos): boolean {
  if (from.length !== to.length) return false;
  let changed = 0;
  for (let i = 0; i < from.length; i++) {
    if (to[i] > from[i] || to[i] < 0 || !Number.isInteger(to[i])) return false;
    if (to[i] < from[i]) changed++;
  }
  return sizeOk(g, changed);
}

/** Calls f on every successor; stop early by returning true. */
export function forEachMove(g: Game, x: Pos, f: (y: number[]) => boolean | void): boolean {
  const nonEmpty = x.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
  const y = x.slice();
  const pick: number[] = [];
  const rec = (start: number): boolean => {
    if (pick.length > 0 && sizeOk(g, pick.length)) {
      if (lower(0)) return true;
    }
    if (pick.length >= g.k) return false;
    for (let q = start; q < nonEmpty.length; q++) {
      pick.push(nonEmpty[q]);
      if (rec(q + 1)) return true;
      pick.pop();
    }
    return false;
  };
  const lower = (j: number): boolean => {
    if (j === pick.length) return f(y.slice()) === true;
    const i = pick[j];
    for (let v = 0; v < x[i]; v++) {
      y[i] = v;
      if (lower(j + 1)) { y[i] = x[i]; return true; }
    }
    y[i] = x[i];
    return false;
  };
  return rec(0);
}

// ------------------------------------------------------- exhaustive solver

export interface Grid { n: number; B: number; R: number; values: Uint16Array }

/**
 * SG (mode 'sg') or height (mode 'height') of every position with piles ≤ B,
 * for the game whose legal pile sets are given by `allowed(mask)`.
 * Positions are indexed in mixed radix R = B+1; every move lowers the index,
 * so one forward sweep suffices.
 */
export function solveGrid(
  n: number, B: number, allowed: (mask: number) => boolean, mode: 'sg' | 'height' = 'sg',
): Grid {
  const R = B + 1;
  const total = R ** n;
  const pw: number[] = [];
  for (let i = 0; i < n; i++) pw.push(R ** i);
  const masks: number[][] = [];
  for (let m = 1; m < 1 << n; m++) if (allowed(m)) {
    const idx: number[] = [];
    for (let i = 0; i < n; i++) if (m & (1 << i)) idx.push(i);
    masks.push(idx);
  }
  const val = new Uint16Array(total);
  const seen = new Int32Array(n * B + 3);
  const d = new Array<number>(n).fill(0);
  const cur = new Array<number>(n).fill(0);
  for (let idx = 0; idx < total; idx++) {
    let t = idx;
    for (let i = 0; i < n; i++) { d[i] = t % R; t = (t - d[i]) / R; }
    let best = 0;
    for (const S of masks) {
      let ok = true;
      for (const i of S) if (d[i] === 0) { ok = false; break; }
      if (!ok) continue;
      const L = S.length;
      for (let j = 0; j < L; j++) cur[j] = 0;
      for (;;) {
        let succ = idx;
        for (let j = 0; j < L; j++) succ -= (d[S[j]] - cur[j]) * pw[S[j]];
        const v = val[succ];
        if (mode === 'sg') seen[v] = idx + 1;
        else if (v + 1 > best) best = v + 1;
        let j = 0;
        while (j < L) {
          cur[j]++;
          if (cur[j] < d[S[j]]) break;
          cur[j] = 0;
          j++;
        }
        if (j === L) break;
      }
    }
    if (mode === 'sg') {
      let g = 0;
      while (seen[g] === idx + 1) g++;
      val[idx] = g;
    } else val[idx] = best;
  }
  return { n, B, R, values: val };
}

export const popcount = (m: number) => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };
export const mooreMasks = (k: number) => (m: number) => popcount(m) <= k;
export const exactMasks = (k: number) => (m: number) => popcount(m) === k;

export function decode(grid: Grid, idx: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < grid.n; i++) { out.push(idx % grid.R); idx = Math.floor(idx / grid.R); }
  return out;
}

export function encode(grid: Grid, x: Pos): number {
  let idx = 0;
  for (let i = grid.n - 1; i >= 0; i--) idx = idx * grid.R + x[i];
  return idx;
}

/** SG by memoised search on sorted positions (SG is symmetric), for small positions without a closed form. */
export function sgSearch(g: Game, x: Pos, memo = new Map<string, number>()): number {
  const key = x.slice().sort((a, b) => a - b).join(',');
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const seen = new Set<number>();
  forEachMove(g, x, (y) => { seen.add(sgSearch(g, y, memo)); });
  let v = 0;
  while (seen.has(v)) v++;
  memo.set(key, v);
  return v;
}

/** SG by the best available closed form, or null. */
export function sgClosed(g: Game, x: Pos): number | null {
  if (g.kind === 'exact') return sgExact(x, g.k);
  if (g.k === 1) return x.reduce((a, b) => a ^ b, 0);
  // k ≥ n: any y < x is reachable, so the SG value is the height Σx.
  if (g.k >= x.length) return x.reduce((a, b) => a + b, 0);
  if (g.k === x.length - 1) return sgMooreNminus1(x);
  return null;
}

/** Is x a P-position? Closed forms first, then search. */
export function isP(g: Game, x: Pos, memo?: Map<string, number>): boolean {
  if (g.kind === 'moore') return mooreM(x, g.k) === 0;
  const c = sgExact(x, g.k);
  if (c !== null) return c === 0;
  return sgSearch(g, x, memo) === 0;
}

/** A winning move (to a P-position), or null if x is itself a P-position. */
export function winningMove(g: Game, x: Pos, memo?: Map<string, number>): number[] | null {
  if (g.kind === 'moore') return mooreWinningMove(x, g.k);
  let found: number[] | null = null;
  forEachMove(g, x, (y) => {
    if (isP(g, y, memo)) { found = y; return true; }
  });
  return found;
}
