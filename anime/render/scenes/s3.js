// Scene s3 — the rice field where the star fell (13.5–24.0).
// Shared helpers for s3/s4 are prefixed `s34_` (s4.js is loaded after this file).
'use strict';

// ---------------------------------------------------------------------------
// World: a pseudo-perspective ground plane. Depth z (1 = crater distance),
// screen y = HY + K/z, x = W/2 + X*K/z. Camera is a 2D transform on top.
// ---------------------------------------------------------------------------
const s34_HY = 590, s34_K = 215;
const s34_cache = {};
const s34_CRATER = { X: 0.465, z: 1.0 };
function s34_zy(z) { return s34_HY + s34_K / z; }
function s34_zx(X, z) { return W / 2 + X * s34_K / z; }
function s34_buf(name, w, h) {
  let c = s34_cache['buf_' + name];
  if (!c) { c = document.createElement('canvas'); c.width = w; c.height = h; s34_cache['buf_' + name] = c; }
  return c;
}
// world -> screen matrix for a camera
function s34_world(ctx, cam) {
  const z = cam.zoom;
  ctx.setTransform(z, 0, 0, z, W / 2 - cam.x * z, H / 2 - cam.y * z);
}
function s34_horizon(cam) { return (s34_HY - cam.y) * cam.zoom + H / 2; }
// background layers: parallax p (0 = fixed, 1 = world), keep the horizon glued to the ground's
function s34_bgMat(cam, p, zp) {
  const a = 1 + (cam.zoom - 1) * zp;
  const bx = W / 2 + (cam.x - W / 2) * p;
  const sy = s34_horizon(cam);
  return [a, W / 2 - bx * a, sy - s34_HY * a];
}

