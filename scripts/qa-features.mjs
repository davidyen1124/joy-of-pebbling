// Every feature, one at a time, used the way a person uses it: real clicks, taps and keys, in real time,
// in a browser that keeps its cache between visits and will not play sound until it is clicked. What
// comes out of the speakers is recorded and measured, since nobody running this can hear.
//
//   node scripts/qa-features.mjs            (BASE=… for a build or the live site)
//
// Each line of output is one feature: ok or FAIL, and what was observed. Exits 1 if any failed.
import { chromium, webkit } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.env.BASE || 'http://127.0.0.1:5191'
const OUT = 'qa/features'
fs.mkdirSync(OUT, { recursive: true })
const GL = ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
function feature(name, pass, detail = '') {
  results.push({ name, pass })
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`)
}

// ── listening ───────────────────────────────────────────────────────────────
async function startTape(page) {
  await page.evaluate(() => {
    const j = window.__jop
    if (!window.__tapeStream) {
      const d = j.audio.ctx.createMediaStreamDestination()
      j.audio.master.connect(d)
      window.__tapeStream = d.stream
    }
    const rec = new MediaRecorder(window.__tapeStream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 })
    window.__chunks = []
    rec.ondataavailable = (e) => window.__chunks.push(e.data)
    rec.start()
    window.__rec = rec
  })
}
/** what was heard: peak level, and for how many seconds it was louder than each of two levels */
async function stopTape(page, name) {
  const b64 = await page.evaluate(async () => {
    const rec = window.__rec
    await new Promise((r) => {
      rec.onstop = r
      rec.stop()
    })
    const buf = new Uint8Array(await new Blob(window.__chunks).arrayBuffer())
    let s = ''
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return btoa(s)
  })
  const webm = `${OUT}/${name}.webm`
  const wav = `${OUT}/${name}.wav`
  fs.writeFileSync(webm, Buffer.from(b64, 'base64'))
  if (fs.statSync(webm).size < 200) return { peak: -120, any: 0, voice: 0, seconds: 0 }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', webm, '-ac', '1', '-ar', '22050', '-c:a', 'pcm_s16le', wav])
  fs.rmSync(webm)
  const buf = fs.readFileSync(wav)
  const data = buf.indexOf('data') + 8
  const step = 441 // 20 ms
  let peak = -120
  let any = 0
  let voice = 0
  let n = 0
  for (let i = data; i + step * 2 <= buf.length; i += step * 2) {
    let e = 0
    for (let k = 0; k < step; k++) e += (buf.readInt16LE(i + k * 2) / 32768) ** 2
    const db = 10 * Math.log10(e / step + 1e-12)
    peak = Math.max(peak, db)
    if (db > -50) any += 0.02
    if (db > -32) voice += 0.02 // speech; the theme tucked under it and the room's hush stay below this
    n++
  }
  return { peak, any, voice, seconds: n * 0.02 }
}
const listen = async (page, name, seconds) => {
  await startTape(page)
  await sleep(seconds * 1000)
  return stopTape(page, name)
}

// ── looking ─────────────────────────────────────────────────────────────────
const state = (page) => page.evaluate(() => {
  const j = window.__jop
  const b = j.show.beats[j.show.bi]
  const cc = document.querySelector('#cc span')?.textContent || ''
  return {
    ep: j.show.ep?.no, title: j.show.ep?.title, spec: j.show.ep?.spec, kind: j.show.state.kind, label: j.show.state.label, clock: j.show.clock, held: j.show.held, paused: j.show.paused,
    speed: j.show.speed, on: j.audio.on, ctx: j.audio.ctx?.state, speaks: j.show.speaks, voiced: j.show.voiced, lines: j.show.beats.flatMap((x) => x.cues).length,
    version: j.painter.version, cc, cueTexts: b ? b.cues.map((c) => c.text) : [], cueRecorded: b ? b.cues.every((c) => j.audio.durationOf(c.id) !== undefined) : false,
    play: !document.getElementById('bPlay').hidden, retry: !document.getElementById('bRetry').hidden, bar: document.getElementById('screen').classList.contains('on'),
    dialog: document.getElementById('mail').open, url: location.pathname + location.search, split: j.stage.split, featured: j.audio.featured,
    osd: document.getElementById('osdL').textContent, speedText: document.getElementById('speedText').textContent, soundText: document.getElementById('soundText').textContent.trim(),
    titlecard: !document.getElementById('titlecard').hidden, credits: !document.getElementById('credits').hidden ? document.getElementById('credits').innerText.replace(/\s+/g, ' ') : '',
  }
})
/** how much the two halves of the picture vary: nothing drawn reads as 0 */
const picture = (page) => page.evaluate(() => {
  const j = window.__jop
  j.show.update(0)
  const gl = j.stage.renderer.getContext()
  const W = gl.drawingBufferWidth
  const H = gl.drawingBufferHeight
  const px = new Uint8Array(4)
  const spread = (y0, y1) => {
    let sum = 0
    let sq = 0
    let n = 0
    for (let y = y0; y < y1; y += (y1 - y0) / 7) for (let x = 0.08; x < 0.95; x += 0.08) {
      gl.readPixels(Math.floor(x * W), Math.floor(y * H), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      const l = (px[0] + px[1] + px[2]) / 3
      sum += l
      sq += l * l
      n++
    }
    return Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2))
  }
  return { upper: spread(0.52, 0.95), lower: spread(0.06, 0.48) }
})
/** bring the strip of controls up, as moving the mouse does */
async function bar(page) {
  const v = page.viewportSize()
  await page.mouse.move(v.width * 0.4 + Math.random() * 40, v.height * 0.55 + Math.random() * 20)
  await sleep(220)
}
async function press(page, id) {
  await bar(page)
  await page.click(id)
}
/** run the programme forward fast to the start of a beat (the only place time is not real) */
const skipTo = (page, kind, label) => page.evaluate(([k, l]) => {
  const j = window.__jop
  const was = j.show.speed
  j.show.speed = 8
  const at = j.seek(k, l || undefined)
  j.show.speed = was
  return at
}, [kind, label])

// ════════════════════════════════════════════════════════════════════════════
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jop-profile-'))
const ctx = await chromium.launchPersistentContext(profile, { args: [...GL, '--autoplay-policy=document-user-activation-required'], viewport: { width: 1280, height: 800 }, acceptDownloads: true })
const page = ctx.pages()[0] || (await ctx.newPage())
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 160))
})

console.log(`\n${BASE}\n\nStarting`)
await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 })
await sleep(800)
let s = await state(page)
feature('It opens on the title card behind a play button, and nothing runs yet', s.held && s.play && s.titlecard && s.clock === 0 && !s.bar, `episode ${s.ep} "${s.title}", clock ${s.clock}`)
feature('The address is left alone', s.url === '/', s.url)
feature('It opens on an episode Cobb has recorded in full', s.featured.includes(s.ep) && s.speaks && s.voiced === s.lines, `${s.voiced} of ${s.lines} lines recorded`)

await startTape(page)
const tClick = Date.now()
await page.mouse.click(640, 250)
await sleep(3000)
let heard = await stopTape(page, '1-start')
s = await state(page)
const ran = (Date.now() - tClick) / 1000
feature('One click starts it from the top', !s.held && !s.play && s.kind === 'title' && s.clock > 2 && s.clock < ran + 0.3, `${s.clock.toFixed(1)}s of programme in ${ran.toFixed(1)}s after the click`)
feature('…with its sound: the theme is heard at once', s.on && s.ctx === 'running' && heard.peak > -40 && heard.any > 1.5, `peak ${heard.peak.toFixed(0)} dB, sound for ${heard.any.toFixed(1)}s of ${heard.seconds.toFixed(1)}s`)

console.log('\nThe programme')
await page.waitForFunction(() => window.__jop.show.state.kind === 'talk' && window.__jop.show.bt > 0.3, null, { timeout: 15000 })
heard = await listen(page, '2-hello', 5)
s = await state(page)
feature('Cobb speaks', heard.voice > 2.2, `a voice for ${heard.voice.toFixed(1)}s of ${heard.seconds.toFixed(1)}s, peak ${heard.peak.toFixed(0)} dB`)
feature('The caption shows a line he is saying, and it is one he has recorded', s.cueTexts.includes(s.cc) && s.cueRecorded, `"${s.cc}"`)

await skipTo(page, 'paint') // the first part of the landscape, whatever this episode's is
await sleep(1100) // he loads the brush first
let a = await state(page)
heard = await listen(page, '3-painting', 4)
let b = await state(page)
let pic = await picture(page)
feature('He paints, in real time', b.version > a.version + 20 && b.clock - a.clock > 3.4 && b.clock - a.clock < 4.9, `the canvas changed ${b.version - a.version} times while ${(b.clock - a.clock).toFixed(1)}s of programme passed in 4s`)
feature('The brush is heard', heard.any > 1.2, `sound for ${heard.any.toFixed(1)}s of ${heard.seconds.toFixed(1)}s`)
feature('The picture is there', pic.upper > 10 && pic.lower > 5, `upper half varies by ${pic.upper.toFixed(0)}, lower by ${pic.lower.toFixed(0)}`)

console.log('\nPause')
await press(page, '#bPause')
await sleep(300)
a = await state(page)
await sleep(1200)
b = await state(page)
feature('The Pause control stops the picture, the painting and the sound', b.paused && b.clock === a.clock && b.version === a.version && b.ctx === 'suspended', `clock held at ${b.clock.toFixed(1)}s, sound ${b.ctx}`)
feature('…and says so', /PAUSE/.test(b.osd) || (await page.getAttribute('#bPause', 'aria-pressed')) === 'true', `read-out "${b.osd}"`)
await press(page, '#bPause')
await sleep(1000)
let c = await state(page)
feature('Pressing it again carries on', !c.paused && c.clock > b.clock + 0.6 && c.ctx === 'running', `${(c.clock - b.clock).toFixed(1)}s further on a second later`)
await page.mouse.click(640, 520)
await sleep(600)
a = await state(page)
await page.mouse.click(640, 520)
await sleep(500)
b = await state(page)
feature('A click on the picture pauses and resumes, as on any video', a.paused && !b.paused, `paused ${a.paused}, then ${b.paused}`)
await page.keyboard.press('Space')
await sleep(300)
a = await state(page)
await page.keyboard.press('k')
await sleep(300)
b = await state(page)
feature('So do the space bar and K', a.paused && !b.paused)

console.log('\nSpeed')
const rates = []
for (const want of [2, 4, 8, 1]) {
  await press(page, '#bSpeed')
  await sleep(200)
  a = await state(page)
  const t0 = Date.now()
  await sleep(1200)
  b = await state(page)
  const rate = (b.clock - a.clock) / ((Date.now() - t0) / 1000)
  rates.push(`${want}x: ${rate.toFixed(1)}`)
  // an episode may end during the fastest setting; the count then starts again and says nothing
  const fair = b.ep !== a.ep || (rate > want * 0.75 && rate < want * 1.25)
  feature(`Speed ${want}x runs the programme ${want} times as fast`, a.speed === want && fair && a.speedText.includes(String(want)), `measured ${b.ep !== a.ep ? 'across an episode change' : rate.toFixed(1) + 'x'}, label "${a.speedText}", read-out "${a.osd}"`)
}

console.log('\nSound')
await skipTo(page, 'talk')
await press(page, '#bSound')
await sleep(400) // it fades out over a tenth of a second
heard = await listen(page, '4-muted', 1.6)
s = await state(page)
feature('Sound off is silent', !s.on && heard.peak < -55, `peak ${heard.peak.toFixed(0)} dB, label "${s.soundText}"`)
await press(page, '#bSound')
await skipTo(page, 'paint', 'body')
heard = await listen(page, '5-unmuted', 3)
s = await state(page)
feature('Sound on brings it back', s.on && heard.peak > -40 && heard.any > 1, `peak ${heard.peak.toFixed(0)} dB, label "${s.soundText}"`)

console.log('\nNext')
a = await state(page)
await press(page, '#bNext')
await page.waitForFunction((n) => window.__jop.show.ep.no !== n && window.__jop.show.state.kind === 'title', a.ep, { timeout: 8000 }).catch(() => {})
await sleep(600)
b = await state(page)
feature('Next goes to another episode', b.ep !== a.ep && b.kind === 'title' && b.titlecard, `${a.ep} "${a.title}" to ${b.ep} "${b.title}"`)
feature('…one Cobb has recorded, while the sound is on', b.featured.includes(b.ep) && b.speaks && b.voiced === b.lines, `${b.voiced} of ${b.lines} lines`)
feature('…and the address stays clean', b.url === '/', b.url)

console.log('\nRequest (Viewer Mail)')
a = await state(page)
await press(page, '#bMail')
await sleep(400)
let dlg = await page.evaluate(() => {
  const r = document.querySelector('.mail-in').getBoundingClientRect()
  const cv = document.getElementById('prev')
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
  let ink = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) ink++
  return { open: document.getElementById('mail').open, fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, ink: ink / (cv.width * cv.height), text: document.getElementById('prevText').textContent, chosen: [...document.querySelectorAll('.mail .chip[aria-pressed="true"]')].map((x) => x.dataset.id) }
})
feature('The Request sheet opens, fits the window, and shows the Pebble it would send', dlg.open && dlg.fits && dlg.ink > 0.05 && dlg.chosen.length === 5, `"${dlg.text}"`)
await page.click('#mailRandom')
await sleep(150)
const after = await page.textContent('#prevText')
await page.click('#mailRandom')
await sleep(150)
const after2 = await page.textContent('#prevText')
feature('Surprise me changes the choice', after !== dlg.text || after2 !== after, `"${after2}"`)
await page.click('.mail .x')
await sleep(300)
s = await state(page)
feature('Close leaves the programme as it was', !s.dialog && s.ep === a.ep, `still episode ${s.ep}`)
await press(page, '#bMail')
await sleep(300)
await page.keyboard.press('Escape')
await sleep(300)
s = await state(page)
feature('So does the Escape key', !s.dialog && s.ep === a.ep)
await press(page, '#bMail')
await sleep(300)
const want = { kind: 'tall', color: 'teal', job: 'pirate', hair: 'beehive', hairColor: 'pink' }
for (const [box, id] of [['optKind', want.kind], ['optColor', want.color], ['optJob', want.job], ['optHair', want.hair], ['optHairColor', want.hairColor]]) {
  await page.locator(`#${box} .chip[data-id="${id}"]`).scrollIntoViewIfNeeded()
  await page.click(`#${box} .chip[data-id="${id}"]`)
}
const asked = await page.textContent('#prevText')
await page.screenshot({ path: `${OUT}/request-sheet.png` })
await page.click('#mailSend')
await page.waitForFunction(() => window.__jop.show.ep.spec.job === 'pirate' && window.__jop.show.state.kind === 'title', null, { timeout: 8000 }).catch(() => {})
await sleep(500)
s = await state(page)
const got = s.spec || {}
feature('Paint it starts an episode of exactly the Pebble asked for', !s.dialog && Object.entries(want).every(([k, v]) => got[k] === v) && s.kind === 'title', `asked for "${asked}", got "${s.title}"`)
feature('Cobb has something recorded to say for it, start to finish', s.speaks && s.voiced === s.lines && s.lines >= 20, `${s.voiced} of ${s.lines} lines recorded`)
await page.waitForFunction(() => window.__jop.show.state.kind === 'talk' && window.__jop.show.bt > 0.3, null, { timeout: 15000 })
heard = await listen(page, '6-request-hello', 5)
s = await state(page)
feature('He is heard in a requested episode', heard.voice > 2.2, `a voice for ${heard.voice.toFixed(1)}s of ${heard.seconds.toFixed(1)}s; caption "${s.cc}"`)
// further in: while he paints the hair, a part with no line of its own for this haircut
await skipTo(page, 'paint', 'hair')
heard = await listen(page, '7-request-hair', 4.5)
s = await state(page)
feature('…and still talking when he gets to the hair', heard.voice > 1.5 && s.cueRecorded, `a voice for ${heard.voice.toFixed(1)}s; he says "${s.cueTexts.join(' / ')}"`)
await skipTo(page, 'outro')
await sleep(900)
await page.screenshot({ path: `${OUT}/request-painted.png` })
const painted = await page.evaluate(() => {
  const j = window.__jop
  const p = j.painter
  // the middle of the canvas should no longer be the landscape alone: compare it with the landscape
  const a2 = p.ctx.getImageData(0, 0, p.W, p.H).data
  const b2 = p.pctx.getImageData(0, 0, p.W, p.H).data
  let diff = 0
  let n = 0
  for (let i = 0; i < a2.length; i += 4 * 53) {
    n++
    if (Math.abs(a2[i] - b2[i]) + Math.abs(a2[i + 1] - b2[i + 1]) + Math.abs(a2[i + 2] - b2[i + 2]) > 60) diff++
  }
  return diff / n
})
feature('The requested Pebble is on the canvas at the end', painted > 0.04, `${(painted * 100).toFixed(0)}% of the canvas is Pebble, not landscape`)

