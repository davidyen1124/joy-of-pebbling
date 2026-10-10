// Draws the Pebble that Cobb paints: any kind, colour, haircut and job.
//
// Nothing here knows about brushes. buildPebble() returns a list of steps; each step can draw one
// part (the body, the hat, the eyes...) onto a clear canvas, in a 1024 x 768 design space. The painter
// then brushes each part onto the real canvas, one after another, which is what you watch.
import { KINDS, COLORS, HAIR_COLORS, JOBS, byId } from './data.js'
import { rng, clamp, lerp, smooth } from './rng.js'

const TAU = Math.PI * 2
export const DW = 1024
export const DH = 768

// ── small drawing helpers ───────────────────────────────────────────────────
const ell = (c, x, y, rx, ry, fill, rot = 0) => {
  c.beginPath()
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU)
  c.fillStyle = fill
  c.fill()
}
const ring = (c, x, y, r, stroke, lw) => {
  c.beginPath()
  c.arc(x, y, r, 0, TAU)
  c.strokeStyle = stroke
  c.lineWidth = lw
  c.stroke()
}
const poly = (c, pts, fill, stroke, lw = 0) => {
  c.beginPath()
  pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])))
  c.closePath()
  if (fill) {
    c.fillStyle = fill
    c.fill()
  }
  if (stroke) {
    c.strokeStyle = stroke
    c.lineWidth = lw
    c.lineJoin = 'round'
    c.stroke()
  }
}
const line = (c, pts, color, lw, cap = 'round') => {
  c.beginPath()
  pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])))
  c.strokeStyle = color
  c.lineWidth = lw
  c.lineCap = cap
  c.lineJoin = 'round'
  c.stroke()
}
const quad = (c, x0, y0, cx, cy, x1, y1, color, lw) => {
  c.beginPath()
  c.moveTo(x0, y0)
  c.quadraticCurveTo(cx, cy, x1, y1)
  c.strokeStyle = color
  c.lineWidth = lw
  c.lineCap = 'round'
  c.stroke()
}
const rrect = (c, x, y, w, h, r, fill, stroke, lw = 0) => {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
  if (fill) {
    c.fillStyle = fill
    c.fill()
  }
  if (stroke) {
    c.strokeStyle = stroke
    c.lineWidth = lw
    c.stroke()
  }
}
const star = (c, x, y, R, fill, n = 5, inner = 0.45, rot = -Math.PI / 2) => {
  c.beginPath()
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n
    const r = i % 2 ? R * inner : R
    c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  c.closePath()
  c.fillStyle = fill
  c.fill()
}
/** half an ellipse, the top half */
const dome = (c, x, y, rx, ry, fill) => {
  c.beginPath()
  c.ellipse(x, y, rx, ry, 0, Math.PI, TAU)
  c.closePath()
  c.fillStyle = fill
  c.fill()
}
const at = (c, x, y, s, rot, fn) => {
  c.save()
  c.translate(x, y)
  if (rot) c.rotate(rot)
  c.scale(s, s)
  fn()
  c.restore()
}
/** a lumpy blob: a disc with smaller discs round its edge */
const blob = (c, x, y, rx, ry, color, r, bumps = 14, amp = 0.3) => {
  ell(c, x, y, rx * 0.88, ry * 0.88, color)
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * TAU + r() * 0.25
    const br = Math.min(rx, ry) * (amp + r() * 0.08)
    ell(c, x + Math.cos(a) * (rx - br * 0.72), y + Math.sin(a) * (ry - br * 0.72), br, br, color)
  }
}
const curl = (c, x, y, rad, color, lw, a0 = 3.6, a1 = 5.4) => {
  c.beginPath()
  c.arc(x, y, rad, a0, a1)
  c.strokeStyle = color
  c.lineWidth = lw
  c.lineCap = 'round'
  c.stroke()
}

// ── the body ────────────────────────────────────────────────────────────────
function makeBody(kind, col, cx, bottom, size, r) {
  const h = size * kind.hs
  const w = h * kind.wr
  const top = bottom - h
  const N = 120
  const pts = []
  const ph = [r() * TAU, r() * TAU, r() * TAU]
  const e = 2 / kind.n
  for (let i = 0; i < N; i++) {
    const th = (i / N) * TAU
    const cs = Math.cos(th)
    const sn = Math.sin(th)
    const ux = Math.sign(cs) * Math.abs(cs) ** e
    const uy = Math.sign(sn) * Math.abs(sn) ** e
    const tt = (1 - uy) / 2
    let wm = 1 - kind.tt * (1 - tt) ** 1.6 - kind.tb * tt ** 2.5
    if (kind.lumps) wm *= 1 + 0.045 * Math.sin(3 * th + ph[0]) + 0.03 * Math.sin(5 * th + ph[1])
    let y = top + h * tt
    if (kind.lumps) y += h * 0.012 * Math.sin(4 * th + ph[2])
    pts.push([cx + (w / 2) * ux * wm + (kind.lean || 0) * w * Math.sin(Math.PI * tt), y])
  }
  const path = new Path2D()
  pts.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])))
  path.closePath()
  const spanAt = (y) => {
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < N; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % N]
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const x = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0])
        lo = Math.min(lo, x)
        hi = Math.max(hi, x)
      }
    }
    if (lo === Infinity) {
      const yy = clamp(y, top + 2, bottom - 2)
      return yy === y ? [cx, cx] : spanAt(yy)
    }
    return [lo, hi]
  }
  const U = Math.sqrt(w * h) / 284
  const flat = kind.hs < 0.7
  const eyeY = top + h * (flat ? 0.43 : 0.36)
  const [el, er] = spanAt(eyeY)
  const [hl, hr] = spanAt(top + h * 0.1)
  const G = {
    kind, col, cx, top, bottom, w, h, pts, path, spanAt, U, r, flat,
    eyeY,
    faceX: (el + er) / 2 - (er - el) * 0.045,
    faceW: er - el,
    eyeDX: clamp((er - el) * 0.165, 22 * U, 48 * U),
    armY: top + h * (flat ? 0.62 : 0.56),
    aw: clamp(0.2 * w, 34 * U, 52 * U),
    L: Math.min(0.36 * Math.sqrt(w * h), 124),
    hx: (hl + hr) / 2,
    hw: clamp(hr - hl, 96, 230),
    lift: 0,
  }
  return G
}

const inBody = (c, G, fn) => {
  c.save()
  c.clip(G.path)
  fn()
  c.restore()
}

function drawShadow(c, G) {
  const rx = G.w * 0.64
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 1)
  g.addColorStop(0, 'rgba(10,12,24,0.5)')
  g.addColorStop(0.6, 'rgba(10,12,24,0.32)')
  g.addColorStop(1, 'rgba(10,12,24,0)')
  c.save()
  c.translate(G.cx + 6 * G.U, G.bottom + 10 * G.U)
  c.scale(rx, 20 * G.U)
  c.fillStyle = g
  c.beginPath()
  c.arc(0, 0, 1, 0, TAU)
  c.fill()
  c.restore()
}

function drawFeet(c, G) {
  const rx = clamp(G.w * 0.17, 26 * G.U, 50 * G.U)
  const ry = 14.5 * G.U
  const dx = clamp(G.w * 0.2, rx * 0.9, G.w * 0.3)
  for (const s of [-1, 1]) {
    ell(c, G.cx + s * dx, G.bottom + 4 * G.U, rx, ry, G.col.feet)
    ell(c, G.cx + s * dx - rx * 0.2, G.bottom + 0.5 * G.U, rx * 0.5, ry * 0.36, 'rgba(255,255,255,0.13)')
  }
}

function drawBody(c, G) {
  c.fillStyle = G.col.base
  c.fill(G.path)
}

function drawShade(c, G) {
  // the dark crescent down the right and under: the body, minus itself moved up and left
  const mx = G.cx
  const my = G.top + G.h / 2
  const both = new Path2D()
  G.pts.forEach((p, i) => (i ? both.lineTo(p[0], p[1]) : both.moveTo(p[0], p[1])))
  both.closePath()
  G.pts.forEach((p, i) => {
    const x = mx + (p[0] - mx) * 0.985 - G.w * 0.085
    const y = my + (p[1] - my) * 0.985 - G.h * 0.045
    if (i) both.lineTo(x, y)
    else both.moveTo(x, y)
  })
  both.closePath()
  inBody(c, G, () => {
    c.fillStyle = G.col.dark
    c.fill(both, 'evenodd')
    const x = G.cx - G.w * 0.2
    const y = G.top + G.h * 0.24
    const g = c.createRadialGradient(x, y, 0, x, y, G.w * 0.34)
    g.addColorStop(0, G.col.light)
    g.addColorStop(1, G.col.light + '00')
    c.globalAlpha = 0.7
    c.fillStyle = g
    c.fillRect(G.cx - G.w, G.top, G.w * 2, G.h)
    c.globalAlpha = 1
  })
}

// hand = [out, down], elbow = [out, down], in arm lengths
const POSES = {
  down: { h: [0.42, 0.74], e: [0.95, 0.12] },
  hip: { h: [0.1, 0.6], e: [0.98, 0.26] },
  up: { h: [0.86, -0.9], e: [1.05, 0.2] },
  hold: { h: [0.98, -0.16], e: [0.72, 0.52] },
  front: { h: [-0.62, 0.26], e: [0.5, 0.74] },
  out: { h: [1.16, -0.04], e: [0.6, 0.14] },
}

function drawArm(c, G, side, pose) {
  const [l, r] = G.spanAt(G.armY)
  const sx = side < 0 ? l + G.aw * 0.42 : r - G.aw * 0.42
  const sy = G.armY
  const P = POSES[pose]
  const hx = sx + side * P.h[0] * G.L
  const hy = sy + P.h[1] * G.L
  const ex = sx + side * P.e[0] * G.L
  const ey = sy + P.e[1] * G.L
  const o = G.aw * 0.11
  quad(c, sx + o, sy + o * 1.5, ex + o, ey + o * 1.5, hx + o, hy + o * 1.5, G.col.dark, G.aw)
  quad(c, sx, sy, ex, ey, hx, hy, G.col.base, G.aw)
  c.globalAlpha = 0.5
  quad(c, sx - o * 0.6, sy - G.aw * 0.2, ex - o * 0.6, ey - G.aw * 0.2, hx - o * 0.6, hy - G.aw * 0.2, G.col.light, G.aw * 0.22)
  c.globalAlpha = 1
  return { x: hx, y: hy }
}

/** the hand again, over whatever it is holding */
function grip(c, G, hand) {
  ell(c, hand.x + G.aw * 0.06, hand.y + G.aw * 0.08, G.aw * 0.5, G.aw * 0.5, G.col.dark)
  ell(c, hand.x, hand.y, G.aw * 0.5, G.aw * 0.5, G.col.base)
}

function drawEyes(c, G) {
  const color = G.col.paleEyes ? '#f3efe2' : '#101b2c'
  for (const s of [-1, 1]) ell(c, G.faceX + s * G.eyeDX, G.eyeY, 9.5 * G.U, 12.5 * G.U, color)
}

