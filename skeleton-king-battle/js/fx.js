'use strict';
// ─────────────────────────────────────────────────────────────
//  FX: deterministic bursts (scrub-safe), bolts, embers, rings, impact frames
//  Every particle is a closed-form function of (birth, seed, warped time).
// ─────────────────────────────────────────────────────────────
const FX = { bursts: [], bolts: [], rings: [] };

const BT = {
  sparkV: { n: 34, sp: [12, 40], up: 0.3, life: [0.25, 0.6], g: -18, kind: 'spark', col: [215, 195, 255] },
  sparkVBig: { n: 130, sp: [20, 85], up: 0.2, life: [0.4, 1.1], g: -14, kind: 'spark', col: [225, 210, 255] },
  sparkO: { n: 34, sp: [10, 36], up: 0.4, life: [0.3, 0.7], g: -20, kind: 'spark', col: [255, 150, 50] },
  dragSpark: { n: 5, sp: [6, 20], up: 0.6, life: [0.15, 0.35], g: -20, kind: 'spark', col: [255, 170, 70] },
  carveSpark: { n: 8, sp: [6, 22], up: 0.5, life: [0.15, 0.4], g: -20, kind: 'spark', col: [210, 190, 255] },
  vertSpark: { n: 70, sp: [20, 60], up: 3, life: [0.4, 0.9], g: -30, kind: 'spark', col: [255, 170, 60], vert: true },
  emberCurtain: { n: 110, sp: [8, 32], up: 0.8, life: [0.6, 1.5], g: -6, kind: 'ember' },
  emberJet: { n: 80, sp: [10, 36], up: 0.7, life: [0.6, 1.7], g: -5, kind: 'ember' },
  shard: { n: 22, sp: [6, 22], up: 0.9, life: [0.8, 1.6], g: -30, kind: 'shard', size: [0.2, 0.7] },
  shardBig: { n: 36, sp: [10, 42], up: 0.8, life: [1.0, 2.1], g: -30, kind: 'shard', size: [0.3, 1.8] },
  stepShard: { n: 9, sp: [4, 15], up: 1.4, life: [0.6, 1.2], g: -30, kind: 'shard', size: [0.3, 1.2] },
  spray: { n: 10, sp: [14, 30], up: 0.7, life: [0.6, 1.2], g: -26, kind: 'shard', size: [0.3, 1.4], fwd: 1 },
  boneChip: { n: 12, sp: [6, 20], up: 0.6, life: [0.6, 1.2], g: -28, kind: 'bone', size: [0.2, 0.5] },
  chain: { n: 20, sp: [8, 26], up: 0.6, life: [1.2, 2.2], g: -22, kind: 'chain', size: [0.35, 0.35] },
  snowRing: { n: 26, sp: [14, 26], up: 0.05, life: [1.2, 1.9], g: 0, kind: 'blob', size: [3, 9], flat: 1 },
  smokeCloud: { n: 30, sp: [2, 9], up: 0.3, life: [1.6, 2.2], g: 0, kind: 'blob', size: [6, 16] },
  plume: { n: 32, sp: [4, 22], up: 3, life: [2.0, 3.0], g: 0, kind: 'blob', size: [4, 14], vert: true },
  ghostTear: { n: 46, sp: [4, 18], up: 0.4, life: [0.3, 0.7], g: -4, kind: 'spark', col: [200, 180, 255] },
  boneRain: { n: 14, sp: [2, 8], up: -1, life: [1.2, 1.8], g: -40, kind: 'bigbone', size: [3, 7] },
};

FX.add = function (type, t, p, seed, dir) {
  FX.bursts.push({ type, t, p, seed: seed || (t * 1000 + FX.bursts.length * 13.7), dir: dir || 0, spec: BT[type] });
};

