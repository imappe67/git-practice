// Scene s2 — Hilltop: the shooting star (7.0–13.5).
// This file also holds the shared HILLTOP set painter (s26_*) used by s6.
'use strict';

// =====================================================================
//                    SHARED HILLTOP SET  (s26_*)
// =====================================================================
// World space = the "wide" 1920x1080 composition. Each depth layer has a
// parallax factor p (0 = infinitely far, 1 = foreground/actors). The camera
// {x, y, zoom, rot, shake, T} is applied fully at p=1 and partially below.
const S26 = { cache: {} };
const S26_VALLEY_P = 0.4;     // parallax of the valley floor (impact site lives here)

function s26_camT(cam, p) {
  const z = 1 + ((cam.zoom || 1) - 1) * p;
  const cx = W / 2 + ((cam.x ?? W / 2) - W / 2) * p;
  const cy = H / 2 + ((cam.y ?? H / 2) - H / 2) * p;
  const sh = cam.shake || 0, T = cam.T || 0;
  const sx = sh * noise1(T * 25, 11) * 22 * (0.3 + 0.7 * p);
  const sy = sh * noise1(T * 25, 23) * 22 * (0.3 + 0.7 * p);
  return { z, cx, cy, sx, sy, rot: (cam.rot || 0) * p };
}
// draw only the visible part of a cached world-space canvas (1 canvas px = sc world px)
function s26_blit(ctx, cam, p, cv, x0, y0, sc = 1, ox = 0, oy = 0) {
  const a = s26_toWorld(cam, p, -40, -40), b = s26_toWorld(cam, p, W + 40, H + 40);
  const wx0 = Math.max(Math.min(a.x, b.x), x0 + ox), wy0 = Math.max(Math.min(a.y, b.y), y0 + oy);
  const wx1 = Math.min(Math.max(a.x, b.x), x0 + ox + cv.width / sc), wy1 = Math.min(Math.max(a.y, b.y), y0 + oy + cv.height / sc);
  if (wx1 <= wx0 || wy1 <= wy0) return;
  const sx = (wx0 - x0 - ox) * sc, sy = (wy0 - y0 - oy) * sc;
  ctx.drawImage(cv, sx, sy, (wx1 - wx0) * sc, (wy1 - wy0) * sc, wx0, wy0, wx1 - wx0, wy1 - wy0);
}
function s26_push(ctx, cam, p) {
  const c = s26_camT(cam, p);
  ctx.save();
  ctx.translate(W / 2 + c.sx, H / 2 + c.sy);
  if (c.rot) ctx.rotate(c.rot);
  ctx.scale(c.z, c.z);
  ctx.translate(-c.cx, -c.cy);
  return c;
}
// world(p) -> screen
function s26_toScreen(cam, p, x, y) {
  const c = s26_camT(cam, p);
  let dx = (x - c.cx) * c.z, dy = (y - c.cy) * c.z;
  if (c.rot) { const cs = Math.cos(c.rot), sn = Math.sin(c.rot); [dx, dy] = [dx * cs - dy * sn, dx * sn + dy * cs]; }
  return { x: W / 2 + c.sx + dx, y: H / 2 + c.sy + dy, z: c.z };
}
// screen -> world(p)
function s26_toWorld(cam, p, x, y) {
  const c = s26_camT(cam, p);
  let dx = x - W / 2 - c.sx, dy = y - H / 2 - c.sy;
  if (c.rot) { const cs = Math.cos(-c.rot), sn = Math.sin(-c.rot); [dx, dy] = [dx * cs - dy * sn, dx * sn + dy * cs]; }
  return { x: c.cx + dx / c.z, y: c.cy + dy / c.z };
}

// character helpers with fallbacks (character designer may add these)
function s26_headPos(o) {
  if (typeof hinaHeadPos === 'function') { const p = hinaHeadPos(o); if (p) return p; }
  const s = o.scale || 1;
  if (o.bust) return { x: o.x, y: o.y - 200 * s, r: 80 * s };
  return { x: o.x + 5 * s * (o.facing || 1), y: o.y - 330 * s, r: 75 * s };
}
function s26_lanternPos(o) {
  if (typeof hinaLanternPos === 'function' && o.lantern) { const p = hinaLanternPos(o); if (p) return p; }
  return s26_handPos(o);
}
function s26_handPos(o) {
  if (typeof hinaHandPos === 'function') { const p = hinaHandPos(o); if (p) return p; }
  const s = o.scale || 1, f = o.facing || 1;
  return { x: o.x + 70 * s * f, y: o.y - (120 + 140 * (o.armRaise || 0)) * s };
}

// ---- wind: bend (radians-ish) of grass at x ----
function s26_wind(x, T, strength, bias = 0) {
  const gust = noise1(x * 0.0035 - T * 1.1, 5) * 0.5 + 0.5;
  const flutter = Math.sin(T * 5.3 + x * 0.045) * 0.06 + noise1(x * 0.03 + T * 3, 9) * 0.07;
  return strength * (0.12 + 0.55 * gust + flutter) + bias;
}

// crest of the hill (foreground far edge), world coords
function s26_crestY(x) {
  return 792 + x * 0.058 + 16 * fbm1(x * 0.0045, 3) - 30 * Math.exp(-(((x - 330) / 300) ** 2));
}

// light contribution at a point: lights = [{x,y,r,a,color}]
function s26_lightAt(lights, x, y) {
  let k = 0;
  for (const L of lights) {
    const d = Math.hypot(x - L.x, (y - L.y) * 1.3);
    const f = clamp(1 - d / L.r);
    k += f * f * L.a;
  }
  return clamp(k);
}

// ---------------- sky ----------------
const S26_SKY_PAD = 700;
function s26_skyStatic() {
  if (S26.cache.sky) return S26.cache.sky;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H + S26_SKY_PAD * 2;
  const c = cv.getContext('2d');
  const P = S26_SKY_PAD, HH = cv.height;
  const g = c.createLinearGradient(0, 0, 0, HH);
  g.addColorStop(0, '#02040f'); g.addColorStop(P / HH, '#040820');
  g.addColorStop((P + H * 0.55) / HH, '#11275a'); g.addColorStop((P + H) / HH, '#2b4a7a'); g.addColorStop(1, '#34568a');
  c.fillStyle = g; c.fillRect(0, 0, W, HH);
  const r = rng(26);
  c.globalCompositeOperation = 'lighter';
  // milky way: broad glow band + dust
  for (let i = 0; i < 90; i++) {
    const u = r();
    const x = lerp(W * 1.1, -W * 0.1, u) + (r() - 0.5) * 260;
    const y = lerp(P - 300, P + H * 0.75, u) + (r() - 0.5) * 220;
    glow(c, x, y, 120 + r() * 200, i % 3 ? '#6f7fd8' : '#b58ad8', 0.045 + r() * 0.04);
  }
  for (let i = 0; i < 1800; i++) {
    const u = r();
    const x = lerp(W * 1.1, -W * 0.1, u) + (r() - 0.5) * 380 * (r() + 0.3);
    const y = lerp(P - 300, P + H * 0.75, u) + (r() - 0.5) * 300 * (r() + 0.3);
    c.fillStyle = `rgba(220,225,255,${0.15 + r() * 0.4})`;
    c.fillRect(x, y, 1.2, 1.2);
  }
  // dark dust lane
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 30; i++) {
    const u = i / 29;
    const x = lerp(W * 1.05, W * 0.1, u) + (r() - 0.5) * 60, y = lerp(P - 200, P + H * 0.7, u) + (r() - 0.5) * 50;
    const gg = c.createRadialGradient(x, y, 0, x, y, 70 + r() * 40);
    gg.addColorStop(0, 'rgba(4,8,28,0.28)'); gg.addColorStop(1, 'rgba(4,8,28,0)');
    c.fillStyle = gg; c.fillRect(x - 120, y - 120, 240, 240);
  }
  // static field stars
  for (let i = 0; i < 2600; i++) {
    const x = r() * W, y = r() * HH, s = r();
    const size = 0.6 + s * s * 1.6;
    const col = r() < 0.2 ? '255,230,196' : r() < 0.2 ? '196,216,255' : '255,255,255';
    c.fillStyle = `rgba(${col},${0.25 + s * 0.6})`;
    c.fillRect(x - size / 2, y - size / 2, size, size);
  }
  S26.cache.sky = cv;
  return cv;
}
function s26_sky(ctx, T, cam) {
  const c = s26_camT(cam, 0.06);
  const yOff = (H / 2 - c.cy) * 1.5 + 40;
  ctx.drawImage(s26_skyStatic(), 0, -S26_SKY_PAD + yOff);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const r = rng(2626);
  // live twinkling stars
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = r() * (H + 400) - 200 + yOff, s = r();
    const tw = 0.5 + 0.5 * Math.sin(T * (1 + r() * 3) + r() * TAU);
    if (y < -10 || y > H) continue;
    const size = 1.2 + s * 1.6;
    ctx.fillStyle = `rgba(255,250,235,${0.8 * tw})`;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
  // a few bright coloured stars with sparkle
  for (let i = 0; i < 30; i++) {
    const x = r() * W, y = r() * H * 0.7 + yOff - 60;
    const tw = 0.6 + 0.4 * Math.sin(T * (0.8 + r() * 2) + r() * 9);
    const col = r() < 0.4 ? '#ffe6b0' : r() < 0.5 ? '#bcd4ff' : '#ffffff';
    const s = 1.5 + r() * 2.5;
    glow(ctx, x, y, s * 9, col, 0.16 * tw);
    sparkle(ctx, x, y, s * 3.2, col, 0.8 * tw, r() * 0.3);
  }
  ctx.restore();
  // horizon warm haze from the village
  const hz = s26_toScreen(cam, S26_VALLEY_P, 0, 700).y;
  const g = ctx.createLinearGradient(0, hz - 260, 0, hz + 40);
  g.addColorStop(0, 'rgba(90,120,190,0)');
  g.addColorStop(1, 'rgba(120,140,200,0.22)');
  ctx.fillStyle = g;
  ctx.fillRect(0, hz - 260, W, 300);
}

