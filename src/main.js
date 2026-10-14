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
import { drawIcons, icon } from './icons.js'
import { asset } from './asset.js'

const $ = (id) => document.getElementById(id)
const q = new URLSearchParams(location.search)
const small = Math.min(window.innerWidth, window.innerHeight) < 560
const screen = $('screen')
drawIcons()

const painter = new Painter(small ? 576 : 768)
const stage = new Stage($('gl'), painter)
const ui = new UI()
const audio = new Audio()
const show = new Show({ stage, painter, ui, audio })

// ── which Pebble. A link may name one (?ep=427, or ?j=pirate&h=beehive…); otherwise the address is
//    left alone, and it is cleared again as soon as the programme moves on from the one it named. ──
const KEYS = { k: 'kind', c: 'color', h: 'hair', hc: 'hairColor', j: 'job', bg: 'plate' }
const linked = {}
for (const [short, key] of Object.entries(KEYS)) if (q.get(short)) linked[key] = q.get(short)
const anyNo = () => 1 + Math.floor(Math.random() * 9998)
let firstNo = Math.max(0, parseInt(q.get('ep'), 10) || 0) // 0: let a voiced episode open the programme
// The episode a visit opens on, when no link names one: one Cobb has recorded, picked at random but never
// the one this browser opened on last time, so that coming back is not a rerun.
const LAST = 'jop-last'
const opener = () => {
  const f = audio.featured
  if (!f.length) return anyNo()
  let last = 0
  try {
    last = parseInt(localStorage.getItem(LAST), 10) || 0
  } catch {}
  const pool = f.length > 1 ? f.filter((n) => n !== last) : f
  return pool[Math.floor(Math.random() * pool.length)]
}
const remember = (no) => {
  try {
    localStorage.setItem(LAST, String(no))
  } catch {}
}
const tidy = () => {
  if (location.search) history.replaceState(null, '', location.pathname)
}
// What comes next. With the sound on it is the next episode Cobb has recorded, round and round;
// with it off there is nothing to hear, so it is simply another Pebble.
const nextNo = (no) => {
  const f = audio.featured
  if (audio.on && f.length) return f[(f.indexOf(no) + 1) % f.length]
  return f.includes(no) ? anyNo() : no + 1
}
show.nextNo = nextNo
const play = (no, req = {}) => {
  tidy()
  show.skip({ no, ...req })
}

// ── sound ───────────────────────────────────────────────────────────────────
// Every visit starts wanting sound. (It used to remember "off" from one visit to the next, which meant a
// silent programme with no word of explanation the next time.)
try {
  localStorage.removeItem('jop-sound')
} catch {}
audio.wanted = !q.has('mute')
const showSound = () => {
  $('bSound').setAttribute('aria-pressed', String(audio.on))
  $('bSound').firstElementChild.innerHTML = icon(audio.on ? 'sound' : 'mute')
  $('soundText').textContent = audio.on ? ' on' : ' off'
}
const setSound = (on) => {
  audio.wanted = on
  audio.enable(on)
  if (on && show.speaks) audio.preload(show.beats.flatMap((b) => b.cues).map((c) => c.id))
  showSound()
}

// ── starting. If the browser will let a page be heard without being touched, the programme simply
//    starts, with its sound. Most will not, the first time: then it waits on its title card behind a
//    play button, and the first click, tap or key anywhere starts it from the top, sound and all. ──
const hold = (on) => {
  show.held = on
  screen.classList.toggle('held', on)
  $('bPlay').hidden = !on
}
let ready = false // the first episode is loaded: until then there is nothing for a click or a key to act on
const begin = () => {
  if (!show.held || !ready) return
  hold(false)
  setSound(true)
  ui.osd('PLAY', 2.5, 'play')
  show.replay()
}
$('bPlay').addEventListener('click', begin)

// ── the strip of controls: comes when the mouse moves or the screen is tapped, goes after a moment ──
let barTimer = 0
const showBar = (ms = 3200) => {
  if (show.held || !ready) return
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
  $('speedText').textContent = `${x}×`
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
  if (!ready || e.target.closest('.bar, .nosignal, dialog')) return
  if (show.held) return begin()
  if (e.pointerType === 'mouse') {
    if (e.button === 0) pause()
    showBar()
  } else if (screen.classList.contains('on')) hideBar()
  else showBar(4200)
})

window.addEventListener('keydown', (e) => {
  if (!ready || mail.isOpen || e.metaKey || e.ctrlKey || e.altKey) return
  if (show.held) {
    if (['Tab', 'Shift', 'Escape'].includes(e.key)) return
    e.preventDefault()
    return begin()
  }
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

// when an episode ends by itself the show moves on; a link's episode is no longer the one on screen
const follow = () => {
  if (show.ep && firstNo && show.ep.no !== firstNo && location.search) tidy()
}

// ── go ──────────────────────────────────────────────────────────────────────
new ResizeObserver(() => stage.resize()).observe(screen)
window.addEventListener('orientationchange', () => setTimeout(() => stage.resize(), 200))
stage.resize()
showSound()

let last = performance.now()
let complained = ''
function frame(now) {
  requestAnimationFrame(frame) // first, so that one bad frame cannot stop the picture for good
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  try {
    show.update(dt)
    follow()
  } catch (err) {
    if (complained !== String(err)) console.error((complained = String(err)), err)
  }
}

async function boot() {
  requestAnimationFrame(frame)
  show.held = true // nothing moves until it is known whether it can be heard
  const layout = await fetch(asset('/models/layout.json')).then((r) => {
    if (!r.ok) throw new Error(`layout.json: ${r.status}`)
    return r.json()
  })
  await stage.load(asset('/models/set.glb'), layout)
  if (q.get('speed')) setSpeed(Math.max(1, Math.min(8, +q.get('speed') || 1)))
  await audio.ready
  if (!firstNo) firstNo = opener()
  remember(firstNo)
  let free = false
  if (audio.wanted) {
    audio.prepare() // everything is fetched and decoded now, so that a click is answered at once
    free = await audio.canStart()
    if (free) setSound(true)
  }
  show.held = audio.wanted && !free
  await show.play(firstNo, linked)
  hold(show.held)
  ready = true
}
// If it cannot start, say so where it will be seen, and offer the one thing that helps.
boot().catch((err) => {
  console.error(err)
  hold(false)
  show.held = true
  screen.classList.add('dead')
  $('bRetry').hidden = false
})
$('bRetry').addEventListener('click', () => location.reload())

// for the QA scripts: run the programme forward without waiting for it
window.__jop = {
  show, stage, painter, ui, audio, nextNo,
  advance(seconds, step = 1 / 30) {
    hold(false)
    for (let t = 0; t < seconds; t += step) show.update(step / show.speed)
  },
  /** run until a beat of this kind (and label) begins; returns its index or -1 */
  seek(kind, label, limit = 900) {
    hold(false)
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
