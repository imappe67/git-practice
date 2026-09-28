// Scene s7 — Ascension & finale: Kira rockets up, bursts into a meteor shower,
// and the stars settle into a constellation of Hina and Kira holding hands.
// Uses the shared village panorama painter from s1.js (s17_*).
'use strict';

const S7_LAUNCH = 53.0, S7_BURST = 54.6;
const S7_BURST_SKY = [1010, 70];          // burst point, sky space
const S7_KIRA0 = [S17_HILLTOP.x - 5, 405];  // Kira start, hill space (just above Hina)

function s7_cam(T) {
  const up = 340 * prog(T, 53.0, 54.75, Ease.inOutCubic);
  const down = 250 * prog(T, 55.0, 57.2, Ease.inOutCubic);
  return { U: up - down, Z: 1, X: 0, fx: W / 2, fy: H / 2 };
}

// Kira flight path in screen space for flight-time tau, seen through camera cam
function s7_kiraPos(tau, cam) {
  const x = clamp((tau - S7_LAUNCH) / (S7_BURST - S7_LAUNCH));
  const s = 0.25 * Ease.outQuad(x) + 0.75 * x ** 2.2;          // quick pop, then accelerate
  const a = s17_toScreen(cam, S17_P.hill, S7_KIRA0[0], S7_KIRA0[1]);
  const b = s17_toScreen(cam, S17_P.sky, S7_BURST_SKY[0], S7_BURST_SKY[1]);
  // arc: rise mostly vertically first then lean left
  const cx = lerp(a[0], b[0], 0.15), cy = lerp(a[1], b[1], 0.75);
  const u = 1 - s;
  let px = u * u * a[0] + 2 * u * s * cx + s * s * b[0];
  let py = u * u * a[1] + 2 * u * s * cy + s * s * b[1];
  // spiral wobble
  const rr = 70 * Math.sin(Math.PI * s) * (1 - 0.4 * s);
  const th = s * 5.5 * Math.PI;
  px += Math.cos(th) * rr; py += Math.sin(th) * rr * 0.35;
  return [px, py, s];
}

