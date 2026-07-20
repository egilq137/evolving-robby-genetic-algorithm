import { describe, it, expect } from "vitest";
import { NUM_SITUATIONS } from "./situation";
import { NUM_ACTIONS } from "./actions";
import { randomStrategy, type Strategy } from "./strategy";
import {
  randomPopulation,
  rankOrder,
  makeRankSelector,
  crossover,
  mutate,
} from "./ga";
import { makeRng, type Rng } from "./rng";

/** An RNG that returns a fixed queue of values, for exact deterministic tests. */
const queueRng = (vals: number[]): Rng => {
  let i = 0;
  return () => vals[i++];
};

describe("randomStrategy", () => {
  it("is a length-243 genome with only actions 0..6", () => {
    const s = randomStrategy(makeRng(1));
    expect(s.length).toBe(NUM_SITUATIONS);
    expect(Array.from(s).every((a) => a >= 0 && a < NUM_ACTIONS)).toBe(true);
  });

  it("is reproducible by seed, and different seeds differ", () => {
    expect(Array.from(randomStrategy(makeRng(42)))).toEqual(
      Array.from(randomStrategy(makeRng(42))),
    );
    expect(Array.from(randomStrategy(makeRng(1)))).not.toEqual(
      Array.from(randomStrategy(makeRng(2))),
    );
  });

  it("uses all 7 actions (roughly uniformly)", () => {
    const counts = new Array(NUM_ACTIONS).fill(0);
    const s = randomStrategy(makeRng(7));
    for (const a of s) counts[a]++;
    expect(counts.every((c) => c > 0)).toBe(true); // every action appears
  });
});

describe("randomPopulation", () => {
  it("returns `size` valid, non-identical strategies", () => {
    const pop = randomPopulation(200, makeRng(3));
    expect(pop.length).toBe(200);
    expect(pop.every((s) => s.length === NUM_SITUATIONS)).toBe(true);
    // Not all the same: first two should differ.
    expect(Array.from(pop[0])).not.toEqual(Array.from(pop[1]));
  });
});

