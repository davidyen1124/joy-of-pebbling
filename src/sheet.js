// Dev only: a contact sheet of Pebbles, to check the drawing. ?mode=jobs|hair|kinds|random&seed=1
import { KINDS, COLORS, HAIRS, HAIR_COLORS, JOBS } from './data.js'
import { buildPebble, drawWhole } from './pebble.js'
import { rng } from './rng.js'

const q = new URLSearchParams(location.search)
const mode = q.get('mode') || 'random'
const seed = +(q.get('seed') || 1)
const r = rng(seed)
const cols = +(q.get('cols') || 5)
const list = []
if (mode === 'jobs') JOBS.forEach((j, i) => list.push({ job: j.id, kind: 'classic', color: COLORS[i % COLORS.length].id, hair: q.get('hair') || 'bald', hairColor: 'brown' }))
else if (mode === 'hair') HAIRS.forEach((h, i) => list.push({ job: 'none', kind: q.get('kind') || 'classic', color: COLORS[(i * 2) % COLORS.length].id, hair: h.id, hairColor: HAIR_COLORS[i % HAIR_COLORS.length].id }))
else if (mode === 'kinds') KINDS.forEach((k, i) => list.push({ job: JOBS[i * 2].id, kind: k.id, color: COLORS[(i * 3) % COLORS.length].id, hair: HAIRS[(i * 5) % HAIRS.length].id, hairColor: HAIR_COLORS[i % HAIR_COLORS.length].id }))
else for (let i = 0; i < 20; i++) list.push({ job: r.pick(JOBS).id, kind: r.pick(KINDS).id, color: r.pick(COLORS).id, hair: r.pick(HAIRS).id, hairColor: r.pick(HAIR_COLORS).id })

const CW = 380
const CH = 470
const cv = document.getElementById('c')
cv.width = cols * CW
cv.height = Math.ceil(list.length / cols) * CH
const c = cv.getContext('2d')
list.forEach((spec, i) => {
  const x = (i % cols) * CW
  const y = Math.floor(i / cols) * CH
  c.save()
  c.translate(x, y)
  c.beginPath()
  c.rect(0, 0, CW, CH)
  c.clip()
  c.scale(0.66, 0.66)
  const built = buildPebble({ ...spec, seed: seed * 100 + i }, { cx: CW / 2 / 0.66, ground: 640 })
  drawWhole(c, built)
  c.restore()
  c.fillStyle = '#12202a'
  c.font = '15px monospace'
  c.fillText(`${spec.kind} ${spec.color} ${spec.job} ${spec.hair}`, x + 8, y + CH - 10)
})
document.title = 'ready'
