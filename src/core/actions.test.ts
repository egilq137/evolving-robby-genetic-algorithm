import { describe, it, expect } from "vitest";
import { createGrid, index, getCell, CAN, EMPTY } from "./world";
import {
  MOVE_NORTH,
  MOVE_SOUTH,
  MOVE_EAST,
  MOVE_WEST,
  STAY_PUT,
  PICK_UP,
  RANDOM_MOVE,
  REWARD_PICKUP,
  PENALTY_EMPTY_PICKUP,
  PENALTY_WALL,
  applyAction,
  type Robby,
} from "./actions";
import { makeRng } from "./rng";

// A dummy RNG for actions that don't use randomness. For RandomMove tests we
// pass a CONTROLLED rng so the chosen direction is deterministic:
//   floor(v*4): v=0 -> North, 0.25 -> South, 0.5 -> East, 0.75/0.9 -> West
const noRng = makeRng(0);
const fixed = (v: number) => () => v;

describe("PickUp scoring", () => {
  it("+10 and removes the can when standing on one", () => {
    const g = createGrid(10, 10);
    g.cells[index(g, 5, 5)] = CAN;
    const robby: Robby = { row: 5, col: 5 };
    const reward = applyAction(g, robby, PICK_UP, noRng);
    expect(reward).toBe(REWARD_PICKUP); // +10
    expect(getCell(g, 5, 5)).toBe(EMPTY); // can is gone
    expect(robby).toEqual({ row: 5, col: 5 }); // PickUp doesn't move
  });

  it("-1 and changes nothing when there is no can", () => {
    const g = createGrid(10, 10);
    const robby: Robby = { row: 5, col: 5 };
    const reward = applyAction(g, robby, PICK_UP, noRng);
    expect(reward).toBe(PENALTY_EMPTY_PICKUP); // -1
    expect(getCell(g, 5, 5)).toBe(EMPTY);
    expect(robby).toEqual({ row: 5, col: 5 });
  });
});

describe("directional moves into open cells (reward 0, correct direction)", () => {
  it.each([
    ["North", MOVE_NORTH, { row: 4, col: 5 }],
    ["South", MOVE_SOUTH, { row: 6, col: 5 }],
    ["East", MOVE_EAST, { row: 5, col: 6 }],
    ["West", MOVE_WEST, { row: 5, col: 4 }],
  ])("Move%s moves exactly one cell that way", (_name, action, expected) => {
    const g = createGrid(10, 10);
    const robby: Robby = { row: 5, col: 5 };
    const reward = applyAction(g, robby, action as number, noRng);
    expect(reward).toBe(0);
    expect(robby).toEqual(expected);
  });
});

describe("crashing into walls (-5, bounce back on all four edges)", () => {
  it.each([
    ["North edge", MOVE_NORTH, { row: 0, col: 5 }],
    ["South edge", MOVE_SOUTH, { row: 9, col: 5 }],
    ["East edge", MOVE_EAST, { row: 5, col: 9 }],
    ["West edge", MOVE_WEST, { row: 5, col: 0 }],
  ])("crashing %s fines -5 and does not move", (_name, action, start) => {
    const g = createGrid(10, 10);
    const robby: Robby = { ...(start as Robby) };
    const reward = applyAction(g, robby, action as number, noRng);
    expect(reward).toBe(PENALTY_WALL); // -5
    expect(robby).toEqual(start); // bounced back, unchanged
  });
});

describe("StayPut", () => {
  it("scores 0 and does not move", () => {
    const g = createGrid(10, 10);
    const robby: Robby = { row: 3, col: 7 };
    expect(applyAction(g, robby, STAY_PUT, noRng)).toBe(0);
    expect(robby).toEqual({ row: 3, col: 7 });
  });
});

describe("moving onto a can does NOT collect it (marker-trick foundation)", () => {
  it("reward 0, can remains, and a later PickUp gets it", () => {
    const g = createGrid(10, 10);
    g.cells[index(g, 5, 6)] = CAN; // a can to the east
    const robby: Robby = { row: 5, col: 5 };

    const moveReward = applyAction(g, robby, MOVE_EAST, noRng);
    expect(moveReward).toBe(0); // moving onto the can gives nothing
    expect(robby).toEqual({ row: 5, col: 6 });
    expect(getCell(g, 5, 6)).toBe(CAN); // can is still there

    const pickReward = applyAction(g, robby, PICK_UP, noRng);
    expect(pickReward).toBe(REWARD_PICKUP); // now +10
    expect(getCell(g, 5, 6)).toBe(EMPTY);
  });
});

describe("RandomMove (driven by a controlled RNG)", () => {
  it("maps rng values to the four directions, never to pickup/stay", () => {
    const cases: [number, Robby][] = [
      [0.0, { row: 4, col: 5 }], // North
      [0.25, { row: 6, col: 5 }], // South
      [0.5, { row: 5, col: 6 }], // East
      [0.9, { row: 5, col: 4 }], // West
    ];
    for (const [v, expected] of cases) {
      const g = createGrid(10, 10);
      const robby: Robby = { row: 5, col: 5 };
      const reward = applyAction(g, robby, RANDOM_MOVE, fixed(v));
      expect(reward).toBe(0);
      expect(robby).toEqual(expected);
    }
  });

  it("can crash into a wall like any move (-5) when the random dir is a wall", () => {
    const g = createGrid(10, 10);
    const robby: Robby = { row: 0, col: 5 }; // against the north wall
    const reward = applyAction(g, robby, RANDOM_MOVE, fixed(0.0)); // North
    expect(reward).toBe(PENALTY_WALL);
    expect(robby).toEqual({ row: 0, col: 5 });
  });

  it("over many calls, all four directions actually occur", () => {
    const rng = makeRng(123);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const g = createGrid(10, 10);
      const robby: Robby = { row: 5, col: 5 };
      applyAction(g, robby, RANDOM_MOVE, rng);
      seen.add(`${robby.row},${robby.col}`);
    }
    // Four possible destinations around (5,5).
    expect(seen.size).toBe(4);
  });
});

describe("invalid action", () => {
  it("throws on an unknown action code", () => {
    const g = createGrid(10, 10);
    const robby: Robby = { row: 5, col: 5 };
    expect(() => applyAction(g, robby, 99, noRng)).toThrow();
  });
});