FX.init = function () {
  for (const e of EVENTS) {
    let p;
    if (e.at) p = resolvePoint(e.at, e.t);
    else if (e.tgt) p = resolvePoint(e.tgt, e.t);
    else if (e.bolt) p = resolvePoint(e.bolt, e.t + 0.03);
    else p = soldierPos(e.t);
    e.p = p;
    const S = soldierState(e.t);
    const dir = S.face;
    for (const b of e.burst || []) {
      if (BT[b]) FX.add(b, e.t, p, null, dir);
      else if (b === 'shockwave') FX.rings.push({ t: e.t, p, R: 90, life: 0.7, kind: 'shock' });
      else if (b === 'crackGlow' || b === 'scorch') FX.rings.push({ t: e.t, p, life: 0.5, kind: 'crawl', seed: e.t });
      else if (b === 'split') FX.rings.push({ t: e.t, p, R: 50, life: 0.6, kind: 'shock' });
    }
    if (e.bolt) {
      const S2 = soldierState(e.t);
      FX.bolts.push({ t: e.t, from: soldierSpearTip(S2), to: resolvePoint(e.bolt, e.t + 0.03), seed: e.t * 77 });
      FX.add('sparkV', e.t + 0.03, resolvePoint(e.bolt, e.t + 0.03), null, dir);
    }
  }
  // footfall shards
  for (const f of DECALS.foot) if (!f.big) FX.add('stepShard', f.t, [f.x, 0.3, f.z], f.seed);
  // plates: rise burst + shatter
  for (const pl of PLATES) {
    FX.add('shard', pl.tRise, [pl.x, 1, pl.z], pl.i * 31);
    if (pl.tFall < DURATION) FX.add('shard', pl.tFall + 0.55, [pl.x + pl.fallDir * pl.h * 0.6, 1, pl.z], pl.i * 37);
  }
  // sword drag sparks
  DECALS.groove.forEach((g, i) => { if (i % 3 === 0) FX.add('dragSpark', g.t, [g.x, 0.4, g.z], i * 3.3); });
  // spear carving the ice (15.45 – 16.3)
  for (let t = 15.45; t < 16.3; t += 0.035) { const p = soldierPos(t); FX.add('carveSpark', t, [p[0], 0.3, p[2]], t * 91); }
  // final charge spray (bow wave of shattered plates)
  for (let t = 24.2; t < 26.4; t += 0.06) {
    const K = kingPoseQ(t); const a = kingAnchor(K, 'lclaw');
    FX.add('spray', t, [a[0], 0.5, a[2] + 1], t * 53, K.fv);
  }
  // blocks destroyed
  for (const b of CLUSTER) if (b.destroyT) { const p = blockPos(b, b.destroyT); FX.add('shardBig', b.destroyT, [p[0], p[1], p[2]], b.seed); }
  // bone rain near the lens on collapse
  const K = kingPose(27.6);
  FX.add('boneRain', 27.5, [K.x + 10, 30, K.z - 38], 4242);
};

function burstParticle(b, k, tau) {
  const s = b.spec, sd = b.seed + k * 7.31;
  const life = lerp(s.life[0], s.life[1], rnd(sd + 1));
  if (tau > life) return null;
  const sp = lerp(s.sp[0], s.sp[1], rnd(sd + 2));
  let ang = rnd(sd + 3) * TAU;
  let vx = Math.cos(ang) * sp, vz = Math.sin(ang) * sp * 0.6;
  let vy = (rnd(sd + 4) * 0.8 + s.up) * sp * 0.6;
  if (s.vert) { vx *= 0.25; vz *= 0.25; vy = sp * (0.6 + rnd(sd + 5) * 0.6); }
  if (s.flat) vy = rnd(sd + 6) * 2;
  if (s.fwd) { vx = Math.abs(vx) * b.dir + b.dir * 10; }
  if (s.up < 0) { vx = rnds(sd) * 4; vy = -rnd(sd) * 6; }
  let x = b.p[0] + vx * tau, z = b.p[2] + vz * tau;
  let y = b.p[1] + vy * tau + 0.5 * s.g * tau * tau;
  if (s.kind === 'blob') {
    const drag = 1 - Math.exp(-tau * 2.2);
    x = b.p[0] + vx / 2.2 * drag + 6 * tau; z = b.p[2] + vz / 2.2 * drag; y = b.p[1] + vy / 2.2 * drag + 1.5 * tau;
    if (s.boneRain) y = b.p[1];
  }
  if (s.kind === 'ember') { x += 5 * tau; y += 2 * tau * tau; }
  if (s.kind === 'bigbone') { x = b.p[0] + rnds(sd + 9) * 26 + vx * tau; z = b.p[2] + rnds(sd + 8) * 8; }
  let grounded = false;
  if (y < 0.05 && s.kind !== 'blob') { y = 0.05; grounded = true; }
  return { x, y, z, vx, vy: vy + s.g * tau, vz, life, u: tau / life, sd, grounded };
}