// ----------------------------------------------------------------- sky ----
function s34_starList() {
  if (s34_cache.stars) return s34_cache.stars;
  const r = rng(3401), a = [];
  for (let i = 0; i < 1500; i++) {
    const s = r();
    a.push({
      x: r() * 2800 - 440, y: s34_HY - 8 - Math.pow(r(), 0.8) * 1250,
      s, f: 0.8 + r() * 3, ph: r() * TAU,
      col: r() < 0.18 ? '#ffe6c4' : r() < 0.25 ? '#c4d8ff' : '#ffffff',
    });
  }
  const m = [];
  for (let i = 0; i < 38; i++) {
    const u = r();
    m.push({ x: lerp(-300, 2300, u), y: lerp(s34_HY + 40, -700, u) + (r() - 0.5) * 240, r: 150 + r() * 200, c: i % 3 ? '#6f7fd8' : '#b58ad8', a: 0.07 + r() * 0.06 });
  }
  s34_cache.stars = { a, m };
  return s34_cache.stars;
}
// draws sky (mirror=false) or its reflection in the water (mirror=true) in screen space
function s34_sky(ctx, cam, T, mirror, dim = 1) {
  const [a, e, f] = s34_bgMat(cam, 0.08, 0.1);
  const sy = s34_horizon(cam);
  const { a: stars, m } = s34_starList();
  const Y = (y) => (mirror ? 2 * sy - (a * y + f) : a * y + f);
  // milky way haze: cached at quarter resolution
  let mc = s34_cache.milky;
  if (!mc) {
    mc = document.createElement('canvas'); mc.width = 760; mc.height = 380;
    const g = mc.getContext('2d');
    g.scale(0.25, 0.25); g.translate(500, 800);
    for (const q of m) glow(g, q.x, q.y, q.r, q.c, q.a);
    s34_cache.milky = mc;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = dim;
  if (mirror) ctx.setTransform(a * 4, 0, 0, -a * 4, e + a * -500, 2 * sy - f - a * -800);
  else ctx.setTransform(a * 4, 0, 0, a * 4, e - 500 * a, f - 800 * a);
  ctx.drawImage(mc, 0, 0);
  ctx.restore();
  for (const st of stars) {
    const x = a * st.x + e, y = Y(st.y);
    if (x < -5 || x > W + 5 || y < -5 || y > H + 5) continue;
    if (mirror ? y < sy || st.s < 0.55 : y > sy) continue;
    const tw = 0.55 + 0.45 * Math.sin(T * st.f + st.ph);
    const size = (st.s < 0.94 ? 0.7 + st.s * 1.3 : 2.2 + (st.s - 0.94) * 28) * Math.sqrt(a);
    ctx.globalAlpha = clamp(tw * (0.4 + st.s * 0.6) * dim);
    ctx.fillStyle = st.col;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    if (size > 2.6) {
      ctx.globalAlpha = 1;
      sparkle(ctx, x, y, size * 2.6, st.col, tw * 0.6 * dim);
      glow(ctx, x, y, size * 5, st.col, 0.12 * tw * dim);
    }
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------ distant land (cached layer) ----
// Canvas covers bg-world x in [-500, 2420], y in [HY-620, HY+20]
const s34_BG = { x0: -500, y0: s34_HY - 620, w: 2920, h: 640 };
const s34_VILLAGE = [];
(function () {
  const r = rng(771);
  for (let i = 0; i < 26; i++) {
    const x = 120 + r() * 620, y = s34_HY - 14 - r() * 34 + (x - 120) * 0.02;
    s34_VILLAGE.push({ x, y, s: 1 + r() * 1.6, ph: r() * TAU, c: r() < 0.3 ? '#ffd28a' : '#ffb347' });
  }
})();
function s34_hillY(x) {  // the camphor hill on the right
  const d = (x - 1640) / 520;
  return s34_HY - 10 - 170 * Math.exp(-d * d * 1.6) + 6 * noise1(x * 0.02, 4);
}
function s34_bgLayer() {
  if (s34_cache.bg) return s34_cache.bg;
  const { x0, y0, w, h } = s34_BG;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.translate(-x0, -y0);
  const ridge = (col, base, amp, fr, seed, top) => {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x0, s34_HY + 20);
    for (let x = x0; x <= x0 + w; x += 6) g.lineTo(x, base - amp * (0.5 + fbm1(x * fr, seed, 5)) - (top ? top(x) : 0));
    g.lineTo(x0 + w, s34_HY + 20); g.closePath(); g.fill();
  };
  // far range: lighter & bluer (atmospheric perspective)
  ridge('#2c4a82', s34_HY - 90, 170, 0.0022, 11);
  ridge('#223b70', s34_HY - 40, 120, 0.0035, 12);
  ridge('#1a2f5e', s34_HY - 5, 60, 0.006, 13, (x) => 30 * Math.exp(-(((x - 400) / 300) ** 2)));
  // mist band on the valley floor
  const mg = g.createLinearGradient(0, s34_HY - 70, 0, s34_HY + 5);
  mg.addColorStop(0, 'rgba(90,120,180,0)'); mg.addColorStop(1, 'rgba(90,120,180,0.28)');
  g.fillStyle = mg; g.fillRect(x0, s34_HY - 70, w, 80);
  // village roofs silhouettes
  const r = rng(772);
  g.fillStyle = '#131f42';
  for (let i = 0; i < 22; i++) {
    const x = 110 + r() * 660, bw = 22 + r() * 30, by = s34_HY - 6 + (x - 120) * 0.0;
    const bh = 10 + r() * 10;
    g.fillRect(x - bw / 2, by - bh, bw, bh + 8);
    g.beginPath(); g.moveTo(x - bw / 2 - 5, by - bh); g.lineTo(x, by - bh - 9 - r() * 6); g.lineTo(x + bw / 2 + 5, by - bh); g.fill();
  }
  // the camphor hill + treeline
  g.fillStyle = '#12204a';
  g.beginPath(); g.moveTo(900, s34_HY + 20);
  for (let x = 900; x <= x0 + w; x += 4) g.lineTo(x, s34_hillY(x));
  g.lineTo(x0 + w, s34_HY + 20); g.closePath(); g.fill();
  // rim light on the hill crest
  g.strokeStyle = 'rgba(120,150,220,0.35)'; g.lineWidth = 2;
  g.beginPath();
  for (let x = 1200; x <= 2100; x += 4) { const y = s34_hillY(x) + 1; x === 1200 ? g.moveTo(x, y) : g.lineTo(x, y); }
  g.stroke();
  // big camphor tree on the crest
  const tx = 1600, ty = s34_hillY(1600) + 4;
  g.fillStyle = '#0d1838';
  g.beginPath(); g.moveTo(tx - 14, ty); g.quadraticCurveTo(tx - 6, ty - 50, tx - 22, ty - 90); g.lineTo(tx + 20, ty - 92);
  g.quadraticCurveTo(tx + 8, ty - 50, tx + 16, ty); g.fill();
  const tr = rng(990);
  const blobs = [];
  for (let i = 0; i < 46; i++) {
    const a = tr() * Math.PI, rr = tr();
    blobs.push([tx + Math.cos(a) * 150 * rr * 1.25 * (tr() < 0.5 ? -1 : 1), ty - 110 - Math.sin(a) * 85 * rr, 26 + tr() * 30]);
  }
  for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(110,140,210,0.22)';
  for (const [bx, by, br] of blobs) { if (by < ty - 140) { g.beginPath(); g.arc(bx - 3, by - 4, br * 0.8, Math.PI * 1.05, Math.PI * 1.75); g.lineTo(bx - 3, by - 4); g.fill(); } }
  g.fillStyle = '#0d1838';
  for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx + 2, by + 3, br * 0.82, 0, TAU); g.fill(); }
  // village window halos (static part; the flicker is drawn live)
  for (const v of s34_VILLAGE) glow(g, v.x, v.y, 14 * v.s, v.c, 0.45);
  // near embankment / treeline across the valley
  ridge('#0e1a3a', s34_HY + 4, 14, 0.02, 21);
  s34_cache.bg = c;
  return c;
}
function s34_drawBg(ctx, cam, T, mirror = false, dim = 1) {
  const [a, e, f] = s34_bgMat(cam, 0.3, 0.4);
  const sy = s34_horizon(cam);
  const img = s34_bgLayer();
  if (mirror) ctx.setTransform(a, 0, 0, -a, e, 2 * sy - f);
  else ctx.setTransform(a, 0, 0, a, e, f);
  ctx.drawImage(img, s34_BG.x0, s34_BG.y0);
  // village lights + tōrō on the hill
  ctx.save();
  for (const v of s34_VILLAGE) {
    const fl = 0.75 + 0.25 * Math.sin(T * 1.3 + v.ph) * Math.sin(T * 0.7 + v.ph * 2);
    ctx.fillStyle = rgba('#fff0c8', 0.9 * fl * dim);
    ctx.fillRect(v.x - v.s * 0.8, v.y - v.s * 0.6, v.s * 1.6, v.s * 1.2);
  }
  const lx = 1690, ly = s34_hillY(1690) - 6;
  glow(ctx, lx, ly, 18, '#ffb347', 0.5 * dim);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
// Village light reflections: long soft vertical streaks in the water (screen space)
function s34_villageStreaks(ctx, cam, T, amt = 1) {
  const [a, e, f] = s34_bgMat(cam, 0.3, 0.4);
  const sy = s34_horizon(cam);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < s34_VILLAGE.length; i += 2) {
    const v = s34_VILLAGE[i];
    const x = a * v.x + e, y = 2 * sy - (a * v.y + f);
    const fl = 0.7 + 0.3 * Math.sin(T * 1.7 + v.ph);
    ctx.save();
    ctx.translate(x, y + 30 * a);
    ctx.scale(0.18, 1);
    glow(ctx, 0, 0, 90 * a, v.c, 0.28 * fl * amt);
    ctx.restore();
  }
  ctx.restore();
}

