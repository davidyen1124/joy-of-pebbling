// QA for The Joy of Pebbling. Drives the real page in Chromium at thirteen window sizes and measures
// it; then runs whole episodes end to end; then checks the brush keeps the rhythm measured off the real
// programme; then draws every tall-hair/tall-hat Pebble to make sure nothing is cut off by the canvas.
//
//   BASE=http://127.0.0.1:5191 node scripts/qa.mjs          (dev server, or a preview of the build)
//   BASE=https://… node scripts/qa.mjs                      (the deployed site)
//   node scripts/qa.mjs layout|direct|returning|episodes|rhythm|fit|webkit   (one part)
//
// Writes screenshots to qa/shots/ and exits 1 if anything failed.
import { chromium, webkit } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://127.0.0.1:5191'
const OUT = 'qa/shots'
fs.mkdirSync(OUT, { recursive: true })

const SIZES = [
  ['desktop', 1440, 900, 1, false],
  ['desktop-hd', 1920, 1080, 1, false],
  ['laptop', 1280, 720, 2, false],
  ['ultrawide', 2560, 1080, 1, false],
  ['short', 1024, 640, 1, false],
  ['square', 900, 900, 1, false],
  ['tablet-tall', 820, 1180, 2, true],
  ['tablet-wide', 1180, 820, 2, true],
  ['phone', 390, 844, 3, true],
  ['phone-small', 360, 640, 2, true],
  ['phone-tiny', 320, 568, 2, true],
  ['phone-wide', 844, 390, 3, true],
  ['phone-wide-small', 667, 375, 2, true],
]

const fails = []
const notes = []
const fail = (where, what) => {
  fails.push(`${where}: ${what}`)
  console.log(`  FAIL ${where}: ${what}`)
}
const ok = (cond, where, what) => {
  if (!cond) fail(where, what)
  return cond
}

// A browser as a first-time visitor has it: it will not let a page be heard until the page is touched.
// (Said outright: left to itself this browser allows sound on some addresses and not on others.)
const GL = ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist']
const ARGS = [...GL, '--autoplay-policy=document-user-activation-required']
// And one that will (as for a site the viewer listens to often).
const FREE = [...GL, '--autoplay-policy=no-user-gesture-required']