// ── hair ────────────────────────────────────────────────────────────────────
// hairlines: y for an x. t runs -1..1 across the face.
const tOf = (G, x) => clamp((x - G.faceX) / (G.faceW / 2), -1.4, 1.4)
const fringe = (G, d) => () => G.eyeY - d * G.U
const arcLine = (G, mid, side) => (x) => G.eyeY - (mid + (side - mid) * Math.min(1, tOf(G, x) ** 2)) * G.U

function region(c, G, hairline, below) {
  const x0 = G.cx - G.w * 1.2
  const x1 = G.cx + G.w * 1.2
  const far = below ? G.bottom + 80 : G.top - 500
  c.beginPath()
  c.moveTo(x0, far)
  c.lineTo(x1, far)
  for (let i = 0; i <= 32; i++) {
    const x = x1 + ((x0 - x1) * i) / 32
    c.lineTo(x, hairline(x))
  }
  c.closePath()
}

/** hair that hugs the head: the body's outline grown by `thick`, kept above a hairline */
function cap(c, G, color, thick, hairline) {
  c.save()
  region(c, G, hairline, false)
  c.clip()
  c.fillStyle = color
  c.fill(G.path)
  c.strokeStyle = color
  c.lineWidth = thick * 2
  c.lineJoin = 'round'
  c.stroke(G.path)
  c.restore()
}

/** big hair that must not cover the face: painted above the hairline, and again outside the silhouette */
function openFace(c, G, hairline, paint) {
  c.save()
  region(c, G, hairline, false)
  c.clip()
  paint()
  c.restore()
  const outside = new Path2D()
  outside.rect(G.cx - 3000, G.top - 3000, 6000, 6000)
  G.pts.forEach((p, i) => (i ? outside.lineTo(p[0], p[1]) : outside.moveTo(p[0], p[1])))
  outside.closePath()
  c.save()
  c.clip(outside, 'evenodd')
  paint()
  c.restore()
}

/** hair hanging down one side, outside the silhouette */
function curtain(c, G, side, y0, y1, out, color, wave = 0) {
  const pts = []
  const back = []
  const n = 14
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const y = lerp(y0, y1, t)
    const s = G.spanAt(clamp(y, G.top + 4, G.bottom - 4))
    const edge = side > 0 ? s[1] : s[0]
    const grow = Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5)
    pts.push([edge + side * (out * grow + Math.sin(t * 9) * wave), y])
    back.push([edge - side * 10 * G.U, y])
  }
  poly(c, pts.concat(back.reverse()), color)
  ell(c, (pts[n][0] + (side > 0 ? G.spanAt(clamp(y1, G.top + 4, G.bottom - 4))[1] : G.spanAt(clamp(y1, G.top + 4, G.bottom - 4))[0])) / 2, y1, Math.abs(out) * 0.55 + 5 * G.U, 9 * G.U, color)
}

/** points along the top of the head, right to left, above a height */
const crownPts = (G, yMax) => G.pts.filter((p) => p[1] < yMax)

const HAIR = {
  afro(c, G, hc, r) {
    const R = G.hw * 0.76
    const cy = G.top + R * 0.2
    const seed = r.int(1, 1e6)
    openFace(c, G, arcLine(G, 42, 12), () => {
      const q = rng(seed)
      blob(c, G.hx, cy, R, R * 0.93, hc.c, q, 18, 0.29)
      for (let i = 0; i < 16; i++) {
        const a = Math.PI + q() * Math.PI
        const d = R * (0.2 + q() * 0.62)
        curl(c, G.hx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, 13 * G.U, hc.hi, 4.5 * G.U, 3.3 + q(), 5.2 + q())
      }
    })
    return R * 0.68
  },
  mohawk(c, G, hc, r) {
    const n = 7
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const k = t * 2 - 1
      const bx = G.hx + k * G.hw * 0.4
      const by = G.top + G.h * 0.03 + G.hw * 0.13 * k * k
      const a = k * 0.62
      const len = G.hw * (0.62 - 0.2 * k * k) * (0.9 + r() * 0.2)
      const hwid = G.hw * 0.1
      const tip = [bx + Math.sin(a) * len, by - Math.cos(a) * len]
      poly(c, [[bx - Math.cos(a) * hwid, by - Math.sin(a) * hwid + 10 * G.U], tip, [bx + Math.cos(a) * hwid, by + Math.sin(a) * hwid + 10 * G.U]], hc.c)
      line(c, [[bx - Math.cos(a) * hwid * 0.4, by], [tip[0] - 3, tip[1] + 10]], hc.hi, 3.5 * G.U)
    }
    return G.hw * 0.46
  },
  mullet(c, G, hc) {
    curtain(c, G, 1, G.top + G.h * 0.14, G.armY + G.h * 0.2, 34 * G.U, hc.c, 3)
    curtain(c, G, -1, G.top + G.h * 0.16, G.eyeY + G.h * 0.07, 12 * G.U, hc.c)
    cap(c, G, hc.c, 10 * G.U, fringe(G, 32))
    const [, e] = G.spanAt(G.eyeY)
    for (let i = 0; i < 3; i++) quad(c, e + (10 + i * 9) * G.U, G.eyeY - 10 * G.U, e + (22 + i * 9) * G.U, G.eyeY + 50 * G.U, e + (12 + i * 8) * G.U, G.armY + G.h * 0.1, hc.hi, 3 * G.U)
    return 8 * G.U
  },
  pompadour(c, G, hc, r) {
    cap(c, G, hc.c, 8 * G.U, arcLine(G, 34, 12))
    c.save()
    c.translate(G.faceX - G.hw * 0.02, G.top - G.hw * 0.1)
    c.rotate(-0.2)
    blob(c, 0, 0, G.hw * 0.56, G.hw * 0.34, hc.c, r, 9, 0.5)
    quad(c, -G.hw * 0.36, G.hw * 0.02, -G.hw * 0.06, -G.hw * 0.3, G.hw * 0.34, -G.hw * 0.08, hc.hi, 6 * G.U)
    quad(c, -G.hw * 0.22, G.hw * 0.1, 0, -G.hw * 0.12, G.hw * 0.3, G.hw * 0.06, hc.hi, 4 * G.U)
    c.restore()
    return G.hw * 0.36
  },
  bowl(c, G, hc) {
    cap(c, G, hc.c, 13 * G.U, fringe(G, 22))
    quad(c, G.hx - G.hw * 0.34, G.top + G.h * 0.07, G.hx - G.hw * 0.1, G.top - 4 * G.U, G.hx + G.hw * 0.2, G.top + G.h * 0.02, hc.hi, 7 * G.U)
    return 11 * G.U
  },
  pigtails(c, G, hc) {
    const [l, r2] = G.spanAt(G.eyeY - 16 * G.U)
    for (const [s, e] of [[-1, l], [1, r2]]) {
      ell(c, e + s * 36 * G.U, G.eyeY + 14 * G.U, 22 * G.U, 42 * G.U, hc.c, s * -0.45)
      ell(c, e + s * 34 * G.U, G.eyeY + 6 * G.U, 7 * G.U, 22 * G.U, hc.hi, s * -0.45)
    }
    cap(c, G, hc.c, 9 * G.U, (x) => G.eyeY - (24 + 30 * (1 - Math.min(1, Math.abs(tOf(G, x)) * 1.6))) * G.U)
    for (const [s, e] of [[-1, l], [1, r2]]) ell(c, e + s * 9 * G.U, G.eyeY - 20 * G.U, 9 * G.U, 12 * G.U, '#f2c12e')
    return 8 * G.U
  },
  bun(c, G, hc) {
    cap(c, G, hc.c, 8 * G.U, arcLine(G, 42, 10))
    const R = G.hw * 0.2
    ell(c, G.hx, G.top - R * 0.72, R, R, hc.c)
    curl(c, G.hx, G.top - R * 0.72, R * 0.55, hc.hi, 5 * G.U, 3.4, 5.6)
    ell(c, G.hx, G.top + 1 * G.U, R * 0.62, 6 * G.U, '#d94a3a')
    return R * 1.7
  },
  long(c, G, hc) {
    const y1 = G.armY + G.h * 0.3
    curtain(c, G, -1, G.top + G.h * 0.12, y1, 26 * G.U, hc.c, 2)
    curtain(c, G, 1, G.top + G.h * 0.12, y1, 30 * G.U, hc.c, 2)
    cap(c, G, hc.c, 10 * G.U, (x) => G.eyeY - (20 + 34 * (1 - Math.min(1, Math.abs(tOf(G, x)) * 1.3))) * G.U)
    const [l, e] = G.spanAt(G.eyeY)
    for (const [s, x] of [[-1, l], [1, e]]) {
      quad(c, x + s * 12 * G.U, G.eyeY - 20 * G.U, x + s * 22 * G.U, G.eyeY + 60 * G.U, x + s * 14 * G.U, y1 - 20 * G.U, hc.hi, 3.5 * G.U)
    }
    return 9 * G.U
  },
  curly(c, G, hc, r) {
    const pts = crownPts(G, G.eyeY - 2 * G.U)
    const seed = r.int(1, 1e6)
    openFace(c, G, arcLine(G, 34, 8), () => {
      const q = rng(seed)
      for (const off of [10, -14]) {
        for (let i = 0; i < pts.length; i += 5) {
          const p = pts[i]
          const dx = p[0] - G.hx
          const dy = p[1] - (G.top + G.h * 0.3)
          const d = Math.hypot(dx, dy) || 1
          ell(c, p[0] + (dx / d) * off * G.U, p[1] + (dy / d) * off * G.U, (21 + q() * 5) * G.U, (21 + q() * 5) * G.U, hc.c)
        }
      }
      ell(c, G.hx, G.top + G.h * 0.07, G.hw * 0.44, G.h * 0.09, hc.c)
      for (let i = 2; i < pts.length; i += 5) {
        const p = pts[i]
        curl(c, p[0], p[1], 9 * G.U, hc.hi, 4 * G.U, 3.2 + q(), 5.4 + q())
      }
    })
    return 26 * G.U
  },
  spiky(c, G, hc, r) {
    const n = 9
    const cy = G.top + G.h * 0.3
    for (let i = 0; i < n; i++) {
      const a = lerp(-1.25, 1.25, i / (n - 1))
      const pts = crownPts(G, cy)
      const p = pts[Math.round(((a + 1.6) / 3.2) * (pts.length - 1))] || pts[0]
      const px = pts.length ? p[0] : G.hx
      const py = pts.length ? p[1] : G.top
      const len = G.hw * (0.34 + r() * 0.2)
      const wd = G.hw * 0.13
      const dx = Math.sin(-a)
      const dy = -Math.cos(a)
      poly(c, [[px - dy * wd - dx * 14, py + dx * wd - dy * 14], [px + dx * len, py + dy * len], [px + dy * wd - dx * 14, py - dx * wd - dy * 14]], hc.c)
      line(c, [[px, py], [px + dx * len * 0.8, py + dy * len * 0.8]], hc.hi, 3 * G.U)
    }
    cap(c, G, hc.c, 8 * G.U, (x) => G.eyeY - (26 + 12 * Math.abs(Math.sin(x * 0.11))) * G.U)
    return G.hw * 0.22
  },
  combover(c, G, hc) {
    const [l, e] = G.spanAt(G.eyeY - 24 * G.U)
    for (let i = 0; i < 4; i++) {
      quad(c, l - 2 * G.U, G.eyeY - (24 - i * 9) * G.U, G.hx - G.hw * 0.1, G.top - (22 - i * 13) * G.U, e - G.hw * 0.06, G.top + G.h * (0.05 + i * 0.035), hc.c, 4.5 * G.U)
    }
    return 0
  },
  bald(c, G) {
    quad(c, G.hx - G.hw * 0.36, G.top + G.h * 0.1, G.hx - G.hw * 0.24, G.top + G.h * 0.03, G.hx - G.hw * 0.02, G.top + G.h * 0.025, 'rgba(255,255,255,0.8)', 8 * G.U)
    ell(c, G.hx + G.hw * 0.12, G.top + G.h * 0.04, 5 * G.U, 4 * G.U, 'rgba(255,255,255,0.8)')
    return 0
  },
  beehive(c, G, hc) {
    const rx = G.hw * 0.47
    const ry = G.hw * 0.8
    cap(c, G, hc.c, 9 * G.U, arcLine(G, 38, 12))
    ell(c, G.hx, G.top - ry * 0.55, rx, ry, hc.c)
    for (let i = 0; i < 5; i++) {
      const y = G.top - ry * (1.15 - i * 0.3)
      const k = Math.sqrt(Math.max(0.05, 1 - ((y - (G.top - ry * 0.55)) / ry) ** 2))
      quad(c, G.hx - rx * k * 0.9, y + 8 * G.U, G.hx, y - 14 * G.U, G.hx + rx * k * 0.9, y + 10 * G.U, hc.hi, 4 * G.U)
    }
    return ry * 1.45
  },
  dreads(c, G, hc, r) {
    const y0 = G.top + G.h * 0.14
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const sp = G.spanAt(y0 + i * 6 * G.U)
        const x = (s > 0 ? sp[1] : sp[0]) + s * (2 + i * 13) * G.U
        const y1 = G.armY + G.h * (0.24 - i * 0.1) + r() * 16 * G.U
        quad(c, x - s * 16 * G.U, y0 - i * 6 * G.U, x + s * 8 * G.U, (y0 + y1) / 2, x, y1, hc.c, 14 * G.U)
        ell(c, x, y1 - 9 * G.U, 7.5 * G.U, 5 * G.U, '#f2c12e')
      }
    }
    cap(c, G, hc.c, 11 * G.U, fringe(G, 34))
    for (let i = -2; i <= 2; i++) quad(c, G.hx + i * G.hw * 0.17, G.top + 2 * G.U, G.hx + i * G.hw * 0.2, G.top + G.h * 0.06, G.hx + i * G.hw * 0.21, G.eyeY - 38 * G.U, hc.hi, 3 * G.U)
    return 10 * G.U
  },
  ponytail(c, G, hc) {
    const x = G.hx + G.hw * 0.36
    const y = G.top + G.h * 0.07
    c.beginPath()
    c.moveTo(x, y - 10 * G.U)
    c.quadraticCurveTo(x + G.hw * 0.72, y - G.hw * 0.34, x + G.hw * 0.7, y + G.h * 0.42)
    c.quadraticCurveTo(x + G.hw * 0.46, y + G.h * 0.16, x - 4 * G.U, y + 24 * G.U)
    c.closePath()
    c.fillStyle = hc.c
    c.fill()
    quad(c, x + 12 * G.U, y, x + G.hw * 0.52, y - G.hw * 0.12, x + G.hw * 0.6, y + G.h * 0.28, hc.hi, 4 * G.U)
    cap(c, G, hc.c, 9 * G.U, arcLine(G, 40, 12))
    ell(c, x + 10 * G.U, y + 5 * G.U, 7 * G.U, 15 * G.U, '#d94a3a', 0.5)
    return 8 * G.U
  },
  sidepart(c, G, hc) {
    cap(c, G, hc.c, 10 * G.U, (x) => G.eyeY - (24 + 24 * smooth(-1, 1, tOf(G, x))) * G.U)
    ell(c, G.hx + G.hw * 0.1, G.top - 1 * G.U, G.hw * 0.5, G.hw * 0.15, hc.c, -0.1)
    quad(c, G.hx - G.hw * 0.3, G.top + G.h * 0.03, G.hx + G.hw * 0.06, G.top - G.hw * 0.14, G.hx + G.hw * 0.46, G.top + G.h * 0.02, hc.hi, 5 * G.U)
    line(c, [[G.hx - G.hw * 0.3, G.top + G.h * 0.015], [G.hx - G.hw * 0.36, G.eyeY - 30 * G.U]], 'rgba(0,0,0,0.3)', 3 * G.U)
    return 13 * G.U
  },
  flattop(c, G, hc) {
    const [l, e] = G.spanAt(G.eyeY - 30 * G.U)
    const yt = G.top - G.hw * 0.3
    openFace(c, G, fringe(G, 30), () => {
      poly(c, [[l - 5 * G.U, G.eyeY - 28 * G.U], [l - 12 * G.U, yt], [e + 12 * G.U, yt], [e + 5 * G.U, G.eyeY - 28 * G.U]], hc.c)
      for (let x = l; x < e + 6 * G.U; x += 15 * G.U) line(c, [[x, yt + 3 * G.U], [x + 2 * G.U, yt - 7 * G.U]], hc.c, 5 * G.U)
      line(c, [[l + 4 * G.U, yt + 14 * G.U], [e - 14 * G.U, yt + 14 * G.U]], hc.hi, 5 * G.U)
    })
    return G.hw * 0.3
  },
}

