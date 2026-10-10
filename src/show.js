// The director. Writes an episode (which Pebble, which landscape, what Cobb says), then runs it beat
// by beat: tells the painter what to paint, the stage where to point the camera and what Cobb's hands
// are doing, the page which words to put up, and the sound what to play.
//
// Time is set by Cobb's voice. Each line has a recording of a known length; a beat lasts as long as its
// lines take to say, and the brush is given that long to do its part. Where there is no recording yet,
// the length is estimated from the words.
import { COLORS, HAIRS, HAIR_COLORS, JOBS, KINDS, NAMES, PAINTS, PLATES, byId } from './data.js'
import { buildPebble, buildFriend } from './pebble.js'
import { signature } from './painter.js'
import { lineId, guessSeconds } from './lines.js'
import * as S from './script.js'
import { rng, clamp } from './rng.js'

const LOAD = 0.85 // seconds at the palette before each part
const GAP = 0.28 // a breath between lines
const BEAT_FOR = 1.95 // the brush is beaten for this long: 22 strikes, as measured
// the triangles as type: without the mark after them some phones draw a picture of a button instead
export const PLAY = 'PLAY \u25B6\uFE0E'
const FF = 'FF \u25B6\uFE0E\u25B6\uFE0E'

/** an episode number alone decides everything, unless the viewer wrote in with a request */
export function makeEpisode(no, req = {}) {
  const r = rng(no * 2654435761)
  const pick = (list, id) => (id && byId(list, id)) || r.pick(list)
  const kind = pick(KINDS, req.kind)
  const color = pick(COLORS, req.color)
  const hair = pick(HAIRS, req.hair)
  const hairColor = pick(HAIR_COLORS, req.hairColor)
  const job = pick(JOBS, req.job)
  const plate = pick(PLATES, req.plate)
  const name = r.pick(NAMES)
  return {
    no, kind, color, hair, hairColor, job, plate, name,
    title: `${name} the ${job.label.replace(/\b[a-z]/g, (c) => c.toUpperCase())}`,
    blurb: `${color.label} ${kind.label} · ${hair.id === 'bald' ? 'bald' : `${hairColor.label} ${hair.label}`}`,
    spec: { kind: kind.id, color: color.id, hair: hair.id, hairColor: hairColor.id, job: job.id, seed: no },
  }
}

