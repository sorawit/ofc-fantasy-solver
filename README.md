# Fantasy Land OFC Solver

A fully client-side solver for Open Face Chinese poker Fantasy Land hands.

Pick 13–17 cards (extras are discarded, Pineapple-style) and the app enumerates
every top/middle/bottom split, then shows the Pareto-dominant configurations:
lines where no other arrangement is at least as strong in all three rows.
Row strength is compared at the category level (hand category + leading rank,
kickers ignored), and each line shows its royalties and whether it stays in
Fantasy Land.

The solver runs in a Web Worker using bitmask enumeration over precomputed
evaluation tables — a full 17-card solve covers 85.7M splits in well under a
second.

## Development

```sh
npm install
npm run dev    # dev server
npm run build  # production build in dist/
```

Built with Vite + React + TypeScript. No backend; everything runs in the browser.