function drawBursts(ctx, t, R) {
  const wt = W(t);
  for (const b of FX.bursts) {
    if (t < b.t) continue;
    const tau = wt - W(b.t);
    if (tau > b.spec.life[1] + 0.05) continue;
    const s = b.spec;
    if (s.kind === 'spark' || s.kind === 'ember') ctx.globalCompositeOperation = R.sil ? 'source-over' : 'lighter';
    for (let k = 0; k < s.n; k++) {
      const q = burstParticle(b, k, tau);
      if (!q) continue;
      const p = proj(q.x, q.y, q.z);
      if (!p || p.d < 1) continue;
      const fade = 1 - q.u;
      switch (s.kind) {
        case 'spark': {
          const L = 0.03 * timeScale(t) + 0.004;
          const p2 = proj(q.x - q.vx * L, q.y - q.vy * L, q.z - q.vz * L);
          if (!p2) break;
          ctx.strokeStyle = R.sil ? PAL.ink : `rgba(${s.col[0]},${s.col[1]},${s.col[2]},${fade})`;
          ctx.lineWidth = clamp(p.s * 0.12, 1, 3.2);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
          break;
        }
        case 'ember': {
          const r = clamp(p.s * 0.22, 1, 5) * (0.6 + 0.4 * Math.sin(t * 40 + k));
          ctx.fillStyle = R.sil ? PAL.ink : `rgba(255,${120 + (k % 5) * 20},40,${fade})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
          break;
        }
        case 'shard': case 'bone': case 'chain': {
          const sz = Math.min(14, lerp(s.size[0], s.size[1], rnd(q.sd + 11)) * p.s);
          if (sz < 0.6) break;
          const rot = q.grounded ? rnd(q.sd) * 6 : tau * (6 + rnd(q.sd + 12) * 10) + q.sd;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rot);
          ctx.globalAlpha = Math.min(1, fade * 2);
          ctx.beginPath();
          if (s.kind === 'chain') ctx.ellipse(0, 0, sz, sz * 0.65, 0, 0, TAU);
          else { ctx.moveTo(-sz, -sz * 0.4); ctx.lineTo(sz * 0.9, -sz * 0.6); ctx.lineTo(sz * 0.2, sz * 0.8); ctx.closePath(); }
          ctx.fillStyle = R.sil ? PAL.ink : s.kind === 'chain' ? PAL.gold : s.kind === 'bone' ? PAL.bone : (k % 3 ? '#dcecf5' : '#9fbfd3');
          ctx.fill();
          if (sz > 2) { ctx.strokeStyle = PAL.ink; ctx.lineWidth = Math.min(2, sz * 0.15); ctx.stroke(); }
          ctx.restore(); ctx.globalAlpha = 1;
          break;
        }
        case 'blob': {
          const r = lerp(s.size[0], s.size[1], rnd(q.sd + 13)) * (0.4 + 0.8 * Math.sqrt(q.u)) * p.s;
          if (R.sil) break;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          const a = 0.55 * Math.sin(Math.PI * Math.min(1, q.u * 1.3 + 0.08));
          g.addColorStop(0, `rgba(232,240,246,${a})`); g.addColorStop(0.6, `rgba(220,230,238,${a * 0.6})`); g.addColorStop(1, 'rgba(220,230,238,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
          break;
        }
        case 'bigbone': {
          const L = lerp(s.size[0], s.size[1], rnd(q.sd + 14)) * p.s;
          const rot = tau * 3 + q.sd;
          const dx = Math.cos(rot) * L / 2, dy = Math.sin(rot) * L / 2;
          ctx.lineCap = 'round';
          ctx.strokeStyle = PAL.ink; ctx.lineWidth = L * 0.22 + 4;
          ctx.beginPath(); ctx.moveTo(p.x - dx, p.y - dy); ctx.lineTo(p.x + dx, p.y + dy); ctx.stroke();
          if (!R.sil) {
            ctx.strokeStyle = k % 4 === 0 ? PAL.gold : '#a9a59c'; ctx.lineWidth = L * 0.22;
            ctx.beginPath(); ctx.moveTo(p.x - dx, p.y - dy); ctx.lineTo(p.x + dx, p.y + dy); ctx.stroke();
          }
          break;
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// continuous ember leak from ribcage gaps and joints
function drawEmberLeak(ctx, t, R) {
  if (R.sil) return;
  const dt = 0.018, wt = W(t);
  ctx.globalCompositeOperation = 'lighter';
  const k1 = Math.floor(t / dt), k0 = Math.max(0, k1 - 90);
  for (let k = k0; k <= k1; k++) {
    const tb = k * dt;
    const K = kingPoseQ(tb);
    if (K.ember <= 0) continue;
    const tau = wt - W(tb);
    const life = 0.9 + rnd(k * 1.3) * 0.9;
    if (tau > life || tau < 0) continue;
    const pick = rnd(k * 2.7);
    const L = K.L;
    let l;
    if (pick < 0.55) l = [L.rib[0] + rnds(k * 3.1) * 6, L.rib[1] + rnds(k * 4.3) * 3];
    else if (pick < 0.7) l = L.elN; else if (pick < 0.8) l = L.knN; else if (pick < 0.9) l = L.neck; else l = v2.lerp(L.haF, L.tip, rnd(k));
    const w = K.w(l);
    const v = [rnds(k * 5.1) * 4 + K.speed * 0.1 * -K.fv, 3 + rnd(k * 6.1) * 7, rnds(k * 7.1) * 3];
    const x = w[0] + v[0] * tau + 6 * tau, y = w[1] + v[1] * tau + 1.5 * tau * tau, z = K.z + v[2] * tau - 2;
    const p = proj(x, y, z); if (!p) continue;
    const u = tau / life;
    const r = clamp(p.s * 0.2, 0.8, 4) * (0.7 + 0.3 * Math.sin(t * 50 + k)) * Math.min(1.4, K.ember);
    ctx.fillStyle = `rgba(255,${130 + (k % 4) * 25},50,${(1 - u) * 0.95})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function jagged(a, b, seed, amp, n) {
  const pts = [a];
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  for (let i = 1; i < n; i++) {
    const u = i / n, o = rnds(seed + i * 3.7) * amp * Math.sin(Math.PI * u) * L;
    pts.push([a[0] + dx * u + nx * o, a[1] + dy * u + ny * o]);
  }
  pts.push(b);
  return pts;
}
function strokeBolt(ctx, pts, w, R) {
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); };
  if (R.sil) { ctx.strokeStyle = PAL.ink; ctx.lineWidth = w * 1.4; path(); ctx.stroke(); return; }
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(155,123,255,0.35)'; ctx.lineWidth = w * 6; path(); ctx.stroke();
  ctx.strokeStyle = 'rgba(217,200,255,0.85)'; ctx.lineWidth = w * 2.2; path(); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = w; path(); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}

function drawBolts(ctx, t, R) {
  for (const b of FX.bolts) {
    const age = t - b.t;
    if (age < 0 || age > 0.16) continue;
    const a = proj(...b.from), c = proj(...b.to);
    if (!a || !c) continue;
    const grow = sat(age / 0.03);
    const end = [lerp(a.x, c.x, grow), lerp(a.y, c.y, grow)];
    const seed = b.seed + Math.floor(t * 45);
    const pts = jagged([a.x, a.y], end, seed, 0.12, 14);
    const w = age < 0.09 ? 2.4 : 2.4 * (1 - (age - 0.09) / 0.07);
    strokeBolt(ctx, pts, Math.max(0.5, w), R);
    for (let k = 0; k < 3; k++) {
      const i0 = 3 + Math.floor(rnd(seed + k) * 8), s = pts[Math.min(i0, pts.length - 1)];
      const e = [s[0] + rnds(seed + k * 5) * 60, s[1] + rnds(seed + k * 9) * 60];
      strokeBolt(ctx, jagged(s, e, seed + k * 11, 0.25, 5), Math.max(0.4, w * 0.45), R);
    }
  }
  // 23.3 — lightning released along the whole plate row
  const ra = t - 23.3;
  if (ra >= 0 && ra < 0.32) {
    const pts = [];
    for (let i = 8; i < PLATES.length; i++) { const p = plateTop(i, t); const q = proj(p[0], p[1] * 0.7, p[2]); if (q) pts.push([q.x, q.y]); }
    if (pts.length > 1) {
      const seed = Math.floor(t * 50);
      const all = [];
      for (let i = 0; i < pts.length - 1; i++) all.push(...jagged(pts[i], pts[i + 1], seed + i * 13, 0.2, 5));
      strokeBolt(ctx, all, 3 * (1 - ra / 0.32) + 0.6, R);
    }
  }
}

function drawRings(ctx, t, R) {
  for (const r of FX.rings) {
    const age = t - r.t;
    if (age < 0 || age > r.life) continue;
    const u = age / r.life;
    if (r.kind === 'shock') {
      const rad = r.R * easeOut(u);
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = i / 48 * TAU, q = proj(r.p[0] + Math.cos(a) * rad, 0.2, r.p[2] + Math.sin(a) * rad);
        if (!q) continue; i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      }
      ctx.strokeStyle = R.sil ? PAL.ink : `rgba(240,248,255,${0.85 * (1 - u)})`;
      const c = proj(r.p[0], 0, r.p[2]);
      ctx.lineWidth = c ? clamp(c.s * 1.2, 2, 14) * (1 - u) + 1 : 3; ctx.stroke();
    } else if (r.kind === 'crawl' && !R.sil) {
      // violet electricity crawling across bone/gold, lighting crack lines
      const c = proj(...r.p); if (!c) continue;
      const seed = Math.floor(t * 40) + r.seed * 10;
      for (let k = 0; k < 5; k++) {
        const L = (2 + 5 * u) * c.s, a0 = rnd(seed + k) * TAU;
        const e = [c.x + Math.cos(a0) * L, c.y + Math.sin(a0) * L];
        strokeBolt(ctx, jagged([c.x, c.y], e, seed + k * 7, 0.35, 6), 1.2 * (1 - u) + 0.4, R);
      }
    }
  }
}

// ── impact frames ─────────────────────────────────────────
function impactAt(t) {
  for (const e of EVENTS) {
    if (!e.fx) continue;
    const a = t - e.t;
    if (e.fx === 'super') {
      if (a >= 0 && a < 0.34) {
        if (a < 0.07) return { kind: 'white', e, a, strength: 1 };
        if (a < 0.17) return { kind: 'sil', e, a };
        if (a < 0.27) return { kind: 'neon', e, a, invertAccent: true };
        return { kind: 'white', e, a, strength: 1 - (a - 0.27) / 0.07 };
      }
    } else {
      const dur = e.fx === 'white' ? 0.05 : 0.06;
      if (a >= 0 && a < dur) return { kind: e.fx, e, a, strength: 1 - a / dur * 0.5 };
    }
  }
  return null;
}

// radial speed lines (集中線) around the strike point
function focusLines(ctx, cx, cy, col, seed, n = 70) {
  const C = CAMERA;
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const a = rnd(seed + i) * TAU, w = 0.004 + rnd(seed + i * 2) * 0.012;
    const r0 = 90 + rnd(seed + i * 3) * 160, r1 = 1600;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a - w) * r1, cy + Math.sin(a - w) * r1);
    ctx.lineTo(cx + Math.cos(a + w) * r1, cy + Math.sin(a + w) * r1);
    ctx.closePath(); ctx.fill();
  }
}
