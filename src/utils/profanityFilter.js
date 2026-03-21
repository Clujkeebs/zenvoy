// ─── Profanity Filter ──────────────────────────────────
// Normalizes text to defeat leetspeak, symbols, and spacing tricks.
// Add/remove words from BANNED as needed.

const LEET_MAP = {
  '@':'a', '4':'a', '^':'a',
  '8':'b',
  '(':  'c', '<':'c',
  '3':'e',
  '1':'i', '!':'i', '|':'i',
  '0':'o',
  '$':'s', '5':'s',
  '7':'t', '+':'t',
  'v':'u',
  'z':'s',
}

// Keep this list curated — these are the most common slurs + severe profanity
const BANNED = [
  "fuck","shit","bitch","ass","damn","cunt","dick","cock","pussy",
  "nigger","nigga","faggot","fag","retard","slut","whore",
  "kike","chink","spic","wetback","tranny",
]

function normalize(text) {
  let s = text.toLowerCase()
  // Replace leetspeak characters
  s = s.split('').map(c => LEET_MAP[c] || c).join('')
  // Remove non-alpha (spaces, dots, dashes, underscores, etc.)
  s = s.replace(/[^a-z]/g, '')
  return s
}

export function containsProfanity(text) {
  if (!text) return false
  const cleaned = normalize(text)
  return BANNED.some(word => cleaned.includes(word))
}

export function filterMessage(text) {
  if (!text || !text.trim()) return { ok: false, reason: "Message cannot be empty." }
  if (text.length > 2000) return { ok: false, reason: "Message too long (max 2000 characters)." }
  if (containsProfanity(text)) return { ok: false, reason: "Message contains inappropriate language." }
  return { ok: true }
}
