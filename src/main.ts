import './style.css';
import {
  barFast, isLegal, isP, jm, mooreDigits, mooreM, sgClosed, sgSearch, tetris, winningMove,
  type Game, type Kind,
} from './nim.ts';
import verifyRun from '../runs/verify.json';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (x: number) => x.toLocaleString('en');
const sum = (x: readonly number[]) => x.reduce((a, b) => a + b, 0);

// ------------------------------------------------------------------ state
let game: Game = { kind: 'moore', n: 3, k: 2 };
let pos: number[] = [6, 9, 13];
let target: (number | null)[] = [];
let history: { pos: number[]; cpu: boolean }[] = [];
let memo = new Map<string, number>();
let lastCpu: string | null = null;

const kindSel = $<HTMLSelectElement>('kind');
const nSel = $<HTMLSelectElement>('nSel');
const kSel = $<HTMLSelectElement>('kSel');
const hints = $<HTMLInputElement>('hints');
const cpu = $<HTMLInputElement>('cpu');
const pilesEl = $('piles');
const statusEl = $('status');

const maxPile = () => (game.kind === 'exact' && game.n > 2 * game.k && game.k > 1 ? 9 : 15);

for (let n = 2; n <= 6; n++) nSel.add(new Option(String(n), String(n)));
function fillK() {
  const keep = game.k;
  kSel.innerHTML = '';
  for (let k = 1; k <= game.n; k++) kSel.add(new Option(String(k), String(k)));
  game.k = Math.min(keep, game.n);
  kSel.value = String(game.k);
}

function sg(x: readonly number[]): number | null {
  const c = sgClosed(game, x);
  if (c !== null) return c;
  if (game.kind === 'exact') return sgSearch(game, x, memo);
  return null; // Moore's Nim with 2 ≤ k ≤ n − 2: no formula known
}

function randomPos() {
  const top = maxPile();
  for (let tries = 0; tries < 50; tries++) {
    pos = Array.from({ length: game.n }, () => 1 + Math.floor(Math.random() * Math.min(top, 12)));
    if (!isP(game, pos, memo)) break; // start from a won position for the player
  }
  target = pos.map(() => null);
  history = [];
  lastCpu = null;
  render();
}

function pending(): number[] {
  return pos.map((v, i) => target[i] ?? v);
}

function changed(): number {
  return target.filter((t) => t !== null).length;
}

// ------------------------------------------------------------------ render
function render() {
  const y = pending();
  const legal = changed() > 0 && isLegal(game, pos, y);
  const over = !hasMove(pos);
  pilesEl.innerHTML = '';
  pos.forEach((v, i) => {
    const pile = document.createElement('div');
    pile.className = 'pile';
    if (target[i] !== null) pile.classList.add(legal ? 'sel' : 'bad');
    const col = document.createElement('div');
    col.className = 'col';
    for (let h = 1; h <= v; h++) {
      const t = document.createElement('button');
      t.className = 'tok';
      if (target[i] !== null && h > target[i]!) t.classList.add('gone');
      t.title = `lower pile ${i + 1} to ${h - 1}`;
      t.addEventListener('click', () => onToken(i, h));
      col.appendChild(t);
    }
    const cnt = document.createElement('div');
    cnt.className = 'cnt';
    cnt.innerHTML = target[i] !== null ? `${v}<span class="to">→${target[i]}</span>` : String(v);
    const lab = document.createElement('div');
    lab.className = 'lab';
    lab.textContent = `pile ${i + 1}`;
    pile.append(col, cnt, lab);
    pilesEl.appendChild(pile);
  });

  $<HTMLButtonElement>('move').disabled = !legal || over;
  $<HTMLButtonElement>('best').disabled = over;
  $<HTMLButtonElement>('undo').disabled = history.length === 0;

  const g = sg(pos);
  const p = isP(game, pos, memo);
  let msg = '';
  if (lastCpu) msg += `Computer: ${lastCpu}. `;
  if (over) {
    msg += history.length && history[history.length - 1].cpu
      ? '<b class="ng">No move left — the computer moved last and wins.</b>'
      : history.length ? '<b class="ok">No move left — you moved last and win.</b>' : 'No move possible.';
  } else {
    const need = game.kind === 'moore' ? `1 to ${game.k}` : `exactly ${game.k}`;
    msg += `Your move: lower ${need} pile${game.k === 1 ? '' : 's'}. `;
    if (hints.checked) {
      msg += p
        ? '<b class="ng">This is a P-position</b> — every move loses against perfect play.'
        : '<b class="ok">This is an N-position</b> — a winning move exists.';
      msg += g !== null ? ` SG value <b>${g}</b>.` : ' SG value: no formula known for this n, k.';
      if (changed() > 0) {
        if (!legal) msg += ` <span class="ng">Selection is not a legal move (${changed()} pile${changed() === 1 ? '' : 's'}).</span>`;
        else msg += isP(game, y, memo) ? ' <span class="ok">✓ the selected move wins.</span>' : ' <span class="ng">✗ the selected move hands over a win.</span>';
      }
    }
  }
  statusEl.innerHTML = msg;
  renderWhy();
}