// ----------------------------------------------------------- rice rows ----
const s34_ROWZ = [];
for (let z = 0.4; z < 6.2; z += 0.075 + z * 0.06) s34_ROWZ.push(+z.toFixed(3));
// Draw rows whose depth is in [zNear, zFar). vis: world rect.
function s34_rows(ctx, cam, T, zNear, zFar, opt = {}) {
  const x0 = cam.x - W / 2 / cam.zoom - 60, x1 = cam.x + W / 2 / cam.zoom + 60;
  const y1 = cam.y + H / 2 / cam.zoom + 200;
  const clear = opt.clear || (() => false);
  const wind = opt.wind ?? 1;
  for (let ri = s34_ROWZ.length - 1; ri >= 0; ri--) {
    const z = s34_ROWZ[ri];
    if (z < zNear || z >= zFar) continue;
    const by = s34_zy(z), s = s34_K / z;
    if (by - 0.4 * s > y1) continue;
    const step = 0.3 * Math.max(1, z / 1.8);
    const nb = z < 1.3 ? 6 : z < 2.6 ? 4 : 3;
    const off = hash(ri * 13) * step;
    const iA = Math.floor(((x0 - W / 2) / s - off) / step) - 1, iB = Math.ceil(((x1 - W / 2) / s - off) / step) + 1;
    const p = new Path2D(), tips = new Path2D();
    for (let i = iA; i <= iB; i++) {
      const X = off + i * step + (hash(i * 31 + ri * 977) - 0.5) * 0.08;
      if (clear(X, z)) continue;
      const cx = W / 2 + X * s;
      const hN = 0.15 + 0.06 * hash(i * 7 + ri * 131);
      const sway = wind * (0.13 * noise1(T * 0.55 + X * 0.9 + ri * 0.3, 5) + 0.05 * Math.sin(T * 2.3 + X * 4 + ri));
      for (let j = 0; j < nb; j++) {
        const u = (j + 0.5) / nb - 0.5;
        if (hash(i * 53 + j * 11 + ri * 7) < 0.15) continue;
        const h = hN * s * (0.75 + 0.35 * hash(i * 101 + j * 7 + ri * 3));
        const ang = u * 1.1 + sway * (0.6 + Math.abs(u)) + (hash(i + j * 17 + ri) - 0.5) * 0.25;
        const bx = cx + u * 0.03 * s;
        const tx = bx + Math.sin(ang) * h, ty = by - Math.cos(ang) * h;
        const cx2 = bx + Math.sin(ang * 0.4) * h * 0.5, cy2 = by - h * 0.62;
        p.moveTo(bx, by); p.quadraticCurveTo(cx2, cy2, tx, ty);
        if (z < 1.5) {
          const mx = lerp(cx2, tx, 0.45), my = lerp(cy2, ty, 0.45);
          tips.moveTo(mx, my); tips.quadraticCurveTo(lerp(mx, tx, 0.5) - 0.5, lerp(my, ty, 0.5) - 0.5, tx, ty);
        }
      }
    }
    const haze = clamp((z - 0.9) / 5);
    const lw = Math.max(0.9, 0.012 * s);
    ctx.lineCap = 'butt';
    // reflection of the row in the water
    if (z < 2.5) {
    ctx.save();
    ctx.translate(0, 2 * by); ctx.scale(1, -1);
    ctx.strokeStyle = rgba('#0a1a26', 0.55 * (1 - haze * 0.6));
    ctx.lineWidth = lw;
    ctx.stroke(p);
    ctx.restore();
    }
    ctx.strokeStyle = mixColor('#1b4436', '#27416f', haze);
    ctx.lineWidth = lw;
    ctx.stroke(p);
    if (z < 1.5) {
      ctx.strokeStyle = rgba('#6fa894', 0.45 * (1 - haze));
      ctx.lineWidth = lw * 0.6;
      ctx.stroke(tips);
    }
    // a faint sheen line on the water in front of the row
    ctx.fillStyle = rgba('#9fb8ff', 0.05 * (1 - haze));
    ctx.fillRect(x0, by + 2, x1 - x0, Math.max(1, 0.006 * s));
  }
}
// very far rows: texture band close to horizon
function s34_farRows(ctx, cam) {
  const x0 = cam.x - W / 2 / cam.zoom - 20, x1 = cam.x + W / 2 / cam.zoom + 20;
  for (let z = 30; z > 6.2; z *= 0.93) {
    const y = s34_zy(z);
    ctx.fillStyle = rgba('#1d3560', 0.6);
    ctx.fillRect(x0, y - 7 / z * 3, x1 - x0, Math.max(0.7, 12 / z));
  }
}