console.log('\nKeep')
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), press(page, '#bSave')])
if (dl) {
  const file = `${OUT}/kept.png`
  await dl.saveAs(file)
  const png = fs.readFileSync(file)
  const isPng = png.slice(1, 4).toString() === 'PNG'
  const w = png.readUInt32BE(16)
  const h = png.readUInt32BE(20)
  feature('Keep downloads the painting as a picture', isPng && w / h > 1.32 && w / h < 1.35 && png.length > 100000, `${dl.suggestedFilename()}, ${w}x${h}, ${(png.length / 1024).toFixed(0)} KB`)
} else feature('Keep downloads the painting as a picture', false, 'no download')

console.log('\nKeys')
a = await state(page)
await page.keyboard.press('f')
await sleep(200)
b = await state(page)
await page.keyboard.press('f')
await page.keyboard.press('f')
await page.keyboard.press('f')
await sleep(200)
c = await state(page)
feature('F changes the speed', b.speed === 2 && c.speed === 1, `${a.speed}x, ${b.speed}x, back to ${c.speed}x`)
await page.keyboard.press('m')
await sleep(250)
a = await state(page)
await page.keyboard.press('m')
await sleep(250)
b = await state(page)
feature('M turns the sound off and on', !a.on && b.on)
a = await state(page)
await page.keyboard.press('n')
await page.waitForFunction((n) => window.__jop.show.ep.no !== n && window.__jop.show.state.kind === 'title', a.ep, { timeout: 8000 }).catch(() => {})
b = await state(page)
await page.keyboard.press('ArrowRight')
await page.waitForFunction((n) => window.__jop.show.ep.no !== n && window.__jop.show.state.kind === 'title', b.ep, { timeout: 8000 }).catch(() => {})
c = await state(page)
feature('N and the right arrow go to the next episode', b.ep !== a.ep && c.ep !== b.ep, `${a.ep}, ${b.ep}, ${c.ep}`)
await bar(page)
await page.keyboard.press('Escape')
await sleep(300)
s = await state(page)
feature('Escape puts the controls away', !s.bar)
await bar(page)
s = await state(page)
await page.mouse.move(5, 795)
await sleep(3700)
b = await state(page)
feature('The controls come with the mouse and leave by themselves', s.bar && !b.bar)