// ── hats: drawn in a head-sized space. (0, 0) is where the hat sits, y is down, the head is 150 wide ──
const HAT = {
  firefighter(c) {
    ell(c, 26, 24, 100, 15, '#96190f')
    dome(c, 0, 24, 84, 80, '#cf2a1f')
    ell(c, -6, 24, 104, 15, '#b3221a')
    quad(c, -8, -55, 44, -40, 74, 16, '#96190f', 9)
    poly(c, [[-26, -30], [14, -30], [14, -4], [-6, 12], [-26, -4]], '#f2c12e')
    ell(c, -6, -12, 7, 7, '#cf2a1f')
    quad(c, -62, -8, -50, -46, -18, -62, 'rgba(255,255,255,0.35)', 7)
  },
  chef(c) {
    for (const [x, y, r] of [[-46, -64, 36], [46, -64, 36], [0, -82, 46], [-24, -50, 30], [24, -50, 30]]) ell(c, x, y, r, r, '#f6f3ec')
    rrect(c, -62, -34, 124, 50, 8, '#f6f3ec')
    line(c, [[-60, -6], [60, -6]], '#d6d0c4', 4)
    for (const x of [-30, 0, 30]) line(c, [[x, -30], [x, -60]], '#d6d0c4', 4)
    curl(c, -40, -62, 24, '#d6d0c4', 4, 3.4, 4.9)
  },
  doctor(c) {
    quad(c, -82, 40, 0, 2, 82, 40, '#34363c', 10)
    ell(c, 24, 10, 27, 27, '#9aa0a8')
    ell(c, 24, 10, 22, 22, '#dfe3e8')
    ell(c, 24, 10, 5, 5, '#6d727a')
    curl(c, 24, 10, 15, '#ffffff', 4, 3.6, 4.9)
  },
  astronaut(c, lift) {
    const R = 124 + lift * 0.55
    const cy = 62 - lift * 0.45
    ell(c, 0, cy + R * 0.9, 100, 22, '#e7e9ec')
    ell(c, 0, cy, R, R, 'rgba(206,232,255,0.2)')
    ring(c, 0, cy, R, '#f2f4f6', 11)
    curl(c, 0, cy, R - 22, 'rgba(255,255,255,0.85)', 10, 3.5, 4.4)
    curl(c, 0, cy, R - 22, 'rgba(255,255,255,0.55)', 7, 4.55, 4.75)
    ell(c, 0, cy + R * 0.9, 100, 22, 'rgba(231,233,236,0.9)')
    line(c, [[-80, cy + R * 0.9 + 3], [80, cy + R * 0.9 + 3]], '#b4b8c0', 4)
  },
  lumberjack(c) {
    ell(c, 0, -52, 19, 19, '#f1ebdc')
    dome(c, 0, 26, 82, 78, '#b5302a')
    for (const x of [-48, -24, 0, 24, 48]) quad(c, x, 10, x * 0.8, -26, x * 0.3, -50, 'rgba(0,0,0,0.16)', 4)
    rrect(c, -88, 4, 176, 34, 14, '#8f211c')
    for (let x = -72; x <= 72; x += 18) line(c, [[x, 10], [x, 32]], 'rgba(0,0,0,0.22)', 4)
  },
  detective(c) {
    ell(c, 0, 22, 116, 18, '#59391f')
    c.beginPath()
    c.moveTo(-64, 20)
    c.quadraticCurveTo(-66, -44, -40, -50)
    c.quadraticCurveTo(0, -30, 40, -50)
    c.quadraticCurveTo(66, -44, 64, 20)
    c.closePath()
    c.fillStyle = '#74502f'
    c.fill()
    rrect(c, -64, -2, 128, 20, 3, '#2a1a10')
    ell(c, -8, 22, 110, 12, '#684526')
    quad(c, -44, -8, -40, -34, -24, -42, 'rgba(255,255,255,0.18)', 6)
  },
  builder(c) {
    dome(c, 0, 24, 82, 76, '#f5b915')
    rrect(c, -10, -58, 20, 76, 9, '#dc9f0a')
    ell(c, -12, 24, 100, 13, '#dc9f0a')
    quad(c, -62, -4, -52, -40, -24, -56, 'rgba(255,255,255,0.5)', 7)
    line(c, [[-78, 12], [78, 12]], 'rgba(0,0,0,0.12)', 4)
  },
  pirate(c) {
    c.beginPath()
    c.moveTo(-116, 14)
    c.quadraticCurveTo(-96, -40, -42, -56)
    c.quadraticCurveTo(0, -34, 42, -56)
    c.quadraticCurveTo(96, -40, 116, 14)
    c.quadraticCurveTo(0, 46, -116, 14)
    c.closePath()
    c.fillStyle = '#1c1c22'
    c.fill()
    c.beginPath()
    c.moveTo(-112, 8)
    c.quadraticCurveTo(-94, -38, -42, -52)
    c.quadraticCurveTo(0, -30, 42, -52)
    c.quadraticCurveTo(94, -38, 112, 8)
    c.strokeStyle = '#e2b93b'
    c.lineWidth = 6
    c.stroke()
    line(c, [[-18, 14], [18, -8]], '#f3f1ea', 6)
    line(c, [[18, 14], [-18, -8]], '#f3f1ea', 6)
    ell(c, 0, -4, 14, 13, '#f3f1ea')
    rrect(c, -8, 4, 16, 9, 2, '#f3f1ea')
    ell(c, -5, -5, 3.4, 4, '#1c1c22')
    ell(c, 5, -5, 3.4, 4, '#1c1c22')
  },
  wizard(c) {
    ell(c, 0, 22, 112, 19, '#46298a')
    c.beginPath()
    c.moveTo(-66, 20)
    c.quadraticCurveTo(-30, -70, -10, -150)
    c.quadraticCurveTo(6, -182, 42, -166)
    c.quadraticCurveTo(22, -150, 26, -120)
    c.quadraticCurveTo(40, -50, 66, 20)
    c.closePath()
    c.fillStyle = '#5b3aa6'
    c.fill()
    rrect(c, -66, 2, 132, 18, 4, '#e2b93b')
    ell(c, -10, 22, 104, 12, '#5333a0')
    star(c, -12, -64, 15, '#ffd84a')
    star(c, 22, -22, 10, '#ffd84a')
    star(c, 8, -112, 8, '#ffd84a')
    ell(c, -30, -22, 9, 9, '#ffd84a')
    ell(c, -26, -25, 8, 8, '#5b3aa6')
  },
  cowboy(c) {
    c.beginPath()
    c.moveTo(-132, -6)
    c.quadraticCurveTo(-74, 46, 0, 32)
    c.quadraticCurveTo(74, 46, 132, -6)
    c.quadraticCurveTo(72, 14, 0, 8)
    c.quadraticCurveTo(-72, 14, -132, -6)
    c.closePath()
    c.fillStyle = '#a97a40'
    c.fill()
    c.beginPath()
    c.moveTo(-60, 16)
    c.quadraticCurveTo(-64, -40, -48, -54)
    c.quadraticCurveTo(-24, -66, 0, -46)
    c.quadraticCurveTo(24, -66, 48, -54)
    c.quadraticCurveTo(64, -40, 60, 16)
    c.closePath()
    c.fillStyle = '#c69a5a'
    c.fill()
    rrect(c, -60, -6, 120, 15, 3, '#57371f')
    star(c, 0, 1, 7, '#e2b93b')
    quad(c, -44, -14, -42, -40, -26, -52, 'rgba(255,255,255,0.25)', 6)
  },
  royal(c) {
    poly(c, [[-64, 22], [-64, -52], [-38, -20], [-19, -60], [0, -20], [19, -60], [38, -20], [64, -52], [64, 22]], '#f0c232')
    rrect(c, -66, -4, 132, 28, 5, '#dba917')
    for (const [x, col] of [[-42, '#d43c2f'], [0, '#2f7bd4'], [42, '#2fae5c']]) ell(c, x, 10, 9, 9, col)
    for (const x of [-64, -19, 19, 64]) ell(c, x, x === -64 || x === 64 ? -54 : -62, 7, 7, '#fff6d8')
    line(c, [[-52, -20], [-52, -2]], 'rgba(255,255,255,0.5)', 5)
  },
  mail(c) {
    c.beginPath()
    c.moveTo(-72, 20)
    c.quadraticCurveTo(-84, -30, -50, -44)
    c.quadraticCurveTo(0, -58, 50, -44)
    c.quadraticCurveTo(84, -30, 72, 20)
    c.closePath()
    c.fillStyle = '#3f5f94'
    c.fill()
    rrect(c, -72, 2, 144, 18, 3, '#2a426e')
    ell(c, -34, 24, 76, 13, '#1c1c22')
    ell(c, -8, -20, 12, 12, '#e2b93b')
    ell(c, -8, -20, 6, 6, '#b8891b')
  },
  accountant(c) {
    quad(c, -82, 40, 0, 4, 82, 40, '#2a6b45', 11)
    ell(c, -16, 36, 96, 22, 'rgba(46,170,96,0.78)')
    ell(c, -30, 30, 50, 8, 'rgba(255,255,255,0.3)')
  },
  geologist(c) {
    ell(c, 0, 22, 114, 17, '#b39c64')
    dome(c, 0, 22, 80, 70, '#d4c08c')
    rrect(c, -78, 2, 156, 16, 3, '#7a5a34')
    ell(c, 0, -46, 9, 7, '#b39c64')
    ell(c, -10, 24, 106, 11, '#c4ae78')
    quad(c, -58, -6, -48, -36, -22, -48, 'rgba(255,255,255,0.3)', 6)
  },
  painter(c) {
    c.save()
    c.rotate(-0.16)
    ell(c, 12, -8, 96, 36, '#7a1f2b')
    ell(c, -4, -16, 60, 16, 'rgba(255,255,255,0.12)')
    c.restore()
    line(c, [[14, -42], [20, -56]], '#7a1f2b', 6)
    rrect(c, -58, 8, 116, 12, 5, '#5a1520')
  },
  gardener(c) {
    ell(c, 0, 22, 132, 23, '#e2c260')
    dome(c, 0, 20, 66, 58, '#efd884')
    rrect(c, -65, 0, 130, 16, 3, '#c0392b')
    for (const r of [84, 104, 122]) {
      c.beginPath()
      c.ellipse(0, 22, r, r * 0.17, 0, 0.15, Math.PI - 0.15)
      c.strokeStyle = 'rgba(150,110,30,0.5)'
      c.lineWidth = 3
      c.stroke()
    }
    for (const x of [-36, -12, 12, 36]) quad(c, x, -2, x * 0.8, -24, x * 0.4, -36, 'rgba(150,110,30,0.4)', 3)
  },
  dj(c, lift) {
    const R = 98 + lift * 0.5
    const cy = 78 - lift * 0.4
    c.beginPath()
    c.arc(0, cy, R, Math.PI * 1.08, Math.PI * 1.92)
    c.strokeStyle = '#24242a'
    c.lineWidth = 13
    c.lineCap = 'round'
    c.stroke()
    for (const s of [-1, 1]) {
      rrect(c, s * (R + 4) - 17, cy - 44, 34, 70, 14, '#e0443a')
      rrect(c, s * (R + 4) - 8 - s * 6, cy - 34, 16, 50, 8, '#24242a')
    }
  },
  ballerina(c) {
    poly(c, [[-40, 14], [-30, -8], [-16, 8], [0, -24], [16, 8], [30, -8], [40, 14]], null, '#dfe3ea', 6)
    ell(c, 0, -22, 7, 7, '#f06aa0')
  },
}
// hats that belong to the head, however tall the hair is
const HAT_ON_HEAD = new Set(['astronaut', 'dj', 'doctor', 'accountant'])

