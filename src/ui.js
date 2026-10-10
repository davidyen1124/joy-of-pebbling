// Everything on the page that is not the 3D picture: the words the station lays over it (captions,
// the yellow colour names, credits), the tape label, and the read-out in the corner.
const $ = (id) => document.getElementById(id)

export class UI {
  constructor() {
    this.el = {
      title: $('titlecard'), slate: $('slate'), credits: $('credits'), lower: $('lower'), color: $('colorname'),
      cc: $('cc'), ccBox: $('ccboxText'), osdL: $('osdL'), osdR: $('osdR'),
      epNo: $('epNo'), epTitle: $('epTitle'), epMeta: $('epMeta'),
    }
    this.ccSpan = document.createElement('span')
    this.el.cc.append(this.ccSpan)
    this.t = { cc: 0, color: 0, lower: 0, osd: 0 }
    this.creditI = -1
    this.lastClock = ''
    this.osd('PLAY ▶', 3)
  }

  episode(ep) {
    const no = String(ep.no).padStart(4, '0')
    this.el.epNo.textContent = `EP. ${no}`
    this.el.epTitle.textContent = ep.title
    this.el.epMeta.textContent = `${ep.blurb} · ${ep.plate.title}`
    this.el.slate.innerHTML = ''
    const a = document.createElement('span')
    a.textContent = `“${ep.title}”`
    const b = document.createElement('small')
    b.textContent = `episode ${ep.no} · ${ep.plate.title}`
    this.el.slate.append(a, b)
    document.title = `${ep.title} · The Joy of Pebbling`
  }

  title(on) {
    this.el.title.hidden = !on
  }

  caption(text, dur) {
    this.ccSpan.textContent = text
    this.el.ccBox.textContent = text
    this.t.cc = dur + 0.5
  }

  colorName(text, dur) {
    this.el.color.textContent = text
    this.el.color.hidden = false
    this.t.color = dur
  }

  lower(a, b, dur) {
    this.el.lower.firstElementChild.textContent = a
    this.el.lower.lastElementChild.textContent = b
    this.el.lower.hidden = false
    this.t.lower = dur
  }

  credits(card, i) {
    if (!card) {
      if (this.creditI !== -1) this.el.credits.hidden = true
      this.creditI = -1
      return
    }
    if (i === this.creditI) return
    this.creditI = i
    const box = this.el.credits
    box.innerHTML = ''
    for (const [role, names] of card) {
      const g = document.createElement('div')
      if (role) {
        const r = document.createElement('div')
        r.className = 'role'
        r.textContent = role
        g.append(r)
      }
      const n = document.createElement('div')
      n.className = role ? 'names' : 'names'
      names.forEach((x, k) => {
        if (k) n.append(document.createElement('br'))
        n.append(x)
      })
      g.append(n)
      box.append(g)
    }
    box.hidden = false
  }

  /** dur 0 keeps it up until the next one */
  osd(text, dur) {
    this.el.osdL.textContent = text
    this.t.osd = dur || Infinity
  }

  clear() {
    this.caption('', 0)
    this.el.color.hidden = true
    this.el.lower.hidden = true
    this.t.color = this.t.lower = 0
  }

  /** real seconds for the machine's own read-out, show seconds for what belongs to the programme */
  tick(real, dt, clock) {
    const t = this.t
    if (t.osd !== Infinity && t.osd > 0 && (t.osd -= real) <= 0) this.el.osdL.textContent = ''
    if (t.cc > 0 && (t.cc -= dt) <= 0) {
      this.ccSpan.textContent = ''
      this.el.ccBox.innerHTML = '&nbsp;'
    }
    if (t.color > 0 && (t.color -= dt) <= 0) this.el.color.hidden = true
    if (t.lower > 0 && (t.lower -= dt) <= 0) this.el.lower.hidden = true
    const s = Math.floor(clock)
    const text = `SP ${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
    if (text !== this.lastClock) {
      this.lastClock = text
      this.el.osdR.textContent = text
    }
  }
}