console.log('\nThe end of an episode')
await skipTo(page, 'credits')
await sleep(600)
s = await state(page)
feature('The credits roll', s.kind === 'credits' && /COBB MOSS|SANDY SHORE/.test(s.credits), `"${s.credits.slice(0, 60)}"`)
a = s
await page.evaluate(() => window.__jop.show.setSpeed(8))
await page.waitForFunction((n) => window.__jop.show.ep.no !== n && window.__jop.show.state.kind === 'title', a.ep, { timeout: 12000 }).catch(() => {})
await page.evaluate(() => window.__jop.show.setSpeed(1))
await sleep(400)
b = await state(page)
feature('…and the next episode starts by itself', b.ep !== a.ep && b.kind === 'title' && b.featured.includes(b.ep), `${a.ep} to ${b.ep} "${b.title}"`)

console.log('\nA window that changes shape')
await page.setViewportSize({ width: 390, height: 844 })
await sleep(700)
await skipTo(page, 'paint', 'body')
await sleep(900)
s = await state(page)
pic = await picture(page)
feature('Upright, the picture divides: canvas above, Cobb below, both drawn', s.split && pic.upper > 10 && pic.lower > 5, `upper varies by ${pic.upper.toFixed(0)}, lower by ${pic.lower.toFixed(0)}`)
await page.screenshot({ path: `${OUT}/upright.png` })
await page.setViewportSize({ width: 1280, height: 800 })
await sleep(700)
s = await state(page)
pic = await picture(page)
feature('Turned back, it is one picture again', !s.split && pic.upper > 5 && pic.lower > 5)