// ---------------- mountains & valley ----------------
function s26_ridgePath(ctx, seed, base, amp, freq, x0 = -900, x1 = 2800) {
  ctx.beginPath();
  ctx.moveTo(x0, 1400);
  for (let x = x0; x <= x1; x += 10) {
    const y = base - amp * (0.55 + fbm1(x * freq, seed, 5)) - amp * 0.35 * Math.sin(x * freq * 0.35 + seed);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(x1, 1400);
  ctx.closePath();
}
const S26_MTN = [
  { p: 0.08, seed: 61, base: 610, amp: 120, freq: 0.0021, col: '#34568f', mist: 'rgba(130,160,215,0.30)' },
  { p: 0.15, seed: 62, base: 650, amp: 95, freq: 0.0029, col: '#26407a', mist: 'rgba(110,140,200,0.24)' },
  { p: 0.25, seed: 63, base: 690, amp: 60, freq: 0.0042, col: '#1b2f5e', mist: 'rgba(90,120,185,0.20)' },
];
const S26_MX0 = -700, S26_MW = 3300;
function s26_mountainStatic(i) {
  const k = 'mtn' + i;
  if (S26.cache[k]) return S26.cache[k];
  const L = S26_MTN[i];
  const top = Math.floor(L.base - L.amp * 2.2), bot = 1250;
  const cv = document.createElement('canvas');
  cv.width = S26_MW; cv.height = bot - top;
  const c = cv.getContext('2d');
  c.translate(-S26_MX0, -top);
  s26_ridgePath(c, L.seed, L.base, L.amp, L.freq, S26_MX0, S26_MX0 + S26_MW);
  const g = c.createLinearGradient(0, L.base - L.amp * 1.6, 0, L.base + 60);
  g.addColorStop(0, L.col);
  g.addColorStop(1, mixColor(L.col, '#6f8fca', 0.35));
  c.fillStyle = g;
  c.fill();
  // moonlit rim on the ridge line
  c.save(); c.clip();
  c.strokeStyle = 'rgba(150,180,235,0.35)'; c.lineWidth = 3;
  c.stroke();
  c.restore();
  const m = c.createLinearGradient(0, L.base - 30, 0, L.base + 40);
  m.addColorStop(0, 'rgba(0,0,0,0)');
  m.addColorStop(1, L.mist);
  c.fillStyle = m;
  c.fillRect(S26_MX0, L.base - 30, S26_MW, bot - L.base + 30);
  S26.cache[k] = { cv, top };
  return S26.cache[k];
}
function s26_mountains(ctx, cam) {
  S26_MTN.forEach((L, i) => {
    const { cv, top } = s26_mountainStatic(i);
    s26_push(ctx, cam, L.p);
    s26_blit(ctx, cam, L.p, cv, S26_MX0, top);
    ctx.restore();
  });
}

// static valley floor, cached to an offscreen canvas (identical every frame)
const S26_VX0 = -600, S26_VY0 = 560, S26_VW = 3100, S26_VH = 620;
function s26_valleyData() {
  if (S26.cache.vdata) return S26.cache.vdata;
  const r = rng(707);
  const paddies = [];
  // terraced paddies: rows get taller towards the viewer
  let y = 702;
  for (let j = 0; j < 10; j++) {
    const rh = 4 + j * 2.6;
    let x = S26_VX0 + r() * 60;
    while (x < S26_VX0 + S26_VW) {
      const w = (40 + r() * 120) * (1 + j * 0.2);
      if (!(x > 330 && x < 1000 && j < 4) || r() < 0.25) paddies.push({ x, y, w, h: rh, sk: (r() - 0.5) * 16, lv: r() });
      x += w + 2 + j * 0.5;
    }
    y += rh + 1.6 + j * 0.45;
  }
  const houses = [];
  for (let i = 0; i < 34; i++) {
    const hx = 360 + r() * 640 + (r() < 0.3 ? r() * 700 - 350 : 0);
    const hy = 706 + r() * 34 + (Math.abs(hx - 680) > 330 ? 20 : 0);
    houses.push({ x: hx, y: hy, w: 16 + r() * 22, h: 8 + r() * 7, thatch: r() < 0.4, win: r() < 0.75, wr: r(), seed: i });
  }
  houses.sort((a, b) => a.y - b.y);
  const trees = [];
  for (let i = 0; i < 60; i++) trees.push({ x: S26_VX0 + 300 + r() * 2600, y: 696 + r() * 60, r: 7 + r() * 14 });
  S26.cache.vdata = { paddies, houses, trees };
  return S26.cache.vdata;
}
function s26_valleyStatic() {
  if (S26.cache.valley) return S26.cache.valley;
  const cv = document.createElement('canvas');
  cv.width = S26_VW; cv.height = S26_VH;
  const c = cv.getContext('2d');
  c.translate(-S26_VX0, -S26_VY0);
  const { paddies, houses, trees } = s26_valleyData();
  // valley floor
  const g = c.createLinearGradient(0, 690, 0, 1100);
  g.addColorStop(0, '#223c70'); g.addColorStop(0.3, '#162c55'); g.addColorStop(1, '#0c1c38');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(S26_VX0, 700);
  for (let x = S26_VX0; x <= S26_VX0 + S26_VW; x += 20) c.lineTo(x, 694 + 6 * noise1(x * 0.01, 4));
  c.lineTo(S26_VX0 + S26_VW, S26_VY0 + S26_VH); c.lineTo(S26_VX0, S26_VY0 + S26_VH); c.closePath();
  c.fill();
  // paddies mirroring the sky
  for (const P of paddies) {
    const pg = c.createLinearGradient(0, P.y, 0, P.y + P.h);
    const dk = invLerp(700, 860, P.y);
    pg.addColorStop(0, mixColor(mixColor('#2f4f88', '#4a6ca8', P.lv * 0.9).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, g, b) => '#' + [r, g, b].map((v) => (+v).toString(16).padStart(2, '0')).join('')), '#16284e', dk * 0.55));
    pg.addColorStop(1, mixColor('#142850', '#1d3868', P.lv * (1 - dk * 0.6)));
    c.fillStyle = pg;
    c.beginPath();
    c.moveTo(P.x + P.sk, P.y); c.lineTo(P.x + P.w + P.sk, P.y);
    c.lineTo(P.x + P.w, P.y + P.h); c.lineTo(P.x, P.y + P.h); c.closePath();
    c.fill();
    c.fillStyle = 'rgba(150,180,235,0.22)';
    c.fillRect(P.x + P.sk + 2, P.y, P.w - 4, 0.8);
  }
  // tree clumps
  for (const t of trees) {
    c.fillStyle = '#11234a';
    c.beginPath(); c.ellipse(t.x, t.y, t.r * 1.3, t.r, 0, Math.PI, 0); c.fill();
    c.beginPath(); c.arc(t.x - t.r * 0.5, t.y - t.r * 0.4, t.r * 0.7, 0, TAU); c.arc(t.x + t.r * 0.6, t.y - t.r * 0.3, t.r * 0.6, 0, TAU); c.fill();
  }
  // telephone poles & wires
  c.strokeStyle = 'rgba(12,24,50,0.9)';
  c.lineWidth = 1.4;
  const poles = [];
  for (let i = 0; i < 9; i++) poles.push({ x: 180 + i * 190, y: 760 + i * 4, h: 34 });
  for (const pl of poles) { c.beginPath(); c.moveTo(pl.x, pl.y); c.lineTo(pl.x, pl.y - pl.h); c.stroke(); c.beginPath(); c.moveTo(pl.x - 6, pl.y - pl.h + 4); c.lineTo(pl.x + 6, pl.y - pl.h + 4); c.stroke(); }
  c.lineWidth = 0.7;
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i], b = poles[i + 1];
    for (const o of [-5, 5]) {
      c.beginPath(); c.moveTo(a.x + o, a.y - a.h + 4);
      c.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - a.h + 14, b.x + o, b.y - b.h + 4); c.stroke();
    }
  }
  // houses
  for (const h of houses) {
    const { x, y, w, h: hh } = h;
    c.fillStyle = '#16274c';
    c.fillRect(x - w / 2, y - hh, w, hh);
    c.fillStyle = h.thatch ? '#1d2a44' : '#0f1c3c';
    c.beginPath();
    if (h.thatch) { c.moveTo(x - w * 0.62, y - hh); c.lineTo(x - w * 0.2, y - hh - w * 0.45); c.lineTo(x + w * 0.2, y - hh - w * 0.45); c.lineTo(x + w * 0.62, y - hh); }
    else { c.moveTo(x - w * 0.66, y - hh + 1); c.quadraticCurveTo(x - w * 0.3, y - hh - 2, x - w * 0.3, y - hh - w * 0.3); c.lineTo(x + w * 0.3, y - hh - w * 0.3); c.quadraticCurveTo(x + w * 0.3, y - hh - 2, x + w * 0.66, y - hh + 1); }
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(120,150,210,0.35)';
    c.fillRect(x - w * 0.4, y - hh - (h.thatch ? w * 0.45 : w * 0.3), w * 0.8, 1);
  }
  // little shrine torii
  c.fillStyle = '#8a2b34';
  const tx = 1010, ty = 742;
  c.fillRect(tx - 9, ty - 16, 2, 16); c.fillRect(tx + 7, ty - 16, 2, 16);
  c.fillRect(tx - 12, ty - 18, 24, 2.2); c.fillRect(tx - 10, ty - 13, 20, 1.4);
  S26.cache.valley = cv;
  return cv;
}
function s26_valley(ctx, T, cam, opt) {
  s26_push(ctx, cam, S26_VALLEY_P);
  s26_blit(ctx, cam, S26_VALLEY_P, s26_valleyStatic(), S26_VX0, S26_VY0);
  const { paddies, houses } = s26_valleyData();
  // star reflections twinkling in the paddies
  const r = rng(99);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 140; i++) {
    const P = paddies[(r() * paddies.length) | 0];
    const x = P.x + r() * P.w, y = P.y + 1 + r() * (P.h - 2);
    const tw = 0.5 + 0.5 * Math.sin(T * (1 + r() * 3) + r() * 9);
    ctx.fillStyle = `rgba(230,238,255,${0.55 * tw})`;
    ctx.fillRect(x, y, 1.6, 1.1);
  }
  // warm windows
  const dim = opt.villageDim ?? 0;
  for (const h of houses) {
    if (!h.win) continue;
    const fl = 0.85 + 0.15 * noise1(T * 2 + h.seed * 3, h.seed);
    const a = (1 - dim) * fl;
    const wx = h.x - h.w * 0.25 + h.wr * h.w * 0.2, wy = h.y - h.h * 0.7;
    ctx.fillStyle = rgba('#ffc36b', 0.95 * a);
    ctx.fillRect(wx, wy, 3 + h.wr * 3, 3);
    glow(ctx, wx + 2, wy + 1.5, 14, '#ffb347', 0.35 * a);
    // reflection of the window light in the paddy below
    ctx.fillStyle = rgba('#ffb347', 0.18 * a);
    ctx.fillRect(wx, h.y + 3, 3, 5);
  }
  ctx.restore();
  if (opt.valleyFx) opt.valleyFx(ctx);
  ctx.restore();
}

