// node scripts/shot.mjs <url> <out.png> [width] [height] [waitMs] [fullPage]
import { chromium } from 'playwright'

const [url, out, w = '1400', h = '900', wait = '600', full = ''] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(+wait)
await page.screenshot({ path: out, fullPage: !!full })
if (errors.length) console.log(errors.join('\n'))
await browser.close()
