import { describe, it, expect } from "vitest";
import { makeRng } from "./rng";

describe("makeRng", () => {
  it("is deterministic: same seed produces the same sequence", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 100 }, () => a());
    const seqB = Array.from({ length: 100 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds produce different sequences", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    const seqA = Array.from({ length: 100 }, () => a());
    const seqB = Array.from({ length: 100 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("every output is in the range [0, 1)", () => {
    const r = makeRng(123);
    for (let i = 0; i < 10000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("is roughly uniform: mean of many samples is near 0.5", () => {
    const r = makeRng(7);
    const n = 100000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += r();
    const mean = sum / n;
    // With 100k samples the mean is extremely stable; wide tolerance is safe.
    expect(mean).toBeGreaterThan(0.49);
    expect(mean).toBeLessThan(0.51);
  });
});
