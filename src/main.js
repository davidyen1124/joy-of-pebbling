import '@fontsource/caprasimo/400.css'
import '@fontsource/inknut-antiqua/500.css'
import '@fontsource/inknut-antiqua/800.css'
import '@fontsource/vt323/400.css'
import '@fontsource/yellowtail/400.css'
import './styles.css'
import { Painter } from './painter.js'
import { Stage } from './stage.js'
import { Show } from './show.js'
import { UI } from './ui.js'
import { Audio } from './audio.js'
import { setupMail } from './mail.js'

const $ = (id) => document.getElementById(id)
const q = new URLSearchParams(location.search)
const small = Math.min(window.innerWidth, window.innerHeight) < 560

const painter = new Painter(small ? 576 : 768)
const stage = new Stage($('gl'), painter)
const ui = new UI()
const audio = new Audio()
const show = new Show({ stage, painter, ui, audio })

// ── the address remembers which Pebble this is, so it can be sent to a friend ──
const KEYS = { k: 'kind', c: 'color', h: 'hair', hc: 'hairColor', j: 'job', bg: 'plate' }
const readRequest = () => {
  const req = {}
  for (const [short, key] of Object.entries(KEYS)) if (q.get(short)) req[key] = q.get(short)
  return req
}
const remember = (no, req = {}) => {
  const p = new URLSearchParams()
  p.set('ep', no)
  for (const [short, key] of Object.entries(KEYS)) if (req[key]) p.set(short, req[key])
  history.replaceState(null, '', `${location.pathname}?${p}`)
}
let request = readRequest()
const firstNo = Math.max(1, parseInt(q.get('ep'), 10) || 1 + Math.floor(Math.random() * 9998))
let requestFor = firstNo
const play = (no, req = {}) => {
  request = req
  requestFor = no
  remember(no, req)
  show.skip({ no, ...req })
}

// ── controls ────────────────────────────────────────────────────────────────
const SPEEDS = [1, 2, 4, 8]
const setSpeed = (x) => {
  show.setSpeed(x)
  $('speedText').textContent = `Speed ${x}×`
}
$('bSpeed').addEventListener('click', () => setSpeed(SPEEDS[(SPEEDS.indexOf(show.speed) + 1) % SPEEDS.length]))
const pause = () => {
  show.togglePause()
  $('bPause').setAttribute('aria-pressed', String(show.paused))
}
$('bPause').addEventListener('click', pause)
const next = () => play((show.ep?.no ?? firstNo) + 1)
$('bNext').addEventListener('click', next)
const sound = () => {
  audio.enable(!audio.on)
  $('bSound').setAttribute('aria-pressed', String(audio.on))
}
$('bSound').addEventListener('click', sound)
$('bVoice').addEventListener('click', () => {
  const on = audio.setVoice(!audio.voice)
  $('bVoice').setAttribute('aria-pressed', String(on))
})
if (!('speechSynthesis' in window)) $('bVoice').disabled = true
$('bSave').addEventListener('click', () => {
  painter.canvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `joy-of-pebbling-ep${show.ep?.no ?? 0}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }, 'image/png')
})
const mail = setupMail((choice) => play(1 + Math.floor(Math.random() * 9998), choice))
$('bMail').addEventListener('click', () => mail.open(show.ep?.spec))

window.addEventListener('keydown', (e) => {
  if (mail.isOpen || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return
  if (e.key === ' ' || e.key === 'k') pause()
  else if (e.key === 'ArrowRight' || e.key === 'n') next()
  else if (e.key === 'f') $('bSpeed').click()
  else if (e.key === 'm') sound()
  else return
  e.preventDefault()
})

// when an episode ends by itself the show moves on; keep the address in step
let lastNo = 0
const follow = () => {
  if (show.ep && show.ep.no !== lastNo) {
    lastNo = show.ep.no
    remember(lastNo, lastNo === requestFor ? request : {})
  }
}

// ── go ──────────────────────────────────────────────────────────────────────
new ResizeObserver(() => stage.resize()).observe($('tube'))
stage.resize()

let last = performance.now()
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  show.update(dt)
  follow()
  requestAnimationFrame(frame)
}

async function boot() {
  requestAnimationFrame(frame)
  const layout = await fetch('/models/layout.json').then((r) => r.json())
  await stage.load('/models/set.glb', layout)
  if (q.get('speed')) setSpeed(Math.max(1, Math.min(8, +q.get('speed') || 1)))
  await show.play(firstNo, request)
  remember(firstNo, request)
}
boot().catch((err) => {
  console.error(err)
  ui.osd('NO SIGNAL', 0)
})

// for the QA scripts: run the programme forward without waiting for it
window.__jop = {
  show, stage, painter, ui, audio,
  advance(seconds, step = 1 / 30) {
    for (let t = 0; t < seconds; t += step) show.update(step / show.speed)
  },
  /** run until a beat of this kind (and label) begins; returns its index or -1 */
  seek(kind, label, limit = 600) {
    const start = show.state.episodes
    for (let t = 0; t < limit; t += 1 / 30) {
      const s = show.state
      if (s.episodes !== start) return -1
      if (s.kind === kind && (!label || s.label === label)) return s.beat
      show.update(1 / 30 / show.speed)
    }
    return -1
  },
}
