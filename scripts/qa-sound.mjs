// Listens to the page. Nobody running this can hear, so it records what the page actually plays (the
// Web Audio output, in real time) and measures it: how many strikes in a beating and how far apart,
// how fast the taps come and how long each one lasts. Those are held against the same measurements
// taken off a real episode of the programme.
//
//   node scripts/qa-sound.mjs            (BASE=… for a built or deployed site)
//
// Writes the recordings to qa/audio/*.wav and their spectrograms to qa/audio/*.png.
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://127.0.0.1:5191'
const OUT = 'qa/audio'
fs.mkdirSync(OUT, { recursive: true })
const fails = []
const ok = (cond, what) => {
  if (!cond) {
    fails.push(what)
    console.log(`  FAIL ${what}`)
  }
}

// ── reading a recording: where do sounds start, and how long do they last? ──
// A sound starts at a 2 ms step that is within 14 dB of the loudest in the recording and at least
// `rise` dB louder than the quietest step in the `look` seconds before it.
function events(wav, { rise = 12, look = 0.012, apart = 0.04, smooth = 1 } = {}) {
  const buf = fs.readFileSync(wav)
  const sr = buf.readUInt32LE(24)
  const data = buf.indexOf('data') + 8
  const n = (buf.length - data) >> 1
  const hop = Math.round(sr * 0.002)
  const db = []
  for (let i = 0; i + hop <= n; i += hop) {
    let m = 0
    for (let k = 0; k < hop; k++) m = Math.max(m, Math.abs(buf.readInt16LE(data + (i + k) * 2) / 32768))
    db.push(20 * Math.log10(m + 1e-6))
  }
  // a hiss has no sharp edge: average it over a few steps first
  if (smooth > 1) {
    const lin = db.map((d) => 10 ** (d / 10))
    for (let i = 0; i < db.length; i++) {
      let a = 0
      let c = 0
      for (let k = Math.max(0, i - smooth + 1); k <= i; k++) (a += lin[k]), c++
      db[i] = 10 * Math.log10(a / c + 1e-12)
    }
  }
  const peak = Math.max(...db)
  const back = Math.max(2, Math.round(look / 0.002))
  const out = []
  for (let i = back; i < db.length; i++) {
    if (db[i] < peak - 14) continue
    if (out.length && (i - out[out.length - 1].i) * 0.002 < apart) continue
    let floor = Infinity
    for (let k = i - back; k < i; k++) floor = Math.min(floor, db[k])
    if (db[i] - floor < rise) continue
    // how long it lasts: until it has stayed 12 dB under its own loudest for 10 ms
    let top = db[i]
    let end = i
    for (let k = i, quiet = 0; k < db.length && quiet < 5 && (k - i) * 0.002 < 1.5; k++) {
      top = Math.max(top, db[k])
      if (db[k] > top - 12) (end = k), (quiet = 0)
      else quiet++
    }
    out.push({ i, at: i * 0.002, len: (end - i + 1) * 0.002 })
  }
  return { events: out, peak, seconds: n / sr }
}
const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${BASE}/?ep=7`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready)
// this browser allows sound untouched, so the programme has started with its sound on
// wait until every effect clip is in hand, so that it is the recordings being measured and not the stand-ins
await page.waitForFunction(() => {
  const a = window.__jop.audio
  const names = Object.values(a.groups).flat()
  return a.on && names.every((n) => a.cache[n])
}, null, { timeout: 20000 }).catch(() => console.log('  (some effect clips did not load in time)'))
await page.waitForTimeout(300)
const about = await page.evaluate(() => {
  const j = window.__jop
  const d = j.audio.ctx.createMediaStreamDestination()
  j.audio.master.connect(d)
  window.__tape = d.stream
  // the music is checked by itself at the end; while the brush is being measured it would only be in the way
  j.audio.music.gain.value = 0
  return { on: j.audio.on, state: j.audio.ctx.state, voiced: Object.keys(j.audio.voiceDur).length, groups: Object.entries(j.audio.groups).map(([g, n]) => `${g} x${n.length}`), featured: j.audio.featured }
})
console.log(`sound on: ${about.on} (${about.state}); ${about.voiced} lines recorded, episodes ${about.featured.join(', ') || 'none'} complete`)
console.log(`effect clips: ${about.groups.join(', ') || 'none yet, stand-ins are playing'}`)
ok(about.on && about.state === 'running', 'the sound does not come on with the first click')

/** run the programme in real time from where `seekTo` leaves it, recording for `seconds` */
async function record(name, seekTo, seconds, how = {}, pg = page) {
  const b64 = await pg.evaluate(async ([seekSrc, secs]) => {
    const j = window.__jop
    j.show.setSpeed(8)
    new Function('j', seekSrc)(j)
    j.show.setSpeed(1)
    const rec = new MediaRecorder(window.__tape, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 })
    const chunks = []
    rec.ondataavailable = (e) => chunks.push(e.data)
    rec.start()
    await new Promise((r) => setTimeout(r, secs * 1000))
    await new Promise((r) => {
      rec.onstop = r
      rec.stop()
    })
    const buf = new Uint8Array(await new Blob(chunks).arrayBuffer())
    let s = ''
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return btoa(s)
  }, [seekTo, seconds])
  fs.writeFileSync(`${OUT}/${name}.webm`, Buffer.from(b64, 'base64'))
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${OUT}/${name}.webm`, '-ac', '1', '-ar', '22050', '-c:a', 'pcm_s16le', `${OUT}/${name}.wav`])
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${OUT}/${name}.wav`, '-lavfi', 'showspectrumpic=s=1400x420:legend=1:scale=log:fscale=lin:stop=9000:color=magma', `${OUT}/${name}.png`])
  fs.rmSync(`${OUT}/${name}.webm`)
  return events(`${OUT}/${name}.wav`, how)
}

// 1. the beating. Go to the wash-and-beat, run up to just before the strikes begin, and listen.
console.log('\nthe brush beaten on the easel')
let r = await record('beating', `j.seek('beat'); const b = j.show.beats[j.show.bi]; while (j.show.bt < b.hitAt - 0.25) j.show.update(1 / 60 / 8);`, 2.9)
{
  const hits = r.events.filter((e) => e.len < 0.2)
  const gaps = hits.slice(1).map((e, i) => e.at - hits[i].at).filter((g) => g < 0.3)
  const per = gaps.length ? 1 / median(gaps) : 0
  const span = hits.length ? hits[hits.length - 1].at - hits[0].at : 0
  console.log(`  ${hits.length} strikes over ${span.toFixed(2)}s, one every ${(median(gaps) * 1000).toFixed(0)} ms (${per.toFixed(1)} a second), each ${(median(hits.map((e) => e.len)) * 1000).toFixed(0)} ms long`)
  console.log('  the programme: 22 strikes over 1.95s, one every 88 ms (11.3 a second), each about 40 ms')
  ok(hits.length >= 20 && hits.length <= 24, `expected about 22 strikes, heard ${hits.length}`)
  ok(per > 10.3 && per < 12.3, `expected about 11.3 strikes a second, heard ${per.toFixed(1)}`)
  // on the programme a hand does this, and the gaps run from 80 to 110 ms
  console.log(`  gaps from ${(Math.min(...gaps) * 1000).toFixed(0)} to ${(Math.max(...gaps) * 1000).toFixed(0)} ms (the programme: 80 to 110)`)
  ok(Math.min(...gaps) > 0.066 && Math.max(...gaps) < 0.112, `the strikes are uneven: gaps from ${(Math.min(...gaps) * 1000).toFixed(0)} to ${(Math.max(...gaps) * 1000).toFixed(0)} ms`)
}

// 2. tapping in foliage
console.log('\na tapping brush')
await page.evaluate(() => window.__jop.show.skip({ no: 7 })) // restart the episode
await page.waitForFunction(() => window.__jop.show.state.kind === 'title' && window.__jop.show.ep.no === 7)
r = await record('tapping', `for (let i = 0; i < 40000; i++) { const b = j.show.beats[j.show.bi]; if (b && b.kind === 'paint' && b.job.style === 'dab' && b.job.plate === 'sharp' && j.show.bt > 0.6) break; j.show.update(1 / 60 / 8) }`, 4.2, { apart: 0.08 })
{
  const taps = r.events.filter((e) => e.len < 0.25)
  const gaps = taps.slice(1).map((e, i) => e.at - taps[i].at).filter((g) => g < 0.6)
  const per = gaps.length ? 1 / median(gaps) : 0
  console.log(`  ${taps.length} taps in ${r.seconds.toFixed(1)}s, one every ${(median(gaps) * 1000).toFixed(0)} ms (${per.toFixed(1)} a second), each ${(median(taps.map((e) => e.len)) * 1000).toFixed(0)} ms long`)
  console.log('  the programme: one every 195 ms (5.1 a second), each about 60 ms')
  ok(taps.length >= 10, `expected a run of taps, heard ${taps.length}`)
  ok(per > 3.5 && per < 7.5, `expected about 5 taps a second, heard ${per.toFixed(1)}`)
  ok(median(taps.map((e) => e.len)) < 0.16, `a tap should be a short thud, these last ${(median(taps.map((e) => e.len)) * 1000).toFixed(0)} ms`)
}

// 3. strokes: criss-cross sky
console.log('\ncriss-cross strokes')
await page.evaluate(() => window.__jop.show.skip({ no: 7 }))
await page.waitForFunction(() => window.__jop.show.state.kind === 'title' && window.__jop.show.ep.no === 7 && window.__jop.show.bt < 1)
r = await record('strokes', `for (let i = 0; i < 40000; i++) { const b = j.show.beats[j.show.bi]; if (b && b.kind === 'paint' && b.job.style === 'criss' && b.job.plate === 'sharp' && j.show.bt > 0.9) break; j.show.update(1 / 60 / 8) }`, 3.6, { rise: 7, look: 0.09, apart: 0.12, smooth: 12 })
{
  const st = r.events
  const gaps = st.slice(1).map((e, i) => e.at - st[i].at).filter((g) => g < 0.8)
  const per = gaps.length ? 1 / median(gaps) : 0
  console.log(`  ${st.length} strokes in ${r.seconds.toFixed(1)}s (${per.toFixed(1)} a second), each ${(median(st.map((e) => e.len)) * 1000).toFixed(0)} ms long`)
  console.log('  the programme: 4 to 5 a second, each about 200 ms')
  ok(st.length >= 8, `expected a run of strokes, heard ${st.length}`)
  ok(per > 2.5 && per < 9, `expected 4 to 6 strokes a second, heard ${per.toFixed(1)}`)
}

// 4. Cobb's voice. Play the start of an episode he has recorded in full and compare what comes out of the
//    page with the recordings themselves: he should be heard for about as long as the lines run.
if (about.featured.length) {
  const no = about.featured[0]
  console.log(`\nCobb's voice, episode ${no}`)
  await page.evaluate((n) => window.__jop.show.skip({ no: n }), no)
  await page.waitForFunction((n) => window.__jop.show.ep.no === n && window.__jop.show.state.kind === 'title' && window.__jop.show.bt < 1, no)
  const cues = await page.evaluate(() => {
    const j = window.__jop
    const b = j.show.beats[1]
    return { speaks: j.show.speaks, voiced: j.show.voiced, lines: j.show.beats.flatMap((x) => x.cues).length, talk: b.cues.map((c) => ({ at: c.at, dur: c.dur, text: c.text })), dur: b.dur }
  })
  ok(cues.speaks && cues.voiced === cues.lines, `episode ${no} is not fully voiced (${cues.voiced} of ${cues.lines})`)
  const secs = Math.min(cues.dur, 14)
  r = await record('voice', `j.seek('talk')`, secs)
  // how much of that time is there a voice? count 20 ms steps well above the room's hush
  const buf = fs.readFileSync(`${OUT}/voice.wav`)
  const data = buf.indexOf('data') + 8
  const step = 441
  let loud = 0
  let steps = 0
  for (let i = data; i + step * 2 <= buf.length; i += step * 2) {
    let e = 0
    for (let k = 0; k < step; k++) e += (buf.readInt16LE(i + k * 2) / 32768) ** 2
    steps++
    if (10 * Math.log10(e / step + 1e-12) > -42) loud++
  }
  const heard = (loud * 0.02)
  const expected = cues.talk.filter((c) => c.at < secs).reduce((a, c) => a + Math.min(c.dur, secs - c.at), 0)
  console.log(`  his first lines: ${cues.talk.map((c) => `"${c.text.slice(0, 34)}…" ${c.dur}s`).join(', ')}`)
  console.log(`  in ${secs.toFixed(1)}s of the programme the recordings run ${expected.toFixed(1)}s; a voice was heard for ${heard.toFixed(1)}s (peak ${r.peak.toFixed(0)} dB)`)
  ok(heard > expected * 0.55 && heard < expected * 1.25 + 0.5, `expected to hear about ${expected.toFixed(1)}s of speech, heard ${heard.toFixed(1)}s`)
} else console.log("\nCobb's voice: no episode has been recorded in full yet")

