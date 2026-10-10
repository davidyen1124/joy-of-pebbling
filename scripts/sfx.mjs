// The sound effects, made with ElevenLabs' sound generation and finished with ffmpeg.
//
// What each one should be was measured off a real episode of the programme (see README, "Sound"):
// a tapping brush lands five times a second and each tap is a dull 60 ms thud; the brush is beaten on
// the easel eleven times a second for two seconds, each strike a broadband crack over a low thump; a
// criss-cross stroke is a soft bright hiss a fifth of a second long; the knife makes scrapes of
// 0.15 to 0.25 s. The page plays one clip per stroke, tap and strike, so each clip is ONE event.
//
//   node scripts/sfx.mjs --dry          the list and what it will cost; no key needed
//   node scripts/sfx.mjs                make whatever is missing
//   node scripts/sfx.mjs tap hit        just those groups
//   node scripts/sfx.mjs --force        make everything again
//
// Needs ELEVENLABS_API_KEY (environment or .env) with the sound_generation permission.
// Writes assets-src/sfx/<name>.mp3 (as generated), public/sfx/<name>.mp3 and public/sfx/manifest.json.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'assets-src/sfx')
const OUT = path.join(ROOT, 'public/sfx')
const args = process.argv.slice(2)
const force = args.includes('--force')
const only = args.filter((a) => !a.startsWith('-'))

const DRY = 'Isolated foley, recorded very close in a quiet room, dry, no reverb, no music, no voices.'
// group, how many takes, seconds asked for, what it is, options. max = longest a finished take may be.
// Takes are kept few: every second generated costs credits. Add takes by raising the numbers; names are stable.
const CLIPS = [
  ['stroke', 3, 1.0, `One single firm stroke of a wide, dry, stiff-bristle house-painting brush dragged across a stretched primed canvas: a short bright scratchy "shhk". ${DRY}`, { max: 0.9 }],
  ['tap', 6, 0.5, `One single firm tap of a paintbrush's bristles against a tight stretched canvas: a very short, dull, drum-like thud with a little bristle noise. ${DRY}`, { max: 0.13, event: [0.012, 0.16] }],
  ['knife', 2, 0.8, `One single short scrape of a steel palette knife pulling thick oil paint down a stretched canvas: a crisp rasp with a faint metallic edge. ${DRY}`, { max: 0.5 }],
  ['hit', 6, 0.5, `One single sharp whack of a wet paintbrush against a hollow aluminium easel leg: a hard broadband crack with a low hollow thump underneath, very short. ${DRY}`, { max: 0.075, event: [0.008, 0.16] }],
  ['wash', 1, 2.0, `A paintbrush scrubbed and rattled hard against a wire screen at the bottom of a metal bucket of paint thinner: bright rattling with liquid sloshing. ${DRY}`, { max: 2.0 }],
  ['load', 1, 0.5, `A paintbrush pressed once into a blob of thick wet oil paint on a palette: one soft sticky squish. ${DRY}`, { max: 0.4, gain: -4 }],
  ['liner', 2, 0.6, `One single short stroke of a tiny thin brush on a stretched canvas: a faint, delicate scratch. ${DRY}`, { max: 0.5, gain: -4 }],
  ['static', 1, 0.7, 'A short burst of analogue television static, as a tape starts to play.', { max: 0.7, gain: -6 }],
  ['theme', 1, 10, 'The gentle opening theme of a 1980s public-television craft programme: soft electric piano and nylon-string guitar playing a slow, warm, hopeful melody; mellow, kind, slightly wobbly like an old tape. Ends on a held chord.', { music: true, gain: -4 }],
]
const jobs = CLIPS.flatMap(([group, n, seconds, text, o = {}]) => Array.from({ length: n }, (_, i) => ({ name: `${group}${n > 1 ? i + 1 : ''}`, group, seconds, text, o })))
  .filter((j) => !only.length || only.includes(j.group))

if (args.includes('--dry')) {
  const secs = jobs.reduce((a, j) => a + j.seconds, 0)
  console.log(`${jobs.length} clips in ${new Set(jobs.map((j) => j.group)).size} groups, ${secs.toFixed(1)} seconds asked for (about ${Math.round(secs * 40)} credits at 40 a second)`)
  for (const [g, n, s] of CLIPS) console.log(`  ${g.padEnd(7)} x${n}  ${s}s`)
  process.exit(0)
}

