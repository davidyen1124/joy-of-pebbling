// The director. Writes an episode (which Pebble, which landscape, what Cobb says), then runs it beat
// by beat: tells the painter what to paint, the stage where to point the camera and what Cobb's hands
// are doing, and the page which words to put on the screen.
import { COLORS, HAIRS, HAIR_COLORS, JOBS, KINDS, NAMES, PAINTS, PLATES, byId } from './data.js'
import { buildPebble, buildFriend } from './pebble.js'
import { signature } from './painter.js'
import * as S from './script.js'
import { rng, clamp } from './rng.js'

const LOAD = 0.85 // seconds at the palette before each part

const lineTime = (text) => clamp(1.05 + text.length * 0.043, 1.7, 4.4)

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

function writeEpisode(ep) {
  const r = rng(ep.no * 40503 + 17)
  const ctx = {
    job: ep.job.label, name: ep.name, color: ep.color.label, kind: ep.kind.a, say: ep.color.say,
    hair: ep.hair.id === 'bald' ? 'no hair at all' : ep.hair.mass ? ep.hair.label : `${/^[aeiou]/.test(ep.hair.label) ? 'an' : 'a'} ${ep.hair.label}`,
    prop: ep.job.prop,
  }
  const say = (text, extra) => S.fill(text, { ...ctx, ...extra })
  const beats = []
  const talk = (lines, shot = 'wide', extra = {}) => beats.push({ kind: 'talk', shot, lines: lines.map((l) => say(l)), ...extra })
  let shotN = 0
  const paint = (label, job, lines, o = {}) => {
    const text = lines.map((l) => say(l, o.ctx))
    const need = text.reduce((a, l) => a + lineTime(l) + 0.12, 0)
    job.dur = Math.max(job.dur, need - LOAD + 0.2)
    const n = shotN++
    let shots = o.shots
    if (!shots) {
      if (n % 4 === 1) shots = [[0, 'wide'], [LOAD + job.dur * 0.42, 'canvas']]
      else if (n % 4 === 3) shots = [[0, 'canvas'], [LOAD + job.dur * 0.55, 'side']]
      else shots = [[0, 'canvas']]
    }
    beats.push({ kind: 'paint', label, job, lines: text, paint: o.paint, tool: job.tool || 'big', shots, dur: LOAD + job.dur + 0.3 })
  }

  beats.push({ kind: 'title', dur: 4.6 })
  talk([...r.pick(S.GREET), r.pick(S.PRIMED[ep.plate.base])], 'wide', { lower: true })

  // the landscape, top to bottom
  const bands = ep.plate.bands
  bands.forEach((b, i) => {
    const lines = r.pick(S.BAND[b.what] || S.BAND.sky)
    const last = i === bands.length - 1
    const ctxB = { paint: PAINTS[b.paints[0]].name }
    // block it in soft with the big brush, then go back in for the detail with the band's own tool.
    // He talks about the knife while he is holding the knife.
    const early = b.tool === 'big' ? [lines[0]] : []
    paint(b.what, { plate: 'blur', band: [Math.min(b.y[0] + 0.07, b.y[1] - 0.05), b.y[1]], style: i === 0 ? 'criss' : 'rows', size: 124, dur: early.length ? 2.5 : 1.9, tool: 'big', seed: ep.no + i },
      early, { paint: b.paints[0], ctx: ctxB, shots: i === 0 ? [[0, 'palette'], [LOAD + 0.2, 'canvas']] : [[0, 'canvas']] })
    paint(b.what, { plate: 'sharp', band: b.y, style: b.style, size: b.style === 'knife' ? 70 : b.style === 'dab' ? 76 : 66, dur: 4.4, tool: b.tool, final: last, seed: ep.no + i + 50 },
      early.length ? lines.slice(1) : lines, { paint: b.paints[1] || b.paints[0], ctx: ctxB })
  })

  beats.push({ kind: 'beat', lines: r.pick(S.WASH).map((l) => say(l)), dur: 5.4 })
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
    if (st.id === 'body') lines = r.pick(S.STEP.body)
    else if (st.id === 'outfit') lines = [r.pick(S.STEP.outfit), r.pick(ep.job.say)]
    else if (st.id === 'hair') {
      lines = [r.pick(ep.hair.say)]
      paintId = ep.hairColor.paint
    } else if (st.id === 'hat') {
      lines = [S.HAT[ep.job.id] || 'And a hat. Right on top. That’s where hats go.']
      paintId = 'red'
    } else if (st.id === 'face') {
      lines = [r.pick(S.STEP.face)]
      if (S.FACE_EXTRA[ep.job.id]) lines.push(S.FACE_EXTRA[ep.job.id])
      paintId = 'black'
    } else if (st.id === 'prop') {
      lines = [r.pick(S.STEP.prop)]
      paintId = 'vandyke'
    } else if (st.id === 'shadow') {
      lines = [r.pick(S.STEP.shadow)]
      paintId = 'black'
    } else lines = [r.pick(S.STEP[st.id] || S.STEP.arms)]
    // a Pebble with no outfit still has to be told what it does for a living
    if (st.id === 'arms' && !built.steps.some((s) => s.id === 'outfit')) lines.push(r.pick(ep.job.say))
    paint(st.id, job, lines, { paint: paintId, shots: st.id === 'body' ? [[0, 'palette'], [LOAD + 0.15, 'canvas']] : undefined })
    if (st.id === 'shade' && accident) {
      const blot = [[[fx - 14, ground - 40], [fx + 10, ground - 52], [fx + 16, ground - 30], [fx - 8, ground - 22], [fx + 4, ground - 40], [fx - 12, ground - 34]]]
      paint('accident', { solid: friend.col.dark, paths: blot, style: 'path', size: 30, dur: 1.2, tool: 'big', seed: 9 }, r.pick(S.ACCIDENT), { paint: friend.col.paint, shots: [[0, 'canvas'], [LOAD + 1.3, 'host']] })
    }
  }
  if (friend) {
    paint('friend', { draw: friend.draw, style: 'dab', size: 34, dur: 4.2, tool: 'round', seed: ep.no + 77 }, r.pick(accident ? S.FRIEND_AFTER_ACCIDENT : S.FRIEND), { paint: friend.col.paint })
  }
  // sign in whichever bottom corner is empty
  const sx = (friend ? fx > 512 : cx > 560) ? 44 : 824
  paint('signature', { solid: '#c2241c', paths: signature(sx, 676, 1.8), style: 'path', size: 8.5, dur: 3.0, tool: 'round', brush: 'round', alpha: 1 }, [r.pick(S.SIGN)], { paint: 'red', shots: [[0, 'canvas']] })

  beats.push({ kind: 'outro', lines: r.pick(S.OUTRO).map((l) => say(l)) })
  beats.push({ kind: 'credits', dur: S.CREDITS.length * 2.5 + 0.6 })

  // lay the words out in time
  for (const b of beats) {
    let t = 0.12
    b.cues = (b.lines || []).map((text) => {
      const cue = { at: t, dur: lineTime(text), text }
      t += cue.dur + 0.12
      return cue
    })
    if (!b.dur) b.dur = Math.max(t + 0.25, 2)
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
    this.glitch = 1
    this.ep = null
    this.beats = []
    this.bi = -1
    this.bt = 0
    this.clock = 0
    this.queue = null
    this.plates = new Map()
    this.state = { beat: -1, kind: 'boot', label: '', done: false, episodes: 0 }
    this.used = new Set()
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
    this.loading = no
    this.glitch = 1
    this.audio.static()
    const img = await this.loadPlate(ep.plate.id)
    if (this.loading !== no) return
    this.ep = ep
    this.painter.setPlate(img)
    this.painter.reset(ep.plate.base)
    this.beats = writeEpisode(ep)
    this.total = this.beats.reduce((a, b) => a + b.dur, 0)
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
      this.play(this.queue ? this.queue.no : this.ep.no + 1, this.queue ? this.queue.req : undefined)
      this.queue = null
      return
    }
    b.cueI = 0
    b.shotI = 0
    b.started = false
    const { stage, ui } = this
    ui.title(false)
    ui.credits(null)
    if (b.kind === 'title') {
      ui.title(true, this.ep)
      stage.cut('wide')
      stage.mode = 'talk'
      this.audio.theme()
    } else if (b.kind === 'talk') {
      stage.cut(b.shot)
      stage.mode = 'talk'
      if (b.lower) ui.lower('COBB MOSS', 'your host', 3.4)
    } else if (b.kind === 'paint') {
      stage.mode = 'load'
      stage.loadBlob = b.paint || 'white'
      stage.tool = b.tool
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
      this.audio.theme()
    }
  }

  /** leave this episode now and start another */
  skip(req) {
    const no = req?.no ?? (this.ep ? this.ep.no + 1 : 1)
    this.queue = null
    this.painter.job = null
    this.ui.clear()
    this.ui.title(false)
    this.ui.credits(null)
    this.play(no, req)
  }

  setSpeed(x) {
    this.speed = x
    this.ui.osd(x === 1 ? 'PLAY ▶' : `FF ▶▶ x${x}`, x === 1 ? 2.2 : 0)
  }

  togglePause() {
    this.paused = !this.paused
    this.ui.osd(this.paused ? 'PAUSE ❚❚' : this.speed === 1 ? 'PLAY ▶' : `FF ▶▶ x${this.speed}`, this.paused || this.speed > 1 ? 0 : 2.2)
    this.audio.setPaused(this.paused)
  }

  update(real) {
    const { stage, painter, ui, audio } = this
    this.glitch = Math.max(0, this.glitch - real * (this.ep ? 2.4 : 0))
    const dt = this.paused ? 0 : real * this.speed
    const b = this.beats[this.bi]
    if (b && this.ep && dt > 0) {
      this.bt += dt
      this.clock += dt
      const t = this.bt
      while (b.cueI < b.cues.length && b.cues[b.cueI].at <= t) {
        const cue = b.cues[b.cueI++]
        ui.caption(cue.text, cue.dur)
        stage.talking = cue.dur * 0.86
        audio.speak(cue.text, this.speed)
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
        // wash for a moment, then the thrashing
        const hit = t > 1.7 && t < 3.6
        if (hit && stage.mode !== 'beat') {
          stage.mode = 'beat'
          stage.hop = 1
          audio.whack(1.9 / this.speed)
        }
        if (hit) stage.shake = 0.8
        if (!hit && t >= 3.6 && stage.mode === 'beat') stage.mode = 'talk'
      } else if (b.kind === 'credits') {
        const i = Math.min(S.CREDITS.length - 1, Math.floor(t / 2.5))
        ui.credits(S.CREDITS[i], i)
      }
      if (t >= b.dur) {
        if (b.kind === 'paint') painter.flush()
        this.next()
      }
    }
    const tip = painter.tip
    audio.brush(!this.paused && stage.mode === 'paint' && painter.busy && tip.down ? clamp(0.25 + tip.speed * 0.5, 0, 1) : 0)
    ui.tick(real, dt, this.clock)
    stage.update(this.paused ? 0 : real * Math.min(this.speed, 4))
    stage.render({ ff: this.paused ? 0.5 : this.speed > 1 ? clamp((this.speed - 1) / 4, 0.3, 1) : 0, glitch: this.glitch, fade: 1 })
    this.state.t = this.bt
    this.state.clock = this.clock
    this.state.total = this.total
  }
}
