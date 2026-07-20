// core/strategy — a strategy (Robby's "brain") and how to read an action from it.
//
// A strategy is a flat list of NUM_SITUATIONS actions: one action per situation,
// stored in the fixed situation order (see core/situation). To decide what to do,
// Robby senses -> encodes the situation to an index -> reads the action at that
// index. That's the whole brain.
//
// This file has ONLY the representation and lookup. Building random strategies,
// selecting/mating them, etc. belongs to the genetic algorithm (a later module).

import { CAN, type Senses } from "./world";
import { encodeSituation, decodeSituation, NUM_SITUATIONS } from "./situation";
import {
  MOVE_NORTH,
  MOVE_SOUTH,
  MOVE_EAST,
  MOVE_WEST,
  PICK_UP,
  RANDOM_MOVE,
} from "./actions";

/** A strategy: Int8Array of length NUM_SITUATIONS, each entry an action 0..6. */
export type Strategy = Int8Array;

/** The action this strategy prescribes for what Robby currently senses. */
export function actionFor(strategy: Strategy, senses: Senses): number {
  return strategy[encodeSituation(senses)];
}

/**
 * A strategy that does the SAME action in every situation. Handy for baselines
 * and tests (e.g. "always StayPut", "always MoveEast") whose scores we can work
 * out by hand.
 */
export function uniformStrategy(action: number): Strategy {
  const s = new Int8Array(NUM_SITUATIONS);
  s.fill(action);
  return s;
}

/**
 * The action Mitchell's hand-designed benchmark strategy "M" takes for a given
 * situation (spec Section 7.1):
 *   1. If the current site has a can        -> PickUp.
 *   2. Else if a neighbor has a can          -> move to it. Tie-break by fixed
 *      priority North > South > East > West  (spec D9).
 *   3. Else                                  -> RandomMove.
 * Walls are not cans, so they never trigger a move.
 */
export function manualAction(senses: Senses): number {
  if (senses.current === CAN) return PICK_UP;
  if (senses.north === CAN) return MOVE_NORTH;
  if (senses.south === CAN) return MOVE_SOUTH;
  if (senses.east === CAN) return MOVE_EAST;
  if (senses.west === CAN) return MOVE_WEST;
  return RANDOM_MOVE;
}

/**
 * Strategy "M" compiled into a full 243-gene genome, so it runs through the
 * same evaluation path as any evolved strategy. In the book M averages ~346.
 */
export function manualStrategy(): Strategy {
  const s = new Int8Array(NUM_SITUATIONS);
  for (let i = 0; i < NUM_SITUATIONS; i++) {
    s[i] = manualAction(decodeSituation(i));
  }
  return s;
}
