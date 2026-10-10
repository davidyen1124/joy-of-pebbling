// real time: does it keep up, and does the programme actually run by itself?
import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: !process.env.HEADED, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-gpu'] })
for (const [name, w, h, dpr] of [['desktop', 1440, 900, 2], ['phone', 390, 844, 3]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${process.env.BASE || 'http://127.0.0.1:5191'}/?ep=12`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready)
  const gl = await page.evaluate(() => { const g = window.__jop.stage.renderer.getContext(); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown' })
  await page.evaluate(() => window.__jop.seek('paint', 'sky'))
  const r = await page.evaluate(() => new Promise((res) => {
    const t0 = performance.now(); let n = 0; let worst = 0; let last = t0; const c0 = window.__jop.show.clock
    const f = (now) => { n++; worst = Math.max(worst, now - last); last = now; if (now - t0 < 6000) requestAnimationFrame(f); else res({ fps: Math.round(n / ((now - t0) / 1000)), worst: Math.round(worst), clock: +(window.__jop.show.clock - c0).toFixed(2), beat: window.__jop.show.state.label }) }
    requestAnimationFrame(f)
  }))
  console.log(name, gl.slice(0, 60), JSON.stringify(r), errors.join(';'))
  await ctx.close()
}
await browser.close()
