// What does Cobb say, aloud, in a requested episode?  node scripts/request-lines.mjs [--full]
// Asks the real page (sound allowed), so it needs the dev server or BASE=…
import { chromium } from 'playwright'
const full = process.argv.includes('--full')
const REQUESTS = [
  { kind: 'classic', color: 'teal', job: 'pirate', hair: 'beehive', hairColor: 'pink' },
  { kind: 'tall', color: 'sap', job: 'wizard', hair: 'mohawk', hairColor: 'purple' },
  { kind: 'boulder', color: 'yellow', job: 'chef', hair: 'bald', hairColor: 'black' },
  { kind: 'skipper', color: 'lavender', job: 'scientist', hair: 'dreads', hairColor: 'teal' },
  { kind: 'bean', color: 'pblue', job: 'ballerina', hair: 'afro', hairColor: 'brown' },
  { kind: 'river', color: 'crimson', job: 'rockstar', hair: 'long', hairColor: 'white' },
  { kind: 'egg', color: 'white', job: 'astronaut', hair: 'pompadour', hairColor: 'orange' },
  { kind: 'potato', color: 'black', job: 'royal', hair: 'pigtails', hairColor: 'blonde' },
]
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
page.on('pageerror', (e) => console.log('pageerror:', e.message))
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5191'}/`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.audio.on)
let worst = 1
for (let i = 0; i < REQUESTS.length; i++) {
  const req = REQUESTS[i]
  const out = await page.evaluate(async ([req, no]) => {
    const j = window.__jop
    j.show.skip({ no, ...req })
    await new Promise((res) => { const t = setInterval(() => { if (j.show.ep && j.show.ep.no === no && j.show.state.kind === 'title') { clearInterval(t); res() } }, 20) })
    const beats = j.show.beats
    const cues = beats.flatMap((b) => b.cues)
    const said = cues.reduce((a, c) => a + c.dur, 0)
    return { title: j.show.ep.title, blurb: j.show.ep.blurb, plate: j.show.ep.plate.id, speaks: j.show.speaks, lines: cues.length, voiced: j.show.voiced, said, total: j.show.total, spec: j.show.ep.spec,
      quiet: beats.filter((b) => b.kind === 'paint' && !b.cues.length).map((b) => b.label), beats: beats.filter((b) => b.cues.length).map((b) => `${(b.label || b.kind).padEnd(10)} ${b.cues.map((c) => c.text).join(' / ')}`) }
  }, [req, 5000 + i * 37])
  const share = out.said / out.total
  worst = Math.min(worst, share)
  console.log(`\n${out.title} (${out.blurb}, ${out.plate}): ${out.voiced} of ${out.lines} lines recorded, speaks=${out.speaks}; talking for ${out.said.toFixed(0)}s of ${out.total.toFixed(0)}s (${(share * 100).toFixed(0)}%); painted quietly: ${[...new Set(out.quiet)].join(', ') || 'nothing'}`)
  if (full || i === 0) for (const b of out.beats) console.log('   ' + b)
}
console.log(`\nleast talkative request: ${(worst * 100).toFixed(0)}% of the running time`)
await browser.close()