// 4b. a requested episode, of a Pebble he has never painted: he must still be heard
{
  const req = { no: 7777, kind: 'tall', color: 'teal', job: 'pirate', hair: 'beehive', hairColor: 'pink' }
  await page.evaluate((q) => window.__jop.show.skip(q), req)
  await page.waitForFunction(() => window.__jop.show.ep.no === 7777 && window.__jop.show.state.kind === 'title' && window.__jop.show.bt < 1)
  const info = await page.evaluate(() => {
    const j = window.__jop
    const cues = j.show.beats.flatMap((b) => b.cues)
    const b = j.show.beats[1]
    return { title: j.show.ep.title, speaks: j.show.speaks, voiced: j.show.voiced, lines: cues.length, dur: b.dur, talk: b.cues.map((c) => ({ at: c.at, dur: c.dur })) }
  })
  const secs = Math.min(info.dur, 10)
  r = await record('request', `j.seek('talk')`, secs)
  const buf = fs.readFileSync(`${OUT}/request.wav`)
  const data = buf.indexOf('data') + 8
  let loud = 0
  for (let i = data; i + 882 <= buf.length; i += 882) {
    let e = 0
    for (let k = 0; k < 441; k++) e += (buf.readInt16LE(i + k * 2) / 32768) ** 2
    if (10 * Math.log10(e / 441 + 1e-12) > -42) loud++
  }
  const expected = info.talk.filter((c) => c.at < secs).reduce((a, c) => a + Math.min(c.dur, secs - c.at), 0)
  console.log(`\na requested episode ("${info.title}"): ${info.voiced} of ${info.lines} lines recorded; in its first ${secs.toFixed(1)}s the recordings run ${expected.toFixed(1)}s and a voice was heard for ${(loud * 0.02).toFixed(1)}s`)
  ok(info.speaks && info.voiced === info.lines && info.lines >= 20, `a requested episode is not fully spoken (${info.voiced} of ${info.lines})`)
  ok(loud * 0.02 > expected * 0.55 && expected > 3, `expected about ${expected.toFixed(1)}s of speech in a requested episode, heard ${(loud * 0.02).toFixed(1)}s`)
}

