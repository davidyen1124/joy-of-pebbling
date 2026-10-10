import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
await page.goto(`http://127.0.0.1:5191/?ep=1`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready)
console.log(await page.evaluate(async () => {
  const { rng } = await import('/src/rng.js')
  const m = await import('/src/show.js')
  let acc = 0, first = 0
  const N = 400
  const jobs = {}, plates = {}, kinds = {}
  for (let no = 1; no <= N; no++) {
    const r = rng(no * 40503 + 17)
    if (r() < 0.5) first++
    const ep = m.makeEpisode(no)
    jobs[ep.job.id] = (jobs[ep.job.id] || 0) + 1
    plates[ep.plate.id] = (plates[ep.plate.id] || 0) + 1
    kinds[ep.kind.id] = (kinds[ep.kind.id] || 0) + 1
  }
  return JSON.stringify({ firstBelowHalf: first / N, plates, kinds, jobs })
}))
await browser.close()