const envFile = [path.join(ROOT, '.env'), process.env.SFX_ENV].find((f) => f && fs.existsSync(f))
const KEY = process.env.ELEVENLABS_API_KEY || (envFile && (fs.readFileSync(envFile, 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, ''))
if (!KEY) {
  console.error('ELEVENLABS_API_KEY is not set. Put it in the environment, or in a .env file beside package.json:\n  ELEVENLABS_API_KEY=...')
  process.exit(2)
}
fs.mkdirSync(SRC, { recursive: true })
fs.mkdirSync(OUT, { recursive: true })

const probe = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())
async function make(j) {
  const src = path.join(SRC, `${j.name}.mp3`)
  const out = path.join(OUT, `${j.name}.mp3`)
  if (force || !fs.existsSync(src)) {
    let res
    for (let attempt = 0; attempt < 5; attempt++) {
      res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
        method: 'POST',
        headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ text: j.text, duration_seconds: j.seconds, prompt_influence: j.o.music ? 0.4 : 0.6, loop: !!j.o.loop, model_id: 'eleven_text_to_sound_v2' }),
      })
      if (res.status !== 429) break
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)))
    }
    if (!res.ok) return console.log(`FAIL ${j.name.padEnd(9)} ${res.status} ${(await res.text()).slice(0, 220)}`)
    fs.writeFileSync(src, Buffer.from(await res.arrayBuffer()))
  }
  // A tap or a strike is cut by hand, sample by sample: the blow has to land the moment the clip starts
  // (or a run of them will not keep time), die away quickly (or a run of them smears into a hiss), and
  // be as loud as the other takes.
  if (j.o.event) {
    const SR = 44100
    const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], { maxBuffer: 1 << 26 })
    const x = new Float32Array(pcm.length >> 1)
    for (let i = 0; i < x.length; i++) x[i] = pcm.readInt16LE(i * 2) / 32768
    let pk = 0
    let at = 0
    for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > pk) (pk = Math.abs(x[i])), (at = i)
    if (pk < 0.02) return console.log(`SKIP ${j.name.padEnd(9)} silence`)
    // the blow starts where the level first comes within 14 dB of its peak, looking back at most 30 ms
    let from = at
    for (let i = at; i > Math.max(0, at - SR * 0.03); i--) if (Math.abs(x[i]) > pk * 0.2) from = i
    from = Math.max(0, from - Math.round(SR * 0.003))
    // how long it rings: until it has stayed 20 dB down for 15 ms
    let last = at
    for (let i = at, quiet = 0; i < x.length && quiet < SR * 0.015; i++) {
      if (Math.abs(x[i]) > pk * 0.1) (last = i), (quiet = 0)
      else quiet++
    }
    const rings = (last - from) / SR
    if (rings < j.o.event[0] || rings > j.o.event[1]) {
      return console.log(`SKIP ${j.name.padEnd(9)} not one short blow: it rings for ${(rings * 1000).toFixed(0)} ms`)
    }
    const n = Math.min(x.length - from, Math.round(SR * j.o.max))
    const y = Buffer.alloc(n * 2)
    const fadeIn = SR * 0.0015
    const fadeFrom = Math.round(n * 0.4)
    const gain = (0.89 / pk) * 10 ** ((j.o.gain || 0) / 20)
    for (let i = 0; i < n; i++) {
      let v = x[from + i] * gain
      if (i < fadeIn) v *= i / fadeIn
      if (i > fadeFrom) v *= ((n - i) / (n - fadeFrom)) ** 2
      y.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2)
    }
    // so short that it is kept as plain samples: an encoder would smear the attack and pad the start
    const head = Buffer.alloc(44)
    head.write('RIFF', 0)
    head.writeUInt32LE(36 + y.length, 4)
    head.write('WAVEfmt ', 8)
    head.writeUInt32LE(16, 16)
    head.writeUInt16LE(1, 20)
    head.writeUInt16LE(1, 22)
    head.writeUInt32LE(SR, 24)
    head.writeUInt32LE(SR * 2, 28)
    head.writeUInt16LE(2, 32)
    head.writeUInt16LE(16, 34)
    head.write('data', 36)
    head.writeUInt32LE(y.length, 40)
    fs.writeFileSync(out.replace(/\.mp3$/, '.wav'), Buffer.concat([head, y]))
    fs.rmSync(out, { force: true })
    return console.log(`ok   ${j.name.padEnd(9)} ${(n / SR).toFixed(2)}s, one blow ringing ${(Math.min(rings, n / SR) * 1000).toFixed(0)} ms`)
  }
  // other single sounds lose the silence round them and anything after the first event; all are levelled
  const one = !j.o.loop && !j.o.music
  const filters = [
    one && 'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.004',
    one && `silenceremove=stop_periods=1:stop_threshold=-46dB:stop_duration=0.05`,
    one && j.o.max && `atrim=0:${j.o.max},afade=t=out:st=${Math.max(0, j.o.max - 0.05).toFixed(3)}:d=0.05`,
    `loudnorm=I=${j.o.loop ? -24 : j.o.music ? -19 : -16}:TP=-1.5:LRA=11`,
    j.o.gain && `volume=${j.o.gain}dB`,
    !j.o.loop && 'afade=t=in:d=0.003',
  ].filter(Boolean).join(',')
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-af', filters, '-ac', j.o.music || j.o.loop ? '2' : '1', '-ar', '44100', '-b:a', j.o.music ? '128k' : '96k', out])
  // trimmed away to nothing: the take was silence, or one long fade
  if (fs.statSync(out).size < 900) {
    fs.rmSync(out)
    return console.log(`SKIP ${j.name.padEnd(9)} nothing left after trimming`)
  }
  const d = probe(out)
  console.log(`ok   ${j.name.padEnd(9)} ${d.toFixed(2)}s ${(fs.statSync(out).size / 1024).toFixed(0)} KB${one && d < 0.03 ? '   EMPTY? listen to this one' : ''}`)
}

const queue = jobs.slice()
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const j = queue.shift()
    try {
      await make(j)
    } catch (e) {
      console.log(`FAIL ${j.name.padEnd(9)} ${String(e.message).split('\n')[0].slice(0, 160)}`)
    }
  }
}))
// the page plays whatever is listed here; anything missing keeps its built-in stand-in
const clips = {}
for (const f of fs.readdirSync(OUT).filter((f) => /\.(mp3|wav)$/.test(f)).sort()) clips[f.slice(0, -4)] = f
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ clips }))
console.log(`${Object.keys(clips).length} clips, ${Math.round(Object.values(clips).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0) / 1024)} KB`)
