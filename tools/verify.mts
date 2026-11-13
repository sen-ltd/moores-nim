// Recompute every checkable claim of
//   [BGHMM] E. Boros, V. Gurvich, N. B. Ho, K. Makino, P. Mursič,
//           "On the Sprague-Grundy function of Exact k-Nim", arXiv:1508.04484 (Discrete Appl. Math. 2018)
//   [BGKM]  E. Boros, V. Gurvich, L. Kitrossky, K. Makino, "On the Sprague-Grundy function of compound games",
//           arXiv:1903.08138
// by exhaustive search over every position with piles ≤ B. Writes runs/verify.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  barByTokens, barFast, decode, encode, exactMasks, jm, mooreM, mooreMasks, mooreWinningMove,
  popcount, sgExact, sgExactPrinted, sgMooreNminus1, solveGrid, tetris, tetrisGreedy, tetrisVolume,
  isLegal, type Grid,
} from '../src/nim.ts';

const t0 = Date.now();
const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);

interface Claim { id: string; source: string; claim: string; ok: boolean; result: string }
const claims: Claim[] = [];
const add = (id: string, source: string, claim: string, ok: boolean, result: string) => {
  claims.push({ id, source, claim, ok, result });
  log(`${ok ? 'OK ' : 'XX '} ${id}: ${result}`);
};

const sum = (x: number[]) => x.reduce((a, b) => a + b, 0);
const at = (g: Grid, x: number[]) => g.values[encode(g, x)];
const fmt = (x: number) => x.toLocaleString('en');

// ------------------------------------------------------------ Moore's Nim
const mooreCfg: [number, number, number][] = [
  [2, 1, 63], [3, 1, 31], [3, 2, 40], [4, 1, 12], [4, 2, 12], [4, 3, 12], [4, 4, 8],
  [5, 2, 6], [5, 3, 6], [5, 4, 6], [6, 2, 4], [6, 3, 4], [6, 4, 4], [6, 5, 4],
];
const mooreRows: Record<string, unknown>[] = [];
let mooreTotal = 0, pBad = 0, oneBad = 0, bergeNe = 0, eqHigh = 0, wmBad = 0, wmTried = 0;
let eqHighExample: number[] | null = null;
let eqHighK = 0, eqHighG = 0;
let jmBad = 0, jmTried = 0, allBad = 0, xorBad = 0, jmK1Bad = 0, jmK1Tried = 0;
const jmOther: Record<string, unknown>[] = [];
const grids: Record<string, Grid> = {};
for (const [n, k, B] of mooreCfg) {
  const g = solveGrid(n, B, mooreMasks(k));
  grids[`moore-${n}-${k}`] = g;
  let rowNe = 0, rowEqHigh = 0, rowJmBad = 0, rowP = 0, maxG = 0;
  for (let idx = 0; idx < g.values.length; idx++) {
    const x = decode(g, idx);
    const G = g.values[idx];
    const M = mooreM(x, k);
    mooreTotal++;
    if (G > maxG) maxG = G;
    if ((G === 0) !== (M === 0)) pBad++;
    if ((G === 1) !== (M === 1)) oneBad++;
    if (G === 0) rowP++;
    if (G !== M) { rowNe++; bergeNe++; }
    if (G === M && G >= 2 && k >= 2) {
      rowEqHigh++; eqHigh++;
      if (!eqHighExample || sum(x) < sum(eqHighExample)) { eqHighExample = x; eqHighK = k; eqHighG = G; }
    }
    if (k === 1 && G !== x.reduce((a, b) => a ^ b, 0)) xorBad++;
    if (k >= n && G !== sum(x)) allBad++;
    const U = sgMooreNminus1(x);
    if (k === n - 1 && k >= 2) { jmTried++; if (U !== G) jmBad++; } else if (k === n - 1) { jmK1Tried++; if (U !== G) jmK1Bad++; } else if (U !== G) rowJmBad++;
    if (M !== 0 && (idx % 7 === 0 || n <= 3)) {
      wmTried++;
      const y = mooreWinningMove(x, k);
      if (!y || !isLegal({ kind: 'moore', n, k }, x, y) || mooreM(y, k) !== 0) wmBad++;
    }
  }
  const row = { n, k, B, positions: g.values.length, P: rowP, maxG, gNeM: rowNe, gEqMge2: rowEqHigh, jmFormulaFails: k === n - 1 ? 0 : rowJmBad };
  mooreRows.push(row);
  if (k !== n - 1 && k !== n) jmOther.push(row);
  log(`moore n=${n} k=${k} B=${B}: ${fmt(g.values.length)} positions, ${fmt(rowP)} P, G≠M ${fmt(rowNe)}, G=M≥2 ${fmt(rowEqHigh)}`);
}

