import { SketchPreset } from '../types/studio';

export const BUILTIN_PRESETS: SketchPreset[] = [
  {
    id: 'cellular-filament-web',
    name: 'Cellular Filament Web',
    category: 'Generative Growth',
    mode: 'p5js',
    description:
      'Continuous organic branching walkers weaving glowing monochrome cellular membranes and porous cavities over time.',
    defaultSpeed: 1,
    code: `// Cellular Filament Web — Continuous Generative Growth
// Accumulates fibrous white cellular membranes on pure black over minutes and hours.

let agents = [];
const AGENT_COUNT = 260;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  background(0);
  noiseSeed(42);
  randomSeed(42);

  agents = [];
  for (let i = 0; i < AGENT_COUNT; i++) {
    agents.push({
      x: random(width),
      y: random(height),
      px: 0,
      py: 0,
      angle: random(TWO_PI),
      speed: random(1.1, 2.3),
      phase: random(1000),
      weight: random(0.45, 1.15),
    });
    agents[i].px = agents[i].x;
    agents[i].py = agents[i].y;
  }
}

// Cellular ridge potential field (creates organic honeycomb-like voids & veins)
function ridgeField(x, y, t) {
  const s = 0.0042;
  const nx = x * s;
  const ny = y * s;
  const warpX = noise(nx * 1.4 + t * 0.015, ny * 1.4) * 2.4;
  const warpY = noise(nx * 1.4 + 31.7, ny * 1.4 + t * 0.015) * 2.4;

  // Hexagonal / cellular harmonic interference
  const p1 = sin((nx + warpX) * 4.5);
  const p2 = cos((ny + warpY) * 4.5 + (nx + warpX) * 2.25);
  const p3 = sin((ny + warpY) * 4.5 - (nx + warpX) * 2.25);
  const cell = abs(p1 + p2 + p3);
  return cell;
}

function draw() {
  const t = millis() / 1000.0;

  // Subtle dark breathing veil very slowly so dense knots stay sculptural
  if (frameCount % 240 === 0) {
    noStroke();
    fill(0, 3);
    rect(0, 0, width, height);
  }

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    a.px = a.x;
    a.py = a.y;

    // Sample ridge potential ahead-left and ahead-right to follow membrane ridges
    const sensorDist = 7.0;
    const sensorAngle = 0.55;
    const vCenter = ridgeField(
      a.x + cos(a.angle) * sensorDist,
      a.y + sin(a.angle) * sensorDist,
      t
    );
    const vLeft = ridgeField(
      a.x + cos(a.angle - sensorAngle) * sensorDist,
      a.y + sin(a.angle - sensorAngle) * sensorDist,
      t
    );
    const vRight = ridgeField(
      a.x + cos(a.angle + sensorAngle) * sensorDist,
      a.y + sin(a.angle + sensorAngle) * sensorDist,
      t
    );

    // Seek minima (cellular walls) + slight organic micro-jitter
    if (vLeft < vCenter && vLeft < vRight) {
      a.angle -= 0.22;
    } else if (vRight < vCenter && vRight < vLeft) {
      a.angle += 0.22;
    }

    const microNoise = (noise(a.x * 0.02, a.y * 0.02, t * 0.12 + a.phase) - 0.5) * 0.45;
    a.angle += microNoise;

    a.x += cos(a.angle) * a.speed;
    a.y += sin(a.angle) * a.speed;

    // Wrap cleanly around edges without drawing cross-canvas streaks
    let wrapped = false;
    if (a.x < 0) { a.x += width; wrapped = true; }
    if (a.x > width) { a.x -= width; wrapped = true; }
    if (a.y < 0) { a.y += height; wrapped = true; }
    if (a.y > height) { a.y -= height; wrapped = true; }

    if (!wrapped) {
      // Brighter filaments along crisp cellular ridges, finer hairs off-ridge
      const ridgeStrength = constrain(1.0 - vCenter * 0.7, 0.15, 1.0);
      const alpha = ridgeStrength * 48 + 8;
      stroke(245, 248, 255, alpha);
      strokeWeight(a.weight * (0.6 + ridgeStrength * 0.9));
      line(a.px, a.py, a.x, a.y);

      // Occasional crisp fine node filament
      if (ridgeStrength > 0.72 && random() < 0.18) {
        stroke(255, 110);
        point(a.x + random(-2, 2), a.y + random(-2, 2));
      }
    } else {
      a.px = a.x;
      a.py = a.y;
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);
}
`,
  },
  {
    id: 'harmonic-fractal-shader',
    name: 'Harmonic Fractal Shader',
    category: 'GLSL + p5.js',
    mode: 'p5js',
    description:
      'Recursive UV-folded fractal field with tangent-boosted interference waves and trigonometric Iñigo Quilez palette.',
    defaultSpeed: 1,
    code: `// 頂点シェーダーのソースを定義しとるんよ
const vertShader = \`
#ifdef GL_ES
precision highp float;
#endif
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;                             // テクスチャ座標パススルー
  vec4 positionVec4 = vec4(aPosition, 1.0);          // 頂点位置をvec4に変換
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;     // NDC空間に正規化
  gl_Position = positionVec4;                        // 画面に頂点描画
}
\`; // 頂点シェーダー終わり

// フラグメントシェーダーのソースを定義しとるんよ
const fragShader = \`
#ifdef GL_ES
precision highp float;
#endif
uniform vec2 iResolution;
uniform float iTime;
varying vec2 vTexCoord;

// カラーパレット関数（Iñigo Quilezのヤツ）
vec3 palette( float t ) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    return sin(a) + cos(b) * cos( 6.28318 * (c * cos(t) + sin(d)) );
}

// 距離関数（Rhombus, Hexagram, Circle）
float ndot(vec2 a, vec2 b) { return a.x * b.x - a.y * b.y; }

float sdRhombus( in vec2 p, in vec2 b ) {
  p = abs(p);
  float h = clamp( ndot(b - 2.0 * p, b) / dot(b, b), -1.0, 1.0 );
  float d = length( p - 0.5 * b * vec2(1.0 - h, 1.0 + h) );
  return d * sign( p.x * b.y + p.y * b.x - b.x * b.y );
}

float sdHexagram( in vec2 p, in float r ) {
  const vec4 k = vec4(-0.5, 0.8660254, 0.5773503, 1.7320508);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= 2.0 * min(dot(k.yx, p), 0.0) * k.yx;
  p -= vec2(clamp(p.x, r * k.z, r * k.w), r);
  return length(p) * sign(p.y);
}

float sdCircle( vec2 p, float r ) { return length(p) - r; }

void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;                     // [-1,1]に変換
  const float scale = 1.0;                            // スケール因子
  uv.x *= scale * iResolution.x / iResolution.y;      // アスペクト比補正
  uv.y *= scale;                                      // 縦スケール
  vec2 uv0 = uv;                                      // 元UV保持
  vec3 finalColor = vec3(0.0);                        // 出力色初期化

  for (float i = 0.0; i < 4.0; i++) {                  // 多重ループで模様生成
    uv = fract(uv * 1.5) - 0.5;                       // フラクタル変形
    float d = length(uv) * exp(-length(uv0));         // 距離関数
    vec3 col = palette(length(uv0) + i * 0.4 + iTime * 0.4); // 色決定
    d = sin(d * 8.0 + iTime) / 8.0;                   // 波紋効果
    d = abs(d) / 0.4;                                 // 調整
    d = pow(0.01 / max(abs(tan(d)), 0.0008), 1.2);    // 輝度強調
    finalColor += col * d;                            // 合成
  }
  gl_FragColor = vec4(finalColor, 1.0);               // 最終色出力
}
\`; // フラグメントシェーダー終わり

let theShader; // p5.js用シェーダーオブジェクト格納変数

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);     // キャンバス作成（WEBGLモード）
  pixelDensity(1);                                    // retina対策で解像度固定
  noStroke();                                         // 線無し
  theShader = createShader(vertShader, fragShader);   // シェーダー生成
}

function draw() {
  shader(theShader);                                  // シェーダー適用
  theShader.setUniform("iResolution", [width, height]); // 解像度渡しとる
  theShader.setUniform("iTime", millis() / 1000.0);     // 経過秒数渡しとる
  rect(-width / 2, -height / 2, width, height);       // 全面にシェーダー描画
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);             // リサイズ時に再調整
}
`,
  },
  {
    id: 'sdf-rhombus-morph',
    name: 'Rhombus & Hexagram Morph',
    category: 'GLSL + p5.js',
    mode: 'p5js',
    description:
      'Morphing signed-distance lattice blending sdRhombus, sdHexagram, and sdCircle across nested rotating octaves.',
    defaultSpeed: 1,
    code: `const vertShader = \`
#ifdef GL_ES
precision highp float;
#endif
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}
\`;

const fragShader = \`
#ifdef GL_ES
precision highp float;
#endif
uniform vec2 iResolution;
uniform float iTime;
varying vec2 vTexCoord;

vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.15, 0.38, 0.62);
  return a + b * cos(6.28318 * (c * t + d));
}

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

float sdCircle(vec2 p, float r) { return length(p) - r; }

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;
  vec2 uv0 = uv;
  vec3 finalColor = vec3(0.0);

  float morph = 0.5 + 0.5 * sin(iTime * 0.25);

  for (float i = 0.0; i < 4.0; i++) {
    uv = rot(iTime * 0.06 * (i + 1.0)) * uv;
    uv = fract(uv * 1.45) - 0.5;

    float dR = sdRhombus(uv, vec2(0.32, 0.22 + 0.1 * sin(iTime * 0.4)));
    float dH = sdHexagram(uv, 0.2);
    float dC = sdCircle(uv, 0.28);

    float d = mix(mix(dR, dH, morph), dC, 0.25 * sin(iTime * 0.3 + i) + 0.25);
    d *= exp(-length(uv0) * 0.65);

    vec3 col = palette(length(uv0) * 0.6 + i * 0.35 + iTime * 0.12);
    d = sin(d * 10.0 + iTime * 0.8) / 10.0;
    d = abs(d);
    d = pow(0.008 / max(d, 0.0012), 1.25);

    finalColor += col * d;
  }

  gl_FragColor = vec4(finalColor, 1.0);
}
\`;

let theShader;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);
  noStroke();
  theShader = createShader(vertShader, fragShader);
}

function draw() {
  shader(theShader);
  theShader.setUniform("iResolution", [width, height]);
  theShader.setUniform("iTime", millis() / 1000.0);
  rect(-width / 2, -height / 2, width, height);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
`,
  },
  {
    id: 'attractor-ink-drift',
    name: 'Attractor Ink Drift',
    category: 'Particle Dynamics',
    mode: 'p5js',
    description:
      'Long-exposure curl-attractor particles depositing translucent amber and silver filaments over continuous runtime.',
    defaultSpeed: 1,
    code: `// Attractor Ink Drift — Long-Exposure Generative Field
// Leave running to watch delicate silk-like folds emerge over time.

let particles = [];
const COUNT = 420;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  background(7, 8, 11);
  randomSeed(108);
  noiseSeed(108);

  particles = [];
  for (let i = 0; i < COUNT; i++) {
    const angle = (i / COUNT) * TWO_PI;
    const rad = min(width, height) * random(0.08, 0.42);
    particles.push({
      x: width * 0.5 + cos(angle) * rad,
      y: height * 0.5 + sin(angle) * rad,
      vx: 0,
      vy: 0,
      hueMix: random(),
    });
  }
}

function draw() {
  const t = millis() / 1000.0;
  const cx = width * 0.5;
  const cy = height * 0.5;
  const scale = min(width, height) * 0.35;

  // Slowly evolving Clifford-inspired vector field parameters
  const a = -1.4 + sin(t * 0.03) * 0.25;
  const b = 1.6 + cos(t * 0.025) * 0.2;
  const c = 1.0 + sin(t * 0.02) * 0.3;
  const d = 0.7 + cos(t * 0.035) * 0.25;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const nx = (p.x - cx) / scale;
    const ny = (p.y - cy) / scale;

    const tx = sin(a * ny) + c * cos(a * nx);
    const ty = sin(b * nx) + d * cos(b * ny);

    const nAngle = noise(p.x * 0.003, p.y * 0.003, t * 0.05) * TWO_PI;
    const dx = (tx - nx) * 0.45 + cos(nAngle) * 0.55;
    const dy = (ty - ny) * 0.45 + sin(nAngle) * 0.55;

    const prevX = p.x;
    const prevY = p.y;
    p.x += dx * 1.4;
    p.y += dy * 1.4;

    if (p.x < 0 || p.x > width || p.y < 0 || p.y > height || random() < 0.004) {
      const ang = random(TWO_PI);
      const r = random(0.05, 0.44) * min(width, height);
      p.x = cx + cos(ang) * r;
      p.y = cy + sin(ang) * r;
      continue;
    }

    if (p.hueMix > 0.78) {
      stroke(235, 180, 82, 16);
    } else {
      stroke(228, 232, 240, 13);
    }
    strokeWeight(0.8);
    line(prevX, prevY, p.x, p.y);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(7, 8, 11);
}
`,
  },
  {
    id: 'interference-strata',
    name: 'Interference Strata',
    category: 'Pure GLSL',
    mode: 'glsl',
    description:
      'Pure fragment shader combining multi-frequency domain warping and harmonic interference bands with zero boilerplate.',
    defaultSpeed: 1,
    code: `#ifdef GL_ES
precision highp float;
#endif

uniform vec2 iResolution;
uniform float iTime;
uniform float u_seed;
varying vec2 vTexCoord;

vec3 strataPalette(float t) {
  vec3 base = vec3(0.08, 0.09, 0.12);
  vec3 amp  = vec3(0.75, 0.68, 0.58);
  vec3 freq = vec3(1.0, 1.0, 1.0);
  vec3 ph   = vec3(0.0, 0.12, 0.28);
  return base + amp * (0.5 + 0.5 * cos(6.28318 * (freq * t + ph)));
}

void main() {
  vec2 uv = (vTexCoord * 2.0 - 1.0);
  uv.x *= iResolution.x / iResolution.y;

  float t = iTime * 0.18 + u_seed * 0.37;
  vec2 p = uv * 1.65;

  float acc = 0.0;
  for (float i = 1.0; i <= 5.0; i++) {
    p += vec2(
      sin(p.y * i * 1.35 + t * (0.7 + i * 0.12)),
      cos(p.x * i * 1.35 - t * (0.6 + i * 0.14))
    ) * (0.36 / i);
    acc += sin(length(p) * 5.0 - t * 2.0) / i;
  }

  float contour = smoothstep(0.02, 0.18, abs(fract(acc * 2.4) - 0.5));
  float glow = pow(1.0 - contour, 2.2);

  vec3 col = strataPalette(acc * 0.35 + length(uv) * 0.15 + t * 0.1);
  col = mix(col * 0.22, col * 1.25 + vec3(0.95, 0.78, 0.45) * 0.35, glow);

  gl_FragColor = vec4(col, 1.0);
}
`,
  },
];
