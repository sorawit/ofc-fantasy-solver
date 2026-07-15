import { solve, type Card } from './solver'

// Runs the solver off the main thread; streams progress back to the UI.
const post = (msg: unknown) => (self as unknown as Worker).postMessage(msg)

self.onmessage = (e: MessageEvent<{ id: number; cards: Card[] }>) => {
  const { id, cards } = e.data
  try {
    let lastReport = 0
    const result = solve(cards, (frac) => {
      const now = performance.now()
      if (now - lastReport > 80) {
        lastReport = now
        post({ id, type: 'progress', frac })
      }
    })
    post({ id, type: 'done', result })
  } catch (err) {
    post({ id, type: 'error', message: String(err) })
  }
}
