// Fantasy Land OFC solver: hand evaluation, enumeration, Pareto filtering.

// A card is 0..51: rank = card >> 2 (0=deuce .. 12=ace), suit = card & 3.
export type Card = number

export const RANK_CHARS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
export const SUIT_CHARS = ['♠', '♥', '♦', '♣']

export const rankOf = (c: Card) => c >> 2
export const suitOf = (c: Card) => c & 3
export const makeCard = (rank: number, suit: number) => (rank << 2) | suit
export const cardName = (c: Card) => RANK_CHARS[rankOf(c)] + SUIT_CHARS[suitOf(c)]

// Hand categories, shared scale for 3- and 5-card rows so scores compare directly.
export const CAT_HIGH = 0
export const CAT_PAIR = 1
export const CAT_TWO_PAIR = 2
export const CAT_TRIPS = 3
export const CAT_STRAIGHT = 4
export const CAT_FLUSH = 5
export const CAT_FULL_HOUSE = 6
export const CAT_QUADS = 7
export const CAT_STRAIGHT_FLUSH = 8

// Score layout: cat << 20 | r0 << 16 | r1 << 12 | r2 << 8 | r3 << 4 | r4,
// where r_i are tiebreak ranks encoded as 2..14 (0 = padding).
const score = (cat: number, ranks: number[]): number => {
  let s = cat << 20
  for (let i = 0; i < 5; i++) s |= (ranks[i] ?? 0) << (16 - 4 * i)
  return s
}

export const catOf = (s: number) => s >> 20

// v = rank index 0..12 encoded as 2..14
const enc = (r: number) => r + 2

export function eval5(cards: Card[]): number {
  const counts = new Array(13).fill(0)
  let suitMask = 0
  let rankMask = 0
  for (const c of cards) {
    counts[rankOf(c)]++
    suitMask |= 1 << suitOf(c)
    rankMask |= 1 << rankOf(c)
  }
  const isFlush = (suitMask & (suitMask - 1)) === 0

  // Straight detection: 5 consecutive rank bits, or the wheel (A2345).
  let straightHigh = -1
  for (let hi = 12; hi >= 4; hi--) {
    const need = 0b11111 << (hi - 4)
    if ((rankMask & need) === need) {
      straightHigh = hi
      break
    }
  }
  if (straightHigh < 0 && (rankMask & 0b1000000001111) === 0b1000000001111) {
    straightHigh = 3 // wheel: five-high
  }

  if (isFlush && straightHigh >= 0) return score(CAT_STRAIGHT_FLUSH, [enc(straightHigh)])

  // Group ranks by multiplicity.
  const quads: number[] = []
  const trips: number[] = []
  const pairs: number[] = []
  const singles: number[] = []
  for (let r = 12; r >= 0; r--) {
    if (counts[r] === 4) quads.push(r)
    else if (counts[r] === 3) trips.push(r)
    else if (counts[r] === 2) pairs.push(r)
    else if (counts[r] === 1) singles.push(r)
  }

  if (quads.length) return score(CAT_QUADS, [enc(quads[0]), enc(singles[0])])
  if (trips.length && pairs.length) return score(CAT_FULL_HOUSE, [enc(trips[0]), enc(pairs[0])])
  if (isFlush) return score(CAT_FLUSH, singles.map(enc))
  if (straightHigh >= 0) return score(CAT_STRAIGHT, [enc(straightHigh)])
  if (trips.length) return score(CAT_TRIPS, [enc(trips[0]), ...singles.map(enc)])
  if (pairs.length === 2)
    return score(CAT_TWO_PAIR, [enc(pairs[0]), enc(pairs[1]), enc(singles[0])])
  if (pairs.length === 1) return score(CAT_PAIR, [enc(pairs[0]), ...singles.map(enc)])
  return score(CAT_HIGH, singles.map(enc))
}

// Top row: only high card / pair / trips exist. Kickers are padded with 0 so a
// 5-card hand with the same leading ranks compares higher, keeping top <= middle sane.
export function eval3(cards: Card[]): number {
  const rs = cards.map(rankOf).sort((a, b) => b - a)
  if (rs[0] === rs[2]) return score(CAT_TRIPS, [enc(rs[0])])
  if (rs[0] === rs[1]) return score(CAT_PAIR, [enc(rs[0]), enc(rs[2])])
  if (rs[1] === rs[2]) return score(CAT_PAIR, [enc(rs[1]), enc(rs[0])])
  return score(CAT_HIGH, rs.map(enc))
}

