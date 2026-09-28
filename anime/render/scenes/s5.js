// Scene s5 (31.0–41.5) — town montage. Side-scrolling tracking shot: Hina runs
// left→right through a narrow old street at night; windows slide open, villagers
// lean out, and each home's warm light rises as "thank-you" orbs that stream into
// her lantern. From ~39 dozens of orbs pour in and the lantern blazes.
// Everything is a pure function of time (orb paths are analytic beziers in T).
'use strict';

const S5_GY = 772;          // facade base line (back edge of the street)
const S5_FY = 922;          // Hina's feet
const S5_HSCALE = 0.84;     // Hina scale
const S5_G = 232;           // ground floor height
const S5_U = 150;           // upper floor height

// ---------- camera track: S(t) = integral of an eased speed profile ----------
function s5_bump(t, a, b) { const k = invLerp(a, b, t); return Math.sin(Math.PI * k) ** 2; }
function s5_speed(t) {
  let v = 360;
  v -= 55 * s5_bump(t, 0.6, 3.6);          // ease off while grandpa talks
  v += 90 * prog(t, 3.2, 4.6);
  v -= 80 * s5_bump(t, 4.9, 7.2);          // linger on the kid's balcony
  v += 560 * Ease.inQuad(invLerp(7.3, 10.6, t)); // accelerate into the blaze
  return v;
}
const S5_DT = 1 / 120;
const S5_TAB = (() => {
  const n = Math.ceil(13 / S5_DT) + 2, a = new Float64Array(n);
  for (let i = 1; i < n; i++) a[i] = a[i - 1] + 0.5 * (s5_speed((i - 1) * S5_DT) + s5_speed(i * S5_DT)) * S5_DT;
  return a;
})();
function s5_S(t) {
  if (t <= 0) return s5_speed(0) * t;
  const f = t / S5_DT, i = Math.floor(f);
  if (i >= S5_TAB.length - 1) return S5_TAB[S5_TAB.length - 1] + s5_speed(13) * (t - (S5_TAB.length - 1) * S5_DT);
  return lerp(S5_TAB[i], S5_TAB[i + 1], f - i);
}

// ---------- story beats ----------
// floor 0 = ground-floor demado window, 1 = upper shoji (balcony for the kid)
const S5_GIFTS = [
  { kind: 'grandpa', floor: 0, open: 32.0, sx: 1240, depart: 32.35, arrive: 33.2, wave: [32.15, 34.6], big: 1.0 },
  { kind: 'grandma', floor: 1, open: 33.75, sx: 1330, depart: 34.1, arrive: 35.0, wave: [33.9, 35.3], big: 0.6 },
  { kind: 'kid', floor: 1, balcony: true, open: 36.3, sx: 1180, depart: 36.5, arrive: 37.3, wave: [36.3, 38.0], big: 1.0 },
  { kind: 'mother', floor: 0, open: 37.55, sx: 1400, depart: 37.8, arrive: 38.6, wave: [37.7, 38.9], big: 0.6 },
  { kind: 'grandma', floor: 0, open: 38.65, sx: 1560, depart: 38.85, arrive: 39.6, wave: [38.8, 39.8], big: 0.7 },
  { kind: 'mother', floor: 1, open: 39.35, sx: 1680, depart: 39.6, arrive: 40.4, wave: [39.5, 40.6], big: 0.7 },
];
for (const g of S5_GIFTS) g.wx = s5_S(g.open - 31) + g.sx;
const S5_ARRIVALS = S5_GIFTS.map((g) => g.arrive);

// ---------- street layout (world coords of the facade layer, parallax 1) ----------
const S5_HOUSES = (() => {
  const r = rng(505);
  const out = [];
  const add = (x, w, gift) => {
    const i = out.length;
    const two = gift ? true : r() < 0.5;
    out.push({
      i, x, w, gift, two,
      doorLeft: r() < 0.5,
      norenCol: ['#2c3f7a', '#6a2432', '#2f4a3e', '#3a2c5c'][Math.floor(r() * 4)],
      crest: r() < 0.6,
      upper: r() < 0.5 ? 'shoji' : 'mushi',
      chochin: r() < 0.45,
      plants: r() < 0.7,
      bike: r() < 0.3,
      vend: !gift && r() < 0.2,
      wall: mixColor('#2a1f2c', '#3a2a36', r()),
      plaster: mixColor('#2c2a44', '#3a3552', r()),
      roofH: 62 + r() * 18,
      flick: r() * 100,
      bright: 0.75 + r() * 0.25,
      litUpper: r() < 0.8,
    });
  };
  const fill = (a, b) => {
    const gap = b - a;
    if (gap <= 0) return;
    if (gap < 260 && out.length) { out[out.length - 1].w += gap; return; }
    const n = Math.max(1, Math.round(gap / 470));
    const ws = [];
    let s = 0;
    for (let k = 0; k < n; k++) { const v = 0.8 + r() * 0.4; ws.push(v); s += v; }
    let x = a;
    for (let k = 0; k < n; k++) { const w = gap * ws[k] / s; add(x, w, null); x += w; }
  };
  let cur = -900;
  for (const g of S5_GIFTS) {
    const hw = 250;
    fill(cur, g.wx - hw);
    add(Math.max(cur, g.wx - hw), g.wx + hw - Math.max(cur, g.wx - hw), g);
    cur = g.wx + hw;
  }
  fill(cur, s5_S(12.5) + W + 1200);
  return out;
})();
function s5_houseAt(wx) {
  for (const h of S5_HOUSES) if (wx >= h.x && wx < h.x + h.w) return h;
  return S5_HOUSES[S5_HOUSES.length - 1];
}
// window centre (world x, screen y) of a house: floor 0 or 1
function s5_winPos(h, floor) {
  const cx = h.x + h.w / 2;
  if (h.gift) return floor === h.gift.floor
    ? { x: cx, y: floor ? S5_GY - S5_G - 26 - S5_U * 0.52 : S5_GY - 128 }
    : { x: cx + (floor ? 0 : -h.w * 0.22), y: floor ? S5_GY - S5_G - 26 - S5_U * 0.52 : S5_GY - 120 };
  if (floor && h.two) return { x: cx, y: S5_GY - S5_G - 26 - S5_U * 0.5 };
  const lx = h.doorLeft ? h.x + h.w * 0.62 : h.x + h.w * 0.4;
  return { x: lx, y: S5_GY - 120 };
}