console.log('\nSound off, then a request')
await press(page, '#bSound')
await press(page, '#bMail')
await sleep(300)
await page.click('#optJob .chip[data-id="chef"]')
await page.click('#mailSend')
await page.waitForFunction(() => window.__jop.show.ep.spec.job === 'chef' && window.__jop.show.state.kind === 'title', null, { timeout: 8000 }).catch(() => {})
await skipTo(page, 'talk')
await sleep(700)
s = await state(page)
feature('With the sound off a request is captioned in full, chef jokes and all', !s.on && s.cc.length > 5 && s.cueTexts.some((t) => /chef/i.test(t)), `"${s.cueTexts.join(' / ')}"`)
await press(page, '#bSound')

console.log('\nA link to one episode')
await page.goto(`${BASE}/?ep=427`, { waitUntil: 'networkidle' })
await sleep(500)
s = await state(page)
feature('?ep=427 opens episode 427', s.ep === 427 && s.titlecard, `"${s.title}", ${s.held ? 'waiting behind the play button' : 'playing'}`)
if (s.held) await page.mouse.click(640, 250)
await sleep(700)
await press(page, '#bNext')
await page.waitForFunction(() => window.__jop.show.ep.no !== 427, null, { timeout: 8000 }).catch(() => {})
s = await state(page)
feature('…and the address is cleared once it moves on', s.ep !== 427 && s.url === '/', s.url)

