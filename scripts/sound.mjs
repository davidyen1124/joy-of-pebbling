import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto('http://127.0.0.1:5191/?ep=4', { waitUntil: 'load' })
await page.waitForFunction(() => window.__jop && window.__jop.show.ep && window.__jop.stage.ready)
await page.click('#bSound')
await page.click('#bVoice')
const r = await page.evaluate(async () => {
  const j = window.__jop
  j.audio.theme(); j.audio.whack(0.5); j.audio.static(); j.audio.brush(0.8); j.audio.speak('Hello there.', 1)
  await new Promise((r) => setTimeout(r, 600))
  return { on: j.audio.on, voice: j.audio.voice, state: j.audio.ctx?.state, pressed: [document.getElementById('bSound').getAttribute('aria-pressed'), document.getElementById('bVoice').getAttribute('aria-pressed')] }
})
console.log(JSON.stringify(r))
// keys: space pauses, f speeds up, n goes on
await page.keyboard.press('Space'); const paused = await page.evaluate(() => window.__jop.show.paused)
await page.keyboard.press('Space'); await page.keyboard.press('f'); const speed = await page.evaluate(() => window.__jop.show.speed)
const before = await page.evaluate(() => window.__jop.show.ep.no)
await page.keyboard.press('n'); await page.waitForTimeout(900)
const after = await page.evaluate(() => window.__jop.show.ep.no)
console.log(JSON.stringify({ paused, speed, before, after, url: page.url().split('?')[1] }))
// keep it: a PNG comes down
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#bSave')])
console.log('download:', dl.suggestedFilename())
await page.waitForTimeout(300)
await page.screenshot({ path: 'qa/glitch.png' })
console.log('errors:', errors.join(' | ') || 'none')
await browser.close()
