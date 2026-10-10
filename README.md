# The Joy of Pebbling, with Cobb Moss

A wood-panel television that only gets one channel. On it, a blue [Turnstone](https://myturnstone.ai)
Pebble with an enormous afro stands at an easel and paints, stroke by stroke, while you watch: first a
landscape, then a happy little Pebble to live in it. Every episode is a different Pebble: a different
kind, colour, haircut and job. When he has signed it, the credits roll and the next one starts.

A fan-made parody. Not affiliated with Bob Ross Inc., PBS or Turnstone.

## What is on the page

- **The picture.** Always 4:3, as big as the window allows. Cobb, his easel, his palette and his brushes
  are a 3D scene; the canvas on the easel is a real canvas that gets painted in real time. The whole
  thing is rendered small and pushed through a worn-tape shader: colour that smears sideways, a tear
  along the bottom, scan lines, the bulge of a glass tube.
- **What the station lays over it.** Closed captions (white capitals on black), each paint's name in
  yellow as he first reaches for it, his name when he says hello, the credits, and the VCR's own
  read-out in the corners.
- **The control panel.** Pause, Speed (1, 2, 4, 8 times: fast-forward, with the bars), Next Pebble,
  Sound, Voice (the browser reads his lines aloud), Keep It (downloads the painting as a PNG), and
  Viewer Mail, where you write in and ask for a particular Pebble. On a phone held upright the panel
  sits under the picture and the captions move into it.
- **The address** carries the episode number (`?ep=427`) and any request, so a Pebble can be sent to a
  friend and will be painted the same way again.

Keys: space pauses, `f` changes speed, `n` or the right arrow is the next Pebble, `m` is sound.

## An episode

Title card, hello, then the landscape from the top down. Each band of it (sky, mountain, water, ground)
is blocked in soft with the big brush and then gone over with its own tool: criss-crosses for sky, the
knife for a mountain, taps for foliage. Then he washes the brush and beats it dry on the leg of the
easel. Then the Pebble: shadow, feet, body, the dark side, clothes, arms, hair, hat, eyes, whatever he
holds. Sometimes he drops some paint, which is not a mistake, and which becomes a second, smaller
Pebble before the end. He signs it in red. About two and a quarter minutes at normal speed.

There are 8 kinds of Pebble, 15 colours, 17 haircuts in 11 colours, 20 jobs and 8 landscapes, and a
tiny hat always goes on top of the hair, however tall the hair is.

## How it was made

**Research.** Nine episodes of *The Joy of Painting* (seasons 1, 10, 29, 30 and 31), read frame by
frame in Chrome from YouTube's storyboard sheets, one frame every ten seconds: about 1,500 frames. That
is where the shot list comes from (wide, close on the canvas with the hand coming in from below, the
palette, the easel-side angle), the yellow colour names one at a time, the lower-case white and
upper-case yellow of the credits, the black studio and the hair light.

**Codex, with its imagegen skill**, painted the eight landscapes (`public/plates/`), the walnut veneer of
the cabinet and the title card. The briefs are in `scripts/codex-plates.md` and
`scripts/codex-title.md`; the title card was painted from a Blender render of Cobb passed in as a
reference. Originals are in `assets-src/`.

**Blender, from the command line**, builds Cobb and his studio: `blender/build_set.py` makes every mesh
(body, afro, beard, eyebrows, collar, easel, palette with thirteen blobs of paint, two brushes and a
knife) in code, colours the vertices, and exports `public/models/set.glb` with a small JSON of anchor
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
one, which reads as blocking in and then detail.

`src/show.js` is the director: it writes the episode (which lines, which shots, how long), then runs it
beat by beat. An episode number seeds everything, so the same number is always the same episode.

## Code map

```
index.html           the cabinet, the panel, the request sheet
src/main.js          boot, the frame loop, the buttons and keys
src/show.js          writes and runs an episode
src/script.js        everything Cobb says
src/data.js          kinds, colours, haircuts, jobs, names, landscapes
src/pebble.js        draws any Pebble, part by part
src/painter.js       the canvas and the brush
src/stage.js         the 3D studio, the cameras, Cobb's arms
src/vhs.js           the tape shader
src/ui.js            captions, colour names, credits, read-outs
src/audio.js         tape hiss, brush, the beating of the brush, a few chords; speech
src/mail.js          Viewer Mail
src/sheet.js, sheet.html   a contact sheet of Pebbles for checking the drawing (dev only)
blender/build_set.py the studio's source
scripts/             Codex briefs, QA, screenshot helpers
```

## Develop

```sh
npm install
npm run dev -- --port 5191
npm run build
```

## QA

```sh
npm run dev -- --port 5191 &
npm run qa                                  # everything
BASE=https://joy-of-pebbling.vercel.app npm run qa   # the live site
```

`scripts/qa.mjs` drives the real page with Playwright:

- **Layout, at thirteen window sizes** from a 320-wide phone to an ultrawide monitor, upright and on its
  side: the page never scrolls; the picture is 4:3 to within 1%; the television and the panel are fully
  on screen and apart; every key is inside the panel, at least 44 by 40, apart from the others, with its
  label unclipped; the title card, captions, colour names, name caption and credits are inside the
  picture and off each other; the studio picture and the canvas close-up are not blank (pixels read
  back from WebGL). Then it presses everything: pause really stops the tape, speed changes, sound
  starts, Next Pebble starts the next episode and the address follows, a Viewer Mail request fits the
  window, is honoured exactly and lands in the address.
- **Twenty whole episodes**, start to finish: each reaches its credits, has paint on at least 90% of the
  canvas, runs between 90 and 200 seconds, has no unfilled blank or "a astronaut" in any line, and rolls
  on to the next episode by itself.
- **900 Pebbles** drawn outright (every kind with the tallest hair under the tallest hats, every job
  with every haircut, every kind with every job) and measured: none touches the edge of the canvas.
- **WebKit**, at a desktop and a phone size, for Safari.

Screenshots go to `qa/shots/`.