// ---- constellation: a girl and a little star holding hands (local coords, ~560x430)
const S7_CONST = {
  origin: [700, 10],  // sky space
  pts: {
    H1: [205, 30], H2: [150, 70], H3: [150, 128], H4: [206, 142], H5: [255, 96], CLIP: [246, 55],
    N: [210, 168], SL: [165, 190], SR: [248, 184],
    WL: [168, 262], WR: [246, 258],
    FL: [128, 385], FR: [276, 380],
    EL: [122, 250], HL: [96, 305],
    ER: [300, 222], HAND: [352, 238], SLV: [292, 280],
    KH: [392, 236],
    K1: [455, 105], K2: [540, 165], K3: [510, 268], K4: [412, 272], K5: [388, 168],
    E1: [445, 185], E2: [478, 185],
  },
  edges: [
    ['HAND', 'KH'], ['HAND', 'ER'], ['ER', 'SR'], ['ER', 'SLV'],
    ['KH', 'K5'], ['KH', 'K4'],
    ['K1', 'K3'], ['K3', 'K5'], ['K5', 'K2'], ['K2', 'K4'], ['K4', 'K1'],
    ['SR', 'N'], ['N', 'SL'], ['N', 'H4'], ['SR', 'WR'], ['SL', 'WL'], ['WL', 'WR'],
    ['WL', 'FL'], ['WR', 'FR'], ['FL', 'FR'], ['SL', 'EL'], ['EL', 'HL'],
    ['H4', 'H3'], ['H4', 'H5'], ['H3', 'H2'], ['H5', 'H1'], ['H2', 'H1'],
  ],
  big: { HAND: 2.2, K1: 1.5, K2: 1.4, K3: 1.3, K4: 1.3, K5: 1.3, H1: 1.3, CLIP: 1.4, E1: 0.7, E2: 0.7 },
};
function s7_constData() {
  if (S17.c.s7c) return S17.c.s7c;
  const C = S7_CONST, names = Object.keys(C.pts);
  // BFS level from the joined hands -> edges draw outward from there
  const lvl = { HAND: 0 };
  let frontier = ['HAND'];
  while (frontier.length) {
    const nf = [];
    for (const n of frontier) for (const [a, b] of C.edges) {
      const o = a === n ? b : b === n ? a : null;
      if (o && lvl[o] === undefined) { lvl[o] = lvl[n] + 1; nf.push(o); }
    }
    frontier = nf;
  }
  const stars = names.map((n, i) => {
    const [lx, ly] = C.pts[n];
    const tx = C.origin[0] + lx, ty = C.origin[1] + ly;
    // start: scattered around the burst point (debris that slows down)
    const ang = hash(i * 7 + 1) * TAU, dist = 180 + hash(i * 7 + 2) * 520;
    const sx = S7_BURST_SKY[0] + Math.cos(ang) * dist * 1.3, sy = S7_BURST_SKY[1] + Math.sin(ang) * dist * 0.7 + 120;
    return { n, tx, ty, sx, sy, i, lvl: lvl[n] ?? 3, big: C.big[n] || 1 };
  });
  const byName = Object.fromEntries(stars.map((s) => [s.n, s]));
  const edges = C.edges.map(([a, b], i) => {
    const la = byName[a].lvl, lb = byName[b].lvl;
    const from = la <= lb ? a : b, to = la <= lb ? b : a;
    return { a: byName[from], b: byName[to], start: 56.0 + Math.min(la, lb) * 0.2 + hash(i + 50) * 0.08, dur: 0.32 };
  });
  return (S17.c.s7c = { stars, edges });
}
function s7_starPos(s, T) {
  if (T < 55.5) {
    const k = Ease.outCubic(invLerp(S7_BURST, 55.4, T));
    return [lerp(S7_BURST_SKY[0], s.sx, k), lerp(S7_BURST_SKY[1], s.sy, k)];
  }
  const delay = s.lvl * 0.06 + hash(s.i + 90) * 0.1;
  const k = Ease.inOutCubic(invLerp(55.5 + delay, 56.35 + delay, T));
  // slight curved glide
  const bend = Math.sin(Math.PI * k) * 60 * (hash(s.i + 3) - 0.5);
  return [lerp(s.sx, s.tx, k) + bend, lerp(s.sy, s.ty, k) - bend * 0.5];
}

function s7_constellation(ctx, T, refl) {
  if (T < S7_BURST) return;
  const D = s7_constData();
  const mul = refl ? 0.45 : 1;
  const appear = prog(T, S7_BURST + 0.05, S7_BURST + 0.5);
  // lines
  for (const e of D.edges) {
    const k = Ease.inOutQuad(invLerp(e.start, e.start + e.dur, T));
    if (k <= 0) continue;
    const [ax, ay] = s7_starPos(e.a, T), [bx, by] = s7_starPos(e.b, T);
    const ex = lerp(ax, bx, k), ey = lerp(ay, by, k);
    const breathe = 0.8 + 0.2 * Math.sin(T * 2.2 + e.a.i);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,210,120,${0.16 * mul * breathe})`; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = `rgba(255,236,180,${0.3 * mul * breathe})`; ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,250,230,${0.85 * mul * breathe})`; ctx.lineWidth = 1.3;
    ctx.stroke();
    if (k < 1) {                 // drawing spark at the tip
      s17_glow(ctx, ex, ey, 30, '#fff3c0', 0.9 * mul);
      sparkle(ctx, ex, ey, 12, '#ffffff', mul, T * 4);
    }
  }
  // stars
  for (const s of D.stars) {
    const [x, y] = s7_starPos(s, T);
    const settled = prog(T, 56.2 + s.lvl * 0.06, 56.6 + s.lvl * 0.06);
    const pulse = 1 + 0.25 * Math.sin(T * 3.1 + s.i * 1.7) * settled;
    const hb = s.n === 'HAND' ? 1 + 0.5 * Math.max(0, Math.sin(T * 4.2)) ** 6 * prog(T, 56.0, 56.4) : 1;
    const sz = (2.4 + 1.6 * settled) * s.big * pulse * hb;
    const a = appear * mul;
    s17_glow(ctx, x, y, sz * 9, s.n === 'HAND' ? '#ffd76a' : '#fff0c8', 0.55 * a);
    ctx.fillStyle = `rgba(255,252,240,${clamp(a)})`;
    ctx.beginPath(); ctx.arc(x, y, sz * 0.8, 0, TAU); ctx.fill();
    if (!refl) sparkle(ctx, x, y, sz * (3.2 + 1.2 * Math.sin(T * 5 + s.i)), '#fffbe8', 0.8 * a, 0);
    // glide trail
    if (!refl && T > 55.5 && T < 56.8) {
      const [px, py] = s7_starPos(s, T - 0.08);
      const len = Math.hypot(x - px, y - py);
      if (len > 2) s17_streak(ctx, x, y, Math.atan2(y - py, x - px), len * 4, 6, '#fff3c0', 0.6 * a);
    }
  }
}

