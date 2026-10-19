/* Email the freelancer only. Callers pass profiles.email. This does not look up a lead. */

export async function emailFreelancer({ to, subject, text, key, from, fetchImpl = fetch }) {
  if (!key || !from || !to) return false
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  })
  return !!res?.ok
}
