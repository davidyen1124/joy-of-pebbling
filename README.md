# The Joy of Pebbling, with Cobb Moss

A page that is one picture and nothing else. In it a blue [Turnstone](https://myturnstone.ai) Pebble with
an enormous afro stands at an easel and paints, stroke by stroke, while you watch: first a landscape,
then a happy little Pebble to live in it. Every episode is a different Pebble: a different kind, colour,
haircut and job. When he has signed it, the credits roll and the next one starts.

Live at https://joy-of-pebbling.vercel.app

A fan-made parody. Not affiliated with Bob Ross Inc., PBS or Turnstone.

## What is on the page

- **The picture** fills the window, whatever shape the window is. Cobb, his easel, his palette and his
  brushes are a 3D scene; the canvas on the easel is a real canvas that gets painted in real time. The
  whole thing is rendered small and pushed through a worn-tape shader: colour that smears sideways, a
  tear along the bottom edge, scan lines, grain.
- **On an upright phone** there is no room for Cobb and his canvas side by side, so the picture is cut in
  two: the canvas across the top, Cobb underneath, reaching for it.
- **What the station lays over it.** Closed captions (white capitals on black), each paint's name in
  yellow as he first reaches for it, his name when he says hello, the credits, and the tape machine's
  read-out in the corners.
- **No furniture.** Nothing else is on screen. Moving the mouse or tapping brings a strip of words across
  the top (Pause, Speed, Next, Sound, Request, Keep) which goes away again after three seconds. A click on
  the picture pauses it, as on any video.
- **Starting.** If the browser will let a page be heard without being touched, the programme simply
  starts, with its sound. Most will not on a first visit: then it waits on its title card behind a large
  play button, everything it needs already fetched, and one click, tap or key anywhere starts it from the
  top, sound and all.
- **Viewer Mail** (Request) is the tape machine's own menu laid over the picture: choose a colour, a
  shape, a job and a haircut, and Cobb paints that Pebble next.
- **The address is left alone.** A link may still name an episode (`?ep=427`), and is cleared as soon as
  the programme moves on from it.

Keys: space or `k` pauses, `f` changes speed, `n` or the right arrow is the next Pebble, `m` is sound.

## An episode

Title card, hello, then the landscape from the top down. Each band of it (sky, mountain, water, ground)
is blocked in soft with the big brush and then gone over with its own tool: criss-crosses for sky, the
knife for a mountain, taps for foliage. Then he washes the brush in a bucket of thinner and beats it dry
on the leg of the easel. Then the Pebble: shadow, feet, body, the dark side, clothes, arms, hair, hat, eyes, whatever he
holds. Sometimes he drops some paint, which is not a mistake, and which becomes a second, smaller
Pebble before the end. He signs it in red. About three minutes.

There are 8 kinds of Pebble, 15 colours, 17 haircuts in 11 colours, 20 jobs and 8 landscapes, and a
tiny hat always goes on top of the hair, however tall the hair is.

## Sound

There are three kinds of sound, all recorded, none synthesized in the page: Cobb's voice, the brush, and
a theme. (When they can start is the browser's decision; see Starting, above.)

### What the real programme sounds like

One episode of *The Joy of Painting* (season 29, episode 1) was pulled apart to find out. Its captions
say when he criss-crosses, taps, scrapes, washes and beats the brush; spectrograms of those seconds, and
onset counts on them, give the first column. The second is the same measurement made on a recording of
what this page plays (`npm run qa:sound`).

| | on the programme | this page, recorded and measured |
|---|---|---|
| Beating the brush on the easel | 22 strikes in 1.95 s, one every 88 ms, gaps 80 to 110 ms; each a 40 ms crack over a low thump | 22 strikes in 1.86 s, one every 88 ms, gaps 86 to 92 ms; each 26 ms |
| Tapping (foliage) | one every 195 ms (5.1 a second); each a 60 ms thud | one every 180 ms (5.6 a second); each 30 ms |
| Criss-cross strokes | a soft bright hiss pulsing 4 to 5 times a second, about 200 ms each | 5.2 a second, about 145 ms each |
| Knife | scrapes of 0.15 to 0.25 s, in bursts | about 2 a second, 0.2 s each |
| His voice | pitch about 102 Hz (75 to 160), 165 words a minute | pitch 96 Hz (74 to 125 across lines), 159 words a minute |

The audio of that episode was used for measuring only. Nothing from it is in this repository or on the
site.

Those numbers changed the painting as well as the sound: the brush used to tap thirty times a second
and criss-cross twenty. `src/painter.js` now plans fewer, larger strokes so that the hand moves at the
pace of a hand, and announces every stroke and every tap so each one is heard as it lands. The beating
is laid out on the audio clock, not the picture's, so it is even however the picture is keeping up.

### Cobb's voice

Every line Cobb says is recorded ahead of time by ElevenLabs (`eleven_v3`, with the direction
`[softly]`), and the page plays the recordings. That only works if the set of lines is finite, so
`src/script.js` allows a line one blank and never two; `src/lines.js` lists every sentence that can come
out (400 of them, about 25,000 characters) and gives each a name derived from its words.

The voice was chosen by measurement, since the machine that built this cannot hear: the free sample of
every male voice on the account was measured for pitch, and "Brian" (98 Hz, ranging 80 to 163) sits
closest to the real host (102 Hz, 75 to 160).

**What is recorded so far: 70 of 403 lines.** That is three episodes complete (2218 Mason the Mail
Carrier, 4703 Pearl the Rock Star, 3262 Stoney the Ballerina, chosen from 5,000 as the three most
different episodes that share the most lines), plus four lines that will do for any haircut, any hat,
anything held, and any friend. It took all of a free ElevenLabs month. The other 333 lines need about
21,000 more characters.

Until they are recorded, Cobb says only what he has a recording of, and the episode is written round that
(`writeEpisode` in `src/show.js`):

- Where the line an episode would have used is not recorded, he says another from the same list that is
  (there are several greetings, several ways of saying "now the eyes"; one of each is recorded).
- For a haircut, a hat or a thing to hold with no line of its own yet, he says the one that does for any.
- Nobody chooses the Pebble's name or the landscape, so those are taken from the three he can talk about.
- What is left with nothing to say (a joke about being a pirate, say) is left out, and he paints that part
  quietly, as he sometimes does anyway.

So a request for any of the 20 jobs, 17 haircuts, 15 colours and 8 shapes is spoken from hello to
goodbye: 25 to 32 lines, talking for about 70% of the running time, the same as a fully recorded episode.
What it lacks, until the rest is recorded, is the jokes particular to that job and haircut. They are all
there in the captions when the sound is off, which is the only time anything is shown that is not said.

- With the sound on, Next goes round the three complete episodes.
- With the sound off there is nothing to miss, so Next is simply another Pebble.

```sh
npm run voice -- --dry          # the list and the character count; needs no key
npm run voice -- --episodes     # the episodes in assets-src/voice/episodes.json, one at a time
npm run voice -- --match "hats go|something to hold"   # only lines matching this
npm run voice                   # everything that is missing, most-heard lines first
```

`scripts/voice.mjs` reads `ELEVENLABS_API_KEY` from the environment or from a `.env` file beside
`package.json` (ignored by git and by Vercel; the key is never printed and never reaches the browser).
It checks what the account has left and stops before the credit runs out; what it has recorded is kept
in `assets-src/voice/`, so running it again costs nothing for lines already done. It asks for character
timings with each recording and compares what was spoken with what was written, so a line the voice
garbled is reported and not shipped. Each recording is trimmed and levelled with ffmpeg into
`public/voice/<id>.mp3`, and its length goes into `public/voice/manifest.json` with the list of complete
episodes. The show times itself to those lengths: a beat lasts as long as its lines take to say.
`node scripts/episode-lines.mjs` lists what any episode says and what it would cost.

### Effects

`scripts/sfx.mjs` asks ElevenLabs' sound generation for each effect as one event (one stroke, one tap,
one strike), several takes of each, described from the measurements above: twenty clips in all, and a
ten-second theme. The page plays one clip per stroke, tap and strike, shaped to the time the stroke
takes.

A tap and a strike have to be exactly right, so those are cut by hand in the script, sample by sample:
the blow is moved to the very start of the clip, faded out within 75 ms (130 for a tap), brought to the
same loudness as the other takes, and kept as an uncompressed WAV, since an encoder would smear the
attack. A take that is not one short blow is thrown away (three were).

```sh
npm run sfx -- --dry
npm run sfx                     # needs a key with the sound_generation permission
```

`src/audio.js` still holds a stand-in for each effect, built from filtered noise, which plays only if a
clip has not arrived yet.

### Checking sound without ears

`npm run qa:sound` turns the sound on in a real browser, records what the page actually plays, and
measures the recording the same way the programme was measured: how many strikes in a beating and how
far apart, how fast the taps and strokes come and how long each lasts, whether a voice is heard for as
long as the recorded lines run, whether there is music under the title, and, on a first visit, how long
after the one click the programme is running and heard (about 0.4 s). Recordings and their
spectrograms go to `qa/audio/`.

## How the rest was made

**Research.** Nine episodes of *The Joy of Painting* (seasons 1, 10, 29, 30 and 31), read frame by
frame in Chrome from YouTube's storyboard sheets, one frame every ten seconds: about 1,500 frames. That
is where the shot list comes from (wide, close on the canvas with the hand coming in from below, the
palette, the easel-side angle), the yellow colour names one at a time, the lower-case white and
upper-case yellow of the credits, the black studio and the hair light.

**Codex, with its imagegen skill**, painted the eight landscapes (`public/plates/`) and the title card.
The briefs are in `scripts/codex-plates.md` and `scripts/codex-title.md`; the title card was painted
from a Blender render of Cobb passed in as a reference. Originals are in `assets-src/`.

**Blender, from the command line**, builds Cobb and his studio: `blender/build_set.py` makes every mesh
(body, afro, beard, eyebrows, collar, easel, palette with thirteen blobs of paint, two brushes, a knife
and a bucket of thinner) in code, colours the vertices, and exports `public/models/set.glb` with a small JSON of anchor
points. Given a second argument it also renders a portrait with Cycles.

```sh
npm run model        # rebuild public/models/set.glb
```

**The Pebbles he paints** are drawn in code (`src/pebble.js`), in the flat two-tone style of
Turnstone's own: a body, a darker crescent down one side, two dots for eyes, tube arms, oval feet.

## How the painting works

Nothing is faded or wiped in. Each part of the picture exists finished, off screen: a band of the
landscape, or one part of the Pebble drawn on a clear layer. `src/painter.js` plans strokes over the
part (rows, columns, criss-crosses, knife pulls, taps), gives every point on them a time, and as the
clock passes each point it stamps a bristle-shaped mask there and lets the finished image through the
mask. Where the latest stamp is, is where the tip of Cobb's brush is, so the 3D arm (`src/stage.js`)
simply follows it. A landscape band is done twice, once from a blurred copy and once from the sharp
one, which reads as blocking in and then detail. Whatever the strokes miss settles in over the last
moments of the part.

A camera in `src/stage.js` is not a position but a thing to keep in frame: each shot names a centre, a
direction to look from and a box that must fit, and the distance follows from the shape of the window.

`src/show.js` is the director: it writes the episode (which lines, which shots, how long), then runs it
beat by beat. An episode number seeds everything, so the same number is always the same episode.

## Code map

```
index.html           the picture, the strip of controls, the request sheet
src/main.js          boot, the frame loop, sound on first touch, the controls and keys
src/show.js          writes and runs an episode
src/script.js        everything Cobb says
src/lines.js         every sentence that can come out of script.js, and the name of its recording
src/data.js          kinds, colours, haircuts, jobs, names, landscapes
src/pebble.js        draws any Pebble, part by part
src/painter.js       the canvas and the brush
src/stage.js         the 3D studio, the cameras, Cobb's arms
src/vhs.js           the tape shader
src/ui.js            captions, colour names, title card, credits, read-outs
src/audio.js         voice, effect clips, and their stand-ins
src/mail.js          Viewer Mail
src/sheet.js, sheet.html   a contact sheet of Pebbles for checking the drawing (dev only)
blender/build_set.py the studio's source
scripts/             voice.mjs, sfx.mjs, episode-lines.mjs, Codex briefs, QA
```

## Develop

```sh
npm install
npm run dev -- --port 5191
npm run build
```

## Files a browser keeps

The studio, the landscapes and the sounds live in `public/`, keep their names from one build to the next,
and are served with leave to keep them for a day. So a returning visitor's browser can hold yesterday's
copy of one beside today's code. That once left the live page on static for good: the code had learned
about the bucket, the cached studio file had not. Now every such file is asked for as `file?v=stamp`,
where the stamp is made from the contents of its folder (`vite.config.js`, `src/asset.js`); a studio file
without something the code knows about is tolerated; and if the page cannot start it says NO SIGNAL in
the middle of the screen with a way to try again, where before it said it under the controls.

## QA

```sh
npm run dev -- --port 5191 &
npm run qa                                           # layout, episodes, a returning visitor, and the rest below
npm run qa:sound                                     # listens to the page and measures what it hears
npm run qa:features                                  # every feature, used the way a person uses it, in real time
BASE=https://joy-of-pebbling.vercel.app npm run qa   # any of them against the live site
```

`scripts/qa-features.mjs` goes through the page as a visitor would, with real clicks, taps and keys, in
real time, in a browser that keeps its cache and will not play sound until it is clicked, recording what
comes out of the speakers: starting; Cobb speaking and the caption matching; painting; Pause by button,
click and key; each speed, timed; sound off and on; Next; the Request sheet opened, closed, surprised,
sent, and the requested episode heard and painted; Keep; every key; the credits and the next episode
starting by itself; the window changing shape; a link to one episode; a second visit; a phone by touch;
Safari's engine. One line of output per feature.

`scripts/qa.mjs` drives the real page with Playwright:

- **Layout, at thirteen window sizes** from a 320-wide phone to an ultrawide monitor, upright and on its
  side, by mouse and by touch, in a browser that will not play sound until it is touched (a first visit):
  the page never scrolls; the picture fills the window exactly; it waits on its title card behind a play
  button that is on screen, large, and clear of the title, and the programme does not run meanwhile; one
  click or tap anywhere starts it from the top with the sound on; the controls come when called, are all
  on screen, at least 44 by 44, apart, unclipped, in at most two rows, and go away again; captions,
  colour names, name caption and credits are on screen and off each other; upright windows get the
  two-part picture and both parts have something in them (pixels read back from WebGL); when he washes
  the brush the bucket is in the picture and the brush is in the bucket. Then it presses everything:
  pause really stops the tape, speed changes, sound goes off and on, a click on the picture pauses, Next
  starts the next recorded episode, a Viewer Mail request fits the window and is honoured exactly, and
  the address is left clean throughout.
- **A browser that allows sound untouched**: the programme starts by itself, with sound, on an episode
  Cobb has recorded, no button shown, the address untouched.
- **A returning visitor, and other misfortunes**: every file a browser may keep is asked for by a stamped
  address; a studio file from before the bucket still runs; when the studio cannot be fetched the page
  says so with a way to retry; clicks and keys while it is still loading break nothing.
- **Twenty whole episodes, and every recorded one**, start to finish: each reaches its credits, has
  paint on at least 90% of the canvas, runs between 110 and 260 seconds, has no unfilled blank or
  "a astronaut" in any line, says nothing that is not on the recording list, and rolls on to another
  episode by itself. An episode listed as complete has a recording for every line.
- **The pace of the brush**, counted over four episodes and held against the programme's.
- **900 Pebbles** drawn outright (every kind with the tallest hair under the tallest hats, every job
  with every haircut, every kind with every job) and measured: none touches the edge of the canvas.
- **WebKit**, at a desktop and a phone size, for Safari.

Screenshots go to `qa/shots/`.