// dark forested slope between the hill and the valley (p=0.62)
function s26_treeline(ctx, T, cam) {
  s26_push(ctx, cam, 0.62);
  if (!S26.cache.tl) {
    const r = rng(314), pts = [];
    for (let x = -700; x <= 2700; x += 14 + r() * 22) pts.push({ x, y: 842 + 26 * fbm1(x * 0.003, 8) - 18 * r() + (x > 1150 && x < 1550 ? 26 : 0), r: 10 + r() * 16 });
    S26.cache.tl = pts;
  }
  const pts = S26.cache.tl;
  ctx.fillStyle = '#0d1f38';
  ctx.beginPath();
  ctx.moveTo(-700, 1300);
  for (const q of pts) ctx.lineTo(q.x, q.y + q.r * 0.3);
  ctx.lineTo(2700, 1300); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  for (const q of pts) { ctx.moveTo(q.x + q.r, q.y); ctx.arc(q.x, q.y, q.r, 0, TAU); }
  ctx.fill();
  // faint mist over it
  const m = ctx.createLinearGradient(0, 800, 0, 900);
  m.addColorStop(0, 'rgba(90,120,180,0.18)'); m.addColorStop(1, 'rgba(90,120,180,0)');
  ctx.fillStyle = m; ctx.fillRect(-700, 800, 3400, 100);
  ctx.restore();
}

