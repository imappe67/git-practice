// Scene s1 — Opening: tilt down from the Milky Way to the sleeping valley village.
// Also hosts the shared night-village panorama painter (s17_*) used by s7.
'use strict';

// ============================================================================
//  Shared panorama painter (s1 + s7)
// ============================================================================
// Layout is authored in "reference screen space" (camera U=0, Z=1). Each layer
// has a parallax factor p; the camera tilt U (px, >0 = looking up) moves a layer
// down by U*p, zoom Z scales a layer around (fx,fy) by 1+(Z-1)*p, and X pans.
const S17 = { c: {} };
const S17_P = { sky: 0.55, m0: 0.62, m1: 0.7, m2: 0.8, mist: 0.86, vil: 1.0, hill: 1.12, fg: 1.3 };
const S17_HZ = 612;                                        // mirror line for paddy reflections (village space)
const S17_SKY = { x0: -420, y0: -1320, w: 2760, h: 2440 };  // cached sky canvas extent (sky space)
const S17_HILLTOP = { x: 1640, y: 551 };                   // where Hina stands (hill space)
const S17_MOON = { x: 400, y: 300, r: 30 };                // sky space

function s17_canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function s17_layer(ctx, cam, p) {
  const z = 1 + (cam.Z - 1) * p;
  ctx.translate(cam.fx, cam.fy);
  ctx.scale(z, z);
  ctx.translate(-cam.fx, -cam.fy);
  ctx.translate(-(cam.X || 0) * p, cam.U * p);
}
function s17_toScreen(cam, p, x, y) {
  const z = 1 + (cam.Z - 1) * p;
  return [cam.fx + (x - (cam.X || 0) * p - cam.fx) * z, cam.fy + (y + cam.U * p - cam.fy) * z];
}
function s17_fromScreen(cam, p, sx, sy) {
  const z = 1 + (cam.Z - 1) * p;
  return [(sx - cam.fx) / z + cam.fx + (cam.X || 0) * p, (sy - cam.fy) / z + cam.fy - cam.U * p];
}

