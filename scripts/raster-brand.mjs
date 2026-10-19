/* Rasterise the hand-built mark into favicon, PWA, and social images.
 * Uses the system Chrome. Not part of the app bundle.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const MARK_DARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="SIZE" height="SIZE"><rect width="32" height="32" rx="7" fill="#12110e"/><path fill="#f3ecdf" d="M6 7h12l6 6v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><path fill="#e4d8c4" d="M18 7v5h6z"/><path stroke="#12110e" stroke-width="1.6" stroke-linecap="round" d="M10 16h8M10 19.5h6"/><circle cx="22" cy="22" r="7" fill="#e23d28"/><path d="M18.4 22.1l2.1 2.1 4.4-4.6" fill="none" stroke="#fffaf3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const MARK_LIGHT = MARK_DARK
  .replace('fill="#12110e"/><path fill="#f3ecdf"', 'fill="#f3ecdf"/><path fill="#12110e"')
  .replace('fill="#e4d8c4"', 'fill="#2c2822"')
  .replace('stroke="#12110e"', 'stroke="#f3ecdf"')

function page(inner, bg) {
  return `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:${bg};}
    body{width:100vw;height:100vh;overflow:hidden}
  </style></head><body>${inner}</body></html>`
}

function ico(images) {
  const count = images.length
  const head = Buffer.alloc(6)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(count, 4)
  let offset = 6 + count * 16
  const entries = []
  for (const img of images) {
    const e = Buffer.alloc(16)
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 0)
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 1)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(img.png.length, 8)
    e.writeUInt32LE(offset, 12)
    entries.push(e)
    offset += img.png.length
  }
  return Buffer.concat([head, ...entries, ...images.map(i => i.png)])
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

async function png(html, w, h, scale = 1) {
  const p = await browser.newPage()
  await p.setViewport({ width: w, height: h, deviceScaleFactor: scale })
  await p.setContent(html, { waitUntil: 'networkidle0' })
  const buf = await p.screenshot({ type: 'png', clip: { x: 0, y: 0, width: w, height: h } })
  await p.close()
  return buf
}

mkdirSync('/opt/cursor/artifacts/screenshots', { recursive: true })

for (const size of [16, 32, 48, 180, 192, 512]) {
  const svg = MARK_DARK.replaceAll('SIZE', String(size))
  const buf = await png(page(svg, '#12110e'), size, size)
  if (size === 180) writeFileSync('public/apple-touch-icon.png', buf)
  if (size === 192) writeFileSync('public/icon-192.png', buf)
  if (size === 512) writeFileSync('public/icon-512.png', buf)
}

const icoImages = []
for (const size of [16, 32, 48]) {
  const svg = MARK_DARK.replaceAll('SIZE', String(size))
  icoImages.push({ size, png: await png(page(svg, '#12110e'), size, size) })
}
writeFileSync('public/favicon.ico', ico(icoImages))

const og = `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560&family=Outfit:wght@500&display=swap"><style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#f3ecdf;color:#12110e;font-family:Outfit,system-ui,sans-serif}
  .wrap{height:630px;display:flex;flex-direction:column;justify-content:center;padding:72px 88px;box-sizing:border-box}
  .row{display:flex;align-items:center;gap:22px}
  h1{font-family:Fraunces,Georgia,serif;font-weight:560;font-size:84px;margin:0;letter-spacing:-.03em}
  p{font-size:32px;margin:22px 0 0;max-width:760px;line-height:1.35}
  .k{font-family:ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#e23d28;font-size:16px;margin:0 0 18px}
</style></head><body><div class="wrap">
  <p class="k">Measured leads</p>
  <div class="row">${MARK_DARK.replaceAll('SIZE', '96')}<h1>Zenvylo</h1></div>
  <p>Send the proof. Not a guess.</p>
</div></body></html>`
writeFileSync('public/og-image.png', await png(og, 1200, 630))

const sheet = `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560&family=Outfit:wght@500&display=swap"><style>
  body{margin:0;background:#e7dfd0;font-family:Outfit,system-ui,sans-serif;color:#12110e;padding:36px}
  h1{font-family:Fraunces,Georgia,serif;font-weight:560;font-size:40px;margin:0 0 8px}
  p{margin:0 0 22px;color:#5c5348}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .cell{border-radius:18px;padding:28px;min-height:180px}
  .dark{background:#12110e;color:#f3ecdf}
  .light{background:#f3ecdf;color:#12110e;border:1px solid #e3d5c0}
  .label{font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:16px;opacity:.7}
  .row{display:flex;align-items:center;gap:14px;font-family:Fraunces,Georgia,serif;font-size:36px}
  .icons{display:flex;gap:12px;align-items:end}
</style></head><body>
  <h1>Zenvylo logo</h1>
  <p>Proof page, two measured lines, vermilion seal.</p>
  <div class="grid">
    <div class="cell light"><div class="label">Wordmark on paper</div><div class="row">${MARK_DARK.replaceAll('SIZE','56')} Zenvylo</div></div>
    <div class="cell dark"><div class="label">Wordmark on near-black</div><div class="row">${MARK_LIGHT.replaceAll('SIZE','56')} Zenvylo</div></div>
    <div class="cell light"><div class="label">Icon on paper</div><div class="icons">${MARK_DARK.replaceAll('SIZE','64')}${MARK_DARK.replaceAll('SIZE','32')}${MARK_DARK.replaceAll('SIZE','16')}</div></div>
    <div class="cell dark"><div class="label">Icon on near-black</div><div class="icons">${MARK_LIGHT.replaceAll('SIZE','64')}${MARK_LIGHT.replaceAll('SIZE','32')}${MARK_LIGHT.replaceAll('SIZE','16')}</div></div>
  </div>
</body></html>`
writeFileSync('/opt/cursor/artifacts/screenshots/logo-sheet.png', await png(sheet, 1100, 720))

await browser.close()
console.log('brand rasters written')
