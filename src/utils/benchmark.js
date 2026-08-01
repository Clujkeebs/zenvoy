/* ── benchmark.js — how this prospect compares to its neighbours ─────────
 *
 * The audit can already say "your site has no HTTPS". A business owner shrugs
 * at that. What they don't shrug at is "five of the six nearest cafés have
 * HTTPS and you don't" — because it reframes a technical detail as falling
 * behind the people they actually compete with.
 *
 * Every number here comes from measuring those neighbours, so the claim
 * survives the owner checking it. That's the whole point: the earlier audit
 * deliberately refused to make competitor claims because nothing measured them.
 * Now something does.
 *
 * Server measures, client computes — same split as evidence.js, so the maths
 * is testable without a network.
 * ─────────────────────────────────────────────────────────────────────── */

/** Traits we can compare, and how to read them off a measurement. */
const TRAITS = [
  {
    key: 'https',
    label: 'a secure (HTTPS) site',
    has: m => m?.reachable === true && m.https === true,
    // Phrased for the prospect, not the freelancer.
    behind: 'yours shows a "Not secure" warning',
  },
  {
    key: 'mobile',
    label: 'a mobile-friendly site',
    has: m => m?.reachable === true && m.hasViewport === true,
    behind: 'yours renders the desktop layout on phones',
  },
  {
    key: 'booking',
    label: 'online booking',
    has: m => m?.reachable === true && m.hasBookingLink === true,
    behind: 'yours takes bookings by phone only',
  },
  {
    key: 'contactable',
    label: 'a tap-to-call number',
    has: m => m?.reachable === true && m.hasPhoneLink === true,
    behind: 'yours makes visitors copy the number by hand',
  },
  {
    key: 'findable',
    label: 'a search description',
    has: m => m?.reachable === true && m.hasMetaDescription === true,
    behind: 'Google writes its own snippet for yours',
  },
]

/** A peer counts as "has a working site" only if we actually reached it. */
const peerIsLive = p => p.hasWebsite && p.measurement?.reachable === true

/**
 * Compare a lead's own measurement against its measured neighbours.
 *
 * @param {Object|null} leadMeasurement  the prospect's own site measurement
 * @param {Object|null} benchmark        payload from the local-benchmark function
 * @returns {{ready:boolean, sampleSize:number, radiusKm:number, stats:Array,
 *            headlines:string[], behindOn:Array, medianResponseMs:number|null}}
 */
export function compareToPeers(leadMeasurement, benchmark) {
  const peers = Array.isArray(benchmark?.peers) ? benchmark.peers : []

  // Three is the fewest that can carry "most of them" without being noise.
  if (peers.length < 3) {
    return {
      ready: false,
      sampleSize: peers.length,
      radiusKm: benchmark?.radiusM ? benchmark.radiusM / 1000 : 0,
      stats: [], headlines: [], behindOn: [], medianResponseMs: null,
    }
  }

  const withSite = peers.filter(peerIsLive)

  const stats = TRAITS.map(t => {
    const count = withSite.filter(p => t.has(p.measurement)).length
    // Denominator is every neighbour, not just the ones with a site: a rival
    // with no website genuinely doesn't have HTTPS either.
    const total = peers.length
    return {
      key: t.key,
      label: t.label,
      behind: t.behind,
      peersWith: count,
      peersTotal: total,
      pct: Math.round((count / total) * 100),
      leadHas: t.has(leadMeasurement),
    }
  })

  // Where the prospect is beaten by a clear majority — the persuasive ones.
  const behindOn = stats
    .filter(s => !s.leadHas && s.peersWith >= Math.ceil(s.peersTotal / 2) && s.peersWith >= 2)
    .sort((a, b) => b.pct - a.pct)

  const times = withSite
    .map(p => p.measurement?.responseMs)
    .filter(n => typeof n === 'number' && Number.isFinite(n))
    .sort((a, b) => a - b)
  const medianResponseMs = times.length
    ? (times.length % 2
        ? times[(times.length - 1) / 2]
        : Math.round((times[times.length / 2 - 1] + times[times.length / 2]) / 2))
    : null

  const headlines = behindOn.slice(0, 3).map(s =>
    `${s.peersWith} of the ${s.peersTotal} nearest ${plural(benchmark)} have ${s.label} — ${s.behind}.`,
  )

  // Being slower than the local median is its own headline.
  if (medianResponseMs !== null
      && typeof leadMeasurement?.responseMs === 'number'
      && leadMeasurement.responseMs > medianResponseMs * 1.5
      && leadMeasurement.responseMs - medianResponseMs > 800) {
    headlines.push(
      `Their site takes ${(leadMeasurement.responseMs / 1000).toFixed(1)}s to respond; `
      + `the local median is ${(medianResponseMs / 1000).toFixed(1)}s.`,
    )
  }

  return {
    ready: true,
    sampleSize: peers.length,
    radiusKm: Math.round((benchmark.radiusM || 0) / 100) / 10,
    stats,
    behindOn,
    headlines,
    medianResponseMs,
  }
}

/** "the 6 nearest businesses" reads badly; use the category when we have it. */
function plural(benchmark) {
  const n = benchmark?.categoryLabel
  return n ? String(n).toLowerCase() + 's' : 'nearby businesses'
}

/**
 * Turn the comparison into evidence entries the AI prompts already understand,
 * so outreach can cite it under the same no-fabrication rules.
 */
export function benchmarkEvidence(comparison) {
  if (!comparison?.ready) return []
  return comparison.headlines.map((text, i) => ({
    label: i === 0 ? 'Behind local competitors' : 'Local comparison',
    evidence: text,
  }))
}

/** One-line summary for a lead card. */
export function benchmarkSummary(comparison) {
  if (!comparison?.ready) return null
  if (comparison.behindOn.length === 0) {
    return `Keeping up with the ${comparison.sampleSize} nearest businesses`
  }
  const worst = comparison.behindOn[0]
  return `Behind ${worst.peersWith}/${worst.peersTotal} neighbours on ${worst.label}`
}