// ---------- sprites ----------
function s17_glowSprite(color) {
  const key = 'g' + color;
  if (S17.c[key]) return S17.c[key];
  const c = s17_canvas(128, 128), g = c.getContext('2d');
  const [r, gg, b] = hexToRgb(color);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  gr.addColorStop(0.12, `rgba(${r},${gg},${b},0.55)`);
  gr.addColorStop(0.35, `rgba(${r},${gg},${b},0.16)`);
  gr.addColorStop(0.7, `rgba(${r},${gg},${b},0.04)`);
  gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return (S17.c[key] = c);
}
// additive soft glow, cheap (sprite based)
function s17_glow(ctx, x, y, r, color, a) {
  if (a <= 0.003 || r <= 0.5) return;
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * Math.min(1, a);
  ctx.drawImage(s17_glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = pa;
}
// streak sprite: tail on the left (transparent) -> head on the right
function s17_streakSprite(color) {
  const key = 's' + color;
  if (S17.c[key]) return S17.c[key];
  const c = s17_canvas(256, 24), g = c.getContext('2d');
  const [r, gg, b] = hexToRgb(color);
  const lg = g.createLinearGradient(0, 0, 256, 0);
  lg.addColorStop(0, `rgba(${r},${gg},${b},0)`);
  lg.addColorStop(0.7, `rgba(${r},${gg},${b},0.35)`);
  lg.addColorStop(0.97, `rgba(${r},${gg},${b},1)`);
  lg.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = lg;
  for (let i = 0; i < 12; i++) {           // soft vertical falloff
    const hh = 12 - i;
    g.globalAlpha = 0.16 + (i === 11 ? 0.5 : 0);
    g.beginPath();
    g.moveTo(0, 12); g.quadraticCurveTo(200, 12 - hh * 0.9, 252, 12 - hh * 0.35);
    g.lineTo(252, 12 + hh * 0.35); g.quadraticCurveTo(200, 12 + hh * 0.9, 0, 12); g.fill();
  }
  g.globalAlpha = 1;
  g.fillRect(0, 11, 256, 2);
  return (S17.c[key] = c);
}
// draws a streak whose head is at (x,y) moving in direction ang, length len, width wid
function s17_streak(ctx, x, y, ang, len, wid, color, a) {
  if (a <= 0.003 || len < 1) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.globalAlpha *= Math.min(1, a);
  ctx.drawImage(s17_streakSprite(color), -len, -wid / 2, len * 1.015, wid);
  ctx.restore();
}

// ---------- the sky (cached, static part) ----------
function s17_sky() {
  if (S17.c.sky) return S17.c.sky;
  const S = S17_SKY, c = s17_canvas(S.w, S.h), g = c.getContext('2d');
  g.translate(-S.x0, -S.y0);
  const gr = g.createLinearGradient(0, S.y0, 0, S.y0 + S.h);
  const st = (y, col) => gr.addColorStop(clamp((y - S.y0) / S.h), col);
  st(-1320, '#020414'); st(-750, '#040922'); st(-200, '#081535'); st(200, '#0f2352'); st(430, '#18336a');
  st(560, '#284a80'); st(650, '#34598f'); st(1120, '#2d4f84');
  g.fillStyle = gr; g.fillRect(S.x0, S.y0, S.w, S.h);

  // Milky Way: low-res procedural density field, upscaled & added.
  const q = 3, mw = Math.ceil(S.w / q), mh = Math.ceil(S.h / q);
  const m = s17_canvas(mw, mh), mg = m.getContext('2d');
  const img = mg.createImageData(mw, mh), D = img.data;
  const ax = -420, ay = 900, bx = 2340, by = -1320;
  const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux;
  S17.band = { ax, ay, ux, uy, nx, ny, L };
  for (let j = 0; j < mh; j++) {
    const Y = S.y0 + j * q;
    for (let i = 0; i < mw; i++) {
      const X = S.x0 + i * q;
      const along = (X - ax) * ux + (Y - ay) * uy;
      let d = (X - ax) * nx + (Y - ay) * ny;
      d += 90 * Math.sin(along * 0.0014 + 1.3) + 50 * noise1(along * 0.004, 5);
      const w = 210 + 70 * noise1(along * 0.0025, 9);
      // turbulent multi-octave texture (grainy star clouds)
      let n = 0, amp = 0.5, f = 0.006;
      for (let o = 0; o < 5; o++) { n += amp * noise2(X * f, Y * f, 3 + o); amp *= 0.55; f *= 2.1; }
      const dd = (d * d) / (w * w);
      let dens = Math.exp(-dd) * clamp(0.25 + 1.3 * n) ** 1.4;
      const halo = Math.exp(-dd * 0.22) * (0.5 + 0.5 * noise2(X * 0.002, Y * 0.002, 2));
      let core = Math.exp(-dd * 4) * clamp(0.2 + 1.4 * noise2(X * 0.004, Y * 0.004, 8)) * clamp(0.3 + 1.2 * n);
      // dust lanes: turbulent dark rifts
      const rd = d - 20 - 60 * noise1(along * 0.005, 12) - 25 * noise2(X * 0.02, Y * 0.02, 13);
      const rift = Math.exp(-(rd * rd) / (38 * 38)) * clamp(0.3 + 1.2 * noise2(X * 0.006, Y * 0.006, 14));
      const lane2 = Math.exp(-((d + 95 + 30 * noise2(X * 0.015, Y * 0.015, 16)) ** 2) / (18 * 18)) * clamp(0.2 + noise2(X * 0.008, Y * 0.008, 17));
      const dust = clamp(Math.abs(noise2(X * 0.012, Y * 0.012, 19)) * 3 - 1.2) * Math.exp(-dd * 0.6);
      const cut = clamp(1 - 0.9 * rift - 0.7 * lane2 - 0.5 * dust);
      dens *= cut; core *= cut;
      const warm = clamp(0.5 + 1.2 * noise2(X * 0.0018, Y * 0.0018, 21));
      const k = (j * mw + i) * 4;
      D[k] = 10 * halo + dens * (58 + 40 * warm) + core * (150 + 60 * warm);
      D[k + 1] = 16 * halo + dens * (70 + 25 * warm) + core * (135 + 30 * warm);
      D[k + 2] = 38 * halo + dens * (120 - 20 * warm) + core * 110;
      D[k + 3] = 255;
    }
  }
  mg.putImageData(img, 0, 0);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.imageSmoothingQuality = 'high';
  g.drawImage(m, S.x0, S.y0, mw * q, mh * q);
  g.restore();

  // stars
  const r = rng(1701);
  const ext = (y) => clamp((640 - y) / 300);   // atmospheric extinction near horizon
  const dot = (x, y, s, col, a) => { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x - s / 2, y - s / 2, s, s); };
  for (let i = 0; i < 11000; i++) {
    const x = S.x0 + r() * S.w, y = S.y0 + r() * S.h, v = r();
    const col = v < 0.15 ? '#ffe2c0' : v < 0.35 ? '#c8d8ff' : '#ffffff';
    dot(x, y, r() < 0.8 ? 1 : 1.6, col, (0.12 + r() ** 2 * 0.6) * ext(y));
  }
  for (let i = 0; i < 26000; i++) {             // dense star clouds inside the band
    const al = r() * L;
    const gs = (r() + r() + r() - 1.5) * 0.9;
    const x = ax + ux * al + nx * gs * 240 + 90 * Math.sin(al * 0.0014 + 1.3) * nx, y = ay + uy * al + ny * gs * 240 + 90 * Math.sin(al * 0.0014 + 1.3) * ny;
    const n = noise2(x * 0.006, y * 0.006, 3) + 0.5 * noise2(x * 0.013, y * 0.013, 4);
    if (r() > 0.35 + n) continue;
    dot(x, y, r() < 0.85 ? 1 : 1.5, r() < 0.3 ? '#ffe8cc' : '#e8eeff', (0.2 + r() * 0.5) * ext(y));
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 520; i++) {               // medium stars with a tiny halo
    const x = S.x0 + r() * S.w, y = S.y0 + r() * S.h, v = r();
    const col = v < 0.2 ? '#ffd9a8' : v < 0.45 ? '#bcd0ff' : '#ffffff';
    const e = ext(y);
    s17_glow(g, x, y, 6 + r() * 5, col, 0.35 * e);
    g.globalAlpha = 0.85 * e; g.fillStyle = col;
    g.beginPath(); g.arc(x, y, 0.9 + r() * 0.7, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
  // horizon airglow
  const hg = g.createLinearGradient(0, 380, 0, 700);
  hg.addColorStop(0, 'rgba(90,130,190,0)'); hg.addColorStop(0.75, 'rgba(110,150,205,0.22)'); hg.addColorStop(1, 'rgba(110,150,205,0.1)');
  g.fillStyle = hg; g.fillRect(S.x0, 380, S.w, 740);
  return (S17.c.sky = c);
}

function s17_moonSprite() {
  if (S17.c.moon) return S17.c.moon;
  const c = s17_canvas(160, 160), g = c.getContext('2d');
  g.fillStyle = '#fff6da';
  g.beginPath(); g.arc(80, 80, 60, 0, TAU); g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(80 + 26, 80 - 12, 58, 0, TAU); g.fill();
  return (S17.c.moon = c);
}

// Live sky: twinkling bright stars, moon, plus scene extras (meteors, ...).
// Drawn in sky space. `refl` = true when drawn as a paddy reflection.
function s17_skyLive(ctx, T, fx, refl) {
  const r = rng(77);
  const mul = refl ? 0.55 : 1;
  const extra = fx.starBoost || 0;
  for (let i = 0; i < 190; i++) {
    const x = S17_SKY.x0 + r() * S17_SKY.w, y = -1250 + r() * 1800, mag = r(), c0 = r(), sp = r(), ph = r() * TAU;
    if (refl && (y < 0 || y > 620)) continue;
    const e = clamp((640 - y) / 300);
    const tw = 0.62 + 0.38 * Math.sin(T * (1.3 + sp * 3.2) + ph) * (0.6 + 0.4 * Math.sin(T * 0.7 + ph * 3));
    const col = c0 < 0.22 ? '#ffe0b0' : c0 < 0.5 ? '#cfe0ff' : '#ffffff';
    const size = 1.1 + mag ** 3 * 3.2;
    const a = e * mul * (tw + extra * 0.5);
    s17_glow(ctx, x, y, size * 7, col, 0.35 * a);
    ctx.globalAlpha = clamp(a); ctx.fillStyle = col;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
    if (mag > 0.86 && !refl) sparkle(ctx, x, y, size * (3 + 2 * tw), col, 0.55 * a * tw);
  }
  // thin crescent moon
  const M = S17_MOON;
  s17_glow(ctx, M.x + 8, M.y - 3, 260, '#8fb0e8', 0.35 * mul);
  s17_glow(ctx, M.x + 8, M.y - 3, 90, '#dfe8ff', 0.45 * mul);
  if (!refl) {
    ctx.save(); ctx.translate(M.x, M.y); ctx.rotate(-0.5);
    ctx.drawImage(s17_moonSprite(), -M.r * 1.33, -M.r * 1.33, M.r * 2.66, M.r * 2.66);
    ctx.restore();
  }
  if (fx.sky) fx.sky(ctx, T, refl);
}

// ---------- mountains ----------
function s17_ridge(seed, base, amp, f, peaks, step, bump) {
  const pts = [];
  for (let x = -700; x <= 2620; x += step) {
    let y = base - amp * (0.5 + 0.6 * fbm1(x * f, seed, 5));
    for (const [px, ph, pw] of peaks) y -= ph * Math.exp(-(((x - px) / pw) ** 2));
    if (bump) y -= bump * Math.abs(noise1(x * 0.09, seed + 40)) + bump * 0.6 * Math.abs(noise1(x * 0.23, seed + 41));
    pts.push([x, y]);
  }
  const fill = new Path2D(), edge = new Path2D();
  fill.moveTo(-700, 2400);
  pts.forEach(([x, y], i) => { fill.lineTo(x, y); if (i) edge.lineTo(x, y); else edge.moveTo(x, y); });
  fill.lineTo(2620, 2400); fill.closePath();
  return { fill, edge };
}
function s17_mountains() {
  if (S17.c.mtn) return S17.c.mtn;
  return (S17.c.mtn = [
    { p: S17_P.m0, ...s17_ridge(11, 520, 130, 0.0022, [[180, 120, 150], [760, 60, 120], [1500, 90, 170], [2150, 70, 150]], 8, 0),
      top: 380, c0: '#34548e', c1: '#47679d', rim: 0.16 },
    { p: S17_P.m1, ...s17_ridge(23, 575, 95, 0.0035, [[450, 50, 120], [1250, 60, 140], [1900, 40, 100]], 6, 2),
      top: 450, c0: '#253f73', c1: '#3a5a8e', rim: 0.12 },
    { p: S17_P.m2, ...s17_ridge(37, 612, 55, 0.005, [[-50, 60, 160], [1050, 25, 120]], 4, 9),
      top: 530, c0: '#1a2f5c', c1: '#2c4a7c', rim: 0.08 },
  ]);
}

// ---------- village geometry (cached data) ----------
function s17_terraceY(k, x) {
  const K = 9, t = k / K;
  return 700 + 420 * t ** 1.4 + (18 + 50 * t) * Math.sin(x * (0.0019 - t * 0.0006) + k * 1.1) + (6 + 14 * t) * noise1(x * 0.005, k + 3) - (x - 700) * 0.035 * (1 - t);
}
function s17_roadAt(s) {   // road centre line from bottom (s=0) to village (s=1), with half width
  const p0 = [760, 1130], p1 = [700, 930], p2 = [900, 780], p3 = [930, 690];
  const u = 1 - s;
  const x = u ** 3 * p0[0] + 3 * u * u * s * p1[0] + 3 * u * s * s * p2[0] + s ** 3 * p3[0];
  const y = u ** 3 * p0[1] + 3 * u * u * s * p1[1] + 3 * u * s * s * p2[1] + s ** 3 * p3[1];
  return { x, y, hw: lerp(70, 5, s ** 0.75) };
}
function s17_poleAt(s) {
  const a = s17_roadAt(s);
  const dpt = clamp((a.y - 600) / 480);
  const side = a.hw + 6 + 20 * dpt;
  return { x: a.x + side, y: a.y, h: 36 + 600 * dpt ** 1.5, w: 2 + 13 * dpt ** 1.3 };
}
function s17_village() {
  if (S17.c.vil) return S17.c.vil;
  const r = rng(424242);
  const V = { houses: [], trees: [], wins: [], cedars: [] };
  // back village cluster on the flat
  for (let i = 0; i < 40; i++) {
    const x = 120 + r() * 1020;
    if (x > 860 && x < 990 && r() < 0.8) continue;           // keep road entry open
    const y = 645 + r() * 48;
    const s = 0.5 + (y - 645) / 48 * 0.25 + r() * 0.08;
    V.houses.push({ x, y, s, type: r() < 0.42 ? 'thatch' : 'tile', w: 70 + r() * 50, seed: i, lit: r() < 0.62, nw: 1 + Math.floor(r() * 3) });
  }
  for (let i = 0; i < 38; i++) V.trees.push({ x: 60 + r() * 1180, y: 640 + r() * 50, s: 0.6 + r() * 0.6, seed: i });
  // left-middle farmhouse knoll
  V.knoll = [[-80, 790], [60, 752], [240, 742], [420, 752], [560, 778], [590, 800], [520, 832], [300, 848], [60, 852], [-80, 850]];
  V.houses.push({ x: 150, y: 810, s: 1.35, type: 'thatch', w: 120, seed: 101, lit: true, nw: 2, refl: true });
  V.houses.push({ x: 395, y: 800, s: 1.05, type: 'tile', w: 110, seed: 102, lit: true, nw: 3, refl: true });
  V.houses.push({ x: 520, y: 790, s: 0.7, type: 'tile', w: 70, seed: 103, lit: false, nw: 1 });
  V.trees.push({ x: 40, y: 770, s: 1.6, seed: 201 }, { x: 260, y: 764, s: 1.3, seed: 202 }, { x: 290, y: 772, s: 1.0, seed: 203 }, { x: 470, y: 772, s: 0.9, seed: 204 });
  // shrine grove with cedars (near the foot of the hill)
  for (let i = 0; i < 9; i++) V.cedars.push({ x: 1105 + i * 19 + r() * 10, y: 690 - r() * 10, h: 90 + r() * 60, w: 18 + r() * 8 });
  V.houses.sort((a, b) => a.y - b.y);
  V.trees.sort((a, b) => a.y - b.y);
  // paddies
  V.water = new Path2D();
  V.banks = [];
  for (let k = 0; k < 9; k++) {
    const t = k / 9, t1 = (k + 1) / 9;
    const wall = 3 + 16 * t1;
    const top = [], bot = [];
    for (let x = -60; x <= 1560; x += 16) { top.push([x, s17_terraceY(k, x)]); bot.push([x, s17_terraceY(k + 1, x) - wall]); }
    V.water.moveTo(top[0][0], top[0][1]);
    top.forEach(([x, y]) => V.water.lineTo(x, y));
    for (let i = bot.length - 1; i >= 0; i--) V.water.lineTo(bot[i][0], bot[i][1]);
    V.water.closePath();
    // dividers (little bunds between paddies)
    const divs = [];
    let x = -60 + r() * 100;
    while (x < 1560) {
      divs.push(x);
      x += 150 + 420 * t ** 1.2 + r() * 120;
    }
    V.banks.push({ k, wall, divs, t });
  }
  S17.c.vil = V;
  return V;
}

function s17_blob(g, x, y, rad, n, seed, col, ox = 0, oy = 0) {
  const r = rng(seed);
  g.fillStyle = col;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * rad * 0.62;
    const rr = rad * (0.32 + r() * 0.3);
    const cx = x + Math.cos(a) * d + ox, cy = y + Math.sin(a) * d * 0.8 + oy;
    g.moveTo(cx + rr, cy); g.arc(cx, cy, rr, 0, TAU);
  }
  g.fill();
}
function s17_tree(g, t) {
  const s = t.s;
  g.fillStyle = '#081526';
  g.fillRect(t.x - 2 * s, t.y - 14 * s, 4 * s, 14 * s);
  s17_blob(g, t.x, t.y - 26 * s, 24 * s, 9, t.seed * 13 + 5, '#1a3453', -2 * s, -3 * s);
  s17_blob(g, t.x, t.y - 26 * s, 24 * s, 9, t.seed * 13 + 5, '#0c1b30');
}
function s17_house(g, h, V) {
  const s = h.s, w = h.w * s, x = h.x, y = h.y;
  const wallH = (h.type === 'thatch' ? 20 : 24) * s;
  const r = rng(h.seed * 31 + 7);
  // base / stone footing
  g.fillStyle = '#0b1322'; g.fillRect(x - w / 2 - 2 * s, y - 3 * s, w + 4 * s, 3 * s);
  // wall with moonlit left face gradient
  const wg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  wg.addColorStop(0, '#26324c'); wg.addColorStop(1, '#141b2e');
  g.fillStyle = wg; g.fillRect(x - w / 2, y - wallH, w, wallH - 3 * s);
  // posts
  g.fillStyle = 'rgba(8,12,22,0.8)';
  for (let i = 0; i <= 4; i++) g.fillRect(x - w / 2 + (w - 2 * s) * i / 4, y - wallH, 2 * s, wallH);
  // windows
  const nw = h.nw;
  for (let i = 0; i < nw; i++) {
    const ww = w * (nw === 1 ? 0.3 : 0.2), wh = wallH * 0.48;
    const wx = x - w / 2 + w * (i + 0.5) / nw - ww / 2 + (r() - 0.5) * w * 0.05, wy = y - wallH * 0.8;
    if (h.lit && (i === 0 || r() < 0.75)) {
      g.fillStyle = '#d98a3c'; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = '#ffc070'; g.fillRect(wx + ww * 0.08, wy + wh * 0.1, ww * 0.84, wh * 0.8);
      if (ww > 9) {             // shoji lattice
        g.fillStyle = 'rgba(90,45,20,0.55)';
        const nx = Math.max(2, Math.round(ww / 7));
        for (let k = 1; k < nx; k++) g.fillRect(wx + ww * k / nx - 0.4 * s, wy, 0.8 * s, wh);
        g.fillRect(wx, wy + wh * 0.5 - 0.4 * s, ww, 0.8 * s);
      }
      V.wins.push({ x: wx + ww / 2, y: wy + wh / 2, w: ww, h: wh, seed: h.seed * 10 + i, refl: h.refl, base: y });
    } else {
      g.fillStyle = '#0d1426'; g.fillRect(wx, wy, ww, wh);
    }
  }
  const ov = 9 * s, ey = y - wallH + 2 * s;
  if (h.type === 'tile') {
    const rh = 22 * s;
    const rg = g.createLinearGradient(0, ey - rh, 0, ey);
    rg.addColorStop(0, '#34466a'); rg.addColorStop(1, '#161e33');
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(x - w / 2 - ov, ey);
    g.quadraticCurveTo(x - w / 2 + w * 0.08, ey - rh * 0.35, x - w / 2 + w * 0.2, ey - rh);
    g.lineTo(x + w / 2 - w * 0.2, ey - rh);
    g.quadraticCurveTo(x + w / 2 - w * 0.08, ey - rh * 0.35, x + w / 2 + ov, ey);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(12,16,30,0.55)'; g.lineWidth = 0.8 * s;
    for (let i = 1; i < 14; i++) {
      const u = i / 14, bx = x - w / 2 - ov + (w + 2 * ov) * u, tx = x - w / 2 + w * 0.2 + (w * 0.6) * u;
      g.beginPath(); g.moveTo(bx, ey); g.lineTo(tx, ey - rh); g.stroke();
    }
    // ridge with upturned ends + moon highlight
    g.strokeStyle = '#0c111f'; g.lineWidth = 3.2 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - w / 2 + w * 0.2 - 5 * s, ey - rh - 4 * s); g.lineTo(x - w / 2 + w * 0.2, ey - rh);
    g.lineTo(x + w / 2 - w * 0.2, ey - rh); g.lineTo(x + w / 2 - w * 0.2 + 5 * s, ey - rh - 4 * s); g.stroke();
    g.strokeStyle = 'rgba(140,170,220,0.45)'; g.lineWidth = 1 * s;
    g.beginPath(); g.moveTo(x - w / 2 - ov, ey - 0.5 * s);
    g.quadraticCurveTo(x - w / 2 + w * 0.08, ey - rh * 0.35, x - w / 2 + w * 0.2, ey - rh - 1.5 * s);
    g.lineTo(x + w / 2 - w * 0.2, ey - rh - 1.5 * s); g.stroke();
  } else {
    const rh = 44 * s;
    const rg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    rg.addColorStop(0, '#433f4e'); rg.addColorStop(0.45, '#2c2a39'); rg.addColorStop(1, '#1a1a28');
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(x - w / 2 - ov, ey + 2 * s);
    g.lineTo(x - w * 0.2, ey - rh);
    g.quadraticCurveTo(x, ey - rh - 5 * s, x + w * 0.2, ey - rh);
    g.lineTo(x + w / 2 + ov, ey + 2 * s);
    g.closePath(); g.fill();
    // thatch streaks
    g.strokeStyle = 'rgba(10,10,20,0.35)'; g.lineWidth = 0.9 * s;
    for (let i = 0; i < 22; i++) {
      const u = r();
      const bx = x - w / 2 - ov + (w + 2 * ov) * u, tx = x - w * 0.2 + w * 0.4 * u;
      g.beginPath(); g.moveTo(bx, ey + 1 * s); g.lineTo(lerp(bx, tx, 0.5 + r() * 0.4), lerp(ey, ey - rh, 0.5 + r() * 0.4)); g.stroke();
    }
    // eaves thickness
    g.fillStyle = '#121220'; g.fillRect(x - w / 2 - ov, ey, w + 2 * ov, 3.5 * s);
    // ridge cap
    g.fillStyle = '#12131f';
    g.fillRect(x - w * 0.22, ey - rh - 6 * s, w * 0.44, 6 * s);
    for (let i = 0; i < 4; i++) g.fillRect(x - w * 0.16 + i * w * 0.1, ey - rh - 9 * s, 2.2 * s, 5 * s);
    g.strokeStyle = 'rgba(150,170,215,0.4)'; g.lineWidth = 1 * s;
    g.beginPath(); g.moveTo(x - w / 2 - ov, ey + 1 * s); g.lineTo(x - w * 0.2, ey - rh - 0.5 * s); g.stroke();
  }
}

