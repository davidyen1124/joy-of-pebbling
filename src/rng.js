// A small seeded generator, so an episode number always paints the same Pebble.
export function rng(seed) {
  let a = (seed >>> 0) || 1
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  r.range = (lo, hi) => lo + (hi - lo) * r()
  r.int = (lo, hi) => Math.floor(r.range(lo, hi + 1))
  r.pick = (list) => list[Math.floor(r() * list.length)]
  r.chance = (p) => r() < p
  r.shuffle = (list) => {
    const out = list.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
  return r
}

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
export const lerp = (a, b, t) => a + (b - a) * t
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