// ── what they wear ──────────────────────────────────────────────────────────
function coat(c, G, color, lapel) {
  const y0 = G.armY - G.h * 0.12
  inBody(c, G, () => {
    c.fillStyle = color
    c.fillRect(G.cx - G.w, y0, G.w * 2, G.h)
    poly(c, [[G.faceX - G.w * 0.11, y0], [G.faceX + G.w * 0.11, y0], [G.faceX + G.w * 0.018, G.bottom], [G.faceX - G.w * 0.018, G.bottom]], G.col.base)
    line(c, [[G.faceX - G.w * 0.11, y0], [G.faceX - G.w * 0.2, y0 + G.h * 0.12], [G.faceX - G.w * 0.07, y0 + G.h * 0.2]], lapel, 4 * G.U)
    line(c, [[G.faceX + G.w * 0.11, y0], [G.faceX + G.w * 0.2, y0 + G.h * 0.12], [G.faceX + G.w * 0.07, y0 + G.h * 0.2]], lapel, 4 * G.U)
    c.fillStyle = 'rgba(0,0,0,0.1)'
    c.fillRect(G.cx + G.w * 0.26, y0, G.w, G.h)
  })
}
function sidePanels(c, G, color, y0, y1, gap = 0.1) {
  inBody(c, G, () => {
    c.fillStyle = color
    c.fillRect(G.cx - G.w, y0, G.w - G.w * gap + (G.faceX - G.cx), y1 - y0)
    c.fillRect(G.faceX + G.w * gap, y0, G.w, y1 - y0)
    c.fillStyle = 'rgba(0,0,0,0.12)'
    c.fillRect(G.cx + G.w * 0.27, y0, G.w, y1 - y0)
  })
}