/** seconds: how long each line takes to say */
export function writeEpisode(ep, seconds = guessSeconds) {
  const r = rng(ep.no * 40503 + 17)
  const ctx = { job: ep.job.label, name: ep.name, kind: ep.kind.a, say: ep.color.say, prop: ep.job.prop }
  const say = (text, extra) => S.fill(text, { ...ctx, ...extra })
  const span = (lines) => lines.reduce((a, l) => a + seconds(l) + GAP, 0.15)
  const beats = []
  const talk = (lines, shot = 'wide', extra = {}) => beats.push({ kind: 'talk', shot, lines: lines.map((l) => say(l)), ...extra })
  let shotN = 0
  const paint = (label, job, lines, o = {}) => {
    const text = lines.map((l) => say(l, o.ctx))
    job.dur = Math.max(job.dur, span(text) - LOAD)
    const n = shotN++
    let shots = o.shots
    if (!shots) {
      if (n % 4 === 1) shots = [[0, 'wide'], [LOAD + job.dur * 0.42, 'canvas']]
      else if (n % 4 === 3) shots = [[0, 'canvas'], [LOAD + job.dur * 0.55, 'side']]
      else shots = [[0, 'canvas']]
    }
    beats.push({ kind: 'paint', label, job, lines: text, paint: o.paint, tool: job.tool || 'big', shots, dur: LOAD + job.dur + 0.3 })
  }

  beats.push({ kind: 'title', dur: 5 })
  talk([r.pick(S.GREET), r.pick(S.GREET_JOB), r.pick(S.PRIMED[ep.plate.base])], 'wide', { lower: true })

  // the landscape, top to bottom
  const bands = ep.plate.bands
  bands.forEach((b, i) => {
    const lines = r.pick(S.BAND[b.what] || S.BAND.sky)
    const last = i === bands.length - 1
    const ctxB = { paint: PAINTS[b.paints[0]].name }
    // block it in soft with the big brush, then go back in for the detail with the band's own tool.
    // He talks about the knife while he is holding the knife.
    const early = b.tool === 'big' ? [lines[0]] : []
    paint(b.what, { plate: 'blur', band: [Math.min(b.y[0] + 0.07, b.y[1] - 0.05), b.y[1]], style: i === 0 ? 'criss' : 'rows', size: 124, dur: early.length ? 2.6 : 2.0, tool: 'big', seed: ep.no + i },
      early, { paint: b.paints[0], ctx: ctxB, shots: i === 0 ? [[0, 'palette'], [LOAD, 'canvas']] : [[0, 'canvas']] })
    paint(b.what, { plate: 'sharp', band: b.y, style: b.style, size: b.style === 'knife' ? 150 : b.style === 'criss' ? 104 : b.style === 'dab' ? 76 : 66, dur: 4.2, tool: b.tool, final: last, seed: ep.no + i + 50 },
      early.length ? lines.slice(1) : lines, { paint: b.paints[1] || b.paints[0], ctx: ctxB })
  })

  beats.push({ kind: 'beat', lines: r.pick(S.WASH).map((l) => say(l)) })
  talk(r.pick(S.ENTER), 'host')

  // the Pebble, part by part
  const side = r.chance(0.5) ? -1 : 1
  const cx = 512 + side * r.range(10, 70)
  const ground = ep.plate.ground * 768
  const built = buildPebble(ep.spec, { cx, ground })
  const accident = r.chance(0.34)
  const friendly = accident || r.chance(0.4)
  const fx = clamp(cx - side * r.range(250, 300), 110, 914)
  const friend = friendly ? buildFriend(ep.no + 3, fx, ground + r.range(6, 22), r.range(92, 112)) : null
  for (const st of built.steps) {
    const job = { draw: st.draw, style: st.style, size: st.size, dur: st.dur, tool: st.tool, seed: ep.no + beats.length }
    let lines
    let paintId = ep.color.paint
    if (st.id === 'body') lines = [r.pick(S.BODY_COLOR), r.pick(r.chance(0.8) ? S.BODY_KIND : S.BODY_ANY)]
    else if (st.id === 'outfit') lines = [r.pick(S.STEP.outfit), r.pick(ep.job.say)]
    else if (st.id === 'hair') {
      lines = [r.pick(ep.hair.say)]
      paintId = ep.hairColor.paint
    } else if (st.id === 'hat') {
      lines = [S.HAT[ep.job.id]]
      paintId = 'red'
    } else if (st.id === 'face') {
      lines = [r.pick(S.STEP.face)]
      if (S.FACE_EXTRA[ep.job.id]) lines.push(S.FACE_EXTRA[ep.job.id])
      paintId = 'black'
    } else if (st.id === 'prop') {
      lines = [r.pick(S.PROP)]
      paintId = 'vandyke'
    } else if (st.id === 'shadow') {
      lines = [r.pick(S.STEP.shadow)]
      paintId = 'black'
    } else lines = [r.pick(S.STEP[st.id] || S.STEP.arms)]
    // a Pebble with no outfit still has to be told what it does for a living
    if (st.id === 'arms' && !built.steps.some((s) => s.id === 'outfit')) lines.push(r.pick(ep.job.say))
    paint(st.id, job, lines, { paint: paintId, shots: st.id === 'body' ? [[0, 'palette'], [LOAD, 'canvas']] : undefined })
    if (st.id === 'shade' && accident) {
      const blot = [[[fx - 14, ground - 40], [fx + 10, ground - 52], [fx + 16, ground - 30], [fx - 8, ground - 22], [fx + 4, ground - 40], [fx - 12, ground - 34]]]
      const lines2 = r.pick(S.ACCIDENT)
      paint('accident', { solid: friend.col.dark, paths: blot, style: 'path', size: 30, dur: 1.2, tool: 'big', seed: 9 }, lines2, { paint: friend.col.paint, shots: [[0, 'canvas'], [LOAD + seconds(lines2[0]) + GAP, 'host']] })
    }
  }
  if (friend) {
    paint('friend', { draw: friend.draw, style: 'dab', size: 34, dur: 4.0, tool: 'round', seed: ep.no + 77 }, r.pick(accident ? S.FRIEND_AFTER_ACCIDENT : S.FRIEND), { paint: friend.col.paint })
  }
  // sign in whichever bottom corner is empty
  const sx = (friend ? fx > 512 : cx > 560) ? 44 : 824
  paint('signature', { solid: '#c2241c', paths: signature(sx, 676, 1.8), style: 'path', size: 8.5, dur: 3.0, tool: 'round', brush: 'round', alpha: 1 }, [r.pick(S.SIGN)], { paint: 'red', shots: [[0, 'canvas']] })

  beats.push({ kind: 'outro', lines: [r.pick(S.OUTRO_NAME), r.pick(S.OUTRO_BYE)].map((l) => say(l)) })
  beats.push({ kind: 'credits', dur: S.CREDITS.length * 2.6 + 0.6 })

  // lay the words out in time
  for (const b of beats) {
    let t = 0.15
    b.cues = (b.lines || []).map((text) => {
      const cue = { at: t, dur: seconds(text), text, id: lineId(text) }
      t += cue.dur + GAP
      return cue
    })
    if (b.kind === 'beat') {
      // he washes it while he says the first line, and starts beating it as he finishes the second;
      // the third waits until he has stopped
      b.washAt = 0.2
      b.hitAt = b.cues[1].at + b.cues[1].dur * 0.62
      b.cues[2].at = Math.max(b.cues[2].at, b.hitAt + BEAT_FOR + 0.25)
      t = b.cues[2].at + b.cues[2].dur + GAP
    }
    if (!b.dur) b.dur = Math.max(t + 0.2, 2)
  }
  return beats
}

