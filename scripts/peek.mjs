// node scripts/peek.mjs <out-prefix> <width> <height> [query] [steps...]
// each step is "seek:kind:label", "adv:seconds", "shot:name", "wait:ms" or "snap:name"
import { chromium } from 'playwright'

const [prefix, w, h, query = '', ...steps] = process.argv.slice(2)
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +(process.env.DPR || 1), hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()) })
page.on('requestfailed', (r) => errors.push('failed: ' + r.url()))
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5191'}/?${query}`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready, null, { timeout: 30000 })
await page.evaluate(() => document.fonts.ready)
for (const s of steps) {
  const [op, a, b] = s.split(':')
  if (op === 'seek') console.log(s, '->', await page.evaluate(([k, l]) => window.__jop.seek(k, l || undefined), [a, b]))
  else if (op === 'adv') await page.evaluate((n) => window.__jop.advance(n), +a)
  else if (op === 'shot') await page.evaluate((n) => { window.__jop.stage.cut(n); window.__jop.advance(0.05) }, a)
  else if (op === 'wait') await page.waitForTimeout(+a)
  else if (op === 'pause') await page.evaluate(() => { if (!window.__jop.show.paused) window.__jop.show.togglePause() })
  else if (op === 'snap') { await page.waitForTimeout(120); await page.screenshot({ path: `${prefix}-${a}.png` }) }
  else if (op === 'state') console.log(JSON.stringify(await page.evaluate(() => ({ ...window.__jop.show.state, ep: window.__jop.show.ep.title, mode: window.__jop.stage.mode, shot: window.__jop.stage.shot }))))
}
if (errors.length) console.log([...new Set(errors)].join('\n'))
await browser.close()