const OUTFIT = {
  firefighter(c, G) {
    inBody(c, G, () => {
      for (const k of [0.12, 0.27]) {
        const y = G.armY + G.h * k
        c.fillStyle = '#f2c12e'
        c.fillRect(G.cx - G.w, y, G.w * 2, G.h * 0.075)
        c.fillStyle = '#e4e6ea'
        c.fillRect(G.cx - G.w, y + G.h * 0.026, G.w * 2, G.h * 0.023)
      }
    })
  },
  chef(c, G) {
    const y0 = G.armY - G.h * 0.04
    inBody(c, G, () => {
      rrect(c, G.faceX - G.w * 0.27, y0, G.w * 0.54, G.h, 12 * G.U, '#f6f3ec')
      line(c, [[G.cx - G.w, y0 + G.h * 0.2], [G.cx + G.w, y0 + G.h * 0.2]], '#f6f3ec', 7 * G.U)
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) ell(c, G.faceX + s * G.w * 0.09, y0 + G.h * (0.06 + i * 0.085), 5 * G.U, 5 * G.U, '#3a3a40')
    })
    poly(c, [[G.faceX - G.w * 0.13, y0 - G.h * 0.07], [G.faceX + G.w * 0.13, y0 - G.h * 0.07], [G.faceX, y0 + G.h * 0.03]], '#d43c2f')
  },
  doctor(c, G) {
    coat(c, G, '#f4f2ec', '#c9c5ba')
    const y0 = G.armY - G.h * 0.16
    c.beginPath()
    c.moveTo(G.faceX - G.w * 0.17, y0)
    c.bezierCurveTo(G.faceX - G.w * 0.17, y0 + G.h * 0.3, G.faceX + G.w * 0.17, y0 + G.h * 0.3, G.faceX + G.w * 0.17, y0)
    c.strokeStyle = '#2b2f3a'
    c.lineWidth = 6 * G.U
    c.lineCap = 'round'
    c.stroke()
    line(c, [[G.faceX, y0 + G.h * 0.225], [G.faceX, y0 + G.h * 0.3]], '#2b2f3a', 6 * G.U)
    ell(c, G.faceX, y0 + G.h * 0.33, 12 * G.U, 12 * G.U, '#c9ccd1')
    ell(c, G.faceX, y0 + G.h * 0.33, 6 * G.U, 6 * G.U, '#8c9098')
  },
  astronaut(c, G) {
    const y0 = G.armY - G.h * 0.08
    inBody(c, G, () => {
      c.fillStyle = '#eef0f2'
      c.fillRect(G.cx - G.w, y0, G.w * 2, G.h)
      c.fillStyle = 'rgba(0,0,0,0.1)'
      c.fillRect(G.cx + G.w * 0.26, y0, G.w, G.h)
      rrect(c, G.faceX - G.w * 0.17, y0 + G.h * 0.09, G.w * 0.34, G.h * 0.16, 7 * G.U, '#c3c8d0')
      for (const [i, col] of [[-1, '#d43c2f'], [0, '#f2c12e'], [1, '#2f7bd4']]) ell(c, G.faceX + i * G.w * 0.1, y0 + G.h * 0.17, 7 * G.U, 7 * G.U, col)
      line(c, [[G.cx - G.w, y0 + G.h * 0.32], [G.cx + G.w, y0 + G.h * 0.32]], '#c3c8d0', 5 * G.U)
    })
  },
  lumberjack(c, G) {
    const y0 = G.armY - G.h * 0.1
    inBody(c, G, () => {
      c.fillStyle = '#b5302a'
      c.fillRect(G.cx - G.w, y0, G.w * 2, G.h)
      c.fillStyle = 'rgba(20,10,10,0.36)'
      for (let y = y0 + 12 * G.U; y < G.bottom; y += 34 * G.U) c.fillRect(G.cx - G.w, y, G.w * 2, 11 * G.U)
      for (let x = G.cx - G.w; x < G.cx + G.w; x += 34 * G.U) c.fillRect(x, y0, 11 * G.U, G.h)
      for (const s of [-1, 1]) {
        c.fillStyle = '#34261a'
        c.fillRect(G.faceX + s * G.w * 0.17 - 7 * G.U, y0, 14 * G.U, G.h)
      }
    })
  },
  detective(c, G) {
    coat(c, G, '#c9a877', '#9a7d50')
    const y = G.armY + G.h * 0.2
    inBody(c, G, () => {
      c.fillStyle = '#a88758'
      c.fillRect(G.cx - G.w, y, G.w * 2, 15 * G.U)
      rrect(c, G.faceX - 13 * G.U, y - 3 * G.U, 26 * G.U, 21 * G.U, 3 * G.U, null, '#5f4a2c', 4 * G.U)
      for (const s of [-1, 1]) for (const k of [0.04, 0.12]) ell(c, G.faceX + s * G.w * 0.19, G.armY + G.h * k, 4.5 * G.U, 4.5 * G.U, '#5f4a2c')
    })
  },
  builder(c, G) {
    const y0 = G.armY - G.h * 0.1
    sidePanels(c, G, '#f26a1b', y0, G.bottom + 10, 0.045)
    inBody(c, G, () => {
      for (const s of [-1, 1]) {
        c.fillStyle = '#e8f04a'
        c.fillRect(G.faceX + s * G.w * 0.2 - 8 * G.U, y0, 16 * G.U, G.h)
        c.fillStyle = '#d4d8dc'
        c.fillRect(G.faceX + s * G.w * 0.2 - 2.5 * G.U, y0, 5 * G.U, G.h)
      }
      c.fillStyle = '#e8f04a'
      c.fillRect(G.cx - G.w, G.armY + G.h * 0.2, G.w * 2, 16 * G.U)
      c.fillStyle = '#d4d8dc'
      c.fillRect(G.cx - G.w, G.armY + G.h * 0.2 + 5.5 * G.U, G.w * 2, 5 * G.U)
      poly(c, [[G.faceX - G.w * 0.05, y0], [G.faceX + G.w * 0.05, y0], [G.faceX + G.w * 0.05, G.bottom], [G.faceX - G.w * 0.05, G.bottom]], G.col.base)
    })
  },
  pirate(c, G) {
    const y0 = G.armY - G.h * 0.1
    const y1 = G.armY + G.h * 0.2
    inBody(c, G, () => {
      c.fillStyle = '#f2efe6'
      c.fillRect(G.cx - G.w, y0, G.w * 2, y1 - y0)
      c.fillStyle = '#26324f'
      for (let y = y0 + 6 * G.U; y < y1; y += 22 * G.U) c.fillRect(G.cx - G.w, y, G.w * 2, 10 * G.U)
      c.fillStyle = '#b3261e'
      c.fillRect(G.cx - G.w, y1, G.w * 2, 24 * G.U)
      rrect(c, G.faceX - 15 * G.U, y1 + 2 * G.U, 30 * G.U, 20 * G.U, 3 * G.U, null, '#e2b93b', 5 * G.U)
    })
    const e = G.spanAt(y1 + 12 * G.U)[1]
    ell(c, e + 4 * G.U, y1 + 30 * G.U, 9 * G.U, 22 * G.U, '#b3261e', -0.3)
    ell(c, e - 10 * G.U, y1 + 34 * G.U, 8 * G.U, 20 * G.U, '#96201a', 0.2)
  },
  wizard(c, G) {
    const y0 = G.armY - G.h * 0.12
    inBody(c, G, () => {
      c.fillStyle = '#5b3aa6'
      c.fillRect(G.cx - G.w, y0, G.w * 2, G.h)
      c.fillStyle = 'rgba(0,0,0,0.14)'
      c.fillRect(G.cx + G.w * 0.26, y0, G.w, G.h)
      c.fillStyle = '#e2b93b'
      c.fillRect(G.cx - G.w, G.bottom - 20 * G.U, G.w * 2, 9 * G.U)
      star(c, G.cx + G.w * 0.2, G.armY + G.h * 0.22, 13 * G.U, '#ffd84a')
      star(c, G.cx - G.w * 0.3, G.armY + G.h * 0.3, 9 * G.U, '#ffd84a')
      star(c, G.cx + G.w * 0.32, G.armY + G.h * 0.02, 7 * G.U, '#ffd84a')
    })
  },
  cowboy(c, G) {
    sidePanels(c, G, '#7a4e2a', G.armY - G.h * 0.1, G.armY + G.h * 0.3, 0.13)
    star(c, G.faceX - G.w * 0.25, G.armY + G.h * 0.06, 13 * G.U, '#e2b93b')
    const y = G.eyeY + G.h * 0.15
    poly(c, [[G.faceX - G.w * 0.24, y], [G.faceX + G.w * 0.24, y], [G.faceX, y + G.h * 0.17]], '#c8322a')
    for (const [dx, dy] of [[-0.1, 0.03], [0.1, 0.03], [0, 0.08], [0, 0.025]]) ell(c, G.faceX + G.w * dx, y + G.h * dy, 3.4 * G.U, 3.4 * G.U, '#f6f3ec')
  },
  rockstar(c, G) {
    sidePanels(c, G, '#1e1e24', G.armY - G.h * 0.12, G.armY + G.h * 0.3, 0.12)
    inBody(c, G, () => {
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) ell(c, G.faceX + s * G.w * 0.165, G.armY - G.h * 0.08 + i * G.h * 0.095, 4 * G.U, 4 * G.U, '#d8dce2')
    })
  },
  scientist(c, G) {
    coat(c, G, '#f4f2ec', '#c9c5ba')
    const x = G.faceX + G.w * 0.2
    const y = G.armY + G.h * 0.06
    inBody(c, G, () => {
      rrect(c, x, y, 34 * G.U, 30 * G.U, 3 * G.U, '#e4e0d6', '#c9c5ba', 3 * G.U)
      for (const [i, col] of [[0, '#d43c2f'], [1, '#2f7bd4'], [2, '#2fae5c']]) line(c, [[x + (8 + i * 9) * G.U, y + 6 * G.U], [x + (8 + i * 9) * G.U, y - 12 * G.U]], col, 4 * G.U)
    })
  },
  royal(c, G) {
    const y = G.armY - G.h * 0.13
    inBody(c, G, () => {
      c.fillStyle = '#f6f3ec'
      c.fillRect(G.cx - G.w, y, G.w * 2, G.h * 0.085)
      for (let x = G.cx - G.w * 0.6; x < G.cx + G.w * 0.6; x += 26 * G.U) ell(c, x, y + G.h * 0.045, 3 * G.U, 6 * G.U, '#1c1c22', 0.3)
    })
    c.beginPath()
    c.arc(G.faceX, y + G.h * 0.06, G.w * 0.2, 0.25, Math.PI - 0.25)
    c.strokeStyle = '#e2b93b'
    c.lineWidth = 6 * G.U
    c.stroke()
    ell(c, G.faceX, y + G.h * 0.06 + G.w * 0.2, 13 * G.U, 13 * G.U, '#e2b93b')
    ell(c, G.faceX, y + G.h * 0.06 + G.w * 0.2, 6 * G.U, 6 * G.U, '#d43c2f')
  },
  mail(c, G) {
    const [l, e] = G.spanAt(G.armY)
    inBody(c, G, () => {
      line(c, [[e + 10, G.armY - G.h * 0.16], [l - 10, G.armY + G.h * 0.26]], '#6b4a2e', 17 * G.U, 'butt')
      line(c, [[e + 10, G.armY - G.h * 0.16], [l - 10, G.armY + G.h * 0.26]], '#83603c', 5 * G.U, 'butt')
    })
    rrect(c, l - 8 * G.U, G.armY + G.h * 0.17, G.w * 0.36, G.h * 0.2, 8 * G.U, '#8a6238')
    rrect(c, l - 8 * G.U, G.armY + G.h * 0.17, G.w * 0.36, G.h * 0.085, 8 * G.U, '#6b4a2e')
    ell(c, l - 8 * G.U + G.w * 0.18, G.armY + G.h * 0.255, 5 * G.U, 5 * G.U, '#e2b93b')
  },
  accountant(c, G) {
    const y = G.eyeY + G.h * 0.17
    for (const s of [-1, 1]) poly(c, [[G.faceX, y], [G.faceX + s * G.w * 0.17, y - G.h * 0.035], [G.faceX + s * G.w * 0.1, y + G.h * 0.06]], '#f6f3ec')
    poly(c, [[G.faceX - 9 * G.U, y], [G.faceX + 9 * G.U, y], [G.faceX + 6 * G.U, y + 15 * G.U], [G.faceX - 6 * G.U, y + 15 * G.U]], '#16233f')
    poly(c, [[G.faceX - 7 * G.U, y + 15 * G.U], [G.faceX + 7 * G.U, y + 15 * G.U], [G.faceX + 15 * G.U, y + G.h * 0.26], [G.faceX, y + G.h * 0.34], [G.faceX - 15 * G.U, y + G.h * 0.26]], '#1c2b4a')
    c.save()
    c.beginPath()
    c.rect(G.faceX - 16 * G.U, y + 15 * G.U, 32 * G.U, G.h * 0.3)
    c.clip()
    for (let i = 0; i < 5; i++) line(c, [[G.faceX - 20 * G.U, y + (36 + i * 22) * G.U], [G.faceX + 20 * G.U, y + (20 + i * 22) * G.U]], '#c0392b', 5 * G.U, 'butt')
    c.restore()
  },
  geologist(c, G) {
    const y0 = G.armY - G.h * 0.1
    sidePanels(c, G, '#b9a26a', y0, G.armY + G.h * 0.32, 0.12)
    inBody(c, G, () => {
      for (const s of [-1, 1]) {
        const x = G.faceX + s * G.w * 0.26 - 17 * G.U
        rrect(c, x, G.armY + G.h * 0.05, 34 * G.U, 32 * G.U, 3 * G.U, '#a38c56')
        rrect(c, x, G.armY + G.h * 0.05, 34 * G.U, 11 * G.U, 3 * G.U, '#8e7846')
        ell(c, x + 17 * G.U, G.armY + G.h * 0.05 + 11 * G.U, 3 * G.U, 3 * G.U, '#5f4f2c')
      }
    })
  },
  painter(c, G) {
    const y0 = G.armY - G.h * 0.1
    inBody(c, G, () => {
      c.fillStyle = '#f1ece0'
      c.fillRect(G.cx - G.w, y0, G.w * 2, G.h)
      c.fillStyle = 'rgba(0,0,0,0.1)'
      c.fillRect(G.cx + G.w * 0.26, y0, G.w, G.h)
      const cols = ['#d9281e', '#ffd21f', '#123c8c', '#3f6b24', '#8e1b2c', '#e8a317']
      for (let i = 0; i < 11; i++) {
        const x = G.cx + (G.r() - 0.5) * G.w * 0.8
        const y = y0 + 12 * G.U + G.r() * (G.bottom - y0 - 20 * G.U)
        ell(c, x, y, (5 + G.r() * 9) * G.U, (4 + G.r() * 6) * G.U, cols[i % cols.length], G.r() * 3)
      }
    })
    const y = G.eyeY + G.h * 0.16
    for (const s of [-1, 1]) poly(c, [[G.faceX, y + 8 * G.U], [G.faceX + s * 32 * G.U, y - 10 * G.U], [G.faceX + s * 34 * G.U, y + 26 * G.U]], '#1c1c22')
    ell(c, G.faceX, y + 8 * G.U, 7 * G.U, 7 * G.U, '#34343c')
  },
  gardener(c, G) {
    const y0 = G.armY - G.h * 0.08
    const [l, e] = G.spanAt(G.armY - G.h * 0.16)
    inBody(c, G, () => {
      c.fillStyle = '#4c6fa8'
      c.fillRect(G.cx - G.w, G.armY + G.h * 0.13, G.w * 2, G.h)
      line(c, [[G.faceX - G.w * 0.16, y0 + 6 * G.U], [l + 8 * G.U, G.armY - G.h * 0.2]], '#4c6fa8', 15 * G.U, 'butt')
      line(c, [[G.faceX + G.w * 0.16, y0 + 6 * G.U], [e - 8 * G.U, G.armY - G.h * 0.2]], '#4c6fa8', 15 * G.U, 'butt')
      rrect(c, G.faceX - G.w * 0.19, y0, G.w * 0.38, G.h * 0.24, 6 * G.U, '#4c6fa8')
      rrect(c, G.faceX - G.w * 0.09, y0 + G.h * 0.07, G.w * 0.18, G.h * 0.1, 4 * G.U, null, '#3a5888', 3.5 * G.U)
      c.fillStyle = 'rgba(0,0,0,0.12)'
      c.fillRect(G.cx + G.w * 0.26, y0, G.w, G.h)
      for (const s of [-1, 1]) ell(c, G.faceX + s * G.w * 0.15, y0 + 12 * G.U, 5 * G.U, 5 * G.U, '#e2b93b')
    })
  },
  dj(c, G) {
    const y = G.eyeY + G.h * 0.14
    c.beginPath()
    c.arc(G.faceX, y, G.w * 0.2, 0.2, Math.PI - 0.2)
    c.strokeStyle = '#e2b93b'
    c.lineWidth = 7 * G.U
    c.lineCap = 'round'
    c.stroke()
    rrect(c, G.faceX - 13 * G.U, y + G.w * 0.2 - 4 * G.U, 26 * G.U, 26 * G.U, 5 * G.U, '#e2b93b')
    star(c, G.faceX, y + G.w * 0.2 + 9 * G.U, 9 * G.U, '#fff3c4')
  },
  ballerina(c, G) {
    const y = G.armY + G.h * 0.2
    inBody(c, G, () => {
      c.fillStyle = '#f48fb5'
      c.fillRect(G.cx - G.w, G.armY - G.h * 0.06, G.w * 2, y - G.armY + G.h * 0.06)
    })
    const [l, e] = G.spanAt(y)
    const half = (e - l) / 2 + G.w * 0.2
    for (let i = -6; i <= 6; i++) {
      const k = i / 6
      ell(c, (l + e) / 2 + k * half, y + 16 * G.U - Math.abs(k) * 6 * G.U, half * 0.2, 24 * G.U, i % 2 ? '#f7a8c4' : '#fbc4d8', k * 0.5)
    }
    line(c, [[l - 2, y], [e + 2, y]], '#e56a9a', 7 * G.U)
  },
}