add('moore-example', 'BGHMM §1', 'n = 3, k = 2, x = (2,3,6): M(x) = 10', mooreM([2, 3, 6], 2) === 10, `M(2,3,6) = ${mooreM([2, 3, 6], 2)}`);
add('moore-P', 'Moore 1910 (BGHMM Theorem 3, m = 0)', 'x is a P-position of Nim≤_{n,k} iff M(x) = 0',
  pBad === 0, `${fmt(mooreTotal)} positions in ${mooreCfg.length} games (n ≤ 6): ${pBad} exceptions`);
add('moore-1', 'Jenkyns–Mayberry 1980 (BGHMM Theorem 3, m = 1)', 'G(x) = 1 iff M(x) = 1',
  oneBad === 0, `${oneBad} exceptions in the same ${fmt(mooreTotal)} positions`);
add('moore-winning-move', "Moore's proof", 'from every M(x) ≠ 0 there is a move to M = 0 lowering at most k piles (column-by-column construction)',
  wmBad === 0, `${fmt(wmTried)} positions tried, ${wmBad} failures`);
add('berge', 'BGHMM §1 on Berge 1962 (Thm 3, p. 55)', "Berge's claim G(x) = M(x) is an overstatement",
  bergeNe > 0, `G ≠ M in ${fmt(bergeNe)} of ${fmt(mooreTotal)} positions; for k ≥ 2 it is the rule, not the exception (n = 3, k = 2: G = M at only ${fmt(68921 - (mooreRows.find((r) => r.n === 3 && r.k === 2)!.gNeM as number))} of 68,921)`);
const g32 = grids['moore-3-2'];
const ex1 = at(g32, [0, 0, 2]), ex2 = at(g32, [2, 3, 3]);
add('berge-examples', 'BGHMM §1', '2 = G(x) < M(x) = 3 for x = (0,0,2) and 8 = G(x) > M(x) = 2 for x = (2,3,3) (k = 2, n = 3)',
  ex1 === 2 && mooreM([0, 0, 2], 2) === 3 && ex2 === 8 && mooreM([2, 3, 3], 2) === 2,
  `G(0,0,2) = ${ex1}, M = ${mooreM([0, 0, 2], 2)}; G(2,3,3) = ${ex2}, M = ${mooreM([2, 3, 3], 2)}`);
add('only-when', 'BGHMM §1', '"the equality [G = M] holds only when M(x) ≤ 1 or G(x) ≤ 1"',
  eqHigh === 0,
  `as worded, false: with k ≥ 2, G = M ≥ 2 at ${fmt(eqHigh)} positions, the smallest being (${eqHighExample?.join(',')}) with G = M = ${eqHighG} (n = ${eqHighExample?.length}, k = ${eqHighK}). What JM proved is the "if" direction: M ≤ 1 or G ≤ 1 implies G = M`);
add('jm-formula', 'Jenkyns–Mayberry 1980 (BGKM eq. (1)–(2), h = Σx)', 'SG of Nim≤_{k+1,k} = U(m, Σx − n·m, Σx)',
  jmBad === 0, `${fmt(jmTried)} positions (n = 3..6, k = n−1): ${jmBad} exceptions. Like Theorem 2 it needs k ≥ 2: at n = 2, k = 1 (2-pile Nim) it misses ${fmt(jmK1Bad)} of ${fmt(jmK1Tried)}, first at (3,1): U = 4, G = 2`);
add('jm-only-k+1', 'BGHMM abstract', 'the JM formula is for n = k+1 only',
  jmOther.every((r) => (r.jmFormulaFails as number) > 0),
  'the same formula fails in every other Moore game tried: ' + jmOther.map((r) => `n=${r.n},k=${r.k}: ${fmt(r.jmFormulaFails as number)} misses`).join('; '));
