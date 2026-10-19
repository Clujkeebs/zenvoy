import { describe, it, expect } from 'vitest'
import {
  classifyFetchError, nextHop, interpretFetched,
} from '../../../supabase/functions/_shared/interpret.js'

const PAGE = `<!DOCTYPE html><html><head>
  <title>North Cafe</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Coffee and cake on the high street each morning">
</head><body>
  <a href="tel:+441234567890">Call</a>
  <a href="https://www.fresha.com/a/north-cafe">Book</a>
</body></html>`

const BOT = `<!DOCTYPE html><html><head>
  <title>Just a moment...</title>
  <meta name="viewport" content="width=device-width">
</head><body>Enable JavaScript and cookies to continue</body></html>`

describe('recorded fetch fixtures', () => {
  it('reads a normal HTML page', () => {
    const m = interpretFetched({
      rawUrl: 'https://north.example',
      finalUrl: 'https://north.example/',
      status: 200,
      contentType: 'text/html; charset=utf-8',
      html: PAGE,
      responseMs: 420,
      measuredAt: '2026-10-19T00:00:00.000Z',
    })
    expect(m.reachable).toBe(true)
    expect(m.title).toBe('North Cafe')
    expect(m.hasViewport).toBe(true)
    expect(m.hasBookingLink).toBe(true)
    expect(m.bookingProvider).toBe('Fresha')
    expect(m.error).toBeUndefined()
  })

  it('does not measure a refused or rate-limited response', () => {
    const denied = interpretFetched({ status: 403, html: PAGE, contentType: 'text/html', rawUrl: 'https://x.example' })
    expect(denied.reachable).toBe(false)
    expect(denied.error).toMatch(/refused the check \(403\)/)
    expect(denied.hasViewport).toBeUndefined()

    const limited = interpretFetched({ status: 429, html: PAGE, contentType: 'text/html', rawUrl: 'https://x.example' })
    expect(limited.reachable).toBe(false)
    expect(limited.error).toMatch(/429/)
    expect(limited.hasViewport).toBeUndefined()
  })

  it('does not treat a PDF or a bot wall as a page, even if a viewport tag is in the body', () => {
    const pdf = interpretFetched({
      status: 200,
      contentType: 'application/pdf',
      html: PAGE,
      rawUrl: 'https://files.example/menu.pdf',
      finalUrl: 'https://files.example/menu.pdf',
    })
    expect(pdf.reachable).toBe(false)
    expect(pdf.error).toMatch(/not a web page/)
    expect(pdf.hasViewport).toBeUndefined()

    const wall = interpretFetched({
      status: 200,
      contentType: 'text/html',
      html: BOT,
      rawUrl: 'https://shop.example',
      finalUrl: 'https://shop.example/',
    })
    expect(wall.reachable).toBe(false)
    expect(wall.error).toMatch(/bot check/)
    expect(wall.hasViewport).toBeUndefined()
    expect(wall.title).toBeUndefined()
  })

  it('flags a truncated page without calling the fetch a failure', () => {
    const m = interpretFetched({
      status: 200,
      contentType: 'text/html',
      html: PAGE,
      truncated: true,
      rawUrl: 'https://big.example',
      finalUrl: 'https://big.example/',
    })
    expect(m.reachable).toBe(true)
    expect(m.truncated).toBe(true)
    expect(m.error).toBeUndefined()
    expect(m.hasViewport).toBe(true)
  })

  it('blocks a non-http redirect and names a timeout', () => {
    expect(nextHop('https://example.com/a', 'javascript:alert(1)').ok).toBe(false)
    expect(nextHop('https://example.com/a', '/next')).toEqual({
      ok: true,
      href: 'https://example.com/next',
    })
    expect(classifyFetchError('The operation was aborted due to timeout')).toBe('Timed out after 8s')
    expect(classifyFetchError('Too many redirects')).toBe('Too many redirects')
  })
})