// ── things for the face, after the eyes ──────────────────────────────────────
const tash = (c, G, color, droop) => {
  for (const s of [-1, 1]) {
    c.save()
    c.translate(G.faceX + s * 17 * G.U, G.eyeY + 30 * G.U)
    c.rotate(s * (0.18 + droop))
    ell(c, s * 6 * G.U, 0, 22 * G.U, 9 * G.U, color)
    c.restore()
  }
}
const FACE = {
  pirate(c, G) {
    const [l, e] = G.spanAt(G.eyeY - 30 * G.U)
    line(c, [[l + 2, G.eyeY - 34 * G.U], [G.faceX + G.eyeDX, G.eyeY - 2 * G.U], [e - 2, G.eyeY - 14 * G.U]], '#1c1c22', 4.5 * G.U)
    ell(c, G.faceX + G.eyeDX, G.eyeY + 1 * G.U, 17 * G.U, 19 * G.U, '#1c1c22')
  },
  wizard(c, G) {
    const y = G.eyeY + 22 * G.U
    c.beginPath()
    c.moveTo(G.faceX - G.faceW * 0.3, y)
    c.quadraticCurveTo(G.faceX, y - 12 * G.U, G.faceX + G.faceW * 0.3, y)
    c.quadraticCurveTo(G.faceX + G.faceW * 0.26, y + G.h * 0.3, G.faceX + 4 * G.U, y + G.h * 0.47)
    c.quadraticCurveTo(G.faceX - G.faceW * 0.3, y + G.h * 0.3, G.faceX - G.faceW * 0.3, y)
    c.closePath()
    c.fillStyle = '#f1f1ec'
    c.fill()
    for (const k of [-0.16, 0, 0.14]) quad(c, G.faceX + G.faceW * k, y + 26 * G.U, G.faceX + G.faceW * k * 0.8, y + G.h * 0.2, G.faceX + G.faceW * k * 0.3, y + G.h * 0.36, '#cfcfc8', 3.5 * G.U)
    tash(c, G, '#f1f1ec', 0.2)
  },
  rockstar(c, G) {
    for (const s of [-1, 1]) rrect(c, G.faceX + s * G.eyeDX - 21 * G.U, G.eyeY - 15 * G.U, 42 * G.U, 29 * G.U, 9 * G.U, '#131318')
    line(c, [[G.faceX - G.eyeDX + 16 * G.U, G.eyeY - 6 * G.U], [G.faceX + G.eyeDX - 16 * G.U, G.eyeY - 6 * G.U]], '#131318', 5 * G.U)
    const [l, e] = G.spanAt(G.eyeY - 8 * G.U)
    line(c, [[l + 2, G.eyeY - 10 * G.U], [G.faceX - G.eyeDX - 18 * G.U, G.eyeY - 8 * G.U]], '#131318', 4.5 * G.U)
    line(c, [[e - 2, G.eyeY - 10 * G.U], [G.faceX + G.eyeDX + 18 * G.U, G.eyeY - 8 * G.U]], '#131318', 4.5 * G.U)
    for (const s of [-1, 1]) line(c, [[G.faceX + s * G.eyeDX - 12 * G.U, G.eyeY - 2 * G.U], [G.faceX + s * G.eyeDX - 2 * G.U, G.eyeY - 9 * G.U]], 'rgba(255,255,255,0.55)', 4 * G.U)
  },
  scientist(c, G) {
    const [l, e] = G.spanAt(G.eyeY)
    line(c, [[l + 2, G.eyeY], [e - 2, G.eyeY]], '#3a4048', 8 * G.U, 'butt')
    rrect(c, G.faceX - G.eyeDX - 24 * G.U, G.eyeY - 22 * G.U, G.eyeDX * 2 + 48 * G.U, 44 * G.U, 18 * G.U, 'rgba(120,220,232,0.4)', '#e8eef2', 6 * G.U)
    drawEyes(c, G)
    line(c, [[G.faceX - G.eyeDX - 12 * G.U, G.eyeY - 12 * G.U], [G.faceX - G.eyeDX + 2 * G.U, G.eyeY - 15 * G.U]], 'rgba(255,255,255,0.8)', 4 * G.U)
  },
  accountant(c, G) {
    const [l, e] = G.spanAt(G.eyeY - 4 * G.U)
    for (const s of [-1, 1]) {
      ell(c, G.faceX + s * G.eyeDX, G.eyeY, 22 * G.U, 22 * G.U, 'rgba(255,255,255,0.2)')
      ring(c, G.faceX + s * G.eyeDX, G.eyeY, 22 * G.U, '#1d1a12', 6 * G.U)
    }
    line(c, [[G.faceX - G.eyeDX + 22 * G.U, G.eyeY - 3 * G.U], [G.faceX + G.eyeDX - 22 * G.U, G.eyeY - 3 * G.U]], '#1d1a12', 5 * G.U)
    line(c, [[l + 2, G.eyeY - 8 * G.U], [G.faceX - G.eyeDX - 22 * G.U, G.eyeY - 4 * G.U]], '#1d1a12', 5 * G.U)
    line(c, [[e - 2, G.eyeY - 8 * G.U], [G.faceX + G.eyeDX + 22 * G.U, G.eyeY - 4 * G.U]], '#1d1a12', 5 * G.U)
  },
  lumberjack(c, G) {
    tash(c, G, '#5a3418', 0.1)
  },
  cowboy(c, G) {
    tash(c, G, '#3a2415', 0.5)
  },
  chef(c, G) {
    for (const s of [-1, 1]) {
      quad(c, G.faceX + s * 3 * G.U, G.eyeY + 28 * G.U, G.faceX + s * 22 * G.U, G.eyeY + 36 * G.U, G.faceX + s * 34 * G.U, G.eyeY + 20 * G.U, '#1c1c22', 4.5 * G.U)
    }
  },
  dj(c, G) {
    for (const s of [-1, 1]) ell(c, G.faceX + s * G.eyeDX, G.eyeY, 19 * G.U, 16 * G.U, '#131318')
    line(c, [[G.faceX - G.eyeDX + 12 * G.U, G.eyeY - 4 * G.U], [G.faceX + G.eyeDX - 12 * G.U, G.eyeY - 4 * G.U]], '#131318', 5 * G.U)
    for (const s of [-1, 1]) line(c, [[G.faceX + s * G.eyeDX - 9 * G.U, G.eyeY], [G.faceX + s * G.eyeDX, G.eyeY - 7 * G.U]], 'rgba(255,120,220,0.8)', 4 * G.U)
  },
}