add('nim-bouton', 'Bouton 1901 (k = 1)', 'G = x1 xor … xor xn', xorBad === 0, `${xorBad} exceptions`);
add('moore-k=n', '(sanity)', 'k = n: G = Σx', allBad === 0, `${allBad} exceptions (n = 4, B = 8)`);

// ------------------------------------------------------------ Exact k-Nim
const t1Cfg: [number, number, number][] = [[3, 2, 30], [4, 3, 15], [5, 3, 8], [5, 4, 8], [6, 4, 5], [6, 5, 5]];
let t1Tried = 0, t1Bad = 0, tetBad = 0, tetTried = 0, volBad = 0, barBad = 0, slowBad = 0, barEqBad = 0;
const exactRows: Record<string, unknown>[] = [];
function checkTetris(n: number, k: number, B: number) {
  const h = solveGrid(n, B, exactMasks(k), 'height');
  for (let idx = 0; idx < h.values.length; idx++) {
    const x = decode(h, idx);
    const T = h.values[idx];
    tetTried++;
    if (tetris(x, k) !== T || tetrisGreedy(x, k) !== T) tetBad++;
    if (tetrisVolume(x, k) !== T) volBad++;
    const b1 = barByTokens(x, k), b2 = barFast(x, k);
    if (b1.join() !== b2.join()) barBad++;
    if (b1[n - k] !== T) barEqBad++;
    // Lemma 3: lowering the k largest piles by one lowers T by exactly one
    if (T > 0) {
      const order = x.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, k).map((p) => p[1]);
      const y = x.slice();
      for (const i of order) y[i]--;
      if (h.values[encode(h, y)] !== T - 1) slowBad++;
    }
  }
  return h;
}
for (const [n, k, B] of t1Cfg) {
  const g = solveGrid(n, B, exactMasks(k));
  checkTetris(n, k, B);
  let bad = 0;
  for (let idx = 0; idx < g.values.length; idx++) {
    const x = decode(g, idx);
    t1Tried++;
    if (sgExact(x, k) !== g.values[idx]) { bad++; t1Bad++; }
  }
  exactRows.push({ n, k, B, positions: g.values.length, theorem: 'G = T', fails: bad });
  log(`exact n=${n} k=${k} B=${B}: ${fmt(g.values.length)} positions, theorem 1 misses ${bad}`);
}
add('thm1', 'BGHMM Theorem 1', 'n < 2k: SG of Nim=_{n,k} equals the Tetris function T_{n,k}',
  t1Bad === 0, `${fmt(t1Tried)} positions in ${t1Cfg.length} games: ${t1Bad} exceptions`);

const t2Cfg: [number, number, number][] = [[4, 2, 15], [6, 3, 6]];
let t2Tried = 0, t2Bad = 0, printedBad = 0, c0Bad = 0, c1Bad = 0;
for (const [n, k, B] of t2Cfg) {
  const g = solveGrid(n, B, exactMasks(k));
  grids[`exact-${n}-${k}`] = g;
  checkTetris(n, k, B);
  let bad = 0;
  for (let idx = 0; idx < g.values.length; idx++) {
    const x = decode(g, idx);
    const G = g.values[idx];
    t2Tried++;
    if (sgExact(x, k) !== G) { bad++; t2Bad++; }
    if (sgExactPrinted(x, k) !== G) printedBad++;
    const s = x.slice().sort((a, b) => a - b);
    const c0 = s.slice(0, k + 1).every((v) => v === s[0]);
    if (c0 !== (G === 0)) c0Bad++;
    let c1 = false;
    for (let l = 0; l <= k - 1 && !c1; l++) {
      const lo = s.slice(0, k - l), hi = s.slice(k - l, k + l + 1);
      const c = lo[0];
      if (c % 2 === 0 && lo.every((v) => v === c) && hi.every((v) => v === c + 1)) c1 = true;
    }
    if (c1 !== (G === 1)) c1Bad++;
  }
  exactRows.push({ n, k, B, positions: g.values.length, theorem: 'JM-type formula', fails: bad });
  log(`exact n=${n} k=${k} B=${B}: theorem 2 misses ${bad}`);
}
add('thm2', 'BGHMM Theorem 2', 'n = 2k, k ≥ 2: G = u if m < z, else v (u = T(x), y = T(x − m), z = 1 + C(y+1,2), v = z − 1 + (m − z) mod (y+1))',
  t2Bad === 0 && printedBad === 0, `${fmt(t2Tried)} positions (n=4,k=2, B=15; n=6,k=3, B=6): ${t2Bad} exceptions`);
