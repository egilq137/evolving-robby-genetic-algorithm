// core/situation — turning what Robby senses into a situation index 0..242.
//
// A "situation" is the 5 senses (Current/N/S/E/W). We map it to a single number
// 0..242 so a strategy can be stored as a flat list of 243 actions, one per
// situation. The order is FIXED and HUMAN-READABLE (spec D2), matching the
// book's Table 9.1:
//
//   Treat the senses as a 5-digit base-3 number in column order
//   [North, South, East, West, Current], with NORTH most-significant and
//   CURRENT least-significant (the "last cell", which changes fastest).
//   Digit values: EMPTY=0, CAN=1, WALL=2.
//
//     index = (((North*3 + South)*3 + East)*3 + West)*3 + Current
//
//   index 0   = all Empty
//   index 1   = all Empty except Current = Can
//   index 242 = all Wall
//
// Note: the book numbers situations from 1; we index from 0, so the book's
// "situation N" is our index (N - 1).

import { EMPTY, CAN, WALL, NUM_STATES, type Senses } from "./world";

// The FIXED, human-readable ordering (spec D2): most-significant digit first,
// Current last (it changes fastest). This array is the single source of truth
// for the ordering; encode/decode and the derived counts all follow from it.
export const SITUATION_ORDER = [
  "north",
  "south",
  "east",
  "west",
  "current",
] as const;

/** Number of sensed sites (= number of base-NUM_STATES digits). */
export const NUM_SENSES = SITUATION_ORDER.length; // 5

/** Total number of distinct situations, derived: NUM_STATES ^ NUM_SENSES. */
export const NUM_SITUATIONS = NUM_STATES ** NUM_SENSES; // 3^5 = 243

/** Map the senses to a situation index in 0..NUM_SITUATIONS-1. */
export function encodeSituation(s: Senses): number {
  let idx = 0;
  for (const key of SITUATION_ORDER) idx = idx * NUM_STATES + s[key];
  return idx;
}

/** Inverse of encodeSituation: map an index back to the senses. */
export function decodeSituation(index: number): Senses {
  if (!Number.isInteger(index) || index < 0 || index >= NUM_SITUATIONS) {
    throw new Error(
      `situation index must be an integer in 0..${NUM_SITUATIONS - 1}, got ${index}`,
    );
  }
  const out = {} as Record<(typeof SITUATION_ORDER)[number], number>;
  // Fill digits from least-significant (last in the order) to most.
  for (let k = NUM_SENSES - 1; k >= 0; k--) {
    out[SITUATION_ORDER[k]] = index % NUM_STATES;
    index = Math.floor(index / NUM_STATES);
  }
  return out as Senses;
}

const STATE_NAME: Record<number, string> = {
  [EMPTY]: "Empty",
  [CAN]: "Can",
  [WALL]: "Wall",
};

/** Human-readable description, e.g. "N:Wall S:Empty E:Can W:Wall Cur:Empty". */
export function describeSituation(s: Senses): string {
  return (
    `N:${STATE_NAME[s.north]} S:${STATE_NAME[s.south]} ` +
    `E:${STATE_NAME[s.east]} W:${STATE_NAME[s.west]} Cur:${STATE_NAME[s.current]}`
  );
}
