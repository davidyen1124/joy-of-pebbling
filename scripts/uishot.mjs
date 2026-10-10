// the start, and the request sheet, as a first-time visitor gets them (a browser that will not play
// sound until it is clicked): node scripts/uishot.mjs <prefix>
import { chromium } from 'playwright'
const prefix = process.argv[2] || 'qa/ui'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=document-user-activation-required'] })
for (const [name, w, h, dpr, touch] of [['desk', 1440, 900, 1, false], ['phone', 390, 844, 2, true], ['land', 844, 390, 2, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text().slice(0, 160)) })
  const t0 = Date.now()
  await page.goto(`${process.env.BASE || 'http://127.0.0.1:5191'}/`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready && !document.getElementById('titlecard').hidden)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  const st = () => page.evaluate(() => { const j = window.__jop; return { held: j.show.held, on: j.audio.on, ctx: j.audio.ctx?.state, kind: j.show.state.kind, clock: +j.show.clock.toFixed(2), ep: j.show.ep.no, url: location.pathname + location.search, play: !document.getElementById('bPlay').hidden } })
  console.log(name, 'loaded in', Date.now() - t0, 'ms', JSON.stringify(await st()))
  await page.screenshot({ path: `${prefix}-${name}-1-poster.png` })
  if (touch) await page.touchscreen.tap(w / 2, h * 0.3); else await page.mouse.click(w / 2, h * 0.3)
  await page.waitForTimeout(900)
  console.log(name, '0.9s after the click', JSON.stringify(await st()))
  await page.screenshot({ path: `${prefix}-${name}-2-started.png` })
  // the request sheet
  if (touch) await page.touchscreen.tap(w / 2, h * 0.6); else await page.mouse.move(w / 2 + 5, h * 0.6)
  await page.waitForTimeout(300)
  await (touch ? page.tap('#bMail') : page.click('#bMail'))
  await page.waitForTimeout(400)
  await page.click('#optJob .chip[data-id="pirate"]')
  await page.click('#optHair .chip[data-id="beehive"]')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${prefix}-${name}-3-request.png` })
  await ctx.close()
}
await browser.close()
