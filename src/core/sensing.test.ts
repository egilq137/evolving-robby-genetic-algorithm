import { describe, it, expect } from "vitest";
import {
  EMPTY,
  CAN,
  WALL,
  createGrid,
  index,
  cellOrWall,
  sense,
} from "./world";

describe("cellOrWall", () => {
  it("returns the stored contents for in-grid sites", () => {
    const g = createGrid(10, 10);
    g.cells[index(g, 2, 3)] = CAN;
    expect(cellOrWall(g, 2, 3)).toBe(CAN);
    expect(cellOrWall(g, 5, 5)).toBe(EMPTY);
  });

  it("returns WALL for any site outside the grid", () => {
    const g = createGrid(10, 10);
    expect(cellOrWall(g, -1, 0)).toBe(WALL); // above the top
    expect(cellOrWall(g, 10, 0)).toBe(WALL); // below the bottom
    expect(cellOrWall(g, 0, -1)).toBe(WALL); // left of the left edge
    expect(cellOrWall(g, 0, 10)).toBe(WALL); // right of the right edge
  });
});

describe("sense - the four corners (walls on exactly two sides)", () => {
  const g = createGrid(10, 10); // all empty; we only care about walls here

  it("top-left (0,0): North and West are walls", () => {
    const s = sense(g, 0, 0);
    expect(s.north).toBe(WALL);
    expect(s.west).toBe(WALL);
    expect(s.south).toBe(EMPTY);
    expect(s.east).toBe(EMPTY);
    expect(s.current).toBe(EMPTY);
  });

  it("top-right (0,9): North and East are walls", () => {
    const s = sense(g, 0, 9);
    expect(s.north).toBe(WALL);
    expect(s.east).toBe(WALL);
    expect(s.south).toBe(EMPTY);
    expect(s.west).toBe(EMPTY);
  });

  it("bottom-left (9,0): South and West are walls", () => {
    const s = sense(g, 9, 0);
    expect(s.south).toBe(WALL);
    expect(s.west).toBe(WALL);
    expect(s.north).toBe(EMPTY);
    expect(s.east).toBe(EMPTY);
  });

  it("bottom-right (9,9): South and East are walls", () => {
    const s = sense(g, 9, 9);
    expect(s.south).toBe(WALL);
    expect(s.east).toBe(WALL);
    expect(s.north).toBe(EMPTY);
    expect(s.west).toBe(EMPTY);
  });
});

describe("sense - away from the wall", () => {
  it("an interior site senses NO wall in any direction", () => {
    const g = createGrid(10, 10);
    const s = sense(g, 5, 5);
    for (const dir of [s.current, s.north, s.south, s.east, s.west]) {
      expect(dir).not.toBe(WALL);
    }
  });

  it("a non-corner edge site senses a wall on exactly ONE side", () => {
    const g = createGrid(10, 10);
    const s = sense(g, 0, 5); // middle of the top edge
    expect(s.north).toBe(WALL);
    expect(s.south).not.toBe(WALL);
    expect(s.east).not.toBe(WALL);
    expect(s.west).not.toBe(WALL);
  });
});

describe("sense - directions are not swapped", () => {
  // Put a single can in one direction and confirm ONLY that field sees it.
  it("a can to the north is sensed as north (not south)", () => {
    const g = createGrid(10, 10);
    g.cells[index(g, 4, 5)] = CAN; // north of (5,5)
    const s = sense(g, 5, 5);
    expect(s.north).toBe(CAN);
    expect(s.south).toBe(EMPTY);
    expect(s.east).toBe(EMPTY);
    expect(s.west).toBe(EMPTY);
  });

  it("a can to the east is sensed as east (not west)", () => {
    const g = createGrid(10, 10);
    g.cells[index(g, 5, 6)] = CAN; // east of (5,5)
    const s = sense(g, 5, 5);
    expect(s.east).toBe(CAN);
    expect(s.west).toBe(EMPTY);
    expect(s.north).toBe(EMPTY);
    expect(s.south).toBe(EMPTY);
  });
});

describe("sense - faithful to the book's Figure 9.1", () => {
  it("Robby at (0,0) with a can to the east: N=Wall, W=Wall, S=Empty, E=Can, Current=Empty", () => {
    const g = createGrid(10, 10);
    g.cells[index(g, 0, 1)] = CAN; // the can just east of Robby
    const s = sense(g, 0, 0);
    expect(s).toEqual({
      current: EMPTY,
      north: WALL,
      south: EMPTY,
      east: CAN,
      west: WALL,
    });
  });
});

describe("sense - invalid robot position", () => {
  it("throws if Robby is off the grid (invalid state, not sensed as wall)", () => {
    const g = createGrid(10, 10);
    expect(() => sense(g, -1, 0)).toThrow();
    expect(() => sense(g, 10, 10)).toThrow();
  });
});
