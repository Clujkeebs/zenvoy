import { describe, it, expect } from 'vitest'
import { isSafeUrl } from '../../../supabase/functions/_shared/safeUrl.js'

describe('website fetch address check', () => {
  it('allows an ordinary public http or https site', () => {
    expect(isSafeUrl('https://example.com/menu')?.hostname).toBe('example.com')
    expect(isSafeUrl('http://shop.example.co.uk')?.protocol).toBe('http:')
  })

  it('rejects private, local, and mapped addresses', () => {
    const blocked = [
      'http://localhost/admin',
      'http://127.0.0.1/',
      'http://10.1.2.3/',
      'http://192.168.0.5/',
      'http://169.254.169.254/latest',
      'http://172.16.0.4/',
      'http://metadata.google.internal/',
      'http://printer.local/',
      'http://db.internal/',
      'http://[::1]/',
      'http://[fd00::1]/',
      'http://[fe80::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://[::ffff:169.254.169.254]/',
      'file:///etc/passwd',
      'http://user:pass@example.com/',
      'http://2130706433/',
      'javascript:alert(1)',
    ]
    for (const url of blocked) expect(isSafeUrl(url), url).toBeNull()
  })
})