function s17_torii(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#86303a';
  g.beginPath(); g.moveTo(-15, 0); g.lineTo(-12.5, -40); g.lineTo(-9.5, -40); g.lineTo(-11, 0); g.fill();
  g.beginPath(); g.moveTo(15, 0); g.lineTo(12.5, -40); g.lineTo(9.5, -40); g.lineTo(11, 0); g.fill();
  g.fillRect(-17, -33, 34, 3);
  g.fillStyle = '#6d2430'; g.fillRect(-2, -40, 4, 7);
  g.fillStyle = '#1a0f18';
  g.beginPath(); g.moveTo(-24, -39); g.quadraticCurveTo(0, -42, 24, -39); g.lineTo(26, -45); g.quadraticCurveTo(0, -46, -26, -45); g.closePath(); g.fill();
  g.fillStyle = '#9a3a44'; g.fillRect(-20, -40, 40, 2.2);
  g.fillStyle = 'rgba(200,210,240,0.35)'; g.fillRect(-12.5, -40, 1, 40);
  g.restore();
}

// back part of the village layer (land behind water)
function s17_villageBack() {
  if (S17.c.vback) return S17.c.vback;
  const ox = -200, oy = 520, c = s17_canvas(2320, 700), g = c.getContext('2d');
  g.translate(-ox, -oy);
  // valley ground
  const gg = g.createLinearGradient(0, 590, 0, 1200);
  gg.addColorStop(0, '#162c4e'); gg.addColorStop(0.2, '#0f213d'); gg.addColorStop(1, '#08111f');
  g.fillStyle = gg; g.fillRect(ox, 600, 2320, 620);
  // distant forest line along valley back
  const r = rng(99);
  for (let pass = 0; pass < 2; pass++) {
    g.fillStyle = pass ? '#11244a' : '#1d3563';
    g.beginPath();
    for (let x = ox; x < 2120; x += 7 + r() * 9) {
      const yy = 612 + 10 * noise1(x * 0.01, 3) + pass * 10;
      const rr = 6 + r() * 10;
      g.moveTo(x + rr, yy); g.arc(x, yy, rr, 0, TAU);
    }
    g.rect(ox, 612 + pass * 10, 2320, 60);
    g.fill();
  }
  return (S17.c.vback = { c, ox, oy });
}

