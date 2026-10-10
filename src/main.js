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
const screen = $('screen')

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
const anyNo = () => 1 + Math.floor(Math.random() * 9998)
let firstNo = Math.max(0, parseInt(q.get('ep'), 10) || 0) // 0: let the first voiced episode open the programme
let requestFor = firstNo
// What comes next. With the sound on it is the next episode Cobb has recorded, round and round;
// with it off there is nothing to hear, so it is simply another Pebble.
const nextNo = (no) => {
  const f = audio.featured
  if (audio.on && f.length) return f[(f.indexOf(no) + 1) % f.length]
  return f.includes(no) ? anyNo() : no + 1
}
show.nextNo = nextNo
const play = (no, req = {}) => {
  request = req
  requestFor = no
  remember(no, req)
  show.skip({ no, ...req })
}

// ── sound. A browser will not let a page make a noise until it has been touched, so the picture
//    asks: the first click, tap or key anywhere turns the sound on. ────────────────────────────────
const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {}
  },
}
let wantSound = store.get('jop-sound') !== 'off' && !q.has('mute')
const showSound = () => {
  $('bSound').setAttribute('aria-pressed', String(audio.on))
  $('soundText').textContent = audio.on ? ' on' : ' off'
  $('soundcue').hidden = audio.on || !wantSound
  screen.classList.toggle('cue', !$('soundcue').hidden)
}
const setSound = (on) => {
  audio.enable(on)
  wantSound = on
  store.set('jop-sound', on ? 'on' : 'off')
  if (on && show.speaks) audio.preload(show.beats.flatMap((b) => b.cues).map((c) => c.id))
  showSound()
}
$('soundcueText').textContent = matchMedia('(pointer: coarse)').matches ? 'tap for sound' : 'click for sound'
/** true if this touch was spent on turning the sound on */
const firstTouch = () => {
  if (audio.on || !wantSound) return false
  setSound(true)
  return true
}

// ── the strip of controls: comes when the mouse moves or the screen is tapped, goes after a moment ──
let barTimer = 0
const showBar = (ms = 3200) => {
  screen.classList.add('on')
  clearTimeout(barTimer)
  barTimer = setTimeout(() => {
    if (!$('bar').matches(':hover') && !$('bar').contains(document.activeElement)) screen.classList.remove('on')
    else showBar(1500)
  }, ms)
}
const hideBar = () => {
  clearTimeout(barTimer)
  screen.classList.remove('on')
  if ($('bar').contains(document.activeElement)) document.activeElement.blur()
}
screen.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') showBar()
})
$('bar').addEventListener('focusin', () => showBar())
$('bar').addEventListener('click', () => showBar())

const SPEEDS = [1, 2, 4, 8]
const setSpeed = (x) => {
  show.setSpeed(x)
  $('speedText').textContent = `${x}\u00D7`
}
const pause = () => {
  show.togglePause()
  $('bPause').setAttribute('aria-pressed', String(show.paused))
}
const next = () => play(nextNo(show.ep?.no ?? firstNo))
$('bPause').addEventListener('click', pause)
$('bSpeed').addEventListener('click', () => setSpeed(SPEEDS[(SPEEDS.indexOf(show.speed) + 1) % SPEEDS.length]))
$('bNext').addEventListener('click', next)
$('bSound').addEventListener('click', () => setSound(!audio.on))
$('soundcue').addEventListener('click', (e) => {
  e.stopPropagation()
  setSound(true)
})
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
const mail = setupMail((choice) => play(anyNo(), choice))
$('bMail').addEventListener('click', () => mail.open(show.ep?.spec))

// the picture itself: a mouse click pauses, as on any video; a finger brings the controls up or sends them away
screen.addEventListener('pointerup', (e) => {
  if (e.target.closest('.bar, .soundcue, dialog')) return
  if (firstTouch()) return showBar()
  if (e.pointerType === 'mouse') {
    if (e.button === 0) pause()
    showBar()
  } else if (screen.classList.contains('on')) hideBar()
  else showBar(4200)
})

window.addEventListener('keydown', (e) => {
  if (mail.isOpen || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key !== 'Tab' && e.key !== 'Shift') firstTouch()
  if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return
  if (e.key === ' ' || e.key === 'k') pause()
  else if (e.key === 'ArrowRight' || e.key === 'n') next()
  else if (e.key === 'f') $('bSpeed').click()
  else if (e.key === 'm') setSound(!audio.on)
  else if (e.key === 'Escape') return hideBar()
  else return
  showBar(1800)
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
new ResizeObserver(() => stage.resize()).observe(screen)
window.addEventListener('orientationchange', () => setTimeout(() => stage.resize(), 200))
stage.resize()
showSound()

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
  await audio.ready
  if (!firstNo) firstNo = requestFor = audio.featured[0] ?? anyNo()
  await show.play(firstNo, request)
  remember(firstNo, request)
}
boot().catch((err) => {
  console.error(err)
  ui.osd('NO SIGNAL', 0)
})

// for the QA scripts: run the programme forward without waiting for it
window.__jop = {
  show, stage, painter, ui, audio, nextNo,
  advance(seconds, step = 1 / 30) {
    for (let t = 0; t < seconds; t += step) show.update(step / show.speed)
  },
  /** run until a beat of this kind (and label) begins; returns its index or -1 */
  seek(kind, label, limit = 900) {
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
