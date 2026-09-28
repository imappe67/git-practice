// Scene s4 — intimate close two-shot in the rice field (24.0–31.0), then the lantern.
// Uses the shared s34_ helpers from s3.js.
'use strict';

function s4_bump(T, c, w) { const u = (T - c) / w; return Math.exp(-u * u); }
const s4_T = { cut: 29.72, leap: 29.58, lanternOpen: [29.8, 30.12], land: 30.2, ignite: [30.2, 30.7] };

// Blurred background plate: the paddies, hill and village rendered sharp at full
// res, reduced to half res and blurred on the way back up (cheap depth of field).
function s4_bgPlate(ctx, T, cam, blur) {
  const full = s34_buf('s4full', W, H), half = s34_buf('s4half', W / 2, H / 2);
  const g = full.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sy = s34_horizon(cam);
  vGradient(g, 0, 0, W, Math.max(1, sy + 2), [[0, '#050a24'], [0.55, '#132a5c'], [1, '#2e4f84']]);
  s34_sky(g, cam, T, false, 1);
  s34_drawBg(g, cam, T);
  s3_drawWater(g, cam, T, null, null, 0);
  s34_world(g, cam);
  s34_farRows(g, cam);
  s34_rows(g, cam, T, 1.5, 99, { wind: 1.2 });
  g.setTransform(1, 0, 0, 1, 0, 0);
  const h = half.getContext('2d');
  h.setTransform(1, 0, 0, 1, 0, 0);
  h.drawImage(full, 0, 0, W / 2, H / 2);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(half, 0, 0, W, H);
  ctx.filter = 'none';
  ctx.restore();
}

// Hina's cupped hands (seen from the front-side), palm up, warmly lit from above by Kira.
function s4_cuppedHands(ctx, x, y, s, light) {
  const OL = '#1a1433';
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // sleeves (wide yukata sleeves falling away toward the bottom-left)
  const sleeve = (ox, w, col) => {
    ctx.fillStyle = col; ctx.strokeStyle = OL; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ox - 40, 30); ctx.quadraticCurveTo(ox - 90, 160, ox - 260 - w, 520);
    ctx.lineTo(ox + 120 - w, 520); ctx.quadraticCurveTo(ox + 30, 170, ox + 38, 34);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  sleeve(-40, 0, '#1d2a5c');
  sleeve(70, 60, '#24346e');
  // goldfish hint on the sleeve
  ctx.fillStyle = 'rgba(216,57,74,0.8)';
  ctx.beginPath(); ctx.ellipse(-20, 250, 16, 9, -0.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-34, 262); ctx.lineTo(-52, 262); ctx.lineTo(-44, 276); ctx.fill();
  // palms: a shallow bowl
  const sk = ctx.createLinearGradient(0, -40, 0, 70);
  sk.addColorStop(0, mixColor('#f3c9a8', '#ffe9c4', light));
  sk.addColorStop(1, '#b98a78');
  ctx.fillStyle = sk; ctx.strokeStyle = OL; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-118, -22);
  ctx.bezierCurveTo(-120, 30, -60, 62, 0, 62);
  ctx.bezierCurveTo(60, 62, 122, 30, 120, -26);
  // fingertips of the right hand (far side)
  ctx.quadraticCurveTo(112, -44, 96, -34);
  ctx.quadraticCurveTo(90, -48, 74, -36);
  ctx.quadraticCurveTo(66, -46, 52, -30);
  ctx.quadraticCurveTo(30, -18, 4, -14);
  // left hand
  ctx.quadraticCurveTo(-30, -16, -52, -28);
  ctx.quadraticCurveTo(-68, -44, -76, -32);
  ctx.quadraticCurveTo(-92, -46, -100, -32);
  ctx.quadraticCurveTo(-114, -42, -118, -22);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // inner palm (lit), seam between the two hands
  ctx.fillStyle = rgba('#fff0d0', 0.35 * light + 0.1);
  ctx.beginPath(); ctx.ellipse(0, -8, 92, 16, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(OL, 0.55); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(2, -10); ctx.quadraticCurveTo(-4, 24, 0, 58); ctx.stroke();
  // thumbs
  ctx.fillStyle = mixColor('#e9b996', '#ffe0b8', light);
  ctx.strokeStyle = OL; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-118, -20); ctx.quadraticCurveTo(-140, -52, -112, -62); ctx.quadraticCurveTo(-96, -60, -96, -36); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(120, -24); ctx.quadraticCurveTo(142, -56, 114, -66); ctx.quadraticCurveTo(98, -62, 98, -38); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// Hina's near-side fist (for the fist pump).
