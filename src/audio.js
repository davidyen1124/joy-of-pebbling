// Sound, all of it made here: the hush of a tape, a brush on canvas, a brush being beaten against an
// easel, a few kind chords for the titles, and (if asked) the browser reading Cobb's lines aloud.
// Silent until the viewer turns it on.
export class Audio {
  constructor() {
    this.on = false
    this.voice = false
    this.ctx = null
    this.level = 0
  }

  enable(on) {
    this.on = on
    if (on && !this.ctx) this.build()
    if (this.ctx) {
      if (on) this.ctx.resume()
      this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05)
    }
    if (!on) this.hush()
  }

  setVoice(on) {
    this.voice = on && 'speechSynthesis' in window
    if (!this.voice) this.hush()
    return this.voice
  }

  hush() {
    try {
      window.speechSynthesis?.cancel()
    } catch {}
  }

  build() {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = (this.ctx = new AC())
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(ctx.destination)
    // two seconds of noise, used for everything that hisses
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    this.noise = buf
    const loop = (filterType, freq, q, gain) => {
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const f = ctx.createBiquadFilter()
      f.type = filterType
      f.frequency.value = freq
      f.Q.value = q
      const g = ctx.createGain()
      g.gain.value = gain
      src.connect(f).connect(g).connect(this.master)
      src.start()
      return { f, g }
    }
    loop('highpass', 5200, 0.3, 0.012) // tape hiss
    const hum = ctx.createOscillator()
    hum.frequency.value = 60
    const hg = ctx.createGain()
    hg.gain.value = 0.006
    hum.connect(hg).connect(this.master)
    hum.start()
    this.bristle = loop('bandpass', 2400, 0.8, 0)
  }

  /** 0..1: how hard the brush is working */
  brush(x) {
    if (!this.ctx || !this.on) return
    this.level += (x - this.level) * 0.35
    const t = this.ctx.currentTime
    this.bristle.g.gain.setTargetAtTime(this.level * 0.11, t, 0.03)
    this.bristle.f.frequency.setTargetAtTime(1500 + this.level * 2600, t, 0.05)
  }

  burst(at, dur, freq, gain, type = 'bandpass') {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, at)
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur)
    src.connect(f).connect(g).connect(this.master)
    src.start(at, Math.random())
    src.stop(at + dur + 0.02)
  }

  /** the brush against the leg of the easel, for `dur` seconds */
  whack(dur) {
    if (!this.ctx || !this.on) return
    const t0 = this.ctx.currentTime
    for (let t = 0; t < dur; t += 0.092) {
      this.burst(t0 + t, 0.07, 900 + Math.random() * 500, 0.3)
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      o.frequency.setValueAtTime(170, t0 + t)
      o.frequency.exponentialRampToValueAtTime(70, t0 + t + 0.07)
      g.gain.setValueAtTime(0.22, t0 + t)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + t + 0.08)
      o.connect(g).connect(this.master)
      o.start(t0 + t)
      o.stop(t0 + t + 0.1)
    }
  }

  static() {
    if (!this.ctx || !this.on) return
    this.burst(this.ctx.currentTime, 0.45, 3000, 0.16, 'highpass')
  }

  /** four soft chords and a little tune on top */
  theme() {
    if (!this.ctx || !this.on) return
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
        o.connect(g).connect(this.master)
        o.start(at)
        o.stop(at + dur + 0.05)
      }
    }
    const chords = [[174.6, 220, 261.6, 329.6], [164.8, 196, 246.9, 293.7], [146.8, 174.6, 220, 261.6], [130.8, 196, 246.9, 329.6]]
    chords.forEach((ch, i) => ch.forEach((f, j) => note(f, t0 + i * 1.05 + j * 0.035, 1.9, 0.07)))
    const tune = [[523.3, 0], [659.3, 0.5], [587.3, 1.05], [493.9, 1.55], [440, 2.1], [523.3, 2.6], [392, 3.15], [523.3, 3.7]]
    tune.forEach(([f, at]) => note(f, t0 + at, 0.9, 0.06))
  }

  speak(text, speed) {
    if (!this.voice || speed > 2) return
    try {
      const synth = window.speechSynthesis
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text.replace(/\(.*?\)/g, '').replace(/\.\.\./g, ','))
      const voices = synth.getVoices()
      u.voice = voices.find((v) => /Daniel|Alex|Fred|Google UK English Male|Arthur/.test(v.name)) || voices.find((v) => v.lang?.startsWith('en')) || null
      u.rate = 0.92 * (speed > 1 ? 1.35 : 1)
      u.pitch = 0.75
      u.volume = 0.9
      synth.speak(u)
    } catch {}
  }

  setPaused(p) {
    if (!this.ctx) return
    if (p) {
      this.ctx.suspend()
      this.hush()
    } else if (this.on) this.ctx.resume()
  }
}
