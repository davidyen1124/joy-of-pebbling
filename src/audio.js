// Sound. Three kinds, all silent until the viewer asks for sound:
//
//   Cobb's voice    one recording per line, made ahead of time (scripts/voice.mjs), listed in
//                   /voice/manifest.json with how long each runs. The show times itself to them.
//   Effects         recorded clips listed in /sfx/manifest.json (scripts/sfx.mjs): brush strokes, taps,
//                   knife scrapes, the brush beaten on the easel, the wash bucket, a theme.
//   Stand-ins       until a clip exists, the same sound is built here from filtered noise, shaped to
//                   what was measured off the real programme: a tap is a 60 ms thud, a strike on the
//                   easel is a broadband crack over a low thump, a stroke is a bright scratchy hiss.
//
// Every stroke, tap and strike that is drawn is played: the painter and the stage call in as they happen.
import { asset } from './asset.js'

const VOICE = '/voice/'
const SFX = '/sfx/'

export class Audio {
  constructor() {
    this.on = false
    this.wanted = true // the viewer has not turned the sound off
    this.ctx = null
    this.speed = 1
    this.voiceDur = {}
    this.featured = [] // episodes in which every line has a recording
    this.groups = {} // 'tap' -> ['tap1', 'tap2', ...]
    this.raw = new Map() // url -> Promise<ArrayBuffer | null>
    this.buffers = new Map() // url -> Promise<AudioBuffer | null>
    this.files = {} // clip name -> file name
    this.cache = {} // clip name -> AudioBuffer, once it is in hand
    this.turn = {}
    this.voiceNode = null
    this.lastTap = 0
    this.ready = this.manifests()
  }

  async manifests() {
    const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    const [v, s] = await Promise.all([get(asset(`${VOICE}manifest.json`)), get(asset(`${SFX}manifest.json`))])
    if (v?.lines) this.voiceDur = v.lines
    if (Array.isArray(v?.featured)) this.featured = v.featured
    for (const [name, file] of Object.entries(s?.clips || {})) {
      const g = name.replace(/\d+$/, '')
      ;(this.groups[g] ||= []).push(name)
      this.files[name] = file
    }
  }

  /** seconds a line's recording runs, or undefined if there is none */
  durationOf(id) {
    return this.voiceDur[id]
  }

  /** fetch and decode what will be needed, so that nothing has to be waited for once sound is allowed */
  prepare() {
    if (!this.ctx) this.build()
    if (this.ctx) this.warm()
  }

