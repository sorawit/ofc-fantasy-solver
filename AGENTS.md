# Agent Instructions

## Project

Fantasy Land OFC (Open Face Chinese poker) solver. Fully client-side web app:
the user picks 13–17 cards, the app enumerates every valid
top(3)/middle(5)/bottom(5) split (extra cards are discarded, Pineapple-style)
and displays the Pareto-dominant configurations. No backend, no network calls.

## Commands

- `npm run dev` — dev server (Vite, port 5173)
- `npm run build` — typecheck + production build into `dist/`
- `npm run lint` — oxlint

There is no test runner wired into package.json; validate solver changes by
writing a scratch script against `src/solver.ts` (run with `npx tsx`) and by
exercising the UI.

## Architecture

- `src/solver.ts` — all game logic, pure TypeScript, no DOM. Hand evaluation,
  royalties, enumeration, Pareto filtering. This is the only file with
  non-obvious invariants; read it before touching anything below.
- `src/solveWorker.ts` — thin Web Worker wrapper around `solve()`; streams
  progress messages back to the UI.
- `src/App.tsx` — the entire UI (card picker grid, auto-solve effect, results).
- `src/App.css`, `src/index.css` — styling; light theme, CSS variables in
  `:root`.

## Domain rules encoded in solver.ts

- Scores are 24-bit ints: `category << 20 | rank nibbles` (ranks encoded
  2..14, descending significance). Bigger int = stronger hand, comparable
  across 3- and 5-card rows because the top row's missing kickers pad with 0.
- Validity (no foul): top <= middle <= bottom by score.
- Dominance is computed on **category-level** strength: category + leading
  rank only (`categoryScore`). Kickers, second pair of two pair, and the pair
  of a full house are all ignored. A line survives if no other line is >= in
  all three rows at that granularity; ties within a group keep the best top
  row, then middle, then bottom.
- Royalties (per standard OFC tables): top pair 66→AA = +1→+9, top trips
  222→AAA = +10→+22; middle = double bottom; bottom: straight +2, flush +4,
  full house +6, quads +10, straight flush +15, royal +25. Encoded in
  `topRoyalty`/`midRoyalty`/`botRoyalty` — do not change without checking the
  tables.
- Stays in Fantasy Land: trips on top, or quads+ on bottom.

## Performance invariants

`solve()` is heavily optimized; a 17-card solve covers 85.7M splits in ~0.5s.
If you touch the enumeration:

- Every 5-card subset is evaluated once into flat `Int32Array`s.
- Leftover-set lookup is direct array indexing on bitmasks (`remIndex`),
  not a Map.
- The main scan visits each unordered disjoint (5,5) pair once and takes only
  the strongest non-fouling top per pair — weaker tops are provably dominated.
- The hot loop must not allocate. Card masks pack into one float-safe number
  (3 × 17 bits); scores pack mid/bot into `mid * 2^24 + bot`.
- Keep `solve()` free of DOM/worker references so it runs in both the worker
  and plain Node scripts.

## Conventions

- Plain CSS with variables, no CSS framework.
- Cards are ints 0..51: `rank << 2 | suit`; suit order ♠♥♦♣ (4-color deck in
  the UI).
- UI strings use en dashes and the suit glyphs directly.
