// The tape. Takes the studio picture and does to it what thirty years in a cardboard sleeve does:
// colour that smears sideways, lines that do not quite line up, a tear along the bottom where the
// heads switch, grain, a little darkness in the corners. `ff` adds the bars of fast-forward; `glitch`
// is the burst of snow between episodes; `seam` is where an upright picture is cut in two.
export const VHS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

export const VHS_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 res;
uniform float time;
uniform float ff;
uniform float glitch;
uniform float lines;
uniform float fade;
uniform float seam;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 studio(vec2 uv) {
  return texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
}

void main() {
  vec2 uv = vUv;
  vec2 p = vUv - 0.5;
  float r2 = dot(p, p);

  float row = floor(uv.y * 262.0);
  float tick = floor(time * 30.0);

  // between episodes the picture loses its hold and rolls
  uv.y = fract(uv.y + glitch * glitch * 0.6 * sin(time * 3.0));

  // every line starts a hair early or late
  float jit = (hash(vec2(row, tick)) - 0.5) * (0.0009 + 0.02 * glitch + 0.004 * ff);
  jit += 0.0005 * sin(uv.y * 21.0 + time * 1.7);
  // head-switching tear along the bottom edge
  float tear = smoothstep(0.016, 0.0, uv.y);
  jit += tear * (0.03 + 0.02 * sin(time * 31.0 + uv.y * 500.0));
  // fast-forward: bars of torn picture climbing the screen
  float bar = 0.0;
  if (ff > 0.01) {
    float b = fract(uv.y * 2.3 + time * 0.9);
    bar = smoothstep(0.80, 0.86, b) * smoothstep(1.0, 0.94, b) * ff;
    jit += bar * (hash(vec2(row, tick + 3.0)) - 0.5) * 0.09;
  }
  uv.x += jit;

  vec2 px = vec2(1.0 / res.x, 0.0);
  vec3 c0 = studio(uv);
  vec3 cl = studio(uv - px * 1.6);
  vec3 cr = studio(uv + px * 1.6);
  // brightness keeps most of its detail; colour is a blur dragged to the right
  const vec3 W = vec3(0.299, 0.587, 0.114);
  float y = dot(c0, W) * 0.56 + dot(cl, W) * 0.22 + dot(cr, W) * 0.22;
  y += (dot(c0, W) - (dot(cl, W) + dot(cr, W)) * 0.5) * 0.4;
  vec3 ch = (cl + c0 + studio(uv - px * 3.6) + studio(uv - px * 6.0) + studio(uv - px * 8.5)) / 5.0;
  vec3 chroma = ch - dot(ch, W);
  vec3 col = vec3(y) + chroma * 1.12;

  // out of the studio's light and into a signal: soft shoulder, then gamma
  col = max(col, 0.0);
  col = 1.0 - exp(-col * 1.35);
  col = pow(col, vec3(1.0 / 2.2));
  // an old tape: blacks that are not black, a warm cast
  col = col * 0.94 + 0.03;
  col *= vec3(1.035, 1.0, 0.94);

  // grain, and the odd dropout streak
  float g = hash(uv * res + vec2(tick * 1.7, tick));
  col += (g - 0.5) * (0.05 + 0.25 * bar + 0.1 * tear);
  float drop = step(0.9988 - 0.01 * ff, hash(vec2(row * 1.3, tick * 0.7)));
  float dx = hash(vec2(tick, row));
  col += drop * smoothstep(0.0, 0.02, uv.x - dx) * smoothstep(0.22, 0.0, uv.x - dx) * 0.45;
  col = mix(col, vec3(g), bar * 0.45);

  // snow
  float snow = hash(uv * res * 0.7 + tick * 3.1);
  col = mix(col, vec3(snow * 0.9 + 0.05), clamp(glitch * 1.3, 0.0, 1.0));

  // the line between the two halves of an upright picture
  if (seam > 0.0) col *= smoothstep(0.0, 0.0022, abs(vUv.y - seam));

  // scan lines, and the corners a little darker
  col *= 0.95 + 0.05 * cos(vUv.y * lines * 6.2831853);
  col *= 1.0 - 0.34 * r2;
  gl_FragColor = vec4(col * fade, 1.0);
}`