add('thm2-is-jm', 'BGHMM §1 ("surprisingly similar")', 'the n = 2k formula is the JM formula U(m, y, h) with the height h = T',
  t2Bad === 0, 'identical on every position checked: Theorem 2 = U(m, T(x − m), T(x)), the same U as for Moore\'s Nim≤_{k+1,k} with h = Σx');
add('cor-0', 'BGHMM Corollary 1(i)', 'n = 2k: P-position iff x1 = … = x_{k+1} (sorted)', c0Bad === 0, `${c0Bad} exceptions`);
add('cor-1', 'BGHMM Corollary 1(ii)', 'n = 2k: 1-position iff x1 = … = x_{k−ℓ} = 2c and x_{k−ℓ+1} = … = x_{k+ℓ+1} = 2c+1', c1Bad === 0, `${c1Bad} exceptions`);

// k = 1: formula fails
{
  const g = solveGrid(2, 63, exactMasks(1));
  let bad = 0, first: number[] | null = null;
  for (let idx = 0; idx < g.values.length; idx++) {
    const x = decode(g, idx);
    const m = Math.min(...x);
    const f = jm(m, tetris(x.map((v) => v - m), 1), tetris(x, 1));
    if (f !== g.values[idx]) { bad++; if (!first) first = x; }
  }
  add('thm2-k1', 'BGHMM §1', 'the n = 2k formula fails for k = 1 (2-pile Nim)', bad > 0,
    `fails at ${fmt(bad)} of 4,096 positions, first at (${first?.join(',')}): formula ${(() => { const x = first!; const m = Math.min(...x); return jm(m, tetris(x.map((v) => v - m), 1), tetris(x, 1)); })()}, Nim ${first![0] ^ first![1]}`);
}

add('tetris-fast', 'BGHMM Theorem 4', 'T_{n,k}(x) = x̄_{n−k+1}, with x̄ computed in O(n) by the volume formula',
  tetBad === 0 && barBad === 0 && barEqBad === 0,
  `${fmt(tetTried)} positions: brute-force height = O(n) formula = greedy in all; token-by-token x̄ = O(n) x̄ (${barBad} differ)`);
add('tetris-volume', 'BGHMM Lemma 7', 'T = the g with kg ≤ Σ min(x_i, g) and Σ min(x_i, g+1) < k(g+1)', volBad === 0, `${volBad} exceptions`);
add('slow-move', 'BGHMM Lemma 3', 'lowering the k largest piles by one lowers T by exactly one', slowBad === 0, `${slowBad} exceptions`);
{
  const x = [1, 2, 2, 3, 4, 4, 7];
  const b = barByTokens(x, 4);
  add('fig-bar', 'BGHMM Figures 1 and 6', 'k = 4, x = (1,2,2,3,4,4,7): x̄ = (0,0,0,5,5,6,7)', b.join() === '0,0,0,5,5,6,7', `x̄ = (${b.join(',')}), T = ${tetris(x, 4)}`);
}

// ---- open case n > 2k: how far off are the known formulas?
const openRows: Record<string, unknown>[] = [];
const openP: Record<string, number[][]> = {};
for (const [n, k, B] of [[3, 1, 12], [5, 2, 9], [6, 2, 5], [7, 3, 4]] as [number, number, number][]) {
  const g = solveGrid(n, B, exactMasks(k));
  const h = solveGrid(n, B, exactMasks(k), 'height');
  let eqT = 0, eqU = 0, P = 0;
  const ps: number[][] = [];
  for (let idx = 0; idx < g.values.length; idx++) {
    const x = decode(g, idx);
    const G = g.values[idx];
    const T = h.values[idx];
    const m = Math.min(...x);
    if (G === T) eqT++;
    if (G === jm(m, h.values[encode(h, x.map((v) => v - m))], T)) eqU++;
    if (G === 0) {
      P++;
      if (x.every((v, i) => i === 0 || x[i - 1] <= v)) ps.push(x);
    }
  }
  openRows.push({ n, k, B, positions: g.values.length, P, sgEqualsT: eqT, sgEqualsJM: eqU });
  openP[`${n}-${k}`] = ps.slice(0, 400);
  log(`open n=${n} k=${k} B=${B}: P ${P}, G=T ${eqT}, G=U ${eqU}`);
}