console.log('\nComing back (same browser, its cache intact)')
const t0 = Date.now()
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
const took = Date.now() - t0
await sleep(500)
s = await state(page)
const cached = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => /\/(models|plates|voice|sfx)\//.test(r.name)).map((r) => r.transferSize))
feature('A second visit loads and is ready to start', s.titlecard && (s.held ? s.play : s.on) && !s.retry, `${took} ms; ${cached.filter((x) => x === 0).length} of ${cached.length} studio, picture and sound files came from the cache`)
if (s.held) await page.mouse.click(640, 250)
await sleep(1500)
s = await state(page)
feature('…and plays', !s.held && s.on && s.clock > 0.8, `${s.clock.toFixed(1)}s in, sound ${s.ctx}`)
feature('No errors anywhere along the way', errors.length === 0, errors.slice(0, 3).join(' | '))
await ctx.close()
fs.rmSync(profile, { recursive: true, force: true })

// ── a phone, by touch ───────────────────────────────────────────────────────
console.log('\nA phone, by touch')
{
  const browser = await chromium.launch({ args: [...GL, '--autoplay-policy=document-user-activation-required'] })
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true })
  const ph = await pctx.newPage()
  const perr = []
  ph.on('pageerror', (e) => perr.push(e.message))
  await ph.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await sleep(600)
  let p = await state(ph)
  await ph.touchscreen.tap(195, 300)
  await sleep(1500)
  let p2 = await state(ph)
  feature('A tap starts it, with sound', p.held && !p2.held && p2.on && p2.ctx === 'running' && p2.clock > 0.8, `${p2.clock.toFixed(1)}s in`)
  await ph.touchscreen.tap(195, 600)
  await sleep(300)
  p = await state(ph)
  const keys = await ph.evaluate(() => [...document.querySelectorAll('.bar-keys button')].map((k) => { const r = k.getBoundingClientRect(); const i = k.querySelector('svg').getBoundingClientRect(); return { w: r.width, h: r.height, on: r.left >= 0 && r.right <= innerWidth, iw: i.width, ih: i.height } }))
  await ph.touchscreen.tap(195, 600)
  await sleep(300)
  p2 = await state(ph)
  feature('A tap brings the controls, another sends them away', p.bar && !p2.bar)
  feature('All six controls are on screen, big enough for a thumb, with symbols of one size', keys.length === 6 && keys.every((k) => k.on && k.w >= 44 && k.h >= 44) && new Set(keys.map((k) => k.iw.toFixed(1) + 'x' + k.ih.toFixed(1))).size === 1, `symbols ${keys[0].iw.toFixed(1)}x${keys[0].ih.toFixed(1)}`)
  // bring the controls up if they are not already showing (a tap while they show sends them away)
  const controls = async () => {
    if (!(await ph.evaluate(() => document.getElementById('screen').classList.contains('on')))) {
      await ph.touchscreen.tap(195, 600)
      await sleep(300)
    }
  }
  await controls()
  await ph.tap('#bPause')
  await sleep(300)
  p = await state(ph)
  await controls()
  await ph.tap('#bPause')
  await sleep(300)
  p2 = await state(ph)
  feature('Pause works by touch', p.paused && !p2.paused)
  await controls()
  await ph.tap('#bMail')
  await sleep(400)
  const fits = await ph.evaluate(() => { const r = document.querySelector('.mail-in').getBoundingClientRect(); const f = document.getElementById('mailSend').getBoundingClientRect(); return document.getElementById('mail').open && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 && f.bottom <= innerHeight })
  await ph.locator('#optJob .chip[data-id="wizard"]').scrollIntoViewIfNeeded()
  await ph.tap('#optJob .chip[data-id="wizard"]')
  await ph.screenshot({ path: `${OUT}/phone-request.png` })
  await ph.tap('#mailSend')
  await ph.waitForFunction(() => window.__jop.show.ep.spec.job === 'wizard' && window.__jop.show.state.kind === 'title', null, { timeout: 8000 }).catch(() => {})
  await ph.waitForFunction(() => window.__jop.show.state.kind === 'talk' && window.__jop.show.bt > 0.3, null, { timeout: 15000 }).catch(() => {})
  const h2 = await listen(ph, '8-phone-request', 4.5)
  p = await state(ph)
  feature('The Request sheet fits a phone, and the Pebble asked for is painted, with Cobb talking', fits && p.spec.job === 'wizard' && p.speaks && h2.voice > 2, `"${p.title}", a voice for ${h2.voice.toFixed(1)}s`)
  feature('No errors on the phone', perr.length === 0, perr.slice(0, 2).join(' | '))
  await browser.close()
}

