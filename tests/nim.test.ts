import { describe, expect, it } from 'vitest';
import {
  barByTokens, barFast, decode, exactMasks, forEachMove, isLegal, isP, mooreM, mooreMasks,
  mooreWinningMove, sgClosed, sgExact, sgExactPrinted, sgMooreNminus1, sgSearch, solveGrid,
  tetris, tetrisGreedy, tetrisVolume, winningMove, type Game,
} from '../src/nim.ts';

const sum = (x: number[]) => x.reduce((a, b) => a + b, 0);

describe("Moore's Nim", () => {
  it('computes M(x) as in the paper example', () => {
    expect(mooreM([2, 3, 6], 2)).toBe(10);
    expect(mooreM([0, 0, 2], 2)).toBe(3);
    expect(mooreM([2, 3, 3], 2)).toBe(2);
  });

  it('M(x) = 0 exactly at the P-positions (exhaustive, n ≤ 4)', () => {
    for (const [n, k, B] of [[3, 2, 12], [4, 2, 6], [4, 3, 6]]) {
      const g = solveGrid(n, B, mooreMasks(k));
      for (let i = 0; i < g.values.length; i++) {
        const x = decode(g, i);
        expect(g.values[i] === 0).toBe(mooreM(x, k) === 0);
        expect(g.values[i] === 1).toBe(mooreM(x, k) === 1);
      }
    }
  });

  it('the column construction always finds a legal move to M = 0', () => {
    for (const [n, k, B] of [[3, 2, 15], [4, 2, 7], [5, 3, 5]]) {
      const g = solveGrid(n, B, mooreMasks(k));
      const game: Game = { kind: 'moore', n, k };
      for (let i = 0; i < g.values.length; i++) {
        const x = decode(g, i);
        const y = mooreWinningMove(x, k);
        if (mooreM(x, k) === 0) expect(y).toBeNull();
        else {
          expect(y && isLegal(game, x, y)).toBe(true);
          expect(mooreM(y!, k)).toBe(0);
        }
      }
    }
  });

  it('the Jenkyns–Mayberry formula gives the SG of Nim≤_{k+1,k} for k ≥ 2, and fails at k = 1', () => {
    for (const [n, B] of [[3, 14], [4, 7]]) {
      const g = solveGrid(n, B, mooreMasks(n - 1));
      for (let i = 0; i < g.values.length; i++) expect(sgMooreNminus1(decode(g, i))).toBe(g.values[i]);
    }
    expect(sgMooreNminus1([3, 1])).toBe(4); // 2-pile Nim has G = 3 xor 1 = 2
  });

  it('Berge is wrong: G(0,0,2) = 2 < M = 3 and G(2,3,3) = 8 > M = 2; and G = M = 2 at (0,1,1)', () => {
    const g = solveGrid(3, 4, mooreMasks(2));
    const at = (x: number[]) => g.values[x[0] + 5 * x[1] + 25 * x[2]];
    expect(at([2, 0, 0])).toBe(2);
    expect(at([2, 3, 3])).toBe(8);
    expect(at([0, 1, 1])).toBe(2);
    expect(mooreM([0, 1, 1], 2)).toBe(2);
  });

  it('k = 1 is Nim and k ≥ n gives SG = Σx', () => {
    const g = solveGrid(3, 7, mooreMasks(1));
    for (let i = 0; i < g.values.length; i++) {
      const x = decode(g, i);
      expect(g.values[i]).toBe(x[0] ^ x[1] ^ x[2]);
    }
    const h = solveGrid(3, 5, mooreMasks(3));
    for (let i = 0; i < h.values.length; i++) expect(h.values[i]).toBe(sum(decode(h, i)));
  });
});

describe('Tetris function', () => {
  it('reproduces the figure: x = (1,2,2,3,4,4,7), k = 4 gives x̄ = (0,0,0,5,5,6,7)', () => {
    expect(barByTokens([1, 2, 2, 3, 4, 4, 7], 4)).toEqual([0, 0, 0, 5, 5, 6, 7]);
    expect(barFast([1, 2, 2, 3, 4, 4, 7], 4)).toEqual([0, 0, 0, 5, 5, 6, 7]);
    expect(tetris([1, 2, 2, 3, 4, 4, 7], 4)).toBe(5);
  });

  it('O(n) formula, greedy, volume criterion and brute force agree', () => {
    for (const [n, k, B] of [[3, 1, 8], [4, 2, 8], [5, 2, 5], [5, 3, 5], [6, 4, 3]]) {
      const h = solveGrid(n, B, exactMasks(k), 'height');
      for (let i = 0; i < h.values.length; i++) {
        const x = decode(h, i);
        const T = h.values[i];
        expect(tetris(x, k)).toBe(T);
        expect(tetrisGreedy(x, k)).toBe(T);
        expect(tetrisVolume(x, k)).toBe(T);
        expect(barFast(x, k)).toEqual(barByTokens(x, k));
      }
    }
  });
});

describe('Exact k-Nim', () => {
  it('n < 2k: SG equals the Tetris function', () => {
    for (const [n, k, B] of [[3, 2, 12], [4, 3, 8], [5, 3, 5]]) {
      const g = solveGrid(n, B, exactMasks(k));
      for (let i = 0; i < g.values.length; i++) expect(sgExact(decode(g, i), k)).toBe(g.values[i]);
    }
  });

  it('n = 2k: the printed formula, which is the JM formula with height T', () => {
    for (const [n, k, B] of [[4, 2, 10], [6, 3, 4]]) {
      const g = solveGrid(n, B, exactMasks(k));
      for (let i = 0; i < g.values.length; i++) {
        const x = decode(g, i);
        expect(sgExact(x, k)).toBe(g.values[i]);
        expect(sgExactPrinted(x, k)).toBe(g.values[i]);
      }
    }
  });

  it('n > 2k: memoised search agrees with the grid solver, and winning moves land on P', () => {
    const game: Game = { kind: 'exact', n: 5, k: 2 };
    const g = solveGrid(5, 4, exactMasks(2));
    const memo = new Map<string, number>();
    for (let i = 0; i < g.values.length; i += 3) {
      const x = decode(g, i);
      expect(sgSearch(game, x, memo)).toBe(g.values[i]);
      const y = winningMove(game, x, memo);
      if (g.values[i] === 0) expect(y).toBeNull();
      else { expect(isLegal(game, x, y!)).toBe(true); expect(isP(game, y!, memo)).toBe(true); }
    }
    expect(sgClosed(game, [1, 2, 3, 4, 5])).toBeNull();
  });

  it('enumerates exactly the legal moves', () => {
    const game: Game = { kind: 'exact', n: 4, k: 2 };
    let count = 0;
    forEachMove(game, [1, 2, 0, 3], (y) => { count++; expect(isLegal(game, [1, 2, 0, 3], y)).toBe(true); });
    expect(count).toBe(1 * 2 + 1 * 3 + 2 * 3); // pairs of nonempty piles
    const moore: Game = { kind: 'moore', n: 3, k: 2 };
    let c2 = 0;
    forEachMove(moore, [1, 1, 1], () => { c2++; });
    expect(c2).toBe(3 + 3);
  });
});