// front part of the village layer: bunds, knoll, road, houses, trees, poles
function s17_villageFront() {
  if (S17.c.vfront) return S17.c.vfront;
  const V = s17_village();
  const ox = -200, oy = 470, c = s17_canvas(2320, 760), g = c.getContext('2d');
  g.translate(-ox, -oy);
  // terrace walls + bunds
  for (const b of V.banks) {
    const k1 = b.k + 1;
    const top = [], bot = [];
    for (let x = -60; x <= 1560; x += 16) { top.push([x, s17_terraceY(k1, x) - b.wall]); bot.push([x, s17_terraceY(k1, x) + 1]); }
    const wg = g.createLinearGradient(0, top[40][1], 0, bot[40][1]);
    wg.addColorStop(0, '#1f3452'); wg.addColorStop(0.3, '#12213a'); wg.addColorStop(1, '#0a1426');
    g.fillStyle = wg;
    g.beginPath();
    top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
    g.closePath(); g.fill();
    // moonlit bund lip
    g.strokeStyle = `rgba(120,150,200,${0.25 + 0.2 * b.t})`; g.lineWidth = 0.8 + 1.4 * b.t;
    g.beginPath(); top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    // grass tufts on the lip
    const r = rng(500 + b.k);
    g.strokeStyle = '#0e1e33'; g.lineWidth = 0.6 + b.t * 1.2;
    g.beginPath();
    for (let x = -60; x < 1560; x += 5 + r() * 12 * (1 - b.t * 0.5)) {
      const y = s17_terraceY(k1, x) - b.wall, hh = (2 + 9 * b.t) * (0.5 + r());
      g.moveTo(x, y + 1); g.lineTo(x + (r() - 0.4) * hh * 0.6, y - hh);
    }
    g.stroke();
    // dividers between paddies in the row above
    for (const dx of b.divs) {
      const yT = s17_terraceY(b.k, dx), yB = s17_terraceY(k1, dx + (dx - 960) * 0.08) - b.wall;
      const x2 = dx + (dx - 960) * (yB - yT) / Math.max(40, yT - 380);
      g.strokeStyle = '#132440'; g.lineWidth = 1.5 + 5 * b.t;
      g.beginPath(); g.moveTo(dx, yT); g.lineTo(x2, yB); g.stroke();
      g.strokeStyle = 'rgba(120,150,200,0.25)'; g.lineWidth = 0.6 + 1.2 * b.t;
      g.beginPath(); g.moveTo(dx - 1 - b.t * 2, yT); g.lineTo(x2 - 1 - b.t * 2, yB); g.stroke();
    }
  }
  // road
  const L = [], R = [];
  for (let i = 0; i <= 60; i++) { const a = s17_roadAt(i / 60); L.push([a.x - a.hw, a.y]); R.push([a.x + a.hw, a.y]); }
  const rgd = g.createLinearGradient(0, 690, 0, 1130);
  rgd.addColorStop(0, '#35507a'); rgd.addColorStop(1, '#1f3150');
  g.fillStyle = rgd;
  g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(12,22,40,0.8)'; g.lineWidth = 2;
  g.beginPath(); R.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  // knoll with farmhouses
  const kg = g.createLinearGradient(0, 740, 0, 860);
  kg.addColorStop(0, '#152b47'); kg.addColorStop(1, '#0a1628');
  g.fillStyle = kg;
  g.beginPath();
  V.knoll.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath(); g.fill();
  // village flat trees + houses interleaved by depth
  const items = [...V.trees.map((t) => ({ y: t.y - 4, f: () => s17_tree(g, t) })), ...V.houses.map((h) => ({ y: h.y, f: () => s17_house(g, h, V) }))];
  // shrine grove & torii
  for (const cd of V.cedars) items.push({ y: cd.y - 30, f: () => {
    g.fillStyle = '#0a1828';
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const yy = cd.y - cd.h * (0.15 + i * 0.18), ww = cd.w * (1 - i * 0.16);
      g.moveTo(cd.x - ww, yy + cd.h * 0.2); g.lineTo(cd.x, yy - cd.h * 0.12); g.lineTo(cd.x + ww, yy + cd.h * 0.2);
    }
    g.fill();
    g.fillRect(cd.x - 1.5, cd.y - cd.h * 0.2, 3, cd.h * 0.2);
  } });
  items.push({ y: 697, f: () => {
    g.fillStyle = '#26344e';
    for (let i = 0; i < 5; i++) g.fillRect(1150 - 10 + i * 0.5, 698 + i * 3, 22 - i, 2);
    s17_torii(g, 1152, 697, 0.95);
  } });
  items.sort((a, b) => a.y - b.y).forEach((it) => it.f());
  // telephone poles + wires
  const poles = [0.03, 0.27, 0.47, 0.63, 0.76, 0.86, 0.94].map(s17_poleAt);
  poles.push({ x: 1010, y: 668, h: 30, w: 2 }, { x: 1090, y: 663, h: 28, w: 2 });
  const tops = poles.map((p) => [p.x, p.y - p.h]);
  g.strokeStyle = 'rgba(5,10,20,0.85)';
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i], b = poles[i + 1];
    for (let wv = 0; wv < 3; wv++) {
      const o = (wv - 1) * 0.28;
      const ax = a.x + o * a.h * 0.12, ay = a.y - a.h * (wv === 1 ? 0.95 : 0.92), bx = b.x + o * b.h * 0.12, by = b.y - b.h * (wv === 1 ? 0.95 : 0.92);
      const sag = Math.hypot(bx - ax, by - ay) * 0.07;
      g.lineWidth = 0.6 + a.w * 0.12;
      g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag * 2, bx, by); g.stroke();
    }
  }
  for (const p of poles) {
    g.fillStyle = '#060d19';
    g.beginPath(); g.moveTo(p.x - p.w / 2, p.y); g.lineTo(p.x - p.w * 0.32, p.y - p.h); g.lineTo(p.x + p.w * 0.32, p.y - p.h); g.lineTo(p.x + p.w / 2, p.y); g.fill();
    g.fillRect(p.x - p.h * 0.075, p.y - p.h * 0.93, p.h * 0.15, Math.max(1, p.w * 0.35));
    g.fillStyle = 'rgba(120,150,205,0.35)';
    g.fillRect(p.x - p.w / 2, p.y - p.h, Math.max(0.6, p.w * 0.15), p.h);
    if (p.h > 150) {           // insulators
      g.fillStyle = '#1d2b44';
      for (let k = -1; k <= 1; k++) g.fillRect(p.x + k * p.h * 0.06 - 1.5, p.y - p.h * 0.93 - 4, 3, 4);
    }
  }
  S17.c.vfront = { c, ox, oy, tops };
  return S17.c.vfront;
}

