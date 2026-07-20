// Session trace: run one strategy for a full 200-step session and let the user
// scrub through it, watching Robby move and the cumulative score climb. Uses the
// real traceSession so the replay is exactly what the engine produced.

import { createGrid, placeCans, sense, CAN, type Grid } from "../core/world";
import { makeRng } from "../core/rng";
import { encodeSituation, NUM_SITUATIONS } from "../core/situation";
import {
  ACTION_NAMES,
  PICK_UP,
  MOVE_EAST,
  RANDOM_MOVE,
  REWARD_PICKUP,
} from "../core/actions";
import {
  manualStrategy,
  randomStrategy,
  uniformStrategy,
  type Strategy,
} from "../core/strategy";
import { traceSession, type SessionStep } from "../core/eval";

const CELL = 33;
const N = 10;
const STEPS = 200;

const RANDOM_STRATEGY = "Random strategy";

// Note: a "random strategy" is a fixed table of random actions -> deterministic
// per situation, so it often self-traps (StayPut/wall-crash loop), matching the
// book. Each click re-rolls a NEW one (via randomStratSeed) so you can hunt for
// a more productive one. A "random walk" (all genes = RandomMove) re-rolls each
// step and actually wanders.
const STRATEGIES: { name: string; make: () => Strategy }[] = [
  { name: "Manual (M)", make: () => manualStrategy() },
  { name: RANDOM_STRATEGY, make: () => randomStrategy(makeRng(randomStratSeed)) },
  { name: "Random walk", make: () => uniformStrategy(RANDOM_MOVE) },
  { name: "All East", make: () => uniformStrategy(MOVE_EAST) },
];

let seed = 2024;
let randomStratSeed = 1; // advances each time "Random strategy" is clicked
let stratIndex = 0;
let grid0: Grid; // initial can layout (never mutated)
let currentStrategy: Strategy;
let trace: SessionStep[] = [];
let step = 0; // 0 = before any action; STEPS = finished
let timer: number | undefined;
let genomeVisible = false;
const geneCells: HTMLSpanElement[] = [];
let lastHl = -1;

function rebuild(): void {
  stopPlaying();
  grid0 = placeCans(createGrid(N, N), 0.5, makeRng(seed));
  currentStrategy = STRATEGIES[stratIndex].make();
  const traceGrid: Grid = {
    rows: N,
    cols: N,
    cells: grid0.cells.slice(),
  };
  trace = traceSession(currentStrategy, traceGrid, makeRng(seed + 1), STEPS);
  step = 0;
  updateGenomeDigits();
  render();
}

/** Robby's position at the current step (before step 0 he is at (0,0)). */
function robbyAt(): { row: number; col: number } {
  if (step === 0) return { row: 0, col: 0 };
  const s = trace[step - 1];
  return { row: s.row, col: s.col };
}

/** Reconstruct which cans remain after `step` actions. */
function cansAtStep(): Uint8Array {
  const cells = grid0.cells.slice();
  for (let j = 0; j < step; j++) {
    const s = trace[j];
    if (s.action === PICK_UP && s.reward === REWARD_PICKUP) {
      cells[s.row * N + s.col] = 0;
    }
  }
  return cells;
}

