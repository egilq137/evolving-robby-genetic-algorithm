// core/ga — the genetic operators (6.1).
//
// This file holds the pieces that MAKE a new generation from an old one:
//   - randomPopulation: the initial pool of random strategies
//   - makeTournamentSelector: parent selection (spec D4). It only COMPARES
//       fitnesses, so negatives need no special handling and a single noisy spike
//       can never monopolise. Pressure is tuned by k (default 3).
//   - crossover: single-point recombination of two parents (spec 8.3b / D7)
//   - mutate: per-gene random replacement (spec 8.3c, rate = D3)
//
// The generation loop that wires these together is a later sub-step (6.2).

import { NUM_ACTIONS } from "./actions";
import { randomStrategy, type Strategy } from "./strategy";
import {
  generateGrids,
  computeFitnessOnGrids,
  DEFAULT_SESSIONS_PER_FITNESS,
  DEFAULT_ACTIONS_PER_SESSION,
  type FitnessOptions,
} from "./eval";
import type { Rng } from "./rng";

/** An initial population of `size` random strategies. */
export function randomPopulation(size: number, rng: Rng): Strategy[] {
  const pop: Strategy[] = [];
  for (let i = 0; i < size; i++) pop.push(randomStrategy(rng));
  return pop;
}

export const DEFAULT_TOURNAMENT_K = 3;

/**
 * Build a tournament parent selector (spec D4, the method the GA uses). Each draw
 * picks `k` individuals uniformly at random (with replacement) and returns the one
 * with the highest fitness — ties go to the first seen.
 *
 * Why this over ranking/roulette: it only ever COMPARES fitnesses, never does
 * arithmetic on them, so negative fitnesses need no shifting/clamping (the source
 * of our earlier bugs), and a single noise-inflated individual can never take over
 * (its share is bounded by k). `k` is the pressure knob: k = 1 is uniform (no
 * selection), k = 2 ≈ linear ranking, k = 3+ pushes harder toward the top. Larger k
 * shrinks the worst individual's chance toward (but never exactly) zero.
 *
 * O(k) per draw, no precomputation or sorting.
 */
export function makeTournamentSelector(
  fitnesses: number[],
  rng: Rng,
  k: number = DEFAULT_TOURNAMENT_K,
): () => number {
  const n = fitnesses.length;
  return () => {
    let best = Math.floor(rng() * n);
    for (let j = 1; j < k; j++) {
      const challenger = Math.floor(rng() * n);
      if (fitnesses[challenger] > fitnesses[best]) best = challenger;
    }
    return best;
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

// --- The generation loop -----------------------------------------------------

export const DEFAULT_POPULATION_SIZE = 200;
export const DEFAULT_MUTATION_RATE = 0.005; // spec D3

/**
 * Fitness of every individual in the population (spec step 2), using COMMON RANDOM
 * NUMBERS (spec D10): one set of grids is generated ONCE for the whole generation,
 * and every individual is scored on that SAME set. Fitness differences therefore
 * reflect skill, not which grids each individual happened to draw — the noise-free
 * comparison that lets tournament selection resolve small real improvements. A
 * fresh grid set is drawn each generation (the shared `rng` advances), so the
 * population still faces varied environments over the run. `rng` is also used for
 * RandomMove during the sessions.
 */
export function evaluatePopulation(
  population: Strategy[],
  rng: Rng,
  opts?: FitnessOptions,
): number[] {
  const numSessions = opts?.numSessions ?? DEFAULT_SESSIONS_PER_FITNESS;
  const numActions = opts?.numActions ?? DEFAULT_ACTIONS_PER_SESSION;
  const grids = generateGrids(numSessions, rng, opts); // shared across the population
  return population.map((s) => computeFitnessOnGrids(s, grids, rng, numActions));
}

/**
 * Build the next generation from the current one and its fitnesses (spec step 3):
 * repeatedly pick two parents by tournament selection (size `tournamentK`), cross
 * them over, mutate the children, and add both, until the new population is the
 * same size as the old. Every member of the current generation is eligible to be
 * a parent (see makeTournamentSelector).
 */
export function nextGeneration(
  population: Strategy[],
  fitnesses: number[],
  mutationRate: number,
  rng: Rng,
  tournamentK: number = DEFAULT_TOURNAMENT_K,
): Strategy[] {
  const selector = makeTournamentSelector(fitnesses, rng, tournamentK);
  const size = population.length;
  const next: Strategy[] = [];
  while (next.length < size) {
    const parentA = population[selector()];
    const parentB = population[selector()];
    const [c1, c2] = crossover(parentA, parentB, rng);
    mutate(c1, mutationRate, rng);
    mutate(c2, mutationRate, rng);
    next.push(c1);
    if (next.length < size) next.push(c2);
  }
  return next;
}

export interface GAOptions extends FitnessOptions {
  populationSize?: number;
  mutationRate?: number;
  tournamentK?: number;
}

export interface GenerationStats {
  generation: number;
  bestFitness: number;
  averageFitness: number;
}

export interface EvolutionRun {
  history: GenerationStats[]; // one entry per generation
  bestStrategy: Strategy; // best individual seen across all generations
  bestFitness: number;
}

/** Index of the maximum value in an array. */
function argmax(xs: number[]): number {
  let bi = 0;
  for (let i = 1; i < xs.length; i++) if (xs[i] > xs[bi]) bi = i;
  return bi;
}

/**
 * Run the genetic algorithm for `generations` generations and return the
 * best-fitness history plus the best strategy ever seen. Synchronous — for a
 * live/animated run the caller can instead drive randomPopulation +
 * evaluatePopulation + nextGeneration one step at a time.
 */
export function runGA(
  generations: number,
  rng: Rng,
  opts: GAOptions = {},
): EvolutionRun {
  const populationSize = opts.populationSize ?? DEFAULT_POPULATION_SIZE;
  const mutationRate = opts.mutationRate ?? DEFAULT_MUTATION_RATE;
  const tournamentK = opts.tournamentK ?? DEFAULT_TOURNAMENT_K;

  let population = randomPopulation(populationSize, rng);
  const history: GenerationStats[] = [];
  let bestStrategy = population[0];
  let bestFitness = -Infinity;

  for (let g = 0; g < generations; g++) {
    const fitnesses = evaluatePopulation(population, rng, opts);
    const bi = argmax(fitnesses);
    const avg = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    history.push({ generation: g, bestFitness: fitnesses[bi], averageFitness: avg });
    if (fitnesses[bi] > bestFitness) {
      bestFitness = fitnesses[bi];
      bestStrategy = population[bi].slice(); // keep a copy before the pop changes
    }
    population = nextGeneration(population, fitnesses, mutationRate, rng, tournamentK);
  }
  return { history, bestStrategy, bestFitness };
}
