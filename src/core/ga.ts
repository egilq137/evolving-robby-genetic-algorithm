// core/ga — the genetic operators (6.1).
//
// This file holds the pieces that MAKE a new generation from an old one:
//   - randomPopulation: the initial pool of random strategies
//   - rankOrder + makeRankSelector: rank-based parent selection (spec D4)
//   - crossover: single-point recombination of two parents (spec 8.3b / D7)
//   - mutate: per-gene random replacement (spec 8.3c, rate = D3)
//
// The generation loop that wires these together is a later sub-step (6.2).

import { NUM_ACTIONS } from "./actions";
import { randomStrategy, type Strategy } from "./strategy";
import type { Rng } from "./rng";

/** An initial population of `size` random strategies. */
export function randomPopulation(size: number, rng: Rng): Strategy[] {
  const pop: Strategy[] = [];
  for (let i = 0; i < size; i++) pop.push(randomStrategy(rng));
  return pop;
}

/**
 * Population indices sorted worst -> best by fitness. The result[0] is the
 * lowest-fitness individual (rank 1), result[n-1] is the highest (rank n).
 * Selection depends only on this ORDER, never on the raw fitness magnitudes,
 * which is what lets it cope with negative fitnesses (spec D4).
 */
export function rankOrder(fitnesses: number[]): number[] {
  return fitnesses
    .map((_, i) => i)
    .sort((a, b) => fitnesses[a] - fitnesses[b]);
}

/**
 * Build a rank-based parent selector. Rank r (1 = worst .. n = best) is chosen
 * with probability proportional to r (linear ranking): the best individual is
 * n times as likely as the worst, and every individual has a nonzero chance.
 * Returns a function that draws one population index per call.
 *
 * Precomputes the cumulative weights once (O(n log n)) so each draw is O(log n).
 */
export function makeRankSelector(fitnesses: number[], rng: Rng): () => number {
  const order = rankOrder(fitnesses); // worst..best
  const n = order.length;
  const cumulative = new Array<number>(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += i + 1; // weight of rank (i+1)
    cumulative[i] = acc;
  }
  const total = acc; // n(n+1)/2
  return () => {
    const target = rng() * total;
    // smallest i with cumulative[i] > target (binary search)
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] > target) hi = mid;
      else lo = mid + 1;
    }
    return order[lo];
  };
}

/**
 * Single-point crossover of two parents into two children (spec D7). A split
 * point is chosen uniformly in 1..length-1 so BOTH children are genuine mixes
 * (never an exact copy of a parent). Child 1 = a[..split) + b[split..]; child 2
 * is the mirror. Parents are not modified.
 */
export function crossover(a: Strategy, b: Strategy, rng: Rng): [Strategy, Strategy] {
  const n = a.length;
  const split = 1 + Math.floor(rng() * (n - 1)); // 1..n-1
  const c1 = new Int8Array(n);
  const c2 = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    if (i < split) {
      c1[i] = a[i];
      c2[i] = b[i];
    } else {
      c1[i] = b[i];
      c2[i] = a[i];
    }
  }
  return [c1, c2];
}

/**
 * Mutate a strategy IN PLACE: each gene independently, with probability
 * `mutationRate`, is replaced by a fresh uniform random action 0..NUM_ACTIONS-1
 * (spec 8.3c; rate is the tunable D3 parameter).
 */
export function mutate(strategy: Strategy, mutationRate: number, rng: Rng): void {
  for (let i = 0; i < strategy.length; i++) {
    if (rng() < mutationRate) {
      strategy[i] = Math.floor(rng() * NUM_ACTIONS);
    }
  }
}
