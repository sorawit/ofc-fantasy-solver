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
                : selected.length === MIN_CARDS
                  ? '13 cards'
                  : `${selected.length} cards · discard ${selected.length - MIN_CARDS}`}
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
    </div>
  )
}