// --- Royalties (standard OFC) ---

export function topRoyalty(s: number): number {
  const cat = catOf(s)
  const r = ((s >> 16) & 0xf) - 2 // leading rank index 0..12
  if (cat === CAT_TRIPS) return 10 + r // 222 = 10 ... AAA = 22
  if (cat === CAT_PAIR && r >= 4) return r - 3 // 66 = 1 ... AA = 9
  return 0
}

const MID_ROYALTY: Record<number, number> = {
  [CAT_TRIPS]: 2, [CAT_STRAIGHT]: 4, [CAT_FLUSH]: 8,
  [CAT_FULL_HOUSE]: 12, [CAT_QUADS]: 20, [CAT_STRAIGHT_FLUSH]: 30,
}
const BOT_ROYALTY: Record<number, number> = {
  [CAT_STRAIGHT]: 2, [CAT_FLUSH]: 4, [CAT_FULL_HOUSE]: 6,
  [CAT_QUADS]: 10, [CAT_STRAIGHT_FLUSH]: 15,
}

const isRoyal = (s: number) => catOf(s) === CAT_STRAIGHT_FLUSH && ((s >> 16) & 0xf) === 14

export const midRoyalty = (s: number) => (isRoyal(s) ? 50 : MID_ROYALTY[catOf(s)] ?? 0)
export const botRoyalty = (s: number) => (isRoyal(s) ? 25 : BOT_ROYALTY[catOf(s)] ?? 0)

// Stays in Fantasy Land: trips up top, or quads+ on the bottom.
export const staysInFL = (topS: number, botS: number) =>
  catOf(topS) === CAT_TRIPS || catOf(botS) >= CAT_QUADS

// --- Hand naming ---

const RANK_NAMES = ['Deuces', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens', 'Eights',
  'Nines', 'Tens', 'Jacks', 'Queens', 'Kings', 'Aces']
const RANK_NAME = ['Deuce', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
  'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace']

export function handName(s: number): string {
  const cat = catOf(s)
  const r = (i: number) => ((s >> (16 - 4 * i)) & 0xf) - 2
  switch (cat) {
    case CAT_HIGH: return `${RANK_NAME[r(0)]} High`
    case CAT_PAIR: return `Pair of ${RANK_NAMES[r(0)]}`
    case CAT_TWO_PAIR: return `Two Pair, ${RANK_NAMES[r(0)]} & ${RANK_NAMES[r(1)]}`
    case CAT_TRIPS: return `Trip ${RANK_NAMES[r(0)]}`
    case CAT_STRAIGHT: return `Straight to the ${RANK_NAME[r(0)]}`
    case CAT_FLUSH: return `Flush, ${RANK_NAME[r(0)]} High`
    case CAT_FULL_HOUSE: return `${RANK_NAMES[r(0)]} Full of ${RANK_NAMES[r(1)]}`
    case CAT_QUADS: return `Quad ${RANK_NAMES[r(0)]}`
    case CAT_STRAIGHT_FLUSH:
      return r(0) === 12 ? 'Royal Flush' : `Straight Flush to the ${RANK_NAME[r(0)]}`
    default: return '?'
  }
}

// Category-level score: the hand category plus its leading rank only — pair
// rank, top pair of two pair, trip rank of a full house, straight/flush high
// card. Kickers and secondary ranks are ignored.
export function categoryScore(s: number): number {
  return (catOf(s) << 20) | (s & 0xf0000)
}

// Sort cards for display: grouped ranks first (pairs/trips/quads), then by rank desc.
export function displaySort(cards: Card[]): Card[] {
  const counts = new Map<number, number>()
  for (const c of cards) counts.set(rankOf(c), (counts.get(rankOf(c)) ?? 0) + 1)
  return [...cards].sort((a, b) => {
    const ca = counts.get(rankOf(a))!
    const cb = counts.get(rankOf(b))!
    if (ca !== cb) return cb - ca
    if (rankOf(a) !== rankOf(b)) return rankOf(b) - rankOf(a)
    return suitOf(a) - suitOf(b)
  })
}

// --- Enumeration + Pareto ---

