// Core helpers shared by every scene. Everything here is a pure function of
// its inputs: frames are rendered out of order by parallel workers, so no
// drawing code may keep state between frames.
'use strict';

const W = 1920, H = 1080;
const SCENES = {};          // id -> {draw(ctx, t, T, d)}
const registerScene = (id, def) => { SCENES[id] = def; };

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const invLerp = (a, b, x) => clamp((x - a) / (b - a));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
// progress of t inside [a,b], eased
const prog = (t, a, b, ease = smooth) => ease(invLerp(a, b, t));
const Ease = {
  inQuad: (x) => clamp(x) ** 2,
  outQuad: (x) => 1 - (1 - clamp(x)) ** 2,
  inOutQuad: (x) => (x = clamp(x), x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  inCubic: (x) => clamp(x) ** 3,
  outCubic: (x) => 1 - (1 - clamp(x)) ** 3,
  inOutCubic: (x) => (x = clamp(x), x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  outBack: (x, s = 1.70158) => (x = clamp(x), 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2),
  outElastic: (x) => {
    x = clamp(x);
    if (x === 0 || x === 1) return x;
    return 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
  },
};
const TAU = Math.PI * 2;

// ---------- deterministic randomness ----------
function hash(n) {           // int -> [0,1)
  n = (n | 0) ^ 0x9e3779b9;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function rng(seed) {         // mulberry32 stream; create fresh per frame!
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function noise1(x, seed = 0) {  // smooth value noise in [-1,1]
  const i = Math.floor(x), f = x - i;
  const a = hash(i + seed * 7919) * 2 - 1, b = hash(i + 1 + seed * 7919) * 2 - 1;
  return lerp(a, b, smoother(f));
}
function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const h = (i, j) => hash(i * 374761393 + j * 668265263 + seed * 1013) * 2 - 1;
  const u = smoother(fx), v = smoother(fy);
  return lerp(lerp(h(ix, iy), h(ix + 1, iy), u), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), u), v);
}
function fbm1(x, seed = 0, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise1(x * f, seed + i); a *= 0.5; f *= 2; }
  return s;
}

// ---------- color ----------
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixColor(c1, c2, k) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], clamp(k)))).join(',')})`;
}
function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(alpha)})`;
}

