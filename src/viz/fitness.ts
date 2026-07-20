// Baseline fitness panel: measures a few simple strategies so we can see how bad
// every non-evolved strategy is (max possible ~= 500). Uses the real
// computeFitness, so these numbers match what the GA will later try to beat.

import { makeRng } from "../core/rng";
import { NUM_SITUATIONS } from "../core/situation";
import { NUM_ACTIONS, STAY_PUT, MOVE_EAST, PICK_UP } from "../core/actions";
import { uniformStrategy, manualStrategy, type Strategy } from "../core/strategy";
import { computeFitness } from "../core/eval";

function randomStrategy(rng: () => number): Strategy {
  const s = new Int8Array(NUM_SITUATIONS);
  for (let i = 0; i < s.length; i++) s[i] = Math.floor(rng() * NUM_ACTIONS);
  return s;
}

function render(): void {
  const rows: [string, number][] = [
    ["all StayPut", computeFitness(uniformStrategy(STAY_PUT), makeRng(1))],
    ["all MoveEast", computeFitness(uniformStrategy(MOVE_EAST), makeRng(1))],
    ["all PickUp", computeFitness(uniformStrategy(PICK_UP), makeRng(1))],
    ["random #1", computeFitness(randomStrategy(makeRng(11)), makeRng(2))],
    ["random #2", computeFitness(randomStrategy(makeRng(22)), makeRng(3))],
    ["random #3", computeFitness(randomStrategy(makeRng(33)), makeRng(4))],
    // Mitchell's hand-designed strategy M (book: ~346). Larger sample for a
    // stable estimate.
    ["manual (M)", computeFitness(manualStrategy(), makeRng(5), { numSessions: 2000 })],
  ];
  const lines = rows
    .map(([name, fit]) => `${name.padEnd(14)} ${fit.toFixed(1).padStart(9)}`)
    .join("<br>");
  const el = document.getElementById("fitnessTable") as HTMLElement;
  el.innerHTML =
    `${"strategy".padEnd(14)} ${"fitness".padStart(9)}<br>` +
    `${"—".repeat(24)}<br>${lines}`;
}

render();