export interface Config {
  top: Card[]
  mid: Card[]
  bot: Card[]
  discard: Card[]
  topScore: number
  midScore: number
  botScore: number
  royalty: number
  staysFL: boolean
}

export interface SolveResult {
  configs: Config[]
  /** Distinct (top, middle, bottom) strength triples found. */
  distinctTriples: number
  /** Total top/middle/bottom/discard splits the search space covers. */
  totalEnumerated: number
}

export const MIN_CARDS = 13
export const MAX_CARDS = 17

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
  return Math.round(r)
}

function* combinations(n: number, k: number): Generator<number[]> {
  const idx = Array.from({ length: k }, (_, i) => i)
  while (true) {
    yield idx
    let i = k - 1
    while (i >= 0 && idx[i] === n - k + i) i--
    if (i < 0) return
    idx[i]++
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1
  }
}

// Solve for 13–17 cards (extras are discarded, Pineapple-style).
//
// Optimized enumeration:
//  1. Every 5-card subset is evaluated exactly once into flat typed arrays.
//  2. For every possible leftover set (the n-10 cards outside middle+bottom),
//     all its 3-card tops are pre-evaluated and sorted by strength, reachable
//     by direct array indexing on the leftover bitmask.
//  3. The main scan visits each unordered disjoint (5,5) pair once. Only the
//     strongest non-fouling top matters per pair: any weaker top with the same
//     middle/bottom is category-dominated by it, so the rest are skipped.
//  4. Lines are grouped by category triple (kickers ignored) and the Pareto
//     filter runs on those — identical to solving the full split space.
export function solve(cards: Card[], onProgress?: (frac: number) => void): SolveResult {
  const n = cards.length
  if (n < MIN_CARDS || n > MAX_CARDS) throw new Error(`need ${MIN_CARDS}–${MAX_CARDS} cards`)
  const fullMask = (1 << n) - 1

  // 1. All 5-card subsets: bitmask + score.
  const n5 = choose(n, 5)
  const masks5 = new Int32Array(n5)
  const scores5 = new Int32Array(n5)
  {
    let p = 0
    const buf: Card[] = new Array(5)
    for (const idx of combinations(n, 5)) {
      let m = 0
      for (let t = 0; t < 5; t++) {
        m |= 1 << idx[t]
        buf[t] = cards[idx[t]]
      }
      masks5[p] = m
      scores5[p] = eval5(buf)
      p++
    }
  }

  // 2. Leftover-set table: for each (n-10)-card leftover, its 3-card tops
  //    sorted strongest-first. remIndex maps a leftover bitmask to a slot.
  const r = n - 10
  const T = choose(r, 3)
  const remIndex = new Int32Array(1 << n)
  const remTopScores = new Int32Array(choose(n, r) * T)
  const remTopMasks = new Int32Array(choose(n, r) * T)
  {
    let p = 0
    const buf: Card[] = new Array(3)
    for (const idx of combinations(n, r)) {
      let m = 0
      for (let t = 0; t < r; t++) m |= 1 << idx[t]
      remIndex[m] = p
      const base = p * T
      let q = 0
      for (let a = 0; a < r - 2; a++)
        for (let b = a + 1; b < r - 1; b++)
          for (let c = b + 1; c < r; c++) {
            buf[0] = cards[idx[a]]
            buf[1] = cards[idx[b]]
            buf[2] = cards[idx[c]]
            remTopScores[base + q] = eval3(buf)
            remTopMasks[base + q] = (1 << idx[a]) | (1 << idx[b]) | (1 << idx[c])
            q++
          }
      // Insertion sort (T <= 35), descending by score.
      for (let x = 1; x < T; x++) {
        const s = remTopScores[base + x]
        const mm = remTopMasks[base + x]
        let y = x - 1
        while (y >= 0 && remTopScores[base + y] < s) {
          remTopScores[base + y + 1] = remTopScores[base + y]
          remTopMasks[base + y + 1] = remTopMasks[base + y]
          y--
        }
        remTopScores[base + y + 1] = s
        remTopMasks[base + y + 1] = mm
      }
      p++
    }
  }

  // 3. Scan all unordered disjoint (5,5) pairs; aggregate distinct strength
  //    triples. Masks (n <= 17 bits each) pack into one float-safe integer.
  const M24 = 0x1000000 // 2^24 > any score
  const M17 = 0x20000 // 2^17 > any mask
  const outer = new Map<number, Map<number, number>>() // mid*2^24+bot -> top -> packed masks
  let distinct = 0
  const totalScan = (n5 * (n5 - 1)) / 2
  let scanned = 0

  for (let i = 0; i < n5; i++) {
    if (onProgress && (i & 127) === 0) onProgress(scanned / totalScan)
    scanned += n5 - i - 1
    const mi = masks5[i]
    const si = scores5[i]
    for (let j = i + 1; j < n5; j++) {
      const mj = masks5[j]
      if ((mi & mj) !== 0) continue
      const sj = scores5[j]
      let midScore, botScore, midMask, botMask
      if (si <= sj) {
        midScore = si; botScore = sj; midMask = mi; botMask = mj
      } else {
        midScore = sj; botScore = si; midMask = mj; botMask = mi
      }
      // Strongest top from the leftover cards that doesn't foul.
      const base = remIndex[fullMask & ~mi & ~mj] * T
      let k = 0
      while (k < T && remTopScores[base + k] > midScore) k++
      if (k === T) continue // every available top fouls
      const topScore = remTopScores[base + k]
      const midbot = midScore * M24 + botScore
      let inner = outer.get(midbot)
      if (inner === undefined) {
        inner = new Map()
        outer.set(midbot, inner)
      }
      if (!inner.has(topScore)) {
        inner.set(topScore, (remTopMasks[base + k] * M17 + midMask) * M17 + botMask)
        distinct++
      }
    }
  }
  onProgress?.(1)

  // 4. Group by category triple, keeping the best (top, middle, bottom) as
  //    representative, then Pareto-filter on category-level strength.
  //    ck() compresses categoryScore into 8 bits, preserving order.
  const ck = (s: number) => (categoryScore(s) >>> 16) & 0xff
  interface Group { top: number; midbot: number; packed: number }
  const groups = new Map<number, Group>()
  for (const [midbot, inner] of outer) {
    const midScore = Math.floor(midbot / M24)
    const botScore = midbot - midScore * M24
    const gkMB = (ck(midScore) << 8) | ck(botScore)
    for (const [topScore, packed] of inner) {
      const gk = (ck(topScore) << 16) | gkMB
      const g = groups.get(gk)
      if (g === undefined) {
        groups.set(gk, { top: topScore, midbot, packed })
      } else if (topScore > g.top || (topScore === g.top && midbot > g.midbot)) {
        g.top = topScore
        g.midbot = midbot
        g.packed = packed
      }
    }
  }

  const entries = [...groups.entries()]
  const kept = entries.filter(([gk]) => {
    const t = gk >> 16
    const m = (gk >> 8) & 0xff
    const b = gk & 0xff
    return !entries.some(
      ([ok]) => ok !== gk && ok >> 16 >= t && ((ok >> 8) & 0xff) >= m && (ok & 0xff) >= b,
    )
  })

  const toCards = (m: number) => {
    const out: Card[] = []
    for (let i = 0; i < n; i++) if (m & (1 << i)) out.push(cards[i])
    return out
  }
  const configs: Config[] = kept.map(([, g]) => {
    const botMask = g.packed % M17
    const rest = (g.packed - botMask) / M17
    const midMask = rest % M17
    const topMask = (rest - midMask) / M17
    const midScore = Math.floor(g.midbot / M24)
    const botScore = g.midbot - midScore * M24
    return {
      top: toCards(topMask),
      mid: toCards(midMask),
      bot: toCards(botMask),
      discard: toCards(fullMask & ~topMask & ~midMask & ~botMask),
      topScore: g.top,
      midScore,
      botScore,
      royalty: topRoyalty(g.top) + midRoyalty(midScore) + botRoyalty(botScore),
      staysFL: staysInFL(g.top, botScore),
    }
  })

  configs.sort(
    (x, y) =>
      y.royalty - x.royalty ||
      y.botScore - x.botScore ||
      y.midScore - x.midScore ||
      y.topScore - x.topScore,
  )

  return {
    configs,
    distinctTriples: distinct,
    totalEnumerated: (choose(n, 3) * choose(n - 3, 5) * choose(n - 8, 5)) / 2,
  }
}

export function randomCards(count: number): Card[] {
  const deck = Array.from({ length: 52 }, (_, i) => i)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck.slice(0, count)
}