function drawGrid(): void {
  const canvas = document.getElementById("traceGrid") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const fg = getComputedStyle(document.body).color;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cans = cansAtStep();
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      ctx.strokeStyle = "gray";
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
      if (cans[r * N + c] === CAN) {
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, CELL * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Trail: line through visited cell centers up to the current step.
  ctx.strokeStyle = "rgba(40,110,240,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CELL / 2, CELL / 2); // start (0,0)
  for (let j = 0; j < step; j++) {
    ctx.lineTo(trace[j].col * CELL + CELL / 2, trace[j].row * CELL + CELL / 2);
  }
  ctx.stroke();
  ctx.lineWidth = 1;

  // Robby: translucent box + border so a can under him stays visible.
  const { row, col } = robbyAt();
  ctx.fillStyle = "rgba(40,110,240,0.45)";
  ctx.fillRect(col * CELL + 3, row * CELL + 3, CELL - 6, CELL - 6);
  ctx.strokeStyle = "rgb(40,110,240)";
  ctx.lineWidth = 3;
  ctx.strokeRect(col * CELL + 3, row * CELL + 3, CELL - 6, CELL - 6);
  ctx.lineWidth = 1;
}

function drawPlot(): void {
  const canvas = document.getElementById("scorePlot") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const fg = getComputedStyle(document.body).color;
  const W = canvas.width;
  const H = canvas.height;
  const padL = 44;
  const padB = 24;
  const padT = 12;
  const padR = 12;

  ctx.clearRect(0, 0, W, H);

  // y-range from the whole trace (always include 0).
  let yMin = 0;
  let yMax = 0;
  for (const s of trace) {
    if (s.cumulative < yMin) yMin = s.cumulative;
    if (s.cumulative > yMax) yMax = s.cumulative;
  }
  if (yMax === yMin) yMax = yMin + 1;

  const xAt = (i: number) => padL + (i / STEPS) * (W - padL - padR);
  const yAt = (v: number) =>
    H - padB - ((v - yMin) / (yMax - yMin)) * (H - padT - padB);

  // Axes + zero line.
  ctx.strokeStyle = "gray";
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, H - padB);
  ctx.lineTo(W - padR, H - padB);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(128,128,128,0.6)";
  ctx.beginPath();
  ctx.moveTo(padL, yAt(0));
  ctx.lineTo(W - padR, yAt(0));
  ctx.stroke();

  // Labels.
  ctx.fillStyle = fg;
  ctx.font = "11px ui-monospace, monospace";
  ctx.fillText(`${yMax}`, 4, yAt(yMax) + 4);
  ctx.fillText(`${yMin}`, 4, yAt(yMin) + 4);
  ctx.fillText("0", 4, yAt(0) + 4);
  ctx.fillText("step 0", padL, H - 8);
  ctx.fillText(`${STEPS}`, W - padR - 18, H - 8);

  // Full curve (faint), then the traversed portion (bold).
  const plotCurve = (upTo: number, style: string, width: number) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(0));
    for (let i = 0; i < upTo; i++) ctx.lineTo(xAt(i + 1), yAt(trace[i].cumulative));
    ctx.stroke();
    ctx.lineWidth = 1;
  };
  plotCurve(STEPS, "rgba(128,128,128,0.35)", 1);
  plotCurve(step, "rgb(40,110,240)", 2);

  // Marker at the current step.
  const cum = step === 0 ? 0 : trace[step - 1].cumulative;
  ctx.fillStyle = "rgb(40,110,240)";
  ctx.beginPath();
  ctx.arc(xAt(step), yAt(cum), 4, 0, Math.PI * 2);
  ctx.fill();
}

/** The situation Robby senses in the currently displayed state. */
function currentSituation(): number {
  const gridNow: Grid = { rows: N, cols: N, cells: cansAtStep() };
  const { row, col } = robbyAt();
  return encodeSituation(sense(gridNow, row, col));
}

function updateGenomeDigits(): void {
  if (geneCells.length === 0) return;
  for (let i = 0; i < NUM_SITUATIONS; i++) {
    geneCells[i].textContent = String(currentStrategy[i]);
  }
}

function updateGenomeHighlight(): void {
  if (!genomeVisible || geneCells.length === 0) return;
  const situ = currentSituation();
  if (lastHl >= 0) geneCells[lastHl].classList.remove("hl");
  geneCells[situ].classList.add("hl");
  lastHl = situ;
  const readout = document.getElementById("genomeReadout") as HTMLElement;
  readout.innerHTML =
    `current situation <strong>#${situ}</strong> -> gene = ` +
    `<strong>${ACTION_NAMES[currentStrategy[situ]]}</strong>`;
}

