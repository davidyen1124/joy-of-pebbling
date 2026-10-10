// node scripts/finals.mjs <out.png> <ep,ep,...>   finished paintings side by side, straight off the canvas
import { chromium } from 'playwright'
import fs from 'node:fs'
const [out, list] = process.argv.slice(2)
const eps = list.split(',')
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
const shots = []
for (const ep of eps) {
  await page.goto(`${process.env.BASE || 'http://127.0.0.1:5191'}/?${ep.includes("=") ? ep : "ep=" + ep}&mute`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready, null, { timeout: 30000 })
  const info = await page.evaluate(() => {
    const j = window.__jop
    j.show.setSpeed(8)
    const i = j.seek('outro')
    return { i, title: j.show.ep.title, blurb: j.show.ep.blurb, total: Math.round(j.show.total), url: j.painter.canvas.toDataURL('image/jpeg', 0.86) }
  })
  console.log(ep, info.i, info.title, '|', info.blurb, '|', info.total + 's')
  shots.push(info)
}
const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${Math.min(4, shots.length)},1fr);gap:6px;padding:6px">${shots.map((s) => `<figure style="margin:0"><img src="${s.url}" style="width:100%;display:block"><figcaption style="color:#eee;font:13px monospace;padding:3px">${s.title} · ${s.blurb}</figcaption></figure>`).join('')}</body>`
await page.setViewportSize({ width: 1800, height: 400 })
await page.setContent(html)
await page.waitForTimeout(300)
await page.screenshot({ path: out, fullPage: true })
if (errors.length) console.log([...new Set(errors)].join('\n'))
await browser.close()