export class Show {
  constructor({ stage, painter, ui, audio }) {
    this.stage = stage
    this.painter = painter
    this.ui = ui
    this.audio = audio
    this.speed = 1
    this.paused = false
    this.held = false // waiting on the title card to be started
    this.req = {}
    this.glitch = 1
    this.ep = null
    this.beats = []
    this.bi = -1
    this.bt = 0
    this.clock = 0
    this.plates = new Map()
    this.state = { beat: -1, kind: 'boot', label: '', done: false, episodes: 0 }
    this.used = new Set()
    this.speaks = false // Cobb is heard in this episode (most of its lines have a recording)
    this.nextNo = (no) => no + 1 // which episode follows; main.js decides
    painter.onStroke = (s) => audio.stroke(s)
    painter.onTap = (s) => audio.tap(s)
    // the strikes are heard on the sound's own clock (audio.beating); each one seen shakes the camera
    stage.onHit = () => (stage.shake = 0.7)
  }

  loadPlate(id) {
    if (!this.plates.has(id)) {
      this.plates.set(id, new Promise((res, rej) => {
        const img = new Image()
        img.decoding = 'async'
        img.onload = () => res(img)
        img.onerror = rej
        img.src = `/plates/${id}.jpg`
      }))
    }
    return this.plates.get(id)
  }

  async play(no, req) {
    const ep = makeEpisode(no, req)
    this.req = req || {}
    this.loading = no
    this.glitch = 1
    this.audio.hush()
    this.audio.static()
    const [img] = await Promise.all([this.loadPlate(ep.plate.id), this.audio.ready])
    if (this.loading !== no) return
    this.ep = ep
    this.painter.setPlate(img)
    this.painter.reset(ep.plate.base)
    this.beats = writeEpisode(ep, (text) => this.audio.durationOf(lineId(text)) ?? guessSeconds(text))
    this.total = this.beats.reduce((a, b) => a + b.dur, 0)
    const cues = this.beats.flatMap((b) => b.cues)
    this.voiced = cues.filter((c) => this.audio.durationOf(c.id) !== undefined).length
    // an episode with only a line recorded here and there is better read than half heard
    this.speaks = this.voiced >= cues.length * 0.8
    this.noted = false
    if (this.speaks) this.audio.preload(cues.map((c) => c.id))
    this.bi = -1
    this.bt = 0
    this.clock = 0
    this.used.clear()
    this.state.episodes++
    this.ui.episode(ep)
    this.ui.clear()
    this.stage.mode = 'talk'
    this.stage.tool = 'big'
    this.stage.tint.set('#e4d5ad')
    this.next()
    // warm the next landscape while this one plays
    this.loadPlate(makeEpisode(no + 1).plate.id).catch(() => {})
  }

