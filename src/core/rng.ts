// A small, seedable pseudo-random-number generator (mulberry32).
//
// Why we need our own: the spec (D8) wants reproducible runs, and reproducible
// tests. JavaScript's built-in Math.random() cannot be seeded, so two runs can
// never be made identical. This one takes a seed and always produces the same
// sequence for the same seed.

/** A function that returns a float in [0, 1) each time it is called. */
export type Rng = () => number;

/**
 * Create a seeded RNG. Same seed -> same sequence of numbers, every time.
 * Each call returns a float in the half-open interval [0, 1).
 */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0; // force to unsigned 32-bit
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
