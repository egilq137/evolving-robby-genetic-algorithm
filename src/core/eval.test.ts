import { describe, it, expect } from "vitest";
import { createGrid, placeCans, sense, index, CAN } from "./world";
import {
  MOVE_EAST,
  STAY_PUT,
  PICK_UP,
  RANDOM_MOVE,
} from "./actions";
import { uniformStrategy, type Strategy } from "./strategy";
import { encodeSituation } from "./situation";
import { runSession, computeFitness, traceSession } from "./eval";
import { makeRng } from "./rng";

const rng = () => 0; // deterministic stand-in; unused by non-random strategies

describe("runSession - scores we can compute by hand", () => {
  it("all-StayPut scores exactly 0 on any grid (Robby never moves or picks up)", () => {
    const grid = placeCans(createGrid(10, 10), 0.5, makeRng(1));
    expect(runSession(uniformStrategy(STAY_PUT), grid, rng, 200)).toBe(0);
  });

  it("all-PickUp on an EMPTY start cell scores -1 per action", () => {
    const empty = createGrid(10, 10); // (0,0) empty
    expect(runSession(uniformStrategy(PICK_UP), empty, rng, 1)).toBe(-1);
    expect(runSession(uniformStrategy(PICK_UP), createGrid(10, 10), rng, 10)).toBe(-10);
    expect(runSession(uniformStrategy(PICK_UP), createGrid(10, 10), rng, 200)).toBe(-200);
  });

  it("all-PickUp with a can at (0,0): +10 once, then -1 for 199 empties = -189", () => {
    const grid = createGrid(10, 10);
    grid.cells[index(grid, 0, 0)] = CAN; // a single can right under Robby
    expect(runSession(uniformStrategy(PICK_UP), grid, rng, 200)).toBe(10 - 199);
  });

  it("all-MoveEast: 9 clear moves then 191 wall crashes = -955 (cans don't matter)", () => {
    // From col 0, east moves reach col 9 in 9 steps (reward 0), then every
    // further east move crashes into the east wall (-5). 191 * -5 = -955.
    const grid = placeCans(createGrid(10, 10), 0.5, makeRng(9));
    expect(runSession(uniformStrategy(MOVE_EAST), grid, rng, 200)).toBe(-955);
  });

  it("runs EXACTLY numActions steps (loop count is correct)", () => {
    // all-PickUp on empty gives -1 per action, so the score equals -numActions.
    // Note: use (0 - n) not (-n) so n=0 stays +0 (toBe uses Object.is, which
    // distinguishes -0 from +0).
    for (const n of [0, 1, 5, 37, 200]) {
      expect(runSession(uniformStrategy(PICK_UP), createGrid(10, 10), rng, n)).toBe(0 - n);
    }
  });
});

describe("runSession - a pickup mid-session is counted, loop continues correctly", () => {
  it("pick up the one can, then StayPut forever => +10 total", () => {
    // Grid with a single can at (0,0). Strategy: StayPut everywhere EXCEPT the
    // exact situation Robby sees at (0,0)-with-a-can, where he picks up.
    const grid = createGrid(10, 10);
    grid.cells[index(grid, 0, 0)] = CAN;
    const strat: Strategy = uniformStrategy(STAY_PUT);
    const situ = encodeSituation(sense(grid, 0, 0)); // (0,0) currently holds a can
    strat[situ] = PICK_UP;
    // Action 1: PickUp (+10, can removed). Now (0,0) is empty -> a DIFFERENT
    // situation whose gene is StayPut, so actions 2..200 score 0.
    expect(runSession(strat, grid, rng, 200)).toBe(10);
  });
});

describe("runSession - does not mutate the strategy", () => {
  it("leaves the strategy array unchanged", () => {
    const strat = uniformStrategy(STAY_PUT);
    const copy = Int8Array.from(strat);
    runSession(strat, placeCans(createGrid(10, 10), 0.5, makeRng(3)), rng, 200);
    expect(Array.from(strat)).toEqual(Array.from(copy));
  });
});

describe("traceSession", () => {
  it("records exactly numActions steps", () => {
    const grid = placeCans(createGrid(10, 10), 0.5, makeRng(1));
    expect(traceSession(uniformStrategy(STAY_PUT), grid, rng, 200).length).toBe(200);
  });

  it("its final cumulative score equals runSession's score (same grid & rng)", () => {
    const strat = uniformStrategy(RANDOM_MOVE);
    // Two identical fresh setups: one traced, one run.
    const gA = placeCans(createGrid(10, 10), 0.5, makeRng(7));
    const gB = placeCans(createGrid(10, 10), 0.5, makeRng(7));
    const trace = traceSession(strat, gA, makeRng(99), 200);
    const score = runSession(strat, gB, makeRng(99), 200);
    expect(trace[trace.length - 1].cumulative).toBe(score);
  });

  it("cumulative is the running sum of rewards", () => {
    const grid = placeCans(createGrid(10, 10), 0.5, makeRng(3));
    const trace = traceSession(uniformStrategy(RANDOM_MOVE), grid, makeRng(5), 50);
    let acc = 0;
    for (const step of trace) {
      acc += step.reward;
      expect(step.cumulative).toBe(acc);
    }
  });

  it("all-StayPut: Robby stays at (0,0) with score 0 the whole time", () => {
    const grid = placeCans(createGrid(10, 10), 0.5, makeRng(2));
    const trace = traceSession(uniformStrategy(STAY_PUT), grid, rng, 10);
    for (const step of trace) {
      expect(step.row).toBe(0);
      expect(step.col).toBe(0);
      expect(step.cumulative).toBe(0);
    }
  });
});

describe("computeFitness - averaging", () => {
  it("all-StayPut has fitness exactly 0", () => {
    expect(
      computeFitness(uniformStrategy(STAY_PUT), makeRng(1), { numSessions: 20 }),
    ).toBe(0);
  });

  it("all-MoveEast has fitness exactly -955 (every session is -955, so the average is too)", () => {
    // This checks the averaging: sum of identical -955 values / N = -955.
    expect(
      computeFitness(uniformStrategy(MOVE_EAST), makeRng(1), { numSessions: 10 }),
    ).toBe(-955);
  });

  it("respects numActions and numSessions options", () => {
    // Force EMPTY grids (canProb 0) so all-PickUp scores exactly -numActions
    // every session, isolating the numActions/numSessions wiring.
    const fit = computeFitness(uniformStrategy(PICK_UP), makeRng(1), {
      canProb: 0,
      numActions: 50,
      numSessions: 7,
    });
    expect(fit).toBe(-50);
  });
});

describe("computeFitness - reproducibility", () => {
  it("same seed => same fitness, even with a RandomMove strategy", () => {
    const strat = uniformStrategy(RANDOM_MOVE);
    const a = computeFitness(strat, makeRng(2024), { numSessions: 30 });
    const b = computeFitness(strat, makeRng(2024), { numSessions: 30 });
    expect(a).toBe(b);
  });

  it("different seeds => generally different fitness for a random strategy", () => {
    const strat = uniformStrategy(RANDOM_MOVE);
    const a = computeFitness(strat, makeRng(1), { numSessions: 30 });
    const b = computeFitness(strat, makeRng(2), { numSessions: 30 });
    expect(a).not.toBe(b);
  });
});
