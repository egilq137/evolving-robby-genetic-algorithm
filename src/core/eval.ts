// core/eval — running a cleaning session and computing a strategy's fitness.
// This is the "hot loop": fitness is where almost all compute time will go.
//
// A SESSION (spec Section 5): put Robby at (0,0) on a grid of cans, let him take
// `numActions` actions (each chosen by his strategy from what he senses), and
// score him by the rewards/penalties accumulated.
//
// FITNESS (spec Section 6): the AVERAGE session score over `numSessions`
// independent random grids. Averaging over many layouts stops a strategy from
// overfitting one lucky configuration.

import { createGrid, placeCans, sense, type Grid } from "./world";
import { applyAction } from "./actions";
import { actionFor, type Strategy } from "./strategy";
import type { Rng } from "./rng";

export const DEFAULT_ACTIONS_PER_SESSION = 200;
export const DEFAULT_SESSIONS_PER_FITNESS = 100;
export const DEFAULT_CAN_PROB = 0.5;

/**
 * Run one cleaning session on the given (already populated) grid and return the
 * session score. Robby always starts at (0,0). Mutates `grid` (cans get picked
 * up). `rng` is only consumed when the strategy uses RandomMove.
 */
export function runSession(
  strategy: Strategy,
  grid: Grid,
  rng: Rng,
  numActions: number = DEFAULT_ACTIONS_PER_SESSION,
): number {
  const robby = { row: 0, col: 0 };
  let score = 0;
  for (let i = 0; i < numActions; i++) {
    const senses = sense(grid, robby.row, robby.col);
    const action = actionFor(strategy, senses);
    score += applyAction(grid, robby, action, rng);
  }
  return score;
}

/** One recorded step of a session (Robby's position is AFTER the action). */
export interface SessionStep {
  action: number;
  reward: number;
  cumulative: number; // running score through this step
  row: number;
  col: number;
}

/**
 * Like runSession, but records every step so the whole session can be replayed
 * or plotted. Robby starts at (0,0) (implicitly, before step 0). Mutates `grid`.
 * The last step's `cumulative` equals runSession's returned score.
 */
export function traceSession(
  strategy: Strategy,
  grid: Grid,
  rng: Rng,
  numActions: number = DEFAULT_ACTIONS_PER_SESSION,
): SessionStep[] {
  const robby = { row: 0, col: 0 };
  const steps: SessionStep[] = [];
  let cumulative = 0;
  for (let i = 0; i < numActions; i++) {
    const senses = sense(grid, robby.row, robby.col);
    const action = actionFor(strategy, senses);
    const reward = applyAction(grid, robby, action, rng);
    cumulative += reward;
    steps.push({ action, reward, cumulative, row: robby.row, col: robby.col });
  }
  return steps;
}

export interface FitnessOptions {
  rows?: number;
  cols?: number;
  canProb?: number;
  numActions?: number;
  numSessions?: number;
}

/**
 * A strategy's fitness: the average session score over `numSessions` freshly
 * generated random grids. Uses the single provided `rng` for both can placement
 * and any RandomMove, so a fixed seed makes the whole computation reproducible.
 */
export function computeFitness(
  strategy: Strategy,
  rng: Rng,
  opts: FitnessOptions = {},
): number {
  const rows = opts.rows ?? 10;
  const cols = opts.cols ?? 10;
  const canProb = opts.canProb ?? DEFAULT_CAN_PROB;
  const numActions = opts.numActions ?? DEFAULT_ACTIONS_PER_SESSION;
  const numSessions = opts.numSessions ?? DEFAULT_SESSIONS_PER_FITNESS;

  let total = 0;
  for (let s = 0; s < numSessions; s++) {
    const grid = placeCans(createGrid(rows, cols), canProb, rng);
    total += runSession(strategy, grid, rng, numActions);
  }
  return total / numSessions;
}
