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
