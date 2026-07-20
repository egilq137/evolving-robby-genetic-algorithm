// core/actions — applying one action and scoring it.
//
// The 7 actions Robby can take (codes fixed by the book / spec Section 3):
//   0 MoveNorth  1 MoveSouth  2 MoveEast  3 MoveWest  4 StayPut
//   5 PickUp     6 RandomMove
//
// Scoring per action (spec Section 4):
//   +10  PickUp on a site that HAS a can (the can is removed)
//    -1  PickUp on a site with NO can
//    -5  Moving into a wall (Robby is fined and bounces back, position unchanged)
//     0  A successful move, or StayPut
//
// Note: moving ONTO a can does NOT collect it (reward 0, can stays). Robby must
// spend a separate PickUp action. This is what later lets a strategy use an
// uncollected can as a marker.

import { CAN, EMPTY, WALL, cellOrWall, type Grid } from "./world";
import type { Rng } from "./rng";

export const MOVE_NORTH = 0;
export const MOVE_SOUTH = 1;
export const MOVE_EAST = 2;
export const MOVE_WEST = 3;
export const STAY_PUT = 4;
export const PICK_UP = 5;
export const RANDOM_MOVE = 6;

/** Number of possible actions; genome genes will be 0..NUM_ACTIONS-1. */
export const NUM_ACTIONS = 7;

export const ACTION_NAMES = [
  "MoveNorth",
  "MoveSouth",
  "MoveEast",
  "MoveWest",
  "StayPut",
  "PickUp",
  "RandomMove",
] as const;

// Scoring constants (named rather than magic numbers).
export const REWARD_PICKUP = 10;
export const PENALTY_EMPTY_PICKUP = -1;
export const PENALTY_WALL = -5;

export interface Robby {
  row: number;
  col: number;
}

// Row/col deltas for the four directional moves, indexed by action code 0..3.
//   North=row-1  South=row+1  East=col+1  West=col-1
const DROW = [-1, 1, 0, 0];
const DCOL = [0, 0, 1, -1];

/**
 * Attempt a directional move (dir = 0..3). If the target is a wall, Robby
 * crashes: returns PENALTY_WALL and does NOT move. Otherwise moves and returns 0.
 */
function move(grid: Grid, robby: Robby, dir: number): number {
  const nr = robby.row + DROW[dir];
  const nc = robby.col + DCOL[dir];
  if (cellOrWall(grid, nr, nc) === WALL) {
    return PENALTY_WALL; // bounce back: position unchanged
  }
  robby.row = nr;
  robby.col = nc;
  return 0;
}

/**
 * Apply a single action. Mutates `grid` (a picked-up can is removed) and
 * `robby` (position changes on a successful move). Returns the reward/penalty
 * for this one action. `rng` is only used by RandomMove.
 */
export function applyAction(
  grid: Grid,
  robby: Robby,
  action: number,
  rng: Rng,
): number {
  switch (action) {
    case MOVE_NORTH:
    case MOVE_SOUTH:
    case MOVE_EAST:
    case MOVE_WEST:
      return move(grid, robby, action);

    case STAY_PUT:
      return 0;

    case PICK_UP: {
      const i = robby.row * grid.cols + robby.col;
      if (grid.cells[i] === CAN) {
        grid.cells[i] = EMPTY;
        return REWARD_PICKUP;
      }
      return PENALTY_EMPTY_PICKUP;
    }

    case RANDOM_MOVE: {
      const dir = Math.floor(rng() * 4); // one of the 4 directions, never pickup/stay
      return move(grid, robby, dir);
    }

    default:
      throw new Error(`unknown action code: ${action}`);
  }
}