function hasMove(x: readonly number[]): boolean {
  const nonEmpty = x.filter((v) => v > 0).length;
  return game.kind === 'moore' ? nonEmpty > 0 : nonEmpty >= game.k;
}

function renderWhy() {
  const why = $('why');
  const x = pending();
  if (game.kind === 'moore') {
    $('whySub').textContent = `binary columns mod ${game.k + 1}${changed() ? ' (after the selected move)' : ''}`;
    const k = game.k;
    const digits = mooreDigits(x, k);
    const J = Math.max(digits.length, 1);
    let html = '<table class="bin"><tr><th></th>';
    for (let j = J - 1; j >= 0; j--) html += `<th>2<sup>${j}</sup></th>`;
    html += '<th></th></tr>';
    x.forEach((v, i) => {
      html += `<tr><td class="dim">pile ${i + 1}</td>`;
      for (let j = J - 1; j >= 0; j--) {
        const b = Math.floor(v / 2 ** j) % 2;
        html += `<td class="${b ? 'one' : 'dim'}">${b}</td>`;
      }
      html += `<td class="dim">${v}</td></tr>`;
    });
    html += `<tr class="sum"><td class="dim">mod ${k + 1}</td>`;
    for (let j = J - 1; j >= 0; j--) {
      const d = digits[j] ?? 0;
      html += `<td class="${d ? 'nz' : 'z'}">${d}</td>`;
    }
    const M = mooreM(x, k);
    html += `<td></td></tr></table>`;
    html += `<p class="formula">M(x) = ${digits.map((d, j) => `${d}·${k + 1}<sup>${j}</sup>`).reverse().join(' + ') || '0'} = <b>${fmt(M)}</b> ⇒ ${M === 0 ? '<span class="ok">P-position</span>' : '<span class="ng">N-position</span>'}`;
    if (k === x.length - 1 && k >= 2) {
      const m = Math.min(...x), h = sum(x), yv = h - x.length * m;
      const c = (yv * (yv + 1)) / 2;
      html += `<br>Jenkyns–Mayberry (n = k+1): m = ${m}, h = Σx = ${h}, y = h − n·m = ${yv}; ${m <= c ? `m ≤ C(y+1,2) = ${c} ⇒ G = h = <b>${h}</b>` : `m > C(y+1,2) = ${c} ⇒ G = ${c} + ((m − ${c} − 1) mod ${yv + 1}) = <b>${jm(m, yv, h)}</b>`}. Berge's M(x) = ${M}${M === jm(m, yv, h) ? ' happens to agree' : ' does not'}.`;
    } else if (k === 1) html += '<br>k = 1 is ordinary Nim: M(x) is the xor, and it is the SG value.';
    else if (k >= x.length) html += `<br>k ≥ n: any smaller position is one move away, so G = Σx = ${sum(x)}.`;
    else html += '<br>For 2 ≤ k ≤ n − 2 no SG formula is known — only the P-positions (M = 0) and the 1-positions (M = 1).';
    html += '</p>';
    why.innerHTML = html;
  } else {
    const k = game.k, n = x.length;
    $('whySub').textContent = `the Tetris function T (longest possible game)${changed() ? ' after the selected move' : ''}`;
    const T = tetris(x, k);
    const bar = barFast(x, k);
    let html = `<p class="formula">T<sub>${n},${k}</sub>(x) = <b>${T}</b> — empty the ${n - k} smallest pile${n - k === 1 ? '' : 's'} onto the ${k} largest, smallest first: x̄ = (${bar.join(', ')}), T = x̄<sub>${n - k + 1}</sub>.`;
    if (n < 2 * k) html += `<br>n &lt; 2k ⇒ G = T = <b>${T}</b> (Theorem 1).`;
    else if (n === 2 * k && k >= 2) {
      const m = Math.min(...x);
      const yv = tetris(x.map((v) => v - m), k);
      const c = (yv * (yv + 1)) / 2;
      html += `<br>n = 2k (Theorem 2): m = ${m}, y = T(x − m) = ${yv}; ${m <= c ? `m ≤ C(y+1,2) = ${c} ⇒ G = T = <b>${T}</b>` : `m > C(y+1,2) = ${c} ⇒ G = ${c} + ((m − ${c} − 1) mod ${yv + 1}) = <b>${jm(m, yv, T)}</b>`}. The same JM formula as Moore's n = k+1, with height T instead of Σx.`;
      const s = x.slice().sort((a, b) => a - b);
      html += `<br>Corollary: P-position iff the ${k + 1} smallest piles are equal — here (${s.slice(0, k + 1).join(', ')}) ⇒ ${s.slice(0, k + 1).every((v) => v === s[0]) ? '<span class="ok">P</span>' : '<span class="ng">N</span>'}.`;
    } else if (k === 1) html += `<br>k = 1 is ordinary Nim: G = xor = ${x.reduce((a, b) => a ^ b, 0)}.`;
    else html += `<br>n &gt; 2k: no formula is known, not even for the P-positions. The SG value shown is from exhaustive search (memoised, ${fmt(memo.size)} positions so far).`;
    html += '</p>';
    why.innerHTML = html;
  }
}

