import { webkit } from 'playwright'
const wk = await webkit.launch()
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const page = await wk.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', (e) => console.log('pageerror', e.message))
  await page.goto('http://127.0.0.1:5191/?ep=12', { waitUntil: 'load' })
  await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready)
  console.log(w, h, JSON.stringify(await page.evaluate(() => {
    const R = (s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), pad: c.paddingTop + '/' + c.paddingLeft, ar: c.aspectRatio } }
    return { screen: R('.screen'), bezel: R('.bezel'), tube: R('.tube'), gl: R('#gl') }
  })))
  await page.screenshot({ path: `qa/wk-${w}.png` })
  await page.close()
}
await wk.close()