  /**
   * Will the browser let this page be heard without being touched first? Some do (a site the viewer
   * visits and listens to often), most do not. Ask, and wait a moment for the answer.
   */
  async canStart() {
    if (!this.ctx) return false
    if (this.ctx.state !== 'running') {
      await Promise.race([this.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 350))])
    }
    return this.ctx.state === 'running'
  }

  enable(on) {
    this.on = on
    if (on && !this.ctx) this.build()
    if (this.ctx) {
      if (on) {
        this.ctx.resume()
        this.warm()
      }
      this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04)
    }
    if (!on) this.hush()
    return !!this.ctx
  }

  build() {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    // An iPhone with its ringer switch on silent stops whatever a page plays through Web Audio alone:
    // Safari takes that for a game's noises. This is a programme, to be heard as a video is, and Safari
    // will take the page's word for it if told before the sound is set up.
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback'
    } catch {}
    const ctx = (this.ctx = new AC())
    this.master = ctx.createGain()
    this.master.gain.value = 0
    // a gentle limiter, so a flurry of strikes cannot clip
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -10
    comp.ratio.value = 6
    comp.attack.value = 0.003
    comp.release.value = 0.12
    this.master.connect(comp).connect(ctx.destination)
    const bus = (g) => {
      const n = ctx.createGain()
      n.gain.value = g
      n.connect(this.master)
      return n
    }
    this.voiceBus = bus(1)
    this.fx = bus(0.8)
    this.music = bus(0.55)
    // noise, with a grain to it like bristles dragging: everything that hisses is cut from this
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let g = 1
    let target = 1
    for (let i = 0; i < len; i++) {
      if (i % 96 === 0) target = 0.35 + Math.random() * 0.65
      g += (target - g) * 0.03
      d[i] = (Math.random() * 2 - 1) * g
    }
    this.noise = buf
    this.room()
  }

  // ── loading ───────────────────────────────────────────────────────────────
  fetchRaw(url) {
    if (!this.raw.has(url)) this.raw.set(url, fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null))
    return this.raw.get(url)
  }

  load(url) {
    if (!this.buffers.has(url)) {
      this.buffers.set(url, this.fetchRaw(url).then((ab) => (ab && this.ctx ? this.ctx.decodeAudioData(ab.slice(0)) : null)).catch(() => null))
    }
    return this.buffers.get(url)
  }

  /** fetch the recordings for lines that are coming up (unless the viewer has turned the sound off) */
  preload(ids) {
    if (!this.ctx || !this.wanted) return
    for (const id of ids) if (this.voiceDur[id] !== undefined) this.load(asset(`${VOICE}${id}.mp3`))
  }

  // ── Cobb ──────────────────────────────────────────────────────────────────
  say(id) {
    this.hush()
    if (!this.on || !this.ctx || this.speed > 1.01 || this.voiceDur[id] === undefined) return false
    const asked = this.ctx.currentTime
    const token = (this.voiceToken = {})
    this.load(asset(`${VOICE}${id}.mp3`)).then((buf) => {
      // if it arrives late, or he has moved on, let it go
      if (!buf || this.voiceToken !== token || !this.on || this.ctx.currentTime - asked > 1.0) return
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      src.connect(this.voiceBus)
      src.start()
      this.voiceNode = src
    })
    return true
  }

  hush() {
    this.voiceToken = null
    try {
      this.voiceNode?.stop()
    } catch {}
    this.voiceNode = null
  }

  // ── effects ───────────────────────────────────────────────────────────────
  /** fetch every effect once the sound is on, so that each is in hand before it is wanted */
  warm() {
    for (const names of Object.values(this.groups)) {
      for (const name of names) if (!this.cache[name]) this.load(asset(SFX + this.files[name])).then((buf) => buf && (this.cache[name] = buf))
    }
  }

  /**
   * Play a recorded clip from a group at an exact time. Returns false if there is none in hand (the
   * caller then plays the stand-in instead, so nothing is ever late or missing).
   * fit: stretch or squeeze towards this many seconds. wait: for music, play it when it arrives.
   */
  clip(group, { gain = 1, rate = 1, bus = this.fx, fit = 0, loop = false, when = 0, wait = false, duck = 0 } = {}) {
    const names = this.groups[group]
    if (!names || !this.ctx) return false
    const i = (this.turn[group] = ((this.turn[group] ?? -1) + 1 + (Math.random() < 0.3 ? 1 : 0)) % names.length)
    const start = (buf) => {
      const at = Math.max(when, this.ctx.currentTime)
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      src.loop = loop
      const r = rate * (fit ? Math.min(1.7, Math.max(0.6, buf.duration / fit)) : 1) * (0.96 + Math.random() * 0.08)
      src.playbackRate.value = r
      const g = this.ctx.createGain()
      g.gain.value = gain
      src.connect(g).connect(bus)
      src.start(at)
      // a stroke swells and dies away within its own time, so that a run of them is heard one by one
      if (fit) {
        g.gain.setValueAtTime(0, at)
        g.gain.linearRampToValueAtTime(gain, at + 0.008)
        g.gain.setValueAtTime(gain, at + fit * 0.6)
        g.gain.linearRampToValueAtTime(0, at + fit + 0.03)
        src.stop(at + fit + 0.05)
      }
      // music steps back when somebody starts to speak over it
      if (duck) {
        g.gain.setValueAtTime(gain, at + duck)
        g.gain.linearRampToValueAtTime(gain * 0.3, at + duck + 1.5)
      }
    }
    const buf = this.cache[names[i]]
    if (buf) {
      start(buf)
      return true
    }
    if (!wait) return false
    const asked = this.ctx.currentTime
    this.load(asset(SFX + this.files[names[i]])).then((b) => {
      if (!b) return
      this.cache[names[i]] = b
      if (this.on && (loop || this.ctx.currentTime - asked < 1.5)) start(b)
    })
    return true
  }

  get quiet() {
    return !this.on || !this.ctx || this.speed > 2.01
  }

  hiss(at, dur, { hp = 900, lp = 9000, peak = 4000, boost = 4, gain = 0.2, attack = 0.03, release = 0.09 }) {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const a = ctx.createBiquadFilter()
    a.type = 'highpass'
    a.frequency.value = hp
    const b = ctx.createBiquadFilter()
    b.type = 'lowpass'
    b.frequency.value = lp
    const c = ctx.createBiquadFilter()
    c.type = 'peaking'
    c.frequency.value = peak
    c.gain.value = boost
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(gain, at + attack)
    g.gain.setValueAtTime(gain, at + Math.max(attack, dur - release))
    g.gain.linearRampToValueAtTime(0, at + dur)
    src.connect(a).connect(b).connect(c).connect(g).connect(this.fx)
    src.start(at, Math.random() * 1.5)
    src.stop(at + dur + 0.02)
  }

  thump(at, f0, f1, dur, gain) {
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.frequency.setValueAtTime(f0, at)
    o.frequency.exponentialRampToValueAtTime(f1, at + dur)
    g.gain.setValueAtTime(gain, at)
    g.gain.exponentialRampToValueAtTime(0.001, at + dur)
    o.connect(g).connect(this.fx)
    o.start(at)
    o.stop(at + dur + 0.02)
  }

  /** a stroke touching down: kind is the brush (flat, knife, round), dur how long it stays down */
  stroke({ kind, dur, size }) {
    if (this.quiet) return
    const d = Math.min(dur / this.speed, 1.6)
    const big = Math.min(1, size / 110)
    if (kind === 'knife') {
      if (this.clip('knife', { gain: 0.9, fit: d })) return
      const at = this.ctx.currentTime
      this.hiss(at, Math.max(0.12, d), { hp: 1500, lp: 7000, peak: 3200, boost: 9, gain: 0.2, attack: 0.006, release: 0.05 })
      return
    }
    if (kind === 'round') {
      if (this.clip('liner', { gain: 0.7, fit: d })) return
      this.hiss(this.ctx.currentTime, Math.max(0.08, d), { hp: 2500, lp: 9000, peak: 5500, boost: 3, gain: 0.05, attack: 0.02, release: 0.05 })
      return
    }
    // the big brush, blocking in, is slower and softer than the detail that follows
    if (this.clip('stroke', size > 100 ? { gain: 0.5, rate: 0.82, fit: d } : { gain: 0.75, fit: d })) return
    this.hiss(this.ctx.currentTime, Math.max(0.1, d), { hp: 1100, lp: 9500, peak: 4200, boost: 4, gain: 0.07 + big * 0.07 })
  }

  /** a tapping brush landing: a short dull thud, like a finger on a drum skin */
  tap({ size }) {
    if (this.quiet) return
    const now = this.ctx.currentTime
    if (now - this.lastTap < 0.07) return
    this.lastTap = now
    const big = Math.min(1, size / 70)
    if (this.clip('tap', { gain: 0.6 + big * 0.4, rate: 1.15 - big * 0.25 })) return
    this.hiss(now, 0.06, { hp: 500, lp: 8000, peak: 1800, boost: 5, gain: 0.16 + big * 0.1, attack: 0.002, release: 0.05 })
    this.thump(now, 190 - big * 50, 100, 0.05, 0.12 + big * 0.1)
  }

  /** the brush striking the leg of the easel, at an exact time */
  hit(when = 0) {
    if (this.quiet) return
    const at = Math.max(when, this.ctx.currentTime)
    if (this.clip('hit', { gain: 1, when: at })) return
    this.hiss(at, 0.026, { hp: 300, lp: 11000, peak: 2200, boost: 6, gain: 0.55, attack: 0.001, release: 0.022 })
    this.thump(at, 210, 85, 0.05, 0.4)
  }

  /**
   * The whole beating, laid out on the sound's own clock so that it is perfectly even however the
   * picture is keeping up: about eleven strikes a second, as on the programme.
   */
  beating(seconds, perSecond = 11.3) {
    if (this.quiet) return 0
    const n = Math.round(seconds * perSecond)
    const t0 = this.ctx.currentTime + 0.03
    for (let i = 0; i < n; i++) this.hit(t0 + (i / perSecond) / this.speed)
    return n
  }

  /** the brush in the bucket of thinner */
  wash(dur = 1.6) {
    if (this.quiet) return
    if (this.clip('wash', { gain: 0.9, fit: dur })) return
    const now = this.ctx.currentTime
    for (let k = 0; k < 3; k++) {
      const t0 = now + k * (dur / 3)
      this.hiss(t0, dur / 3.4, { hp: 150, lp: 900, peak: 400, boost: 6, gain: 0.16, attack: 0.08, release: 0.14 })
      for (let i = 0; i < 6; i++) this.hiss(t0 + 0.04 + i * 0.045, 0.03, { hp: 3000, lp: 11000, peak: 6000, boost: 4, gain: 0.12, attack: 0.002, release: 0.02 })
    }
  }

  /** the brush going into a blob of paint on the palette */
  dip() {
    if (this.quiet) return
    if (this.clip('load', { gain: 0.7 })) return
    this.hiss(this.ctx.currentTime + 0.1, 0.12, { hp: 200, lp: 1400, peak: 700, boost: 6, gain: 0.1, attack: 0.02, release: 0.08 })
  }

  static() {
    if (!this.on || !this.ctx) return
    if (this.clip('static', { gain: 0.5, wait: true })) return
    this.hiss(this.ctx.currentTime, 0.4, { hp: 2500, lp: 12000, peak: 5000, boost: 0, gain: 0.1, attack: 0.005, release: 0.2 })
  }

  /** a quiet studio: tape hiss and mains hum, or the recorded room if there is one */
  room() {
    if (this.clip('room', { gain: 0.5, bus: this.music, loop: true, wait: true })) return
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 5200
    const g = ctx.createGain()
    g.gain.value = 0.009
    src.connect(f).connect(g).connect(this.master)
    src.start()
    const hum = ctx.createOscillator()
    hum.frequency.value = 60
    const hg = ctx.createGain()
    hg.gain.value = 0.004
    hum.connect(hg).connect(this.master)
    hum.start()
  }

  /** the titles and the credits. duck: seconds until Cobb starts to talk over it */
  theme(duck = 0) {
    if (!this.on || !this.ctx) return
    if (this.clip('theme', { gain: 1, bus: this.music, wait: true, duck })) return
    const ctx = this.ctx
    const t0 = ctx.currentTime + 0.05
    const note = (f, at, dur, gain) => {
      for (const [mult, type, k] of [[1, 'sine', 1], [2, 'sine', 0.22], [1.003, 'triangle', 0.25]]) {
        const o = ctx.createOscillator()
        o.type = type
        o.frequency.value = f * mult
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, at)
        g.gain.linearRampToValueAtTime(gain * k, at + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0006, at + dur)
        o.connect(g).connect(this.music)
        o.start(at)
        o.stop(at + dur + 0.05)
      }
    }
    const chords = [[174.6, 220, 261.6, 329.6], [164.8, 196, 246.9, 293.7], [146.8, 174.6, 220, 261.6], [130.8, 196, 246.9, 329.6]]
    chords.forEach((ch, i) => ch.forEach((f, j) => note(f, t0 + i * 1.05 + j * 0.035, 1.9, 0.07)))
    const tune = [[523.3, 0], [659.3, 0.5], [587.3, 1.05], [493.9, 1.55], [440, 2.1], [523.3, 2.6], [392, 3.15], [523.3, 3.7]]
    tune.forEach(([f, at]) => note(f, t0 + at, 0.9, 0.06))
  }

  setSpeed(x) {
    this.speed = x
    if (x > 1.01) this.hush()
  }

  setPaused(p) {
    if (!this.ctx) return
    if (p) this.ctx.suspend()
    else if (this.on) this.ctx.resume()
  }
}
