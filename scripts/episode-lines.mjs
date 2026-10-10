// What does Cobb say in an episode, and what would it cost to record?  node scripts/episode-lines.mjs [from] [to] | node scripts/episode-lines.mjs --ep 12
// Needs the dev server (it asks the real page to write the episode).
import { chromium } from 'playwright'
const args = process.argv.slice(2)
const one = args.includes('--ep') ? Number(args[args.indexOf('--ep') + 1]) : null
const json = args.includes('--json')
const [from, to] = one ? [one, one] : [Number(args[0] || 1), Number(args[1] || 200)]
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5191'}/?ep=1&mute`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready)
const rows = await page.evaluate(async ([a, b]) => {
  const { makeEpisode, writeEpisode } = await import('/src/show.js')
  const { speechOf, lineId } = await import('/src/lines.js')
  const out = []
  for (let no = a; no <= b; no++) {
    const ep = makeEpisode(no)
    const beats = writeEpisode(ep)
    const lines = beats.flatMap((x) => x.lines || [])
    out.push({ no, title: ep.title, blurb: ep.blurb, plate: ep.plate.id, labels: beats.map((x) => x.label || x.kind).join(' '), lines: lines.map((t) => ({ id: lineId(t), text: t, speech: speechOf(t) })) })
  }
  return out
}, [from, to])
await browser.close()
if (json) console.log(JSON.stringify(rows))
else if (one) {
  const r = rows[0]
  console.log(`ep ${r.no}: ${r.title} | ${r.blurb} | ${r.plate}\n${r.labels}\n`)
  for (const l of r.lines) console.log(`  ${String(l.speech.length).padStart(3)}  ${l.text}`)
  console.log(`\n${r.lines.length} lines, ${r.lines.reduce((a, l) => a + l.speech.length, 0)} characters of speech`)
} else {
  const cost = (r) => r.lines.reduce((a, l) => a + l.speech.length + 9, 0)
  for (const r of rows.sort((x, y) => cost(x) - cost(y)).slice(0, 40)) console.log(`${String(cost(r)).padStart(5)}  ep ${String(r.no).padStart(3)}  ${r.lines.length} lines  ${r.title} | ${r.blurb} | ${r.plate}${/accident/.test(r.labels) ? ' | accident' : ''}${/friend/.test(r.labels) ? ' | friend' : ''}`)
}
