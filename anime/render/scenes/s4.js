// Scene s4 — intimate close two-shot in the rice field (24.0–31.0), then the lantern.
// Uses the shared s34_ helpers from s3.js.
'use strict';

function s4_bump(T, c, w) { const u = (T - c) / w; return Math.exp(-u * u); }
const s4_T = { cut: 29.72, crouch: 28.98, leap: 29.15, open: [29.72, 30.0], land: 30.05, ignite: [30.05, 30.55] };

// Blurred background plate: the paddies, hill and village rendered sharp at full
// res, reduced to half res and blurred (cheap depth of field). The plate is rendered
// once per shot at a fixed time (so it is identical whichever frame asks first) and
// drifted per frame; the live bokeh on top keeps it breathing.
function s4_plate(key, cam, blur, Tf) {
  const ck = 's4plate_' + key;
  if (s34_cache[ck]) return s34_cache[ck];
  const full = document.createElement('canvas'); full.width = W; full.height = H;
  const half = s34_buf('s4half', W / 2, H / 2);
  const g = full.getContext('2d');
  const sy = s34_horizon(cam);
  vGradient(g, 0, 0, W, Math.max(1, sy + 2), [[0, '#050a24'], [0.55, '#132a5c'], [1, '#2e4f84']]);
  s34_sky(g, cam, Tf, false, 1);
  s34_drawBg(g, cam, Tf);
  s3_drawWater(g, cam, Tf, null, null, 0);
  s34_world(g, cam);
  s34_farRows(g, cam);
  s34_rows(g, cam, Tf, 1.5, 99, { wind: 1.2 });
  const h = half.getContext('2d');
  h.setTransform(1, 0, 0, 1, 0, 0);
  h.clearRect(0, 0, W / 2, H / 2);
  h.filter = `blur(${(blur / 2).toFixed(2)}px)`;
  h.drawImage(full, 0, 0, W / 2, H / 2);
  h.filter = 'none';
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(half, 0, 0, W, H);
  s34_cache[ck] = full;
  return full;
}
function s4_drawPlate(ctx, img, dx, dy, zoom) {
  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, W / 2 - W / 2 * zoom + dx, H / 2 - H / 2 * zoom + dy);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// Hina's cupped hands (seen from the front-side), palm up, warmly lit from above by Kira.
// ---------------------------------------------------------------- D ----
const s4_D = { x: 470, y: 1085, scale: 3.3, ksize: 104 };
function s4_hinaD(T) {
  let expr = T < 25.0 ? 'gentle' : 'smile';
  if (T > 25.8 && T < 26.6) expr = 'joy';
  if (T > 28.35) expr = 'determined';
  const nod = 0.1 * s4_bump(T, 28.7, 0.12);
  const o = { x: s4_D.x, y: s4_D.y, scale: s4_D.scale, facing: 1, view: 'threeQuarter', pose: 'hold', kneel: true, T,
    expression: expr, mouth: mouthAt('hina', T), blink: blinkAt(T, 22), lookX: 0.7, lookY: 0.65,
    headTilt: 0.14 - 0.06 * prog(T, 25.0, 26.0) - nod, wind: 0.3, rimAlpha: 0.6 };
  o.y += 6 * Math.sin(T * 1.1);                      // breathing
  o.y += 10 * s4_bump(T, 28.7, 0.1);                 // nod dips the body a touch
  if (T >= s4_T.leap) {
    // fist pump as Kira leaps
    o.pose = 'cheer'; o.lookY = -0.7; o.lookX = 0.4; o.turn = 0.3;
    const k = T - s4_T.leap;
    o.y += -18 * Math.exp(-k * 6) * Math.cos(k * 16);
    o.headTilt = -0.05;
  }
  return o;
}
function s4_kiraD(T, perch) {
  const o = { x: perch.x, y: perch.y, size: s4_D.ksize, T, mouth: mouthAt('kira', T), blink: blinkAt(T, 34),
    expression: 'hope', tears: lerp(0.25, 0, prog(T, 24.0, 25.2)), lookX: -0.6, lookY: -0.5, rot: 0, squash: 0, arms: 'auto' };
  o.y += 3 * Math.sin(T * 2.4);
  o.squash = 0.04 * Math.sin(T * 2.4 + 1);
  if (T > 25.6) o.expression = 'happy';
  // perks up: a stretch as hope arrives, then a settle
  o.squash += 0.22 * s4_bump(T, 24.35, 0.16) - 0.12 * s4_bump(T, 24.62, 0.1);
  o.y -= 10 * s4_bump(T, 24.4, 0.15);
  o.rot = 0.08 * Math.sin(T * 1.6) + 0.12 * s4_bump(T, 26.0, 0.3);
  // excited mini-hop on the "!" of k2
  const hk = invLerp(27.15, 27.5, T);
  if (hk > 0 && hk < 1) { o.y -= 46 * 4 * hk * (1 - hk); o.squash += 0.22 * Math.sin(hk * Math.PI); o.arms = 'up'; }
  if (T > 27.5 && T < 27.9) o.squash -= 0.28 * Math.exp(-(T - 27.5) * 10);
  // glow: flickers of light that grow steadier
  o.glow = 0.65 + 0.25 * prog(T, 24.2, 27.8) + 0.08 * noise1(T * 6, 4);
  for (const f of s4_FLICKS) o.glow += 0.35 * s4_bump(T, f, 0.12);
  if (T > 27.9) { o.lookX = -0.8; o.lookY = -0.7; o.expression = 'happy'; }
  if (T > 28.6) { o.expression = 'surprised'; o.lookY = -0.8; }
  if (T > 28.85) o.expression = 'happy';
  // crouch, then leap up and out of frame on Hina's fist pump
  if (T >= s4_T.crouch && T < s4_T.leap) {
    const k = invLerp(s4_T.crouch, s4_T.leap, T);
    o.squash = -0.4 * Math.sin(k * Math.PI * 0.5); o.y += 14 * k;
  }
  if (T >= s4_T.leap) {
    const k = T - s4_T.leap;
    o.y = perch.y + 10 - 2300 * k + 900 * k * k; o.x += 380 * k;
    o.squash = 0.4 * Math.exp(-k * 2); o.rot = 0.5 * k; o.arms = 'up';
    o.glow += 0.3;
  }
  return o;
}
const s4_FLICKS = [24.9, 25.7, 26.5, 27.3];