// ---- meteors (sky space, analytic). Returns nothing; draws.
function s7_meteors(ctx, T, refl) {
  if (T < S7_BURST) return;
  const [bx, by] = S7_BURST_SKY;
  const mul = refl ? 0.5 : 1;
  const cols = ['#fff3c0', '#ffd76a', '#cfe2ff', '#ffffff', '#ffc6d9'];
  // burst debris: radial, decelerating, drooping
  for (let i = 0; i < 150; i++) {
    const t0 = S7_BURST + hash(i + 1000) * 0.1;
    const age = T - t0, life = 0.8 + hash(i + 1001) * 1.1;
    if (age < 0 || age > life) continue;
    const ang = hash(i + 1002) * TAU, sp = 500 + hash(i + 1003) ** 0.6 * 1300, kd = 2.2;
    const disp = sp * (1 - Math.exp(-kd * age)) / kd;
    const x = bx + Math.cos(ang) * disp, y = by + Math.sin(ang) * disp * 0.8 + 60 * age * age;
    const vx = Math.cos(ang) * sp * Math.exp(-kd * age), vy = Math.sin(ang) * sp * 0.8 * Math.exp(-kd * age) + 120 * age;
    const v = Math.hypot(vx, vy);
    const a = (1 - age / life) ** 1.3 * mul;
    const col = cols[i % 5];
    s17_streak(ctx, x, y, Math.atan2(vy, vx), 20 + v * 0.16, 5 + hash(i + 1004) * 4, col, a);
    s17_glow(ctx, x, y, 10, col, 0.6 * a);
    if (!refl && i % 3 === 0) sparkle(ctx, x, y, 5 + 4 * a, '#ffffff', a * (0.5 + 0.5 * Math.sin(T * 30 + i)), 0);
  }
  // meteor shower radiating from the burst point, over the whole sky/village
  const N = 720;
  for (let i = 0; i < N; i++) {
    const u = hash(i + 2000);
    const t0 = S7_BURST + 0.1 + 4.0 * u ** 1.7;
    const life = 0.35 + hash(i + 2001) * 0.7;
    const age = T - t0;
    if (age < 0 || age > life) continue;
    let ang = -0.35 + hash(i + 2002) * (Math.PI + 0.7);     // mostly downward & sideways
    const r0 = 80 + hash(i + 2003) ** 0.7 * 1300;
    const sp = 900 + hash(i + 2004) * 1300;
    const d = r0 + sp * age;
    const x = bx + Math.cos(ang) * d * 1.25, y = by + Math.sin(ang) * d * 0.9;
    if (refl && y < 0) continue;
    const k = age / life;
    const a = Math.min(1, k * 8) * (1 - k) ** 1.2 * (0.55 + 0.45 * hash(i + 2005)) * mul;
    const col = cols[(i * 7) % 5];
    const vx = Math.cos(ang) * 1.25, vy = Math.sin(ang) * 0.9;
    const len = sp * (0.14 + 0.16 * hash(i + 2006)) * Math.min(1, age * 6);
    s17_streak(ctx, x, y, Math.atan2(vy, vx), len, 4 + hash(i + 2007) * 5, col, a);
    s17_glow(ctx, x, y, 7 + hash(i + 2008) * 8, col, 0.5 * a);
  }
}

