// TEMP — does CRN + tournament k=3 give reliable convergence at the book's 100
// sessions (vs needing 400 without CRN)? Delete after.  Run: npx vite-node src/_verify.ts
import { runGA } from "./core/ga";
import { computeFitness } from "./core/eval";
import { makeRng } from "./core/rng";

console.log("seed   g50  g100  g150  g199   champion(1000 fresh)");
for (const seed of [1, 2, 3, 4]) {
  const r = runGA(200, makeRng(seed), { populationSize: 200, numSessions: 100, mutationRate: 0.005 });
  const honest = computeFitness(r.bestStrategy, makeRng(555555), { numSessions: 1000 });
  const at = (g: number) => r.history[g].bestFitness.toFixed(0).padStart(4);
  console.log(`  ${seed}   ${at(50)}  ${at(100)}  ${at(150)}  ${at(199)}      ${honest.toFixed(0)}`);
}
console.log("goal: all seeds climb to the 300s at 100 sessions (CRN doing the noise-cancelling).");
