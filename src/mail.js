// Viewer Mail: write in and ask for a particular Pebble. A small preview is drawn with the same code
// that Cobb paints from.
import { COLORS, HAIRS, HAIR_COLORS, JOBS, KINDS } from './data.js'
import { buildPebble, drawWhole } from './pebble.js'

const $ = (id) => document.getElementById(id)
const pickOne = (list) => list[Math.floor(Math.random() * list.length)].id

export function setupMail(onSend) {
  const dlg = $('mail')
  const prev = $('prev')
  const pc = prev.getContext('2d')
  const choice = { color: 'pblue', kind: 'classic', job: 'chef', hair: 'afro', hairColor: 'brown' }
  const groups = [
    ['optColor', 'color', COLORS, true],
    ['optKind', 'kind', KINDS, false],
    ['optJob', 'job', JOBS, false],
    ['optHair', 'hair', HAIRS, false],
    ['optHairColor', 'hairColor', HAIR_COLORS, true],
  ]

  const draw = () => {
    pc.setTransform(1, 0, 0, 1, 0, 0)
    pc.clearRect(0, 0, prev.width, prev.height)
    pc.setTransform(0.5, 0, 0, 0.5, 0, 0)
    drawWhole(pc, buildPebble({ ...choice, seed: 5 }, { cx: 300, ground: 650, scale: 0.86 }))
    const c = COLORS.find((x) => x.id === choice.color)
    const k = KINDS.find((x) => x.id === choice.kind)
    const j = JOBS.find((x) => x.id === choice.job)
    const h = HAIRS.find((x) => x.id === choice.hair)
    const hc = HAIR_COLORS.find((x) => x.id === choice.hairColor)
    $('prevText').textContent = `a ${c.label} ${k.label}, a ${j.label}, with ${h.id === 'bald' ? 'no hair at all' : `${h.mass ? '' : 'a '}${hc.label} ${h.label}`}.`.replace(/\ba ([aeiou])/g, 'an $1')
    for (const [id, key] of groups) for (const b of $(id).children) b.setAttribute('aria-pressed', String(b.dataset.id === choice[key]))
    $('optHairColor').closest('fieldset').hidden = choice.hair === 'bald'
  }

  for (const [id, key, list, swatch] of groups) {
    const box = $(id)
    for (const item of list) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'chip'
      b.dataset.id = item.id
      if (swatch) {
        b.style.setProperty('--c', item.base || item.c)
        b.setAttribute('aria-label', item.label)
        b.title = item.label
      } else b.textContent = item.label
      b.addEventListener('click', () => {
        choice[key] = item.id
        draw()
      })
      box.append(b)
    }
  }
  $('mailRandom').addEventListener('click', () => {
    choice.color = pickOne(COLORS)
    choice.kind = pickOne(KINDS)
    choice.job = pickOne(JOBS)
    choice.hair = pickOne(HAIRS)
    choice.hairColor = pickOne(HAIR_COLORS)
    draw()
  })
  dlg.addEventListener('close', () => {
    if (dlg.returnValue === 'send') onSend({ ...choice })
    dlg.returnValue = ''
  })
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close('cancel')
  })
  return {
    open(current) {
      if (current) Object.assign(choice, current)
      draw()
      dlg.showModal()
    },
    get isOpen() {
      return dlg.open
    },
  }
}
