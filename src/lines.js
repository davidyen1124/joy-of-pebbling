// The complete list of sentences Cobb can say, and the name each recording is filed under.
// Used by the page (to find a line's recording and how long it runs) and by scripts/voice.mjs (to
// record them). No DOM in here: it runs in Node too.
import { COLORS, HAIRS, JOBS, KINDS, NAMES, PAINTS, PLATES } from './data.js'
import * as S from './script.js'

/** bump to throw every recording away and start again (a new voice, say) */
export const VOICE_VERSION = 1

/**
 * What is sent to the voice for a caption. Captions carry stage directions in round brackets; the
 * voice (eleven_v3) takes its directions in square ones.
 */
export function speechOf(text) {
  return text
    .replace(/\(heh heh\)\s*/g, '[chuckles warmly] ')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/’/g, "'")
    .trim()
}

export function lineId(text) {
  const s = `${VOICE_VERSION}|${speechOf(text)}`
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** how long a line takes if there is no recording to measure: Cobb is in no hurry */
export const guessSeconds = (text) => Math.min(6.5, Math.max(1.6, 0.9 + speechOf(text).replace(/\[[^\]]*\]/g, '').length * 0.062))

/** every sentence, most often heard first (so a short budget is spent where it is heard most) */
export function allLines() {
  const out = new Map() // text -> how many kinds of episode use it (rough)
  const add = (text, ctx, weight = 1) => {
    const t = S.fill(text, ctx)
    out.set(t, (out.get(t) || 0) + weight)
  }
  const each = (list, fn) => list.flat(Infinity).forEach(fn)

  each(S.GREET, (t) => add(t, {}, 20))
  each(Object.values(S.PRIMED), (t) => add(t, {}, 20))
  each(S.WASH, (t) => add(t, {}, 40))
  each(S.ENTER, (t) => add(t, {}, 30))
  each(Object.values(S.STEP), (t) => add(t, {}, 40))
  each(S.BODY_ANY, (t) => add(t, {}, 30))
  each([S.HAIR_ANY, S.HAT_ANY, S.PROP_ANY], (t) => add(t, {}, 60))
  each(S.ACCIDENT, (t) => add(t, {}, 15))
  each(S.FRIEND, (t) => add(t, {}, 15))
  each(S.FRIEND_AFTER_ACCIDENT, (t) => add(t, {}, 15))
  each(S.SIGN, (t) => add(t, {}, 40))
  each(S.OUTRO_BYE, (t) => add(t, {}, 40))
  for (const p of PLATES) {
    for (const b of p.bands) each(S.BAND[b.what] || S.BAND.sky, (t) => add(t, { paint: PAINTS[b.paints[0]].name }, 15))
  }
  for (const h of HAIRS) each(h.say, (t) => add(t, {}, 6))
  for (const j of JOBS) {
    each(j.say, (t) => add(t, {}, 5))
    each(S.GREET_JOB, (t) => add(t, { job: j.label }, 5))
    each(S.PROP, (t) => add(t, { prop: j.prop }, 5))
    if (S.HAT[j.id]) add(S.HAT[j.id], {}, 5)
    if (S.FACE_EXTRA[j.id]) add(S.FACE_EXTRA[j.id], {}, 5)
  }
  for (const c of COLORS) each(S.BODY_COLOR, (t) => add(t, { say: c.say }, 7))
  for (const k of KINDS) each(S.BODY_KIND, (t) => add(t, { kind: k.a }, 12))
  for (const n of NAMES) each(S.OUTRO_NAME, (t) => add(t, { name: n }, 2))

  return [...out.entries()].sort((a, b) => b[1] - a[1]).map(([text, weight]) => ({ text, weight, id: lineId(text), speech: speechOf(text) }))
}