// ------------------------------------------------------------------ actions
function onToken(i: number, h: number) {
  const to = h - 1;
  target[i] = target[i] === to ? null : to;
  if (target[i] === pos[i]) target[i] = null;
  lastCpu = null;
  render();
}

function describe(from: number[], to: number[]): string {
  return from.map((v, i) => (to[i] < v ? `pile ${i + 1} ${v}→${to[i]}` : '')).filter(Boolean).join(', ');
}

function apply(to: number[], byCpu = false) {
  history.push({ pos: pos.slice(), cpu: byCpu });
  pos = to.slice();
  target = pos.map(() => null);
}

function cpuMove() {
  if (!hasMove(pos)) return;
  let y = winningMove(game, pos, memo);
  if (!y) {
    // lost position: take a single token (or one from each of k piles) to prolong the game
    y = pos.slice();
    const order = pos.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    const take = game.kind === 'moore' ? 1 : game.k;
    for (let q = 0; q < take; q++) y[order[q][1]]--;
  }
  lastCpu = describe(pos, y);
  apply(y, true);
}

$('move').addEventListener('click', () => {
  const y = pending();
  if (!isLegal(game, pos, y)) return;
  lastCpu = null;
  apply(y);
  if (cpu.checked) cpuMove();
  render();
});
$('clear').addEventListener('click', () => { target = pos.map(() => null); render(); });
$('best').addEventListener('click', () => {
  const y = winningMove(game, pos, memo);
  if (!y) { statusEl.innerHTML += ' <b>No winning move: this is a P-position.</b>'; return; }
  target = pos.map((v, i) => (y[i] < v ? y[i] : null));
  lastCpu = null;
  render();
});
$('undo').addEventListener('click', () => {
  if (!history.length) return;
  // pop back to (and including) the player's last move
  for (;;) {
    const h = history.pop()!;
    pos = h.pos;
    if (!h.cpu || !history.length) break;
  }
  target = pos.map(() => null);
  lastCpu = null;
  render();
});
$('random').addEventListener('click', randomPos);
hints.addEventListener('change', render);
function reconfigure() {
  game = { kind: kindSel.value as Kind, n: Number(nSel.value), k: Number(kSel.value) };
  if (game.kind === 'exact' && game.k > game.n) game.k = game.n;
  memo = new Map();
  randomPos();
}
kindSel.addEventListener('change', reconfigure);
nSel.addEventListener('change', () => { game.n = Number(nSel.value); fillK(); reconfigure(); });
kSel.addEventListener('change', reconfigure);

nSel.value = String(game.n);
fillK();
{
  const w = winningMove(game, pos, memo); // open on a highlighted winning move
  target = pos.map((v, i) => (w && w[i] < v ? w[i] : null));
}