// ---------- cached glow sprites ----------
const S5_SPR = {};
function s5_sprite(color, core = 0) {
  const key = color + core;
  if (S5_SPR[key]) return S5_SPR[key];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, rgba(color, 1));
  if (core > 0) gr.addColorStop(core, rgba(color, 0.9));
  gr.addColorStop(Math.max(core + 0.05, 0.25), rgba(color, 0.45));
  gr.addColorStop(0.5, rgba(color, 0.16));
  gr.addColorStop(0.75, rgba(color, 0.05));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  S5_SPR[key] = c;
  return c;
}
// additive glow via sprite (fast); rx/ry allow ellipses
function s5_glow(ctx, x, y, rx, color, alpha, ry = rx, core = 0) {
  if (alpha <= 0.002 || rx <= 0.5) return;
  const pa = ctx.globalAlpha, pc = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(alpha);
  ctx.drawImage(s5_sprite(color, core), x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalAlpha = pa;
  ctx.globalCompositeOperation = pc;
}

// ---------- Hina & lantern ----------
function s5_hinaX(t) {
  let x = 0.4 * W - 70 * (1 - prog(t, 0, 1.8)) + 22 * noise1(t * 0.5, 71);
  return x;
}
function s5_runPhase(t) {
  const e = Math.max(0, t - 7.3);
  return (2.3 * t + 0.1 * e * e) % 1;
}
function s5_arrivalPulse(T) {
  let p = 0;
  for (const ta of S5_ARRIVALS) if (T >= ta) p += Math.exp(-(T - ta) / 0.32);
  return p;
}
function s5_lanternGlow(T) {
  let g = 0.6;
  for (const ta of S5_ARRIVALS) g += 0.085 * smooth((T - ta) / 0.5);
  g += 0.49 * prog(T, 39.2, 41.2, Ease.inQuad);
  return g + 0.25 * s5_arrivalPulse(T);
}
function s5_hinaOpts(t, T) {
  const lookKid = s5_bump(T, 36.1, 37.9), lookGp = s5_bump(T, 31.9, 33.6);
  return {
    x: s5_hinaX(t), y: S5_FY, scale: S5_HSCALE, facing: 1, view: 'side', pose: 'run',
    runPhase: s5_runPhase(t),
    expression: T < 33.15 ? 'determined' : 'joy',
    mouth: mouthAt('hina', T), blink: blinkAt(T, 55),
    lookX: 0.5 + 0.3 * lookGp, lookY: -0.2 - 0.4 * lookGp - 0.8 * lookKid,
    headTilt: -0.12 * lookKid - 0.05 * lookGp,
    wind: 0.5 + 0.3 * prog(T, 39, 41), T,
    lantern: { glow: s5_lanternGlow(T), kiraInside: true },
  };
}
function s5_lanternAt(t, T) {
  const o = s5_hinaOpts(t, T);
  if (typeof hinaLanternPos === 'function') { const p = hinaLanternPos(o); if (p) return p; }
  if (typeof hinaHandPos === 'function') {
    const p = hinaHandPos(o);
    if (p) return { x: p.x, y: p.y + 58 * o.scale };
  }
  return { x: o.x + 70 * o.scale, y: o.y - 120 * o.scale };
}

// ---------- orbs ----------
function s5_bez(p0, p1, p2, p3, u) {
  const v = 1 - u;
  return {
    x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
    y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y,
  };
}
// the swarm: many orbs from random windows, arrivals denser towards the end
const S5_SWARM = (() => {
  const r = rng(909), out = [];
  const N = 46;
  for (let i = 0; i < N; i++) {
    const q = (i + r() * 0.8) / N;
    const ta = 39.25 + 2.5 * Math.pow(q, 0.62);
    const dur = 1.0 + r() * 0.8;
    const td = ta - dur;
    const X = 60 + r() * (W + 500);
    const h = s5_houseAt(s5_S(td - 31) + X);
    const floor = h.two && r() < 0.5 ? 1 : 0;
    const wp = s5_winPos(h, floor);
    out.push({ td, ta, wx: wp.x + (r() - 0.5) * 60, wy: wp.y + (r() - 0.5) * 30, size: 0.55 + r() * 0.45,
      a1: 120 + r() * 220, a2: 150 + r() * 300, side: r() - 0.5, sw: 30 + r() * 80, ph: r() * TAU, emerge: 0.3 });
  }
  return out;
})();
const S5_MAIN = S5_GIFTS.map((g, k) => {
  const wp = s5_winPos(S5_HOUSES.find((h) => h.gift === g), g.floor);
  return { td: g.depart, ta: g.arrive, wx: wp.x, wy: wp.y, size: 1.85, a1: 230, a2: 300, side: 0.2 * (k % 2 ? -1 : 1), sw: 26, ph: k, emerge: 0.35, main: true };
});
function s5_orbAt(o, T) {
  if (T < o.td - o.emerge || T >= o.ta) return null;
  const t = T - 31, S = s5_S(t);
  const P0 = { x: o.wx - S, y: o.wy };
  if (T < o.td) {
    const k = smooth((T - (o.td - o.emerge)) / o.emerge);
    return { x: P0.x, y: P0.y - 16 * k, s: k, a: k, u: 0 };
  }
  const L = s5_lanternAt(t, T);
  const u = (T - o.td) / (o.ta - o.td);
  const e = lerp(u, Ease.inOutCubic(u), 0.55);
  const dir = P0.x > L.x ? 1 : -1;
  const P1 = { x: P0.x + o.side * 160, y: P0.y - 16 - o.a1 };
  const P2 = { x: L.x + dir * (160 + o.a2 * 0.4), y: Math.min(P0.y, L.y) - o.a2 };
  const p = s5_bez({ x: P0.x, y: P0.y - 16 }, P1, P2, L, e);
  const sw = Math.sin(Math.PI * u) * o.sw;
  p.x += Math.sin(u * TAU * 1.3 + o.ph) * sw;
  p.y += Math.cos(u * TAU * 1.1 + o.ph) * sw * 0.5;
  return { x: p.x, y: p.y, s: 1 - 0.45 * Ease.inQuad(u), a: 1, u };
}
function s5_drawOrb(ctx, o, T) {
  const p = s5_orbAt(o, T);
  if (!p) return;
  const sz = o.size * p.s;
  if (o.main && T < o.td + 0.3) {
    // the window's own light gathering and lifting out
    const k = clamp((T - (o.td - o.emerge)) / o.emerge) * (1 - clamp((T - o.td) / 0.3));
    const S = s5_S(T - 31);
    s5_glow(ctx, o.wx - S, o.wy, 170, '#ffd28a', 0.55 * k, 120);
  }
  // sparkle trail (sampled back along the analytic path)
  if (T > o.td) {
    const nk = o.main ? 9 : 5;
    for (let k = 1; k <= nk; k++) {
      const q = s5_orbAt(o, T - k * (o.main ? 0.03 : 0.05));
      if (!q) break;
      const f = 1 - k / (nk + 1);
      s5_glow(ctx, q.x, q.y, 26 * sz * f, '#ffb347', 0.28 * f);
      const jx = (hash(k * 131 + Math.floor(T * 20) * 7 + o.ph * 1000) - 0.5) * 14;
      const jy = (hash(k * 71 + Math.floor(T * 20) * 13 + o.ph * 1000) - 0.5) * 14;
      if (k % 2 === 0) sparkle(ctx, q.x + jx, q.y + jy, 6 * sz * f, '#fff3c0', 0.8 * f, T * 3 + k);
    }
  }
  const pulse = 1 + 0.12 * Math.sin(T * 14 + o.ph * 3);
  s5_glow(ctx, p.x, p.y, 110 * sz * pulse, '#ff9e3d', 0.45 * p.a);
  s5_glow(ctx, p.x, p.y, 48 * sz, '#ffc46e', 0.9 * p.a);
  s5_glow(ctx, p.x, p.y, 20 * sz, '#fff8e0', 1 * p.a, 20 * sz, 0.4);
  ctx.fillStyle = rgba('#fffdf4', p.a);
  ctx.beginPath(); ctx.arc(p.x, p.y, 5.5 * sz, 0, TAU); ctx.fill();
  sparkle(ctx, p.x, p.y, (o.main ? 26 : 14) * sz * pulse, '#fffbe8', 0.7 * p.a, T * 1.5 + o.ph);
}
function s5_drawArrivalBursts(ctx, t, T) {
  const L = s5_lanternAt(t, T);
  const list = [...S5_MAIN.map((o) => [o.ta, 1]), ...S5_SWARM.map((o) => [o.ta, 0.45])];
  for (const [ta, big] of list) {
    const dt = T - ta;
    if (dt < 0 || dt > 0.7) continue;
    const k = dt / 0.7;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba('#ffe7a8', (1 - k) * 0.4 * big);
    ctx.lineWidth = 5 * (1 - k) * big + 1;
    ctx.beginPath(); ctx.arc(L.x, L.y, 30 + 150 * Ease.outCubic(k) * big, 0, TAU); ctx.stroke();
    ctx.restore();
    s5_glow(ctx, L.x, L.y, 260 * big * (1 - k * 0.5), '#ffd28a', 0.55 * (1 - k) * big);
    for (let j = 0; j < 7; j++) {
      const a = hash(Math.floor(ta * 100) + j * 17) * TAU;
      const d = (40 + 130 * big) * Ease.outCubic(k);
      sparkle(ctx, L.x + Math.cos(a) * d, L.y + Math.sin(a) * d, 12 * big * (1 - k), '#fff3c0', 1 - k, a);
    }
  }
}
// ambient orbs drifting through the street in the finale
function s5_drawDrift(ctx, t, T) {
  if (T < 38.9) return;
  const r = rng(777);
  const S = s5_S(t);
  for (let i = 0; i < 110; i++) {
    const q = (i + r()) / 110;
    const tb = 38.9 + 2.3 * Math.pow(q, 0.75);
    const p = 0.7 + r() * 0.7;
    const X = r() * (W + 300) - 150, Y = 180 + r() * 720, sz = 0.3 + r() * 0.6, ph = r() * 100;
    if (T < tb) continue;
    const age = T - tb;
    const wx = s5_S(tb - 31) * p + X;
    const x = wx - S * p + 40 * noise1(T * 0.7 + ph, 3);
    const y = Y - 26 * age + 30 * noise1(T * 0.6 + ph, 9);
    if (x < -120 || x > W + 120) continue;
    const a = smooth(age / 0.6) * (0.7 + 0.3 * Math.sin(T * 5 + ph));
    s5_glow(ctx, x, y, 75 * sz, '#ff9e3d', 0.38 * a);
    s5_glow(ctx, x, y, 22 * sz, '#ffd28a', 0.8 * a);
    s5_glow(ctx, x, y, 8 * sz, '#fffbe8', 1 * a, 8 * sz, 0.4);
    if (i % 3 === 0) sparkle(ctx, x, y, 14 * sz, '#fffbe8', 0.7 * a, T + ph);
  }
}

// ---------- backgrounds ----------
function s5_sky(ctx, t, T) {
  vGradient(ctx, -200, -400, W + 400, S5_GY + 400, [[0, '#050a24'], [0.45, '#10245a'], [0.8, '#23426f'], [1, '#2b4a7a']]);
  const S = s5_S(t);
  const r = rng(515);
  ctx.save();
  // faint milky band
  for (let i = 0; i < 9; i++) {
    const x = ((r() * 2600 - S * 0.02) % 2600 + 2600) % 2600 - 340;
    s5_glow(ctx, x, 60 + r() * 220, 260 + r() * 160, i % 2 ? '#6f7fd8' : '#9a86d8', 0.07);
  }
  for (let i = 0; i < 320; i++) {
    const x0 = r() * 2400, y = r() * 520, s = r(), sp = 1 + r() * 3, ph = r() * TAU;
    const x = ((x0 - S * 0.03) % 2400 + 2400) % 2400 - 240;
    if (x < -5 || x > W + 5) continue;
    const tw = 0.55 + 0.45 * Math.sin(T * sp + ph);
    const size = s < 0.93 ? 0.9 + s * 1.4 : 2.4 + (s - 0.93) * 24;
    ctx.globalAlpha = clamp(tw * (0.35 + s * 0.65) * (1 - y / 700));
    ctx.fillStyle = s > 0.8 ? '#ffe6c4' : '#ffffff';
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    if (size > 2.6) { ctx.globalAlpha = 1; sparkle(ctx, x, y, size * 2.6, '#fff4dc', tw * 0.7, 0); }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
// distant hill with the camphor tree (parallax 0.07)
function s5_hill(ctx, t, T) {
  const off = -s5_S(t) * 0.07;
  const cx = 1330 + off;
  ctx.save();
  // far ridge
  ctx.fillStyle = '#1b2f5e';
  ctx.beginPath();
  ctx.moveTo(0, S5_GY);
  for (let x = 0; x <= W; x += 24) {
    const wx = x - off * 0.7;
    ctx.lineTo(x, 330 + 40 * fbm1(wx * 0.0022, 4) + 30 * Math.sin(wx * 0.001));
  }
  ctx.lineTo(W, S5_GY); ctx.fill();
  // hill
  ctx.fillStyle = '#243d70';
  ctx.beginPath();
  ctx.moveTo(cx - 900, S5_GY);
  for (let k = 0; k <= 60; k++) {
    const x = cx - 900 + k * 30, d = (x - cx) / 620;
    ctx.lineTo(x, 238 + 150 * d * d + 6 * noise1(x * 0.02, 5));
  }
  ctx.lineTo(cx + 900, S5_GY); ctx.fill();
  // tree trunk + crown silhouette with a faint rim of starlight
  ctx.fillStyle = '#1a2c55';
  ctx.beginPath(); ctx.moveTo(cx - 12, 245); ctx.lineTo(cx - 5, 185); ctx.lineTo(cx + 7, 185); ctx.lineTo(cx + 14, 245); ctx.fill();
  const blobs = [[0, 150, 62], [-55, 168, 44], [55, 166, 46], [-30, 128, 42], [32, 124, 44], [0, 108, 36], [-82, 186, 28], [84, 184, 30]];
  for (const [dx, dy, rr] of blobs) {
    ctx.beginPath(); ctx.arc(cx + dx, dy + 3 * Math.sin(T * 0.8 + dx), rr, 0, TAU); ctx.fill();
  }
  // tiny stone lantern glow next to the tree
  s5_glow(ctx, cx + 60, 236, 18, '#ffd28a', 0.35);
  ctx.restore();
  s5_glow(ctx, cx, 150, 240, '#4f6fb8', 0.10);
}
// far rooftops (parallax 0.38), bluish by atmospheric perspective
function s5_farRoofs(ctx, t, T) {
  const p = 0.38, S = s5_S(t) * p;
  const span = 260;
  const i0 = Math.floor((S - 200) / span), i1 = Math.floor((S + W + 200) / span);
  ctx.save();
  for (let i = i0; i <= i1; i++) {
    const x = i * span - S + (hash(i * 3) - 0.5) * 60;
    const w = 190 + hash(i * 3 + 1) * 140;
    const top = 330 + hash(i * 3 + 2) * 80;
    ctx.fillStyle = '#223a6a';
    ctx.fillRect(x, top + 34, w, S5_GY - top);
    // roof trapezoid
    ctx.fillStyle = '#1d3260';
    ctx.beginPath();
    ctx.moveTo(x - 18, top + 40); ctx.lineTo(x + 26, top); ctx.lineTo(x + w - 26, top); ctx.lineTo(x + w + 18, top + 40); ctx.fill();
    ctx.fillStyle = 'rgba(120,150,210,0.25)';
    ctx.fillRect(x + 26, top - 2, w - 52, 3);
    if (hash(i * 7 + 5) < 0.7) {
      const wx = x + 30 + hash(i * 7 + 6) * (w - 90);
      const lit = 0.5 + 0.3 * Math.sin(T * 1.3 + i);
      ctx.fillStyle = rgba('#ffc46e', 0.55 * lit + 0.25);
      ctx.fillRect(wx, top + 60, 34, 26);
      s5_glow(ctx, wx + 17, top + 73, 60, '#ffb347', 0.18);
    }
  }
  ctx.restore();
  // haze over far layer
  vGradient(ctx, 0, 300, W, S5_GY - 300, [[0, 'rgba(60,90,150,0)'], [1, 'rgba(60,90,150,0.18)']]);
}

// ---------- the facades ----------
function s5_tiles(ctx, x0, y0, x1, y1, over, col) {
  // tiled roof band (trapezoid with overhang) + tile columns + round tile ends
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x0 - over, y1); ctx.lineTo(x0 + 6, y0); ctx.lineTo(x1 - 6, y0); ctx.lineTo(x1 + over, y1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(80,100,150,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = x0 - over + 8; x < x1 + over; x += 13) { ctx.moveTo(x + (x - (x0 + x1) / 2) * -0.05, y0 + 2); ctx.lineTo(x, y1 - 3); }
  ctx.stroke();
  ctx.fillStyle = '#10152a';
  ctx.fillRect(x0 - over, y1 - 4, x1 - x0 + over * 2, 7);
  ctx.fillStyle = 'rgba(120,150,210,0.45)';
  for (let x = x0 - over + 6; x < x1 + over - 3; x += 13) { ctx.beginPath(); ctx.arc(x, y1 - 1, 3.2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(130,160,220,0.55)';
  ctx.fillRect(x0 + 6, y0 - 1, x1 - x0 - 12, 3);
}
function s5_lattice(ctx, x, y, w, h, light, T, seed) {
  // warm light behind a dense koshi lattice
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, mixColor('#3a2412', '#ffc46e', light * 0.9));
  g.addColorStop(1, mixColor('#2a1a10', '#ff9e3d', light * 0.8));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#1c131c';
  for (let sx = x + 2; sx < x + w - 2; sx += 11) ctx.fillRect(sx, y, 5.5, h);
  ctx.fillRect(x, y + h * 0.22, w, 5);
  ctx.fillStyle = '#2a1f28';
  ctx.fillRect(x - 5, y - 6, w + 10, 8); ctx.fillRect(x - 5, y + h - 2, w + 10, 8);
}
function s5_shoji(ctx, x, y, w, h, light, cols = 3, rows = 4) {
  ctx.fillStyle = mixColor('#4a3a30', '#ffe3a6', light);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(40,25,20,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let c = 1; c < cols; c++) { const xx = x + w * c / cols; ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); }
  for (let rr = 1; rr < rows; rr++) { const yy = y + h * rr / rows; ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
  ctx.stroke();
  ctx.strokeStyle = '#231820'; ctx.lineWidth = 6; ctx.strokeRect(x, y, w, h);
}
function s5_chochin(ctx, x, y, s, T, seed, col = '#d8394a', txt = true) {
  const sw = 0.08 * Math.sin(T * 2.1 + seed) + 0.04 * Math.sin(T * 3.7 + seed * 2);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(sw);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -14 * s); ctx.lineTo(0, 0); ctx.stroke();
  const rx = 20 * s, ry = 30 * s, cy = 32 * s;
  const g = ctx.createRadialGradient(-rx * 0.3, cy - ry * 0.2, 2, 0, cy, ry * 1.1);
  g.addColorStop(0, '#ffcf8a'); g.addColorStop(0.35, col); g.addColorStop(1, '#5a1420');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(80,10,20,0.5)'; ctx.lineWidth = 1.2;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(0, cy + k * ry * 0.33, rx * Math.sqrt(1 - (k * 0.33) ** 2), 2, 0, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#16121a';
  ctx.fillRect(-rx * 0.55, cy - ry - 3 * s, rx * 1.1, 6 * s);
  ctx.fillRect(-rx * 0.55, cy + ry - 3 * s, rx * 1.1, 6 * s);
  if (txt) { ctx.fillStyle = 'rgba(30,8,10,0.55)'; ctx.fillRect(-2.5 * s, cy - ry * 0.55, 5 * s, ry * 1.1); }
  ctx.restore();
  s5_glow(ctx, x, y + 32 * s, 110 * s, '#ff6a3d', 0.42);
  s5_glow(ctx, x, y + 32 * s, 40 * s, '#ffb347', 0.35);
}
function s5_plants(ctx, x, y, T, seed) {
  const r = rng(seed);
  const n = 2 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const px = x + k * 34 + r() * 10, ph = 28 + r() * 22, pw = 16 + r() * 8;
    ctx.fillStyle = k % 2 ? '#3b2a26' : '#4a3226';
    ctx.beginPath(); ctx.moveTo(px - pw, y - ph * 0.5); ctx.lineTo(px + pw, y - ph * 0.5); ctx.lineTo(px + pw * 0.75, y); ctx.lineTo(px - pw * 0.75, y); ctx.fill();
    ctx.fillStyle = k % 2 ? '#17394a' : '#0f2a3a';
    const lh = 30 + r() * 50;
    for (let j = 0; j < 7; j++) {
      const a = -Math.PI / 2 + (j - 3) * 0.33 + 0.05 * Math.sin(T * 1.5 + j + seed);
      ctx.beginPath();
      ctx.ellipse(px + Math.cos(a) * lh * 0.45, y - ph * 0.5 + Math.sin(a) * lh * 0.45, lh * 0.4, 7, a, 0, TAU);
      ctx.fill();
    }
  }
}
function s5_bike(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#141222'; ctx.lineWidth = 4;
  const r = 30;
  ctx.beginPath(); ctx.arc(x, y - r, r, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + 96, y - r, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + 38, y - r); ctx.lineTo(x + 26, y - r - 42); ctx.lineTo(x, y - r);
  ctx.moveTo(x + 38, y - r); ctx.lineTo(x + 76, y - r - 44); ctx.lineTo(x + 26, y - r - 42);
  ctx.moveTo(x + 76, y - r - 44); ctx.lineTo(x + 96, y - r);
  ctx.moveTo(x + 76, y - r - 44); ctx.lineTo(x + 72, y - r - 62); ctx.lineTo(x + 58, y - r - 64);
  ctx.moveTo(x + 18, y - r - 52); ctx.lineTo(x + 36, y - r - 52);
  ctx.stroke();
  ctx.fillStyle = '#1d1a2e'; ctx.fillRect(x + 80, y - r - 60, 30, 16); // basket
  ctx.strokeStyle = 'rgba(140,170,230,0.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y - r, r, -2.4, -1.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + 96, y - r, r, -2.4, -1.2); ctx.stroke();
  ctx.restore();
}
function s5_vending(ctx, x, y, T) {
  const w = 96, h = 190;
  s5_glow(ctx, x + w / 2, y - h / 2, 240, '#9fd8ff', 0.22);
  ctx.fillStyle = '#d9e4ee'; ctx.fillRect(x, y - h, w, h);
  ctx.fillStyle = '#e8f6ff'; ctx.fillRect(x + 8, y - h + 10, w - 16, 92);
  const cols = ['#e04a4a', '#3a8ad8', '#f0b030', '#4ab870', '#f07aa0', '#8a5ad8'];
  for (let rr = 0; rr < 3; rr++) for (let c = 0; c < 6; c++) {
    ctx.fillStyle = cols[(c + rr * 2) % 6];
    ctx.fillRect(x + 12 + c * 12.5, y - h + 18 + rr * 30, 8, 20);
  }
  ctx.fillStyle = '#2a3446'; ctx.fillRect(x + 12, y - 48, w - 24, 22);
  ctx.fillStyle = '#b7c4d2'; ctx.fillRect(x + 8, y - h + 110, w - 16, 18);
  s5_glow(ctx, x + w / 2, y - h + 56, 70, '#e8f6ff', 0.35);
}
function s5_noren(ctx, x, y, w, h, col, crest, T, seed) {
  const n = 3, pw = w / n;
  for (let k = 0; k < n; k++) {
    const sw = 5 * Math.sin(T * 2.4 + k * 0.9 + seed) + 4 * noise1(T * 1.7 + k, seed);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x + k * pw + 1, y);
    ctx.lineTo(x + (k + 1) * pw - 1, y);
    ctx.lineTo(x + (k + 1) * pw - 1 + sw, y + h);
    ctx.lineTo(x + k * pw + 1 + sw, y + h);
    ctx.fill();
  }
  if (crest) {
    ctx.strokeStyle = 'rgba(240,230,210,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.45, Math.min(w, h) * 0.18, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = '#18121a'; ctx.fillRect(x - 4, y - 4, w + 8, 6);
}

// state of a gift window at time T
function s5_giftState(g, T) {
  const open = Ease.outBack(invLerp(g.open, g.open + 0.4, T), 1.2);
  const lean = Ease.outBack(invLerp(g.open + 0.05, g.open + 0.55, T), 1.4);
  const give = prog(T, g.depart - 0.2, g.depart + 0.9);
  return { open, lean, light: lerp(1.0, 0.62, give) };
}

function s5_house(ctx, h, x0, t, T) {
  const w = h.w, gy = S5_GY, G = S5_G, U = S5_U;
  const flick = 0.93 + 0.07 * noise1(T * 2 + h.flick, 7);
  let lite = h.bright * flick;
  const g = h.gift;
  const gs = g ? s5_giftState(g, T) : null;
  if (g) lite = lerp(lite, lite * 0.72, prog(T, g.depart - 0.2, g.depart + 0.9));
  const topG = gy - G;
  // ground floor body
  ctx.fillStyle = h.wall;
  ctx.fillRect(x0, topG, w, G);
  // posts
  ctx.fillStyle = '#1a121a';
  ctx.fillRect(x0, topG, 10, G); ctx.fillRect(x0 + w - 10, topG, 10, G);
  // stone base
  ctx.fillStyle = '#262a3c'; ctx.fillRect(x0, gy - 14, w, 14);
  // door
  const dw = 92, dx = h.doorLeft ? x0 + 26 : x0 + w - 26 - dw;
  ctx.fillStyle = mixColor('#2a1a10', '#ffbf6a', lite * 0.95);
  ctx.fillRect(dx, topG + 40, dw, G - 54);
  s5_glow(ctx, dx + dw / 2, topG + 120, 90, '#ffb347', 0.25 * lite);
  s5_noren(ctx, dx - 4, topG + 40, dw + 8, 92, h.norenCol, h.crest, T, h.i);
  ctx.fillStyle = '#1a121a'; ctx.fillRect(dx - 6, topG + 36, 6, G - 50); ctx.fillRect(dx + dw, topG + 36, 6, G - 50);
  // lattice front (excluding door & the gift window)
  const lx0 = h.doorLeft ? dx + dw + 24 : x0 + 24, lx1 = h.doorLeft ? x0 + w - 24 : dx - 24;
  if (g && g.floor === 0) {
    const ww = 200, wx0 = x0 + w / 2 - ww / 2;
    if (wx0 - lx0 > 40) s5_lattice(ctx, lx0, topG + 38, wx0 - 16 - lx0, G - 76, lite, T, h.i);
    if (lx1 - (wx0 + ww + 16) > 40) s5_lattice(ctx, wx0 + ww + 16, topG + 38, lx1 - wx0 - ww - 16, G - 76, lite, T, h.i + 1);
  } else if (lx1 - lx0 > 40) {
    s5_lattice(ctx, lx0, topG + 38, lx1 - lx0, G - 76, lite, T, h.i);
  }
  // upper floor
  if (h.two) {
    const yU = topG - 26 - U;
    const pg = ctx.createLinearGradient(0, yU, 0, yU + U + 26);
    pg.addColorStop(0, '#15131f'); pg.addColorStop(0.18, h.plaster); pg.addColorStop(1, mixColor('#2c2a44', '#4a3a40', 0.5 * lite));
    ctx.fillStyle = pg;
    ctx.fillRect(x0 + 8, yU, w - 16, U + 26);
    ctx.fillStyle = '#1e1622';
    ctx.fillRect(x0 + 8, yU, 10, U + 26); ctx.fillRect(x0 + w - 18, yU, 10, U + 26);
    ctx.fillRect(x0 + 8, yU + U - 6, w - 16, 8);
    if (!(g && g.floor === 1)) {
      if (h.upper === 'mushi' || !h.litUpper) {
        // mushiko-mado: plaster slots with faint light
        const mw = Math.min(w - 120, 280), mx = x0 + w / 2 - mw / 2;
        ctx.fillStyle = h.litUpper ? mixColor('#2a1a10', '#ffb35a', lite * 0.6) : '#171322';
        ctx.fillRect(mx, yU + 40, mw, 64);
        ctx.fillStyle = h.plaster;
        for (let sx = mx + 10; sx < mx + mw - 6; sx += 26) ctx.fillRect(sx, yU + 40, 14, 64);
        if (h.litUpper) s5_glow(ctx, mx + mw / 2, yU + 72, mw * 0.8, '#ffb347', 0.14 * lite, 90);
      } else {
        const sw = 120, gap = 30, tot = sw * 2 + gap, sx = x0 + w / 2 - tot / 2;
        s5_shoji(ctx, sx, yU + 32, sw, 88, lite * 0.9, 3, 3);
        s5_shoji(ctx, sx + sw + gap, yU + 32, sw, 88, lite * 0.9, 3, 3);
        s5_glow(ctx, x0 + w / 2, yU + 76, tot * 0.75, '#ffb347', 0.2 * lite, 110);
      }
    }
    s5_tiles(ctx, x0 + 4, yU - h.roofH, x0 + w - 4, yU + 6, 28, '#161c30');
  } else {
    s5_tiles(ctx, x0 + 4, topG - 26 - 70, x0 + w - 4, topG, 30, '#161c30');
  }
  // hisashi (lower eave)
  if (h.two) s5_tiles(ctx, x0, topG - 26, x0 + w, topG + 8, 18, '#1a2036');
  // gift windows
  if (g) s5_giftWindow(ctx, h, g, gs, x0, t, T);
  // hanging red lanterns
  if (h.chochin) {
    s5_chochin(ctx, x0 + 40, topG + 12, 0.95, T, h.i * 3);
    if (w > 420) s5_chochin(ctx, x0 + w - 40, topG + 12, 0.95, T, h.i * 3 + 1);
  }
}
function s5_giftWindow(ctx, h, g, gs, x0, t, T) {
  const cx = x0 + h.w / 2;
  let wx, wy, ww, wh;
  if (g.floor === 0) { ww = 200; wh = 150; wx = cx - ww / 2; wy = S5_GY - 128 - wh / 2; }
  else { ww = 190; wh = 108; wx = cx - ww / 2; wy = S5_GY - S5_G - 26 - S5_U * 0.52 - wh / 2; }
  // interior (bright warm room)
  const L = gs.light;
  const ig = ctx.createLinearGradient(0, wy, 0, wy + wh);
  ig.addColorStop(0, mixColor('#5a3a20', '#ffe0a0', L));
  ig.addColorStop(1, mixColor('#4a2a18', '#ffb04a', L));
  ctx.fillStyle = ig;
  ctx.fillRect(wx, wy, ww, wh);
  // hanging interior lamp
  s5_glow(ctx, cx + ww * 0.25, wy + 20, 60, '#fff0c0', 0.6 * L);
  // villager leaning out (backlit)
  if (gs.open > 0.02) {
    ctx.save();
    ctx.beginPath(); ctx.rect(wx - 60, wy - 120, ww + 120, wh + 120); ctx.clip();
    const sc = g.kind === 'kid' ? 0.55 : 0.6;
    const wv = s5_bump(T, g.wave[0], g.wave[1]) > 0 ? clamp(Math.min(invLerp(g.wave[0], g.wave[0] + 0.3, T), 1 - invLerp(g.wave[1] - 0.3, g.wave[1], T))) * g.big : 0;
    drawVillager(ctx, {
      kind: g.kind, x: cx - 14, y: wy + wh + 10 + (1 - gs.lean) * 60, scale: sc,
      mouth: g.kind === 'grandpa' ? mouthAt('grandpa', T) : g.kind === 'kid' ? mouthAt('kid', T) : null,
      wave: wv, T, facing: -1,
    });
    ctx.restore();
  }
  // sliding shoji panel (slides to the right, into the wall pocket)
  const slide = gs.open * (ww - 16);
  ctx.save();
  ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  s5_shoji(ctx, wx + slide, wy, ww, wh, lerp(1.0, 0.8, gs.open) * clamp(L + 0.1), 4, 3);
  ctx.restore();
  // frame / sill / balcony
  ctx.strokeStyle = '#1c131c'; ctx.lineWidth = 8; ctx.strokeRect(wx - 4, wy - 4, ww + 8, wh + 8);
  ctx.fillStyle = '#2d2028'; ctx.fillRect(wx - 16, wy + wh, ww + 32, 12);
  if (g.balcony) {
    const by = wy + wh - 40;
    ctx.fillStyle = '#231820';
    ctx.fillRect(wx - 40, by, ww + 80, 7);
    ctx.fillRect(wx - 40, wy + wh + 10, ww + 80, 10);
    for (let bx = wx - 36; bx < wx + ww + 40; bx += 16) ctx.fillRect(bx, by, 5, wy + wh + 10 - by);
  }
  // spill glow
  s5_glow(ctx, cx, wy + wh / 2, ww * 1.1, '#ffb347', 0.35 * L * (0.5 + gs.open));
}

function s5_facades(ctx, t, T) {
  const S = s5_S(t);
  for (const h of S5_HOUSES) {
    const x0 = h.x - S;
    if (x0 > W + 60 || x0 + h.w < -60) continue;
    s5_house(ctx, h, x0, t, T);
  }
}
// street-level props in front of houses (plants, bikes, vending machines)
function s5_props(ctx, t, T) {
  const S = s5_S(t);
  for (const h of S5_HOUSES) {
    const x0 = h.x - S;
    if (x0 > W + 60 || x0 + h.w < -200) continue;
    const doorX = h.doorLeft ? x0 + 26 : x0 + h.w - 118;
    if (h.plants) s5_plants(ctx, h.doorLeft ? doorX + 110 : x0 + 24, S5_GY + 4, T, h.i * 11 + 3);
    if (h.vend) s5_vending(ctx, h.doorLeft ? x0 + h.w - 60 : x0 - 50, S5_GY + 8, T);
    else if (h.bike) s5_bike(ctx, h.doorLeft ? x0 + h.w - 150 : x0 + 30, S5_GY + 10);
  }
}
// warm light pools on the street from windows
function s5_pools(ctx, t, T) {
  const S = s5_S(t);
  for (const h of S5_HOUSES) {
    const x0 = h.x - S;
    if (x0 > W + 300 || x0 + h.w < -300) continue;
    let lite = h.bright;
    if (h.gift) {
      const gs = s5_giftState(h.gift, T);
      lite *= lerp(1, 0.72, prog(T, h.gift.depart - 0.2, h.gift.depart + 0.9));
      if (h.gift.floor === 0) s5_glow(ctx, x0 + h.w / 2, S5_GY + 34, 230, '#ffb347', 0.35 * gs.light * (0.4 + gs.open), 52);
    }
    s5_glow(ctx, x0 + h.w / 2, S5_GY + 30, h.w * 0.62, '#ff9e3d', 0.28 * lite, 48);
    // soft vertical reflections of the lit lattice on the worn stones
    s5_glow(ctx, x0 + h.w * 0.3, S5_GY + 90, 34, '#ffb347', 0.16 * lite, 110);
    s5_glow(ctx, x0 + h.w * 0.7, S5_GY + 90, 34, '#ffb347', 0.16 * lite, 110);
    if (h.vend) s5_glow(ctx, (h.doorLeft ? x0 + h.w - 12 : x0 - 2), S5_GY + 40, 170, '#9fd8ff', 0.18, 40);
  }
}
function s5_street(ctx, t, T) {
  const S = s5_S(t);
  vGradient(ctx, -200, S5_GY, W + 400, H - S5_GY + 500, [[0, '#262c44'], [0.1, '#1c2138'], [0.5, '#0d1020'], [1, '#0a0c18']]);
  // gutter
  ctx.fillStyle = '#30364e'; ctx.fillRect(0, S5_GY, W, 10);
  ctx.fillStyle = '#141828'; ctx.fillRect(0, S5_GY + 10, W, 6);
  // paving rows with depth parallax
  ctx.strokeStyle = 'rgba(8,10,20,0.55)';
  ctx.lineWidth = 2;
  let y = S5_GY + 16, k = 0;
  while (y < H + 320) {
    const hgt = 16 + (y - S5_GY) * 0.12;
    const p = 1 + (y - S5_GY) / (H - S5_GY) * 0.55;
    const len = 110 + (y - S5_GY) * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(W, y);
    const off = ((-S * p + (k % 2) * len * 0.5) % len + len) % len;
    for (let x = off - len; x < W + len; x += len) { ctx.moveTo(x, y); ctx.lineTo(x, y + hgt); }
    ctx.stroke();
    y += hgt; k++;
  }
  // subtle stone highlight
  vGradient(ctx, 0, S5_GY + 16, W, 60, [[0, 'rgba(90,110,170,0.10)'], [1, 'rgba(90,110,170,0)']]);
}
// telephone poles with wires and festival lantern garlands (parallax 1.05)
function s5_poles(ctx, t, T, pass) {
  const p = 1.05, S = s5_S(t) * p;
  const span = 980, base = S5_GY + 30;
  const i0 = Math.floor((S - 400) / span), i1 = Math.floor((S + W + 400) / span);
  const px = (i) => i * span + 520 + (hash(i * 5 + 1) - 0.5) * 160 - S;
  const top = 70;
  if (pass === 'wires') {
    ctx.save();
    ctx.strokeStyle = 'rgba(6,8,18,0.85)';
    for (let i = i0 - 1; i <= i1; i++) {
      const a = px(i), b = px(i + 1);
      if (b < -50 || a > W + 50) continue;
      const ys = [top + 50, top + 50, top + 85, top + 190];
      const xs = [-56, 56, 0, 0];
      ys.forEach((yy, j) => {
        ctx.lineWidth = j === 3 ? 4 : 2;
        const sag = 34 + j * 10 + hash(i * 3 + j) * 20;
        ctx.beginPath(); ctx.moveTo(a + xs[j], yy); ctx.quadraticCurveTo((a + b) / 2, yy + sag * 2, b + xs[j], yy); ctx.stroke();
      });
      // lantern garland on some spans
      if (hash(i * 13 + 2) < 0.6) {
        const yy = top + 150, sag = 70;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(a, yy); ctx.quadraticCurveTo((a + b) / 2, yy + sag * 2, b, yy); ctx.stroke();
        const n = 12;
        for (let k = 1; k < n; k++) {
          const u = k / n;
          const x = lerp(a, b, u), y = yy + sag * 2 * 2 * u * (1 - u) * 1;
          const col = k % 2 ? '#d8394a' : '#f0e2c0';
          s5_chochin(ctx, x, y, 0.42, T, i * 20 + k, col, false);
        }
      }
    }
    ctx.restore();
    return;
  }
  for (let i = i0; i <= i1; i++) {
    const x = px(i);
    if (x < -120 || x > W + 120) continue;
    ctx.fillStyle = '#12141f';
    ctx.beginPath(); ctx.moveTo(x - 13, base); ctx.lineTo(x - 9, top); ctx.lineTo(x + 9, top); ctx.lineTo(x + 13, base); ctx.fill();
    ctx.fillStyle = 'rgba(120,150,210,0.25)'; ctx.fillRect(x - 9, top, 3, base - top);
    ctx.fillStyle = '#12141f';
    ctx.fillRect(x - 70, top + 44, 140, 9);
    ctx.fillRect(x - 40, top + 80, 80, 7);
    ctx.fillStyle = '#8a93a8';
    for (const dx of [-56, -20, 20, 56]) ctx.fillRect(x + dx - 3, top + 36, 6, 9);
    if (hash(i * 7) < 0.5) { ctx.fillStyle = '#1a1e2c'; ctx.fillRect(x + 12, top + 110, 36, 58); }
    // step bolts
    ctx.fillStyle = '#0a0b12';
    for (let yy = base - 250; yy > top + 180; yy -= 44) ctx.fillRect(x + (yy % 88 ? 9 : -17), yy, 8, 3);
    // street lamp
    if (hash(i * 9 + 4) < 0.7) {
      const ly = top + 260;
      ctx.strokeStyle = '#12141f'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x, ly); ctx.quadraticCurveTo(x + 50, ly - 20, x + 70, ly + 4); ctx.stroke();
      ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.ellipse(x + 70, ly + 9, 12, 5, 0, 0, TAU); ctx.fill();
      s5_glow(ctx, x + 70, ly + 12, 150, '#ffe0a0', 0.4);
      s5_glow(ctx, x + 70, ly + 12, 40, '#fff4d6', 0.6);
      s5_glow(ctx, x + 70, base + 20, 260, '#ffd28a', 0.2, 50);
    }
  }
}
// fast, blurred foreground elements (parallax 1.65). Pre-blurred sprites are
// cached once (identical whichever frame builds them). Each element is scheduled
// by the time it sweeps past Hina so it never hides a story beat.
const S5_FGP = 1.65;
const S5_FG = [
  [31.75, 'post'], [33.9, 'cluster'], [35.55, 'post'], [37.95, 'cluster'], [39.05, 'post'], [40.15, 'cluster'], [41.0, 'cluster'],
];
const S5_FGC = {};
function s5_fgSprite(kind) {
  if (S5_FGC[kind]) return S5_FGC[kind];
  const c = document.createElement('canvas');
  const cw = kind === 'post' ? 360 : 640, ch = kind === 'post' ? H + 80 : 360;
  c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  g.filter = 'blur(7px)';
  if (kind === 'post') {
    g.fillStyle = '#07060c';
    g.fillRect(60, 0, 64, ch);
    g.fillStyle = 'rgba(255,170,90,0.14)';
    g.fillRect(116, 0, 8, ch);
    g.fillRect(40, 150, 110, 14);
    s5_chochin(g, 190, 70, 2.1, 0, 3);
  } else {
    g.strokeStyle = '#05050a'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(40, 20); g.quadraticCurveTo(320, 150, 600, 20); g.stroke();
    s5_chochin(g, 200, 70, 1.8, 0, 1);
    s5_chochin(g, 430, 72, 1.9, 0, 2, '#f0e2c0');
  }
  S5_FGC[kind] = c;
  return c;
}
function s5_foreground(ctx, t, T) {
  const S = s5_S(t) * S5_FGP;
  for (const [tp, kind] of S5_FG) {
    const wx = s5_S(tp - 31) * S5_FGP + s5_hinaX(tp - 31);
    const x = wx - S;
    if (x < -700 || x > W + 700) continue;
    const spr = s5_fgSprite(kind);
    ctx.save();
    if (kind === 'post') {
      ctx.drawImage(spr, x - 92, -40);
    } else {
      const sway = 0.03 * Math.sin(T * 1.9 + tp);
      ctx.translate(x, -30);
      ctx.rotate(sway);
      ctx.drawImage(spr, -320, 0);
    }
    ctx.restore();
  }
}

// ---------- main ----------
registerScene('s5', {
  draw(ctx, t, T, d) {
    const L = s5_lanternAt(t, T);
    const gl = s5_lanternGlow(T);
    ctx.save();
    // camera: slight run bob, then a quick low-angle push-in on the lantern
    const push = Ease.inOutCubic(invLerp(40.35, 41.5, T));
    const zoom = 1 + 0.26 * push;
    const bob = 3 * Math.sin(s5_runPhase(t) * TAU * 2);
    const fx = lerp(W / 2, L.x + 60, push), fy = lerp(H / 2, S5_FY - 230, push);
    ctx.translate(W / 2, H / 2 + bob + 90 * push);
    ctx.rotate(-0.03 * push);
    ctx.scale(zoom, zoom);
    ctx.translate(-fx, -fy);
    if (push > 0) ctx.translate((W / 2 - fx) * 0, 0);

    s5_sky(ctx, t, T);
    s5_hill(ctx, t, T);
    s5_farRoofs(ctx, t, T);
    s5_poles(ctx, t, T, 'wires');
    s5_facades(ctx, t, T);
    s5_street(ctx, t, T);
    s5_pools(ctx, t, T);
    s5_props(ctx, t, T);
    s5_poles(ctx, t, T, 'poles');

    // lantern light: pool on the street + light wash on the facades
    s5_glow(ctx, L.x, S5_FY + 4, 240 + 120 * gl, '#ffb347', 0.32 + 0.18 * gl, 46 + 18 * gl);
    s5_glow(ctx, L.x, L.y, 380 + 260 * gl, '#ff9e3d', 0.14 + 0.1 * gl);

    // orbs behind Hina? no: all orbs fly in front, but the drift layer sits behind
    s5_drawDrift(ctx, t, T);

    // Hina
    const o = s5_hinaOpts(t, T);
    // contact shadow
    ctx.fillStyle = 'rgba(5,6,15,0.45)';
    ctx.beginPath(); ctx.ellipse(o.x, S5_FY + 4, 90, 12, 0, 0, TAU); ctx.fill();
    drawHina(ctx, o);
    s5_glow(ctx, L.x, L.y, 110 + 60 * gl, '#ffd76a', 0.35 + 0.2 * clamp(gl - 0.6));

    for (const ob of S5_SWARM) s5_drawOrb(ctx, ob, T);
    for (const ob of S5_MAIN) s5_drawOrb(ctx, ob, T);
    s5_drawArrivalBursts(ctx, t, T);

    s5_foreground(ctx, t, T);

    // blaze + flood
    const blaze = prog(T, 39.4, 41.3, Ease.inQuad);
    s5_glow(ctx, L.x, L.y, 500 + 1600 * blaze, '#ffb347', 0.35 * blaze);
    s5_glow(ctx, L.x, L.y, 200 + 700 * blaze, '#ffe7a8', 0.5 * blaze);
    ctx.restore();
    const flood = 0.85 * prog(T, 40.6, 41.5, Ease.inQuad) + 0.15 * prog(T, 41.5, 42.2);
    if (flood > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const Lx = W / 2 + (L.x - fx) * zoom, Ly = H / 2 + 90 * push + (L.y - fy) * zoom;
      const g = ctx.createRadialGradient(Lx, Ly, 0, Lx, Ly, 400 + 1500 * flood);
      g.addColorStop(0, rgba('#fff6dc', 0.95 * flood));
      g.addColorStop(0.4, rgba('#ffd28a', 0.6 * flood));
      g.addColorStop(1, rgba('#ff9e3d', 0.25 * flood));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  },
});
