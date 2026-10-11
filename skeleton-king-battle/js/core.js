'use strict';
// ─────────────────────────────────────────────────────────────
//  core: math, keyframe tracks, deterministic randomness, time warp
// ─────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const DURATION = 30;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = u => u * u * (3 - 2 * u);
const sat = u => clamp(u, 0, 1);
const ramp = (t, a, b) => sat((t - a) / (b - a));
const easeOut = u => 1 - Math.pow(1 - u, 3);
const easeIn = u => u * u * u;
const easeInOut = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOutBack = u => { const c = 2.2; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
const pulse = (t, a, b) => (t >= a && t < b ? 1 : 0);

// deterministic hash-random in [0,1)
function rnd(seed) {
  let x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
function rnds(seed) { return rnd(seed) * 2 - 1; }

// 2D helpers
const v2 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, k) => [a[0] * k, a[1] * k],
  len: a => Math.hypot(a[0], a[1]),
  lerp: (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u],
  rot: (a, r) => { const c = Math.cos(r), s = Math.sin(r); return [a[0] * c - a[1] * s, a[0] * s + a[1] * c]; },
  norm: a => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; },
};

// Two-bone IK in 2D. bend = +1 / -1 picks the elbow side.
function ik2(a, target, l1, l2, bend) {
  let dx = target[0] - a[0], dy = target[1] - a[1];
  let d = Math.hypot(dx, dy);
  const maxD = (l1 + l2) * 0.999;
  if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
  d = Math.max(d, Math.abs(l1 - l2) + 0.01);
  const base = Math.atan2(dy, dx);
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const ang = base + bend * Math.acos(cosA);
  const j = [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1];
  const end = [a[0] + dx, a[1] + dy];
  return { j, end };
}

// ── Keyframe track ──────────────────────────────────────────
// modes: 'cat' (time-aware Catmull-Rom/Hermite), 'ease' (pose-to-pose), 'lin', 'step'
class Track {
  constructor(keys, mode = 'cat') {
    this.k = keys.slice().sort((a, b) => a[0] - b[0]);
    this.mode = mode;
  }
  at(t) {
    const k = this.k, n = k.length;
    if (n === 1 || t <= k[0][0]) return k[0][1];
    if (t >= k[n - 1][0]) return k[n - 1][1];
    let i = 0;
    // binary search
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (k[m][0] <= t) lo = m; else hi = m; }
    i = lo;
    const [t0, v0] = k[i], [t1, v1] = k[i + 1];
    const h = t1 - t0, u = (t - t0) / h;
    switch (this.mode) {
      case 'step': return v0;
      case 'lin': return v0 + (v1 - v0) * u;
      case 'ease': return v0 + (v1 - v0) * easeInOut(u);
      default: {
        const m0 = i > 0 ? (v1 - k[i - 1][1]) / (t1 - k[i - 1][0]) : (v1 - v0) / h;
        const m1 = i + 2 < n ? (k[i + 2][1] - v0) / (k[i + 2][0] - t0) : (v1 - v0) / h;
        const u2 = u * u, u3 = u2 * u;
        return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * h * m0 +
          (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * h * m1;
      }
    }
  }
}
const T = (keys, mode) => new Track(keys, mode);

// ── Time warp (super slow-motion 0:11.7 – 0:14.4) ───────────
// timeScale is how fast "physical" time runs relative to film time.
function timeScale(t) {
  const inS = ramp(t, 11.55, 11.75), outS = ramp(t, 14.36, 14.42);
  const slow = 0.07;
  if (t < 11.55 || t > 14.42) return 1;
  return lerp(lerp(1, slow, smooth(inS)), 1, outS);
}
const WARP = (() => {
  const hz = 600, n = Math.ceil((DURATION + 2) * hz);
  const tab = new Float32Array(n + 1);
  let acc = 0;
  for (let i = 0; i <= n; i++) { tab[i] = acc; acc += timeScale(i / hz) / hz; }
  return { hz, tab, n };
})();
// physical (warped) time
function W(t) {
  if (t <= 0) return t;
  const f = t * WARP.hz, i = Math.min(Math.floor(f), WARP.n - 1);
  return WARP.tab[i] + (WARP.tab[i + 1] - WARP.tab[i]) * (f - i);
}

// ── Palette (cold base + neon accents) ──────────────────────
const PAL = {
  skyTop: '#2c313a', skyMid: '#535a65', skyLow: '#8e98a3',
  iceFar: '#c9d6df', iceNear: '#7f95a6', iceDeep: '#16263a', crack: '#1b2c42',
  iceHi: '#eef6fb',
  bone: '#ddd7c8', boneSh: '#8c8f9b', boneHi: '#f7f3e8',
  gold: '#d8a83c', goldSh: '#8a5a1e', goldHi: '#ffe48e', goldLine: '#5b3510',
  cape: '#6a1418', capeSh: '#3b0a10',
  ember: '#ff7a1a', emberHot: '#ffd27a', emberDeep: '#c2300a',
  volt: '#d9c8ff', voltCore: '#ffffff', voltDeep: '#9b7bff',
  ink: '#0b0c12',
  steel: '#5d6672', steelSh: '#353b45', steelHi: '#b8c2cc', rust: '#8a4325',
  coat: '#f2f2ee', coatSh: '#b9bec8', hair: '#0d0d14', skin: '#f6e9e2', skinSh: '#d9c1bd',
};
