# Fantasy Land OFC Solver

A fast, fully client-side solver for [Open Face Chinese poker](https://en.wikipedia.org/wiki/Open-face_Chinese_poker)
Fantasy Land hands. Pick your cards, and it shows every arrangement worth
considering — nothing else.

## What it does

Given 13–17 cards (extras are discarded, Pineapple-style), the solver
enumerates every valid top(3) / middle(5) / bottom(5) split — up to
85,765,680 of them at 17 cards — and reduces them to the **Pareto-dominant
lines**: arrangements where no other arrangement is at least as strong in all
three rows.

- **No fouls** — only splits with top ≤ middle ≤ bottom are considered.
- **Category-level dominance** — rows are compared by hand category and
  leading rank (pair of kings, queens full, ace-high flush …); kickers and
  secondary ranks are ignored, so the result list stays short and meaningful.
- **Royalties** — standard OFC royalty tables for all three rows, with each
  line's total shown.
- **Fantasy Land re-qualification** — lines that stay in Fantasy Land (trips
  up top or quads+ on the bottom) are badged.

Everything runs in your browser. There is no backend, no network call, no
tracking — the page is a static bundle.

## Performance

The solver runs in a Web Worker using bitmask enumeration over precomputed
evaluation tables: every 5-card subset is evaluated exactly once, leftover
sets resolve by direct array indexing, and only the strongest non-fouling top
row is examined per middle/bottom pair (weaker tops are provably dominated).
A full 17-card solve completes in roughly half a second; 13 cards is
instantaneous.

## Development

```sh
npm install
npm run dev    # dev server at http://localhost:5173
npm run build  # typecheck + production build in dist/
```

Built with Vite, React, and TypeScript. The solver core
([`src/solver.ts`](src/solver.ts)) is pure TypeScript with no DOM
dependencies, so it also runs in Node scripts.

## License

[MIT](LICENSE)