// ---------------- lit actor: rim light + shading via an offscreen mask ----------------
function s26_buf(name) {
  const k = 'buf_' + name;
  if (!S26.cache[k]) { const c = document.createElement('canvas'); c.width = W; c.height = H; S26.cache[k] = c; }
  return S26.cache[k];
}
// draw(ctx) is rendered with the current transform into a buffer, then composited
// with a rim light from screen direction (lx,ly) (unit vector towards the light).
// o: { lx, ly, rim:'#hex', rimA, width(px), shade:'#hex', shadeA, blur }
function s26_litActor(ctx, draw, o) {
  const A = s26_buf('act'), R = s26_buf('rim');
  const a = A.getContext('2d'), r = R.getContext('2d');
  // working region in screen px (defaults to full frame)
  let bx = 0, by = 0, bw = W, bh = H;
  if (o.box) {
    bx = Math.max(0, Math.floor(o.box.x)); by = Math.max(0, Math.floor(o.box.y));
    bw = Math.min(W, Math.ceil(o.box.x + o.box.w)) - bx; bh = Math.min(H, Math.ceil(o.box.y + o.box.h)) - by;
    if (bw <= 0 || bh <= 0) return;
  }
  a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-over'; a.globalAlpha = 1; a.filter = 'none';
  a.clearRect(bx, by, bw, bh);
  a.save();
  a.beginPath(); a.rect(bx, by, bw, bh); a.clip();
  a.setTransform(ctx.getTransform());
  draw(a);
  a.restore();
  a.setTransform(1, 0, 0, 1, 0, 0);
  const wdt = o.width || 6;
  if (o.rimA > 0) {
    r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'source-over'; r.globalAlpha = 1;
    r.clearRect(bx, by, bw, bh);
    r.drawImage(A, bx, by, bw, bh, bx, by, bw, bh);
    r.globalCompositeOperation = 'destination-out';
    r.drawImage(A, bx, by, bw, bh, bx - o.lx * wdt, by - o.ly * wdt, bw, bh);
    r.globalCompositeOperation = 'source-in';
    r.fillStyle = o.rim || '#ffd28a';
    r.fillRect(bx, by, bw, bh);
    r.globalCompositeOperation = 'source-over';
  }
  if (o.shadeA > 0) {
    a.globalCompositeOperation = 'source-atop';
    a.fillStyle = rgba(o.shade || '#0a1030', o.shadeA);
    a.fillRect(bx, by, bw, bh);
    a.globalCompositeOperation = 'source-over';
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(A, bx, by, bw, bh, bx, by, bw, bh);
  if (o.rimA > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(o.rimA);
    ctx.drawImage(R, bx, by, bw, bh, bx, by, bw, bh);
    if (o.blur !== 0) {
      // cheap soft bloom: a few offset copies at low alpha
      const bl = o.blur || 4;
      ctx.globalAlpha = clamp(o.rimA) * 0.45;
      for (const [ddx, ddy] of [[bl, bl * 0.5], [-bl, -bl * 0.5]]) ctx.drawImage(R, bx, by, bw, bh, bx + ddx, by + ddy, bw, bh);
    }
  }
  ctx.restore();
}
// screen-space box around a standing Hina drawn with options o under camera cam (p=1)
function s26_hinaBox(cam, o) {
  const s = o.scale || 1;
  const a = s26_toScreen(cam, 1, o.x - 210 * s, o.y - 520 * s), b = s26_toScreen(cam, 1, o.x + 230 * s, o.y + 20 * s);
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

// ---------------- the camphor tree ----------------
function s26_treeData() {
  if (S26.cache.tree) return S26.cache.tree;
  const r = rng(4242);
  const clusters = [];
  // canopy domain: a big lopsided dome
  for (let i = 0; i < 95; i++) {
    const a = r(), b = r();
    const x = lerp(-320, 960, a) + (r() - 0.5) * 60;
    const edge = 1 - Math.abs((a - 0.42) / 0.62) ** 2;            // dome height profile
    const top = lerp(400, -220, clamp(edge)) + (r() - 0.5) * 50;
    const y = lerp(top + 40, 400 - 50 * (1 - edge), b ** 1.3);
    const rad = 55 + r() * 85 * (0.6 + 0.4 * edge);
    const subs = [];
    const n = 6 + ((r() * 4) | 0);
    for (let k = 0; k < n; k++) {
      const ang = r() * TAU, dd = r() * rad * 0.55;
      subs.push({ dx: Math.cos(ang) * dd, dy: Math.sin(ang) * dd * 0.7, r: rad * (0.38 + r() * 0.3) });
    }
    clusters.push({ x, y, r: rad, subs, ph: r() * 100, depth: b });
  }
  // back clusters first (smaller y & low depth)
  clusters.sort((p, q) => (p.y + p.depth * 200) - (q.y + q.depth * 200));
  S26.cache.tree = { clusters };
  return S26.cache.tree;
}
function s26_clusterPath(ctx, C, ox, oy, sc) {
  ctx.beginPath();
  for (const s of C.subs) {
    const cx = C.x + s.dx * sc + ox, cy = C.y + s.dy * sc + oy, rr = s.r * sc;
    ctx.moveTo(cx + rr, cy);
    ctx.arc(cx, cy, rr, 0, TAU);
    // leafy scallops on the rim
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * TAU + C.ph;
      const lx = cx + Math.cos(a) * rr * 0.98, ly = cy + Math.sin(a) * rr * 0.98;
      ctx.moveTo(lx + rr * 0.22, ly);
      ctx.ellipse(lx, ly, rr * 0.22, rr * 0.15, a, 0, TAU);
    }
  }
}
function s26_trunkPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(60, 835);
  ctx.bezierCurveTo(150, 815, 200, 790, 215, 700);
  ctx.bezierCurveTo(230, 600, 205, 520, 150, 430);
  ctx.bezierCurveTo(120, 380, 60, 330, -40, 300);
  ctx.lineTo(-20, 250);
  ctx.bezierCurveTo(90, 280, 180, 340, 240, 400);
  ctx.bezierCurveTo(250, 320, 230, 240, 190, 160);
  ctx.lineTo(240, 150);
  ctx.bezierCurveTo(290, 230, 310, 320, 305, 400);
  ctx.bezierCurveTo(360, 330, 470, 260, 620, 230);
  ctx.lineTo(630, 270);
  ctx.bezierCurveTo(500, 310, 400, 390, 370, 470);
  ctx.bezierCurveTo(350, 560, 370, 650, 395, 720);
  ctx.bezierCurveTo(420, 790, 480, 820, 560, 845);
  ctx.lineTo(60, 845);
  ctx.closePath();
}
function s26_tree(ctx, T, o) {
  const lights = o.lights || [];
  const wind = o.wind || 0.2;
  const { clusters } = s26_treeData();
  // trunk & branches (rim colour first, then the body shifted away from the light)
  const tg = ctx.createLinearGradient(100, 0, 420, 0);
  tg.addColorStop(0, '#08141d'); tg.addColorStop(0.55, '#0f2230'); tg.addColorStop(1, '#1a3444');
  ctx.save();
  s26_trunkPath(ctx);
  ctx.fillStyle = '#3f6f88';
  ctx.fill();
  ctx.clip();
  ctx.translate(-7, 4);
  ctx.fillStyle = tg;
  s26_trunkPath(ctx); ctx.fill();
  ctx.translate(7, -4);
  // bark streaks
  ctx.strokeStyle = 'rgba(60,95,110,0.28)';
  ctx.lineWidth = 3;
  const r = rng(77);
  for (let i = 0; i < 26; i++) {
    const x = 190 + r() * 200, y0 = 480 + r() * 200;
    ctx.beginPath(); ctx.moveTo(x, y0);
    ctx.bezierCurveTo(x + (r() - 0.5) * 30, y0 + 60, x + (r() - 0.5) * 40, y0 + 120, x - 10 + r() * 20, y0 + 150 + r() * 80);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'lighter';
  // warm light on trunk
  for (const L of lights) {
    if (L.a <= 0) continue;
    const gg = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r * 1.2);
    gg.addColorStop(0, rgba(L.color || '#ffb347', 0.35 * L.a));
    gg.addColorStop(1, rgba(L.color || '#ffb347', 0));
    ctx.fillStyle = gg;
    ctx.fillRect(0, 100, 700, 800);
  }
  ctx.restore();
  // roots
  ctx.fillStyle = '#0a1a24';
  for (const [x0, x1, y1] of [[120, 20, 850], [360, 520, 860], [240, 250, 862], [300, 400, 866]]) {
    ctx.beginPath(); ctx.moveTo(x0 - 30, 800); ctx.quadraticCurveTo((x0 + x1) / 2, 830, x1, y1); ctx.quadraticCurveTo((x0 + x1) / 2, 815, x0 + 30, 800); ctx.fill();
  }
  // shimenawa (sacred rope) around the trunk
  s26_shimenawa(ctx, T, wind, lights);

  // canopy (cached layers, swaying independently)
  s26_canopy(ctx, T, wind, lights, o.cam);
}
const S26_CAN = { x0: -620, y0: -500, w: 1950, h: 1230, sc: 1, layers: 2, wsc: 0.35 };
function s26_canopyStatic() {
  if (S26.cache.canopy) return S26.cache.canopy;
  const { clusters } = s26_treeData();
  const mk = () => {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(S26_CAN.w * S26_CAN.sc); cv.height = Math.ceil(S26_CAN.h * S26_CAN.sc);
    const c = cv.getContext('2d');
    c.scale(S26_CAN.sc, S26_CAN.sc); c.translate(-S26_CAN.x0, -S26_CAN.y0);
    return [cv, c];
  };
  const layers = [];
  const sil = document.createElement('canvas');
  sil.width = Math.ceil(S26_CAN.w * S26_CAN.wsc); sil.height = Math.ceil(S26_CAN.h * S26_CAN.wsc);
  const sc = sil.getContext('2d');
  sc.scale(S26_CAN.wsc, S26_CAN.wsc); sc.translate(-S26_CAN.x0, -S26_CAN.y0);
  sc.fillStyle = '#ffc070';
  const per = Math.ceil(clusters.length / S26_CAN.layers);
  for (let li = 0; li < S26_CAN.layers; li++) {
    const [cv, c] = mk();
    const r = rng(900 + li);
    for (const C of clusters.slice(li * per, (li + 1) * per)) {
      const shade = 0.5 + C.depth * 0.5;
      c.fillStyle = rgba('#5d98b0', 0.5 * shade);
      s26_clusterPath(c, C, 5, -7, 1); c.fill();
      c.fillStyle = mixColor('#06131b', '#0d2330', shade);
      s26_clusterPath(c, C, 0, 0, 1); c.fill();
      s26_clusterPath(sc, C, 0, 0, 1); sc.fill();
      c.fillStyle = mixColor('#0a1d28', '#13323f', shade);
      s26_clusterPath(c, C, C.r * 0.14, -C.r * 0.2, 0.78); c.fill();
      c.fillStyle = mixColor('#0e2632', '#19404d', shade);
      s26_clusterPath(c, C, C.r * 0.24, -C.r * 0.36, 0.46); c.fill();
      // leaf flecks catching moonlight on the upper-right of each clump
      c.fillStyle = rgba('#4f8aa0', 0.35 * shade);
      for (let k = 0; k < 26; k++) {
        const ang = -Math.PI * 0.5 + (r() - 0.35) * 1.9, d = C.r * (0.35 + r() * 0.5);
        const lx = C.x + Math.cos(ang) * d, ly = C.y + Math.sin(ang) * d * 0.8;
        c.beginPath(); c.ellipse(lx, ly, 5 + r() * 5, 2 + r() * 2, ang + 1.2 + r(), 0, TAU); c.fill();
      }
    }
    layers.push(cv);
  }
  S26.cache.canopy = { layers, sil };
  return S26.cache.canopy;
}
function s26_canopy(ctx, T, wind, lights, cam) {
  const { layers, sil } = s26_canopyStatic();
  const { x0, y0, w, h } = S26_CAN;
  // warm light from the strongest nearby light
  let best = null, bk = 0;
  for (const L of lights) { const k = s26_lightAt([{ ...L, r: L.r * 1.6 }], 450, 250); if (k > bk) { bk = k; best = L; } }
  let warm = null;
  if (best && bk > 0.01) {
    const B = s26_buf('canw');
    if (B.width !== sil.width || B.height !== sil.height) { B.width = sil.width; B.height = sil.height; }
    const b = B.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, B.width, B.height);
    b.drawImage(sil, 0, 0);
    b.globalCompositeOperation = 'source-in';
    b.scale(S26_CAN.wsc, S26_CAN.wsc); b.translate(-x0, -y0);
    const g = b.createRadialGradient(best.x, best.y, 0, best.x, best.y, best.r * 1.6);
    g.addColorStop(0, rgba(best.color || '#ffc070', 1)); g.addColorStop(0.5, rgba(best.color || '#ffc070', 0.35)); g.addColorStop(1, rgba(best.color || '#ffc070', 0));
    b.fillStyle = g; b.fillRect(x0, y0, w, h);
    const dx = best.x - 450, dy = best.y - 250, dl = Math.hypot(dx, dy) || 1;
    warm = { B, ox: dx / dl * 10, oy: dy / dl * 10, a: clamp(best.a * 1.3) };
    ctx.save();
    ctx.globalAlpha = warm.a;
    s26_blit(ctx, cam, 1, B, x0, y0, S26_CAN.wsc, warm.ox, warm.oy);
    ctx.restore();
  }
  layers.forEach((cv, li) => {
    const ox = wind * 9 * noise1(T * 0.55 + li * 7.3, 1) + wind * 4 * Math.sin(T * 1.2 + li * 2);
    const oy = wind * 3 * noise1(T * 0.5 + li * 3.1, 2);
    s26_blit(ctx, cam, 1, cv, x0, y0, 1, ox, oy);
  });
  if (warm) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = warm.a * 0.14;
    s26_blit(ctx, cam, 1, warm.B, x0, y0, S26_CAN.wsc);
    ctx.restore();
  }
}
function s26_shimenawa(ctx, T, wind, lights) {
  const y0 = 640, xl = 196, xr = 398;
  const ropeY = (u) => y0 + 22 * Math.sin(u * Math.PI);
  const warm = s26_lightAt(lights, 300, y0);
  // rope body
  ctx.lineCap = 'round';
  ctx.strokeStyle = mixColor('#6d6650', '#c89a5a', warm);
  ctx.lineWidth = 26;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) { const u = i / 20; ctx.lineTo(lerp(xl, xr, u), ropeY(u)); }
  ctx.stroke();
  // twist bands
  ctx.strokeStyle = 'rgba(30,26,20,0.55)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 16; i++) {
    const u = (i + 0.5) / 16, x = lerp(xl, xr, u), y = ropeY(u);
    ctx.beginPath(); ctx.moveTo(x - 7, y - 11); ctx.quadraticCurveTo(x + 2, y, x + 7, y + 11); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(220,210,170,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) { const u = i / 20; ctx.lineTo(lerp(xl, xr, u) - 1, ropeY(u) - 8); }
  ctx.stroke();
  // shide (zig-zag paper streamers) + straw tassels
  for (const [u, k] of [[0.22, 0], [0.5, 1], [0.78, 2]]) {
    const x = lerp(xl, xr, u), y = ropeY(u) + 10;
    const sw = wind * (8 + 10 * noise1(T * 2.4 + k * 5, 17)) + Math.sin(T * 3 + k) * 2;
    ctx.fillStyle = mixColor('#c9cfdc', '#fff0d0', warm);
    ctx.beginPath();
    const seg = 4, sh = 13;
    ctx.moveTo(x - 6, y);
    for (let j = 0; j < seg; j++) {
      const off = sw * ((j + 1) / seg) ** 1.5;
      const dir = j % 2 ? -1 : 1;
      ctx.lineTo(x + dir * 6 + off, y + (j + 1) * sh);
      ctx.lineTo(x + dir * 6 + off, y + (j + 1) * sh + 3);
    }
    ctx.lineTo(x + sw + 8, y + seg * sh + 10);
    for (let j = seg - 1; j >= 0; j--) {
      const off = sw * ((j + 1) / seg) ** 1.5;
      const dir = j % 2 ? -1 : 1;
      ctx.lineTo(x + dir * 6 + off + 9, y + (j + 1) * sh - 4);
    }
    ctx.lineTo(x + 6, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.lineCap = 'butt';
}

// ---------------- stone lantern (tōrō) ----------------
function s26_toro(ctx, T, x, y, s, lights) {
  const warm = s26_lightAt(lights, x, y - 80 * s);
  const stone = mixColor('#2e3d50', '#6a5a4a', warm * 0.8), dark = '#1a2533', moss = mixColor('#2f5a42', '#6a7a3a', warm * 0.6);
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const box = (x0, y0, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x0, y0, w, h); };
  // base
  ctx.fillStyle = stone; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(40, 0); ctx.lineTo(34, -16); ctx.lineTo(-34, -16); ctx.fill();
  box(-12, -70, 24, 55, stone);
  box(12 - 8, -70, 8, 55, dark);
  ctx.fillStyle = stone; ctx.beginPath(); ctx.moveTo(-30, -70); ctx.lineTo(30, -70); ctx.lineTo(24, -82); ctx.lineTo(-24, -82); ctx.fill();
  // fire box
  box(-22, -118, 44, 36, stone);
  box(-12, -110, 24, 20, '#0b0f18');
  // faint ember glow inside
  const ember = 0.15 + warm * 0.5;
  ctx.fillStyle = rgba('#ffb347', ember * 0.5); ctx.fillRect(-12, -110, 24, 20);
  box(14, -118, 8, 36, dark);
  // roof (kasa) with upturned corners
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.moveTo(-52, -118); ctx.quadraticCurveTo(-40, -124, -30, -134); ctx.lineTo(-8, -146); ctx.lineTo(8, -146);
  ctx.lineTo(30, -134); ctx.quadraticCurveTo(40, -124, 52, -118); ctx.lineTo(56, -124); ctx.lineTo(48, -114); ctx.lineTo(-48, -114); ctx.lineTo(-56, -124); ctx.closePath();
  ctx.fill();
  // hoju
  ctx.beginPath(); ctx.arc(0, -155, 9, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -172); ctx.quadraticCurveTo(9, -160, 0, -155); ctx.quadraticCurveTo(-9, -160, 0, -172); ctx.fill();
  // moss on top surfaces
  ctx.fillStyle = moss;
  ctx.beginPath(); ctx.ellipse(-12, -140, 22, 6, -0.25, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(28, -126, 16, 5, 0.3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-20, -80, 14, 4, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, -3, 26, 6, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-6, -150, 7, 4, 0, 0, TAU); ctx.fill();
  // moss drips
  for (const [mx, my, mh] of [[-18, -118, 10], [-4, -118, 6], [30, -116, 8], [-8, -70, 12]]) { ctx.fillRect(mx, my, 3, mh); }
  // cool rim on right edges
  ctx.fillStyle = 'rgba(110,160,190,0.35)';
  ctx.fillRect(20, -118, 2, 36); ctx.fillRect(10, -70, 2, 55);
  ctx.restore();
}

// ---------------- ground, grass ----------------
function s26_groundPath(ctx, x0 = -800, x1 = 2800) {
  ctx.beginPath();
  ctx.moveTo(x0, 1600);
  for (let x = x0; x <= x1; x += 16) ctx.lineTo(x, s26_crestY(x));
  ctx.lineTo(x1, 1600);
  ctx.closePath();
}
function s26_ground(ctx, T, o) {
  s26_groundPath(ctx);
  const g = ctx.createLinearGradient(0, 760, 0, 1150);
  g.addColorStop(0, '#133244'); g.addColorStop(0.25, '#0c2433'); g.addColorStop(1, '#040d16');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  s26_groundPath(ctx);
  ctx.clip();
  // pools of light
  ctx.globalCompositeOperation = 'lighter';
  for (const L of o.lights || []) {
    ctx.save();
    ctx.translate(L.x, L.gy ?? L.y);
    ctx.scale(1, 0.32);
    const rr = L.r * 1.1;
    const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
    gg.addColorStop(0, rgba(L.color || '#ffb347', 0.5 * L.a));
    gg.addColorStop(0.4, rgba(L.color || '#ffb347', 0.18 * L.a));
    gg.addColorStop(1, rgba(L.color || '#ffb347', 0));
    ctx.fillStyle = gg;
    ctx.fillRect(-rr, -rr, rr * 2, rr * 2);
    ctx.restore();
  }
  ctx.restore();
  // crest rim light (sky light catching the edge)
  ctx.strokeStyle = 'rgba(100,160,190,0.28)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = -800; x <= 2800; x += 16) ctx.lineTo(x, s26_crestY(x) + 1.5);
  ctx.stroke();
}
function s26_grassData() {
  if (S26.cache.grass) return S26.cache.grass;
  const r = rng(515);
  const crest = [], front = [], fg = [];
  for (let i = 0; i < 520; i++) {
    const x = -500 + r() * 2900;
    crest.push({ x, y: s26_crestY(x) + 2 + r() * 26, h: 16 + r() * 34, w: 3 + r() * 3, lean: (r() - 0.5) * 0.4, tone: r(), ph: r() * 10 });
  }
  for (let i = 0; i < 340; i++) {
    const x = -500 + r() * 2900, y0 = s26_crestY(x) + 40;
    front.push({ x, y: lerp(y0, 1130, r() ** 0.8), h: 30 + r() * 60, w: 5 + r() * 4, lean: (r() - 0.5) * 0.4, tone: r(), ph: r() * 10 });
  }
  front.sort((a, b) => a.y - b.y);
  for (let i = 0; i < 60; i++) {
    const x = -300 + r() * 2500;
    fg.push({ x, y: 1110 + r() * 60, h: 130 + r() * 170, w: 12 + r() * 10, lean: (r() - 0.5) * 0.5, tone: r(), ph: r() * 10 });
  }
  S26.cache.grass = { crest, front, fg };
  return S26.cache.grass;
}
const S26_G0 = hexToRgb('#0f2a3a'), S26_G1 = hexToRgb('#24505a'), S26_DARK0 = hexToRgb('#030a11'), S26_DARK1 = hexToRgb('#0a1a26'), S26_WARM = hexToRgb('#e8a452');
function s26_blades(ctx, T, blades, o, filter) {
  const lights = o.lights || [];
  const str = o.wind ?? 0.3, bias = o.windBias || 0;
  for (const b of blades) {
    if (filter && !filter(b)) continue;
    const ang = b.lean + s26_wind(b.x, T + b.ph * 0.02, str, bias) * (0.8 + 0.4 * b.tone);
    const hx = Math.sin(ang) * b.h, hy = -Math.cos(ang) * b.h;
    const tx = b.x + hx, ty = b.y + hy;
    const cx = b.x + hx * 0.25, cy = b.y + hy * 0.6;
    const lk = s26_lightAt(lights, b.x, b.y - b.h * 0.5);
    const c0 = o.dark ? S26_DARK0 : S26_G0, c1 = o.dark ? S26_DARK1 : S26_G1, lc = o.lightRGB || S26_WARM;
    const kk = lk * (o.dark ? 0.35 : 0.85);
    const col = [0, 1, 2].map((j) => Math.round(lerp(lerp(c0[j], c1[j], b.tone), lc[j], kk)));
    ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.beginPath();
    ctx.moveTo(b.x - b.w / 2, b.y);
    ctx.quadraticCurveTo(cx - b.w * 0.3, cy, tx, ty);
    ctx.quadraticCurveTo(cx + b.w * 0.3, cy, b.x + b.w / 2, b.y);
    ctx.fill();
  }
}

// ---------------- motes / fireflies / petals ----------------
function s26_fireflies(ctx, T, o = {}) {
  fireflies(ctx, T, { seed: o.seed || 33, n: o.n || 22, x: -100, y: 430, w: 1500, h: 480, color: '#d8ff8a', size: o.size || 1 });
}
function s26_drift(ctx, T, o) {
  // leaves and light motes carried by wind (world p=1)
  const n = o.n || 40, str = o.wind || 0.5;
  const r = rng(o.seed || 808);
  for (let i = 0; i < n; i++) {
    const sp = 140 + r() * 260, life = (2400 + 800) / sp;
    const ph = r() * life, y0 = 150 + r() * 750, kind = r();
    const u = ((T * (0.4 + str) + ph) % life) / life;
    const x = lerp(-300, 2300, u);
    const y = y0 + 60 * noise1(T * 0.6 + i, 3) - u * 120 + Math.sin(T * 2 + i) * 14;
    if (kind < 0.55) {
      // leaf / petal
      const rot = T * (2 + r() * 3) + i;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, 0.4 + 0.6 * Math.abs(Math.sin(T * 3 + i)));
      ctx.fillStyle = kind < 0.25 ? '#2c5a4c' : '#e8b8c8';
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, TAU); ctx.fill();
      ctx.restore();
    } else {
      const tw = 0.5 + 0.5 * Math.sin(T * 4 + i * 1.7);
      glow(ctx, x, y, 14, '#ffd98a', 0.35 * tw * (o.motes ?? 1));
      ctx.fillStyle = rgba('#fff3c0', 0.8 * tw * (o.motes ?? 1));
      ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------- full set ----------------
// opt: { lights, wind, windBias, actors(ctx), skyFx(ctx) [screen], valleyFx(ctx) [valley layer],
//        fgFx(ctx) [p=1, after front grass], drift:{...}, fireflies:n }
function s26_drawSet(ctx, T, cam, opt = {}) {
  cam = { T, ...cam };
  const lights = opt.lights || [];
  const set = { lights, wind: opt.wind ?? 0.3, windBias: opt.windBias || 0, cam };
  s26_sky(ctx, T, cam);
  if (opt.skyFx) opt.skyFx(ctx);
  s26_mountains(ctx, cam);
  s26_valley(ctx, T, cam, opt);
  s26_treeline(ctx, T, cam);
  if (opt.midFx) opt.midFx(ctx);
  // --- foreground hill (p=1) ---
  s26_push(ctx, cam, 1);
  s26_ground(ctx, T, set);
  const G = s26_grassData();
  s26_blades(ctx, T, G.crest, set);
  s26_toro(ctx, T, 590, 858, 0.95, lights);
  s26_tree(ctx, T, set);
  if (opt.fireflies !== 0) s26_fireflies(ctx, T, { n: opt.fireflies || 20 });
  s26_blades(ctx, T, G.front, set, (b) => b.y < (opt.actorY || 930));
  if (opt.actors) opt.actors(ctx);
  s26_blades(ctx, T, G.front, set, (b) => b.y >= (opt.actorY || 930));
  if (opt.drift) s26_drift(ctx, T, opt.drift);
  s26_blades(ctx, T, G.fg, { ...set, dark: true });
  if (opt.fgFx) opt.fgFx(ctx);
  ctx.restore();
}

// =====================================================================
//                              SCENE s2
// =====================================================================
const S2_IMPACT = { x: 1350, y: 772 };   // in valley layer (p = S26_VALLEY_P)

// the shooting star's head position (valley-layer coords) at global T
function s2_starAt(T) {
  if (T < 10.8) {
    // streak in from upper left, decelerating into a slow magical drift
    const A = { x: 700, y: -60 }, B = { x: 1290, y: 175 }, C = { x: 1470, y: 238 };
    if (T < 8.6) {
      const u = Ease.outQuad(invLerp(7.8, 8.6, T));
      return { x: lerp(A.x, B.x, u), y: lerp(A.y, B.y, u), size: 1, bright: 1 };
    }
    const u = invLerp(8.6, 10.8, T);
    const k = u * (1.4 - 0.4 * u);
    return { x: lerp(B.x, C.x, k), y: lerp(B.y, C.y, k) + Math.sin(u * 5) * 4, size: 1 + u * 0.15, bright: 1 };
  }
  // bend & dive: cubic bezier into the rice field, accelerating
  const u0 = invLerp(10.8, 12.6, T);
  const u = 0.35 * u0 + 0.65 * u0 * u0;
  const P0 = { x: 1470, y: 238 }, P1 = { x: 1640, y: 290 }, P2 = { x: 1560, y: 520 }, P3 = S2_IMPACT;
  const m = 1 - u;
  const x = m * m * m * P0.x + 3 * m * m * u * P1.x + 3 * m * u * u * P2.x + u * u * u * P3.x;
  const y = m * m * m * P0.y + 3 * m * m * u * P1.y + 3 * m * u * u * P2.y + u * u * u * P3.y;
  return { x, y, size: 1.15 + 3.2 * u * u, bright: 1 + 1.5 * u };
}

function s2_drawStar(ctx, T, cam) {
  if (T < 7.8 || T > 12.62) return;
  const p = S26_VALLEY_P;
  const head = s2_starAt(T);
  const hs = s26_toScreen(cam, p, head.x, head.y);
  const fadeIn = invLerp(7.8, 7.9, T);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // tail: sample the path back in time -> tapered ribbon + soft glow beads
  const tailDur = T < 8.6 ? 0.6 : T < 10.8 ? lerp(0.6, 1.5, invLerp(8.6, 9.2, T)) : lerp(1.5, 0.75, invLerp(10.8, 11.3, T));
  const N = 24, pts = [];
  for (let i = 0; i <= N; i++) {
    const tt = T - (i / N) * tailDur;
    if (tt < 7.8) break;
    const P = s2_starAt(tt), S = s26_toScreen(cam, p, P.x, P.y);
    pts.push({ x: S.x, y: S.y, k: 1 - i / N });
  }
  if (pts.length > 2) {
    const ribbon = (wmax, pw) => {
      const L = [], R = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let nx = -(b.y - a.y), ny = b.x - a.x; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const w = wmax * pts[i].k ** pw;
        L.push([pts[i].x + nx * w, pts[i].y + ny * w]); R.push([pts[i].x - nx * w, pts[i].y - ny * w]);
      }
      ctx.beginPath();
      ctx.moveTo(L[0][0], L[0][1]);
      for (const q of L) ctx.lineTo(q[0], q[1]);
      for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
      ctx.closePath();
    };
    const e = pts[pts.length - 1];
    const hr0 = head.size * hs.z;
    const g1 = ctx.createLinearGradient(pts[0].x, pts[0].y, e.x, e.y);
    g1.addColorStop(0, rgba('#ffd98a', 0.55 * fadeIn)); g1.addColorStop(0.5, rgba('#9fb8ff', 0.18 * fadeIn)); g1.addColorStop(1, 'rgba(120,150,255,0)');
    ctx.fillStyle = g1; ribbon(16 * hr0, 1.2); ctx.fill();
    const g2 = ctx.createLinearGradient(pts[0].x, pts[0].y, e.x, e.y);
    g2.addColorStop(0, rgba('#ffffff', fadeIn)); g2.addColorStop(0.35, rgba('#fff0c0', 0.6 * fadeIn)); g2.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g2; ribbon(4.5 * hr0, 1.6); ctx.fill();
    for (let i = 1; i < pts.length; i += 3) glow(ctx, pts[i].x, pts[i].y, 40 * hr0 * pts[i].k, '#ffd76a', 0.25 * pts[i].k * fadeIn);
  }
  // shed sparkles along the trail
  const step = 0.035;
  const i0 = Math.floor((T - 0.9) / step), i1 = Math.floor(T / step);
  for (let i = Math.max(i0, Math.ceil(7.8 / step)); i <= i1; i++) {
    const tb = i * step, age = T - tb;
    if (age < 0 || age > 0.9) continue;
    const P = s2_starAt(tb);
    const hx = hash(i * 3 + 1) - 0.5, hy = hash(i * 3 + 2) - 0.5;
    const S = s26_toScreen(cam, p, P.x + hx * 40 * age * 2, P.y + hy * 40 * age * 2 + age * 30);
    const a = (1 - age / 0.9) * fadeIn;
    sparkle(ctx, S.x, S.y, (4 + hash(i) * 7) * S.z * P.size * (1 - age), hash(i) < 0.5 ? '#ffffff' : '#ffe7a0', a, age * 3);
  }
  // head: blazing core + glow; sparkle arms stay thin and bounded
  const hr = head.size * hs.z, hc = Math.min(hr, 1.7);
  const pulse = 1 + 0.08 * Math.sin(T * 30);
  glow(ctx, hs.x, hs.y, 200 * hr * pulse, '#ffc86a', 0.3 * fadeIn * Math.min(1.6, head.bright));
  glow(ctx, hs.x, hs.y, 70 * hr, '#fff4d0', 0.9 * fadeIn);
  glow(ctx, hs.x, hs.y, 26 * hr, '#ffffff', fadeIn, 0.4);
  sparkle(ctx, hs.x, hs.y, 44 * hc * pulse, '#ffffff', 0.9 * fadeIn, 0.08 * Math.sin(T * 9));
  sparkle(ctx, hs.x, hs.y, 26 * hc * (2 - pulse), '#fff3c0', 0.7 * fadeIn, Math.PI / 4);
  ctx.fillStyle = rgba('#ffffff', fadeIn);
  ctx.beginPath(); ctx.arc(hs.x, hs.y, 5 * hr, 0, TAU); ctx.fill();
  ctx.restore();
}

// impact FX in valley-layer coords (called inside the valley transform)
function s2_impactValley(ctx, T) {
  const tt = T - 12.6;
  // reflection of the star in the flooded paddies
  if (T > 7.8 && T < 12.6) {
    const st = s2_starAt(T);
    const k = T < 10.8 ? 0.25 : 0.25 + 0.75 * invLerp(10.8, 12.6, T);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(st.x, Math.max(st.y, 700) + (st.y < 700 ? 70 + (700 - st.y) * 0.25 : 30));
    ctx.scale(0.35, 1);
    glow(ctx, 0, 0, 90 * st.size, '#ffe6a8', 0.35 * k);
    ctx.restore();
  }
  if (tt < -0.25) return;
  const { x, y } = S2_IMPACT;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (tt < 0) {
    // the ground lights up under the incoming star
    const k = invLerp(-0.25, 0, tt);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.3);
    glow(ctx, 0, 0, 260 * k, '#ffd76a', 0.6 * k);
    ctx.restore();
  } else {
    // shockwave rings on the paddies (perspective ellipses)
    for (let i = 0; i < 3; i++) {
      const u = tt - i * 0.12;
      if (u <= 0) continue;
      const R = 40 + u * 1700 * (1 - i * 0.15);
      const a = clamp(1 - u / 0.8);
      ctx.strokeStyle = rgba(i ? '#ffe4a0' : '#ffffff', a);
      ctx.lineWidth = (18 - i * 5) * a + 2;
      ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.2, 0, 0, TAU); ctx.stroke();
    }
    // light pillar
    const pa = clamp(1 - tt / 0.9);
    const pg = ctx.createLinearGradient(x - 60, 0, x + 60, 0);
    pg.addColorStop(0, 'rgba(255,240,200,0)'); pg.addColorStop(0.5, rgba('#fff6e0', pa)); pg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(x - 60 - tt * 80, y - 900, 120 + tt * 160, 900);
    glow(ctx, x, y, 200 + tt * 1400, '#fff3d0', 1);
    glow(ctx, x, y, 80 + tt * 500, '#ffffff', 1, 0.3);
  }
  ctx.restore();
}

