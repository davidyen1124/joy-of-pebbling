// Cobb's voice. Records every line he can say with ElevenLabs, once, and files each one under the
// name the page looks for (src/lines.js). Trimmed and levelled with ffmpeg.
//
//   node scripts/voice.mjs --dry            how many lines, how many characters; no key needed
//   node scripts/voice.mjs --audition       one line in each candidate voice, to choose between
//   node scripts/voice.mjs                  record whatever is missing, most-heard lines first
//   node scripts/voice.mjs --limit 5000     stop after about that many characters
//   node scripts/voice.mjs --episodes       only the lines of the episodes in assets-src/voice/episodes.json,
//                                           an episode at a time, so each one is complete before the next begins
//   node scripts/voice.mjs --force          record everything again
//
// Needs ELEVENLABS_API_KEY in the environment or in a .env file beside package.json. The key is read,
// used for the requests and never written anywhere. VOICE_ID and VOICE_MODEL override the defaults.
//
// Writes  assets-src/voice/<id>.json   what came back (audio and character timings), so a re-run costs nothing
//         public/voice/<id>.mp3        what the page plays
//         public/voice/manifest.json   { lines: { id: seconds }, featured: [episode numbers] }
//                                      the show times itself to the lengths, and plays the featured
//                                      episodes (those with every line recorded) by default
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { allLines, lineId, VOICE_VERSION } from '../src/lines.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'assets-src/voice')
const OUT = path.join(ROOT, 'public/voice')
const API = 'https://api.elevenlabs.io/v1'
const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name, d) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : d)

// warm, unhurried, a little gravel in it. Premade ElevenLabs voices; none is a copy of a real person.
const VOICES = {
  brian: 'nPczCjzI2devNBz1zQrb', // deep, resonant, comforting
  bill: 'pqHfZKP75CvOlQylNhV4', // older, kindly, trustworthy
  george: 'JBFqnCBsd6RMkjVDRZzb', // warm storyteller
  roger: 'CwhRBWXzGAHq8TQ4Fs17', // laid back
}
const VOICE = process.env.VOICE_ID || VOICES[opt('voice', 'brian')] || opt('voice')
const MODEL = process.env.VOICE_MODEL || 'eleven_v3'
// how he says everything; eleven_v3 takes directions in square brackets
const DIRECTION = MODEL === 'eleven_v3' ? '[softly] ' : ''
const SETTINGS = { stability: 0.5, similarity_boost: 0.75 }

const everything = allLines()
const chars = (l) => (DIRECTION + l.speech).length
// episodes to be voiced whole: [{ no, title, lines: [text] }], written by scripts/episode-lines.mjs
const EPISODES = path.join(SRC, 'episodes.json')
const episodes = fs.existsSync(EPISODES) ? JSON.parse(fs.readFileSync(EPISODES, 'utf8')) : []
let lines = everything
if (flag('episodes')) {
  const byId = new Map(everything.map((l) => [l.id, l]))
  const seen = new Set()
  lines = []
  for (const ep of episodes) {
    for (const text of ep.lines) {
      const l = byId.get(lineId(text))
      if (!l) throw new Error(`episode ${ep.no} says something that is not on the list: "${text}"`)
      if (!seen.has(l.id)) {
        seen.add(l.id)
        lines.push(l)
      }
    }
  }
}

if (flag('dry')) {
  const total = lines.reduce((a, l) => a + chars(l), 0)
  const have = lines.filter((l) => fs.existsSync(path.join(OUT, `${l.id}.mp3`)))
  console.log(`${lines.length} lines${flag('episodes') ? ` in episodes ${episodes.map((e) => e.no).join(', ')}` : ''}, ${total} characters (${MODEL}); ${have.length} already recorded`)
  console.log(`still to record: ${lines.length - have.length} lines, ${lines.filter((l) => !have.includes(l)).reduce((a, l) => a + chars(l), 0)} characters`)
  for (const l of lines.slice(0, 6)) console.log(`  ${l.id}  ${DIRECTION}${l.speech}`)
  process.exit(0)
}

