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

import { EMPTY, CAN, WALL, type Senses } from "./world";

export const NUM_SITUATIONS = 243; // 3^5

/** Map the 5 senses to a situation index in 0..242. */
export function encodeSituation(s: Senses): number {
  return ((((s.north * 3 + s.south) * 3 + s.east) * 3 + s.west) * 3) + s.current;
}

/** Inverse of encodeSituation: map an index 0..242 back to the 5 senses. */
export function decodeSituation(index: number): Senses {
  if (!Number.isInteger(index) || index < 0 || index >= NUM_SITUATIONS) {
    throw new Error(
      `situation index must be an integer in 0..${NUM_SITUATIONS - 1}, got ${index}`,
    );
  }
  const current = index % 3;
  index = Math.floor(index / 3);
  const west = index % 3;
  index = Math.floor(index / 3);
  const east = index % 3;
  index = Math.floor(index / 3);
  const south = index % 3;
  index = Math.floor(index / 3);
  const north = index % 3;
  return { current, north, south, east, west };
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