// ------------------------------------------------------------------ SG maps
type Slice = { z: number; G: number[][]; M: number[][] };
const slices = (verifyRun as unknown as { demo: { moore32: Slice[] } }).demo.moore32;
const zIn = $<HTMLInputElement>('zIn');
const color = (v: number, max: number) => {
  if (v === 0) return '#ecebe7';
  const t = Math.min(1, Math.sqrt(v / max));
  const a = [38, 44, 70], b = [240, 190, 80];
  return `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * t)).join(',')})`;
};
function drawMap(canvas: HTMLCanvasElement, grid: number[][], other: number[][], max: number) {
  const ctx = canvas.getContext('2d')!;
  const N = grid.length;
  const cell = canvas.width / N;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
    ctx.fillStyle = color(grid[a][b], max);
    ctx.fillRect(b * cell, a * cell, cell - 0.5, cell - 0.5);
    if (grid[a][b] === other[a][b] && grid[a][b] >= 2) {
      ctx.strokeStyle = '#9be3b0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b * cell + 1, a * cell + 1, cell - 3, cell - 3);
    }
  }
}
function renderMaps() {
  const z = Number(zIn.value);
  $('zOut').textContent = String(z);
  const s = slices[z];
  drawMap($<HTMLCanvasElement>('mapG'), s.G, s.M, Math.max(...s.G.flat()));
  drawMap($<HTMLCanvasElement>('mapM'), s.M, s.G, Math.max(...s.M.flat()));
  let same = 0, sameHigh = 0;
  const N = s.G.length;
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
    if (s.G[a][b] === s.M[a][b]) { same++; if (s.G[a][b] >= 2) sameHigh++; }
  }
  $('mapNote').innerHTML = `Positions (${z}, a, b) with 0 ≤ a, b ≤ ${N - 1}; white = 0 (P-position), blue → gold = small → large (each map on its own scale). The white cells agree — Moore's theorem — and so do the 1s (Jenkyns–Mayberry), but G = M on only ${same} of ${N * N} cells. Green outlines mark the ${sameHigh} cell${sameHigh === 1 ? "" : "s"} where G = M ≥ 2, which the "only when M ≤ 1 or G ≤ 1" wording rules out.`;
}
function hover(canvas: HTMLCanvasElement) {
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const s = slices[Number(zIn.value)];
    const N = s.G.length;
    const b = Math.floor(((e.clientX - r.left) / r.width) * N);
    const a = Math.floor(((e.clientY - r.top) / r.height) * N);
    if (a < 0 || b < 0 || a >= N || b >= N) return;
    canvas.title = `x = (${zIn.value}, ${a}, ${b}): G = ${s.G[a][b]}, M = ${s.M[a][b]}`;
  });
}
hover($<HTMLCanvasElement>('mapG'));
hover($<HTMLCanvasElement>('mapM'));
zIn.addEventListener('input', renderMaps);

// ------------------------------------------------------------------ paper check + open table
type ClaimRow = { id: string; source: string; claim: string; ok: boolean; result: string };
const run = verifyRun as unknown as {
  claims: ClaimRow[];
  open: { n: number; k: number; B: number; positions: number; P: number; sgEqualsT: number; sgEqualsJM: number }[];
};
const tex = (t: string) => t.replace(/_\{([^}]*)\}/g, '<sub>$1</sub>');
const okCount = run.claims.filter((c) => c.ok).length;
$('checkHead').textContent = `${okCount} / ${run.claims.length} as stated`;
$('checks').innerHTML = run.claims.map((c) => `<div class="chk-row"><b class="${c.ok ? 'ok' : 'ng'}">${c.ok ? '✓' : '✗'}</b> <b>${c.source}</b> — ${tex(c.claim)}<br><span class="dim small">${tex(c.result)}</span></div>`).join('');
$<HTMLTableElement>('open').innerHTML = '<tr><th>game</th><th>piles ≤</th><th class="num">P</th><th class="num">G = T</th><th class="num">G = JM</th></tr>' +
  run.open.filter((r) => r.k > 1).map((r) => `<tr><td>Nim=<sub>${r.n},${r.k}</sub></td><td>${r.B}</td><td class="num">${fmt(r.P)}</td><td class="num">${(100 * r.sgEqualsT / r.positions).toFixed(1)}%</td><td class="num">${(100 * r.sgEqualsJM / r.positions).toFixed(1)}%</td></tr>`).join('');

render();
renderMaps();