// ---------- hill with the camphor tree (cached) ----------
function s17_hillEdgeY(x) {
  if (x < 1600) return 552 + (1150 - 552) * clamp((1600 - x) / 520) ** 1.7 + 10 * Math.sin((x - 1080) * 0.02) * clamp((1600 - x) / 300);
  return 552 + 8 * Math.sin((x - 1600) * 0.012) + (x > 1860 ? (x - 1860) * 0.12 : 0);
}
function s17_hill() {
  if (S17.c.hill) return S17.c.hill;
  const ox = 1080, oy = 80, c = s17_canvas(1500, 1120), g = c.getContext('2d');
  g.translate(-ox, -oy);
  // tree limbs + trunk (behind ground edge a bit)
  const TX = 1745, TY = 556;
  g.strokeStyle = '#0a1726'; g.lineCap = 'round';
  const limb = (x0, y0, cx, cy, x1, y1, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke(); };
  limb(1735, 470, 1640, 430, 1540, 340, 22);
  limb(1740, 460, 1690, 350, 1640, 260, 26);
  limb(1755, 455, 1770, 330, 1790, 220, 28);
  limb(1765, 460, 1860, 380, 1940, 300, 24);
  limb(1770, 470, 1920, 440, 2030, 390, 18);
  limb(1560, 350, 1500, 360, 1460, 400, 10);
  // trunk
  const tg = g.createLinearGradient(TX - 60, 0, TX + 60, 0);
  tg.addColorStop(0, '#22324a'); tg.addColorStop(0.3, '#101d2e'); tg.addColorStop(1, '#070f1a');
  g.fillStyle = tg;
  g.beginPath();
  g.moveTo(TX - 85, TY + 6);
  g.quadraticCurveTo(TX - 45, TY - 5, TX - 38, TY - 50);
  g.quadraticCurveTo(TX - 30, TY - 100, TX - 22, TY - 120);
  g.lineTo(TX + 25, TY - 118);
  g.quadraticCurveTo(TX + 30, TY - 80, TX + 42, TY - 45);
  g.quadraticCurveTo(TX + 55, TY - 5, TX + 95, TY + 8);
  g.closePath(); g.fill();
  // bark lines
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(TX - 28 + i * 11, TY); g.quadraticCurveTo(TX - 20 + i * 8, TY - 60, TX - 14 + i * 6, TY - 118); g.stroke(); }
  // shimenawa rope + shide
  g.strokeStyle = '#8a8672'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(TX - 40, TY - 58); g.quadraticCurveTo(TX, TY - 46, TX + 44, TY - 60); g.stroke();
  g.strokeStyle = 'rgba(40,40,40,0.5)'; g.lineWidth = 1.2;
  for (let i = 0; i < 12; i++) { const x = TX - 38 + i * 7; g.beginPath(); g.moveTo(x, TY - 61 + Math.abs(i - 5.5) * 0.4 + 6); g.lineTo(x + 4, TY - 55 + Math.abs(i - 5.5) * 0.4 - 6); g.stroke(); }
  g.fillStyle = '#c9d2e6';
  for (const sx of [TX - 22, TX + 3, TX + 26]) {
    g.beginPath(); g.moveTo(sx, TY - 50); g.lineTo(sx + 5, TY - 50); g.lineTo(sx + 2, TY - 40); g.lineTo(sx + 7, TY - 40); g.lineTo(sx + 4, TY - 30); g.lineTo(sx - 1, TY - 30); g.lineTo(sx + 2, TY - 40); g.lineTo(sx - 3, TY - 40); g.closePath(); g.fill();
  }
  // canopy lobes (back to front), with moon rim light from the upper left
  const lobes = [[1690, 215, 105], [1810, 205, 110], [1590, 270, 95], [1920, 260, 100], [1520, 340, 80], [2020, 340, 90],
    [1650, 320, 95], [1760, 290, 110], [1870, 330, 100], [1460, 400, 55], [1580, 395, 70], [1980, 410, 70], [2080, 420, 60],
    [1700, 385, 75], [1820, 395, 75], [1760, 190, 80]];
  lobes.forEach(([x, y, rad], i) => {
    s17_blob(g, x, y, rad, 16, 900 + i, '#2a4a6e', -7, -8);
    s17_blob(g, x, y, rad, 16, 900 + i, '#0c1c2e');
    s17_blob(g, x + rad * 0.12, y + rad * 0.2, rad * 0.75, 10, 950 + i, '#081423');
    // leaf speckle
    const r = rng(970 + i);
    g.fillStyle = 'rgba(60,95,140,0.35)';
    for (let k = 0; k < 26; k++) {
      const a = -2.4 + (r() - 0.5) * 1.8, d = rad * (0.45 + r() * 0.45);
      g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 1.5 + r() * 3, 0, TAU); g.fill();
    }
  });
  // hill ground
  const hg = g.createLinearGradient(0, 540, 0, 1150);
  hg.addColorStop(0, '#122a3e'); hg.addColorStop(0.3, '#0b1b2b'); hg.addColorStop(1, '#050c16');
  g.fillStyle = hg;
  g.beginPath(); g.moveTo(1120, 1200);
  for (let x = 1120; x <= 2580; x += 6) g.lineTo(x, s17_hillEdgeY(x));
  g.lineTo(2580, 1200); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(110,145,200,0.45)'; g.lineWidth = 2;
  g.beginPath();
  for (let x = 1140; x <= 1900; x += 6) (x === 1140 ? g.moveTo(x, s17_hillEdgeY(x)) : g.lineTo(x, s17_hillEdgeY(x)));
  g.stroke();
  // slope texture: grass strokes catching moonlight near the crest, shrubs
  {
    const r = rng(5150);
    g.lineCap = 'round';
    for (let i = 0; i < 1400; i++) {
      const x = 1130 + r() * 1300, ye = s17_hillEdgeY(x);
      const dd = r() ** 1.8 * 520, y = ye + 6 + dd;
      if (y > 1160) continue;
      const lit = clamp(1 - dd / 260) * (x < 1700 ? 1 : 0.5);
      g.strokeStyle = r() < 0.5 ? `rgba(70,105,150,${0.1 + 0.25 * lit})` : 'rgba(3,8,16,0.35)';
      g.lineWidth = 1 + r() * 1.5;
      const hh = 5 + r() * 10;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.3) * hh * 0.6, y - hh); g.stroke();
    }
    for (const [x, dy, rad] of [[1300, 40, 30], [1380, 30, 24], [1250, 70, 36], [1470, 18, 22], [1900, 20, 30], [2000, 40, 38]]) {
      const y = s17_hillEdgeY(x) + dy;
      s17_blob(g, x, y, rad, 9, x, '#24425f', -3, -4);
      s17_blob(g, x, y, rad, 9, x, '#0a1826');
    }
  }
  // stone lantern (toro)
  const LX = 1540, LY = s17_hillEdgeY(1540) + 3;
  g.fillStyle = '#18253a';
  g.fillRect(LX - 11, LY - 6, 22, 6); g.fillRect(LX - 3.5, LY - 26, 7, 20); g.fillRect(LX - 9, LY - 30, 18, 4);
  g.fillRect(LX - 7, LY - 42, 14, 12);
  g.beginPath(); g.moveTo(LX - 15, LY - 42); g.quadraticCurveTo(LX, LY - 52, LX + 15, LY - 42); g.lineTo(LX, LY - 55); g.closePath(); g.fill();
  g.beginPath(); g.arc(LX, LY - 56, 2.5, 0, TAU); g.fill();
  g.fillStyle = '#d99a52'; g.fillRect(LX - 3.5, LY - 39.5, 7, 6);
  g.fillStyle = 'rgba(140,170,215,0.45)'; g.fillRect(LX - 11, LY - 6, 2, 6); g.fillRect(LX - 7, LY - 42, 1.5, 12);
  S17.c.hill = { c, ox, oy, lantern: [LX, LY - 36] };
  return S17.c.hill;
}

