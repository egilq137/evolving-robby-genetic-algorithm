import { describe, it, expect } from "vitest";
import {
  EMPTY,
  CAN,
  createGrid,
  index,
  getCell,
  placeCans,
  countCans,
} from "./world";
import { makeRng } from "./rng";

describe("createGrid", () => {
  it("has the right shape: cells length = rows*cols, dims stored", () => {
    const g = createGrid(10, 10);
    expect(g.rows).toBe(10);
    expect(g.cols).toBe(10);
    expect(g.cells.length).toBe(100);
  });

  it("starts completely empty (every site is EMPTY)", () => {
    const g = createGrid(10, 10);
    expect(countCans(g)).toBe(0);
    expect(Array.from(g.cells).every((c) => c === EMPTY)).toBe(true);
  });

  it("supports non-square grids", () => {
    const g = createGrid(3, 7);
    expect(g.cells.length).toBe(21);
  });

  it("rejects invalid dimensions instead of producing garbage", () => {
    expect(() => createGrid(0, 10)).toThrow();
    expect(() => createGrid(10, -1)).toThrow();
    expect(() => createGrid(2.5, 4)).toThrow();
  });
});

describe("index / getCell", () => {
  it("maps (row, col) to the correct flat index", () => {
    const g = createGrid(10, 10);
    expect(index(g, 0, 0)).toBe(0); // top-left
    expect(index(g, 0, 9)).toBe(9); // top-right
    expect(index(g, 1, 0)).toBe(10); // start of second row
    expect(index(g, 9, 9)).toBe(99); // bottom-right
  });

  it("getCell reads back exactly what was written at that site", () => {
    const g = createGrid(10, 10);
    g.cells[index(g, 3, 4)] = CAN;
    expect(getCell(g, 3, 4)).toBe(CAN);
    expect(getCell(g, 4, 3)).toBe(EMPTY); // (4,3) must be untouched, not (3,4)
  });
});

describe("placeCans - edge cases (exact answers)", () => {
  it("prob = 0 places NO cans", () => {
    const g = createGrid(10, 10);
    placeCans(g, 0, makeRng(1));
    expect(countCans(g)).toBe(0);
  });

  it("prob = 1 fills EVERY site with a can", () => {
    const g = createGrid(10, 10);
    placeCans(g, 1, makeRng(1));
    expect(countCans(g)).toBe(100);
  });

  it("never writes a value other than 0 or 1 (at most one can per site)", () => {
    const g = createGrid(10, 10);
    placeCans(g, 0.5, makeRng(99));
    expect(Array.from(g.cells).every((c) => c === EMPTY || c === CAN)).toBe(
      true,
    );
  });
});

describe("placeCans - reproducibility", () => {
  it("same seed produces the identical can layout", () => {
    const g1 = placeCans(createGrid(10, 10), 0.5, makeRng(2024));
    const g2 = placeCans(createGrid(10, 10), 0.5, makeRng(2024));
    expect(Array.from(g1.cells)).toEqual(Array.from(g2.cells));
  });

  it("different seeds produce different layouts", () => {
    const g1 = placeCans(createGrid(10, 10), 0.5, makeRng(1));
    const g2 = placeCans(createGrid(10, 10), 0.5, makeRng(2));
    expect(Array.from(g1.cells)).not.toEqual(Array.from(g2.cells));
  });
});

describe("placeCans - the 50% claim", () => {
  it("AGGREGATE: over a large grid, ~50% of sites have a can", () => {
    // 200x200 = 40,000 sites. Standard deviation of the fraction is
    // sqrt(0.25 / 40000) ~= 0.0025, so 0.49..0.51 is a ~4-sigma band.
    const big = placeCans(createGrid(200, 200), 0.5, makeRng(7));
    const fraction = countCans(big) / big.cells.length;
    expect(fraction).toBeGreaterThan(0.49);
    expect(fraction).toBeLessThan(0.51);
  });

  it("PER-CELL: EACH of the 100 sites is a can ~50% of the time", () => {
    // Run many independent 10x10 layouts and, for each site, measure how
    // often it holds a can. Every site should sit near 0.5 - this proves the
    // 50% is per-site and independent, not just an aggregate coincidence.
    const trials = 5000;
    const g = createGrid(10, 10);
    const canCount = new Array(100).fill(0);
    const rng = makeRng(12345);
    for (let t = 0; t < trials; t++) {
      placeCans(g, 0.5, rng);
      for (let i = 0; i < 100; i++) canCount[i] += g.cells[i];
    }
    const fractions = canCount.map((c) => c / trials);
    const min = Math.min(...fractions);
    const max = Math.max(...fractions);
    // With 5000 trials, per-cell std ~= 0.007, so 0.45..0.55 is ~7 sigma.
    expect(min).toBeGreaterThan(0.45);
    expect(max).toBeLessThan(0.55);
  });
});
