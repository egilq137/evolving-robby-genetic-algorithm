# Robby the Robot — Genetic Algorithm Notes

Source: Melanie Mitchell, *Complexity: A Guided Tour*, Ch. 9.
Task: evolve a control "brain" for a robot that collects soda cans on a 10×10 grid.

---

## 1. Representation — how Robby sees, and what a "situation" is
- Robby has **no memory** and **tiny vision**. Each step he sees only **5 squares**:
  Current, North, South, East, West.
- Each square is one of **3 states**: empty / can / wall.
- Number of possible situations = **3⁵ = 243**.
- A **strategy (brain)** = a rule for *every* situation: "in this situation, do this action."
- 7 possible actions: MoveN, MoveS, MoveE, MoveW, StayPut, PickUp, RandomMove (numbers 0–6).

## 2. Brain as a string (the genome)
- Fix the 243 situations in a **known, agreed order** (the code remembers it).
- Then a brain is just a **list of 243 numbers (0–6)** — the actions, in order.
- **KEY NUANCE (my shaky spot):** position #47 does **not** hold a situation.
  It holds the **action** Robby performs *when he is in* situation #47.
  Position = which situation is being asked; number stored = the answer/action.
- Because a brain is now a *string*, it can be cut, spliced, and mutated → breedable.

## 3. Breeding: crossover + mutation
- **Crossover (recombination):** pick a random split point; child = parent A's genes up
  to the split + parent B's genes after it. Two parents → **2 mirror-image children**.
  The book uses **single-point crossover** only; always 2 children per pair.
- **Mutation:** with small probability, replace a few genes with fresh random actions.
- **Why both matter:** crossover only *reshuffles genes already present in the parents*.
  **Mutation is the ONLY source of genes absent from both parents** — the sole way
  genuinely new material enters the pool.

## 4. Fitness — measured by actually running the brain
- Drop Robby at (0,0) on a grid ~50% full of random cans; let him take **200 actions**.
- Score: **+10** pick up a can · **−1** bend for a nonexistent can · **−5** hit a wall.
- Fitness = **average score over 100 different random grids**.
- **Why 100 grids?** Prevents **overfitting** — a brain scored on one grid could just
  exploit that one lucky layout and fail when the grid changes. (Winner later re-tested
  on 10,000 fresh grids to prove it generalizes.)

## 5. Selection + the full loop
- Start: **200 random brains**.
- Each generation:
  1. Compute fitness of all 200 (via the 100-grid runs).
  2. Repeat until 200 children exist: draw **two parents from the WHOLE population**,
     **fitness-weighted, with replacement** (a great brain can be picked many times;
     a weak one still has a nonzero chance) → crossover → mutate → add 2 children.
  3. New generation of 200 fully replaces the old. Go to 1.
- Ran for **1,000 generations**.
- **Softness matters:** hard "only the single best breeds" → **premature convergence**
  (population collapses to one mediocre brain, diversity gone, evolution stalls).
  Keeping weaker brains preserves diversity + rescues good genes trapped in bad brains.
- Fitness acts as a **statistical filter** on the gene pool: it never edits a single
  brain, it just biases *which genes get copied forward*. Bad genes fade on average but
  never fully vanish (good brains carry bad genes; weak brains sometimes breed; mutation
  reintroduces genes by chance).

## 6. The payoff & the two clever tricks
- Hand-designed strategy **M**: ~**346**. Evolved strategy **G**: ~**483** (max ≈ 500).
  **Evolution beat the human**, and the author couldn't read G's genome by eye.
- Root insight: G exploits **visible features of the world as substitutes for memory**.

- **Trick 1 — leave a can as a marker (external memory).**
  Standing on a can with a cluster nearby, G *doesn't* pick it up; moves into the cluster
  first. The leftover can is a **visible breadcrumb** marking the cluster edge, so the
  amnesiac robot sweeps the whole cluster. M greedily grabs, walks off, forgets the rest.
  Confirmed by a **knockout** test: force "always pick up" → score drops 483 → 443.

- **Trick 2 — hug the wall and circle the perimeter.**
  In a "no-can wilderness," M moves randomly (wall crashes, wasted time). G heads east to
  a wall, then **follows the perimeter counterclockwise** — the wall is the one reliable
  landmark, giving a systematic sweep that never crashes and covers ground efficiently.

- Both tricks trace to the **same limitation: no memory + tiny vision.** Nobody designed
  them; the fitness filter just favored brains that happened to use the world as memory.

---

## One-line takeaway
A GA turns "design a program" into "breed a string": encode the solution as a genome,
score it by running it, let fitness-weighted crossover + mutation reshape the pool over
many generations — and it can discover clever, hard-to-read solutions a human wouldn't.