// screen-space flash, rays, whiteout
function s2_impactScreen(ctx, T, cam) {
  const tt = T - 12.6;
  if (tt < -0.05) return;
  const S = s26_toScreen(cam, S26_VALLEY_P, S2_IMPACT.x, S2_IMPACT.y);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // god rays
  const ra = clamp(invLerp(-0.05, 0.05, tt)) * 0.9;
  const r = rng(1263);
  for (let i = 0; i < 26; i++) {
    const ang = -Math.PI * (0.02 + 0.96 * r()) + tt * (r() - 0.5) * 0.5, wdt = 0.015 + r() * 0.05, len = 2600;
    const g = ctx.createLinearGradient(S.x, S.y, S.x + Math.cos(ang) * len, S.y + Math.sin(ang) * len);
    g.addColorStop(0, rgba('#fff8e8', ra * (0.4 + r() * 0.4)));
    g.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(S.x, S.y);
    ctx.lineTo(S.x + Math.cos(ang - wdt) * len, S.y + Math.sin(ang - wdt) * len);
    ctx.lineTo(S.x + Math.cos(ang + wdt) * len, S.y + Math.sin(ang + wdt) * len);
    ctx.closePath(); ctx.fill();
  }
  glow(ctx, S.x, S.y, 900 * (0.5 + tt), '#fff0c8', 0.8);
  ctx.restore();
}
function s2_whiteout(ctx, T, cam) {
  const tt = T - 12.6;
  if (tt < -0.4) return;
  const S = s26_toScreen(cam, S26_VALLEY_P, S2_IMPACT.x, S2_IMPACT.y);
  // light wrap over the foreground as the star comes in
  glow(ctx, S.x, S.y, 1400, '#ffe8b0', 0.35 * prog(tt, -0.4, 0) + (tt > 0 ? 0.4 : 0));
  // whiteout: instant flash, slight recovery, then full warm white by 13.4
  const flash = tt < 0 ? 0 : Math.max(0.92 * Math.exp(-tt * 9), prog(tt, 0.12, 0.8, Ease.inQuad));
  const base = tt < 0 ? 0 : 0.35;
  const a = clamp(Math.max(flash, base * clamp(tt / 0.05)));
  ctx.fillStyle = `rgba(255,251,238,${a})`;
  ctx.fillRect(0, 0, W, H);
}