// --------------------------------------------------------- particles ----
function s34_bokeh(ctx, T, { seed = 5, n = 8, x = 0, y = 0, w = W, h = H, rMin = 20, rMax = 70, color = '#e8ff9e', alpha = 0.35 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const bx = r(), by = r(), rr = lerp(rMin, rMax, r()), ph = r() * 50, sp = 0.05 + r() * 0.08;
    const px = x + (bx + 0.1 * noise1(T * sp + ph, i)) * w;
    const py = y + (by + 0.1 * noise1(T * sp + ph + 30, i + 9)) * h;
    const bl = clamp(0.5 + 0.5 * Math.sin(T * (0.8 + r()) + ph));
    const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, rgba(color, alpha * bl * 0.6));
    g.addColorStop(0.75, rgba(color, alpha * bl * 0.45));
    g.addColorStop(0.9, rgba(color, alpha * bl * 0.6));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// smoke wisps rising (world space)
function s34_smoke(ctx, T, cx, cy, { n = 9, spread = 40, rise = 70, amt = 1, seed = 61 } = {}) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const per = 2.6 + r() * 1.4, ph = r() * per, dx = (r() - 0.5) * spread;
    const age = ((T + ph) % per) / per;
    const x = cx + dx + age * 50 + 18 * noise1(T * 0.7 + i * 3, 9) * age;
    const y = cy - age * rise * 2.4;
    const rad = 14 + age * 48;
    const a = Math.sin(age * Math.PI) * 0.16 * amt;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, rgba('#a9b6d8', a)); g.addColorStop(1, rgba('#a9b6d8', 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }
}
function s34_embers(ctx, T, cx, cy, { n = 22, amt = 1, seed = 62, w = 120 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const per = 1.4 + r() * 1.6, ph = r() * per, dx = (r() - 0.5) * w;
    const age = ((T + ph) % per) / per;
    const x = cx + dx + 20 * noise1(T * 1.3 + i, 3) * age + age * 20;
    const y = cy - age * (60 + r() * 90);
    const fl = (0.6 + 0.4 * Math.sin(T * 17 + i * 5)) * (1 - age) * amt;
    ctx.fillStyle = rgba(i % 3 ? '#ffb347' : '#fff0b0', fl);
    ctx.beginPath(); ctx.arc(x, y, 1.6 + r() * 1.4, 0, TAU); ctx.fill();
    if (i % 3 === 0) glow(ctx, x, y, 10, '#ff9a3c', 0.4 * fl);
  }
  ctx.restore();
}
function s34_ripple(ctx, x, y, age, { scale = 1, alpha = 0.45, rings = 2 } = {}) {
  if (age < 0) return;
  for (let k = 0; k < rings; k++) {
    const a2 = age - k * 0.18;
    if (a2 <= 0) continue;
    const rr = (8 + a2 * 110) * scale;
    const al = alpha * clamp(1 - a2 / 1.3);
    if (al <= 0) continue;
    ctx.strokeStyle = rgba('#c9dcff', al);
    ctx.lineWidth = 1.6 * scale;
    ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.22, 0, 0, TAU); ctx.stroke();
  }
}

// ---------------------------------------------------------- crater ----
function s34_craterBack(ctx, T, cx, cy, heat) {
  // flattened, muddy splash zone
  ctx.fillStyle = '#15110f';
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU, rr = 1 + 0.12 * noise1(i * 0.9, 7);
    ctx.lineTo(cx + Math.cos(a) * 135 * rr, cy + Math.sin(a) * 30 * rr);
  }
  ctx.fill();
  // inner bowl, glowing hot
  const g = ctx.createRadialGradient(cx, cy - 2, 4, cx, cy, 95);
  g.addColorStop(0, mixColor('#3a2410', '#ffb347', heat));
  g.addColorStop(0.45, mixColor('#24160e', '#c2521e', heat * 0.8));
  g.addColorStop(1, '#130e0c');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, cy, 92, 22, 0, 0, TAU); ctx.fill();
  // back rim
  ctx.fillStyle = '#2a1e18';
  ctx.beginPath(); ctx.ellipse(cx, cy - 6, 100, 18, 0, Math.PI, TAU); ctx.ellipse(cx, cy - 1, 88, 15, 0, TAU, Math.PI, true); ctx.fill();
  ctx.strokeStyle = rgba('#ff9a3c', 0.5 * heat);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(cx, cy - 6, 99, 17, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
}
function s34_craterFront(ctx, T, cx, cy, heat) {
  ctx.fillStyle = '#2d201a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 3, 104, 22, 0, 0, Math.PI);
  ctx.ellipse(cx, cy - 2, 90, 15, 0, Math.PI, 0, true);
  ctx.fill();
  // glowing cracks on the lip
  const r = rng(404);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = 0.25 + r() * 2.6, x = cx + Math.cos(a) * 95, y = cy + Math.sin(a) * 18 + 2;
    const fl = heat * (0.55 + 0.45 * Math.sin(T * (3 + r() * 4) + i));
    ctx.strokeStyle = rgba('#ffb347', fl);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 16, y + 3 + r() * 6); ctx.stroke();
  }
  ctx.restore();
  // scorched stalks leaning away from the impact
  const q = rng(405);
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const a = (0.1 + q() * 0.9) * Math.PI * (q() < 0.5 ? 1 : -1);
    const bx = cx + Math.cos(a) * (110 + q() * 30), by = cy + Math.sin(a) * 26 + 2;
    const lean = Math.sign(bx - cx) * (0.6 + q() * 0.7);
    const h = 26 + q() * 26;
    const sw = 0.05 * Math.sin(T * 1.7 + i);
    const tx = bx + Math.sin(lean + sw) * h, ty = by - Math.cos(lean + sw) * h;
    ctx.strokeStyle = q() < 0.5 ? '#1d140f' : '#2f2217';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + (tx - bx) * 0.2, by - h * 0.6, tx, ty); ctx.stroke();
    if (q() < 0.45) {
      const fl = heat * (0.5 + 0.5 * Math.sin(T * 6 + i * 2.3));
      ctx.fillStyle = rgba('#ff9a3c', fl);
      ctx.beginPath(); ctx.arc(tx, ty, 1.8, 0, TAU); ctx.fill();
      glow(ctx, tx, ty, 8, '#ff9a3c', 0.4 * fl);
    }
    void side;
  }
}