// 5. the theme, on the title card
await page.evaluate(() => {
  const j = window.__jop
  j.audio.music.gain.value = 0.55
  j.show.skip({ no: 7 })
})
await page.waitForFunction(() => window.__jop.show.ep.no === 7 && window.__jop.show.state.kind === 'title' && window.__jop.show.bt < 0.6)
r = await record('theme', '', 3.5, { rise: 8, look: 0.05, apart: 0.15, smooth: 8 })
console.log(`\nthe theme, under the title card: peak ${r.peak.toFixed(0)} dB, ${r.events.length} notes begin in the first ${r.seconds.toFixed(1)}s`)
ok(r.peak > -40, 'no music on the title card')

// 6. a first visit, in a browser that will not play sound until it is clicked: from the click to the sound
{
  const blocked = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=document-user-activation-required'] })
  const p2 = await blocked.newPage({ viewport: { width: 1280, height: 800 } })
  p2.on('pageerror', (e) => errors.push(e.message))
  // no questions until it has loaded and decided how to start: a question from here counts as a touch
  await p2.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 })
  await p2.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.show.held && !document.getElementById('bPlay').hidden, null, { timeout: 45000 })
  // everything it will need is fetched while it waits
  const ready = await p2.waitForFunction(() => {
    const a = window.__jop.audio
    return a.ctx && Object.values(a.groups).flat().every((n) => a.cache[n])
  }, null, { timeout: 20000 }).then(() => true, () => false)
  ok(ready, 'the sounds are not fetched while it waits to be started')
  await p2.evaluate(() => {
    const j = window.__jop
    const d = j.audio.ctx.createMediaStreamDestination()
    j.audio.master.connect(d)
    window.__tape = d.stream
  })
  const t0 = Date.now()
  await p2.mouse.click(640, 250)
  await p2.waitForFunction(() => window.__jop.audio.on && window.__jop.audio.ctx.state === 'running' && !window.__jop.show.held && window.__jop.show.clock > 0)
  const ms = Date.now() - t0
  const rr = await record('first-click', '', 2.5, { rise: 8, look: 0.05, apart: 0.15, smooth: 8 }, p2)
  const st = await p2.evaluate(() => ({ kind: window.__jop.show.state.kind, clock: window.__jop.show.clock, ep: window.__jop.show.ep.no, url: location.pathname + location.search }))
  console.log(`\na first visit: waiting behind the play button; ${ms} ms after one click the programme is running with sound`)
  console.log(`  in the 2.5s that follow: peak ${rr.peak.toFixed(0)} dB, the first sound ${rr.events.length ? (rr.events[0].at * 1000).toFixed(0) + ' ms in' : 'never'}; then at "${st.kind}", ${st.clock.toFixed(1)}s into episode ${st.ep}; address ${st.url}`)
  ok(ms < 700, `it took ${ms} ms to start after the click`)
  ok(rr.peak > -40 && rr.events.length > 0 && rr.events[0].at < 0.6, 'nothing is heard straight after the click')
  ok(st.kind === 'title' && st.clock < 4.5, 'the click did not start the programme from the top')
  await blocked.close()
}

if (errors.length) ok(false, `page errors: ${[...new Set(errors)].join(' | ')}`)
await browser.close()
console.log(fails.length ? `\n${fails.length} FAILED\n${fails.join('\n')}` : '\nALL PASSED')
process.exit(fails.length ? 1 : 0)