function s2_camera(T) {
  // shot A wide (7.0–8.4) — slow drift up; shot C (10.6–13.5) wide, push toward impact
  if (T < 8.4) {
    const u = prog(T, 7.0, 8.4, Ease.inOutQuad);
    return { x: 960 + u * 20, y: 520 - u * 12, zoom: 1.04 + u * 0.02 };
  }
  const u = prog(T, 10.9, 12.6, Ease.inOutCubic);
  const star = s2_starAt(Math.min(T, 12.6));
  const follow = { x: lerp(1120, (star.x + 1100) / 2, 0.5), y: lerp(500, (star.y + 700) / 2, 0.6) };
  const shake = T > 12.6 ? 1.3 * Math.exp(-(T - 12.6) * 3) : 0.12 * prog(T, 12.2, 12.6);
  return { x: lerp(1000, follow.x, u), y: lerp(500, follow.y, u), zoom: lerp(1.0, 1.32, u), shake };
}

function s2_hinaOpts(T, bust) {
  const turned = T >= 8.2;
  const turnK = prog(T, 8.15, 8.4);
  const o = {
    T, x: 1090, y: 920, scale: 1.0, facing: 1,
    view: turned ? 'threeQuarter' : 'back',
    pose: 'lookUp',
    expression: T < 8.1 ? 'neutral' : 'surprised',
    mouth: mouthAt('hina', T),
    blink: blinkAt(T, 21),
    lookX: 0.4, lookY: -0.8,
    headTilt: -0.12 * turnK,
    wind: 0.25 + (T > 12.6 ? 1.0 * Math.exp(-(T - 12.6) * 2) : 0),
    lantern: { glow: 0.6 },
  };
  if (T > 11) { o.lookY = lerp(-0.8, 0.3, prog(T, 11, 12.5)); o.lookX = 0.7; }
  return o;
}