// ------------------------------------------------------ foreground blur ----
// Big, out-of-focus rice blades in screen space, drawn to a half-res buffer and blurred.
function s34_fgStalks(ctx, T, blades, blur = 7, tint = '#06120e', rim = '#2b5a4a') {
  const b = s34_buf('fg4', W / 4, H / 4);
  const g = b.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W / 4, H / 4);
  g.setTransform(0.25, 0, 0, 0.25, 0, 0);
  g.lineCap = 'round';
  for (let i = 0; i < blades.length; i++) {
    const [x, h, ang, lw] = blades[i];
    const sway = 0.06 * noise1(T * 0.5 + i * 1.7, 12) + 0.025 * Math.sin(T * 1.9 + i);
    s34_leaf(g, x, H + 40, h, ang + sway, lw, tint, rim);
  }
  const b2 = s34_buf('fg4b', W / 4, H / 4), g2 = b2.getContext('2d');
  g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, W / 4, H / 4);
  g2.filter = `blur(${(blur / 3).toFixed(2)}px)`; g2.drawImage(b, 0, 0); g2.filter = 'none';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(b2, 0, 0, W, H);
  ctx.restore();
}

// a tapered, curved rice leaf (filled), base at (x,y)
function s34_leaf(g, x, y, h, ang, lw, col, rim) {
  const tx = x + Math.sin(ang) * h, ty = y - Math.cos(ang) * h;
  const mx = x + Math.sin(ang * 0.35) * h * 0.5, my = y - h * 0.62;
  const L = [], R = [];
  for (let k = 0; k <= 12; k++) {
    const u = k / 12, v = 1 - u;
    const px = v * v * x + 2 * v * u * mx + u * u * tx, py = v * v * y + 2 * v * u * my + u * u * ty;
    const dx = 2 * v * (mx - x) + 2 * u * (tx - mx), dy = 2 * v * (my - y) + 2 * u * (ty - my);
    const n = Math.hypot(dx, dy) || 1;
    const wdt = lw * 0.5 * Math.pow(1 - u, 0.7);
    L.push([px - dy / n * wdt, py + dx / n * wdt]); R.push([px + dy / n * wdt, py - dx / n * wdt]);
  }
  g.fillStyle = col;
  g.beginPath(); g.moveTo(L[0][0], L[0][1]);
  for (const p of L) g.lineTo(p[0], p[1]);
  for (let k = R.length - 1; k >= 0; k--) g.lineTo(R[k][0], R[k][1]);
  g.fill();
  if (rim) {
    g.strokeStyle = rim; g.lineWidth = Math.max(1, lw * 0.12);
    g.beginPath();
    for (let k = 3; k < L.length; k++) k === 3 ? g.moveTo(L[k][0], L[k][1]) : g.lineTo(L[k][0], L[k][1]);
    g.stroke();
  }
}

// ------------------------------------------------------- characters ----
function s34_handPos(o) {
  if (typeof hinaHandPos === 'function') {
    try { const p = hinaHandPos(o); if (p && isFinite(p.x)) return p; } catch (e) { /* fall through */ }
  }
  const s = o.scale || 1, f = o.facing || 1;
  const k = o.armRaise ?? 1;
  return { x: o.x + f * lerp(95, 150, k) * s, y: o.y - lerp(150, 175, k) * s };
}
function s34_headPos(o) {
  if (typeof hinaHeadPos === 'function') {
    try { const p = hinaHeadPos(o); if (p && isFinite(p.x)) return p; } catch (e) { /* fall through */ }
  }
  const s = o.scale || 1;
  return { x: o.x, y: o.y - (o.pose === 'kneel' || o.pose === 'reach' ? 250 : 330) * s };
}