// ── what they hold. R is the hand on the right of the picture, L on the left. ──
const AXE = (head) => (c, G, R) => {
  at(c, R.x, R.y, G.U, 0, () => {
    line(c, [[-12, 78], [16, -124]], '#8a5a2b', 11)
    poly(c, [[4, -134], [52, -154], [68, -114], [54, -76], [10, -98]], head)
    quad(c, 54, -150, 72, -114, 56, -80, '#f1f3f5', 6)
  })
  grip(c, G, R)
}
const PROP = {
  firefighter: AXE('#cf2a1f'),
  lumberjack: AXE('#8c9098'),
  chef(c, G, R) {
    at(c, R.x, R.y, G.U, 0, () => {
      line(c, [[0, 0], [62, -22]], '#2a2a2e', 11)
      ell(c, 116, -42, 60, 24, '#2a2a2e')
      ell(c, 116, -45, 50, 18, '#4b4c54')
      ell(c, 112, -46, 30, 12, '#fbfaf5')
      ell(c, 120, -48, 11, 6.5, '#f6b21b')
    })
    grip(c, G, R)
  },
  doctor(c, G, R, L) {
    at(c, L.x, L.y, G.U, -0.1, () => {
      rrect(c, -74, -74, 80, 104, 6, '#8a6238')
      rrect(c, -66, -62, 64, 86, 3, '#fbfaf5')
      rrect(c, -50, -82, 32, 16, 4, '#c9ccd1')
      for (let i = 0; i < 5; i++) line(c, [[-58, -40 + i * 13], [-12 - (i % 2) * 14, -40 + i * 13]], '#9aa0a8', 3)
      line(c, [[-58, 28], [-40, 14], [-28, 22], [-12, 6]], '#d43c2f', 3)
    })
    grip(c, G, L)
  },
  astronaut(c, G, R) {
    at(c, R.x, R.y, G.U, 0, () => {
      line(c, [[0, 96], [0, -176]], '#c9ccd1', 6)
      c.beginPath()
      c.moveTo(2, -176)
      c.quadraticCurveTo(30, -188, 50, -174)
      c.quadraticCurveTo(72, -160, 92, -172)
      c.lineTo(92, -116)
      c.quadraticCurveTo(72, -104, 50, -118)
      c.quadraticCurveTo(30, -132, 2, -120)
      c.closePath()
      c.fillStyle = '#f6f3ec'
      c.fill()
      ell(c, 46, -146, 20, 22, G.col.base)
      ell(c, 39, -150, 3, 4, '#101b2c')
      ell(c, 51, -150, 3, 4, '#101b2c')
    })
    grip(c, G, R)
  },
  detective(c, G, R) {
    at(c, R.x, R.y, G.U, 0, () => {
      line(c, [[0, 0], [24, -42]], '#2b1a10', 11)
      ell(c, 46, -84, 40, 40, 'rgba(255,238,205,0.5)')
      ring(c, 46, -84, 40, '#2b1a10', 9)
      curl(c, 46, -84, 26, 'rgba(255,255,255,0.8)', 6, 3.5, 4.5)
    })
    grip(c, G, R)
  },
  builder(c, G, R) {
    at(c, R.x, R.y, G.U, 0, () => {
      line(c, [[-8, 56], [12, -104]], '#a8743c', 11)
      c.save()
      c.translate(13, -112)
      c.rotate(0.12)
      rrect(c, -22, -15, 62, 30, 5, '#7d8087')
      poly(c, [[-22, -13], [-48, -22], [-40, -2], [-50, 12], [-22, 13]], '#7d8087')
      line(c, [[-14, -8], [32, -8]], 'rgba(255,255,255,0.4)', 4)
      c.restore()
    })
    grip(c, G, R)
  },
  pirate(c, G, R) {
    at(c, R.x, R.y, G.U, 0, () => {
      c.beginPath()
      c.moveTo(-9, -14)
      c.quadraticCurveTo(10, -110, 78, -168)
      c.quadraticCurveTo(48, -92, 10, -12)
      c.closePath()
      c.fillStyle = '#dfe3e8'
      c.fill()
      quad(c, -6, -18, 12, -108, 74, -162, '#9aa0a8', 3)
      line(c, [[0, 14], [0, -14]], '#3a2a1c', 11)
      ell(c, 0, -14, 24, 7, '#e2b93b', -0.2)
    })
    grip(c, G, R)
  },
  wizard(c, G, R) {
    at(c, R.x, R.y, G.U, 0, () => {
      line(c, [[-4, 14], [40, -96]], '#6b4a2e', 7)
      line(c, [[34, -82], [40, -96]], '#f6f3ec', 7)
      star(c, 50, -122, 26, '#ffd84a')
      star(c, 96, -92, 9, '#fff3c4', 4, 0.3)
      star(c, 10, -154, 8, '#fff3c4', 4, 0.3)
      star(c, 92, -158, 6, '#fff3c4', 4, 0.3)
    })
    grip(c, G, R)
  },
  cowboy(c, G, R) {
    at(c, R.x, R.y, G.U, 0, () => {
      c.beginPath()
      c.ellipse(24, -128, 74, 26, -0.16, 0, TAU)
      c.strokeStyle = '#c9a86a'
      c.lineWidth = 6.5
      c.stroke()
      quad(c, -40, -108, -20, -50, 0, 0, '#c9a86a', 6.5)
      quad(c, 0, 0, -30, 44, -8, 96, '#c9a86a', 6.5)
    })
    grip(c, G, R)
  },
  rockstar(c, G, R, L) {
    const a = Math.atan2(L.y - R.y, L.x - R.x)
    const len = Math.hypot(L.x - R.x, L.y - R.y)
    c.save()
    c.translate(R.x + 26 * G.U, R.y + 10 * G.U)
    c.rotate(a)
    c.scale(G.U, G.U)
    rrect(c, 0, -8, len / G.U + 34, 16, 4, '#7a4e2a')
    rrect(c, len / G.U + 28, -15, 42, 30, 6, '#1e1e24')
    ell(c, -30, 6, 56, 46, '#d62f2f')
    ell(c, 18, -2, 40, 34, '#d62f2f')
    ell(c, -22, 2, 30, 24, '#f6f3ec')
    rrect(c, -34, -12, 12, 28, 3, '#1e1e24')
    rrect(c, -8, -12, 12, 28, 3, '#1e1e24')
    for (const y of [-5, 0, 5]) line(c, [[-36, y], [len / G.U + 30, y]], 'rgba(255,255,255,0.6)', 1.4, 'butt')
    c.restore()
    grip(c, G, R)
    grip(c, G, L)
  },
  scientist(c, G, R) {
    at(c, R.x + 8 * G.U, R.y - 6 * G.U, G.U, 0.1, () => {
      c.beginPath()
      c.moveTo(-12, -112)
      c.lineTo(-12, -70)
      c.lineTo(-46, 0)
      c.quadraticCurveTo(-50, 12, -36, 12)
      c.lineTo(36, 12)
      c.quadraticCurveTo(50, 12, 46, 0)
      c.lineTo(12, -70)
      c.lineTo(12, -112)
      c.closePath()
      c.fillStyle = 'rgba(224,240,252,0.4)'
      c.fill()
      c.save()
      c.clip()
      c.fillStyle = '#58d058'
      c.fillRect(-60, -40, 120, 60)
      c.restore()
      c.strokeStyle = '#e6eef5'
      c.lineWidth = 5
      c.lineJoin = 'round'
      c.stroke()
      line(c, [[-17, -112], [17, -112]], '#e6eef5', 6)
      for (const [x, y, r] of [[-10, -18, 6], [12, -6, 4], [4, -62, 5], [-6, -92, 4], [8, -130, 6], [-8, -150, 4]]) ring(c, x, y, r, '#b9f3b9', 2.5)
    })
    grip(c, G, R)
  },
  royal(c, G, R) {
    at(c, R.x, R.y, G.U, 0, () => {
      line(c, [[-4, 90], [2, -128]], '#e2b93b', 8)
      ell(c, 2, -146, 20, 20, '#c8327a')
      ell(c, -4, -152, 6, 6, 'rgba(255,255,255,0.6)')
      ring(c, 2, -146, 20, '#e2b93b', 5)
      line(c, [[2, -168], [2, -190]], '#e2b93b', 6)
      line(c, [[-8, -180], [12, -180]], '#e2b93b', 6)
    })
    grip(c, G, R)
  },
  mail(c, G, R) {
    at(c, R.x, R.y, G.U, -0.14, () => {
      rrect(c, -14, -92, 104, 68, 5, '#fbfaf5')
      line(c, [[-12, -90], [38, -52], [88, -90]], '#bfc3ca', 4)
      line(c, [[-12, -26], [22, -62]], '#d9dce1', 3)
      line(c, [[88, -26], [54, -62]], '#d9dce1', 3)
      ell(c, 32, -50, 8, 8, '#d43c2f')
      ell(c, 44, -50, 8, 8, '#d43c2f')
      poly(c, [[25, -46], [51, -46], [38, -32]], '#d43c2f')
    })
    grip(c, G, R)
  },
  accountant(c, G, R) {
    at(c, R.x, R.y, G.U, 0, () => {
      c.beginPath()
      c.arc(0, 20, 22, Math.PI, TAU)
      c.strokeStyle = '#3a2415'
      c.lineWidth = 7
      c.stroke()
      rrect(c, -56, 18, 112, 76, 9, '#7a4e2a')
      rrect(c, -56, 18, 112, 22, 9, '#63401f')
      for (const x of [-30, 30]) rrect(c, x - 8, 32, 16, 12, 2, '#e2b93b')
    })
    grip(c, G, R)
  },
  geologist(c, G, R, L) {
    at(c, R.x, R.y, G.U, 0, () => {
      line(c, [[-6, 54], [10, -98]], '#2f6fb2', 10)
      c.save()
      c.translate(11, -106)
      c.rotate(0.1)
      poly(c, [[-34, -12], [10, -13], [56, 2], [10, 13], [-34, 12]], '#8c9098')
      line(c, [[-28, -6], [8, -7]], 'rgba(255,255,255,0.45)', 4)
      c.restore()
    })
    grip(c, G, R)
    at(c, L.x - 4 * G.U, L.y - 40 * G.U, G.U, 0, () => {
      ell(c, 0, 0, 36, 29, '#8a8e96')
      ell(c, -5, -4, 31, 24, '#a9adb5')
      ell(c, -15, -4, 4, 5.5, '#101b2c')
      ell(c, 3, -4, 4, 5.5, '#101b2c')
    })
  },
  painter(c, G, R, L) {
    at(c, R.x, R.y, G.U, 0, () => {
      line(c, [[-4, 24], [26, -84]], '#c9a46a', 7)
      line(c, [[23, -74], [29, -96]], '#c9ccd1', 9, 'butt')
      line(c, [[29, -96], [34, -116]], '#d9281e', 9)
    })
    grip(c, G, R)
    at(c, L.x, L.y, G.U, 0.06, () => {
      rrect(c, -92, -104, 96, 80, 3, '#c9a46a')
      rrect(c, -87, -99, 86, 70, 2, '#fbfaf5')
      ell(c, -44, -52, 15, 19, '#5b93d6')
      ell(c, -44, -72, 21, 17, '#4a2c18')
      ell(c, -44, -48, 13, 9, '#4a2c18')
      ell(c, -49, -60, 2, 2.6, '#101b2c')
      ell(c, -40, -60, 2, 2.6, '#101b2c')
    })
    grip(c, G, L)
  },
  gardener(c, G, R) {
    at(c, R.x, R.y, G.U, 0, () => {
      quad(c, -2, 34, 14, -40, 4, -112, '#3f8a2c', 7)
      ell(c, 26, -30, 22, 9, '#4d9c36', -0.5)
      ell(c, -16, -58, 20, 8, '#4d9c36', 0.6)
      for (let i = 0; i < 13; i++) {
        const a = (i / 13) * TAU
        ell(c, 4 + Math.cos(a) * 34, -142 + Math.sin(a) * 34, 17, 8, i % 2 ? '#f7c61f' : '#f9d648', a)
      }
      ell(c, 4, -142, 22, 22, '#5a3418')
      for (let i = 0; i < 7; i++) ell(c, 4 + Math.cos(i * 2.4) * 11, -142 + Math.sin(i * 2.4) * 11, 2.5, 2.5, '#7c4c26')
    })
    grip(c, G, R)
  },
  dj(c, G, R) {
    at(c, R.x, R.y, G.U, 0, () => {
      ell(c, 12, -74, 64, 64, '#17171b')
      for (const r of [52, 42, 32]) ring(c, 12, -74, r, 'rgba(255,255,255,0.16)', 2)
      ell(c, 12, -74, 21, 21, '#e0443a')
      ell(c, 12, -74, 4, 4, '#fbfaf5')
      curl(c, 12, -74, 47, 'rgba(255,255,255,0.4)', 5, 3.5, 4.3)
      curl(c, 12, -74, 47, 'rgba(255,255,255,0.4)', 5, 0.4, 1.2)
    })
    grip(c, G, R)
  },
  ballerina(c, G, R, L) {
    for (const h of [R, L]) {
      star(c, h.x + 6 * G.U, h.y - 44 * G.U, 15 * G.U, '#fff3c4', 4, 0.3)
      star(c, h.x - 22 * G.U, h.y - 62 * G.U, 8 * G.U, '#fff3c4', 4, 0.3)
      star(c, h.x + 30 * G.U, h.y - 70 * G.U, 7 * G.U, '#ffd84a', 4, 0.3)
    }
  },
}