function s2_lights(o, T, cam) {
  const hp = s26_lanternPos(o);
  const flick = 0.92 + 0.08 * noise1(T * 6, 3);
  const L = [{ x: hp.x, y: hp.y + 20, gy: o.y, r: 420, a: 0.75 * flick, color: '#ffb347' }];
  // star light on the hill as it dives in
  if (T > 11.3 && T < 13.5) {
    const k = prog(T, 11.3, 12.6, Ease.inQuad) * (T > 12.6 ? 1.6 : 1);
    L.push({ x: 1700, y: 850, gy: 850, r: 1400, a: 0.6 * k, color: '#ffe0a0' });
  }
  return L;
}

function s2_wide(ctx, T) {
  const cam = s2_camera(T);
  const o = s2_hinaOpts(T);
  const lights = s2_lights(o, T, cam);
  const blast = T > 12.6 ? Math.exp(-(T - 12.6) * 1.5) : 0;
  s26_drawSet(ctx, T, cam, {
    lights,
    wind: 0.28 + blast * 0.6,
    windBias: -1.1 * blast * prog(T, 12.6, 12.75),
    valleyFx: (c) => s2_impactValley(c, T),
    midFx: (c) => { s2_drawStar(c, T, cam); s2_impactScreen(c, T, cam); },
    actors: (c) => {
      // soft shadow at her feet (stretches back toward camera when the star lights the valley)
      const back = prog(T, 11.6, 12.6);
      c.fillStyle = 'rgba(2,6,12,0.45)';
      c.beginPath(); c.ellipse(o.x - 30 - back * 60, o.y + 4 + back * 20, 90 + back * 80, 14 + back * 16, -0.15 * back, 0, TAU); c.fill();
      // backlight from the star: rim on the edges facing it, silhouette shading
      const st = s2_starAt(Math.min(T, 12.6));
      const hs = s26_toScreen(cam, 1, o.x, o.y - 300), ss = s26_toScreen(cam, S26_VALLEY_P, st.x, st.y);
      const dx = ss.x - hs.x, dy = ss.y - hs.y, dl = Math.hypot(dx, dy) || 1;
      const back2 = prog(T, 11.2, 12.6) + (T > 12.6 ? 1 : 0);
      s26_litActor(c, (b) => drawHina(b, o), {
        lx: dx / dl, ly: dy / dl, width: 3 + 4 * clamp(back2), rim: '#ffe7b0', rimA: T > 7.8 ? 0.3 + 0.5 * clamp(back2) : 0.25,
        shade: '#10163a', shadeA: 0.1 + 0.4 * clamp(back2), blur: 5, box: s26_hinaBox(cam, o),
      });
      const hp = s26_lanternPos(o);
      glow(c, hp.x, hp.y, 150, '#ffb347', 0.35);
    },
  });
  s2_whiteout(ctx, T, cam);
}

