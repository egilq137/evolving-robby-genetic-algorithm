// A quick visual sanity check for Increment 1, using the REAL world code
// (not a re-implementation) so what you see is what the tests test.

import {
  createGrid,
  placeCans,
  countCans,
  sense,
  CAN,
  WALL,
  EMPTY,
  type Grid,
} from "../core/world";
import { makeRng } from "../core/rng";
import { encodeSituation } from "../core/situation";

const CELL = 33; // pixels per cell (10 cells -> 330px canvas)
const N = 10; // grid is 10 x 10

function drawGrid(canvas: HTMLCanvasElement, grid: Grid): void {
  const ctx = canvas.getContext("2d")!;
  const fg = getComputedStyle(document.body).color;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "gray";
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const x = c * CELL;
      const y = r * CELL;
      ctx.strokeRect(x, y, CELL, CELL);
      if (grid.cells[r * grid.cols + c] === CAN) {
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/** Color a value in [0,1]: 0 -> blue, 0.5 -> gray, 1 -> red. */
function heatColor(v: number): string {
  const r = Math.round(255 * v);
  const b = Math.round(255 * (1 - v));
  return `rgb(${r}, ${Math.round(120 + 40 * (1 - Math.abs(v - 0.5) * 2))}, ${b})`;
}

function drawHeat(
  canvas: HTMLCanvasElement,
  fractions: number[],
  statsEl: HTMLElement,
  seed: number,
): void {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const v = fractions[r * N + c];
      ctx.fillStyle = heatColor(v);
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      ctx.fillStyle = "black";
      ctx.font = "10px monospace";
      ctx.fillText((v * 100).toFixed(0), c * CELL + 8, r * CELL + 20);
    }
  }
  const min = Math.min(...fractions);
  const max = Math.max(...fractions);
  const mean = fractions.reduce((a, b) => a + b, 0) / fractions.length;
  statsEl.textContent =
    `seed=${seed}  |  per-cell can frequency over 5000 grids  |  ` +
    `min=${(min * 100).toFixed(1)}%  mean=${(mean * 100).toFixed(1)}%  ` +
    `max=${(max * 100).toFixed(1)}%   (all should hug 50%)`;
}

function run(seed: number): void {
  const gridCanvas = document.getElementById("grid") as HTMLCanvasElement;
  const heatCanvas = document.getElementById("heat") as HTMLCanvasElement;
  const statsEl = document.getElementById("stats") as HTMLElement;

  // 1) One sampled grid.
  const sample = placeCans(createGrid(N, N), 0.5, makeRng(seed));
  drawGrid(gridCanvas, sample);

  // 2) Per-cell frequency over many trials (same idea as the PER-CELL test).
  const trials = 5000;
  const g = createGrid(N, N);
  const counts = new Array(N * N).fill(0);
  const rng = makeRng(seed + 1);
  for (let t = 0; t < trials; t++) {
    placeCans(g, 0.5, rng);
    for (let i = 0; i < N * N; i++) counts[i] += g.cells[i];
  }
  const fractions = counts.map((x) => x / trials);
  drawHeat(heatCanvas, fractions, statsEl, seed);

  console.log(
    `sampled grid seed=${seed}: ${countCans(sample)}/100 cans (~50 expected)`,
  );
}

let seed = 2024;
run(seed);
document.getElementById("reroll")!.addEventListener("click", () => {
  seed = Math.floor(Math.random() * 1e6);
  run(seed);
});

// --- Interactive sensing demo ------------------------------------------------

const senseGrid = placeCans(createGrid(N, N), 0.5, makeRng(777));
let robby = { row: 0, col: 0 };

const NAME: Record<number, string> = {
  [EMPTY]: "Empty",
  [CAN]: "Can",
  [WALL]: "Wall",
};

function drawSensing(): void {
  const canvas = document.getElementById("sense") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const fg = getComputedStyle(document.body).color;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const neighbors = [
    { row: robby.row - 1, col: robby.col }, // north
    { row: robby.row + 1, col: robby.col }, // south
    { row: robby.row, col: robby.col + 1 }, // east
    { row: robby.row, col: robby.col - 1 }, // west
  ];
  const isSensed = (r: number, c: number) =>
    (r === robby.row && c === robby.col) ||
    neighbors.some((n) => n.row === r && n.col === c);

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const x = c * CELL;
      const y = r * CELL;
      if (isSensed(r, c)) {
        ctx.fillStyle = "rgba(120,170,255,0.25)"; // highlight sensed cells
        ctx.fillRect(x, y, CELL, CELL);
      }
      ctx.strokeStyle = "gray";
      ctx.strokeRect(x, y, CELL, CELL);
      if (senseGrid.cells[r * N + c] === CAN) {
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Robby marker
  ctx.fillStyle = "rgb(40,110,240)";
  ctx.fillRect(robby.col * CELL + 6, robby.row * CELL + 6, CELL - 12, CELL - 12);

  const s = sense(senseGrid, robby.row, robby.col);
  const readout = document.getElementById("senseReadout") as HTMLElement;
  const wallCount = [s.north, s.south, s.east, s.west].filter(
    (v) => v === WALL,
  ).length;
  const idx = encodeSituation(s);
  readout.innerHTML =
    `Robby at (row ${robby.row}, col ${robby.col})<br>` +
    `Current: ${NAME[s.current]} &nbsp; North: ${NAME[s.north]} &nbsp; ` +
    `South: ${NAME[s.south]} &nbsp; East: ${NAME[s.east]} &nbsp; West: ${NAME[s.west]}<br>` +
    `<strong>Situation #${idx}</strong> (of 0..242) &nbsp; ` +
    `<small style="opacity:0.7">walls sensed: ${wallCount}</small>`;
}

(document.getElementById("sense") as HTMLCanvasElement).addEventListener(
  "click",
  (e) => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * N);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * N);
    robby = {
      row: Math.max(0, Math.min(N - 1, row)),
      col: Math.max(0, Math.min(N - 1, col)),
    };
    drawSensing();
  },
);
drawSensing();
