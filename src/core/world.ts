// core/world — Robby's world.
//
// INCREMENT 1 (this file for now): just the grid and can placement.
// Sensing, actions, and scoring will be added in later increments.
//
// Design (from specs.txt):
//  - The grid is rows x cols sites (10 x 10 for Robby).
//  - Each site holds AT MOST ONE can. We store it as a flat typed array:
//    0 = EMPTY, 1 = CAN. Index of (row, col) = row * cols + col.
//  - Walls are the boundary just outside the grid; they are NOT stored here
//    (they are implicit and will be handled by the sensing code later).

import type { Rng } from "./rng";

export const EMPTY = 0;
export const CAN = 1;
export const WALL = 2; // never stored in the grid; only ever SENSED at the edge

/** How many distinct states a sensed site can be in: EMPTY, CAN, WALL. */
export const NUM_STATES = 3;

export interface Grid {
  rows: number;
  cols: number;
  /** length rows*cols; each entry is EMPTY (0) or CAN (1). */
  cells: Uint8Array;
}

/**
 * Create an empty grid of the given size. Every site starts EMPTY.
 * Throws if dimensions are not positive integers (a broken grid should fail
 * loudly, not silently produce garbage).
 */
export function createGrid(rows: number, cols: number): Grid {
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(cols) ||
    rows <= 0 ||
    cols <= 0
  ) {
    throw new Error(
      `grid dimensions must be positive integers, got ${rows}x${cols}`,
    );
  }
  return { rows, cols, cells: new Uint8Array(rows * cols) };
}

/** Flat array index for site (row, col). */
export function index(grid: Grid, row: number, col: number): number {
  return row * grid.cols + col;
}

/** Read the contents of site (row, col): EMPTY or CAN. */
export function getCell(grid: Grid, row: number, col: number): number {
  return grid.cells[index(grid, row, col)];
}

/**
 * Scatter cans across the grid. Each site independently becomes a CAN with
 * probability `prob`, else EMPTY. Uses the provided seeded RNG so the layout
 * is reproducible. Mutates and returns the same grid.
 *
 * Note: because rng() is in [0, 1), prob = 0 yields no cans and prob = 1 yields
 * a can in every site (both exact, not approximate).
 */
export function placeCans(grid: Grid, prob: number, rng: Rng): Grid {
  for (let i = 0; i < grid.cells.length; i++) {
    grid.cells[i] = rng() < prob ? CAN : EMPTY;
  }
  return grid;
}

/** Count how many sites currently contain a can. */
export function countCans(grid: Grid): number {
  let n = 0;
  for (let i = 0; i < grid.cells.length; i++) n += grid.cells[i];
  return n;
}

// --- Sensing -----------------------------------------------------------------
//
// Robby senses 5 sites: his current site plus the four orthogonal neighbors.
// Directions (from specs.txt, fixed by the book's Figure 9.1 where Robby at
// (0,0) sees North and West as walls):
//   North = row - 1   South = row + 1   East = col + 1   West = col - 1
// Any neighbor outside the grid reads WALL.

export interface Senses {
  current: number; // EMPTY | CAN (never WALL for a valid position)
  north: number; // EMPTY | CAN | WALL
  south: number;
  east: number;
  west: number;
}

/**
 * Contents of site (row, col): the stored cell if inside the grid, otherwise
 * WALL. This is the single place where "off the grid = wall" is decided.
 */
export function cellOrWall(grid: Grid, row: number, col: number): number {
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return WALL;
  return grid.cells[row * grid.cols + col];
}

/**
 * What Robby senses standing at (row, col). Throws if (row, col) is itself off
 * the grid: Robby standing on a wall is an invalid state and should surface as
 * a bug, not be silently sensed as WALL.
 */
export function sense(grid: Grid, row: number, col: number): Senses {
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
    throw new Error(
      `Robby is off the grid at (${row}, ${col}); valid rows 0..${grid.rows - 1}, cols 0..${grid.cols - 1}`,
    );
  }
  return {
    current: cellOrWall(grid, row, col),
    north: cellOrWall(grid, row - 1, col),
    south: cellOrWall(grid, row + 1, col),
    east: cellOrWall(grid, row, col + 1),
    west: cellOrWall(grid, row, col - 1),
  };
}