// ── Safari's engine ─────────────────────────────────────────────────────────
console.log("\nSafari's engine")
try {
  const wk = await webkit.launch()
  const wp = await wk.newPage({ viewport: { width: 1280, height: 800 } })
  const werr = []
  wp.on('pageerror', (e) => werr.push(e.message))
  await wp.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await sleep(700)
  let w = await state(wp)
  if (w.held) await wp.mouse.click(640, 250)
  await sleep(2000)
  let w2 = await state(wp)
  feature('It starts and runs in real time', !w2.held && w2.clock > 1.2 && w2.clock < 3.5, `${w.held ? 'after one click' : 'by itself'}: ${w2.clock.toFixed(1)}s in, sound ${w2.on ? 'on' : 'off'} (${w2.ctx})`)
  // an iPhone's ringer switch silences a page unless the page has told Safari it is to be heard as a video is
  const session = await wp.evaluate(() => navigator.audioSession?.type)
  feature("An iPhone's silent switch is not obeyed", w2.on && w2.ctx === 'running' && session === 'playback', `Safari is told "${session}", sound ${w2.ctx}`)
  await wp.mouse.click(640, 520)
  await sleep(400)
  w = await state(wp)
  await wp.mouse.click(640, 520)
  await sleep(400)
  w2 = await state(wp)
  feature('Pause and resume', w.paused && !w2.paused)
  await wp.mouse.move(500, 420)
  await sleep(250)
  await wp.click('#bMail')
  await sleep(300)
  await wp.click('#optJob .chip[data-id="pirate"]')
  await wp.click('#mailSend')
  await wp.waitForFunction(() => window.__jop.show.ep.spec.job === 'pirate' && window.__jop.show.state.kind === 'title', null, { timeout: 8000 }).catch(() => {})
  w = await state(wp)
  feature('A request is painted, with lines Cobb has recorded', w.spec.job === 'pirate' && w.speaks && w.voiced === w.lines, `${w.voiced} of ${w.lines} lines`)
  feature("No errors in Safari's engine", werr.length === 0, werr.slice(0, 2).join(' | '))
  await wk.close()
} catch (e) {
  feature("Safari's engine", false, e.message.split('\n')[0])
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length} features checked: ${results.length - failed.length} work${failed.length ? `, ${failed.length} DO NOT:\n  ` + failed.map((f) => f.name).join('\n  ') : ', none failed'}`)
process.exit(failed.length ? 1 : 0)
