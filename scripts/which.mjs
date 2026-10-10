import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
for (const ep of [1, 2, 3, 4, 5, 6]) {
  await page.goto(`http://127.0.0.1:5191/?ep=${ep}`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready)
  console.log(ep, await page.evaluate(() => window.__jop.show.beats.map((b) => b.label || b.kind).join(' ')))
}
await browser.close()