function s4_shotD(ctx, t, T) {
  const k = prog(T, 24.0, 29.72, Ease.inOutQuad);
  const zoom = lerp(1.0, 1.08, k);
  const fx = 760, fy = 560;
  s4_drawPlate(ctx, s4_plate('D', { x: 1250, y: 535, zoom: 1.45 }, 7, 26), lerp(20, -20, k), 0, 1.04 + 0.02 * k);
  s34_bokeh(ctx, T, { seed: 401, n: 9, x: 0, y: 380, w: 700, h: 260, rMin: 26, rMax: 60, color: '#ffc46a', alpha: 0.32 });
  s34_bokeh(ctx, T, { seed: 402, n: 8, x: 900, y: 150, w: 1000, h: 600, rMin: 20, rMax: 50, color: '#e0ff9a', alpha: 0.22 });

  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, fx - fx * zoom, fy - fy * zoom);
  const hina = s4_hinaD(T);
  const hs = s34_handPos({ ...hina, pose: 'hold' });
  const perch = { x: (hs.x + (hs.back ? hs.back.x : hs.x)) / 2 + 4, y: Math.min(hs.y, hs.back ? hs.back.y : hs.y) - s4_D.ksize * 0.72 };
  const kira = s4_kiraD(T, perch);
  hina.light = [{ x: kira.x, y: kira.y, color: '#ffd76a', radius: 900, strength: 0.6 + 0.5 * kira.glow }];
  drawHina(ctx, hina);

  // determination sparks around the fist
  if (T >= s4_T.leap) {
    const fist = s34_handPos(hina);
    const a0 = T - s4_T.leap, pk = Math.exp(-a0 * 3);
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.42, rr = 70 + 260 * a0;
      sparkle(ctx, fist.x + Math.cos(a) * rr, fist.y - 20 + Math.sin(a) * rr, 18 * pk, '#fff3c0', pk, 0);
    }
  }

  // lighting: cool night around the edges, warm light pooled around Kira
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  const kx = (Math.min(kira.x, 1400) - fx) * zoom + fx, ky = (Math.max(kira.y, perch.y - 200) - fy) * zoom + fy;
  const lg = ctx.createRadialGradient(kx, ky, 80, kx, ky, 1200);
  const warm = T < s4_T.leap ? 1 : clamp(1 - (T - s4_T.leap) * 1.5);
  lg.addColorStop(0, mixColor('#d8d8ea', '#ffffff', warm)); lg.addColorStop(0.35, '#c4c2d8'); lg.addColorStop(1, '#4a5690');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // warm uplight on Hina's face from the palm
  const face = s34_headPos(hina);
  glow(ctx, face.x + 40, face.y + 120, 360, '#ffb347', 0.14 * kira.glow * warm);
  glow(ctx, perch.x, perch.y + 30, 420, '#ffd76a', 0.12 * kira.glow * warm);
  drawKira(ctx, kira);
  // flickers of light: sparkles popping around Kira
  for (const [i, f] of s4_FLICKS.entries()) {
    const age = T - f;
    if (age < -0.05 || age > 0.8) continue;
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * TAU + i, rr = kira.size + age * 170;
      sparkle(ctx, kira.x + Math.cos(a) * rr, kira.y + Math.sin(a) * rr * 0.8, 13 * (1 - age), '#fff3c0', clamp(1 - age / 0.8), a);
    }
  }
  // golden motes rising from Kira / its trail when it leaps
  const r = rng(404);
  for (let i = 0; i < 16; i++) {
    const per = 2 + r() * 2, ph = r() * per, age = ((T + ph) % per) / per, ox = (r() - 0.5) * 170;
    const bx = T < s4_T.leap ? kira.x : perch.x;
    const mx = bx + ox + 30 * noise1(T + i, 2), my = perch.y + 30 - age * 280;
    const a = Math.sin(age * Math.PI) * clamp(kira.glow - 0.3);
    ctx.fillStyle = rgba('#fff3c0', a);
    ctx.beginPath(); ctx.arc(mx, my, 2.6, 0, TAU); ctx.fill();
    glow(ctx, mx, my, 12, '#ffd76a', 0.4 * a);
  }
  if (T >= s4_T.leap) {
    for (let i = 1; i < 10; i++) {
      const tb = T - i * 0.025;
      if (tb < s4_T.leap) break;
      const kb = s4_kiraD(tb, perch);
      sparkle(ctx, kb.x + (hash(i) - 0.5) * 30, kb.y + 40, 16 - i, '#fff3c0', 1 - i / 10, i);
    }
  }
  ctx.restore();

  // out-of-focus foreground: rice leaves + firefly bokeh
  s34_fgStalks(ctx, T, [[1840, 640, -0.32, 80], [1700, 430, -0.12, 60], [1920, 860, -0.5, 90]], 12, '#050d0c', '#1f4a44');
  s34_bokeh(ctx, T, { seed: 403, n: 4, x: 1250, y: 100, w: 650, h: 500, rMin: 50, rMax: 90, color: '#e8ff9e', alpha: 0.2 });
}

