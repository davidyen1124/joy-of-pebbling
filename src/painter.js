// The canvas on the easel, and the brush that fills it.
//
// Nothing is ever faded or wiped in. Every part of the picture (a band of sky, the Pebble's body, his
// hat) exists as a finished image off screen, and gets onto the canvas only where a bristle-shaped stamp
// lands; the stamps follow planned strokes: criss-crosses for sky, pulled strokes for a mountain, taps
// for foliage and hair. Where the latest stamp is, is where Cobb's brush is.
import { DW, DH } from './pebble.js'
import { rng, clamp, lerp } from './rng.js'

const TAU = Math.PI * 2
const SCR = 256

function makeCanvas(w, h, opts) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  return [cv, cv.getContext('2d', opts)]
}

// ── brush shapes: 96 px alpha masks; the stroke runs along +x ────────────────
function softEdge(c, rx, ry) {
  c.save()
  c.globalCompositeOperation = 'destination-in'
  c.translate(48, 48)
  c.scale(rx / 48, ry / 48)
  const g = c.createRadialGradient(0, 0, 26, 0, 0, 48)
  g.addColorStop(0, 'rgba(0,0,0,1)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g
  c.fillRect(-96, -96, 192, 192)
  c.restore()
}
function brushFlat(r) {
  const [cv, c] = makeCanvas(96, 96)
  for (let y = 5; y < 92; y += 1.6) {
    c.globalAlpha = 0.5 + r() * 0.5
    c.strokeStyle = '#000'
    c.lineWidth = 1.4 + r() * 1.6
    c.beginPath()
    c.moveTo(2 + r() * 16, y)
    c.lineTo(94 - r() * 16, y + (r() - 0.5) * 2)
    c.stroke()
  }
  softEdge(c, 50, 54)
  return cv
}
function brushRound(r) {
  const [cv, c] = makeCanvas(96, 96)
  const g = c.createRadialGradient(48, 48, 0, 48, 48, 46)
  g.addColorStop(0, 'rgba(0,0,0,1)')
  g.addColorStop(0.72, 'rgba(0,0,0,0.96)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g
  c.fillRect(0, 0, 96, 96)
  c.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 18; i++) {
    c.globalAlpha = 0.25
    c.beginPath()
    c.arc(48 + (r() - 0.5) * 80, 48 + (r() - 0.5) * 80, 1 + r() * 2.5, 0, TAU)
    c.fill()
  }
  return cv
}
function brushDab(r) {
  const [cv, c] = makeCanvas(96, 96)
  for (let i = 0; i < 46; i++) {
    const a = r() * TAU
    const d = Math.sqrt(r()) * 34
    const rad = 5 + r() * 9
    const g = c.createRadialGradient(48 + Math.cos(a) * d, 48 + Math.sin(a) * d, 0, 48 + Math.cos(a) * d, 48 + Math.sin(a) * d, rad)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(0.7, 'rgba(0,0,0,0.9)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    c.fillStyle = g
    c.fillRect(0, 0, 96, 96)
  }
  return cv
}
function brushKnife(r) {
  const [cv, c] = makeCanvas(96, 96)
  c.fillStyle = '#000'
  c.fillRect(3, 20, 90, 56)
  c.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 40; i++) {
    c.globalAlpha = 0.5 + r() * 0.5
    const y = r() < 0.5 ? 20 + r() * 9 : 67 + r() * 9
    c.fillRect(3 + r() * 84, y, 3 + r() * 16, 1.5 + r() * 3.5)
  }
  for (let i = 0; i < 10; i++) {
    c.globalAlpha = 0.35
    c.fillRect(3 + r() * 80, 26 + r() * 44, 6 + r() * 18, 1 + r() * 1.5)
  }
  return cv
}

const BRUSH_OF = { rows: 'flat', cols: 'flat', criss: 'flat', dab: 'dab', knife: 'knife', path: 'round', round: 'round' }

export class Painter {
  /** height: pixels of the real canvas; it is always 4:3 */
  constructor(height = DH) {
    this.H = height
    this.W = Math.round((height * 4) / 3)
    this.S = this.H / DH
    ;[this.canvas, this.ctx] = makeCanvas(this.W, this.H)
    ;[this.layer, this.lctx] = makeCanvas(this.W, this.H)
    ;[this.scratch, this.sctx] = makeCanvas(SCR, SCR)
    this.mw = Math.ceil(this.W / 8)
    this.mh = Math.ceil(this.H / 8)
    ;[this.small, this.smctx] = makeCanvas(this.mw, this.mh, { willReadFrequently: true })
    const r = rng(77)
    this.brushes = {
      flat: [brushFlat(r), brushFlat(r), brushFlat(r)],
      round: [brushRound(r), brushRound(r)],
      dab: [brushDab(r), brushDab(r), brushDab(r)],
      knife: [brushKnife(r), brushKnife(r)],
    }
    this.plate = null
    this.blur = null
    this.job = null
    this.tip = { u: 0.5, v: 0.5, down: false, ang: 0, speed: 0 }
    this.version = 0
    this.reset('white')
  }

  reset(base) {
    const c = this.ctx
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.fillStyle = base === 'black' ? '#141416' : '#f2efe7'
    c.fillRect(0, 0, this.W, this.H)
    this.job = null
    this.tip.down = false
    this.version++
  }

  /** the finished landscape for this episode, and a soft copy for blocking in */
  setPlate(img) {
    if (!this.plate) {
      ;[this.plate, this.pctx] = makeCanvas(this.W, this.H)
      ;[this.blur, this.bctx] = makeCanvas(this.W, this.H)
    }
    this.pctx.drawImage(img, 0, 0, this.W, this.H)
    const [tiny, t] = makeCanvas(Math.round(this.W / 14), Math.round(this.H / 14))
    t.imageSmoothingQuality = 'high'
    const [mid, m] = makeCanvas(Math.round(this.W / 4), Math.round(this.H / 4))
    m.imageSmoothingQuality = 'high'
    m.drawImage(this.plate, 0, 0, mid.width, mid.height)
    t.drawImage(mid, 0, 0, tiny.width, tiny.height)
    this.bctx.imageSmoothingQuality = 'high'
    this.bctx.drawImage(tiny, 0, 0, this.W, this.H)
  }

  /**
   * job: { style, size (design px), dur (s), tool, seed, and one of:
   *   draw(ctx)                   a part drawn in the 1024 x 768 design space
   *   plate: 'blur' | 'sharp', band: [y0, y1]   a band of the landscape
   *   solid: colour, paths: [[[x, y]...]...]    lines in one colour (the signature)
   *   final: true                 after the last stroke, lay the whole source down
   * }
   */
  start(job) {
    const S = this.S
    const { W, H } = this
    let src = null
    let inside
    let bb
    if (job.plate) {
      src = job.plate === 'blur' ? this.blur : this.plate
      const y0 = job.band[0] * H
      const y1 = job.band[1] * H
      inside = (x, y) => y >= y0 && y <= y1 && x >= -4 && x <= W + 4
      bb = { x0: 0, y0, x1: W, y1 }
    } else if (job.draw) {
      const l = this.lctx
      l.setTransform(1, 0, 0, 1, 0, 0)
      l.globalAlpha = 1
      l.globalCompositeOperation = 'source-over'
      l.clearRect(0, 0, W, H)
      l.setTransform(S, 0, 0, S, 0, 0)
      l.save()
      job.draw(l)
      l.restore()
      l.setTransform(1, 0, 0, 1, 0, 0)
      src = this.layer
      // a coarse map of where this part has any paint
      const sm = this.smctx
      sm.clearRect(0, 0, this.mw, this.mh)
      sm.imageSmoothingQuality = 'high'
      sm.drawImage(this.layer, 0, 0, this.mw, this.mh)
      const data = sm.getImageData(0, 0, this.mw, this.mh).data
      const mw = this.mw
      const mh = this.mh
      const on = new Uint8Array(mw * mh)
      let x0 = mw
      let y0 = mh
      let x1 = -1
      let y1 = -1
      for (let y = 0; y < mh; y++) {
        for (let x = 0; x < mw; x++) {
          if (data[(y * mw + x) * 4 + 3] > 6) {
            on[y * mw + x] = 1
            if (x < x0) x0 = x
            if (x > x1) x1 = x
            if (y < y0) y0 = y
            if (y > y1) y1 = y
          }
        }
      }
      const kx = mw / W
      const ky = mh / H
      inside = (x, y) => {
        const mx = Math.floor(x * kx)
        const my = Math.floor(y * ky)
        if (mx < 0 || my < 0 || mx >= mw || my >= mh) return false
        return on[my * mw + mx] === 1
      }
      bb = x1 < 0 ? null : { x0: x0 / kx, y0: y0 / ky, x1: (x1 + 1) / kx, y1: (y1 + 1) / ky }
    }
    const size = clamp(job.size * S, 6, SCR * 0.86)
    const pts = job.paths ? this.planPaths(job, size) : bb ? this.plan(job, size, bb, inside) : []
    // time: a stroke moves at one speed, a lifted brush travels faster
    let total = 0
    let px = pts.length ? pts[0].x : 0
    let py = pts.length ? pts[0].y : 0
    for (const p of pts) {
      const d = Math.hypot(p.x - px, p.y - py)
      total += p.up ? d * 0.45 + size * 0.5 : Math.max(d, size * 0.05)
      if (p.tap) total += size * 0.7
      p.t = total
      px = p.x
      py = p.y
    }
    const k = total > 0 ? (job.dur * 0.94) / total : 0
    for (const p of pts) p.t *= k
    this.job = { ...job, src, pts, i: 0, t: 0, size, tint: 0, done: pts.length === 0 && !job.final }
    if (!pts.length && job.final) this.finish()
    return this.job
  }

  plan(job, size, bb, inside) {
    const r = rng(job.seed || 3)
    const pts = []
    let pen = false
    const put = (x, y, ang, k = 1, tap = false) => {
      if (!inside(x, y)) {
        pen = false
        return
      }
      pts.push({ x, y, ang, k, up: !pen || tap, tap })
      pen = !tap
    }
    const lift = () => (pen = false)
    const m = size * 0.2
    const style = job.style
    if (style === 'rows' || style === 'cols') {
      const rows = style === 'rows'
      const a0 = rows ? bb.y0 : bb.x0
      const a1 = rows ? bb.y1 : bb.x1
      const b0 = (rows ? bb.x0 : bb.y0) - m
      const b1 = (rows ? bb.x1 : bb.y1) + m
      const gap = size * 0.58
      const step = size * 0.2
      let n = 0
      for (let a = a0 + size * 0.22; a <= a1 + gap * 0.45; a += gap, n++) {
        const fwd = n % 2 === 0
        const ph = r() * 9
        for (let b = fwd ? b0 : b1; fwd ? b <= b1 : b >= b0; b += fwd ? step : -step) {
          const w = Math.sin(b * 0.011 + ph) * size * 0.07
          if (rows) put(b, a + w, fwd ? 0 : Math.PI)
          else put(a + w, b, fwd ? Math.PI / 2 : -Math.PI / 2)
        }
        lift()
      }
    } else if (style === 'criss') {
      const gx = size * 0.86
      const gy = size * 0.62
      const L = size * 0.72
      let n = 0
      for (let y = bb.y0 + size * 0.2; y <= bb.y1 + gy * 0.3; y += gy, n++) {
        const fwd = n % 2 === 0
        for (let x = fwd ? bb.x0 : bb.x1; fwd ? x <= bb.x1 + gx * 0.4 : x >= bb.x0 - gx * 0.4; x += fwd ? gx : -gx) {
          const cx = x + (r() - 0.5) * size * 0.3
          const cy = y + (r() - 0.5) * size * 0.25
          for (const s of [1, -1]) {
            for (let i = 0; i <= 5; i++) {
              const t = i / 5 - 0.5
              put(cx + t * 2 * L * s, cy + t * 2 * L * 0.72, Math.atan2(0.72, s))
            }
            lift()
          }
        }
      }
    } else if (style === 'knife') {
      const gx = size * 0.92
      const gy = size * 0.5
      let n = 0
      for (let y = bb.y0 + size * 0.15; y <= bb.y1 + gy * 0.4; y += gy, n++) {
        const fwd = n % 2 === 0
        for (let x = fwd ? bb.x0 : bb.x1; fwd ? x <= bb.x1 + gx * 0.4 : x >= bb.x0 - gx * 0.4; x += fwd ? gx : -gx) {
          const s = r() < 0.5 ? 1 : -1
          const a = s * (0.45 + r() * 0.5)
          const L = size * (0.7 + r() * 0.5)
          const cx = x + (r() - 0.5) * size * 0.4
          const cy = y + (r() - 0.5) * size * 0.2
          for (let i = 0; i <= 4; i++) {
            const t = i / 4 - 0.5
            put(cx + Math.sin(a) * t * L * 1.4, cy + Math.cos(a) * t * L, Math.atan2(Math.cos(a), Math.sin(a)))
          }
          lift()
        }
      }
    } else {
      // dab: taps
      const g = size * 0.46
      let n = 0
      for (let y = bb.y0 + size * 0.1; y <= bb.y1 + g * 0.5; y += g, n++) {
        const fwd = n % 2 === 0
        for (let x = fwd ? bb.x0 - g * 0.3 : bb.x1 + g * 0.3; fwd ? x <= bb.x1 + g * 0.5 : x >= bb.x0 - g * 0.5; x += fwd ? g : -g) {
          put(x + (r() - 0.5) * g * 0.7, y + (r() - 0.5) * g * 0.7, r() * TAU, 0.85 + r() * 0.35, true)
        }
      }
    }
    return pts
  }

  planPaths(job, size) {
    const S = this.S
    const pts = []
    const step = Math.max(1.5, size * 0.3)
    for (const path of job.paths) {
      let first = true
      for (let i = 0; i < path.length - 1; i++) {
        const ax = path[i][0] * S
        const ay = path[i][1] * S
        const bx = path[i + 1][0] * S
        const by = path[i + 1][1] * S
        const d = Math.hypot(bx - ax, by - ay)
        const n = Math.max(1, Math.round(d / step))
        const ang = Math.atan2(by - ay, bx - ax)
        for (let j = i === 0 ? 0 : 1; j <= n; j++) {
          pts.push({ x: lerp(ax, bx, j / n), y: lerp(ay, by, j / n), ang, k: 1, up: first, tap: false })
          first = false
        }
      }
    }
    return pts
  }

  stamp(p) {
    const job = this.job
    const size = job.size * p.k
    const half = Math.min(SCR / 2, Math.ceil(size * 0.6))
    const full = half * 2
    const s = this.sctx
    const kind = job.brush || BRUSH_OF[job.style] || 'flat'
    const list = this.brushes[kind]
    const mask = list[(job.i + (p.tap ? job.i >> 1 : 0)) % list.length]
    s.setTransform(1, 0, 0, 1, 0, 0)
    s.globalCompositeOperation = 'source-over'
    s.globalAlpha = 1
    s.clearRect(0, 0, full, full)
    s.translate(half, half)
    s.rotate(p.ang)
    const along = kind === 'flat' ? size * 0.9 : size
    s.drawImage(mask, -along / 2, -size / 2, along, size)
    s.setTransform(1, 0, 0, 1, 0, 0)
    s.globalCompositeOperation = 'source-in'
    const x0 = Math.round(p.x - half)
    const y0 = Math.round(p.y - half)
    if (job.solid) {
      s.fillStyle = job.solid
      s.fillRect(0, 0, full, full)
    } else {
      // the part of the finished image that sits under this stamp
      const sx = Math.max(0, x0)
      const sy = Math.max(0, y0)
      const ex = Math.min(this.W, x0 + full)
      const ey = Math.min(this.H, y0 + full)
      if (ex <= sx || ey <= sy) return
      s.drawImage(job.src, sx, sy, ex - sx, ey - sy, sx - x0, sy - y0, ex - sx, ey - sy)
      if (job.tint) {
        s.globalCompositeOperation = 'source-atop'
        s.fillStyle = job.tint > 0 ? `rgba(255,255,255,${job.tint})` : `rgba(0,0,0,${-job.tint})`
        s.fillRect(0, 0, full, full)
      }
    }
    const c = this.ctx
    c.globalAlpha = job.alpha ?? 0.94
    c.drawImage(this.scratch, 0, 0, full, full, x0, y0, full, full)
    c.globalAlpha = 1
  }

  finish() {
    const job = this.job
    if (!job || job.done) return
    const c = this.ctx
    c.globalAlpha = 1
    if (job.draw) c.drawImage(this.layer, 0, 0)
    else if (job.final && job.plate) c.drawImage(this.plate, 0, 0)
    job.done = true
    this.tip.down = false
    this.version++
  }

  /** returns true while there is still paint going on */
  update(dt) {
    const job = this.job
    if (!job || job.done) return false
    job.t += dt
    const pts = job.pts
    let n = 0
    while (job.i < pts.length && pts[job.i].t <= job.t) {
      const p = pts[job.i]
      if (p.up) job.tint = (Math.sin(job.i * 12.9898) * 43758.5453 % 1) * 0.07
      this.stamp(p)
      job.i++
      n++
    }
    // a part settles in over its last moments, so the final image never pops
    if (job.draw && job.t > job.dur * 0.86) {
      this.ctx.globalAlpha = 0.14
      this.ctx.drawImage(this.layer, 0, 0)
      this.ctx.globalAlpha = 1
      n++
    }
    if (n) this.version++
    const tip = this.tip
    if (job.i < pts.length) {
      const b = pts[job.i]
      const a = job.i > 0 ? pts[job.i - 1] : b
      const span = b.t - a.t
      const f = span > 1e-5 ? clamp((job.t - a.t) / span, 0, 1) : 1
      const x = lerp(a.x, b.x, f)
      const y = lerp(a.y, b.y, f)
      tip.speed = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(span, 0.016) / this.H
      tip.u = x / this.W
      tip.v = y / this.H
      // a tap is in the air between touches; a stroke stays on the canvas
      tip.down = b.tap ? f > 0.82 || f < 0.1 : !b.up
      tip.lift = b.up ? Math.sin(f * Math.PI) : 0
      tip.ang = b.ang
    }
    if (job.t >= job.dur) this.finish()
    return !job.done
  }

  get busy() {
    return !!this.job && !this.job.done
  }

  /** jump to the end of the current job (used when skipping ahead) */
  flush() {
    const job = this.job
    if (!job || job.done) return
    while (job.i < job.pts.length) {
      this.stamp(job.pts[job.i])
      job.i++
    }
    this.finish()
  }
}

/** "Moss", in a hand: polylines in design px, placed at (x, y) */
export function signature(x, y, k = 1.5) {
  const L = [
    [[0, 30], [3, 6], [5, 4], [12, 24], [19, 4], [21, 6], [25, 30]],
    [[37, 18], [32, 21], [31, 27], [36, 31], [41, 28], [42, 22], [37, 18]],
    [[57, 19], [51, 18], [48, 22], [55, 26], [56, 30], [48, 31]],
    [[72, 19], [66, 18], [63, 22], [70, 26], [71, 30], [63, 31]],
    [[-4, 39], [30, 36], [60, 37], [82, 35]],
  ]
  return L.map((p) => p.map(([a, b]) => [x + a * k, y + b * k]))
}

export { DW, DH }