function render(): void {
  drawGrid();
  drawPlot();
  updateGenomeHighlight();
  const readout = document.getElementById("traceReadout") as HTMLElement;
  const cum = step === 0 ? 0 : trace[step - 1].cumulative;
  const last =
    step === 0
      ? "(start)"
      : `${ACTION_NAMES[trace[step - 1].action]} -> ${trace[step - 1].reward >= 0 ? "+" : ""}${trace[step - 1].reward}`;
  const stratName = STRATEGIES[stratIndex].name;
  const stratLabel =
    stratName === RANDOM_STRATEGY ? `${stratName} #${randomStratSeed}` : stratName;
  readout.innerHTML =
    `${stratLabel}<br>` +
    `step ${step} / ${STEPS} &nbsp; <strong>score ${cum}</strong> &nbsp; last: ${last}`;
  // Reflect strategy button state.
  document.querySelectorAll("#stratButtons button").forEach((b, i) => {
    b.classList.toggle("active", i === stratIndex);
  });
}

// --- controls ---------------------------------------------------------------

function stopPlaying(): void {
  if (timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
  const btn = document.getElementById("playPause");
  if (btn) btn.textContent = "▶ Play";
}

function play(): void {
  if (step >= STEPS) step = 0;
  const fps = Number((document.getElementById("speed") as HTMLInputElement).value);
  timer = window.setInterval(() => {
    if (step >= STEPS) {
      stopPlaying();
      return;
    }
    step++;
    render();
  }, 1000 / fps);
  const btn = document.getElementById("playPause")!;
  btn.textContent = "⏸ Pause";
}

function setup(): void {
  const bar = document.getElementById("stratButtons") as HTMLElement;
  STRATEGIES.forEach((s, i) => {
    const b = document.createElement("button");
    const isRandom = s.name === RANDOM_STRATEGY;
    b.textContent = isRandom ? "Random strategy ⟳" : s.name;
    if (isRandom) b.title = "click again to re-roll a new random strategy";
    b.addEventListener("click", () => {
      if (isRandom) randomStratSeed++; // re-roll on every click
      stratIndex = i;
      rebuild();
    });
    bar.appendChild(b);
  });

  // Build the 243 gene cells once.
  const grid = document.getElementById("genomeGrid") as HTMLElement;
  for (let i = 0; i < NUM_SITUATIONS; i++) {
    const span = document.createElement("span");
    span.title = `situation #${i}`;
    geneCells.push(span);
    grid.appendChild(span);
  }
  const genomePanel = document.getElementById("genomePanel") as HTMLElement;
  const toggle = document.getElementById("toggleGenome") as HTMLButtonElement;
  toggle.addEventListener("click", () => {
    genomeVisible = !genomeVisible;
    genomePanel.style.display = genomeVisible ? "block" : "none";
    toggle.textContent = genomeVisible ? "Hide genome" : "Show genome";
    if (genomeVisible) {
      lastHl = -1;
      updateGenomeDigits();
      updateGenomeHighlight();
    }
  });

  document.getElementById("newGrid")!.addEventListener("click", () => {
    seed = Math.floor(Math.random() * 1e6);
    rebuild();
  });
  document.getElementById("playPause")!.addEventListener("click", () => {
    if (timer === undefined) play();
    else stopPlaying();
  });
  document.getElementById("stepFwd")!.addEventListener("click", () => {
    stopPlaying();
    if (step < STEPS) step++;
    render();
  });
  document.getElementById("stepBack")!.addEventListener("click", () => {
    stopPlaying();
    if (step > 0) step--;
    render();
  });
  document.getElementById("reset")!.addEventListener("click", () => {
    stopPlaying();
    step = 0;
    render();
  });
  const speed = document.getElementById("speed") as HTMLInputElement;
  const speedLabel = document.getElementById("speedLabel") as HTMLElement;
  const updateSpeed = () => (speedLabel.textContent = `${speed.value} steps/s`);
  speed.addEventListener("input", () => {
    updateSpeed();
    if (timer !== undefined) {
      stopPlaying();
      play();
    }
  });
  updateSpeed();

  rebuild();
}

setup();