// ---------------------------------------------------------------- E ----
// Hina lifts her paper lantern and opens its cap; Kira drops in; the lantern blooms.
const s4_E = { x: 540, y: 1000, scale: 2.6, ksize: 84 };
function s4_hinaE(T) {
  const lit = prog(T, s4_T.ignite[0], s4_T.ignite[1], Ease.outCubic);
  const o = { x: s4_E.x, y: s4_E.y, scale: s4_E.scale, facing: 1, view: 'threeQuarter', pose: 'kneel', kneel: true, T,
    expression: T < s4_T.land + 0.1 ? 'determined' : 'joy', mouth: mouthAt('hina', T), blink: blinkAt(T, 22),
    lookX: 0.8, lookY: T < s4_T.land ? -0.3 : 0.3, headTilt: 0.06, wind: 0.35, rimAlpha: 0.6,
    armRaise: lerp(0.45, 1, prog(T, s4_T.open[0] - 0.1, s4_T.open[1], Ease.outBack)),
    lantern: { glow: lerp(s3_LANTERN_GLOW, 1, lit), kiraInside: T >= s4_T.land + 0.08,
      open: prog(T, s4_T.open[0], s4_T.open[1] - 0.05, Ease.outBack) * (1 - prog(T, s4_T.land + 0.1, s4_T.land + 0.35)),
      swing: -0.12 * Math.exp(-Math.max(0, T - s4_T.land) * 4) * Math.sin(Math.max(0, T - s4_T.land) * 14) } };
  // a happy little bounce once the lantern lights
  const a = T - s4_T.land - 0.1;
  if (a > 0) { o.y -= 16 * Math.exp(-a * 3.5) * Math.abs(Math.sin(a * 11)); o.headTilt = 0.06 + 0.06 * prog(T, 30.2, 30.8); }
  return o;
}
function s4_shotE(ctx, t, T) {
  const k = prog(T, s4_T.cut, 31.5, Ease.inOutQuad);
  const lit = prog(T, s4_T.ignite[0], s4_T.ignite[1], Ease.outCubic);
  s4_drawPlate(ctx, s4_plate('E', { x: 1000, y: 560, zoom: 1.25 }, 5, 30.5), lerp(15, -15, k), 0, 1.03 + 0.01 * k);
  s34_bokeh(ctx, T, { seed: 411, n: 8, x: 0, y: 380, w: 1920, h: 300, rMin: 16, rMax: 40, color: '#ffc46a', alpha: 0.28 });

  const zoom = lerp(1.0, 1.06, k);
  const fx = 900, fy = 560;
  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, fx - fx * zoom, fy - fy * zoom);
  const hina = s4_hinaE(T);
  const L = typeof hinaLanternPos === 'function' ? hinaLanternPos(hina) : null;
  const lan = L || { x: hina.x + 139 * hina.scale, y: hina.y - 128 * hina.scale, r: 25 * hina.scale };
  const mouthY = lan.y - lan.r * 0.9;
  hina.light = [{ x: lan.x, y: lan.y, color: '#ffb347', radius: 700, strength: 0.3 + 0.6 * lit }];
  drawHina(ctx, hina);

  // Kira dropping in from above, shrinking into the lantern with a streak of glitter
  const fall = (tt) => {
    const kk = invLerp(s4_T.cut - 0.05, s4_T.land, tt);
    return { k: kk, x: lerp(lan.x + 260, lan.x, Ease.outQuad(kk)), y: lerp(-160, mouthY, Ease.inQuad(kk)) };
  };
  if (T < s4_T.land + 0.06) {
    const f = fall(T);
    for (let i = 1; i < 9; i++) {
      const p = fall(T - i * 0.03);
      if (p.k <= 0) break;
      sparkle(ctx, p.x + (hash(i) - 0.5) * 24, p.y - 20, 14 - i, '#fff3c0', 1 - i / 9, i);
      glow(ctx, p.x, p.y, 40, '#ffd76a', 0.25 * (1 - i / 9));
    }
    const sz = lerp(s4_E.ksize, lan.r * 0.55, Ease.inCubic(f.k));
    drawKira(ctx, { x: f.x, y: f.y - sz * 0.3, size: sz, T, expression: 'happy', mouth: null, glow: 1.2, arms: 'up',
      squash: f.k > 0.9 ? -0.3 : 0.3, rot: lerp(0.5, 0, f.k), blink: 0, lookX: -0.3, lookY: 0.6 });
  }
  // bloom of warm light as the lantern ignites
  if (T >= s4_T.land) {
    const a = T - s4_T.land;
    glow(ctx, lan.x, lan.y, 520 + 220 * lit, '#ffb347', 0.3 * lit);
    const burst = Math.exp(-a * 4);
    glow(ctx, lan.x, lan.y, 280, '#fff3c0', 0.75 * burst);
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * TAU + 0.2, rr = lan.r + a * 300;
      sparkle(ctx, lan.x + Math.cos(ang) * rr, lan.y + Math.sin(ang) * rr * 0.85, 16 * burst, '#fff3c0', burst, ang);
    }
    // warm motes drifting up from the lantern
    const r = rng(415);
    for (let i = 0; i < 12; i++) {
      const per = 1.6 + r() * 1.4, ph = r() * per, age = ((a + ph) % per) / per, ox = (r() - 0.5) * 120;
      const al = Math.sin(age * Math.PI) * lit;
      const mx = lan.x + ox + 20 * noise1(T + i, 6), my = lan.y - age * 260;
      ctx.fillStyle = rgba('#fff0c0', al); ctx.beginPath(); ctx.arc(mx, my, 2.4, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();

  // warm/cool grade around the lantern
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  const lx = (lan.x - fx) * zoom + fx, ly = (lan.y - fy) * zoom + fy;
  const lg = ctx.createRadialGradient(lx, ly, 60, lx, ly, 1250);
  lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.4, mixColor('#b8b8d0', '#f2dcc0', lit)); lg.addColorStop(1, '#4a5690');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  s34_fgStalks(ctx, T, [[60, 580, 0.3, 74], [200, 400, 0.12, 56], [1880, 540, -0.3, 70]], 11, '#050d0c', '#1f4a44');
  s34_bokeh(ctx, T, { seed: 412, n: 6, x: 0, y: 100, w: 1920, h: 700, rMin: 30, rMax: 70, color: '#e8ff9e', alpha: 0.18 });
}

registerScene('s4', {
  draw(ctx, t, T, d) {
    if (T < s4_T.cut) s4_shotD(ctx, t, T);
    else s4_shotE(ctx, t, T);
  },
});