// ------------------------------------------------------------ selective compound (BGKM Example)
{
  // two copies of Moore's game on 3 vertices (all proper subsets), piles ≤ 5
  const B = 5;
  const proper = (m: number) => (m & 7) !== 7 && ((m >> 3) & 7) !== 7;
  const g = solveGrid(6, B, (m) => m !== 0 && proper(m));
  const g3 = grids['moore-3-2'];
  let bad = 0;
  const U3 = (x: number[]) => {
    const m = Math.min(...x); const h = sum(x);
    return { m, y: h - 3 * m, h };
  };
  for (let idx = 0; idx < g.values.length; idx++) {
    const x = decode(g, idx);
    const a = U3(x.slice(0, 3)), b = U3(x.slice(3));
    if (jm(a.m + b.m, a.y + b.y, a.h + b.h) !== g.values[idx]) bad++;
  }
  add('selective-thm', 'BGKM Theorem 2 (p = 2, two Moore games on 3 vertices)', 'SG of the selective compound = U(m1+m2, y1+y2, h1+h2)',
    bad === 0, `${fmt(g.values.length)} positions with piles ≤ 5: ${bad} exceptions`);
  const a = [4, 4, 5, 4, 4, 5];
  const Ga = g.values[encode(g, a)];
  const comp1 = at(g3, [4, 4, 5]);
  // every move a → b with G(b) = 2
  const to2: { b: number[]; g1: number; g2: number }[] = [];
  for (let idx = 0; idx < encode(g, a); idx++) {
    const b = decode(g, idx);
    if (g.values[idx] !== 2) continue;
    let mask = 0, ok = true;
    for (let i = 0; i < 6; i++) { if (b[i] > a[i]) ok = false; if (b[i] < a[i]) mask |= 1 << i; }
    if (!ok || mask === 0 || !proper(mask)) continue;
    to2.push({ b, g1: at(g3, b.slice(0, 3)), g2: at(g3, b.slice(3)) });
  }
  const allIncrease = to2.every((t) => t.g1 > comp1 || t.g2 > comp1);
  add('selective-example', 'BGKM Example 2', 'a = ((4,4,5),(4,4,5)): G(a^i) = 1, G(a) = 4, and every move to SG 2 raises one component\'s SG (to (3,3,4) and (4,4,4))',
    comp1 === 1 && Ga === 4 && allIncrease && to2.length > 0,
    `G(4,4,5) = ${comp1}, G(a) = ${Ga}; ${to2.length} moves reach SG 2: ${to2.map((t) => `(${t.b.slice(0, 3).join(',')})(${t.b.slice(3).join(',')})`).join(', ')} — every one raises a component to SG 2. The paper's (3,3,4) is read up to order: (4,4,5) → (3,3,4) would lower all three piles, which a Moore game on 3 vertices forbids; the actual targets are (3,4,3) and (4,3,3)`);
}

// ------------------------------------------------------------ tables for the demo
const slice = (g: Grid, z: number, size: number) => {
  const rows: number[][] = [];
  for (let a = 0; a < size; a++) { const r: number[] = []; for (let b = 0; b < size; b++) r.push(at(g, [z, a, b])); rows.push(r); }
  return rows;
};
const demo = {
  moore32: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((z) => ({ z, G: slice(grids['moore-3-2'], z, 24), M: Array.from({ length: 24 }, (_, a) => Array.from({ length: 24 }, (_, b) => mooreM([z, a, b], 2))) })),
};

mkdirSync('runs', { recursive: true });
writeFileSync('runs/verify.json', JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  seconds: Math.round((Date.now() - t0) / 1000),
  claims, moore: mooreRows, exact: exactRows, open: openRows, openP, demo,
}, null, 0));
log(`done: ${claims.filter((c) => c.ok).length}/${claims.length} claims as stated`);
void popcount;
