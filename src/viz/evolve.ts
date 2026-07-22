// Interactive teaching page (increment 6.3). Drives the REAL genetic algorithm
// one generation at a time so we can:
//   - play evolution continuously (or +100 at a time) and watch a live replica
//     of the book's Figure 9.6 (best fitness vs generation) draw itself;
//   - trace any strategy (Manual M, the current champion, best-ever, a random
//     walk, ...) over a full 200-step session on a grid;
//   - read a few insight metrics (population diversity, and how many of the key
//     "can-here -> PickUp" genes the champion has actually learned).
//
// It uses the same core functions as the GA itself (evaluatePopulation,
// nextGeneration, ...), so nothing here is a re-implementation — it's the engine
// stepped by hand with the intermediate state exposed.

import { createGrid, placeCans, sense, CAN, type Grid } from "../core/world";
import { makeRng, type Rng } from "../core/rng";
import { encodeSituation, decodeSituation, NUM_SITUATIONS } from "../core/situation";
import { ACTION_NAMES, PICK_UP, RANDOM_MOVE, REWARD_PICKUP } from "../core/actions";
import {
  manualStrategy,
  randomStrategy,
  uniformStrategy,
  type Strategy,
} from "../core/strategy";
import { traceSession, type SessionStep } from "../core/eval";
import {
  randomPopulation,
  evaluatePopulation,
  nextGeneration,
  DEFAULT_POPULATION_SIZE,
  DEFAULT_MUTATION_RATE,
  DEFAULT_TOURNAMENT_K,
} from "../core/ga";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const N = 10; // grid is 10x10
const STEPS = 200; // actions per cleaning session
const CELL = 30;
const M_FITNESS = 346; // Mitchell's hand-designed strategy, for a reference line
const MAX_FITNESS = 500; // practical ceiling, for a reference line
const MAX_GEN = 1000; // "Play evolution" runs to here (matches Figure 9.6's x-axis)

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function argmax(xs: number[]): number {
  let bi = 0;
  for (let i = 1; i < xs.length; i++) if (xs[i] > xs[bi]) bi = i;
  return bi;
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// ===========================================================================
// PART 1 — the genetic algorithm, stepped one generation at a time
// ===========================================================================

interface GenPoint {
  generation: number;
  best: number;
  avg: number;
}

let gaRng: Rng;
let population: Strategy[];
let generation = 0;
let history: GenPoint[] = [];
let champion: Strategy; // best individual of the most recently evaluated generation
let championFitness = -Infinity;
let bestEver: Strategy;
let bestEverFitness = -Infinity;
let bestEverGen = 0;

// tunables (read from the UI)
let popSize = DEFAULT_POPULATION_SIZE;
let mutationRate = DEFAULT_MUTATION_RATE;
let tournamentK = DEFAULT_TOURNAMENT_K;
let numSessions = 100;

let running = false;
let target = 0; // evolve until generation === target
// Every loop chain carries the token it was born with; only the current token is
// allowed to run. Starting a run (or a reset) bumps the token, so any older chain
// still holding a pending setTimeout dies on its next tick instead of racing.
let loopToken = 0;

function resetRun(seed: number): void {
  running = false;
  loopToken++; // orphan any in-flight loop
  target = 0;
  gaRng = makeRng(seed);
  population = randomPopulation(popSize, gaRng);
  generation = 0;
  history = [];
  bestEverFitness = -Infinity;
  championFitness = -Infinity;
  evaluateCurrent(); // seed generation 0 so there is a champion + first plot point
  renderAll();
  updateRunControls();
}

/** Evaluate the current population, record the point, and update champions. */
function evaluateCurrent(): void {
  const fitnesses = evaluatePopulation(population, gaRng, { numSessions });
  const bi = argmax(fitnesses);
  history.push({ generation, best: fitnesses[bi], avg: mean(fitnesses) });
  champion = population[bi].slice();
  championFitness = fitnesses[bi];
  if (fitnesses[bi] > bestEverFitness) {
    bestEverFitness = fitnesses[bi];
    bestEver = population[bi].slice();
    bestEverGen = generation;
  }
  lastFitnesses = fitnesses;
}
let lastFitnesses: number[] = [];

/** One full GA step: breed the next generation, then evaluate it. */
function stepOneGeneration(): void {
  population = nextGeneration(population, lastFitnesses, mutationRate, gaRng, tournamentK);
  generation++;
  evaluateCurrent();
}

/** Async evolution loop: one generation per tick, yielding so the UI/plot stay live. */
function loop(token: number): void {
  if (!running || token !== loopToken) return; // paused, or superseded by a newer run
  if (generation >= target) {
    running = false;
    updateRunControls();
    renderTracePanelIfTracking();
    return;
  }
  stepOneGeneration();
  renderPlot();
  renderStats();
  setTimeout(() => loop(token), 0);
}

/** Start (or, if already running, extend) the single active loop chain. */
function startLoop(): void {
  running = true;
  updateRunControls();
  const token = ++loopToken; // supersede any older chain
  loop(token);
}

function evolveBy(n: number): void {
  target = (running ? target : generation) + n;
  if (!running) startLoop();
}

/** The "Play evolution" toggle: run continuously to MAX_GEN, or pause. */
function toggleRun(): void {
  if (running) {
    running = false; // the current loop bails on its next tick
    updateRunControls();
    renderTracePanelIfTracking();
    return;
  }
  target = generation < MAX_GEN ? MAX_GEN : generation + MAX_GEN;
  startLoop();
}

// ===========================================================================
// PART 2 — insight metrics on the current population / champion
// ===========================================================================

/** Number of genuinely distinct genomes in the population. */
function distinctCount(pop: Strategy[]): number {
  const seen = new Set<string>();
  for (const g of pop) seen.add(g.join(","));
  return seen.size;
}

// A dedicated RNG for the diversity sample. It MUST be independent of gaRng —
// drawing from the GA's own stream here would consume random numbers meant for
// selection/mutation and silently alter (and de-sync) the evolution.
const metricRng = makeRng(0xd15);

/** Estimated mean pairwise Hamming distance (fraction of differing genes). */
function meanHamming(pop: Strategy[], rng: Rng, samples = 400): number {
  const n = pop.length;
  let total = 0;
  for (let s = 0; s < samples; s++) {
    const a = pop[Math.floor(rng() * n)];
    const b = pop[Math.floor(rng() * n)];
    let diff = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
    total += diff / a.length;
  }
  return total / samples;
}

// The 81 situations in which Robby is standing ON a can: the correct action is
// always PickUp. How many of those genes the champion gets right is a direct
// readout of whether evolution has discovered the single most important rule.
const CAN_HERE_SITUATIONS: number[] = (() => {
  const out: number[] = [];
  for (let i = 0; i < NUM_SITUATIONS; i++) {
    if (decodeSituation(i).current === CAN) out.push(i);
  }
  return out;
})();

function pickUpGeneScore(s: Strategy): number {
  let ok = 0;
  for (const i of CAN_HERE_SITUATIONS) if (s[i] === PICK_UP) ok++;
  return ok; // out of CAN_HERE_SITUATIONS.length (81)
}

// ===========================================================================
// PART 3 — the live Figure 9.6 plot
// ===========================================================================

function renderPlot(): void {
  const canvas = $("plot") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const fg = getComputedStyle(document.body).color;
  const W = canvas.width;
  const H = canvas.height;
  const padL = 52;
  const padB = 34;
  const padT = 14;
  const padR = 14;
  ctx.clearRect(0, 0, W, H);

  const xMax = Math.max(1000, generation);
  let yMin = -100;
  let yMax = MAX_FITNESS;
  for (const p of history) {
    if (p.avg < yMin) yMin = p.avg;
    if (p.best > yMax) yMax = p.best;
  }
  yMin = Math.floor(yMin / 100) * 100;

  const xAt = (g: number) => padL + (g / xMax) * (W - padL - padR);
  const yAt = (v: number) => H - padB - ((v - yMin) / (yMax - yMin)) * (H - padT - padB);

  // gridlines + y labels every 100
  ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "right";
  for (let v = yMin; v <= yMax; v += 100) {
    ctx.strokeStyle = v === 0 ? "rgba(128,128,128,0.55)" : "rgba(128,128,128,0.18)";
    ctx.beginPath();
    ctx.moveTo(padL, yAt(v));
    ctx.lineTo(W - padR, yAt(v));
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.fillText(String(v), padL - 6, yAt(v) + 4);
  }

  // reference lines: M and max
  const refLine = (v: number, color: string, label: string) => {
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, yAt(v));
    ctx.lineTo(W - padR, yAt(v));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "left";
    ctx.fillStyle = color;
    ctx.fillText(label, padL + 6, yAt(v) - 4);
    ctx.textAlign = "right";
  };
  refLine(M_FITNESS, "rgba(210,120,20,0.9)", `M ≈ ${M_FITNESS}`);
  if (yMax >= MAX_FITNESS) refLine(MAX_FITNESS, "rgba(128,128,128,0.6)", `max ≈ ${MAX_FITNESS}`);

  // x axis labels
  ctx.textAlign = "center";
  ctx.fillStyle = fg;
  for (let g = 0; g <= xMax; g += xMax <= 1000 ? 200 : Math.ceil(xMax / 5 / 100) * 100) {
    ctx.fillText(String(g), xAt(g), H - padB + 16);
  }
  ctx.fillText("Generation", (padL + W - padR) / 2, H - 4);

  // y axis title
  ctx.save();
  ctx.translate(12, (padT + H - padB) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Best fitness in population", 0, 0);
  ctx.restore();
  ctx.textAlign = "left";

  const curve = (key: "best" | "avg", color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    history.forEach((p, i) => {
      const x = xAt(p.generation);
      const y = yAt(p[key]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.lineWidth = 1;
  };
  curve("avg", "rgba(128,128,128,0.75)", 1.5);
  curve("best", "rgb(40,110,240)", 2);

  // legend
  ctx.textAlign = "left";
  ctx.fillStyle = "rgb(40,110,240)";
  ctx.fillText("● best", W - padR - 120, padT + 10);
  ctx.fillStyle = "rgba(128,128,128,0.9)";
  ctx.fillText("● population average", W - padR - 120, padT + 26);
}

let advancedMetrics = false;

function renderStats(): void {
  const latest = history[history.length - 1];
  $("stats").innerHTML =
    `<b>generation ${generation}</b>` +
    ` &nbsp; best <b>${latest.best.toFixed(0)}</b>` +
    ` &nbsp; avg ${latest.avg.toFixed(0)}` +
    ` &nbsp; best-ever <b>${bestEverFitness.toFixed(0)}</b> (gen ${bestEverGen})`;
  renderAdvancedStats();
}

/** The opt-in diagnostic line: only computed and shown when the user asks for it. */
function renderAdvancedStats(): void {
  const box = $("advancedStats");
  box.style.display = advancedMetrics ? "block" : "none";
  if (!advancedMetrics) return;
  const distinct = distinctCount(population);
  const ham = meanHamming(population, metricRng);
  const pick = pickUpGeneScore(champion);
  box.innerHTML =
    `<span class="dim">diversity:</span> ${distinct}/${popSize} distinct genomes,` +
    ` mean pairwise difference ${(ham * 100).toFixed(0)}% of genes` +
    ` &nbsp;·&nbsp; <span class="dim">champion's “pick up the can” genes:</span> ` +
    `<b>${pick}/${CAN_HERE_SITUATIONS.length}</b> correct`;
}

// ===========================================================================
// PART 4 — trace a chosen strategy over one full session
// ===========================================================================

const RANDOM_STRAT = "Random strategy";
const CHAMPION = "Champion (latest gen)";
const BEST_EVER = "Best-ever";

const TRACE_STRATEGIES: { name: string; make: () => Strategy }[] = [
  { name: CHAMPION, make: () => champion.slice() },
  { name: BEST_EVER, make: () => bestEver.slice() },
  { name: "Manual (M)", make: () => manualStrategy() },
  { name: "Random walk", make: () => uniformStrategy(RANDOM_MOVE) },
  { name: RANDOM_STRAT, make: () => randomStrategy(makeRng(randomStratSeed)) },
];

let traceSeed = 2024;
let randomStratSeed = 1;
let traceIndex = 0;
let grid0: Grid;
let traced: Strategy;
let trace: SessionStep[] = [];
let step = 0;
let traceTimer: number | undefined;
let genomeVisible = false;
const geneCells: HTMLSpanElement[] = [];
let lastHl = -1;

/** Rebuild the trace for the selected strategy on the current grid seed. */
function rebuildTrace(): void {
  stopTrace();
  grid0 = placeCans(createGrid(N, N), 0.5, makeRng(traceSeed));
  traced = TRACE_STRATEGIES[traceIndex].make();
  const g: Grid = { rows: N, cols: N, cells: grid0.cells.slice() };
  trace = traceSession(traced, g, makeRng(traceSeed + 1), STEPS);
  step = 0;
  updateGenomeDigits();
  renderTrace();
}

/** If the user is watching a live-updating strategy, refresh it after evolving. */
function renderTracePanelIfTracking(): void {
  const name = TRACE_STRATEGIES[traceIndex].name;
  if (name === CHAMPION || name === BEST_EVER) rebuildTrace();
}

function robbyAt(): { row: number; col: number } {
  if (step === 0) return { row: 0, col: 0 };
  const s = trace[step - 1];
  return { row: s.row, col: s.col };
}

function cansAtStep(): Uint8Array {
  const cells = grid0.cells.slice();
  for (let j = 0; j < step; j++) {
    const s = trace[j];
    if (s.action === PICK_UP && s.reward === REWARD_PICKUP) cells[s.row * N + s.col] = 0;
  }
  return cells;
}

function drawWorld(): void {
  const canvas = $("world") as HTMLCanvasElement;
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
        ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, CELL * 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // trail
  ctx.strokeStyle = "rgba(40,110,240,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CELL / 2, CELL / 2);
  for (let j = 0; j < step; j++) {
    ctx.lineTo(trace[j].col * CELL + CELL / 2, trace[j].row * CELL + CELL / 2);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  // robby
  const { row, col } = robbyAt();
  ctx.fillStyle = "rgba(40,110,240,0.45)";
  ctx.fillRect(col * CELL + 3, row * CELL + 3, CELL - 6, CELL - 6);
  ctx.strokeStyle = "rgb(40,110,240)";
  ctx.lineWidth = 3;
  ctx.strokeRect(col * CELL + 3, row * CELL + 3, CELL - 6, CELL - 6);
  ctx.lineWidth = 1;
}

function drawScore(): void {
  const canvas = $("score") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const fg = getComputedStyle(document.body).color;
  const W = canvas.width;
  const H = canvas.height;
  const padL = 40;
  const padB = 20;
  const padT = 10;
  const padR = 10;
  ctx.clearRect(0, 0, W, H);
  let yMin = 0;
  let yMax = 0;
  for (const s of trace) {
    if (s.cumulative < yMin) yMin = s.cumulative;
    if (s.cumulative > yMax) yMax = s.cumulative;
  }
  if (yMax === yMin) yMax = yMin + 1;
  const xAt = (i: number) => padL + (i / STEPS) * (W - padL - padR);
  const yAt = (v: number) => H - padB - ((v - yMin) / (yMax - yMin)) * (H - padT - padB);
  ctx.strokeStyle = "rgba(128,128,128,0.6)";
  ctx.beginPath();
  ctx.moveTo(padL, yAt(0));
  ctx.lineTo(W - padR, yAt(0));
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillText(String(yMax), 4, yAt(yMax) + 4);
  ctx.fillText(String(yMin), 4, yAt(yMin) + 4);
  const plot = (upTo: number, style: string, width: number) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(0));
    for (let i = 0; i < upTo; i++) ctx.lineTo(xAt(i + 1), yAt(trace[i].cumulative));
    ctx.stroke();
    ctx.lineWidth = 1;
  };
  plot(STEPS, "rgba(128,128,128,0.35)", 1);
  plot(step, "rgb(40,110,240)", 2);
}

function currentSituation(): number {
  const gridNow: Grid = { rows: N, cols: N, cells: cansAtStep() };
  const { row, col } = robbyAt();
  return encodeSituation(sense(gridNow, row, col));
}

function updateGenomeDigits(): void {
  if (geneCells.length === 0) return;
  for (let i = 0; i < NUM_SITUATIONS; i++) geneCells[i].textContent = String(traced[i]);
}

function updateGenomeHighlight(): void {
  if (!genomeVisible || geneCells.length === 0) return;
  const situ = currentSituation();
  if (lastHl >= 0) geneCells[lastHl].classList.remove("hl");
  geneCells[situ].classList.add("hl");
  lastHl = situ;
  $("genomeReadout").innerHTML =
    `situation <strong>#${situ}</strong> → <strong>${ACTION_NAMES[traced[situ]]}</strong>`;
}

function renderTrace(): void {
  drawWorld();
  drawScore();
  updateGenomeHighlight();
  const cum = step === 0 ? 0 : trace[step - 1].cumulative;
  let name = TRACE_STRATEGIES[traceIndex].name;
  if (name === RANDOM_STRAT) name += ` #${randomStratSeed}`;
  if (name === CHAMPION) name += ` — gen ${generation}, fit ${championFitness.toFixed(0)}`;
  if (name === BEST_EVER) name += ` — gen ${bestEverGen}, fit ${bestEverFitness.toFixed(0)}`;
  $("traceReadout").innerHTML =
    `${name}<br>step ${step} / ${STEPS} &nbsp; <strong>score ${cum}</strong>`;
  document.querySelectorAll("#traceButtons button").forEach((b, i) => {
    b.classList.toggle("active", i === traceIndex);
  });
}

function stopTrace(): void {
  if (traceTimer !== undefined) {
    clearInterval(traceTimer);
    traceTimer = undefined;
  }
  $("play").textContent = "▶ Play";
}

function playTrace(): void {
  if (step >= STEPS) step = 0;
  const fps = Number(($("speed") as HTMLInputElement).value);
  traceTimer = window.setInterval(() => {
    if (step >= STEPS) {
      stopTrace();
      return;
    }
    step++;
    renderTrace();
  }, 1000 / fps);
  $("play").textContent = "⏸ Pause";
}

// ===========================================================================
// PART 5 — wiring
// ===========================================================================

function renderAll(): void {
  renderPlot();
  renderStats();
  rebuildTrace();
}

/** Size the Figure-9.6 canvas to its container (keeps it crisp and responsive). */
function fitPlot(): void {
  const canvas = $("plot") as HTMLCanvasElement;
  const wrap = canvas.parentElement!;
  const w = Math.max(300, Math.floor(wrap.clientWidth));
  const h = Math.round(Math.min(420, Math.max(280, w * 0.46)));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  renderPlot();
}

function updateRunControls(): void {
  const busy = running;
  // A fresh run wipes the population, so those are disabled while evolving.
  ["reseed", "apply"].forEach((id) => (($(id) as HTMLButtonElement).disabled = busy));
  $("runPause").textContent = busy ? `⏸ Pause (→ gen ${target})` : "▶ Play evolution";
}

function readTunables(): void {
  const num = (id: string, fallback: number) => {
    const v = Number(($(id) as HTMLInputElement).value);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  popSize = Math.round(num("popSize", DEFAULT_POPULATION_SIZE));
  numSessions = Math.round(num("numSessions", 100));
  // The input is a percentage (0.5 means 0.5% per gene); the GA wants a fraction.
  mutationRate = num("mutationRate", DEFAULT_MUTATION_RATE * 100) / 100;
  tournamentK = Math.round(num("tournamentK", DEFAULT_TOURNAMENT_K));
}

function setup(): void {
  // trace strategy buttons
  const bar = $("traceButtons");
  TRACE_STRATEGIES.forEach((s, i) => {
    const b = document.createElement("button");
    b.textContent = s.name === RANDOM_STRAT ? "Random strategy ⟳" : s.name;
    b.addEventListener("click", () => {
      if (s.name === RANDOM_STRAT) randomStratSeed++;
      traceIndex = i;
      rebuildTrace();
    });
    bar.appendChild(b);
  });

  // genome cells
  const gg = $("genomeGrid");
  for (let i = 0; i < NUM_SITUATIONS; i++) {
    const span = document.createElement("span");
    span.title = `situation #${i}`;
    geneCells.push(span);
    gg.appendChild(span);
  }
  const genomePanel = $("genomePanel");
  const toggle = $("toggleGenome") as HTMLButtonElement;
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

  // advanced-metrics toggle (progressive disclosure of the diagnostic line)
  const advToggle = $("advancedToggle") as HTMLInputElement;
  advToggle.addEventListener("change", () => {
    advancedMetrics = advToggle.checked;
    renderAdvancedStats();
  });

  // evolution controls
  $("evolve100").addEventListener("click", () => evolveBy(100));
  $("runPause").addEventListener("click", toggleRun);
  $("reseed").addEventListener("click", () => {
    readTunables();
    resetRun(Math.floor(Math.random() * 1e6));
  });
  const applyBtn = $("apply") as HTMLButtonElement;
  let applyFeedbackTimer: number | undefined;
  applyBtn.addEventListener("click", () => {
    readTunables();
    resetRun(1);
    // Feedback: acknowledge that the settings were applied and evolution restarted.
    if (applyFeedbackTimer !== undefined) clearTimeout(applyFeedbackTimer);
    applyBtn.textContent = "✓ Applied";
    applyFeedbackTimer = window.setTimeout(() => {
      applyBtn.textContent = "Apply settings";
      applyFeedbackTimer = undefined;
    }, 1300);
  });

  // trace controls
  $("newGrid").addEventListener("click", () => {
    traceSeed = Math.floor(Math.random() * 1e6);
    rebuildTrace();
  });
  $("play").addEventListener("click", () => {
    if (traceTimer === undefined) playTrace();
    else stopTrace();
  });
  $("stepFwd").addEventListener("click", () => {
    stopTrace();
    if (step < STEPS) step++;
    renderTrace();
  });
  $("stepBack").addEventListener("click", () => {
    stopTrace();
    if (step > 0) step--;
    renderTrace();
  });
  $("resetTrace").addEventListener("click", () => {
    stopTrace();
    step = 0;
    renderTrace();
  });
  const speed = $("speed") as HTMLInputElement;
  const speedLabel = $("speedLabel");
  const upd = () => (speedLabel.textContent = `${speed.value} steps/s`);
  speed.addEventListener("input", () => {
    upd();
    if (traceTimer !== undefined) {
      stopTrace();
      playTrace();
    }
  });
  upd();

  // Some browsers (Firefox especially) restore previously entered form values on
  // reload, ignoring the HTML `value` attributes — and since the settings fields
  // sit in different DOM positions, the restored numbers can land in the WRONG
  // inputs (e.g. mutation rate showing 3, diversity exposure showing 0.5). Force
  // each field back to its declared default so a reload always starts from
  // Mitchell's defaults. `defaultValue` reflects the HTML attribute, which the
  // browser never overwrites.
  ["popSize", "numSessions", "mutationRate", "tournamentK"].forEach((id) => {
    const el = $(id) as HTMLInputElement;
    el.value = el.defaultValue;
  });

  readTunables();
  resetRun(1);
  fitPlot();
  window.addEventListener("resize", fitPlot);
}

setup();
