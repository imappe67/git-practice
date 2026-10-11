'use strict';
// ─────────────────────────────────────────────────────────────
//  Close-up cut-ins (face / king's eye) and the final frontal hero shot
//  Screen-space drawing (px, y-down).
// ─────────────────────────────────────────────────────────────
function pathPts(ctx, pts, close = true) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
function smoothPath(ctx, pts, close = true) {
  ctx.beginPath();
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let s = close ? mid(pts[n - 1], pts[0]) : pts[0];
  ctx.moveTo(s[0], s[1]);
  for (let i = 0; i < (close ? n : n - 1); i++) {
    const p = pts[i], q = pts[(i + 1) % n], m = mid(p, q);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  if (!close) ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
  else ctx.closePath();
}
function inkFill(ctx, fill, lw) {
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineJoin = 'round'; ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; ctx.stroke();
}

// Face (front, slight 3/4). S = face height in px. smile 0..1.
function drawFace(ctx, cx, cy, S, smile, t, o = {}) {
  const P = (x, y) => [cx + x * S, cy + y * S];
  const lw = Math.max(1.5, S * 0.012);
  const flow = o.flow !== undefined ? o.flow : 1;
  const wv = (i, a) => Math.sin(t * (o.slow ? 1.2 : 9) + i * 1.7) * a * flow;
  // back hair mass (streaming)
  const back = [P(0, -0.78), P(0.5, -0.62), P(0.66 + wv(1, 0.05), -0.1), P(0.78 + wv(2, 0.1), 0.6), P(0.95 + wv(3, 0.16), 1.3), P(0.55, 1.5),
    P(0.3, 1.0), P(-0.3, 1.0), P(-0.55, 1.5), P(-0.95 + wv(4, 0.16), 1.3), P(-0.78 + wv(5, 0.1), 0.6), P(-0.66 + wv(6, 0.05), -0.1), P(-0.5, -0.62)];
  smoothPath(ctx, back); inkFill(ctx, PAL.hair, lw);
  // neck
  pathPts(ctx, [P(-0.14, 0.45), P(0.14, 0.45), P(0.16, 1.0), P(-0.16, 1.0)]); inkFill(ctx, PAL.skin, lw);
  pathPts(ctx, [P(-0.14, 0.5), P(0.14, 0.5), P(0.15, 0.7), P(-0.15, 0.62)]); ctx.fillStyle = PAL.skinSh; ctx.fill();
  // face
  const face = [P(0, -0.66), P(0.34, -0.56), P(0.43, -0.2), P(0.41, 0.12), P(0.3, 0.44), P(0.1, 0.64), P(0, 0.68), P(-0.1, 0.64), P(-0.3, 0.44), P(-0.41, 0.12), P(-0.43, -0.2), P(-0.34, -0.56)];
  smoothPath(ctx, face); inkFill(ctx, PAL.skin, lw * 1.2);
  // cel shadow on one cheek
  ctx.save(); smoothPath(ctx, face); ctx.clip();
  smoothPath(ctx, [P(0.34, -0.05), P(0.5, 0.0), P(0.5, 0.7), P(0.04, 0.72), P(0.22, 0.52), P(0.33, 0.25)]);
  ctx.fillStyle = PAL.skinSh; ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
  // eyes: sharp, long, pale violet
  const eye = (sx) => {
    const ex = sx * 0.19, ey = 0.03;
    const shape = [P(ex - sx * 0.12, ey + 0.012), P(ex - sx * 0.04, ey - 0.028), P(ex + sx * 0.08, ey - 0.03), P(ex + sx * 0.135, ey - 0.002), P(ex + sx * 0.05, ey + 0.035), P(ex - sx * 0.06, ey + 0.035)];
    smoothPath(ctx, shape); ctx.fillStyle = '#fbfaff'; ctx.fill();
    ctx.save(); smoothPath(ctx, shape); ctx.clip();
    const ic = P(ex + sx * 0.005, ey - 0.005);
    const g = ctx.createLinearGradient(ic[0], ic[1] - S * 0.05, ic[0], ic[1] + S * 0.05);
    g.addColorStop(0, '#9c8cc4'); g.addColorStop(1, '#f1eaff');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ic[0], ic[1], S * 0.048, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6a5a8e'; ctx.beginPath(); ctx.arc(ic[0], ic[1], S * 0.016, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ic[0] - S * 0.015, ic[1] - S * 0.02, S * 0.011, 0, TAU); ctx.fill();
    if (o.spark) { ctx.fillStyle = `rgba(230,215,255,${o.spark})`; ctx.fillRect(ic[0] + S * 0.01, ic[1] + S * 0.005, S * 0.025, S * 0.006); }
    ctx.restore();
    // heavy upper lid + wing
    ctx.lineCap = 'round'; ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw * 2.2;
    ctx.beginPath(); const a = P(ex - sx * 0.125, ey + 0.012); ctx.moveTo(a[0], a[1]);
    const b = P(ex - sx * 0.02, ey - 0.04), c = P(ex + sx * 0.1, ey - 0.032), d = P(ex + sx * 0.17, ey - 0.02);
    ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath(); const e = P(ex - sx * 0.05, ey + 0.04), f = P(ex + sx * 0.09, ey + 0.02); ctx.moveTo(e[0], e[1]); ctx.lineTo(f[0], f[1]); ctx.stroke();
    // brow
    ctx.lineWidth = lw * 1.1;
    ctx.beginPath(); const g1 = P(ex - sx * 0.1, ey - 0.12), gc = P(ex + sx * 0.04, ey - 0.2), g2 = P(ex + sx * 0.15, ey - 0.13); ctx.moveTo(g1[0], g1[1]); ctx.quadraticCurveTo(gc[0], gc[1], g2[0], g2[1]); ctx.stroke();
  };
  eye(-1); eye(1);
  // nose
  ctx.strokeStyle = PAL.skinSh; ctx.lineWidth = lw;
  ctx.beginPath(); const n1 = P(0.02, 0.2), n2 = P(0.035, 0.27); ctx.moveTo(n1[0], n1[1]); ctx.lineTo(n2[0], n2[1]); ctx.stroke();
  // mouth: thin, knowing smile (asymmetric) ↔ flat
  ctx.strokeStyle = '#6a3b40'; ctx.lineWidth = lw * 1.2; ctx.lineCap = 'round';
  const m0 = P(-0.085, 0.43 - smile * 0.012), m1 = P(0.09, 0.43 - smile * 0.03), mc = P(0.0, 0.44 + smile * 0.012);
  ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.quadraticCurveTo(mc[0], mc[1], m1[0], m1[1]); ctx.stroke();
  if (smile > 0.5) { ctx.lineWidth = lw * 0.8; const m2 = P(0.105, 0.41 - smile * 0.03); ctx.beginPath(); ctx.moveTo(m1[0], m1[1]); ctx.lineTo(m2[0], m2[1]); ctx.stroke(); }
  // center-parted curtains of black hair framing the face
  const curtain = (sx) => {
    const pts = [P(0, -0.72), P(sx * 0.2, -0.67), P(sx * 0.39, -0.48), P(sx * 0.45, -0.12), P(sx * (0.47 + wv(sx + 7, 0.02)), 0.5), P(sx * (0.5 + wv(sx + 8, 0.06)), 1.05),
      P(sx * (0.62 + wv(sx + 9, 0.08)), 1.2), P(sx * 0.66, 0.4), P(sx * 0.6, -0.3), P(sx * 0.4, -0.72), P(sx * 0.1, -0.8)];
    smoothPath(ctx, pts); inkFill(ctx, PAL.hair, lw);
    // cel highlight band
    ctx.strokeStyle = PAL.hairHi; ctx.lineWidth = lw * 1.6;
    ctx.beginPath(); const h0 = P(sx * 0.42, -0.5), h1 = P(sx * 0.53, -0.25), h2 = P(sx * 0.56, 0.2);
    ctx.moveTo(h0[0], h0[1]); ctx.quadraticCurveTo(h1[0], h1[1], h2[0], h2[1]); ctx.stroke();
  };
  curtain(-1); curtain(1);
  // ear with a small earring
  smoothPath(ctx, [P(0.41, -0.06), P(0.5, -0.04), P(0.49, 0.12), P(0.42, 0.16)]); inkFill(ctx, PAL.skin, lw);
  ctx.beginPath(); const er = P(0.45, 0.2); ctx.arc(er[0], er[1], S * 0.014, 0, TAU); inkFill(ctx, '#c9cfe0', lw * 0.7);
  // part line
  ctx.strokeStyle = '#3b3550'; ctx.lineWidth = lw;
  ctx.beginPath(); const pa = P(0, -0.78), pb = P(0, -0.62); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
}

function speedLinesBG(ctx, col1, col2, seed, cx, cy) {
  const C = CAMERA;
  const g = ctx.createRadialGradient(cx, cy, 30, cx, cy, C.W * 0.8);
  g.addColorStop(0, col1); g.addColorStop(1, col2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, C.W, C.H);
}

function drawCutin(ctx, t, c) {
  const C = CAMERA;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const u = (t - c.t0) / (c.t1 - c.t0);
  if (c.type === 'face') {
    const q = Math.floor(t * (c.slow ? 6 : 30));
    speedLinesBG(ctx, '#55597a', '#141826', 0, C.W * 0.5, C.H * 0.45);
    focusLines(ctx, C.W * 0.5, C.H * 0.42, 'rgba(225,232,240,0.35)', q * 3.1, 90);
    // floating snow / sparks
    for (let i = 0; i < 70; i++) {
      const x = ((rnd(i) * C.W + (c.slow ? 8 : 900) * u * (0.5 + rnd(i * 2))) % C.W);
      const y = rnd(i * 3) * C.H;
      ctx.fillStyle = i % 5 ? 'rgba(240,246,250,0.7)' : 'rgba(255,150,60,0.9)';
      ctx.fillRect(x, y, c.slow ? 3 : 18, 2);
    }
    const smile = lerp(c.smile[0], c.smile[1], smooth(sat(u * 1.6 - 0.2)));
    const S = C.H * 0.62 * (1 + u * 0.06);
    drawFace(ctx, C.W * 0.5 + (1 - u) * 20, C.H * 0.4, S, smile, t, { spark: c.spark, slow: c.slow, flow: c.slow ? 0.6 : 1 });
    // violet electricity licking the frame
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      const a = [rnd(q + k) * C.W, C.H * (0.75 + rnd(q * 2 + k) * 0.25)], b = [a[0] + rnds(q + k * 3) * 300, C.H * 0.6 + rnds(k) * 80];
      strokeBolt(ctx, jagged(a, b, q + k * 9, 0.2, 9), 2, { sil: false });
    }
    ctx.globalCompositeOperation = 'source-over';
    // letterbox bars for the cut-in
    ctx.fillStyle = PAL.ink; ctx.fillRect(0, 0, C.W, C.H * 0.07); ctx.fillRect(0, C.H * 0.93, C.W, C.H * 0.07);
  } else if (c.type === 'kingEye') {
    speedLinesBG(ctx, '#3b1a12', '#07070a', 0, C.W * 0.55, C.H * 0.5);
    const q = Math.floor(t * 30);
    focusLines(ctx, C.W * 0.55, C.H * 0.5, 'rgba(255,140,60,0.22)', q, 80);
    const s = C.H * 1.1 * (1 + u * 0.12);
    const cx = C.W * 0.55, cy = C.H * 0.5;
    // bone around the socket
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.12);
    smoothPath(ctx, [[-s * 0.7, -s * 0.2], [-s * 0.2, -s * 0.42], [s * 0.4, -s * 0.36], [s * 0.75, -s * 0.05], [s * 0.6, s * 0.3], [0, s * 0.42], [-s * 0.6, s * 0.3]]);
    inkFill(ctx, PAL.bone, 5);
    ctx.fillStyle = PAL.boneSh;
    smoothPath(ctx, [[-s * 0.6, s * 0.05], [0, s * 0.18], [s * 0.6, s * 0.1], [s * 0.55, s * 0.3], [0, s * 0.42], [-s * 0.6, s * 0.3]]); ctx.fill();
    // cracks
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3;
    for (let k = 0; k < 6; k++) KDRAW.line(ctx, jagged([rnds(k) * s * 0.5, rnds(k + 3) * s * 0.3], [rnds(k + 5) * s * 0.7, rnds(k + 7) * s * 0.4], k * 11, 0.2, 5));
    // socket
    smoothPath(ctx, [[-s * 0.28, 0], [-s * 0.1, -s * 0.16], [s * 0.2, -s * 0.15], [s * 0.32, 0], [s * 0.12, s * 0.14], [-s * 0.16, s * 0.12]]);
    inkFill(ctx, '#120506', 6);
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    const fl = 0.85 + 0.15 * Math.sin(t * 60);
    glow(ctx, cx, cy, s * 0.35 * (0.8 + u * 0.6), 'rgba(255,80,20,0.9)', 0.8 * fl);
    glow(ctx, cx, cy, s * 0.09 * (1 + u), 'rgba(255,235,180,1)', 1);
    for (let i = 0; i < 40; i++) {
      const a = rnd(i) * TAU + u * 2, r = s * (0.1 + rnd(i * 2) * 0.5 * (0.3 + u));
      ctx.fillStyle = `rgba(255,${120 + (i % 5) * 25},40,0.9)`;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6 - u * 40, 3 + (i % 3), 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = PAL.ink; ctx.fillRect(0, 0, C.W, C.H * 0.07); ctx.fillRect(0, C.H * 0.93, C.W, C.H * 0.07);
  }
}