function drawCape(c, G) {
  const [l, e] = G.spanAt(G.armY - G.h * 0.16)
  const yb = G.bottom + 10 * G.U
  poly(c, [[l + 6, G.armY - G.h * 0.2], [e - 6, G.armY - G.h * 0.2], [G.cx + G.w * 0.82, yb], [G.cx - G.w * 0.82, yb]], '#b3202a')
  poly(c, [[G.cx + G.w * 0.75, yb - 26 * G.U], [G.cx + G.w * 0.82, yb], [G.cx - G.w * 0.82, yb], [G.cx - G.w * 0.75, yb - 26 * G.U]], '#f6f3ec')
  for (let x = G.cx - G.w * 0.7; x < G.cx + G.w * 0.72; x += 30 * G.U) ell(c, x, yb - 12 * G.U, 3 * G.U, 6 * G.U, '#1c1c22', 0.3)
}

let probeCtx = null
const probe = () => {
  if (!probeCtx) {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 4
    probeCtx = cv.getContext('2d')
  }
  return probeCtx
}

// ── the whole Pebble, as steps ──────────────────────────────────────────────
/**
 * spec: { kind, color, hair, hairColor, job } (ids), seed
 * opts: cx, ground (design px), size (height of a classic body)
 */
// how far above the top of the head each thing reaches: hair in head-widths, hats in the hat's own px
const HAIR_TOP = { mohawk: 0.68, spiky: 0.62, beehive: 1.3, afro: 0.58, pompadour: 0.5, bun: 0.42, flattop: 0.38, curly: 0.24 }
const HAT_TOP = { wizard: 184, chef: 130, lumberjack: 72, cowboy: 68, royal: 64, mail: 60, builder: 60, firefighter: 58, pirate: 58, painter: 58, geologist: 54, detective: 52, gardener: 40, ballerina: 28 }

// how far past the hand the thing in it reaches, to the right and to the left, in the Pebble's own px
const REACH_R = { chef: 182, wizard: 110, cowboy: 104, astronaut: 98, mail: 98, detective: 92, dj: 82, firefighter: 74, lumberjack: 74 }
const REACH_L = { painter: 98, doctor: 82, geologist: 46 }

export function buildPebble(spec, opts = {}) {
  // a beehive under a wizard's hat is taller than the canvas: if it will not fit, paint him smaller
  const ground = opts.ground ?? 700
  let o = { ...opts }
  let built = makePebble(spec, o)
  for (let i = 0; i < 2 && built.topY < 24; i++) {
    o = { ...o, scale: (built.scale * (ground - 24)) / (ground - built.topY) }
    built = makePebble(spec, o)
  }
  // and a wide one holding a frying pan can run off the side: step him back in
  const over = Math.max(0, built.xMax - (DW - 22)) - Math.max(0, 22 - built.xMin)
  if (Math.abs(over) > 0.5) built = makePebble(spec, { ...o, cx: (o.cx ?? DW / 2) - over })
  return built
}

function makePebble(spec, opts) {
  const r = rng((spec.seed || 1) * 7919 + 13)
  const kind = byId(KINDS, spec.kind) || KINDS[0]
  const col = byId(COLORS, spec.color) || COLORS[0]
  const hc = byId(HAIR_COLORS, spec.hairColor) || HAIR_COLORS[1]
  const cx = opts.cx ?? DW / 2
  const ground = opts.ground ?? 700
  const scale = opts.scale ?? 1
  // every kind takes up about the same room on the canvas, however flat or tall it is
  const size = opts.size ?? (scale * 285) / (kind.hs * Math.sqrt(kind.wr))
  const G = makeBody(kind, col, cx, ground - 15 * (size / 320), size, r)
  const job = spec.job
  const jobDef = byId(JOBS, job)
  const pose = { R: jobDef?.poseR || 'down', L: jobDef?.poseL || 'down' }
  const hands = {}
  const hairSeed = r.int(1, 1e6)
  // the hat needs to know how tall the hair is before the hair is painted, so draw the hair once to nowhere
  const hairFn = HAIR[spec.hair]
  if (hairFn) G.lift = hairFn(probe(), G, hc, rng(hairSeed)) || 0
  const m = G.hw / 150
  const onHead = HAT_ON_HEAD.has(job)
  const hatY = onHead ? G.top : G.top - G.lift + 13 * G.U
  let topY = G.top - (HAIR_TOP[spec.hair] ?? 0.1) * G.hw
  if (job === 'astronaut') topY = Math.min(topY, G.top - 62 * m - G.lift)
  else if (job === 'dj') topY = Math.min(topY, G.top - 26 * m - G.lift * 0.9)
  else if (HAT[job] && !onHead) topY = Math.min(topY, hatY - (HAT_TOP[job] ?? 60) * m)
  const reachL = drawArm(probe(), G, -1, pose.L)
  const reachR = drawArm(probe(), G, 1, pose.R)
  const xMax = Math.max(reachR.x + (REACH_R[job] ?? 60) * G.U, G.hx + 136 * m)
  const xMin = Math.min(reachL.x - (REACH_L[job] ?? 40) * G.U, G.hx - 136 * m)

  const steps = []
  const add = (id, draw, o) => steps.push({ id, draw, ...o })

  add('shadow', (c) => drawShadow(c, G), { style: 'rows', size: 44, tool: 'big', dur: 1.6 })
  if (job === 'royal') add('cape', (c) => drawCape(c, G), { style: 'cols', size: 54, tool: 'big', dur: 2.8 })
  add('feet', (c) => drawFeet(c, G), { style: 'rows', size: 30, tool: 'round', dur: 1.8 })
  add('body', (c) => drawBody(c, G), { style: 'cols', size: 66, tool: 'big', dur: 5.2 })
  add('shade', (c) => drawShade(c, G), { style: 'cols', size: 46, tool: 'big', dur: 2.8 })
  if (OUTFIT[job]) add('outfit', (c) => OUTFIT[job](c, G), { style: 'rows', size: 36, tool: 'round', dur: 3.6 })
  add('arms', (c) => {
    hands.L = drawArm(c, G, -1, pose.L)
    hands.R = drawArm(c, G, 1, pose.R)
  }, { style: 'rows', size: 38, tool: 'big', dur: 3.0 })
  if (hairFn) add('hair', (c) => hairFn(c, G, hc, rng(hairSeed)), { style: 'dab', size: 40, tool: 'big', dur: spec.hair === 'bald' || spec.hair === 'combover' ? 2.4 : 4.6 })
  if (HAT[job]) add('hat', (c) => at(c, G.hx, hatY, m, 0, () => HAT[job](c, G.lift / m)), { style: 'rows', size: 34, tool: 'round', dur: 3.4 })
  add('face', (c) => {
    drawEyes(c, G)
    if (FACE[job]) FACE[job](c, G)
  }, { style: 'dab', size: 26, tool: 'round', dur: FACE[job] ? 3.4 : 2.4 })
  if (PROP[job]) {
    add('prop', (c) => {
      if (!hands.R) {
        hands.L = drawArm(probe(), G, -1, pose.L)
        hands.R = drawArm(probe(), G, 1, pose.R)
      }
      PROP[job](c, G, hands.R, hands.L)
    }, { style: 'rows', size: 28, tool: 'round', dur: 3.6 })
  }
  return { G, steps, col, hc, kind, topY, xMin, xMax, scale }
}

/** a small plain Pebble to keep the big one company */
export function buildFriend(seed, cx, ground, room = 100) {
  const r = rng(seed * 31 + 7)
  const kind = r.pick(KINDS.filter((k) => !k.lumps))
  const col = r.pick(COLORS)
  const size = room / (kind.hs * Math.sqrt(kind.wr))
  const G = makeBody(kind, col, cx, ground - 15 * (size / 320), size, r)
  return {
    G, col, kind,
    draw(c) {
      drawShadow(c, G)
      drawFeet(c, G)
      drawBody(c, G)
      drawShade(c, G)
      drawArm(c, G, -1, 'down')
      drawArm(c, G, 1, r() < 0.5 ? 'up' : 'down')
      drawEyes(c, G)
    },
  }
}

/** everything at once: for the request sheet's preview and for checking the art */
export function drawWhole(c, built) {
  for (const s of built.steps) s.draw(c)
}