  next() {
    this.bi++
    this.bt = 0
    const b = this.beats[this.bi]
    const st = this.state
    st.beat = this.bi
    st.kind = b ? b.kind : 'end'
    st.label = b ? b.label || '' : ''
    if (!b) {
      st.done = true
      this.play(this.nextNo(this.ep.no))
      return
    }
    b.cueI = 0
    b.shotI = 0
    b.started = false
    b.washed = false
    const { stage, ui, audio } = this
    ui.title(false)
    ui.credits(null)
    if (b.kind === 'title') {
      ui.title(true, this.ep)
      stage.cut('wide')
      stage.mode = 'talk'
      audio.theme(b.dur - 0.5)
    } else if (b.kind === 'talk') {
      stage.cut(b.shot)
      stage.mode = 'talk'
      if (b.lower) ui.lower('COBB MOSS', 'your host', 3.4)
      if (!this.speaks && audio.on && !this.noted) {
        this.noted = true
        ui.osd('CAPTIONS ONLY', 5)
      }
    } else if (b.kind === 'paint') {
      stage.mode = 'load'
      stage.loadBlob = b.paint || 'white'
      stage.tool = b.tool
      audio.dip()
      if (b.paint) {
        stage.tint.set(b.job.solid || PAINTS[b.paint].hex)
        if (!this.used.has(b.paint)) {
          this.used.add(b.paint)
          ui.colorName(PAINTS[b.paint].tv, 2.3)
        }
      }
    } else if (b.kind === 'beat') {
      stage.cut('wide')
      stage.mode = 'talk'
      stage.tool = 'big'
      stage.tint.set('#e4d5ad')
    } else if (b.kind === 'outro') {
      stage.cut('wide')
      stage.mode = 'wave'
      stage.tool = 'big'
    } else if (b.kind === 'credits') {
      stage.cut('canvas')
      stage.mode = 'talk'
      audio.theme()
    }
  }

  /** this episode again, from the top */
  replay() {
    return this.play(this.ep.no, this.req)
  }

  /** leave this episode now and start another */
  skip(req) {
    const no = req?.no ?? (this.ep ? this.ep.no + 1 : 1)
    this.painter.job = null
    this.ui.clear()
    this.ui.title(false)
    this.ui.credits(null)
    this.play(no, req)
  }

  setSpeed(x) {
    this.speed = x
    this.audio.setSpeed(x)
    this.ui.osd(x === 1 ? PLAY : `${FF} x${x}`, x === 1 ? 2.2 : 0)
  }

  togglePause() {
    this.paused = !this.paused
    this.ui.osd(this.paused ? 'PAUSE ❚❚' : this.speed === 1 ? PLAY : `${FF} x${this.speed}`, this.paused || this.speed > 1 ? 0 : 2.2)
    this.audio.setPaused(this.paused)
  }

  update(real) {
    const { stage, painter, ui, audio } = this
    this.glitch = Math.max(0, this.glitch - real * (this.ep ? 2.4 : 0))
    const dt = this.paused || this.held ? 0 : real * this.speed
    const b = this.beats[this.bi]
    if (b && this.ep && dt > 0) {
      this.bt += dt
      this.clock += dt
      const t = this.bt
      while (b.cueI < b.cues.length && b.cues[b.cueI].at <= t) {
        const cue = b.cues[b.cueI++]
        ui.caption(cue.text, cue.dur)
        stage.talking = cue.dur * 0.9
        if (this.speaks) audio.say(cue.id)
      }
      if (b.kind === 'paint') {
        while (b.shotI < b.shots.length && b.shots[b.shotI][0] <= t) stage.cut(b.shots[b.shotI++][1])
        if (!b.started && t >= LOAD) {
          b.started = true
          stage.mode = 'paint'
          painter.start(b.job)
        }
        if (b.started) painter.update(dt)
      } else if (b.kind === 'beat') {
        // into the bucket, then against the leg of the easel
        const washing = t >= b.washAt && t < b.hitAt - 0.15
        const hitting = t >= b.hitAt && t < b.hitAt + BEAT_FOR
        if (washing && !b.washed) {
          b.washed = true
          audio.wash(Math.min(1.8, b.hitAt - b.washAt - 0.2))
        }
        if (hitting && stage.mode !== 'beat') {
          stage.hop = 1
          audio.beating(BEAT_FOR)
        }
        stage.mode = hitting ? 'beat' : washing ? 'wash' : 'talk'
      } else if (b.kind === 'credits') {
        const i = Math.min(S.CREDITS.length - 1, Math.floor(t / 2.6))
        ui.credits(S.CREDITS[i], i)
      }
      if (t >= b.dur) {
        if (b.kind === 'paint') painter.flush()
        this.next()
      }
    }
    ui.tick(real, dt, this.clock)
    stage.update(this.paused ? 0 : real * Math.min(this.speed, 4))
    stage.render({ ff: this.paused ? 0.5 : this.speed > 1 ? clamp((this.speed - 1) / 4, 0.3, 1) : 0, glitch: this.glitch, fade: 1 })
    this.state.t = this.bt
    this.state.clock = this.clock
    this.state.total = this.total
  }
}