function s4_fist(ctx, x, y, s, rot) {
  const OL = '#1a1433';
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.lineJoin = 'round';
  // sleeve/forearm
  ctx.fillStyle = '#24346e'; ctx.strokeStyle = OL; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-46, 40); ctx.quadraticCurveTo(-70, 220, -120, 520); ctx.lineTo(120, 520); ctx.quadraticCurveTo(60, 220, 44, 40); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f0c3a2';
  ctx.beginPath(); ctx.moveTo(-36, 44); ctx.lineTo(-40, 10); ctx.lineTo(38, 10); ctx.lineTo(36, 44); ctx.closePath(); ctx.fill(); ctx.stroke();
  // fist
  ctx.beginPath();
  ctx.moveTo(-50, 10);
  ctx.quadraticCurveTo(-58, -48, -30, -60);
  ctx.lineTo(34, -60); ctx.quadraticCurveTo(58, -56, 54, -20);
  ctx.quadraticCurveTo(52, 14, 30, 16); ctx.lineTo(-40, 16); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = rgba(OL, 0.7); ctx.lineWidth = 3;
  for (const fx of [-26, -2, 22]) { ctx.beginPath(); ctx.moveTo(fx, -60); ctx.lineTo(fx + 2, -36); ctx.stroke(); }
  // thumb across
  ctx.fillStyle = '#e8b492'; ctx.strokeStyle = OL; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-44, -18); ctx.quadraticCurveTo(-10, -30, 26, -24); ctx.quadraticCurveTo(34, -12, 20, -8); ctx.quadraticCurveTo(-14, -6, -42, 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function s4_kiraD(T, perch) {
  const o = { x: perch.x, y: perch.y, size: 88, T, mouth: mouthAt('kira', T), blink: blinkAt(T, 34),
    expression: 'hope', tears: lerp(0.25, 0, prog(T, 24.0, 25.2)), lookX: -0.6, lookY: -0.4, rot: 0, squash: 0 };
  // breathing bob on the palm
  o.y += 3 * Math.sin(T * 2.4);
  o.squash = 0.04 * Math.sin(T * 2.4 + 1);
  if (T > 25.6) { o.expression = 'happy'; }
  // perks up: a little stretch as hope arrives
  o.squash += 0.2 * s4_bump(T, 24.35, 0.18) - 0.12 * s4_bump(T, 24.6, 0.12);
  o.rot = 0.08 * Math.sin(T * 1.6) + 0.1 * s4_bump(T, 26.0, 0.3);
  // excited mini-hop on the "!" of k2 (≈27.3)
  const hk = invLerp(27.2, 27.55, T);
  if (hk > 0 && hk < 1) { o.y -= 40 * 4 * hk * (1 - hk); o.squash += 0.2 * Math.sin(hk * Math.PI); }
  if (T > 27.55 && T < 27.9) o.squash -= 0.25 * Math.exp(-(T - 27.55) * 10);
  // glow: flickers of light that grow steadier
  o.glow = 0.65 + 0.25 * prog(T, 24.2, 27.8) + 0.08 * noise1(T * 6, 4);
  for (const f of [24.9, 25.7, 26.5, 27.3]) o.glow += 0.35 * s4_bump(T, f, 0.12);
  if (T > 27.9) { o.lookX = -0.8; o.lookY = -0.6; }
  // h3: bounces with Hina's fist pump, then leaps up and out of frame
  if (T > 29.2 && T < s4_T.leap) {
    const k = invLerp(29.2, s4_T.leap, T);
    o.squash = -0.35 * Math.sin(k * Math.PI * 0.5); o.y += 12 * k; o.expression = 'happy';
  }
  if (T >= s4_T.leap) {
    const k = T - s4_T.leap;
    o.y = perch.y + 10 - 1900 * k + 1400 * k * k; o.x += 250 * k;
    o.squash = 0.4; o.rot = 0.3 * k;
  }
  return o;
}

function s4_shotD(ctx, t, T) {
  // gentle eased drift in
  const k = prog(T, 24.0, 29.7, Ease.inOutQuad);
  const zoom = lerp(1.0, 1.07, k);
  const fx = 1000, fy = 560;
  const bgCam = { x: lerp(1230, 1270, k), y: 535, zoom: 1.45 };
  s4_bgPlate(ctx, T, bgCam, 6);
  s34_bokeh(ctx, T, { seed: 401, n: 9, x: 0, y: 380, w: 900, h: 260, rMin: 26, rMax: 60, color: '#ffc46a', alpha: 0.35 });
  s34_bokeh(ctx, T, { seed: 402, n: 8, x: 900, y: 150, w: 1000, h: 600, rMin: 20, rMax: 50, color: '#e0ff9a', alpha: 0.25 });

  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, fx - fx * zoom, fy - fy * zoom);
  // Hina: a close bust, three-quarter facing right toward Kira
  const talking = mouthAt('hina', T);
  let expr = T < 25.2 ? 'gentle' : 'smile';
  if (T > 28.35) expr = 'determined';
  const nod = 0.09 * s4_bump(T, 28.62, 0.12) + 0.06 * s4_bump(T, 29.3, 0.1);
  const hina = { x: 600, y: 1210, scale: 2.45, bust: true, facing: 1, view: 'threeQuarter', T,
    expression: expr, mouth: talking, blink: blinkAt(T, 22), lookX: 0.75, lookY: 0.55,
    headTilt: 0.12 - 0.05 * prog(T, 25.0, 26.0) + nod, wind: 0.3 };
  if (T > 28.3) { hina.lookY = lerp(0.55, 0.2, prog(T, 28.3, 28.6)); }
  if (T > 29.55) { hina.lookY = lerp(0.2, -0.5, prog(T, 29.55, 29.72)); }
  hina.y += 18 * s4_bump(T, 29.3, 0.1);   // determined bob on the fist pump
  drawHina(ctx, hina);

  // cupped hands and Kira between them
  const hx = 1130, hy = 735 + 4 * Math.sin(T * 1.1) + 14 * s4_bump(T, 29.3, 0.12);
  const kira = s4_kiraD(T, { x: hx - 4, y: hy - 88 * 0.78 });
  s4_cuppedHands(ctx, hx, hy, 1.05, clamp(kira.glow * 0.7));

  // fist pump (h3)
  const fistIn = prog(T, 28.55, 28.85, Ease.outBack), fistOut = prog(T, 29.5, 29.72);
  if (fistIn > 0 && fistOut < 1) {
    const pump = s4_bump(T, 29.3, 0.14);
    const fy2 = lerp(1250, 800, fistIn) + lerp(0, 500, fistOut) - 90 * pump;
    s4_fist(ctx, 360 + 20 * pump, fy2, 1.2, -0.12 - 0.08 * pump);
    if (pump > 0.2) {
      for (let i = 0; i < 5; i++) {   // little "determination" sparks
        const a = -Math.PI / 2 + (i - 2) * 0.45, rr = 110 + 40 * (T - 29.2);
        sparkle(ctx, 360 + Math.cos(a) * rr, fy2 - 60 + Math.sin(a) * rr, 16, '#fff3c0', pump, 0);
      }
    }
  }

  // lighting: cool night around the edges, warm light pooled around Kira
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  const kx = (kira.x - fx) * zoom + fx, ky = (kira.y - fy) * zoom + fy;
  const lg = ctx.createRadialGradient(kx, ky, 80, kx, ky, 1150);
  lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.35, '#c9c6d8'); lg.addColorStop(1, '#4a5690');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // warm uplight on Hina's face and on the palm
  const face = s34_headPos(hina);
  glow(ctx, face.x + 60, face.y + 140, 380, '#ffb347', 0.16 * kira.glow);
  glow(ctx, kira.x, kira.y + 40, 520, '#ffd76a', 0.2 * kira.glow);
  drawKira(ctx, kira);
  // flickers of light: sparkles popping around Kira
  for (const [i, f] of [24.9, 25.7, 26.5, 27.3].entries()) {
    const age = T - f;
    if (age < -0.05 || age > 0.8) continue;
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * TAU + i, rr = 90 + age * 160;
      sparkle(ctx, kira.x + Math.cos(a) * rr, kira.y + Math.sin(a) * rr * 0.8, 12 * (1 - age), '#fff3c0', clamp(1 - age / 0.8), a);
    }
  }
  // drifting golden motes rising from Kira
  const r = rng(404);
  for (let i = 0; i < 14; i++) {
    const per = 2 + r() * 2, ph = r() * per, age = ((T + ph) % per) / per;
    const mx = kira.x + (r() - 0.5) * 160 + 30 * noise1(T + i, 2), my = kira.y + 20 - age * 260;
    const a = Math.sin(age * Math.PI) * clamp(kira.glow - 0.3);
    ctx.fillStyle = rgba('#fff3c0', a);
    ctx.beginPath(); ctx.arc(mx, my, 2.4, 0, TAU); ctx.fill();
    glow(ctx, mx, my, 12, '#ffd76a', 0.4 * a);
  }
  ctx.restore();

  // out-of-focus foreground: rice leaves + firefly bokeh
  s34_fgStalks(ctx, T, [[1840, 620, -0.32, 70], [1720, 420, -0.12, 52], [1900, 820, -0.5, 80]], 10, '#050d0c', '#1f4a44');
  s34_bokeh(ctx, T, { seed: 403, n: 4, x: 1200, y: 100, w: 700, h: 500, rMin: 50, rMax: 90, color: '#e8ff9e', alpha: 0.22 });
}