// ── 0:28 – 0:30  final frontal shot ─────────────────────────
function drawHero(ctx, t) {
  const C = CAMERA, Wd = C.W, H = C.H;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const u = t - 28;
  // background: ice fog, horizon, fallen king mass dissolving in the fog
  const hY = H * 0.5;
  let g = ctx.createLinearGradient(0, 0, 0, hY);
  g.addColorStop(0, '#5d6570'); g.addColorStop(1, '#c9d3dc');
  ctx.fillStyle = g; ctx.fillRect(0, 0, Wd, hY);
  g = ctx.createLinearGradient(0, hY, 0, H);
  g.addColorStop(0, '#d6e0e8'); g.addColorStop(1, '#7c90a2');
  ctx.fillStyle = g; ctx.fillRect(0, hY, Wd, H - hY);
  // fallen king silhouette in the fog
  ctx.globalAlpha = 0.35 * (1 - sat(u / 2) * 0.4);
  ctx.fillStyle = '#4a4f58';
  smoothPath(ctx, [[Wd * 0.18, hY + 6], [Wd * 0.26, hY - 40], [Wd * 0.36, hY - 70], [Wd * 0.44, hY - 52], [Wd * 0.5, hY - 88], [Wd * 0.53, hY - 60], [Wd * 0.62, hY - 30], [Wd * 0.72, hY + 6]]);
  ctx.fill();
  ctx.strokeStyle = '#4a4f58'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  KDRAW.line(ctx, [[Wd * 0.5, hY - 84], [Wd * 0.48, hY - 140], [Wd * 0.52, hY - 175]]);
  KDRAW.line(ctx, [[Wd * 0.485, hY - 120], [Wd * 0.45, hY - 150]]);
  KDRAW.line(ctx, [[Wd * 0.53, hY - 90], [Wd * 0.58, hY - 135], [Wd * 0.56, hY - 168]]);
  ctx.globalAlpha = 1;
  // hex cracks rushing toward the lens (camera dollying forward)
  ctx.strokeStyle = 'rgba(20,36,58,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const zz = ((rnd(i) * 10 - u * 9) % 10 + 10) % 10 + 0.4;
    const x = (rnds(i * 3) * 9) / zz, w = 1.2 / zz;
    const y = hY + 60 / zz;
    ctx.beginPath(); ctx.moveTo(Wd / 2 + x * 120 - w * 60, y); ctx.lineTo(Wd / 2 + x * 120 + w * 60, y + 4 / zz); ctx.stroke();
  }
  // fog wall parting
  const part = smooth(sat(u / 0.6));
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1;
    const x = Wd / 2 + side * (rnd(i) * Wd * 0.3 + part * Wd * 0.45);
    const y = H * (0.25 + rnd(i * 2) * 0.7);
    const r = 120 + rnd(i * 3) * 220;
    const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, `rgba(232,238,244,${0.75 * (1 - part * 0.55)})`); gg.addColorStop(1, 'rgba(232,238,244,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  // figure
  const approach = easeOut(sat(u / 0.9));
  const k = H * lerp(0.62, 1.12, approach);
  const bob = Math.sin(u * 22) * (1 - sat((u - 1.1) / 0.3)) * k * 0.012;
  const ox = Wd * 0.5 + Math.sin(u * 3) * 6, oy = H * lerp(0.42, 0.36, approach) + bob;
  drawHeroFigure(ctx, ox, oy, k, t, u);
  // drifting snow streaking past the lens (radial, camera moving forward)
  ctx.lineCap = 'round';
  for (let i = 0; i < 160; i++) {
    const a = rnd(i) * TAU, ph = ((rnd(i * 2) + u * (0.6 + rnd(i * 3))) % 1);
    const r0 = ph * ph * Wd * 0.9;
    const x = Wd / 2 + Math.cos(a) * r0, y = H * 0.45 + Math.sin(a) * r0 * 0.6;
    ctx.strokeStyle = `rgba(240,246,250,${0.25 + ph * 0.6})`; ctx.lineWidth = 1 + ph * 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * ph * 40, y + Math.sin(a) * ph * 24); ctx.stroke();
  }
  // pale violet lens flare
  const fl = sat((u - 1.68) / 0.12);
  if (fl > 0) {
    const fx = Wd * 0.33, fy = H * 0.12;
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, fx, fy, 260, 'rgba(200,170,255,0.9)', 0.55 * fl);
    glow(ctx, fx, fy, 60, 'rgba(255,255,255,1)', 0.9 * fl);
    const sg = ctx.createLinearGradient(0, fy, Wd, fy);
    sg.addColorStop(0, 'rgba(190,160,255,0)'); sg.addColorStop(fx / Wd, `rgba(230,215,255,${0.85 * fl})`); sg.addColorStop(1, 'rgba(190,160,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, fy - 3, Wd, 6);
    for (let i = 1; i <= 4; i++) {
      const gx = lerp(fx, Wd - fx, i / 4.5), gy = lerp(fy, H - fy, i / 4.5);
      ctx.globalAlpha = 0.25 * fl; ctx.strokeStyle = '#cdb8ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(gx, gy, 20 + i * 18, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(170,140,255,0.25)'; ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawHeroFigure(ctx, ox, oy, k, t, u) {
  const P = (x, y) => [ox + x * k, oy + y * k];
  const lw = Math.max(2, k * 0.004);
  const run = 1 - sat((u - 1.15) / 0.4);
  const st = Math.sin(u * 11);
  const flow = 0.7 + 0.3 * Math.sin(u * 7);
  // long hair streaming back, flaring past the shoulders
  for (const sx of [-1, 1]) {
    const wv = Math.sin(u * 9 + sx * 2) * 0.025;
    const pts = [P(sx * 0.07, -0.27), P(sx * 0.14, -0.24), P(sx * (0.2 + flow * 0.04), -0.05), P(sx * (0.28 + flow * 0.06), 0.2 + wv),
      P(sx * (0.26 + flow * 0.04), 0.34 + wv), P(sx * 0.2, 0.25), P(sx * 0.15, 0.05), P(sx * 0.1, -0.12)];
    smoothPath(ctx, pts); inkFill(ctx, PAL.hair, lw);
    ctx.strokeStyle = '#2c2c44'; ctx.lineWidth = lw * 1.4;
    const a = P(sx * 0.13, -0.2), b = P(sx * (0.21 + flow * 0.04), 0.05), c = P(sx * 0.25, 0.26);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.stroke();
  }
  // legs (black tights, metal knee pads, white boots) — running stride
  const legPts = (sx, ph) => {
    const lift = Math.max(0, Math.sin(ph)) * run;
    const hip = P(sx * 0.07, 0.42), knee = P(sx * 0.085, 0.66 - lift * 0.12), ank = P(sx * 0.08, 0.92 - lift * 0.18);
    return [hip, knee, ank, lift];
  };
  for (const [sx, ph] of [[-1, u * 11], [1, u * 11 + Math.PI]]) {
    const [hip, knee, ank, lift] = legPts(sx, ph);
    ctx.lineCap = 'round';
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = k * 0.085 + lw * 2; KDRAW.line(ctx, [hip, knee, ank]);
    ctx.strokeStyle = '#17171f'; ctx.lineWidth = k * 0.085; KDRAW.line(ctx, [hip, knee, ank]);
    ctx.beginPath(); ctx.ellipse(knee[0], knee[1], k * 0.045, k * 0.035, 0, 0, TAU);
    ctx.fillStyle = iridescent(ctx, [knee[0] - k * 0.04, knee[1]], [knee[0] + k * 0.04, knee[1]]); ctx.fill();
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; ctx.stroke();
    const boot = [[ank[0] - k * 0.05, ank[1] - k * 0.12], [ank[0] + k * 0.05, ank[1] - k * 0.12], [ank[0] + k * 0.055, ank[1] + k * 0.03], [ank[0] - k * 0.055, ank[1] + k * 0.03]];
    pathPts(ctx, boot); inkFill(ctx, PAL.boot, lw);
    ctx.strokeStyle = '#b5b0a6'; ctx.lineWidth = lw * 0.8; KDRAW.line(ctx, [[ank[0] - k * 0.03, ank[1] - k * 0.05], [ank[0] + k * 0.02, ank[1] - k * 0.03]]);
  }
  // coat body flaring backwards at the hem
  const hemW = 0.24 + flow * 0.05;
  const coat = [P(-0.19, 0.0), P(0.19, 0.0), P(0.16, 0.36), P(hemW, 0.6 + Math.sin(u * 13) * 0.02), P(0.06, 0.55), P(-0.06, 0.55), P(-hemW, 0.6 + Math.sin(u * 13 + 1) * 0.02), P(-0.16, 0.36)];
  smoothPath(ctx, coat); inkFill(ctx, PAL.coat, lw * 1.3);
  // quilting
  ctx.strokeStyle = 'rgba(130,138,150,0.6)'; ctx.lineWidth = lw * 0.8;
  for (let i = 1; i < 6; i++) { const y = i * 0.065; KDRAW.line(ctx, [P(-0.18 + y * 0.05, y), P(-0.1, y + 0.005)]); KDRAW.line(ctx, [P(0.1, y + 0.005), P(0.18 - y * 0.05, y)]); }
  // surcoat with frayed hem
  const sc = [P(-0.11, 0.04), P(0.11, 0.04), P(0.12, 0.36)];
  for (let i = 0; i <= 8; i++) sc.push(P(0.13 - i * 0.0325, 0.6 + (i % 2) * 0.035 + Math.sin(u * 15 + i) * 0.008));
  sc.push(P(-0.12, 0.36));
  pathPts(ctx, sc); inkFill(ctx, PAL.surcoat, lw);
  // iridescent oil-film stains on the surcoat
  ctx.save(); pathPts(ctx, sc); ctx.clip();
  for (let i = 0; i < 6; i++) {
    const c = P(rnds(i * 3.1) * 0.1, 0.15 + rnd(i * 5.3) * 0.45);
    const gg = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], k * 0.06);
    gg.addColorStop(0, i % 2 ? 'rgba(170,150,230,0.35)' : 'rgba(140,210,220,0.3)'); gg.addColorStop(1, 'rgba(170,150,230,0)');
    ctx.fillStyle = gg; ctx.fillRect(c[0] - k * 0.06, c[1] - k * 0.06, k * 0.12, k * 0.12);
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(160,160,170,0.35)'; pathPts(ctx, [P(0.0, 0.05), P(0.11, 0.04), P(0.12, 0.36), P(0.13, 0.6), P(0.02, 0.62)]); ctx.fill();
  // two brown leather belts
  for (const [y, a] of [[0.33, 0.02], [0.39, -0.03]]) {
    pathPts(ctx, [P(-0.165, y - a), P(0.165, y + a), P(0.165, y + a + 0.022), P(-0.165, y - a + 0.022)]); inkFill(ctx, '#7a4a26', lw);
    pathPts(ctx, [P(-0.02, y - 0.004), P(0.02, y - 0.002), P(0.02, y + 0.026), P(-0.02, y + 0.024)]); inkFill(ctx, '#b8bccb', lw * 0.8);
    // hanging strap
    pathPts(ctx, [P(0.06, y + 0.01), P(0.085, y + 0.012), P(0.08 + Math.sin(u * 12 + y * 20) * 0.01, y + 0.17), P(0.055, y + 0.168)]); inkFill(ctx, '#7a4a26', lw * 0.8);
  }
  // arms
  const shL = P(-0.19, 0.04), shR = P(0.19, 0.04);
  // her right arm (viewer's left): sprint swing → catch overhead (29.25) → shoulder the spear (29.65)
  const swing = Math.sin(u * 11) * run;
  const catchU = smooth(sat((u - 0.95) / 0.3)), shoulderU = smooth(sat((u - 1.25) / 0.4));
  const elbowOut = (sh, h, side) => {
    const a = ik2(sh, h, k * 0.21, k * 0.21, 1), b = ik2(sh, h, k * 0.21, k * 0.21, -1);
    return ((a.j[0] - sh[0]) * side > (b.j[0] - sh[0]) * side ? a : b);
  };
  let hand = v2.lerp(P(-0.11, 0.31 + swing * 0.07), P(-0.14, -0.62), catchU);
  hand = v2.lerp(hand, P(-0.12, -0.02), shoulderU);
  const elb = elbowOut(shL, hand, -1).j;
  const handR = v2.lerp(P(0.11, 0.31 - swing * 0.07), P(0.22, 0.36), 1 - run);
  const elR = elbowOut(shR, handR, 1).j;
  const arm = (a, e, h, patch) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = k * 0.085 + lw * 2; KDRAW.line(ctx, [a, e]);
    ctx.strokeStyle = PAL.coat; ctx.lineWidth = k * 0.085; KDRAW.line(ctx, [a, e]);
    ctx.strokeStyle = PAL.coatSh; ctx.lineWidth = k * 0.025; KDRAW.line(ctx, [v2.add(a, [k * 0.02, k * 0.01]), v2.add(e, [k * 0.02, k * 0.01])]);
    if (patch) { const m = v2.lerp(a, e, 0.4); ctx.beginPath(); ctx.roundRect(m[0] - k * 0.022, m[1] - k * 0.03, k * 0.044, k * 0.06, k * 0.012); inkFill(ctx, '#111118', lw); ctx.beginPath(); ctx.arc(m[0], m[1], k * 0.01, 0, TAU); ctx.strokeStyle = '#9aa0b0'; ctx.lineWidth = lw * 0.7; ctx.stroke(); }
    // mechanical gauntlet
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = k * 0.07 + lw * 2; KDRAW.line(ctx, [e, h]);
    ctx.strokeStyle = '#aab2c4'; ctx.lineWidth = k * 0.07; KDRAW.line(ctx, [e, h]);
    ctx.strokeStyle = iridescent(ctx, e, h); ctx.lineWidth = k * 0.02; KDRAW.line(ctx, [v2.lerp(e, h, 0.15), v2.lerp(e, h, 0.85)]);
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw;
    for (let i = 1; i < 4; i++) { const p = v2.lerp(e, h, i / 4), d = v2.norm(v2.sub(h, e)), n = [-d[1] * k * 0.035, d[0] * k * 0.035]; KDRAW.line(ctx, [v2.add(p, n), v2.sub(p, n)]); }
    ctx.beginPath(); ctx.arc(h[0], h[1], k * 0.035, 0, TAU); inkFill(ctx, '#7c8592', lw);
  };
  arm(shR, elR, handR, true);
  // spear: free-falling & spinning until the catch, then shouldered
  const tipLen = k * 0.75, buttLen = k * 0.75;
  let sc2, ang;
  if (u < 1.25) {
    const fu = sat((u - 0.55) / 0.7);
    const start = P(0.05, -1.4);
    sc2 = v2.lerp(start, hand, easeIn(fu) * 0.6 + fu * 0.4);
    ang = -Math.PI / 2 + (1 - fu) * TAU * 2.5;
  } else { sc2 = hand; ang = lerp(-Math.PI / 2 - 0.15, -Math.PI * 0.78, shoulderU); }
  if (u > 0.55) {
    const d = [Math.cos(ang), Math.sin(ang)];
    const tip = v2.add(sc2, v2.mul(d, tipLen)), butt = v2.sub(sc2, v2.mul(d, buttLen));
    ctx.lineCap = 'round';
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = k * 0.026 + lw * 2; KDRAW.line(ctx, [butt, tip]);
    ctx.strokeStyle = PAL.shaft; ctx.lineWidth = k * 0.026; KDRAW.line(ctx, [butt, tip]);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#6a4a3e'; ctx.lineWidth = k * 0.03; KDRAW.line(ctx, [v2.lerp(butt, tip, 0.76), v2.lerp(butt, tip, 0.88)]);
    ctx.strokeStyle = '#1b1820'; ctx.lineWidth = k * 0.03; KDRAW.line(ctx, [v2.lerp(butt, tip, 0.03), v2.lerp(butt, tip, 0.13)]);
    ctx.lineCap = 'round';
    const n = [-d[1], d[0]];
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = k * 0.016 + lw * 2; KDRAW.line(ctx, [v2.add(tip, v2.mul(n, k * 0.07)), v2.sub(tip, v2.mul(n, k * 0.07))]);
    ctx.strokeStyle = '#aab2c4'; ctx.lineWidth = k * 0.016; KDRAW.line(ctx, [v2.add(tip, v2.mul(n, k * 0.07)), v2.sub(tip, v2.mul(n, k * 0.07))]);
    const blade = [v2.add(tip, v2.mul(n, k * 0.022)), v2.add(v2.add(tip, v2.mul(d, k * 0.1)), v2.mul(n, k * 0.03)), v2.add(tip, v2.mul(d, k * 0.26)),
      v2.sub(v2.add(tip, v2.mul(d, k * 0.1)), v2.mul(n, k * 0.03)), v2.sub(tip, v2.mul(n, k * 0.022))];
    pathPts(ctx, blade); ctx.fillStyle = iridescent(ctx, tip, blade[2]); ctx.fill(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; ctx.stroke();
    // residual lightning on the spear while it falls
    if (u < 1.3) {
      ctx.globalCompositeOperation = 'lighter';
      strokeBolt(ctx, jagged(butt, tip, Math.floor(t * 40), 0.08, 10), 1.5, { sil: false });
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  arm(shL, elb, hand, false);
  // thick collar + iridescent gorget
  pathPts(ctx, [P(-0.05, -0.12), P(0.05, -0.12), P(0.06, 0.02), P(-0.06, 0.02)]); inkFill(ctx, '#1b1820', lw);
  for (const sx of [-1, 1]) {
    smoothPath(ctx, [P(sx * 0.17, 0.03), P(sx * 0.13, -0.07), P(sx * 0.1, -0.15), P(sx * 0.055, -0.13), P(sx * 0.05, 0.0), P(sx * 0.08, 0.07)]);
    inkFill(ctx, '#f6f5f2', lw * 1.2);
  }
  smoothPath(ctx, [P(-0.07, -0.04), P(0.07, -0.04), P(0.06, 0.03), P(0, 0.06), P(-0.06, 0.03)]);
  ctx.fillStyle = iridescent(ctx, P(-0.07, 0), P(0.07, 0)); ctx.fill(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; ctx.stroke();
  // head
  const smile = smooth(sat((u - 1.55) / 0.2)) * 0.9 + 0.1;
  drawFace(ctx, ox, oy + -0.2 * k, k * 0.2, smile, t, { spark: 0.6 + 0.4 * Math.sin(t * 30), flow: 0.8 });
  // violet electricity still crackling on the shoulders
  ctx.globalCompositeOperation = 'lighter';
  const q = Math.floor(t * 36);
  for (let i = 0; i < 6; i++) {
    const base = i % 2 ? shR : shL;
    const a = [base[0] + rnds(q + i) * k * 0.06, base[1] - k * 0.01];
    const b = [a[0] + rnds(q * 3 + i) * k * 0.14, a[1] - rnd(q * 5 + i) * k * 0.12];
    strokeBolt(ctx, jagged(a, b, q + i * 7, 0.3, 6), 1.3, { sil: false });
  }
  glow(ctx, shL[0], shL[1], k * 0.12, 'rgba(190,160,255,0.8)', 0.4);
  glow(ctx, shR[0], shR[1], k * 0.12, 'rgba(190,160,255,0.8)', 0.4);
  ctx.globalCompositeOperation = 'source-over';
}
