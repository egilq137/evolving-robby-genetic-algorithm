import { describe, it, expect } from "vitest";
import { EMPTY, CAN, WALL, type Senses } from "./world";
import {
  NUM_SITUATIONS,
  encodeSituation,
  decodeSituation,
  describeSituation,
} from "./situation";

const allEmpty: Senses = {
  current: EMPTY,
  north: EMPTY,
  south: EMPTY,
  east: EMPTY,
  west: EMPTY,
};

describe("encodeSituation - the human-readable anchor points", () => {
  it("all empty -> index 0", () => {
    expect(encodeSituation(allEmpty)).toBe(0);
  });

  it("all empty except Current=Can -> index 1 (book situation 2)", () => {
    expect(encodeSituation({ ...allEmpty, current: CAN })).toBe(1);
  });

  it("all empty except Current=Wall -> index 2", () => {
    expect(encodeSituation({ ...allEmpty, current: WALL })).toBe(2);
  });

  it("West=Can, rest empty -> index 3 (book situation 4)", () => {
    expect(encodeSituation({ ...allEmpty, west: CAN })).toBe(3);
  });

  it("all walls -> index 242 (the maximum)", () => {
    expect(
      encodeSituation({
        current: WALL,
        north: WALL,
        south: WALL,
        east: WALL,
        west: WALL,
      }),
    ).toBe(242);
  });
});

describe("encodeSituation - digit significance is correct", () => {
  it("North is the most-significant digit (weight 81)", () => {
    expect(encodeSituation({ ...allEmpty, north: CAN })).toBe(81);
  });
  it("South has weight 27", () => {
    expect(encodeSituation({ ...allEmpty, south: CAN })).toBe(27);
  });
  it("East has weight 9", () => {
    expect(encodeSituation({ ...allEmpty, east: CAN })).toBe(9);
  });
  it("West has weight 3", () => {
    expect(encodeSituation({ ...allEmpty, west: CAN })).toBe(3);
  });
  it("Current is the least-significant digit (weight 1)", () => {
    expect(encodeSituation({ ...allEmpty, current: CAN })).toBe(1);
  });
});

describe("encode/decode is a bijection over the whole domain", () => {
  it("every index 0..242 decodes then re-encodes to itself", () => {
    for (let i = 0; i < NUM_SITUATIONS; i++) {
      expect(encodeSituation(decodeSituation(i))).toBe(i);
    }
  });

  it("every one of the 243 sense combinations maps to a UNIQUE index in 0..242", () => {
    const seen = new Set<number>();
    for (const north of [EMPTY, CAN, WALL])
      for (const south of [EMPTY, CAN, WALL])
        for (const east of [EMPTY, CAN, WALL])
          for (const west of [EMPTY, CAN, WALL])
            for (const current of [EMPTY, CAN, WALL]) {
              const idx = encodeSituation({
                north,
                south,
                east,
                west,
                current,
              });
              expect(idx).toBeGreaterThanOrEqual(0);
              expect(idx).toBeLessThan(NUM_SITUATIONS);
              seen.add(idx);
            }
    expect(seen.size).toBe(NUM_SITUATIONS); // all 243 distinct, none missing
  });
});

describe("decodeSituation - anchors and invalid input", () => {
  it("index 0 decodes to all empty", () => {
    expect(decodeSituation(0)).toEqual(allEmpty);
  });

  it("index 242 decodes to all walls", () => {
    expect(decodeSituation(242)).toEqual({
      current: WALL,
      north: WALL,
      south: WALL,
      east: WALL,
      west: WALL,
    });
  });

  it("rejects out-of-range or non-integer indices", () => {
    expect(() => decodeSituation(-1)).toThrow();
    expect(() => decodeSituation(243)).toThrow();
    expect(() => decodeSituation(1.5)).toThrow();
  });
});

describe("human-readable ordering property", () => {
  it("situations that differ ONLY in the Current site are consecutive indices", () => {
    // Current changes fastest, so Empty/Can/Wall in the current site with
    // everything else fixed must land on three consecutive indices.
    const base = { north: CAN, south: EMPTY, east: WALL, west: CAN };
    const i0 = encodeSituation({ ...base, current: EMPTY });
    const i1 = encodeSituation({ ...base, current: CAN });
    const i2 = encodeSituation({ ...base, current: WALL });
    expect(i1).toBe(i0 + 1);
    expect(i2).toBe(i0 + 2);
  });
});

describe("faithful to the book's Figure 9.1 situation", () => {
  it("round-trips the (N=Wall,S=Empty,E=Can,W=Wall,Cur=Empty) situation", () => {
    const fig91: Senses = {
      north: WALL,
      south: EMPTY,
      east: CAN,
      west: WALL,
      current: EMPTY,
    };
    const idx = encodeSituation(fig91);
    // Independently computed: 2*81 + 0*27 + 1*9 + 2*3 + 0 = 162 + 9 + 6 = 177
    expect(idx).toBe(177);
    expect(decodeSituation(idx)).toEqual(fig91);
    expect(describeSituation(fig91)).toBe(
      "N:Wall S:Empty E:Can W:Wall Cur:Empty",
    );
  });
});
