import { useEffect, useRef, useState } from 'react'
import {
  type Card,
  type SolveResult,
  MIN_CARDS,
  MAX_CARDS,
  RANK_CHARS,
  SUIT_CHARS,
  makeCard,
  rankOf,
  suitOf,
  cardName,
  handName,
  displaySort,
  topRoyalty,
  midRoyalty,
  botRoyalty,
  randomCards,
} from './solver'
import './App.css'

const SUIT_CLASS = ['spade', 'heart', 'diamond', 'club']

type WorkerMsg =
  | { id: number; type: 'progress'; frac: number }
  | { id: number; type: 'done'; result: SolveResult }
  | { id: number; type: 'error'; message: string }

function PlayingCard({ card, small }: { card: Card; small?: boolean }) {
  return (
    <span className={`pcard ${SUIT_CLASS[suitOf(card)]} ${small ? 'small' : ''}`}>
      <span className="pcard-rank">{RANK_CHARS[rankOf(card)]}</span>
      <span className="pcard-suit">{SUIT_CHARS[suitOf(card)]}</span>
    </span>
  )
}

export default function App() {
  const [selected, setSelected] = useState<Card[]>([])
  const [result, setResult] = useState<SolveResult | null>(null)
  const [solving, setSolving] = useState(false)
  const [progress, setProgress] = useState(0)

  const workerRef = useRef<{ worker: Worker; busy: boolean } | null>(null)
  const requestId = useRef(0)

  const has = (c: Card) => selected.includes(c)
  const full = selected.length >= MAX_CARDS

  useEffect(() => {
    const id = ++requestId.current
    if (selected.length < MIN_CARDS) {
      setSolving(false)
      setResult(null)
      return
    }
    setSolving(true)
    setResult(null)
    setProgress(0)
    // Small debounce so clicking from 13 up to e.g. 15 doesn't solve 3 times.
    const timer = setTimeout(() => {
      let entry = workerRef.current
      if (entry?.busy) {
        entry.worker.terminate() // abandon the stale solve
        entry = null
      }
      if (!entry) {
        entry = {
          worker: new Worker(new URL('./solveWorker.ts', import.meta.url), {
            type: 'module',
          }),
          busy: false,
        }
        workerRef.current = entry
      }
      entry.worker.onmessage = (e: MessageEvent<WorkerMsg>) => {
        if (e.data.id !== requestId.current) return
        if (e.data.type === 'progress') {
          setProgress(e.data.frac)
        } else if (e.data.type === 'done') {
          workerRef.current!.busy = false
          setResult(e.data.result)
          setSolving(false)
        } else {
          workerRef.current!.busy = false
          setSolving(false)
          console.error(e.data.message)
        }
      }
      entry.busy = true
      entry.worker.postMessage({ id, cards: selected })
    }, 200)
    return () => clearTimeout(timer)
  }, [selected])

  const toggle = (c: Card) => {
    setSelected((prev) =>
      prev.includes(c)
        ? prev.filter((x) => x !== c)
        : prev.length < MAX_CARDS
          ? [...prev, c]
          : prev,
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Fantasy Land OFC Solver</h1>
        <p className="subtitle">
          Pick {MIN_CARDS}–{MAX_CARDS} cards; extras are discarded. Every Pareto-dominant top
          / middle / bottom split appears below.
        </p>
      </header>

      <section className="picker">
        <div className="grid">
          {[0, 1, 2, 3].map((suit) => (
            <div className="grid-row" key={suit}>
              {Array.from({ length: 13 }, (_, i) => 12 - i).map((rank) => {
                const c = makeCard(rank, suit)
                const sel = has(c)
                return (
                  <button
                    key={rank}
                    className={`cell ${SUIT_CLASS[suit]} ${sel ? 'selected' : ''}`}
                    disabled={!sel && full}
                    onClick={() => toggle(c)}
                    aria-label={cardName(c)}
                  >
                    <span className="cell-rank">{RANK_CHARS[rank]}</span>
                    <span className="cell-suit">{SUIT_CHARS[suit]}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="controls">
          <div className="hand-preview">
            {selected.length === 0 ? (
              <span className="placeholder">No cards selected</span>
            ) : (
              displaySort(selected).map((c) => <PlayingCard key={c} card={c} small />)
            )}
          </div>
          <div className="buttons">
            <span className={`count ${selected.length >= MIN_CARDS ? 'ready' : ''}`}>
              {selected.length < MIN_CARDS
                ? `${selected.length}/${MIN_CARDS}`
                : `${selected.length} cards`}
            </span>
            <button
              className="btn"
              onClick={() =>
                setSelected(
                  randomCards(
                    MIN_CARDS + Math.floor(Math.random() * (MAX_CARDS - MIN_CARDS + 1)),
                  ),
                )
              }
            >
              🎲 Random
            </button>
            <button
              className="btn"
              onClick={() => setSelected([])}
              disabled={selected.length === 0}
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      {solving && (
        <div className="solving">
          <div className="solving-label">
            <span className="spinner" />
            Solving… {Math.round(progress * 100)}%
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}

      {result && (
        <section className="results">
          <h2>
            {result.configs.length} dominant line{result.configs.length === 1 ? '' : 's'}
            <span className="meta">
              {' '}
              · {result.distinctTriples.toLocaleString()} distinct strengths ·{' '}
              {result.totalEnumerated.toLocaleString()} splits searched
            </span>
          </h2>
          {result.configs.map((cfg, i) => (
            <div className="config" key={i}>
              <div className="config-head">
                <span className="config-index">#{i + 1}</span>
                {cfg.staysFL && <span className="badge fl">Stays in Fantasy Land</span>}
                <span className="badge royalty">
                  {cfg.royalty > 0 ? `+${cfg.royalty} royalties` : 'no royalties'}
                </span>
              </div>
              {(
                [
                  ['Top', cfg.top, cfg.topScore, topRoyalty(cfg.topScore)],
                  ['Middle', cfg.mid, cfg.midScore, midRoyalty(cfg.midScore)],
                  ['Bottom', cfg.bot, cfg.botScore, botRoyalty(cfg.botScore)],
                ] as [string, Card[], number, number][]
              ).map(([label, cards, score, roy]) => (
                <div className="row" key={label}>
                  <span className="row-label">{label}</span>
                  <span className="row-cards">
                    {displaySort(cards).map((c) => (
                      <PlayingCard key={c} card={c} />
                    ))}
                  </span>
                  <span className="row-name">{handName(score)}</span>
                  {roy > 0 && <span className="row-royalty">+{roy}</span>}
                </div>
              ))}
              {cfg.discard.length > 0 && (
                <div className="row discard">
                  <span className="row-label">Discard</span>
                  <span className="row-cards">
                    {displaySort(cfg.discard).map((c) => (
                      <PlayingCard key={c} card={c} />
                    ))}
                  </span>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <footer className="footer">
        <span>
          made with ❤️ by{' '}
          <a
            className="author"
            href="https://sorawit.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            swit
          </a>
        </span>
        <a
          href="https://github.com/sorawit"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
        </a>
        <a
          href="https://twitter.com/nomorebear"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Twitter"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M23.953 4.57a10 10 0 0 1-2.825.775 4.958 4.958 0 0 0 2.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 0 0-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 0 0-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 0 1-2.228-.616v.06a4.923 4.923 0 0 0 3.946 4.827 4.996 4.996 0 0 1-2.212.085 4.936 4.936 0 0 0 4.604 3.417 9.867 9.867 0 0 1-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 0 0 7.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0 0 24 4.59z" />
          </svg>
        </a>
      </footer>
    </div>
  )
}