registerScene('s7', {
  draw(ctx, t, T, d) {
    const cam = s7_cam(T);
    const since = T - S7_BURST;
    const flash = since >= 0 ? Math.exp(-since / 0.18) : 0;
    const afterglow = since >= 0 ? Math.exp(-since / 1.4) : 0;

    s17_panorama(ctx, T, cam, {
      starBoost: 0.4 * prog(T, 55.5, 57.0),
      winBoost: 0.8 * afterglow + 0.35 * prog(T, 54.6, 56),
      glitter: prog(T, 54.8, 55.6) * (1 - 0.7 * prog(T, 56.6, 57.4)),
      sky(c, TT, refl) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        s7_meteors(c, TT, refl);
        s7_constellation(c, TT, refl);
        // sky afterglow around the burst
        if (since >= 0) s17_glow(c, S7_BURST_SKY[0], S7_BURST_SKY[1], 900, '#ffd8a0', (refl ? 0.25 : 0.5) * afterglow);
        c.restore();
      },
      onHill(c, TT) {
        // tiny Hina from behind, waving at the sky; shouts h5 at 53.8
        const shout = TT >= 53.75 && TT < 54.55;
        const pose = shout ? 'cheer' : 'wave';
        const wave = 0.5 + 0.5 * Math.sin(TT * 9);
        drawHina(c, { x: S17_HILLTOP.x, y: S17_HILLTOP.y + 1, scale: 0.35, facing: -1, view: 'back', pose, armRaise: shout ? 1 : 0.6 + 0.4 * wave,
          T: TT, wind: 0.5, mouth: mouthAt('hina', TT), expression: 'joy', lookY: -1 });
        // warm rim light from Kira while it is still close
        const near = 1 - prog(TT, 53.0, 53.9);
        if (near > 0) s17_glow(c, S7_KIRA0[0], S7_KIRA0[1] + 60, 220, '#ffd76a', 0.45 * near);
        // launch pulse on the hill
        const lp = invLerp(53.0, 53.6, TT);
        if (lp > 0 && lp < 1) {
          c.save(); c.globalCompositeOperation = 'lighter';
          c.strokeStyle = `rgba(255,225,150,${0.6 * (1 - lp)})`; c.lineWidth = 3 * (1 - lp) + 0.5;
          c.beginPath(); c.ellipse(S7_KIRA0[0], S7_KIRA0[1] + 30, 30 + 160 * Ease.outCubic(lp), (30 + 160 * Ease.outCubic(lp)) * 0.3, 0, 0, TAU); c.stroke();
          c.restore();
        }
      },
    });

    // ---- Kira ascent with glittering spiral trail (screen space)
    if (T < S7_BURST + 0.9) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const trailFade = 1 - prog(T, S7_BURST, S7_BURST + 0.9);
      // ribbon
      const tEnd = Math.min(T, S7_BURST);
      const N = 48;
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const tau = tEnd - 0.75 * (i / N);
        if (tau < S7_LAUNCH) break;
        const p = s7_kiraPos(tau, cam);
        if (prev) {
          const k = 1 - i / N;
          ctx.strokeStyle = `rgba(255,215,120,${0.22 * k * trailFade})`; ctx.lineWidth = 3 + 22 * k;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
          ctx.strokeStyle = `rgba(255,250,225,${0.8 * k * trailFade})`; ctx.lineWidth = 1 + 4 * k;
          ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
        }
        prev = p;
      }
      // glitter particles shed along the path
      for (let j = 0; j < 220; j++) {
        const tj = S7_LAUNCH + (j / 220) * (S7_BURST - S7_LAUNCH);
        const age = T - tj, life = 0.9 + hash(j + 300) * 0.9;
        if (age < 0 || age > life) continue;
        const p = s7_kiraPos(tj, cam);
        const ang = hash(j + 301) * TAU, sp = 20 + hash(j + 302) * 70;
        const x = p[0] + Math.cos(ang) * sp * age + 30 * noise1(tj * 9 + age, j % 7);
        const y = p[1] + Math.sin(ang) * sp * age + 40 * age * age;
        const a = (1 - age / life) * (0.5 + 0.5 * Math.sin(T * 25 + j * 1.3)) * trailFade;
        const col = j % 3 === 0 ? '#cfe2ff' : '#fff3c0';
        sparkle(ctx, x, y, 3 + 6 * (1 - age / life), col, a, j);
        s17_glow(ctx, x, y, 10, '#ffd76a', 0.4 * a);
      }
      ctx.restore();
    }
    if (T < S7_BURST) {
      const [kx, ky, s] = s7_kiraPos(T, cam);
      const swell = prog(T, 54.3, S7_BURST, Ease.inQuad);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      s17_glow(ctx, kx, ky, 140 + 260 * swell, '#ffd76a', 0.55 + 0.4 * swell);
      s17_glow(ctx, kx, ky, 50 + 90 * swell, '#fff3c0', 0.7);
      ctx.restore();
      const size = lerp(24, 13, s) * (1 + 0.6 * swell);
      drawKira(ctx, { x: kx, y: ky, size, T, expression: 'happy', glow: 1.6 + 1.5 * swell, rot: Math.sin(T * 6) * 0.3 + s * 6, squash: T < 53.15 ? -0.4 * Math.sin(Math.PI * invLerp(53.0, 53.15, T)) : 0.25 * (1 - s), blink: blinkAt(T, 7) });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      sparkle(ctx, kx, ky, size * (2.2 + swell * 6), '#ffffff', 0.5 + 0.5 * swell, T * 3);
      ctx.restore();
    }

    // ---- burst: flash + expanding rings (screen space at the burst point)
    if (since >= 0 && since < 2.0) {
      const [bx, by] = s17_toScreen(cam, S17_P.sky, S7_BURST_SKY[0], S7_BURST_SKY[1]);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        const k = invLerp(0, 1.2 + i * 0.5, since - i * 0.1);
        if (k <= 0 || k >= 1) continue;
        const R = 30 + (650 + i * 500) * Ease.outCubic(k);
        const fa = (1 - k) ** 2;
        ctx.strokeStyle = `rgba(255,200,120,${0.22 * fa})`; ctx.lineWidth = 26 * (1 - k) + 4;
        ctx.beginPath(); ctx.ellipse(bx, by, R, R * 0.9, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,240,205,${0.5 * fa})`; ctx.lineWidth = 3 * (1 - k) + 0.8;
        ctx.stroke();
      }
      s17_glow(ctx, bx, by, 380 + 400 * (1 - flash), '#fff6dc', 1.0 * flash + 0.3 * afterglow);
      sparkle(ctx, bx, by, 40 + 170 * flash, '#ffffff', flash, 0);
      sparkle(ctx, bx, by, 25 + 90 * flash, '#ffe9a8', 0.8 * flash, Math.PI / 4);
      ctx.fillStyle = `rgba(255,240,210,${0.55 * flash})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // ---- title
    const ta = prog(T, 56.8, 57.9);
    if (ta > 0) {
      ctx.save();
      // soft dark halo behind the title for legibility
      const tg = ctx.createRadialGradient(W / 2, 640, 20, W / 2, 640, 620);
      tg.addColorStop(0, `rgba(4,8,24,${0.35 * ta})`); tg.addColorStop(1, 'rgba(4,8,24,0)');
      ctx.fillStyle = tg; ctx.fillRect(0, 300, W, 700);
      ctx.restore();
      s17_title(ctx, W / 2, 640, 150, ta, { reveal: prog(T, 56.8, 57.8), subAlpha: prog(T, 57.4, 58.2), spacing: 0.24 });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      s17_glow(ctx, W / 2, 640, 700, '#ffd76a', 0.12 * ta);
      ctx.restore();
    }
    // gentle dimming towards the global fade
    const dim = prog(T, 58.6, 60.0);
    if (dim > 0) { ctx.fillStyle = `rgba(0,0,8,${0.35 * dim})`; ctx.fillRect(0, 0, W, H); }
  },
});