// =================================================================== s3 ====
const s3_HZ = 0.97;                      // Hina's depth
const s3_HX_END = 790;                   // where she kneels (world x)
const s3_CR = { x: s34_zx(s34_CRATER.X, 1), y: s34_zy(1) };   // crater centre (≈1060, 805)
const s3_RUN = [13.8, 15.0];
const s3_STEP_HZ = 4.4;                  // footfalls per second (2.2 run cycles/s)

function s3_hinaX(T) {
  const p = invLerp(s3_RUN[0], s3_RUN[1], T);
  // fast run, braking over the last ~30%
  const e = p < 0.7 ? p * 1.12 : 0.784 + (1 - 0.784) * Ease.outCubic((p - 0.7) / 0.3);
  return lerp(-220, s3_HX_END, e);
}
function s3_footfalls() {
  const a = [];
  for (let k = 0; ; k++) {
    const t = s3_RUN[0] + (k + 0.25) / s3_STEP_HZ;
    if (t > s3_RUN[1]) break;
    a.push(t);
  }
  a.push(15.12);  // knee comes down in the water
  return a;
}
const s3_FOOTFALLS = s3_footfalls();

function s3_hina(T) {
  const fy = s34_zy(s3_HZ);
  const o = { x: s3_hinaX(T), y: fy, scale: 0.9, facing: 1, view: 'threeQuarter', T,
    mouth: mouthAt('hina', T), blink: blinkAt(T, 21), wind: 0.25, lookX: 0.5, lookY: 0.5, headTilt: 0 };
  if (T < s3_RUN[1]) {
    o.pose = 'run'; o.runPhase = ((T - s3_RUN[0]) * 2.2) % 1; o.expression = 'worried'; o.lookY = 0.2;
    o.wind = 0.7;
  } else {
    o.pose = 'kneel'; o.expression = 'worried';
    const k = T - s3_RUN[1];
    o.y += 10 * Math.exp(-k * 7) * Math.sin(k * 18);   // settle bounce
    o.headTilt = 0.1 * prog(T, 15.2, 16.0);
    if (T > 19.75) { o.expression = 'gentle'; o.headTilt = lerp(0.1, 0.16, prog(T, 19.8, 20.6)); }
    if (T > 20.4) {
      o.pose = 'reach';
      o.armRaise = prog(T, 20.4, 21.3, Ease.inOutCubic);
      o.lookY = lerp(0.5, 0.35, o.armRaise);
    }
    if (T > 23.4) o.expression = 'smile';
  }
  return o;
}
// Kira's state in s3
const s3_HOP = { hes: 22.5, crouch: 22.92, air: 23.05, land: 23.35 };
function s3_kira(T, hina) {
  const base = { x: s3_CR.x, y: s3_CR.y - 26 };
  const o = { x: base.x, y: base.y, size: 40, T, mouth: mouthAt('kira', T), expression: 'cry', tears: 1,
    blink: blinkAt(T, 33), lookX: 0, lookY: 0.3, rot: 0, squash: 0 };
  // weak, flickering glow
  o.glow = 0.4 + 0.08 * noise1(T * 5, 2) + 0.05 * noise1(T * 17, 3) - 0.1 * clamp(noise1(T * 1.3, 8) * 3 - 2);
  // sobbing: bursts of little shoulder hitches
  const sobEnv = T < 20.4 ? 0.6 + 0.4 * clamp(noise1(T * 0.9, 41) * 2 + 0.5) : clamp(1 - (T - 20.4) / 0.8) * 0.5;
  const sob = Math.max(0, Math.sin(T * TAU * 2.6)) ** 3;
  o.y -= sob * 4 * sobEnv;
  o.squash = -0.05 * sobEnv + sob * 0.09 * sobEnv;
  o.rot = 0.05 * Math.sin(T * 1.3) * sobEnv;
  if (T > 14.6 && T < 15.4) o.lookX = -0.6 * prog(T, 14.6, 14.9);   // hears the splashes
  if (T > 20.05) {
    // Hina's voice: Kira looks up at her, tears slow down
    o.expression = T < 21.0 ? 'surprised' : 'neutral';
    o.tears = lerp(1, 0.35, prog(T, 20.1, 22.0));
    o.lookX = -0.7 * prog(T, 20.05, 20.4); o.lookY = -0.6 * prog(T, 20.05, 20.4);
  }
  if (!hina) return o;
  const palm = s34_handPos(hina);
  const perch = { x: palm.x, y: palm.y - o.size * 0.82 };
  if (T >= s3_HOP.hes && T < s3_HOP.crouch) {
    // hesitation: leans back, glances at the hand, a tiny shuffle
    const k = invLerp(s3_HOP.hes, s3_HOP.crouch, T);
    o.rot = 0.18 * Math.sin(k * Math.PI) - 0.05;
    o.x += -4 * Math.sin(k * Math.PI);
    o.lookX = -0.8; o.lookY = lerp(-0.6, -0.2, k);
    o.expression = 'neutral';
  }
  if (T >= s3_HOP.crouch && T < s3_HOP.air) {
    const k = invLerp(s3_HOP.crouch, s3_HOP.air, T);
    o.squash = -0.35 * Math.sin(k * Math.PI * 0.5);
    o.y += 6 * k;
    o.expression = 'hope'; o.lookX = -0.8; o.lookY = -0.7; o.rot = -0.12 * k;
  }
  if (T >= s3_HOP.air && T < s3_HOP.land) {
    const k = invLerp(s3_HOP.air, s3_HOP.land, T);
    const x0 = base.x, y0 = base.y + 6;
    o.x = lerp(x0, perch.x, k);
    o.y = lerp(y0, perch.y, k) - 120 * 4 * k * (1 - k);
    o.squash = 0.35 * (1 - Math.abs(k - 0.5) * 2) + 0.1;   // stretch in flight
    o.rot = lerp(-0.25, 0.05, k);
    o.expression = 'hope'; o.lookX = -0.5; o.lookY = -0.3; o.tears = 0.25;
  }
  if (T >= s3_HOP.land) {
    const k = T - s3_HOP.land;
    o.x = perch.x; o.y = perch.y;
    o.squash = -0.4 * Math.exp(-k * 6) * Math.cos(k * 22);
    o.y += 6 * Math.exp(-k * 6) * Math.max(0, Math.cos(k * 22));
    o.rot = 0.05 * Math.exp(-k * 4);
    o.expression = 'hope'; o.lookX = -0.6; o.lookY = -0.5; o.tears = 0.25;
    o.glow += 0.3 * prog(T, s3_HOP.land, s3_HOP.land + 0.5);
  }
  return o;
}

