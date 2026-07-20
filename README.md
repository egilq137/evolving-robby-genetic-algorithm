# evolving-robby-genetic-algorithm

Evolving **Robby the soda-can-collecting robot** with a genetic algorithm — a
hands-on implementation of the example from Melanie Mitchell's *Complexity: A
Guided Tour* (Chapter 9).

Robby lives on a 10×10 grid strewn with soda cans. He has no memory and can only
sense the five squares around him. Instead of hand-coding his control strategy,
we let a genetic algorithm **breed** one: encode each strategy as a genome of
243 numbers, score it by how many cans it collects, and let fitness-weighted
crossover and mutation improve the population over many generations — until the
evolved strategy outperforms a human-designed one.

## Status

Early development. Building incrementally, verifying each piece with tests.

- [ ] `core/world` — grid + can placement, sensing, actions, scoring
- [ ] `core/strategy` — genome representation + situation encoding
- [ ] `core/ga` — population, rank selection, crossover, mutation, loop
- [ ] `core/eval` — session + fitness (the hot loop)
- [ ] Web app — live grid animation + fitness chart (TypeScript, deploy on Vercel)

## Design

The full specification lives in [`specs.txt`](specs.txt). Learning notes on how
the algorithm works are in [`notes/`](notes/).

## Reference

Melanie Mitchell, *Complexity: A Guided Tour*, Oxford University Press, 2009 —
Chapter 9, "Genetic Algorithms."