// ---------- the whole panorama ----------
// fx: { sky(ctx,T,refl), onHill(ctx,T), winBoost, glitter, flash, starBoost }
function s17_panorama(ctx, T, cam, fx = {}) {
  const sky = s17_sky();
  const S = S17_SKY;
  // --- sky
  ctx.save();
  s17_layer(ctx, cam, S17_P.sky);
  ctx.drawImage(sky, S.x0, S.y0);
  ctx.globalCompositeOperation = 'lighter';
  s17_skyLive(ctx, T, fx, false);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  // --- mountains
  const mtn = s17_mountains();
  for (const m of mtn) {
    ctx.save();
    s17_layer(ctx, cam, m.p);
    const g = ctx.createLinearGradient(0, m.top, 0, 700);
    g.addColorStop(0, m.c0); g.addColorStop(1, m.c1);
    ctx.fillStyle = g; ctx.fill(m.fill);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(150,180,235,${m.rim})`; ctx.lineWidth = 1.5; ctx.stroke(m.edge);
    ctx.restore();
    // mist between ridges
    ctx.save();
    s17_layer(ctx, cam, m.p + 0.03);
    const mg = ctx.createLinearGradient(0, 540, 0, 720);
    mg.addColorStop(0, 'rgba(150,180,230,0)'); mg.addColorStop(0.55, 'rgba(150,180,230,0.16)'); mg.addColorStop(1, 'rgba(150,180,230,0)');
    ctx.fillStyle = mg; ctx.fillRect(-800, 540, 3600, 180);
    ctx.restore();
  }
  // --- drifting mist band
  ctx.save();
  s17_layer(ctx, cam, S17_P.mist);
  for (let i = 0; i < 9; i++) {
    const w = 700 + hash(i + 3) * 700;
    const x = ((hash(i) * 3200 + T * (10 + hash(i + 9) * 14)) % 3200) - 700;
    const y = 616 + hash(i + 5) * 30;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.09);
    s17_glow(ctx, 0, 0, w / 2, '#9fbde8', 0.28);
    ctx.restore();
  }
  ctx.restore();
  // --- village
  const vb = s17_villageBack(), vf = s17_villageFront(), V = s17_village();
  ctx.save();
  s17_layer(ctx, cam, S17_P.vil);
  ctx.drawImage(vb.c, vb.ox, vb.oy);
  // water: mirrored sky with noisy shimmer
  ctx.save();
  ctx.clip(V.water);
  for (let yv = 680; yv < 1140; yv += 3) {
    const ys = 2 * S17_HZ - yv;
    const dep = clamp((yv - 690) / 420);
    const off = (1.5 + 9 * dep) * noise2(yv * 0.11, T * 0.9, 3) + 4 * dep * noise2(yv * 0.031, T * 0.4, 5);
    ctx.drawImage(sky, 0, ys - S.y0 - 3, S.w, 3, S.x0 + off, yv, S.w, 3);
  }
  ctx.save();
  ctx.translate(0, 2 * S17_HZ); ctx.scale(1, -1);
  ctx.globalCompositeOperation = 'lighter';
  s17_skyLive(ctx, T, fx, true);
  ctx.restore();
  // moon glitter column
  ctx.globalCompositeOperation = 'lighter';
  const mx = S17_MOON.x, my = 2 * S17_HZ - S17_MOON.y;
  for (let i = 0; i < 26; i++) {
    const yy = my - 70 + i * 6, jit = noise2(i * 0.7, T * 1.3, 8) * (10 + i * 0.6);
    const a = 0.3 * (1 - Math.abs(i - 12) / 14) * (0.6 + 0.4 * noise1(T * 3 + i, 9));
    ctx.fillStyle = `rgba(230,238,255,${clamp(a)})`;
    ctx.fillRect(mx + jit - 8 - i * 0.4, yy, 16 + i * 0.8, 1.6);
  }
  // window light reflections
  const wb = 1 + (fx.winBoost || 0);
  for (const w of V.wins) {
    if (!w.refl) continue;
    const ry = 2 * w.base - w.y + 6;
    for (let i = 0; i < 6; i++) {
      const jit = noise2(i * 0.9 + w.seed, T * 1.4, 4) * 4;
      ctx.fillStyle = rgba('#ffb347', 0.22 * wb * (1 - i / 7));
      ctx.fillRect(w.x - w.w * 0.4 + jit, ry + i * 4, w.w * 0.8, 2);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // darken water (fresnel: far paddies brighter)
  const dg = ctx.createLinearGradient(0, 690, 0, 1100);
  dg.addColorStop(0, 'rgba(5,12,32,0.35)'); dg.addColorStop(1, 'rgba(3,7,20,0.62)');
  ctx.fillStyle = dg; ctx.fillRect(-200, 660, 2300, 480);
  ctx.restore();
  ctx.drawImage(vf.c, vf.ox, vf.oy);
  // lit windows (live)
  ctx.globalCompositeOperation = 'lighter';
  const flick = fx.glitter || 0;
  for (const w of V.wins) {
    const f = 0.8 + 0.2 * noise1(T * 0.6 + w.seed * 3.1, 4);
    s17_glow(ctx, w.x, w.y, Math.max(w.w, w.h) * 3.2 + 6, '#ffb347', 0.5 * f * wb);
    if (flick > 0) {
      const tw = clamp(Math.sin(T * (5 + hash(w.seed) * 6) + w.seed * 7) * 2 - 0.6);
      if (tw > 0) sparkle(ctx, w.x, w.y - w.h * 0.3, (6 + w.w * 0.9) * (0.5 + tw), '#fff3c0', tw * flick, 0);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // low ground mist in front of the village
  const lm = ctx.createLinearGradient(0, 640, 0, 760);
  lm.addColorStop(0, 'rgba(140,170,220,0)'); lm.addColorStop(0.5, 'rgba(140,170,220,0.1)'); lm.addColorStop(1, 'rgba(140,170,220,0)');
  ctx.fillStyle = lm; ctx.fillRect(-300, 640, 2500, 120);
  fireflies(ctx, T, { seed: 17, n: 18, x: 40, y: 740, w: 1180, h: 260, color: '#d8ff8a', size: 0.8 });
  if (fx.onVillage) fx.onVillage(ctx, T);
  ctx.restore();
  // --- hill
  const hl = s17_hill();
  ctx.save();
  s17_layer(ctx, cam, S17_P.hill);
  // canopy sway: tiny shear of the cached hill+tree
  ctx.drawImage(hl.c, hl.ox, hl.oy);
  // grass on the ridge line
  ctx.strokeStyle = '#0a1a2a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 150; i++) {
    const x = 1150 + i * 5.2 + hash(i) * 4, y = s17_hillEdgeY(x) + 2;
    const hh = 6 + hash(i + 400) * 12 + (x < 1500 ? 6 : 0);
    const sw = 3 * noise1(T * 0.8 + x * 0.01, 6) + 2;
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sw * 0.4, y - hh * 0.6, x + sw, y - hh);
  }
  ctx.stroke();
  s17_glow(ctx, hl.lantern[0], hl.lantern[1], 26, '#ffb347', 0.35 + 0.08 * noise1(T * 2, 3));
  fireflies(ctx, T, { seed: 29, n: 9, x: 1240, y: 520, w: 640, h: 220, color: '#e6ff9a', size: 0.9 });
  if (fx.onHill) fx.onHill(ctx, T);
  ctx.restore();
  // --- foreground susuki grass (bottom left corner), strongest parallax
  ctx.save();
  s17_layer(ctx, cam, S17_P.fg);
  ctx.strokeStyle = '#040a14'; ctx.lineCap = 'round';
  for (let i = 0; i < 34; i++) {
    const bx = -40 + hash(i + 700) * 260, len = 140 + hash(i + 800) * 200;
    const sway = 18 * noise1(T * 0.6 + i * 0.3, 7) + 10;
    ctx.lineWidth = 2 + hash(i + 900) * 3;
    ctx.beginPath(); ctx.moveTo(bx, 1110);
    ctx.quadraticCurveTo(bx + sway * 0.3, 1110 - len * 0.6, bx + sway + (hash(i) - 0.3) * 60, 1110 - len);
    ctx.stroke();
  }
  ctx.restore();
}

// Title typography shared by s1 / s7
function s17_title(ctx, cx, cy, size, alpha, opts = {}) {
  if (alpha <= 0.002) return;
  const text = 'ほしまいご';
  const sp = size * (opts.spacing ?? 0.2);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px "Noto Serif CJK JP", serif`;
  ctx.letterSpacing = `${sp}px`;
  const reveal = opts.reveal ?? 1;          // per-glyph stagger 0..1
  const glyphs = [...text];
  const gw = size + sp, x0 = cx - (gw * glyphs.length - sp) / 2 + size / 2;
  ctx.letterSpacing = '0px';
  glyphs.forEach((ch, i) => {
    const k = clamp(reveal * (glyphs.length + 2) - i * 1.0, 0, 2) / 2;
    const a = alpha * smooth(k);
    if (a <= 0) return;
    const x = x0 + i * gw, y = cy + (1 - smooth(k)) * size * 0.12;
    ctx.globalAlpha = a;
    ctx.shadowColor = opts.glowColor || 'rgba(255,205,120,0.95)';
    ctx.shadowBlur = size * 0.55;
    ctx.fillStyle = opts.color || '#fff4d8';
    ctx.fillText(ch, x, y);
    ctx.shadowBlur = size * 0.16;
    ctx.fillText(ch, x, y);
    ctx.shadowBlur = 0;
  });
  // ornament + latin subtitle
  const sub = opts.subAlpha ?? alpha;
  if (sub > 0) {
    ctx.globalAlpha = sub;
    const ly = cy + size * 0.78, lw = size * 1.6;
    const lg = ctx.createLinearGradient(cx - lw, 0, cx + lw, 0);
    lg.addColorStop(0, 'rgba(255,230,180,0)'); lg.addColorStop(0.5, 'rgba(255,230,180,0.8)'); lg.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = lg; ctx.fillRect(cx - lw, ly - 0.75, lw * 2, 1.5);
    sparkle(ctx, cx, ly, size * 0.13, '#fff3c0', sub);
    s17_glow(ctx, cx, ly, size * 0.4, '#ffd76a', sub * 0.6);
    const fs = size * 0.22;
    ctx.font = `700 ${fs}px "Noto Serif CJK JP", serif`;
    ctx.letterSpacing = `${fs * 0.55}px`;
    ctx.shadowColor = 'rgba(255,215,140,0.8)'; ctx.shadowBlur = fs * 0.8;
    ctx.fillStyle = '#f2e6c8';
    ctx.fillText('HOSHI-MAIGO', cx + fs * 0.275, ly + fs * 1.35);
  }
  ctx.restore();
}

// ============================================================================
//  Scene s1
// ============================================================================
registerScene('s1', {
  draw(ctx, t, T, d) {
    // tilt: sky -> village (0..6.1s), then slow push toward the hill on the right
    const tilt = Ease.inOutCubic(invLerp(0.0, 6.1, t));
    const U = 1250 * (1 - tilt);
    const push = Ease.inQuad(invLerp(5.8, 7.8, t));
    const cam = { U, Z: 1 + 0.6 * push, X: 330 * push, fx: 1640, fy: 470 };
    s17_panorama(ctx, T, cam, {
      onHill(c, TT) {
        // tiny Hina on the hilltop with her lantern, looking at the sky (sets up s2)
        drawHina(c, { x: S17_HILLTOP.x - 20, y: S17_HILLTOP.y + 1, scale: 0.16, facing: -1, view: 'back', pose: 'lookUp', T: TT, wind: 0.3, lantern: { glow: 0.7 } });
        s17_glow(c, S17_HILLTOP.x - 10, S17_HILLTOP.y - 20, 40, '#ffb347', 0.5 + 0.1 * noise1(TT * 2.5, 5));
      },
    });
    // title 1.0 -> 2.8 in, out by 3.2
    const a = prog(t, 1.0, 2.8) * (1 - prog(t, 2.9, 3.25));
    s17_title(ctx, W / 2, 430 - t * 6, 104, a, { reveal: prog(t, 1.0, 2.6), subAlpha: prog(t, 1.8, 2.8) * (1 - prog(t, 2.9, 3.25)) });
  },
});