// --- E: the lantern. Kira drops in from above, the lantern blooms with light.
function s4_shotE(ctx, t, T) {
  const k = prog(T, s4_T.cut, 31.5, Ease.inOutQuad);
  const lit = prog(T, s4_T.ignite[0], s4_T.ignite[1], Ease.outCubic);
  const bgCam = { x: lerp(980, 1010, k), y: 560, zoom: 1.25 };
  s4_bgPlate(ctx, T, bgCam, 3.5);
  s34_bokeh(ctx, T, { seed: 411, n: 8, x: 0, y: 380, w: 1920, h: 300, rMin: 16, rMax: 40, color: '#ffc46a', alpha: 0.3 });

  const zoom = lerp(1.0, 1.05, k);
  const fx = 960, fy = 560;
  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, fx - fx * zoom, fy - fy * zoom);
  const hina = { x: 760, y: 1150, scale: 1.75, facing: 1, view: 'threeQuarter', pose: 'hold', T,
    expression: T < s4_T.land + 0.15 ? 'determined' : 'joy', mouth: mouthAt('hina', T), blink: blinkAt(T, 22),
    lookX: 0.6, lookY: T < s4_T.land ? -0.3 : 0.4, headTilt: 0.05, wind: 0.35,
    lantern: { glow: lerp(0.08, 1, lit), kiraInside: T >= s4_T.land } };
  // lantern lifted up a touch as she "opens" it
  hina.armRaise = prog(T, s4_T.lanternOpen[0], s4_T.lanternOpen[1], Ease.outBack);
  drawHina(ctx, hina);

  // lantern mouth: where Kira drops in
  const hand = s34_handPos(hina);
  const mouth = typeof hinaLanternPos === 'function' ? hinaLanternPos(hina) : { x: hand.x, y: hand.y + 40 * hina.scale };
  const openK = prog(T, s4_T.lanternOpen[0], s4_T.lanternOpen[1]);
  // opening ring glow
  glow(ctx, mouth.x, mouth.y, 60 * openK, '#ffe9a8', 0.4 * openK * (1 - lit * 0.5));
  // Kira falling in from above
  if (T < s4_T.land + 0.05) {
    const kk = invLerp(s4_T.cut, s4_T.land, T);
    const kira = { x: lerp(mouth.x + 140, mouth.x, kk), y: lerp(-140, mouth.y - 10, Ease.inQuad(kk)) - 60 * Math.sin(kk * Math.PI),
      size: 46, T, expression: 'happy', mouth: null, glow: 1.1, squash: 0.35, rot: lerp(0.6, 0, kk), blink: 0, lookX: -0.3, lookY: 0.5 };
    // glittering trail
    for (let i = 1; i < 8; i++) {
      const kb = invLerp(s4_T.cut, s4_T.land, T - i * 0.03);
      const px = lerp(mouth.x + 140, mouth.x, kb), py = lerp(-140, mouth.y - 10, Ease.inQuad(kb)) - 60 * Math.sin(kb * Math.PI);
      sparkle(ctx, px + (hash(i) - 0.5) * 20, py, 10 - i, '#fff3c0', 1 - i / 8, i);
    }
    drawKira(ctx, kira);
  }
  // bloom of warm light as the lantern ignites
  if (T >= s4_T.land) {
    const a = T - s4_T.land;
    glow(ctx, mouth.x, mouth.y + 60, 500 + 200 * lit, '#ffb347', 0.35 * lit);
    const burst = Math.exp(-a * 4);
    glow(ctx, mouth.x, mouth.y + 40, 260, '#fff3c0', 0.7 * burst);
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * TAU + 0.2, rr = 40 + a * 260;
      sparkle(ctx, mouth.x + Math.cos(ang) * rr, mouth.y + 60 + Math.sin(ang) * rr, 14 * burst, '#fff3c0', burst, ang);
    }
  }
  ctx.restore();

  // warm/cool grade
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  const lx = (mouth.x - fx) * zoom + fx, ly = (mouth.y + 60 - fy) * zoom + fy;
  const lg = ctx.createRadialGradient(lx, ly, 60, lx, ly, 1250);
  lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.4, mixColor('#b4b4cc', '#f0dcc0', lit)); lg.addColorStop(1, '#4a5690');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  s34_fgStalks(ctx, T, [[60, 560, 0.3, 64], [180, 380, 0.12, 48], [1880, 520, -0.3, 60]], 9, '#050d0c', '#1f4a44');
  s34_bokeh(ctx, T, { seed: 412, n: 6, x: 0, y: 100, w: 1920, h: 700, rMin: 30, rMax: 70, color: '#e8ff9e', alpha: 0.2 });
}

registerScene('s4', {
  draw(ctx, t, T, d) {
    if (T < s4_T.cut) s4_shotD(ctx, t, T);
    else s4_shotE(ctx, t, T);
  },
});