function s3_camera(T) {
  if (T < 16.3) {           // A: wide, low, tracking Hina in
    const k = prog(T, 13.5, 16.3, Ease.inOutCubic);
    return { shot: 'A', x: lerp(800, 930, k), y: lerp(590, 605, k), zoom: lerp(1.03, 1.1, k) };
  }
  if (T < 19.7) {           // B: close on Kira sobbing
    const k = prog(T, 16.3, 19.7, Ease.inOutQuad);
    return { shot: 'B', x: lerp(1070, 1080, k), y: lerp(690, 700, k), zoom: lerp(2.35, 2.62, k) };
  }
  // C: two-shot for h2 and the hop
  const k = prog(T, 19.7, 24.0, Ease.inOutQuad);
  const follow = prog(T, 22.9, 23.6) * 0.5;
  return { shot: 'C', x: lerp(915, 940, k), y: lerp(655, 640, k) - follow * 10, zoom: lerp(1.6, 1.78, k) };
}

function s3_clear(X, z) {
  // rice flattened around the crater
  const dz = (z - s34_CRATER.z) / 0.32;
  if (Math.abs(dz) < 1 && Math.abs(X - s34_CRATER.X) < 0.72 * Math.sqrt(1 - dz * dz)) return true;
  return false;
}

function s3_drawWater(ctx, cam, T, hina, kira, heat) {
  const sy = s34_horizon(cam);
  if (sy >= H) return;
  const b = s34_buf('water', W, H);
  const g = b.getContext('2d');
  const top = Math.max(0, Math.floor(sy));
  g.setTransform(1, 0, 0, 1, 0, 0);
  const wg = g.createLinearGradient(0, sy, 0, H);
  wg.addColorStop(0, '#2a4677'); wg.addColorStop(0.25, '#16295a'); wg.addColorStop(1, '#070d24');
  g.fillStyle = wg; g.fillRect(0, top, W, H - top);
  s34_sky(g, cam, T, true, 0.75);
  s34_drawBg(g, cam, T, true, 0.9);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = 'rgba(6,12,32,0.28)'; g.fillRect(0, top, W, H - top);
  s34_villageStreaks(g, cam, T);
  // Hina's reflection
  if (hina) {
    s34_world(g, cam);
    g.save();
    g.translate(0, 2 * hina.y); g.scale(1, -1);
    g.globalAlpha = 0.42;
    drawHina(g, hina);
    g.restore();
    g.globalAlpha = 1;
  }
  // warm light of the crater + Kira on the water
  s34_world(g, cam);
  g.save();
  g.translate(s3_CR.x, s3_CR.y + 40); g.scale(1, 0.35);
  glow(g, 0, 0, 260, '#ffb347', 0.35 * heat);
  g.restore();
  if (kira) {
    g.save();
    g.translate(kira.x, 2 * s34_zy(1.0) - kira.y + 20); g.scale(0.5, 1.4);
    glow(g, 0, 0, 90, '#ffd76a', 0.3 * kira.glow);
    g.restore();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  // composite with a horizontal ripple wobble
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const strip = 4;
  for (let y = top; y < H; y += strip) {
    const d = (y - sy) / (H - sy + 1);
    const amp = (0.6 + d * 5) * Math.min(cam.zoom, 2);
    const dx = amp * Math.sin(y * 0.11 / Math.min(cam.zoom, 2) + T * 2.3) + amp * 0.5 * noise1(y * 0.05 + T * 1.5, 7);
    ctx.drawImage(b, 0, y, W, strip, dx, y, W, strip);
  }
  ctx.restore();
}

registerScene('s3', {
  draw(ctx, t, T, d) {
    const cam = s3_camera(T);
    const hina = T >= s3_RUN[0] ? s3_hina(T) : null;
    const kira = s3_kira(T, hina);
    const heat = 0.75 + 0.15 * noise1(T * 3, 5) - 0.25 * prog(T, 14, 24);
    const sy = s34_horizon(cam);

    // --- sky & distance
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    vGradient(ctx, 0, 0, W, Math.max(1, sy + 2), [[0, '#050a24'], [0.55, '#132a5c'], [1, '#2e4f84']]);
    s34_sky(ctx, cam, T, false);
    s34_drawBg(ctx, cam, T);

    // --- water (reflections)
    s3_drawWater(ctx, cam, T, hina && hina.x > -200 ? hina : null, kira, heat);

    // --- ground, back to front
    s34_world(ctx, cam);
    s34_farRows(ctx, cam);
    s34_rows(ctx, cam, T, 1.0, 99, { clear: s3_clear });
    // ripples from Hina's steps
    for (const ft of s3_FOOTFALLS) {
      const age = T - ft;
      if (age < 0 || age > 1.6) continue;
      const fx = s3_hinaX(ft) + (ft >= 15.1 ? 30 : 10);
      s34_ripple(ctx, fx, s34_zy(s3_HZ) + 2, age, { scale: 0.9 });
    }
    // tear drips make little rings in the crater puddle
    for (let i = 0; i < 12; i++) {
      const tt = 14.4 + i * 0.47 + hash(i) * 0.2;
      if (tt > 21) break;
      s34_ripple(ctx, s3_CR.x + (hash(i + 5) - 0.5) * 60, s3_CR.y + 8, T - tt, { scale: 0.35, alpha: 0.5, rings: 1 });
    }

    // crater + Kira (in crater)
    s34_craterBack(ctx, T, s3_CR.x, s3_CR.y, heat);
    s34_smoke(ctx, T, s3_CR.x, s3_CR.y - 10, { amt: 1 - 0.4 * prog(T, 14, 24) });
    glow(ctx, s3_CR.x, s3_CR.y - 10, 300, '#ff9a3c', 0.22 * heat);
    const kiraInCrater = T < s3_HOP.air;
    if (kiraInCrater) drawKira(ctx, kira);
    s34_craterFront(ctx, T, s3_CR.x, s3_CR.y, heat);
    s34_embers(ctx, T, s3_CR.x, s3_CR.y - 5, { amt: heat });

    // Hina
    if (hina && hina.x > -250) drawHina(ctx, hina);
    if (!kiraInCrater) {
      drawKira(ctx, kira);
      if (T >= s3_HOP.land) {   // landing sparkle
        const k = T - s3_HOP.land;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + 0.3, rr = 20 + k * 120;
          sparkle(ctx, kira.x + Math.cos(a) * rr, kira.y + Math.sin(a) * rr * 0.6, 7 * (1 - k * 1.5), '#fff3c0', clamp(1 - k * 1.8), a);
        }
      }
    }

    // near rows (in front of Hina)
    s34_rows(ctx, cam, T, 0, s3_HZ, { clear: s3_clear });

    // splash droplets (drawn over the near rice)
    const r = rng(311);
    ctx.save();
    for (const ft of s3_FOOTFALLS) {
      const age = T - ft;
      const fx = s3_hinaX(ft) + (ft >= 15.1 ? 30 : 10), fy = s34_zy(s3_HZ);
      for (let i = 0; i < 12; i++) {
        const vx = (r() - 0.5) * 260 + (ft < 15 ? 160 : 0), vy = -(160 + r() * 260), sz = 1.5 + r() * 2.5;
        if (age < 0 || age > 0.9) continue;
        const x = fx + vx * age, y = fy + vy * age + 900 * age * age;
        if (y > fy + 8) continue;
        const a = clamp(1 - age / 0.9);
        ctx.fillStyle = rgba('#d8e6ff', 0.85 * a);
        ctx.beginPath(); ctx.ellipse(x, y, sz, sz * 1.4, 0, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();

    // light: Kira's weak glow on the field
    glow(ctx, kira.x, kira.y, 170 * (0.6 + kira.glow), '#ffd76a', 0.18 * kira.glow);
    // fireflies drifting over the paddies
    fireflies(ctx, T, { seed: 34, n: 22, x: cam.x - 1100 / cam.zoom, y: 430, w: 2200 / cam.zoom, h: 360, size: 0.8 / Math.sqrt(cam.zoom) });

    // --- screen-space foreground: out-of-focus stalks and firefly bokeh
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (cam.shot === 'A') {
      s34_fgStalks(ctx, T, [[40, 460, 0.3, 60], [150, 360, 0.08, 46], [260, 250, -0.1, 36], [1830, 500, -0.32, 64], [1700, 320, -0.12, 44], [1910, 400, -0.05, 50]], 8);
      s34_bokeh(ctx, T, { seed: 301, n: 6, y: 250, h: 700, rMin: 18, rMax: 46, alpha: 0.3 });
    } else if (cam.shot === 'B') {
      s34_fgStalks(ctx, T, [[120, 760, 0.22, 90], [300, 560, 0.05, 70], [1760, 700, -0.28, 90], [1560, 460, -0.1, 64], [1900, 560, -0.02, 70]], 12);
      s34_bokeh(ctx, T, { seed: 302, n: 8, y: 100, h: 900, rMin: 30, rMax: 80, alpha: 0.28 });
    } else {
      s34_fgStalks(ctx, T, [[40, 560, 0.25, 70], [180, 360, 0.06, 50], [1860, 600, -0.3, 74], [1740, 400, -0.12, 54]], 10);
      s34_bokeh(ctx, T, { seed: 303, n: 7, y: 150, h: 800, rMin: 22, rMax: 60, alpha: 0.3 });
    }
  },
});
