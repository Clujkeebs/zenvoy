/* Shape of a proof-page reply. The token is checked for size here.
 * The signature is checked by the caller. */

const MAX_TOKEN = 20_000

export function readInterestRequest(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'Body must be JSON' }
  }
  const token = typeof body.token === 'string' ? body.token : ''
  if (!token || token.length > MAX_TOKEN) {
    return { ok: false, status: 400, error: 'This link is not a report.' }
  }
  const fromName = typeof body.fromName === 'string' ? body.fromName.trim().slice(0, 80) : ''
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
  if (!fromName) return { ok: false, status: 400, error: 'Add your name.' }
  return { ok: true, token, fromName, note }
}
