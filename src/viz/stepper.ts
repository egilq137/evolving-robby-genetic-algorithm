// Interactive "apply one action at a time" debugger for Increment 4.
// Uses the REAL action engine (applyAction) and sensing/encoding, so what you
// see is exactly what the tests test.

import { createGrid, placeCans, sense, CAN, type Grid } from "../core/world";
import { makeRng } from "../core/rng";
import { encodeSituation, describeSituation } from "../core/situation";
import {
  applyAction,
  ACTION_NAMES,
  NUM_ACTIONS,
  type Robby,
} from "../core/actions";

const CELL = 33;
const N = 10;
const SEED = 4242;

interface Snapshot {
  cells: Uint8Array;
  row: number;
  col: number;
  score: number;
}

let grid: Grid;
let robby: Robby;
let score: number;
let lastMsg: string;
const history: Snapshot[] = [];
const rng = makeRng(SEED + 1); // for RandomMove; not rewound by undo

function reset(): void {
  grid = placeCans(createGrid(N, N), 0.5, makeRng(SEED));
  robby = { row: 0, col: 0 };
  score = 0;
  lastMsg = "(no action yet)";
  history.length = 0;
  render();
}

function snapshot(): Snapshot {
  return {
    cells: grid.cells.slice(),
    row: robby.row,
    col: robby.col,
    score,
  };
}

function doAction(action: number): void {
  history.push(snapshot());
  const reward = applyAction(grid, robby, action, rng);
  score += reward;
  const sign = reward > 0 ? "+" : "";
  lastMsg = `${ACTION_NAMES[action]} -> reward ${sign}${reward}`;
  render();
}

function undo(): void {
  const prev = history.pop();
  if (!prev) {
    lastMsg = "(nothing to undo)";
    render();
    return;
  }
  grid.cells.set(prev.cells);
  robby.row = prev.row;
  robby.col = prev.col;
  score = prev.score;
  lastMsg = "(undid last action)";
  render();
}

function render(): void {
  const canvas = document.getElementById("step") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const fg = getComputedStyle(document.body).color;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const x = c * CELL;
      const y = r * CELL;
      ctx.strokeStyle = "gray";
      ctx.strokeRect(x, y, CELL, CELL);
      if (grid.cells[r * N + c] === CAN) {
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.fillStyle = "rgb(40,110,240)";
  ctx.fillRect(robby.col * CELL + 6, robby.row * CELL + 6, CELL - 12, CELL - 12);

  const s = sense(grid, robby.row, robby.col);
  const readout = document.getElementById("stepReadout") as HTMLElement;
  readout.innerHTML =
    `<strong>Score: ${score}</strong> &nbsp; last: ${lastMsg}<br>` +
    `Robby (${robby.row}, ${robby.col}) &nbsp; Situation #${encodeSituation(s)}<br>` +
    `<small style="opacity:0.75">${describeSituation(s)}</small>`;
}

function makeButton(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.fontSize = "0.8rem";
  b.style.padding = "0.35rem 0.5rem";
  b.style.cursor = "pointer";
  b.addEventListener("click", onClick);
  return b;
}

function setup(): void {
  const bar = document.getElementById("stepButtons") as HTMLElement;
  for (let a = 0; a < NUM_ACTIONS; a++) {
    bar.appendChild(makeButton(ACTION_NAMES[a], () => doAction(a)));
  }
  const undoBtn = makeButton("↶ Undo", undo);
  undoBtn.style.fontWeight = "bold";
  bar.appendChild(undoBtn);
  const resetBtn = makeButton("Reset", reset);
  bar.appendChild(resetBtn);
  reset();
}

setup();
