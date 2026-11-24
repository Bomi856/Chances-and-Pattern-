import { SketchMode } from '../types/studio';

export interface TutorialLessonContent {
  lessonId: string;
  orderIndex: number;
  title: string;
  summary: string;
  mode: SketchMode;
  sections: {
    heading: string;
    body: string;
  }[];
  experiments: string[];
  codeExample: string;
}

export const TUTORIAL_CURRICULUM: TutorialLessonContent[] = [
  {
    lessonId: 'lesson-01-uv-coordinates',
    orderIndex: 1,
    title: '01. Normalized UV Space & Aspect Ratio',
    summary:
      'Turn raw pixel coordinates into centered, distortion-free math space so shapes stay crisp across any resolution.',
    mode: 'glsl',
    sections: [
      {
        heading: 'Centering Coordinates Around (0, 0)',
        body: 'Inside a fragment shader, vTexCoord runs from 0.0 to 1.0 across the canvas. Multiplying by 2.0 and subtracting 1.0 shifts the range to [-1.0, +1.0], placing (0.0, 0.0) dead center so radial symmetry and distance math become effortless.',
      },
      {
        heading: 'Preventing Stretching with iResolution',
        body: 'Because screens are rarely square, multiplying uv.x by (iResolution.x / iResolution.y) corrects horizontal scale. Without this line, a circle turns into an ellipse whenever you switch between 1080×1080 and 1920×1080.',
      },
    ],
    experiments: [
      'Comment out `uv.x *= iResolution.x / iResolution.y;` and watch the ring stretch when changing aspect ratios.',
      'Multiply `uv` by `2.5` instead of `1.0` to zoom out and reveal the full coordinate field.',
    ],
    codeExample: `#ifdef GL_ES
precision highp float;
#endif

uniform vec2 iResolution;
uniform float iTime;
varying vec2 vTexCoord;

void main() {
  // Step 1: Remap [0, 1] -> [-1, 1]
  vec2 uv = vTexCoord * 2.0 - 1.0;

  // Step 2: Correct aspect ratio so circles stay round
  uv.x *= iResolution.x / iResolution.y;

  // Step 3: Distance from center (0, 0)
  float d = length(uv);
  float ring = smoothstep(0.02, 0.0, abs(d - (0.45 + 0.1 * sin(iTime))));

  vec3 bg = vec3(abs(uv.x) * 0.15, abs(uv.y) * 0.15, 0.12);
  vec3 col = mix(bg, vec3(0.95, 0.78, 0.35), ring);

  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    lessonId: 'lesson-02-signed-distance-fields',
    orderIndex: 2,
    title: '02. Signed Distance Functions (Rhombus, Hexagram, Circle)',
    summary:
      'Use exact mathematical distance functions to draw, outline, and morph geometric primitives without polygons.',
    mode: 'glsl',
    sections: [
      {
        heading: 'What a Signed Distance Value Means',
        body: 'An SDF takes any point p and returns the shortest distance to a shape boundary: negative inside, 0.0 right on the edge, and positive outside. Wrapping that distance in abs(d) turns the solid shape into a crisp hollow contour.',
      },
      {
        heading: 'Morphing Between Shapes with mix()',
        body: 'Because every SDF outputs a single scalar float, you can smoothly morph a Rhombus into a Hexagram or Circle by interpolating their distances with mix(dA, dB, t).',
      },
    ],
    experiments: [
      'Replace `mix(dRhombus, dHexagram, t)` with `min(dRhombus, dHexagram)` to create a boolean union.',
      'Add `sin(d * 24.0 - iTime * 2.0)` to turn the single edge into concentric contour ripples.',
    ],
    codeExample: `#ifdef GL_ES
precision highp float;
#endif

uniform vec2 iResolution;
uniform float iTime;
varying vec2 vTexCoord;

float ndot(vec2 a, vec2 b) { return a.x * b.x - a.y * b.y; }

float sdRhombus(in vec2 p, in vec2 b) {
  p = abs(p);
  float h = clamp(ndot(b - 2.0 * p, b) / dot(b, b), -1.0, 1.0);
  float d = length(p - 0.5 * b * vec2(1.0 - h, 1.0 + h));
  return d * sign(p.x * b.y + p.y * b.x - b.x * b.y);
}

float sdHexagram(in vec2 p, in float r) {
  const vec4 k = vec4(-0.5, 0.8660254, 0.5773503, 1.7320508);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= 2.0 * min(dot(k.yx, p), 0.0) * k.yx;
  p -= vec2(clamp(p.x, r * k.z, r * k.w), r);
  return length(p) * sign(p.y);
}

void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;

  float dR = sdRhombus(uv, vec2(0.55, 0.35));
  float dH = sdHexagram(uv, 0.32);

  // Morph smoothly between Rhombus and Hexagram
  float d = mix(dR, dH, 0.5 + 0.5 * sin(iTime * 0.8));

  // Concentric contour lines + bright zero boundary
  float ripples = abs(sin(d * 18.0 - iTime * 1.5)) / 18.0;
  float glow = 0.008 / max(ripples, 0.001);
  vec3 col = vec3(0.95, 0.72, 0.32) * glow * 0.5;

  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    lessonId: 'lesson-03-fractal-folding',
    orderIndex: 3,
    title: '03. Space Folding & Fractal Octaves',
    summary:
      'Repeat and subdivide UV space recursively using fract() while preserving global symmetry with uv0.',
    mode: 'glsl',
    sections: [
      {
        heading: 'Saving uv0 Before Folding',
        body: 'Storing vec2 uv0 = uv; before the loop keeps a reference to the un-folded screen coordinate. Inside the loop, uv = fract(uv * 1.5) - 0.5; splits space into repeating sub-cells while exp(-length(uv0)) anchors the overall energy to the center.',
      },
      {
        heading: 'Why Non-Integer Multipliers Like 1.5 Work Magic',
        body: 'Multiplying by 2.0 aligns grids cleanly; multiplying by 1.5 offsets successive octaves out of phase, creating intricate overlapping interference lattices instead of rigid checkerboards.',
      },
    ],
    experiments: [
      'Change `1.5` to `1.618` (golden ratio) or `2.0` to see how tiling symmetry changes.',
      'Increase the loop limit from `4.0` to `6.0` for deeper fractal detail.',
    ],
    codeExample: `#ifdef GL_ES
precision highp float;
#endif

uniform vec2 iResolution;
uniform float iTime;
varying vec2 vTexCoord;

void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;
  vec2 uv0 = uv; // Keep original coordinates

  vec3 acc = vec3(0.0);
  for (float i = 0.0; i < 4.0; i++) {
    uv = fract(uv * 1.5) - 0.5;
    float d = length(uv) * exp(-length(uv0));
    d = abs(sin(d * 8.0 + iTime * 0.6) / 8.0);
    float line = pow(0.009 / max(d, 0.0012), 1.2);
    acc += vec3(0.35 + i * 0.18, 0.65, 0.95 - i * 0.15) * line;
  }

  gl_FragColor = vec4(acc, 1.0);
}`,
  },
  {
    lessonId: 'lesson-04-cosine-palettes',
    orderIndex: 4,
    title: '04. Cosine Color Palettes & Reciprocal Glow',
    summary:
      'Craft rich harmonic gradients from four vec3 constants and amplify thin contour lines with pow(0.01 / d, gamma).',
    mode: 'glsl',
    sections: [
      {
        heading: 'Iñigo Quilez Cosine Gradients',
        body: 'The formula a + b * cos(6.28318 * (c * t + d)) generates smooth, cyclical RGB spectra using only four vec3 parameters: offset (a), amplitude (b), frequency (c), and phase shift (d). Swapping d alone completely transforms the mood.',
      },
      {
        heading: 'Why 0.01 / abs(d) Creates Neon Filaments',
        body: 'Dividing a tiny constant by distance shoots toward infinity right at d = 0 and drops off smoothly away from the edge. Raising it to pow(..., 1.2) sharpens the core filament and prevents muddy haze.',
      },
    ],
    experiments: [
      'Adjust `vec3 d = vec3(0.263, 0.416, 0.557);` to `(0.0, 0.33, 0.67)` for a classic full spectrum.',
      'Compare `max(abs(d), 0.001)` vs `max(abs(tan(d)), 0.001)` to see how tangent spikes sharpen peaks.',
    ],
    codeExample: `#ifdef GL_ES
precision highp float;
#endif

uniform vec2 iResolution;
uniform float iTime;
varying vec2 vTexCoord;

vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.263, 0.416, 0.557);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;

  float d = abs(sin(length(uv) * 7.0 - iTime * 0.9) / 7.0);
  float intensity = pow(0.012 / max(d, 0.0015), 1.25);

  vec3 col = palette(length(uv) * 0.4 + iTime * 0.15) * intensity;
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    lessonId: 'lesson-05-cellular-agents',
    orderIndex: 5,
    title: '05. Accumulative 2D Cellular Webs',
    summary:
      'Grow organic honeycomb and fungal filament structures over minutes by steering walkers along noise-warped ridge fields.',
    mode: 'p5js',
    sections: [
      {
        heading: 'Do Not Clear the Canvas Every Frame',
        body: 'Unlike shaders that recompute every pixel from scratch each frame, accumulative 2D generative art calls background(0) only once in setup(). Each frame draws faint semi-transparent strokes (alpha 10–40) that weave layers over time.',
      },
      {
        heading: 'Sensor Steering Along Ridge Minima',
        body: 'Give each agent three virtual feelers (left, center, right) sampling a domain-warped trigonometric ridge field. Steering toward the lowest ridge value locks walkers onto curving cellular membranes while leaving dark cavities open.',
      },
    ],
    experiments: [
      'Change `s = 0.005` in `field(x, y)` to `0.012` for tighter, smaller cellular pores.',
      'Use Fast-Forward `+360f` in the Evolution tab to preview how the web thickens over time.',
    ],
    codeExample: `let walkers = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  background(0);
  for (let i = 0; i < 180; i++) {
    walkers.push({
      x: random(width),
      y: random(height),
      a: random(TWO_PI),
    });
  }
}

function ridge(x, y, t) {
  const s = 0.005;
  const wx = noise(x * s, y * s, t * 0.02) * 2.0;
  const wy = noise(x * s + 19.3, y * s, t * 0.02) * 2.0;
  return abs(sin((x * s + wx) * 4.0) + cos((y * s + wy) * 4.0));
}

function draw() {
  const t = millis() / 1000.0;
  for (const w of walkers) {
    const px = w.x;
    const py = w.y;
    const look = 8;
    const vC = ridge(w.x + cos(w.a) * look, w.y + sin(w.a) * look, t);
    const vL = ridge(w.x + cos(w.a - 0.5) * look, w.y + sin(w.a - 0.5) * look, t);
    const vR = ridge(w.x + cos(w.a + 0.5) * look, w.y + sin(w.a + 0.5) * look, t);

    if (vL < vC && vL < vR) w.a -= 0.22;
    else if (vR < vC && vR < vL) w.a += 0.22;

    w.x = (w.x + cos(w.a) * 1.6 + width) % width;
    w.y = (w.y + sin(w.a) * 1.6 + height) % height;

    if (dist(px, py, w.x, w.y) < 10) {
      stroke(255, 36);
      strokeWeight(0.9);
      line(px, py, w.x, w.y);
    }
  }
}`,
  },
  {
    lessonId: 'lesson-06-long-exposure-workflow',
    orderIndex: 6,
    title: '06. Designing Long-Exposure Patterns & Timestamp Studies',
    summary:
      'Calibrate slow drift rates and scheduled screenshot milestones so your pattern has distinct visual chapters from 5s to 1h.',
    mode: 'p5js',
    sections: [
      {
        heading: 'Pacing Multi-Minute Evolution',
        body: 'If a shader parameter moves at iTime * 1.0, it repeats every ~6 seconds. Slowing key modulation terms to iTime * 0.03 or drifting agent stroke opacity down to 8–18 lets new structures emerge cleanly across 1m, 5m, and 30m milestones.',
      },
      {
        heading: 'Curating via Milestones & Contact Sheets',
        body: 'Arm Milestones (5s, 15s, 30s, 1m, 3m, 10m) in the Capture Schedule tab, then inspect the Timeline Compare slider to spot the exact timestamp where density peaks before over-saturation. Click Load Code on any capture to branch from that moment.',
      },
    ],
    experiments: [
      'Switch to the Capture Schedule tab, enable Interval mode every 15s, and let a pattern run in the background.',
      'Open Timeline, select two timestamps 60s apart, and scrub the Stage Comparison slider.',
    ],
    codeExample: `// Slow harmonic WebGL pattern tuned for multi-minute evolution
const vertShader = \`
#ifdef GL_ES
precision highp float;
#endif
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  vec4 p = vec4(aPosition, 1.0);
  p.xy = p.xy * 2.0 - 1.0;
  gl_Position = p;
}
\`;

const fragShader = \`
#ifdef GL_ES
precision highp float;
#endif
uniform vec2 iResolution;
uniform float iTime;
varying vec2 vTexCoord;

void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;
  float slow = iTime * 0.05;
  vec2 p = uv;
  vec3 col = vec3(0.0);

  for (float i = 1.0; i <= 4.0; i++) {
    p = vec2(p.x * cos(slow) - p.y * sin(slow), p.x * sin(slow) + p.y * cos(slow));
    p = fract(p * (1.35 + 0.1 * sin(slow * 0.7))) - 0.5;
    float d = abs(sin(length(p) * 9.0 + iTime * 0.25)) / 9.0;
    col += vec3(0.95, 0.78, 0.45) * (0.005 / max(d, 0.001));
  }
  gl_FragColor = vec4(col * 0.45, 1.0);
}
\`;

let sh;
function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);
  noStroke();
  sh = createShader(vertShader, fragShader);
}
function draw() {
  shader(sh);
  sh.setUniform("iResolution", [width, height]);
  sh.setUniform("iTime", millis() / 1000.0);
  rect(-width / 2, -height / 2, width, height);
}`,
  },
];