// ---------- drawing helpers ----------
function glow(ctx, x, y, r, color = '#ffe9a8', alpha = 1, core = 0) {
  if (r <= 0 || alpha <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(clamp(core), rgba(color, alpha * (core > 0 ? 1 : 0.6)));
  g.addColorStop(0.45, rgba(color, alpha * 0.25));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
function vGradient(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}
// 4-point sparkle
function sparkle(ctx, x, y, r, color = '#ffffff', alpha = 1, rot = 0) {
  if (alpha <= 0 || r <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha *= clamp(alpha);
  ctx.fillStyle = color;
  ctx.beginPath();
  const k = r * 0.16;
  ctx.moveTo(0, -r); ctx.quadraticCurveTo(k, -k, r, 0); ctx.quadraticCurveTo(k, k, 0, r);
  ctx.quadraticCurveTo(-k, k, -r, 0); ctx.quadraticCurveTo(-k, -k, 0, -r);
  ctx.fill();
  ctx.restore();
}
// Night sky: gradient + stars that twinkle. yOff lets a camera pan the sky.
function starfield(ctx, T, { seed = 1, count = 900, yOff = 0, parallax = 1, top = '#050a24', mid = '#132a5c', bottom = '#2b4a7a', height = H, milky = true } = {}) {
  vGradient(ctx, 0, 0, W, H, [[0, top], [0.55, mid], [1, bottom]]);
  const r = rng(seed);
  if (milky) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const u = r();
      const x = lerp(-200, W + 200, u);
      const y = lerp(H * 0.95, -H * 0.4, u) + (r() - 0.5) * 260 + yOff * parallax;
      glow(ctx, x, y, 140 + r() * 180, i % 3 ? '#6f7fd8' : '#b58ad8', 0.05 + r() * 0.04);
    }
    ctx.restore();
  }
  for (let i = 0; i < count; i++) {
    const x = r() * W, y0 = r() * height * 1.6 - height * 0.3, s = r();
    const y = y0 + yOff * parallax;
    const tw = 0.55 + 0.45 * Math.sin(T * (1 + r() * 3) + r() * TAU);
    if (y < -10 || y > H + 10) { r(); continue; }
    const size = s < 0.94 ? 0.6 + s * 1.3 : 2.2 + (s - 0.94) * 30;
    const col = r() < 0.2 ? '#ffe6c4' : r() < 0.2 ? '#c4d8ff' : '#ffffff';
    ctx.globalAlpha = clamp(tw * (0.4 + s * 0.6));
    ctx.fillStyle = col;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    if (size > 2.5) { ctx.globalAlpha = 1; sparkle(ctx, x, y, size * 2.4, col, tw * 0.6); glow(ctx, x, y, size * 5, col, 0.12 * tw); }
  }
  ctx.globalAlpha = 1;
}
// Fireflies drifting in a box, deterministic in T
function fireflies(ctx, T, { seed = 3, n = 40, x = 0, y = 0, w = W, h = H, color = '#d8ff8a', size = 1 } = {}) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const bx = r(), by = r(), sp = 0.05 + r() * 0.1, ph = r() * 100;
    const px = x + (bx + 0.08 * noise1(T * sp * 3 + ph, i)) * w;
    const py = y + (by + 0.08 * noise1(T * sp * 3 + ph + 50, i + 99)) * h;
    const blink = clamp(Math.sin(T * (1.2 + r() * 1.5) + ph) * 1.5 + 0.3);
    glow(ctx, px, py, 16 * size, color, 0.5 * blink);
    ctx.fillStyle = rgba('#f4ffd0', blink);
    ctx.beginPath(); ctx.arc(px, py, 2.2 * size, 0, TAU); ctx.fill();
  }
}

// ---------- dialogue / lip-sync ----------
// window.LIPSYNC and window.TIMELINE come from data.js (generated).
function dialogueAt(T) {        // the line being spoken at T, or null
  for (const d of TIMELINE.dialogue) {
    const L = LIPSYNC[d.id];
    if (T >= d.start && T < d.start + L.duration) return { ...d, ...L, local: T - d.start };
  }
  return null;
}
// Mouth shape for character `who` at global time T.
// Returns one of 'a','i','u','e','o','n','c'(consonant, half open),'x'(closed) or null (not speaking)
function mouthAt(who, T) {
  const d = dialogueAt(T);
  if (!d || d.who !== who) return null;
  const lt = d.local;
  for (const [a, b, v] of d.mouth) if (lt >= a && lt < b) return v;
  return 'x';
}
// 0..1 openness helper for simple mouths
const MOUTH_OPEN = { a: 1, o: 0.8, e: 0.6, u: 0.35, i: 0.3, n: 0.12, c: 0.35, x: 0 };
function speaking(who, T) { return mouthAt(who, T) !== null; }

// Periodic natural blink: returns eyelid closure 0..1
function blinkAt(T, seed = 0) {
  const period = 3.2 + hash(seed) * 1.5;
  const ph = (T + hash(seed + 7) * period) % period;
  if (ph < 0.14) return Math.sin((ph / 0.14) * Math.PI);
  return 0;
}

// Camera: apply a 2D camera transform (center cx,cy, zoom, rotation) with optional shake
function applyCamera(ctx, { x = W / 2, y = H / 2, zoom = 1, rot = 0, shake = 0, T = 0 } = {}) {
  const sx = shake * noise1(T * 25, 11) * 20, sy = shake * noise1(T * 25, 23) * 20;
  ctx.translate(W / 2, H / 2);
  ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.translate(-x + sx, -y + sy);
}
