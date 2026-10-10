import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: !process.env.HEADED, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-gpu'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:5191/?ep=12', { waitUntil: 'load' })
await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready)
await page.evaluate(() => window.__jop.seek('paint', 'sky'))
const r = await page.evaluate(() => new Promise((res) => {
  const j = window.__jop
  const T = { update: 0, painter: 0, stage: 0, render: 0, n: 0 }
  const wrap = (obj, key, slot) => { const f = obj[key].bind(obj); obj[key] = (...a) => { const t = performance.now(); const v = f(...a); T[slot] += performance.now() - t; return v } }
  wrap(j.show, 'update', 'update'); wrap(j.painter, 'update', 'painter'); wrap(j.stage, 'update', 'stage'); wrap(j.stage, 'render', 'render')
  const gl = j.stage.renderer.getContext()
  const t0 = performance.now(); let n = 0
  const f = (now) => { n++; if (now - t0 < 5000) requestAnimationFrame(f); else { gl.finish(); res({ frames: n, ms: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, +(v / n).toFixed(2)])), size: [j.stage.el.width, j.stage.el.height] }) } }
  requestAnimationFrame(f)
}))
console.log(JSON.stringify(r))
// an empty page for comparison: what does rAF give us here at all?
const p2 = await ctx.newPage()
await p2.goto('about:blank')
console.log('blank rAF fps:', await p2.evaluate(() => new Promise((res) => { const t0 = performance.now(); let n = 0; const f = (now) => { n++; if (now - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / 2)) }; requestAnimationFrame(f) })))
await browser.close()