describe("rankOrder", () => {
  it("orders indices worst -> best", () => {
    expect(rankOrder([30, 10, 20])).toEqual([1, 2, 0]);
  });

  it("works with negative fitnesses (the D4 gotcha)", () => {
    expect(rankOrder([-800, -100, -400])).toEqual([0, 2, 1]);
  });

  it("returns a permutation of all indices", () => {
    const order = rankOrder([5, 5, 1, 9, 3]);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("makeRankSelector - exact mapping with a controlled RNG", () => {
  // 3 individuals -> total weight 6, cumulative [1,3,6].
  // target = rng()*6: <1 -> rank1 (worst), [1,3) -> rank2, [3,6) -> rank3 (best).
  it("maps rng draws to the right ranked individual", () => {
    const sel = makeRankSelector([10, 20, 30], queueRng([0, 0.2, 0.9]));
    expect(sel()).toBe(0); // worst (fitness 10)
    expect(sel()).toBe(1); // middle
    expect(sel()).toBe(2); // best (fitness 30)
  });

  it("selects by RANK not magnitude: same order + same seed => same picks", () => {
    const draw = (fit: number[]) => {
      const sel = makeRankSelector(fit, makeRng(7));
      return Array.from({ length: 50 }, () => sel());
    };
    // Same ordering, wildly different magnitudes (incl. negatives).
    expect(draw([10, 20, 30])).toEqual(draw([-800, -400, -100]));
  });
});

describe("makeRankSelector - distribution", () => {
  it("prefers higher ranks and gives every individual a nonzero chance", () => {
    const fit = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // already worst..best
    const sel = makeRankSelector(fit, makeRng(2024));
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) counts[sel()]++;
    expect(counts.every((c) => c > 0)).toBe(true); // even the worst is picked
    expect(counts[9]).toBeGreaterThan(counts[0]); // best beats worst
    expect(counts[9]).toBeGreaterThan(counts[4]); // and beats the middle
    // Linear ranking: best (weight 10) vs worst (weight 1) ~ 10x more often.
    expect(counts[9] / counts[0]).toBeGreaterThan(4);
  });
});

describe("crossover", () => {
  it("children have the right length", () => {
    const [c1, c2] = crossover(
      randomStrategy(makeRng(1)),
      randomStrategy(makeRng(2)),
      makeRng(3),
    );
    expect(c1.length).toBe(NUM_SITUATIONS);
    expect(c2.length).toBe(NUM_SITUATIONS);
  });

  it("INVARIANT: at every position the two children hold the two parents' genes", () => {
    const a = randomStrategy(makeRng(1));
    const b = randomStrategy(makeRng(2));
    const [c1, c2] = crossover(a, b, makeRng(3));
    for (let i = 0; i < a.length; i++) {
      // one child gets a[i], the other b[i] -> their sum matches a[i]+b[i]
      expect(c1[i] + c2[i]).toBe(a[i] + b[i]);
      expect(new Set([c1[i], c2[i]])).toEqual(new Set([a[i], b[i]]));
    }
  });

  it("splits at a forced point exactly (controlled RNG)", () => {
    const a = Int8Array.from([1, 1, 1, 1, 1]);
    const b = Int8Array.from([2, 2, 2, 2, 2]);
    // split = 1 + floor(rng*4); rng=0.3 -> floor(1.2)=1 -> split=2
    const [c1, c2] = crossover(a, b, queueRng([0.3]));
    expect(Array.from(c1)).toEqual([1, 1, 2, 2, 2]);
    expect(Array.from(c2)).toEqual([2, 2, 1, 1, 1]);
  });

  it("never produces a clone: split is always in 1..length-1", () => {
    const a = new Int8Array(NUM_SITUATIONS).fill(0);
    const b = new Int8Array(NUM_SITUATIONS).fill(6);
    const rng = makeRng(99);
    for (let t = 0; t < 200; t++) {
      const [c1] = crossover(a, b, rng);
      // A genuine mix must contain BOTH a 0 and a 6.
      expect(c1.includes(0) && c1.includes(6)).toBe(true);
    }
  });

  it("does not modify the parents", () => {
    const a = randomStrategy(makeRng(1));
    const b = randomStrategy(makeRng(2));
    const aCopy = Int8Array.from(a);
    const bCopy = Int8Array.from(b);
    crossover(a, b, makeRng(5));
    expect(Array.from(a)).toEqual(Array.from(aCopy));
    expect(Array.from(b)).toEqual(Array.from(bCopy));
  });
});

describe("mutate", () => {
  it("rate 0 changes nothing", () => {
    const s = randomStrategy(makeRng(1));
    const copy = Int8Array.from(s);
    mutate(s, 0, makeRng(9));
    expect(Array.from(s)).toEqual(Array.from(copy));
  });

  it("exact behavior with a controlled RNG (which genes mutate, to what)", () => {
    const s = Int8Array.from([0, 0, 0]);
    // rate 0.5. Per gene: draw the "mutate?" value; if <0.5, draw the new value.
    //  gene0: 0.0<0.5 mutate, 0.9 -> floor(6.3)=6
    //  gene1: 0.99<0.5? no -> stays 0
    //  gene2: 0.1<0.5 mutate, 0.4 -> floor(2.8)=2
    mutate(s, 0.5, queueRng([0.0, 0.9, 0.99, 0.1, 0.4]));
    expect(Array.from(s)).toEqual([6, 0, 2]);
  });

  it("rate 1 replaces every gene; only valid actions result", () => {
    const s = new Int8Array(NUM_SITUATIONS).fill(0);
    mutate(s, 1, makeRng(4));
    expect(Array.from(s).every((a) => a >= 0 && a < NUM_ACTIONS)).toBe(true);
    // From all-zeros, ~6/7 of genes should become nonzero.
    const nonzero = Array.from(s).filter((a) => a !== 0).length;
    expect(nonzero).toBeGreaterThan(150);
  });

  it("mutates approximately `rate` of the genes (statistical, seeded)", () => {
    const big = new Int8Array(10000).fill(0);
    mutate(big, 0.1, makeRng(2024));
    // ~10% mutate; of those ~6/7 become nonzero => ~857 nonzero. Wide band.
    const nonzero = Array.from(big).filter((a) => a !== 0).length;
    expect(nonzero).toBeGreaterThan(700);
    expect(nonzero).toBeLessThan(1000);
  });

  it("is reproducible by seed", () => {
    const a: Strategy = new Int8Array(NUM_SITUATIONS).fill(0);
    const b: Strategy = new Int8Array(NUM_SITUATIONS).fill(0);
    mutate(a, 0.3, makeRng(5));
    mutate(b, 0.3, makeRng(5));
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
