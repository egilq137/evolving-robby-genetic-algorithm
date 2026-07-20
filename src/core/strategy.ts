// core/strategy — a strategy (Robby's "brain") and how to read an action from it.
//
// A strategy is a flat list of NUM_SITUATIONS actions: one action per situation,
// stored in the fixed situation order (see core/situation). To decide what to do,
// Robby senses -> encodes the situation to an index -> reads the action at that
// index. That's the whole brain.
//
// This file has ONLY the representation and lookup. Building random strategies,
// selecting/mating them, etc. belongs to the genetic algorithm (a later module).

import { type Senses } from "./world";
import { encodeSituation, NUM_SITUATIONS } from "./situation";

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
