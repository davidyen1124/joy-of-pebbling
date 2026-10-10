// which episodes have a happy accident / a friend / a given plate? node scripts/find.mjs
import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
await page.goto('http://127.0.0.1:5191/?ep=1', { waitUntil: 'load' })
await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready)
const out = await page.evaluate(async () => {
  const m = await import('/src/show.js')
  const rows = []
  for (let no = 1; no <= 60; no++) {
    const ep = m.makeEpisode(no)
    rows.push(`${no}: ${ep.title} | ${ep.blurb} | ${ep.plate.id}`)
  }
  return rows.join('\n')
})
console.log(out)
await browser.close()
