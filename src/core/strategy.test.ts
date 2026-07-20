import { describe, it, expect } from "vitest";
import { EMPTY, CAN, WALL, type Senses } from "./world";
import { NUM_SITUATIONS } from "./situation";
import {
  MOVE_NORTH,
  MOVE_SOUTH,
  MOVE_EAST,
  MOVE_WEST,
  PICK_UP,
  RANDOM_MOVE,
  NUM_ACTIONS,
} from "./actions";
import {
  actionFor,
  uniformStrategy,
  manualAction,
  manualStrategy,
} from "./strategy";
import { computeFitness } from "./eval";
import { makeRng } from "./rng";

const s = (partial: Partial<Senses>): Senses => ({
  current: EMPTY,
  north: EMPTY,
  south: EMPTY,
  east: EMPTY,
  west: EMPTY,
  ...partial,
});

describe("uniformStrategy", () => {
  it("returns a length-243 genome filled with the chosen action", () => {
    const st = uniformStrategy(PICK_UP);
    expect(st.length).toBe(NUM_SITUATIONS);
    expect(Array.from(st).every((a) => a === PICK_UP)).toBe(true);
  });
});

describe("manualAction - Mitchell's rules", () => {
  it("picks up when standing on a can, regardless of neighbors", () => {
    expect(manualAction(s({ current: CAN }))).toBe(PICK_UP);
    expect(manualAction(s({ current: CAN, north: CAN, east: CAN }))).toBe(PICK_UP);
  });

  it("moves toward a lone adjacent can (each direction)", () => {
    expect(manualAction(s({ north: CAN }))).toBe(MOVE_NORTH);
    expect(manualAction(s({ south: CAN }))).toBe(MOVE_SOUTH);
    expect(manualAction(s({ east: CAN }))).toBe(MOVE_EAST);
    expect(manualAction(s({ west: CAN }))).toBe(MOVE_WEST);
  });

  it("random-moves when there is no can in sight", () => {
    expect(manualAction(s({}))).toBe(RANDOM_MOVE);
  });

  it("treats walls as NOT cans (a surrounding of walls still random-moves)", () => {
    expect(manualAction(s({ north: WALL, west: WALL }))).toBe(RANDOM_MOVE);
  });

  it("tie-break priority is North > South > East > West", () => {
    expect(manualAction(s({ north: CAN, south: CAN, east: CAN, west: CAN }))).toBe(MOVE_NORTH);
    expect(manualAction(s({ south: CAN, east: CAN, west: CAN }))).toBe(MOVE_SOUTH);
    expect(manualAction(s({ east: CAN, west: CAN }))).toBe(MOVE_EAST);
    expect(manualAction(s({ west: CAN }))).toBe(MOVE_WEST);
  });
});

describe("manualStrategy - compiled genome", () => {
  it("is a valid length-243 genome with only actions 0..6", () => {
    const st = manualStrategy();
    expect(st.length).toBe(NUM_SITUATIONS);
    expect(Array.from(st).every((a) => a >= 0 && a < NUM_ACTIONS)).toBe(true);
  });

  it("the compiled genome agrees with manualAction for sampled situations", () => {
    const st = manualStrategy();
    const samples: Senses[] = [
      s({ current: CAN }),
      s({ north: CAN, south: CAN }),
      s({ east: CAN }),
      s({ north: WALL, west: WALL }),
      s({}),
    ];
    for (const senses of samples) {
      expect(actionFor(st, senses)).toBe(manualAction(senses));
    }
  });
});

describe("manualStrategy - fitness matches the book (~346)", () => {
  it("scores in the ballpark of Mitchell's reported ~346", () => {
    // Book: M averages ~346 over 10,000 sessions. We use a large, seeded sample
    // for a stable estimate and allow a generous band around 346.
    const fit = computeFitness(manualStrategy(), makeRng(12345), {
      numSessions: 2000,
    });
    expect(fit).toBeGreaterThan(300);
    expect(fit).toBeLessThan(400);
  });
});