function s2_closeupFrame() {
  if (S26.cache.s2cu) return S26.cache.s2cu;
  const q = 0.25;
  const mk = () => { const c = document.createElement('canvas'); c.width = W * q; c.height = H * q; const x = c.getContext('2d'); x.scale(q, q); return [c, x]; };
  const [crest, c1] = mk();
  c1.fillStyle = '#0b1f2c';
  c1.beginPath(); c1.moveTo(-50, 1100);
  for (let x = -50; x <= W + 50; x += 20) c1.lineTo(x, 890 + 40 * Math.sin(x * 0.003 + 1) + 14 * Math.sin(x * 0.05));
  c1.lineTo(W + 50, 1100); c1.closePath(); c1.fill();
  const [leaves, c2] = mk();
  const { clusters } = s26_treeData();
  c2.translate(-120, 40);
  c2.scale(1.3, 1.3);
  for (const C of clusters) {
    if (C.x > 520 || C.y > 120) continue;
    c2.fillStyle = rgba('#3f6f84', 0.8);
    s26_clusterPath(c2, C, 6, -8, 1); c2.fill();
    c2.fillStyle = '#081820';
    s26_clusterPath(c2, C, 0, 0, 1); c2.fill();
  }
  // soften (small canvas => cheap), done once
  const blur = (cv, px) => { const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height; const x = t.getContext('2d'); x.filter = `blur(${px}px)`; x.drawImage(cv, 0, 0); return t; };
  S26.cache.s2cu = { crest: blur(crest, 1.5), leaves: blur(leaves, 2.5) };
  return S26.cache.s2cu;
}
function s2_closeup(ctx, T) {
  // reverse-ish close shot: Hina's surprised face, the star hanging in the sky behind
  const u = prog(T, 8.4, 10.6, Ease.inOutQuad);
  const cam = { x: 1230 + u * 30, y: 360 - u * 10, zoom: 1.9 + u * 0.08, T };
  s26_sky(ctx, T, cam);
  s2_drawStar(ctx, T, cam);
  s26_mountains(ctx, cam);
  // out-of-focus leaves framing top-left, and warm lantern bokeh bottom-right
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const r = rng(88);
  for (let i = 0; i < 9; i++) {
    const x = 1300 + r() * 600, y = 820 + r() * 260;
    glow(ctx, x + Math.sin(T + i) * 6, y, 60 + r() * 60, '#ffb347', 0.12 + r() * 0.1);
  }
  ctx.restore();
  // defocused hill crest + out-of-focus camphor leaves (cached at low res = soft)
  const cu = s2_closeupFrame();
  ctx.drawImage(cu.crest, 0, 0, cu.crest.width, cu.crest.height, -20, 0, W + 40, H);
  ctx.drawImage(cu.leaves, 0, 0, cu.leaves.width, cu.leaves.height, Math.sin(T * 0.8) * 10 - 30, Math.sin(T * 0.6) * 5 - 20, W + 60, H + 40);
  const o = s2_hinaOpts(T);
  const hb = {
    ...o, x: 700 - u * 20, y: 1150, scale: 2.2, bust: true, view: 'threeQuarter', facing: 1,
    lookX: 0.6, lookY: -0.7, headTilt: -0.1, wind: 0.35,
    lantern: null,
  };
  // warm under-light from the lantern + cool sky rim
  glow(ctx, hb.x + 260, 1080, 520, '#ffb347', 0.35);
  drawHina(ctx, hb);
  // star glint in her eyes / sky light
  const hp = s26_headPos(hb);
  glow(ctx, hp.x + 120, hp.y - 120, 300, '#ffe6a8', 0.1 + 0.05 * Math.sin(T * 7));
}

registerScene('s2', {
  draw(ctx, t, T, d) {
    if (T >= 13.4) { ctx.fillStyle = 'rgb(255,251,238)'; ctx.fillRect(0, 0, W, H); return; }
    if (T >= 8.4 && T < 10.6) s2_closeup(ctx, T);
    else s2_wide(ctx, T);
  },
});
