// QA for The Joy of Pebbling. Drives the real page in Chromium at thirteen window sizes and measures
// it; then runs whole episodes end to end; then draws every tall-hair/tall-hat Pebble to make sure
// nothing is cut off by the edge of the canvas.
//
//   BASE=http://127.0.0.1:5191 node scripts/qa.mjs          (dev server, or a preview of the build)
//   BASE=https://… node scripts/qa.mjs                      (the deployed site)
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

const ARGS = ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']

async function open(browser, w, h, dpr, touch, query = 'ep=12') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch && browser.browserType().name() === 'chromium' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text())
  })
  page.on('requestfailed', (r) => errors.push('request failed: ' + r.url()))
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`)
  })
  await page.goto(`${BASE}/?${query}`, { waitUntil: 'load' })
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
  const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && !el.hidden && el.getClientRects().length > 0
  const q = (s) => document.querySelector(s)
  const doc = document.documentElement
  const keys = [...document.querySelectorAll('.keys .key')].map((k) => ({ id: k.id, ...R(k), clipped: k.scrollWidth > k.clientWidth + 1 || k.scrollHeight > k.clientHeight + 1 }))
  const cc = q('#cc span')
  const ccBox = q('#ccbox')
  // the picture itself: is anything on it?
  const j = window.__jop
  j.show.update(0)
  const gl = j.stage.renderer.getContext()
  const W = gl.drawingBufferWidth
  const H = gl.drawingBufferHeight
  const px = new Uint8Array(4)
  let sum = 0
  let sq = 0
  let n = 0
  for (let y = 0.15; y < 0.9; y += 0.1) {
    for (let x = 0.1; x < 0.95; x += 0.1) {
      gl.readPixels(Math.floor(x * W), Math.floor(y * H), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      const l = (px[0] + px[1] + px[2]) / 3
      sum += l
      sq += l * l
      n++
    }
  }
  const mean = sum / n
  return {
    vw: innerWidth, vh: innerHeight,
    scroll: { w: doc.scrollWidth, h: doc.scrollHeight },
    tube: R(q('#tube')), bezel: R(q('.bezel')), panel: R(q('.panel')), gl: R(q('#gl')),
    keys,
    fine: vis(q('.fine')) ? R(q('.fine')) : null,
    tape: R(q('#tape')), tapeTitle: { ...R(q('#epTitle')), clipped: q('#epTitle').scrollWidth > q('#epTitle').clientWidth + 1 },
    ccIn: vis(q('#cc')) && cc.textContent ? { ...R(cc), text: cc.textContent, lines: cc.getClientRects().length } : null,
    ccBox: vis(ccBox) ? { ...R(ccBox), text: q('#ccboxText').textContent.trim(), overflow: ccBox.scrollHeight > ccBox.clientHeight + 1 } : null,
    color: vis(q('#colorname')) ? { ...R(q('#colorname')), text: q('#colorname').textContent } : null,
    lower: vis(q('#lower')) ? R(q('#lower')) : null,
    title: vis(q('#titlecard')) ? { main: R(q('.tc-main')), the: R(q('.tc-the')), wth: R(q('.tc-with')), slate: R(q('#slate')) } : null,
    credits: vis(q('#credits')) ? [...q('#credits').children].map(R) : null,
    osd: R(q('#osdR')),
    picture: { mean, sd: Math.sqrt(Math.max(0, sq / n - mean * mean)) },
    state: { ...j.show.state }, shot: j.stage.shot, mode: j.stage.mode,
    fonts: ['Caprasimo', 'Inknut Antiqua', 'VT323', 'Yellowtail'].map((f) => document.fonts.check(`20px "${f}"`)),
  }
}

const inside = (a, b, pad = 0.5) => a && b && a.x >= b.x - pad && a.y >= b.y - pad && a.r <= b.r + pad && a.b <= b.b + pad
const overlap = (a, b) => a && b && a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1

async function layout(browser, [name, w, h, dpr, touch]) {
  console.log(`\n${name} ${w}x${h} @${dpr}`)
  const { ctx, page, errors } = await open(browser, w, h, dpr, touch)
  const shot = (n) => page.screenshot({ path: `${OUT}/${name}-${n}.png` })
  const view = { x: 0, y: 0, r: w, b: h }
  const portrait = h >= w

  // 1. the title card
  let m = await page.evaluate(measure)
  ok(m.fonts.every(Boolean), name, `fonts not loaded: ${m.fonts}`)
  ok(m.scroll.w <= m.vw && m.scroll.h <= m.vh, name, `page scrolls: ${m.scroll.w}x${m.scroll.h} in ${m.vw}x${m.vh}`)
  ok(inside(m.bezel, view), name, 'the television is not fully on screen')
  ok(inside(m.panel, view), name, `the panel is not fully on screen (bottom ${m.panel?.b} of ${h})`)
  ok(!overlap(m.bezel, m.panel), name, 'the screen and the panel overlap')
  ok(Math.abs(m.tube.w / m.tube.h - 4 / 3) < 0.012, name, `picture is not 4:3 (${(m.tube.w / m.tube.h).toFixed(3)})`)
  ok(m.tube.w >= (portrait ? Math.min(w * 0.82, (h - 420) * 1.3) : 0) && m.tube.h >= 200, name, `picture is small: ${Math.round(m.tube.w)}x${Math.round(m.tube.h)}`)
  const fill = (m.bezel.w * m.bezel.h + m.panel.w * m.panel.h) / (w * h)
  notes.push(`${name}: picture ${Math.round(m.tube.w)}x${Math.round(m.tube.h)}, tv+panel cover ${(fill * 100).toFixed(0)}% of the window`)
  for (const k of m.keys) {
    ok(inside(k, m.panel), name, `key ${k.id} is outside the panel`)
    ok(k.w >= 44 && k.h >= 40, name, `key ${k.id} is too small to press: ${Math.round(k.w)}x${Math.round(k.h)}`)
    ok(!k.clipped, name, `key ${k.id} clips its label`)
  }
  for (let i = 0; i < m.keys.length; i++) for (let j = i + 1; j < m.keys.length; j++) ok(!overlap(m.keys[i], m.keys[j]), name, `keys ${m.keys[i].id} and ${m.keys[j].id} overlap`)
  ok(inside(m.tape, m.panel), name, 'the tape label is outside the panel')
  ok(!m.tapeTitle.clipped, name, 'the episode title is clipped')
  if (m.fine) ok(inside(m.fine, m.panel, 1), name, `the small print is cut off (bottom ${Math.round(m.fine.b)} vs panel ${Math.round(m.panel.b)})`)
  else notes.push(`${name}: small print hidden at this size`)
  ok(m.state.kind === 'title' && m.title, name, 'no title card at the start')
  if (m.title) for (const [k, r] of Object.entries(m.title)) ok(inside(r, m.tube, 1), name, `title card: "${k}" runs outside the picture`)
  if (m.title) ok(!overlap(m.title.main, m.title.slate) && !overlap(m.title.wth, m.title.slate), name, 'title card: title and slate overlap')
  await shot('1-title')

  // 2. Cobb says hello
  await page.evaluate(() => {
    window.__jop.seek('talk')
    window.__jop.advance(1.4)
  })
  m = await page.evaluate(measure)
  ok(m.picture.sd > 12, name, `the studio picture looks blank (sd ${m.picture.sd.toFixed(1)})`)
  ok(m.lower && inside(m.lower, m.tube), name, 'the name caption is not inside the picture')
  if (portrait) {
    ok(m.ccBox && m.ccBox.text.length > 5, name, 'no caption text under the picture')
    ok(m.ccBox && !m.ccBox.overflow, name, 'the caption box overflows')
    ok(!m.ccIn, name, 'captions shown twice')
  } else {
    ok(m.ccIn && m.ccIn.text.length > 5, name, 'no caption on the picture')
    ok(m.ccIn && inside(m.ccIn, m.tube), name, 'the caption runs outside the picture')
    ok(m.ccIn && m.ccIn.lines <= 3, name, `caption wraps to ${m.ccIn?.lines} lines`)
    ok(!overlap(m.ccIn, m.lower), name, 'the caption covers the name caption')
  }
  await shot('2-hello')

  // 3. the first colour is named, at the palette
  await page.evaluate(() => {
    window.__jop.seek('paint')
    window.__jop.advance(0.5)
  })
  m = await page.evaluate(measure)
  ok(m.color && m.color.text.length > 3, name, 'no colour name')
  ok(m.color && inside(m.color, m.tube), name, 'the colour name runs outside the picture')
  if (m.ccIn) ok(!overlap(m.ccIn, m.color), name, 'the caption covers the colour name')
  ok(m.shot === 'palette', name, `expected the palette shot, got ${m.shot}`)
  await shot('3-palette')

  // 4. painting the body, close on the canvas
  const v0 = await page.evaluate(() => {
    window.__jop.seek('paint', 'body')
    window.__jop.advance(1.2)
    return window.__jop.painter.version
  })
  await page.evaluate(() => window.__jop.advance(2.2))
  m = await page.evaluate(measure)
  const v1 = await page.evaluate(() => window.__jop.painter.version)
  ok(v1 > v0, name, 'the painting is not changing')
  ok(m.mode === 'paint' && m.shot === 'canvas', name, `expected a close-up of the canvas, got ${m.shot}/${m.mode}`)
  ok(m.picture.sd > 20, name, `the canvas close-up looks blank (sd ${m.picture.sd.toFixed(1)})`)
  await shot('4-body')

  // 5. the wide shot while he paints the hair
  await page.evaluate(() => {
    window.__jop.seek('paint', 'hair')
    window.__jop.advance(2.2)
    window.__jop.stage.cut('wide')
    window.__jop.advance(0.3)
  })
  await shot('5-hair-wide')

  // 6. credits
  await page.evaluate(() => {
    window.__jop.show.setSpeed(8)
    window.__jop.seek('credits')
    window.__jop.show.setSpeed(1)
    window.__jop.advance(3.1)
  })
  m = await page.evaluate(measure)
  ok(m.credits && m.credits.length > 0, name, 'no credits')
  if (m.credits) for (const c of m.credits) ok(inside(c, m.tube), name, 'credits run outside the picture')
  await shot('6-credits')

  // 7. controls
  await page.click('#bPause')
  ok(await page.evaluate(() => window.__jop.show.paused), name, 'pause does not pause')
  const c0 = await page.evaluate(() => window.__jop.show.clock)
  await page.waitForTimeout(250)
  ok((await page.evaluate(() => window.__jop.show.clock)) === c0, name, 'the tape keeps running while paused')
  await page.click('#bPause')
  await page.click('#bSpeed')
  ok((await page.evaluate(() => window.__jop.show.speed)) === 2, name, 'speed does not change')
  ok((await page.textContent('#speedText')).includes('2'), name, 'speed label does not change')
  await page.click('#bSound')
  ok(await page.evaluate(() => window.__jop.audio.on && window.__jop.audio.ctx?.state === 'running'), name, 'sound does not start')
  await page.click('#bSound')
  const before = await page.evaluate(() => window.__jop.show.ep.no)
  await page.click('#bNext')
  await page.waitForFunction((n) => window.__jop.show.ep.no === n + 1 && window.__jop.show.state.kind === 'title', before, { timeout: 8000 }).catch(() => fail(name, 'Next Pebble does not start the next episode'))
  ok(page.url().includes(`ep=${before + 1}`), name, 'the address does not follow the episode')

  // 8. viewer mail
  await page.click('#bMail')
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
  await shot('7-mail')
  await page.click('#mailSend')
  await page.waitForFunction(() => window.__jop.show.ep.spec.job === 'wizard' && window.__jop.show.state.kind === 'title', null, { timeout: 8000 }).catch(() => fail(name, 'a request is not painted'))
  const sp = await page.evaluate(() => window.__jop.show.ep.spec)
  ok(sp.kind === 'tall' && sp.hair === 'beehive' && sp.hairColor === 'pink' && sp.color === 'sap', name, `the request was not honoured: ${JSON.stringify(sp)}`)
  ok(['k=tall', 'j=wizard', 'h=beehive'].every((x) => page.url().includes(x)), name, 'the request is not in the address')
  await page.evaluate(() => {
    window.__jop.show.setSpeed(8)
    window.__jop.seek('outro')
    window.__jop.show.setSpeed(1)
    window.__jop.advance(1.5)
  })
  m = await page.evaluate(measure)
  ok(m.scroll.w <= m.vw && m.scroll.h <= m.vh, name, 'page scrolls after a request')
  ok(!m.tapeTitle.clipped && inside(m.tape, m.panel), name, 'the tape label does not fit after a request')
  if (m.fine) ok(inside(m.fine, m.panel, 1), name, 'the small print is cut off after a request')
  await shot('8-request-done')
  ok(errors.length === 0, name, `errors: ${[...new Set(errors)].join(' | ')}`)
  await ctx.close()
}

async function episodes(browser) {
  console.log('\nwhole episodes, start to finish')
  const { ctx, page, errors } = await open(browser, 1280, 800, 1, false, 'ep=1')
  for (const no of [1, 2, 3, 5, 9, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 9998]) {
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
      const labels = j.show.beats.map((b) => b.label || b.kind)
      const at = j.seek('credits')
      // has paint reached the canvas? compare the middle of it with its primed colour
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
      return { title: j.show.state.episodes, at, labels: labels.length, total: Math.round(j.show.total), painted: dark / n2, nextNo: j.show.ep.no, lines: j.show.beats.flatMap((b) => b.lines || []) }
    }, no)
    ok(r.at > 15, `ep ${no}`, 'never reached the credits')
    ok(r.painted > 0.9, `ep ${no}`, `canvas only ${(r.painted * 100).toFixed(0)}% painted at the end`)
    ok(r.nextNo === no + 1, `ep ${no}`, `did not roll on to the next episode (now ${r.nextNo})`)
    ok(r.total > 90 && r.total < 200, `ep ${no}`, `odd running time ${r.total}s`)
    const bad = r.lines.filter((l) => /\{|\}|undefined|null|NaN|\ba (?!uni|use|one|eu)[aeiou]/i.test(l))
    ok(bad.length === 0, `ep ${no}`, `bad line: ${bad[0]}`)
    console.log(`  ep ${no}: ${r.labels} beats, ${r.total}s, ${(r.painted * 100).toFixed(0)}% painted`)
  }
  ok(errors.length === 0, 'episodes', `errors: ${[...new Set(errors)].join(' | ')}`)
  await ctx.close()
}

async function fit(browser) {
  console.log('\nevery kind x tall hair x tall hat, and every job and haircut: inside the canvas?')
  const { ctx, page } = await open(browser, 1000, 700, 1, false, 'ep=1')
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
if (!only || only === 'episodes') await episodes(browser)
if (!only || only === 'fit') await fit(browser)
await browser.close()

// one pass in WebKit too, at a phone and a desktop size: does it start, paint and fit?
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
        const t = document.getElementById('tube').getBoundingClientRect()
        return { scroll: d.scrollHeight <= innerHeight && d.scrollWidth <= innerWidth, ratio: t.width / t.height, v: j.painter.version, kind: j.show.state.label, panelB: document.querySelector('.panel').getBoundingClientRect().bottom, vh: innerHeight }
      })
      ok(r.scroll, name, 'page scrolls')
      ok(Math.abs(r.ratio - 4 / 3) < 0.012, name, `picture is not 4:3 (${r.ratio.toFixed(3)})`)
      ok(r.v > 50 && r.kind === 'body', name, 'not painting')
      ok(r.panelB <= r.vh + 0.5, name, 'panel runs off the bottom')
      await page.screenshot({ path: `${OUT}/${name}.png` })
      ok(errors.length === 0, name, `errors: ${[...new Set(errors)].join(' | ')}`)
      console.log(`  ${name}: ok=${r.scroll} ratio=${r.ratio.toFixed(3)} painting=${r.kind}`)
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