const envFile = [path.join(ROOT, '.env'), process.env.VOICE_ENV].find((f) => f && fs.existsSync(f))
const KEY = process.env.ELEVENLABS_API_KEY || (envFile && (fs.readFileSync(envFile, 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, ''))
if (!KEY) {
  console.error('ELEVENLABS_API_KEY is not set. Put it in the environment, or in a .env file beside package.json:\n  ELEVENLABS_API_KEY=...')
  process.exit(2)
}
fs.mkdirSync(SRC, { recursive: true })
fs.mkdirSync(OUT, { recursive: true })
const headers = { 'xi-api-key': KEY, 'content-type': 'application/json' }

async function speak(text, voice = VOICE) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${API}/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST', headers, body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
    })
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)))
      continue
    }
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 240)}`)
    return res.json()
  }
  throw new Error('still rate-limited after six tries')
}

/** the recording as the page wants it: no silence at either end, level, small */
function finish(data, out) {
  const tmp = out.replace(/\.mp3$/, '.raw.mp3')
  fs.writeFileSync(tmp, Buffer.from(data.audio_base64, 'base64'))
  const filters = [
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03',
    'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse',
    'loudnorm=I=-18:TP=-1.5:LRA=11',
    'afade=t=in:d=0.01',
  ].join(',')
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-af', filters, '-ac', '1', '-ar', '44100', '-b:a', '64k', out])
  fs.rmSync(tmp)
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString())
}

const said = (data) => (data.alignment?.characters || []).join('').replace(/\[[^\]]*\]\s*/g, '').trim()
const plain = (s) => s.toLowerCase().replace(/\[[^\]]*\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

if (flag('audition')) {
  const text = `${DIRECTION}Hi. Welcome back. I'm certainly glad you could join me today. Let's put a pebble in this world.`
  fs.mkdirSync(path.join(ROOT, 'assets-src/audition'), { recursive: true })
  for (const [name, id] of Object.entries(VOICES)) {
    const out = path.join(ROOT, 'assets-src/audition', `${name}.mp3`)
    const seconds = finish(await speak(text, id), out)
    console.log(`${name.padEnd(8)} ${seconds.toFixed(1)}s  ${out}`)
  }
  process.exit(0)
}

// what is left on the account, so a run never stops half way through a sentence for want of credit
const sub = await fetch(`${API}/user/subscription`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
const left = sub ? sub.character_limit - sub.character_count : Infinity
const limit = Math.min(Number(opt('limit', Infinity)), left - Number(opt('reserve', 120)))
if (sub) console.log(`account: ${sub.tier}, ${left} characters left of ${sub.character_limit}`)

const manifestFile = path.join(OUT, 'manifest.json')
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { lines: {} }
if (manifest.version !== VOICE_VERSION || manifest.voice !== VOICE || manifest.model !== MODEL) manifest.lines = {}
Object.assign(manifest, { version: VOICE_VERSION, voice: VOICE, model: MODEL })

let spent = 0
let made = 0
let odd = 0
let skipped = 0
const queue = lines.slice()
async function worker() {
  while (queue.length) {
    const l = queue.shift()
    const src = path.join(SRC, `${l.id}.json`)
    const out = path.join(OUT, `${l.id}.mp3`)
    try {
      if (flag('force') || !fs.existsSync(src) || JSON.parse(fs.readFileSync(src, 'utf8')).voice !== `${VOICE}/${MODEL}`) {
        if (spent + chars(l) > limit) {
          skipped++
          continue
        }
        spent += chars(l)
        const data = await speak(DIRECTION + l.speech)
        fs.writeFileSync(src, JSON.stringify({ voice: `${VOICE}/${MODEL}`, text: l.text, ...data }))
        made++
      }
      const data = JSON.parse(fs.readFileSync(src, 'utf8'))
      const seconds = finish(data, out)
      manifest.lines[l.id] = Math.round(seconds * 100) / 100
      // did he say what was written, at a human pace?
      const heard = plain(said(data))
      const want = plain(l.speech)
      const rate = want.length / seconds
      const ok = heard === want && rate > 7 && rate < 21
      if (!ok) {
        odd++
        console.log(`ODD  ${l.id} ${seconds.toFixed(1)}s ${rate.toFixed(0)}ch/s  wanted "${l.speech}"  heard "${said(data)}"`)
      }
    } catch (e) {
      console.log(`FAIL ${l.id} "${l.speech.slice(0, 50)}": ${e.message}`)
      if (/401|403|quota|permission/i.test(e.message)) queue.length = 0
    }
  }
}
await Promise.all(Array.from({ length: 3 }, worker))
// drop recordings of lines he no longer says
const live = new Set(everything.map((l) => l.id))
for (const id of Object.keys(manifest.lines)) if (!live.has(id)) delete manifest.lines[id]
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.mp3') && !live.has(f.slice(0, -4))) fs.rmSync(path.join(OUT, f))
// an episode is featured once every line in it has a recording
manifest.featured = episodes.filter((ep) => ep.lines.every((t) => manifest.lines[lineId(t)] !== undefined)).map((ep) => ep.no)
fs.writeFileSync(manifestFile, JSON.stringify(manifest))
const n = Object.keys(manifest.lines).length
const secs = Object.values(manifest.lines).reduce((a, b) => a + b, 0)
const kb = fs.readdirSync(OUT).filter((f) => f.endsWith('.mp3')).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0) / 1024
console.log(`${n} of ${everything.length} lines recorded (${made} new, ${spent} characters spent, ${skipped} left for want of credit, ${odd} to listen to)`)
console.log(`episodes with every line recorded: ${manifest.featured.join(', ') || 'none yet'}`)
console.log(`${(secs / 60).toFixed(1)} minutes of Cobb, ${(kb / 1024).toFixed(1)} MB`)
