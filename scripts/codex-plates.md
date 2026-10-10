Use the imagegen skill (the built-in `image_gen` tool, NOT the CLI fallback) to make the raster assets below
for this project, a parody TV painting show website. Work in this directory.

Issue ONE built-in `image_gen` call per asset (9 assets, 9 calls). After each call, copy the generated file
out of `$CODEX_HOME/generated_images/...` into `assets-src/` under the exact filename given (keep the PNG the
tool produced; do not resize, recompress or edit it). Create `assets-src/` if it is missing. Do not touch any
other file in the project. Do not write code. When all nine exist, print one line per asset:
`<filename> <width>x<height>` and stop.

If a result clearly breaks a constraint (there is a figure, text, a signature, a picture frame or an easel in
it, or the foreground centre is blocked by a tree or rock), regenerate that one asset once.

## Assets 1-8: landscape "plates" (landscape orientation, the widest landscape size the tool offers)

Shared spec for all eight:

```
Use case: illustration-story
Asset type: full-bleed background painting for a website; a cartoon character will be painted on top of it later
Style/medium: traditional wet-on-wet oil painting on canvas, in the manner of a 1980s public-television
  painting lesson: soft blended sky done with a big 2-inch brush, palette-knife mountains with broken
  highlights, fan-brush evergreens, tapped-in bushes with bright highlights, visible bristle strokes and
  thick impasto touches. Slightly naive, cheerful, completely sincere.
Composition/framing: the painting fills the whole image edge to edge. Horizon a little above the middle.
  The bottom third is a broad, simple, fairly flat foreground that runs the full width. The centre of that
  foreground is OPEN and EMPTY (nothing taller than short grass) because a character will stand there.
  Tall things (trees, cliffs, a cabin) sit only towards the far left and far right edges or in the distance.
Lighting/mood: calm, gentle, nostalgic
Constraints: no people, no animals, no characters, no text, no signature, no watermark, no picture frame,
  no easel, no border, no canvas edge, no vignette oval. It is the painting itself, not a photo of a painting.
```

1. `assets-src/plate-gravelmore.png`
   Scene: a majestic snow-capped mountain under a bright blue sky with a few fluffy white clouds; misty blue
   evergreen foothills; a calm mirror lake in the middle distance; foreground is a soft green grassy bank
   with small bushes at the far sides and one or two tall dark evergreens at the far left edge.
   Palette: phthalo blue, titanium white, prussian blue, sap green, a touch of cadmium yellow.

2. `assets-src/plate-sundown.png`
   Scene: a glowing sunset, the sun low and small near the horizon, sky blending from warm yellow through
   orange and pink to deep violet at the top corners; a dark silhouetted distant tree line; still water
   reflecting the glow; foreground is a dark earthy shore with soft grasses, a leaning bare tree at the
   far right edge.
   Palette: cadmium yellow, yellow ochre, bright red, alizarin crimson, van dyke brown, midnight black.

3. `assets-src/plate-hollow.png`
   Scene: a misty deep-green forest glade, pale hazy light glowing between layered tree trunks in the
   distance; a small waterfall and stream tucked in the middle distance on the left; foreground is a mossy
   green clearing floor with ferns only at the far edges.
   Palette: sap green, phthalo green, cadmium yellow, van dyke brown, titanium white.

4. `assets-src/plate-winter.png`
   Scene: a quiet winter dusk, soft pink and lavender sky; rolling snow; a small snow-roofed log cabin
   in the middle distance at the left with one warm lit window; frosty evergreens at the far right;
   foreground is a smooth snowbank with gentle blue shadows.
   Palette: titanium white, alizarin crimson, phthalo blue, prussian blue, van dyke brown.

5. `assets-src/plate-autumn.png`
   Scene: golden autumn woods with orange, red and yellow foliage at left and right; a pale hazy sky and
   soft distant trees; a wide pale dirt path that fills the foreground and narrows into the distance.
   Palette: indian yellow, cadmium yellow, bright red, dark sienna, van dyke brown, sap green.

6. `assets-src/plate-seaside.png`
   Scene: a seascape, a turquoise wave with a translucent curl and white foam crashing in the middle
   distance; a dramatic sky with pink-tinted clouds; a dark rocky headland at the far left; foreground is a
   wet sandy beach reflecting the sky with a few tiny scattered stones near the edges.
   Palette: phthalo blue, phthalo green, titanium white, alizarin crimson, dark sienna, yellow ochre.

7. `assets-src/plate-aurora.png`
   Scene: a night scene painted on a black canvas: deep indigo sky with vivid green and violet northern
   lights in soft vertical ribbons and a few stars; dark mountain silhouettes; a frozen lake faintly
   reflecting the lights; dark evergreens at the far right edge; foreground is a moonlit blue snowfield.
   Palette: midnight black, prussian blue, phthalo green, titanium white, alizarin crimson.

8. `assets-src/plate-mesa.png`
   Scene: a desert at golden hour, red sandstone mesas and buttes in the distance; a warm peach and gold
   sky with long streaky clouds; scattered sagebrush; a single saguaro cactus at the far left edge;
   foreground is a flat sandy desert floor with soft purple shadows.
   Palette: indian yellow, yellow ochre, bright red, dark sienna, alizarin crimson, titanium white.

## Asset 9: wood veneer (square)

9. `assets-src/wood-walnut.png`
```
Use case: product-mockup
Asset type: seamless tileable background texture for the cabinet of a 1970s wood-panel television set
Primary request: a flat, evenly lit, straight-on scan of dark walnut wood veneer with horizontal grain,
  slightly glossy lacquer, warm brown, fine pores, subtle variation, no knots
Composition/framing: texture fills the whole square image, grain running left to right, tileable edges
Constraints: no objects, no shadows, no vignette, no text, no logos, no seams or panel joints
```