async function open(browser, w, h, dpr, touch, query = 'ep=12') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch && browser.browserType().name() === 'chromium' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    // a missing recording manifest is expected until the voice has been recorded
    if (m.type() === 'error' && !/manifest\.json|404/.test(m.text() + m.location().url)) errors.push('console: ' + m.text())
  })
  page.on('requestfailed', (r) => !/\/src\//.test(r.url()) && errors.push('request failed: ' + r.url()))
  page.on('response', (r) => {
    // a built site has no recordings list until they are made, and no source modules at all
    if (r.status() >= 400 && !/\/(voice|sfx)\/manifest\.json|\/src\//.test(r.url())) errors.push(`${r.status()}: ${r.url()}`)
  })
  // Nothing may be asked of the page until it has finished loading and has decided how to start: to
  // the browser, a question from this script counts as the viewer touching the page, and a page that
  // has been touched is allowed its sound. So wait for the network to fall quiet first.
  await page.goto(`${BASE}/?${query}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready, null, { timeout: 45000 })
  await page.evaluate(() => document.fonts.ready)
  return { ctx, page, errors }
}

// everything measured in the page, in one go
const measure = () => {
  const R = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }
  }
  const vis = (el) => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && +getComputedStyle(el).opacity > 0.05 && el.getClientRects().length > 0
  const q = (s) => document.querySelector(s)
  const doc = document.documentElement
  const j = window.__jop
  // the picture itself: is anything on it? Read the drawing back, in the top and the bottom half.
  j.show.update(0)
  const gl = j.stage.renderer.getContext()
  const W = gl.drawingBufferWidth
  const H = gl.drawingBufferHeight
  const px = new Uint8Array(4)
  const spread = (y0, y1) => {
    let sum = 0
    let sq = 0
    let n = 0
    for (let y = y0; y < y1; y += (y1 - y0) / 7) {
      for (let x = 0.08; x < 0.95; x += 0.08) {
        gl.readPixels(Math.floor(x * W), Math.floor(y * H), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
        const l = (px[0] + px[1] + px[2]) / 3
        sum += l
        sq += l * l
        n++
      }
    }
    return Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2))
  }
  const cc = q('#cc span')
  const top = j.stage.topShare
  return {
    vw: innerWidth, vh: innerHeight,
    scroll: { w: doc.scrollWidth, h: doc.scrollHeight },
    gl: R(q('#gl')),
    split: j.stage.split, top,
    bar: q('#screen').classList.contains('on') || q('#bar').matches(':focus-within'),
    keys: [...document.querySelectorAll('.bar-keys button')].map((k) => ({ id: k.id, ...R(k), clipped: k.scrollWidth > k.clientWidth + 1, icon: R(k.querySelector('svg')), glyph: /[\u2190-\u2BFF]/.test(k.textContent) })),
    play: vis(q('#bPlay')) ? R(q('#bPlay')) : null,
    held: j.show.held,
    clock: j.show.clock,
    cc: cc.textContent ? { ...R(cc), text: cc.textContent, lines: new Set([...cc.getClientRects()].map((r) => Math.round(r.top))).size } : null,
    color: vis(q('#colorname')) ? { ...R(q('#colorname')), text: q('#colorname').textContent } : null,
    lower: vis(q('#lower')) ? R(q('#lower')) : null,
    title: vis(q('#titlecard')) ? { main: R(q('.tc-main')), the: R(q('.tc-the')), wth: R(q('.tc-with')), slate: R(q('#slate')) } : null,
    credits: vis(q('#credits')) ? [...q('#credits').children].map(R) : null,
    picture: top ? { upper: spread(1 - top + 0.03, 0.97), lower: spread(0.05, 1 - top - 0.03) } : { upper: spread(0.5, 0.95), lower: spread(0.08, 0.5), all: spread(0.08, 0.95) },
    state: { ...j.show.state }, shot: j.stage.shot, mode: j.stage.mode,
    fonts: ['Caprasimo', 'Inknut Antiqua', 'VT323', 'Yellowtail'].map((f) => document.fonts.check(`20px "${f}"`)),
  }
}

const inside = (a, b, pad = 0.5) => a && b && a.x >= b.x - pad && a.y >= b.y - pad && a.r <= b.r + pad && a.b <= b.b + pad
const overlap = (a, b) => a && b && a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1

async function layout(browser, [name, w, h, dpr, touch]) {
  console.log(`\n${name} ${w}x${h} @${dpr}${touch ? ' touch' : ''}`)
  const { ctx, page, errors } = await open(browser, w, h, dpr, touch)
  const shot = (n) => page.screenshot({ path: `${OUT}/${name}-${n}.png` })
  const view = { x: 0, y: 0, r: w, b: h }
  const upright = w / h < 0.8

  // 1. a first visit: the title card waits behind a play button, and there is nothing else on screen
  await page.waitForTimeout(500)
  let m = await page.evaluate(measure)
  ok(m.fonts.every(Boolean), name, `fonts not loaded: ${m.fonts}`)
  ok(m.scroll.w <= m.vw && m.scroll.h <= m.vh, name, `page scrolls: ${m.scroll.w}x${m.scroll.h} in ${m.vw}x${m.vh}`)
  ok(Math.abs(m.gl.w - w) < 1 && Math.abs(m.gl.h - h) < 1 && m.gl.x === 0 && m.gl.y === 0, name, `the picture does not fill the window: ${JSON.stringify(m.gl)}`)
  ok(m.split === upright, name, `expected ${upright ? 'the two-part' : 'a single'} picture`)
  ok(m.held && m.play, name, 'it is not waiting behind a play button')
  ok(m.play && inside(m.play, view) && m.play.w >= 88 && m.play.h >= 88, name, `the play button is off the screen or small: ${JSON.stringify(m.play)}`)
  ok(!m.bar && (await page.evaluate(() => getComputedStyle(document.getElementById('bar')).display === 'none')), name, 'the controls can be seen before it has started')
  ok(m.state.kind === 'title' && m.title, name, 'no title card at the start')
  if (m.title) for (const [k, r] of Object.entries(m.title)) ok(inside(r, view, 1), name, `title card: "${k}" runs off the screen`)
  if (m.title) ok(!overlap(m.title.main, m.title.slate) && !overlap(m.title.wth, m.title.slate) && !overlap(m.title.the, m.title.main), name, 'title card: lines overlap')
  if (m.title && m.play) for (const [k, r] of Object.entries(m.title)) ok(!overlap(m.play, r), name, `the play button covers the title card's "${k}"`)
  await page.waitForTimeout(350)
  ok((await page.evaluate(() => window.__jop.show.clock)) === 0, name, 'the programme is running before it has been started')
  await shot('1-poster')

  // 2. one click or tap, anywhere, starts it from the top with its sound
  await (touch ? page.touchscreen.tap(w * 0.5, h * 0.3) : page.mouse.click(w * 0.5, h * 0.3))
  await page.waitForTimeout(700)
  let s = await page.evaluate(() => ({ on: window.__jop.audio.on, state: window.__jop.audio.ctx?.state, paused: window.__jop.show.paused, held: window.__jop.show.held, kind: window.__jop.show.state.kind, clock: window.__jop.show.clock, play: !document.getElementById('bPlay').hidden }))
  ok(!s.held && !s.play, name, 'still waiting after it was touched')
  ok(s.on && s.state === 'running', name, `the first ${touch ? 'tap' : 'click'} does not turn the sound on (${JSON.stringify(s)})`)
  ok(!s.paused, name, 'the first touch paused the programme')
  ok(s.kind === 'title' && s.clock > 0.25 && s.clock < 1.6, name, `it did not start from the top at once (${s.kind}, ${s.clock.toFixed(2)}s)`)
  // the controls come when called
  await (touch ? page.touchscreen.tap(w * 0.5, h * 0.62) : page.mouse.move(w * 0.5, h * 0.62))
  await page.waitForTimeout(250)
  m = await page.evaluate(measure)
  ok(m.bar, name, 'the controls do not come when the screen is touched')
  for (const k of m.keys) {
    ok(inside(k, view), name, `control ${k.id} is off the screen`)
    ok(k.w >= 44 && k.h >= 44, name, `control ${k.id} is too small to press: ${Math.round(k.w)}x${Math.round(k.h)}`)
    ok(!k.clipped, name, `control ${k.id} clips its label`)
  }
  for (let i = 0; i < m.keys.length; i++) for (let k = i + 1; k < m.keys.length; k++) ok(!overlap(m.keys[i], m.keys[k]), name, `controls ${m.keys[i].id} and ${m.keys[k].id} overlap`)
  ok(new Set(m.keys.map((k) => Math.round(k.y))).size <= 2, name, `the controls take ${new Set(m.keys.map((k) => Math.round(k.y))).size} rows`)
  // every control has a drawn symbol, all of one size, and none is a character borrowed from a font
  ok(m.keys.every((k) => k.icon && k.icon.w > 8) && !m.keys.some((k) => k.glyph), name, 'a control has no drawn symbol, or uses a character for one')
  const iw = m.keys.map((k) => (k.icon ? k.icon.w : 0))
  const ih = m.keys.map((k) => (k.icon ? k.icon.h : 0))
  ok(Math.max(...iw) - Math.min(...iw) < 0.5 && Math.max(...ih) - Math.min(...ih) < 0.5, name, `the symbols on the controls are different sizes: ${iw.map((v) => v.toFixed(1)).join(', ')}`)
  ok(!(await page.evaluate(() => /parody|affiliated/i.test(document.body.innerText))), name, 'the small print is back')
  await shot('2-controls')
  // ...and they go away again by themselves
  await page.mouse.move(2, h - 2)
  await page.waitForTimeout(touch ? 4600 : 3700)
  ok(!(await page.evaluate(() => document.getElementById('screen').classList.contains('on'))), name, 'the controls do not go away')

  // 3. Cobb says hello
  await page.evaluate(() => {
    window.__jop.seek('talk')
    window.__jop.advance(1.4)
  })
  m = await page.evaluate(measure)
  ok(m.picture.upper > 6 && m.picture.lower > 6, name, `part of the picture is blank (${JSON.stringify(m.picture)})`)
  ok(m.lower && inside(m.lower, view), name, 'the name caption is off the screen')
  ok(m.cc && m.cc.text.length > 5, name, 'no caption')
  ok(m.cc && inside(m.cc, view), name, 'the caption runs off the screen')
  ok(m.cc && m.cc.lines <= 3, name, `caption wraps to ${m.cc?.lines} lines`)
  ok(!overlap(m.cc, m.lower), name, 'the caption covers the name caption')
  await shot('3-hello')

  // 4. the first colour is named, at the palette
  await page.evaluate(() => {
    window.__jop.seek('paint')
    window.__jop.advance(0.5)
  })
  m = await page.evaluate(measure)
  ok(m.color && m.color.text.length > 3, name, 'no colour name')
  ok(m.color && inside(m.color, view), name, 'the colour name runs off the screen')
  if (m.cc) ok(!overlap(m.cc, m.color), name, 'the caption covers the colour name')
  ok(m.shot === 'palette', name, `expected the palette shot, got ${m.shot}`)
  if (upright) ok(m.color.b <= h * m.top + 2, name, 'the colour name is not on the canvas half')
  await shot('4-palette')

  // 4b. washing the brush: there is a bucket, it is in the picture, and the brush is in it
  const wash = await page.evaluate(() => {
    const j = window.__jop
    j.seek('beat')
    j.advance(j.show.beats[j.show.bi].washAt + 0.8)
    j.show.update(0)
    const st = j.stage
    const mid = st.bucket.position.clone()
    mid.y += st.layout.bucket.h / 2
    const n = mid.project(st.camera)
    return { mode: st.mode, x: n.x, y: n.y, off: Math.hypot(st.tipPos.x - st.bucket.position.x, st.tipPos.z - st.bucket.position.z), tipY: st.tipPos.y, r: st.layout.bucket.r, h: st.layout.bucket.h }
  })
  ok(wash.mode === 'wash', name, `expected him to be washing the brush, got ${wash.mode}`)
  ok(Math.abs(wash.x) < 0.97 && Math.abs(wash.y) < 0.97, name, `the bucket is out of the picture (${wash.x.toFixed(2)}, ${wash.y.toFixed(2)})`)
  ok(wash.off < wash.r && wash.tipY < wash.h && wash.tipY > 0.02, name, `the brush is not in the bucket (${wash.off.toFixed(2)} from its middle, ${wash.tipY.toFixed(2)} up)`)
  await shot('4b-wash')

  // 5. painting the body
  const v0 = await page.evaluate(() => {
    window.__jop.seek('paint', 'body')
    window.__jop.advance(1.6)
    return window.__jop.painter.version
  })
  await page.evaluate(() => window.__jop.advance(2.4))
  m = await page.evaluate(measure)
  ok((await page.evaluate(() => window.__jop.painter.version)) > v0, name, 'the painting is not changing')
  ok(m.mode === 'paint', name, `expected him to be painting, got ${m.mode}`)
  ok(m.picture.upper > 10 && m.picture.lower > 6, name, `part of the picture is blank while painting (${JSON.stringify(m.picture)})`)
  await shot('5-body')

  // 6. the hair, from further back
  await page.evaluate(() => {
    window.__jop.seek('paint', 'hair')
    window.__jop.advance(2.4)
    window.__jop.stage.cut('wide')
    window.__jop.advance(0.3)
  })
  await shot('6-hair-wide')

  // 7. credits
  await page.evaluate(() => {
    window.__jop.show.setSpeed(8)
    window.__jop.seek('credits')
    window.__jop.show.setSpeed(1)
    window.__jop.advance(3.3)
  })
  m = await page.evaluate(measure)
  ok(m.credits && m.credits.length > 0, name, 'no credits')
  if (m.credits) for (const c of m.credits) ok(inside(c, view), name, 'credits run off the screen')
  if (m.credits && upright) for (const c of m.credits) ok(c.b <= h * m.top + 2, name, 'credits are not on the canvas half')
  await shot('7-credits')

  // 8. the controls do what they say
  const bar = async () => {
    if (touch) {
      if (!(await page.evaluate(() => document.getElementById('screen').classList.contains('on')))) await page.touchscreen.tap(w * 0.5, h * 0.62)
    } else await page.mouse.move(w * 0.4 + Math.random() * 20, h * 0.6)
    await page.waitForTimeout(260)
  }
  const press = async (id) => {
    await bar()
    await (touch ? page.tap(id) : page.click(id))
  }
  await press('#bPause')
  ok(await page.evaluate(() => window.__jop.show.paused), name, 'pause does not pause')
  const c0 = await page.evaluate(() => window.__jop.show.clock)
  await page.waitForTimeout(250)
  ok((await page.evaluate(() => window.__jop.show.clock)) === c0, name, 'the tape keeps running while paused')
  await press('#bPause')
  ok(!(await page.evaluate(() => window.__jop.show.paused)), name, 'pause does not let go')
  await press('#bSpeed')
  ok((await page.evaluate(() => window.__jop.show.speed)) === 2, name, 'speed does not change')
  ok((await page.textContent('#speedText')).includes('2'), name, 'speed label does not change')
  await press('#bSound')
  ok(!(await page.evaluate(() => window.__jop.audio.on)), name, 'sound does not turn off')
  await press('#bSound')
  ok(await page.evaluate(() => window.__jop.audio.on), name, 'sound does not turn back on')
  if (!touch) {
    // a click on the picture pauses, as on any video; keys work
    await page.mouse.click(w * 0.5, h * 0.7)
    ok(await page.evaluate(() => window.__jop.show.paused), name, 'a click on the picture does not pause')
    await page.keyboard.press('k')
    ok(!(await page.evaluate(() => window.__jop.show.paused)), name, 'the k key does not resume')
  }
  // with the sound on, Next is the next episode Cobb has recorded
  const [before, after, featured] = await page.evaluate(() => [window.__jop.show.ep.no, window.__jop.nextNo(window.__jop.show.ep.no), window.__jop.audio.featured])
  if (featured.length) ok(featured.includes(after), name, `Next would go to episode ${after}, which is not one of the recorded ones (${featured})`)
  await press('#bNext')
  await page.waitForFunction((n) => window.__jop.show.ep.no === n && window.__jop.show.state.kind === 'title', after, { timeout: 8000 }).catch(() => fail(name, 'Next does not start the next episode'))
  ok(!page.url().includes('?'), name, `the address is not left clean: ${page.url()}`)
  if (featured.length) ok(await page.evaluate(() => window.__jop.show.speaks && window.__jop.show.voiced === window.__jop.show.beats.flatMap((b) => b.cues).length), name, 'the episode after Next is not fully voiced')

  // 9. viewer mail
  await press('#bMail')
  await page.waitForTimeout(250)
  const d = await page.evaluate(() => {
    const R = (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }
    }
    return { open: document.getElementById('mail').open, box: R(document.querySelector('.mail-in')), send: R(document.getElementById('mailSend')), random: R(document.getElementById('mailRandom')), x: R(document.querySelector('.mail .x')), chips: [...document.querySelectorAll('.mail .chip')].map(R) }
  })
  ok(d.open, name, 'viewer mail does not open')
  ok(inside(d.box, view), name, 'viewer mail does not fit the window')
  ok(inside(d.send, d.box) && inside(d.random, d.box) && inside(d.x, d.box), name, 'viewer mail buttons are outside the sheet')
  ok(d.chips.every((c) => c.w >= 36 && c.h >= 36), name, 'viewer mail choices are too small to press')
  for (const sel of ['#optKind .chip[data-id="tall"]', '#optJob .chip[data-id="wizard"]', '#optHair .chip[data-id="beehive"]', '#optHairColor .chip[data-id="pink"]', '#optColor .chip[data-id="sap"]']) {
    await page.locator(sel).scrollIntoViewIfNeeded()
    await page.click(sel)
  }
  await shot('8-mail')
  await page.click('#mailSend')
  await page.waitForFunction(() => window.__jop.show.ep.spec.job === 'wizard' && window.__jop.show.state.kind === 'title', null, { timeout: 8000 }).catch(() => fail(name, 'a request is not painted'))
  const sp = await page.evaluate(() => window.__jop.show.ep.spec)
  ok(sp.kind === 'tall' && sp.hair === 'beehive' && sp.hairColor === 'pink' && sp.color === 'sap', name, `the request was not honoured: ${JSON.stringify(sp)}`)
  ok(!page.url().includes('?'), name, `the address is not left clean after a request: ${page.url()}`)
  // the sound is on: Cobb must have something recorded to say in a requested episode, all the way through
  const rq = await page.evaluate(() => {
    const j = window.__jop
    const cues = j.show.beats.flatMap((b) => b.cues)
    return { speaks: j.show.speaks, voiced: j.show.voiced, lines: cues.length, said: cues.reduce((t, c) => t + c.dur, 0), total: j.show.total, on: j.audio.on }
  })
  ok(rq.on && rq.speaks && rq.voiced === rq.lines && rq.lines >= 20 && rq.said > rq.total * 0.5, name, `a requested episode is not spoken: ${JSON.stringify(rq)}`)
  await page.evaluate(() => {
    window.__jop.show.setSpeed(8)
    window.__jop.seek('outro')
    window.__jop.show.setSpeed(1)
    window.__jop.advance(1.2)
  })
  await page.mouse.move(3, h - 3)
  await page.waitForTimeout(touch ? 4600 : 3700)
  m = await page.evaluate(measure)
  ok(m.scroll.w <= m.vw && m.scroll.h <= m.vh, name, 'page scrolls after a request')
  await shot('9-request-done')
  ok(errors.length === 0, name, `errors: ${[...new Set(errors)].join(' | ')}`)
  notes.push(`${name}: ${upright ? `two-part picture, canvas takes the top ${(m.top * 100).toFixed(0)}%` : 'single picture'}`)
  await ctx.close()
}

// in a browser that allows it, the programme simply starts: no button, no click, sound and all
async function direct() {
  console.log('\na browser that will play sound untouched')
  const free = await chromium.launch({ args: FREE })
  for (const [name, w, h, touch] of [['direct-desktop', 1440, 900, false], ['direct-phone', 390, 844, true]]) {
    const ctx = await free.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${BASE}/`, { waitUntil: 'load' })
    await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready && window.__jop.show.state.kind === 'title', null, { timeout: 45000 })
    await page.waitForTimeout(900)
    const s = await page.evaluate(() => {
      const j = window.__jop
      return { held: j.show.held, on: j.audio.on, state: j.audio.ctx?.state, play: !document.getElementById('bPlay').hidden, kind: j.show.state.kind, clock: j.show.clock, url: location.pathname + location.search, ep: j.show.ep.no, featured: j.audio.featured, speaks: j.show.speaks }
    })
    ok(!s.held && !s.play, name, 'it waits behind a play button although sound is allowed')
    ok(s.on && s.state === 'running', name, `it started without its sound (${JSON.stringify(s)})`)
    ok(s.clock > 0.5, name, 'the programme is not running')
    ok(s.url === '/', name, `the address has been written on: ${s.url}`)
    if (s.featured.length) ok(s.featured[0] === s.ep && s.speaks, name, `it does not open with an episode Cobb has recorded (episode ${s.ep})`)
    ok(errors.length === 0, name, `errors: ${errors.join(' | ')}`)
    console.log(`  ${name}: playing ${s.kind} at ${s.clock.toFixed(1)}s, sound ${s.on ? 'on' : 'off'}, episode ${s.ep}, address ${s.url}`)
    await ctx.close()
  }
  await free.close()
}

// Things a fresh, fast, well-behaved test browser never does. A returning visitor's browser has kept
// yesterday's copies of the files it was told it could keep; networks fail; people click before a page
// has finished loading. (The first of these once left the live page on static for good, with every
// other check here passing.)
async function returning(browser) {
  console.log('\na returning visitor, and other misfortunes')
  const visit = async (name, setup, go = 'networkidle') => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await ctx.newPage()
    const errors = []
    const asked = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 200))
    })
    page.on('request', (r) => asked.push(r.url().replace(/^https?:\/\/[^/]+/, '')))
    if (setup) await setup(page)
    await page.goto(`${BASE}/`, { waitUntil: go, timeout: 60000 })
    return { ctx, page, errors, asked }
  }
  const state = (page) => page.evaluate(() => {
    const j = window.__jop
    return { ready: j.stage.ready, ep: j.show.ep?.no ?? null, held: j.show.held, paused: j.show.paused, on: j.audio.on, clock: j.show.clock, kind: j.show.state.kind, bucket: !!j.stage.bucket, play: !document.getElementById('bPlay').hidden, retry: !document.getElementById('bRetry').hidden }
  })

  // 1. Anything a browser may keep must be asked for by an address that changes when the file does.
  {
    const { ctx, page, errors, asked } = await visit('stamped')
    const kept = asked.filter((u) => /^\/(models|plates|sfx|voice)\//.test(u))
    const bare = kept.filter((u) => !/\?v=[0-9a-f]{6,}/.test(u))
    console.log(`  ${kept.length} files a browser may keep were asked for; ${bare.length} without a stamp in the address`)
    ok(kept.length >= 10, 'returning', `expected the page to fetch its studio, pictures and sounds; it asked for ${kept.length}`)
    ok(bare.length === 0, 'returning', `asked for by an address that never changes: ${bare.slice(0, 4).join(', ')}`)
    const st = await state(page)
    ok(st.ready && st.ep && st.bucket, 'returning', `a first visit did not load: ${JSON.stringify(st)}`)
    ok(errors.length === 0, 'returning', `errors: ${errors.join(' | ')}`)
    await ctx.close()
  }

  // 2. A studio file from before there was a bucket in it: the programme must still run.
  {
    const { ctx, page, errors } = await visit('old studio', async (page) => {
      await page.route(/\/models\/set\.glb/, async (route) => {
        const res = await route.fetch()
        const body = Buffer.from((await res.body()).toString('latin1').replaceAll('bucket', 'bvcket'), 'latin1')
        await route.fulfill({ response: res, body })
      })
      await page.route(/\/models\/layout\.json/, async (route) => {
        const res = await route.fetch()
        const json = await res.json()
        delete json.bucket
        await route.fulfill({ response: res, json })
      })
    })
    const st = await state(page)
    ok(st.ready && st.ep && !st.bucket, 'old studio', `with an older studio file the page did not load: ${JSON.stringify(st)}`)
    const after = await page.evaluate(() => {
      const j = window.__jop
      j.seek('beat')
      j.advance(j.show.beats[j.show.bi].dur + 1)
      return { kind: j.show.state.kind, mode: j.stage.mode }
    })
    await page.waitForTimeout(400)
    const c0 = await page.evaluate(() => window.__jop.show.clock)
    await page.waitForTimeout(500)
    ok((await page.evaluate(() => window.__jop.show.clock)) > c0, 'old studio', 'the picture stopped after he washed the brush')
    ok(errors.length === 0, 'old studio', `errors: ${errors.join(' | ')}`)
    console.log(`  with a studio file that has no bucket: loaded, washed the brush without one, carried on to "${after.kind}"`)
    await ctx.close()
  }

  // 3. The studio cannot be fetched at all: it must say so, in the middle of the screen, with a way out.
  {
    const { ctx, page } = await visit('no studio', (page) => page.route(/\/models\/set\.glb/, (route) => route.abort()))
    await page.waitForTimeout(600)
    const st = await state(page)
    const r = await page.evaluate(() => {
      const b = document.getElementById('bRetry').getBoundingClientRect()
      return { x: b.left, y: b.top, r: b.right, b: b.bottom, text: document.getElementById('bRetry').innerText.replace(/\s+/g, ' '), bar: getComputedStyle(document.getElementById('bar')).display }
    })
    ok(st.retry && r.x >= 0 && r.y >= 0 && r.r <= 1280 && r.b <= 800 && /no signal/i.test(r.text), 'no studio', `it does not say it has failed: ${JSON.stringify({ ...st, ...r })}`)
    ok(!st.play && r.bar === 'none', 'no studio', 'controls or a play button are offered for a programme that is not there')
    console.log(`  when the studio cannot be fetched: "${r.text}" in the middle of the screen`)
    await ctx.close()
  }

  // 4. Clicks while it is still loading: nothing breaks, nothing is paused, and since the page has been
  //    touched it is allowed its sound and simply starts.
  {
    const { ctx, page, errors } = await visit('early clicks', (page) => page.route(/\/models\/set\.glb/, async (route) => {
      await new Promise((r) => setTimeout(r, 1600))
      await route.continue()
    }), 'domcontentloaded')
    await page.waitForTimeout(350)
    await page.mouse.click(640, 400)
    await page.waitForTimeout(300)
    await page.mouse.click(640, 400)
    await page.keyboard.press('Space')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(900)
    const st = await state(page)
    ok(errors.length === 0, 'early clicks', `errors: ${errors.join(' | ')}`)
    ok(st.ready && st.ep && !st.paused, 'early clicks', `clicks during loading left it ${JSON.stringify(st)}`)
    ok(!st.held && st.on && st.clock > 0.3, 'early clicks', `having been touched, it should have started with its sound: ${JSON.stringify(st)}`)
    console.log(`  clicked twice and pressed space while loading: started by itself, sound ${st.on ? 'on' : 'off'}, ${st.clock.toFixed(1)}s in, not paused`)
    await ctx.close()
  }
}

async function episodes(browser) {
  console.log('\nwhole episodes, start to finish')
  const { ctx, page, errors } = await open(browser, 1280, 800, 1, false, 'ep=1&mute')
  const known = await page.evaluate(async () => {
    try {
      const { allLines } = await import('/src/lines.js')
      return allLines().map((l) => l.id)
    } catch {
      return null
    }
  })
  if (!known) console.log('  (which lines are recorded cannot be cross-checked against the source on a built site)')
  const featured = await page.evaluate(() => window.__jop.audio.featured)
  console.log(`  episodes with every line recorded: ${featured.join(', ') || 'none'}`)
  for (const no of [...featured, 1, 2, 3, 5, 9, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 9998]) {
    const r = await page.evaluate(async (n) => {
      const j = window.__jop
      j.show.skip({ no: n })
      await new Promise((res) => {
        const t = setInterval(() => {
          if (j.show.ep && j.show.ep.no === n && j.show.state.kind === 'title') {
            clearInterval(t)
            res()
          }
        }, 20)
      })
      j.show.setSpeed(8)
      const cues = j.show.beats.flatMap((b) => b.cues)
      const voiced = j.show.voiced
      const speaks = j.show.speaks
      const beats = j.show.beats.length
      const total = Math.round(j.show.total)
      const at = j.seek('credits')
      // has paint reached the canvas? compare it with its primed colour
      const c = j.painter.ctx.getImageData(0, 0, j.painter.W, j.painter.H).data
      let dark = 0
      let n2 = 0
      for (let i = 0; i < c.length; i += 4 * 97) {
        n2++
        if (Math.abs(c[i] - 242) + Math.abs(c[i + 1] - 239) + Math.abs(c[i + 2] - 231) > 30) dark++
      }
      // let it run off the end by itself
      j.advance(j.show.beats[j.show.beats.length - 1].dur + 0.5)
      await new Promise((res) => setTimeout(res, 400))
      j.show.setSpeed(1)
      return { at, beats, total, painted: dark / n2, nextNo: j.show.ep.no, lines: cues.map((q) => q.text), ids: cues.map((q) => q.id), voiced, speaks }
    }, no)
    ok(r.at > 15, `ep ${no}`, 'never reached the credits')
    ok(r.painted > 0.9, `ep ${no}`, `canvas only ${(r.painted * 100).toFixed(0)}% painted at the end`)
    // with the sound off: on from a recorded episode to any other, otherwise to the next number
    if (featured.includes(no)) {
      ok(r.nextNo !== no, `ep ${no}`, 'did not roll on to another episode')
      ok(r.voiced === r.lines.length && r.speaks, `ep ${no}`, `listed as fully recorded but only ${r.voiced} of ${r.lines.length} lines are`)
    } else ok(r.nextNo === no + 1, `ep ${no}`, `did not roll on to the next episode (now ${r.nextNo})`)
    ok(r.speaks === r.voiced >= r.lines.length * 0.8, `ep ${no}`, 'speaks when it should not, or the reverse')
    ok(r.total > 110 && r.total < 260, `ep ${no}`, `odd running time ${r.total}s`)
    const bad = r.lines.filter((l) => /\{|\}|undefined|null|NaN|\ba (?!uni|use|one|eu)[aeiou]/i.test(l))
    ok(bad.length === 0, `ep ${no}`, `bad line: ${bad[0]}`)
    if (known) {
      const stray = r.ids.findIndex((id) => !known.includes(id))
      ok(stray < 0, `ep ${no}`, `says a line that is not on the recording list: "${r.lines[stray]}"`)
    }
    console.log(`  ep ${no}: ${r.beats} beats, ${r.lines.length} lines (${r.voiced} recorded), ${r.total}s, ${(r.painted * 100).toFixed(0)}% painted`)
  }
  ok(errors.length === 0, 'episodes', `errors: ${[...new Set(errors)].join(' | ')}`)
  await ctx.close()
}

// the brush should work at the pace measured off the real programme, and say so to the sound
async function rhythm(browser) {
  console.log('\nthe pace of the brush, against the real programme')
  const { ctx, page } = await open(browser, 1280, 800, 1, false, 'ep=7&mute')
  const sum = {}
  let hits = 0
  let hitSpan = 0
  for (const ep of [7, 12, 24, 40]) {
    const rows = await page.evaluate(async (n) => {
      const j = window.__jop
      j.show.skip({ no: n })
      await new Promise((res) => {
        const t = setInterval(() => {
          if (j.show.ep && j.show.ep.no === n && j.show.state.kind === 'title') {
            clearInterval(t)
            res()
          }
        }, 20)
      })
      const out = []
      let cur = null
      const stamps = []
      j.painter.onStroke = () => cur && cur.strokes++
      j.painter.onTap = () => cur && cur.taps++
      j.stage.onHit = () => stamps.push(j.show.clock)
      let last = -1
      for (let t = 0; t < 500 && j.show.state.kind !== 'credits'; t += 1 / 60) {
        const s = j.show.state
        if (s.beat !== last) {
          last = s.beat
          const b = j.show.beats[s.beat]
          cur = b && b.kind === 'paint' ? { style: b.job.style + (b.job.plate ? ':' + b.job.plate : ''), dur: b.job.dur, strokes: 0, taps: 0 } : null
          if (cur) out.push(cur)
        }
        j.show.update(1 / 60)
      }
      return { out, hits: stamps.length, span: stamps.length ? stamps[stamps.length - 1] - stamps[0] : 0 }
    }, ep)
    for (const r of rows.out) {
      const s = (sum[r.style] ||= { dur: 0, strokes: 0, taps: 0 })
      s.dur += r.dur
      s.strokes += r.strokes
      s.taps += r.taps
    }
    hits += rows.hits
    hitSpan += rows.span
  }
  const rate = (k, what) => (sum[k] ? sum[k][what] / sum[k].dur : NaN)
  const check = (label, v, lo, hi, real) => {
    console.log(`  ${label.padEnd(34)} ${v.toFixed(1)} a second   (the programme: ${real})`)
    ok(v >= lo && v <= hi, 'rhythm', `${label}: ${v.toFixed(1)} a second, expected ${lo} to ${hi}`)
  }
  check('criss-cross strokes, blocking in', rate('criss:blur', 'strokes'), 3, 7.5, '4 to 5')
  check('criss-cross strokes, detail', rate('criss:sharp', 'strokes'), 3, 8, '4 to 5')
  check('taps, foliage', rate('dab:sharp', 'taps'), 3.5, 7.5, '5.1')
  check('knife scrapes', rate('knife:sharp', 'strokes'), 1, 4, '1.3, in bursts')
  check('taps, the Pebble', rate('dab', 'taps'), 0.8, 7.5, 'about 5 when he taps')
  check('strikes on the easel', hits / hitSpan, 10, 12.5, '11.3')
  ok(hits / 4 >= 19 && hits / 4 <= 25, 'rhythm', `${hits / 4} strikes a beating, expected about 22`)
  console.log(`  ${'strikes in one beating'.padEnd(34)} ${(hits / 4).toFixed(0)}              (the programme: 22)`)
  await ctx.close()
}

async function fit(browser) {
  console.log('\nevery kind x tall hair x tall hat, and every job and haircut: inside the canvas?')
  const { ctx, page } = await open(browser, 1000, 700, 1, false, 'ep=1&mute')
  const r = await page.evaluate(async () => {
    const { buildPebble } = await import('/src/pebble.js').catch(() => ({}))
    return buildPebble ? 'dev' : 'built'
  })
  if (r !== 'dev') {
    console.log('  (skipped: needs the dev server, which serves the source modules)')
    await ctx.close()
    return
  }
  const out = await page.evaluate(async () => {
    const { buildPebble } = await import('/src/pebble.js')
    const D = await import('/src/data.js')
    const cv = document.createElement('canvas')
    cv.width = 1024
    cv.height = 768
    const c = cv.getContext('2d', { willReadFrequently: true })
    const bad = []
    let n = 0
    const check = (spec, cx) => {
      c.clearRect(0, 0, 1024, 768)
      const b = buildPebble({ ...spec, seed: 3 }, { cx, ground: 0.9 * 768 })
      for (const s of b.steps) {
        c.save()
        s.draw(c)
        c.restore()
      }
      const d = c.getImageData(0, 0, 1024, 768).data
      let x0 = 1024
      let y0 = 768
      let x1 = 0
      let y1 = 0
      let any = false
      for (let y = 0; y < 768; y += 2) for (let x = 0; x < 1024; x += 2) if (d[(y * 1024 + x) * 4 + 3] > 40) {
        any = true
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
      n++
      if (!any) bad.push(`${JSON.stringify(spec)}: nothing drawn`)
      else if (y0 < 6 || x0 < 6 || x1 > 1017 || y1 > 766) bad.push(`${spec.kind}/${spec.hair}/${spec.job} at ${cx}: touches the edge (${x0},${y0})-(${x1},${y1})`)
      return y0
    }
    let top = 768
    for (const k of D.KINDS) for (const h of ['beehive', 'afro', 'mohawk', 'spiky', 'bun']) for (const j of ['wizard', 'chef', 'royal', 'astronaut', 'cowboy']) for (const cx of [442, 582]) top = Math.min(top, check({ kind: k.id, color: 'pblue', hair: h, hairColor: 'brown', job: j.id || j }, cx))
    for (const j of D.JOBS) for (const h of D.HAIRS) check({ kind: 'classic', color: 'sap', hair: h.id, hairColor: 'pink', job: j.id }, 512)
    for (const k of D.KINDS) for (const j of D.JOBS) check({ kind: k.id, color: 'red', hair: 'long', hairColor: 'black', job: j.id }, 582)
    return { n, bad, top }
  })
  console.log(`  ${out.n} Pebbles drawn; the tallest comes within ${out.top}px of the top`)
  for (const b of out.bad.slice(0, 12)) fail('fit', b)
  if (out.bad.length > 12) fail('fit', `...and ${out.bad.length - 12} more`)
  await ctx.close()
}

const only = process.argv[2]
const browser = await chromium.launch({ args: ARGS })
if (!only || only === 'layout') for (const s of SIZES) await layout(browser, s)
if (!only || only === 'direct') await direct()
if (!only || only === 'returning') await returning(browser)
if (!only || only === 'episodes') await episodes(browser)
if (!only || only === 'rhythm') await rhythm(browser)
if (!only || only === 'fit') await fit(browser)
await browser.close()

// one pass in WebKit too, at a desktop and a phone size: does it start, fill the window and paint?
if (!only || only === 'webkit') {
  console.log('\nWebKit (Safari engine)')
  try {
    const wk = await webkit.launch()
    for (const [name, w, h, dpr, touch] of [['wk-desktop', 1440, 900, 1, false], ['wk-phone', 390, 844, 3, true]]) {
      const { ctx, page, errors } = await open(wk, w, h, dpr, touch)
      const r = await page.evaluate(() => {
        const j = window.__jop
        j.seek('paint', 'body')
        j.advance(3)
        const d = document.documentElement
        const g = document.getElementById('gl').getBoundingClientRect()
        return { scroll: d.scrollHeight <= innerHeight && d.scrollWidth <= innerWidth, fills: Math.abs(g.width - innerWidth) < 1 && Math.abs(g.height - innerHeight) < 1, v: j.painter.version, kind: j.show.state.label, split: j.stage.split }
      })
      ok(r.scroll, name, 'page scrolls')
      ok(r.fills, name, 'the picture does not fill the window')
      ok(r.v > 50 && r.kind === 'body', name, 'not painting')
      ok(r.split === w / h < 0.8, name, 'wrong kind of picture for this shape of window')
      await page.screenshot({ path: `${OUT}/${name}.png` })
      ok(errors.length === 0, name, `errors: ${[...new Set(errors)].join(' | ')}`)
      console.log(`  ${name}: fills=${r.fills} painting=${r.kind} ${r.split ? 'two-part' : 'single'}`)
      await ctx.close()
    }
    await wk.close()
  } catch (e) {
    fail('webkit', e.message.split('\n')[0])
  }
}

console.log('\n' + notes.join('\n'))
console.log(fails.length ? `\n${fails.length} FAILED\n${fails.join('\n')}` : '\nALL PASSED')
process.exit(fails.length ? 1 : 0)
