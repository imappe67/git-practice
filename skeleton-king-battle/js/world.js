'use strict';
// ─────────────────────────────────────────────────────────────
//  World: camera & projection, ice field, plates band, blocks, projectiles, decals, snow
// ─────────────────────────────────────────────────────────────
const CAMERA = { W: 1280, H: 720, f: 640, tx: 0, ty: 0, tz: 0, D: 100, yaw: 0, roll: 0, hY: 300, cy: 10, shx: 0, shy: 0 };

function shakeAt(t) {
  let a = 0;
  for (const e of EVENTS) {
    if (!e.shake || t < e.t || t > e.t + 0.6) continue;
    a += e.shake * Math.exp(-(t - e.t) * 9);
  }
  const q = Math.floor(t * 60);
  return [rnds(q * 1.7) * a, rnds(q * 2.9 + 4) * a];
}

function camTarget(t) {
  const P = kingPoseQ(t), S = soldierPos(t);
  const w = CAM.w.at(t);
  return [lerp(P.x, S[0], w) + CAM.ox.at(t), lerp(13, S[1] + 1, w) + CAM.oy.at(t), lerp(P.z, S[2], w)];
}

function camSetup(t) {
  const C = CAMERA;
  // low-pass the target so the operator "almost keeps up"
  let tx = 0, ty = 0, tz = 0, n = 0;
  for (let i = 0; i < 6; i++) {
    const tt = t - i * 0.025, wgt = 6 - i;
    const p = camTarget(tt);
    tx += p[0] * wgt; ty += p[1] * wgt; tz += p[2] * wgt; n += wgt;
  }
  C.tx = tx / n; C.ty = ty / n; C.tz = tz / n;
  C.D = CAM.D.at(t);
  C.yaw = CAM.yaw.at(t);
  C.roll = CAM.roll.at(t);
  let hY = C.H * CAM.hz.at(t);
  let cy = C.ty + (C.H / 2 - hY) * C.D / C.f;
  if (cy < 0.8) { cy = 0.8; hY = C.H / 2 + C.f * (C.ty - cy) / C.D; }
  C.hY = hY; C.cy = cy;
  const sh = shakeAt(t);
  C.shx = sh[0]; C.shy = sh[1];
  C.camZ = C.tz - C.D;
}

function proj(x, y, z) {
  const C = CAMERA;
  const dx = x - C.tx, dz = z - C.tz;
  const c = Math.cos(C.yaw), s = Math.sin(C.yaw);
  const xr = dx * c - dz * s, zr = dx * s + dz * c;
  const d = zr + C.D;
  if (d < 0.6) return null;
  const k = C.f / d;
  return { x: C.W / 2 + k * xr + C.shx, y: C.hY - k * (y - C.cy) + C.shy, s: k, d, xr };
}

function baseTransform(ctx) {
  const C = CAMERA;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(C.W / 2, C.H / 2); ctx.rotate(C.roll); ctx.translate(-C.W / 2, -C.H / 2);
}
// world metres at depth of (rx, rz) → screen; returns scale or 0 if behind camera
function cardTransform(ctx, rx, rz) {
  const C = CAMERA;
  const p = proj(rx, 0, rz);
  if (!p) return 0;
  baseTransform(ctx);
  ctx.transform(p.s, 0, 0, -p.s, C.W / 2 + p.s * (p.xr - rx) + C.shx, C.hY + p.s * C.cy + C.shy);
  return p.s;
}

// ── ice plate band (raised by the vertical strike at 0:06.2) ──
const BAND = { P0: [-81, 0], d: v2.norm([-0.55, 0.83]), n: 23 };
const PLATES = [];
for (let i = 0; i < BAND.n; i++) {
  const s = 5 + i * 5;
  PLATES.push({
    i, s,
    x: BAND.P0[0] + BAND.d[0] * s + rnds(i * 3.1) * 1.5,
    z: BAND.P0[1] + BAND.d[1] * s + rnds(i * 5.7) * 1.5,
    h: 14 + rnd(i * 1.9) * 8,
    w: 9 + rnd(i * 2.3) * 3,
    lean: -0.3 + rnds(i * 4.4) * 0.2,
    tRise: 6.2 + s / 130,
    tFall: 99, fallDir: 1,
  });
}
(function computePlateFalls() {
  for (const pl of PLATES) {
    for (let t = 6.6; t < DURATION; t += 1 / 60) {
      if (t < pl.tRise + 0.3) continue;
      const P = kingPoseQ(t);
      if (Math.hypot(P.x - pl.x, P.z - pl.z) < 11) { pl.tFall = t; pl.fallDir = P.x > pl.x ? -1 : 1; break; }
    }
    // the lightning released along the row at 0:23.3 brings the rest of the band down
    const tc = 23.36 + pl.i * 0.025;
    if (pl.tFall > tc) { pl.tFall = tc; pl.fallDir = pl.i % 2 ? 1 : -1; }
  }
})();
function plateState(pl, t) {
  if (t < pl.tRise) return null;
  const rise = easeOutBack(sat((t - pl.tRise) / 0.24));
  const f = sat((t - pl.tFall) / 0.55);
  const ang = pl.lean + pl.fallDir * (Math.PI / 2 - 0.15) * easeIn(f);
  return { rise, f, ang, h: pl.h * Math.max(0.02, rise) * (f >= 1 ? 0.35 : 1), broken: f >= 1 };
}
function plateTop(i, t) {
  const pl = PLATES[clamp(i, 0, PLATES.length - 1)];
  const st = plateState(pl, t) || { h: 0.5, ang: pl.lean };
  // plate-local (0, h) rotated counter-clockwise by ang (y-up)
  return [pl.x - Math.sin(st.ang) * st.h, Math.max(0.3, Math.cos(st.ang) * st.h + 0.2), pl.z];
}

// ── scattered ice blocks ──
const BLOCKS = [];
(function genBlocks() {
  let seed = 11;
  for (let i = 0; i < 90; i++) {
    const x = -300 + rnd(seed++) * 420, z = -30 + rnd(seed++) * 230;
    const size = 1.2 + Math.pow(rnd(seed++), 3) * 6.5;
    BLOCKS.push({ x, z, size, seed: seed++, kind: 0 });
  }
  // the cluster the King crashes into (~x -128, z 14)
  const C = [[-124, 10, 4.5], [-129, 16, 5.5], [-134, 12, 4], [-131, 6, 3.5], [-138, 18, 4.5], [-126, 20, 4]];
  C.forEach((c, k) => BLOCKS.push({ x: c[0], z: c[1], size: c[2], seed: 900 + k, kind: 1, ci: k }));
})();
const CLUSTER = BLOCKS.filter(b => b.kind === 1);
CLUSTER[0].destroyT = 15.6; CLUSTER[2].destroyT = 15.62;
// hurled blocks: ci 1,3,4,5 (ci 1 is the one the soldier smashes at 17.55)
const HURL = { t0: 17.15, g: -24 };
function blockPos(b, t) {
  if (!b.hurl || t < HURL.t0) return [b.x, b.size * 0.5, b.z, 0];
  const tau = t - HURL.t0, v = b.hurl;
  const y = Math.max(b.size * 0.4, b.size * 0.5 + v[1] * tau + 0.5 * HURL.g * tau * tau);
  return [b.x + v[0] * tau, y, b.z + v[2] * tau, tau * v[3]];
}

// ── chest armor (torn at 14.72, lands 16.0, hurled 17.15, stepped on 17.85) ──
const ARMOR = {};
function armorState(t) {
  const A = ARMOR;
  if (t < 14.72) return null;
  if (t < 16.0) {
    const tau = t - 14.72, T1 = 1.28;
    const u = tau / T1;
    return { p: [lerp(A.p0[0], A.land[0], u), A.p0[1] + A.vy0 * tau - 15 * tau * tau, lerp(A.p0[2], A.land[2], u)], r: u * TAU * 3 + 0.5 * u };
  }
  if (t < HURL.t0) return { p: A.land.slice(), r: TAU * 3 + 0.5 };
  if (t < 17.85) {
    const u = (t - HURL.t0) / (17.85 - HURL.t0);
    return { p: [lerp(A.land[0], A.step[0], u), lerp(A.land[1], A.step[1], u) + Math.sin(u * Math.PI) * 4, lerp(A.land[2], A.step[2], u)], r: 0.5 + u * TAU * 2 };
  }
  const tau = t - 17.85;
  return { p: [A.step[0] - 22 * tau, Math.max(1.2, A.step[1] - 4 * tau - 18 * tau * tau), A.step[2] + 6 * tau], r: 0.5 + TAU * 2 + tau * 9 };
}

// ── ice slabs flung by the final charge (deflected at 24.8 / 25.3) ──
const SLABS = [
  { t0: 24.3, tc: 24.8, side: -1, seed: 1 },
  { t0: 24.8, tc: 25.3, side: 1, seed: 2 },
  { t0: 25.25, tc: 25.7, side: 0, seed: 3, kick: true },
];
function slabPos(s, t) {
  if (t < s.t0) return null;
  if (t < s.tc) {
    const u = (t - s.t0) / (s.tc - s.t0);
    return [lerp(s.a[0], s.b[0], u), lerp(s.a[1], s.b[1], u) + Math.sin(u * Math.PI) * 5, lerp(s.a[2], s.b[2], u), u * 7];
  }
  const tau = t - s.tc;
  if (tau > 2.5) return null;
  return [s.b[0] + 14 * tau, Math.max(0.6, s.b[1] + 16 * tau - 20 * tau * tau), s.b[2] + s.side * 40 * tau - (s.kick ? 30 * tau : 0), 7 + tau * 12];
}

// ── the spear when it leaves her hand ──
const SPEAR = {};
function spearFree(t) {
  if (t < 26.5) return null;
  if (t < 26.7) {
    const u = (t - 26.5) / 0.2;
    return { p: v2.lerp(SPEAR.a, SPEAR.b, u).concat([lerp(SPEAR.az, SPEAR.bz, u)]), ang: SPEAR.ang };
  }
  const tau = t - 26.7;
  return { p: [SPEAR.b[0] - SPEAR.dir[0] * 34 * tau, SPEAR.b[1] + 26 * tau - 9 * tau * tau, SPEAR.bz - 8 * tau], ang: SPEAR.ang + tau * 16 };
}

// ── generic point resolver used by keys and events ──
function resolvePoint(spec, t) {
  let p;
  if (spec.plate !== undefined) p = plateTop(spec.plate, t);
  else if (spec.block !== undefined) { const b = CLUSTER.find(c => c.hurlIdx === spec.block) || CLUSTER[1]; p = blockPos(b, t); }
  else if (spec.slab !== undefined) { p = slabPos(SLABS[spec.slab], t) || [0, 0, 0]; }
  else if (spec.armor !== undefined) { const a = armorState(t); p = a ? a.p : [0, 0, 0]; }
  else if (spec.a) {
    const P = kingPoseQ(t);
    p = kingAnchor(P, spec.a, spec.u !== undefined ? spec.u : 0.5);
    if (spec.lx) p = [p[0] + spec.lx * P.fv, p[1], p[2]];
  } else p = [0, 0, 0];
  return [p[0] + (spec.dx || 0), p[1] + (spec.dy || 0), p[2] + (spec.dz || 0)];
}

// ── decals precomputed from motion ──
const DECALS = { foot: [], melt: [], groove: [], split: null };

const WORLD = {};
WORLD.init = function () {
  // armor flight
  const P = kingPose(14.72);
  const c = P.w([P.L.knot[0] - 0.4, P.L.knot[1] + 1.4]);
  ARMOR.p0 = [c[0], c[1], P.z - 2.5];
  ARMOR.land = [c[0] + P.fv * 55, 2.6, P.z - 6];
  ARMOR.vy0 = (ARMOR.land[1] - ARMOR.p0[1] + 15 * 1.28 * 1.28) / 1.28;
  const st = soldierPos(17.85);
  ARMOR.step = [st[0], st[1] - 0.9, st[2]];
  // hurled blocks
  const tgt = soldierPos(17.55);
  const hb = [CLUSTER[1], CLUSTER[3], CLUSTER[4], CLUSTER[5]];
  hb.forEach((b, k) => {
    b.hurlIdx = k;
    const T1 = 0.4;
    if (k === 0) {
      b.hurl = [(tgt[0] - b.x) / T1, (tgt[1] - b.size * 0.5 - 0.5 * HURL.g * T1 * T1) / T1, (tgt[2] - b.z) / T1, 6];
      b.destroyT = 17.55;
    } else {
      b.hurl = [-35 - k * 6, 10 + k * 3, -6 + k * 5, 3 + k];
      b.destroyT = 18.4 + k * 0.15;
    }
  });
  // slabs: from king front to soldier contact points
  for (const s of SLABS) {
    const K = kingPose(s.t0);
    const f = kingAnchor(K, 'lclaw');
    s.a = [f[0], 3, f[2] - 1];
    const sp = soldierPos(s.tc);
    s.b = [sp[0] - 1.2, sp[1] + 0.8, sp[2]];
  }
  // spear
  const s0 = soldierPos(26.5), K = kingPose(26.7), core = kingAnchor(K, 'core');
  SPEAR.a = [s0[0], s0[1] + 1.0]; SPEAR.az = s0[2];
  SPEAR.b = [core[0], core[1]]; SPEAR.bz = core[2];
  SPEAR.dir = v2.norm(v2.sub(SPEAR.b, SPEAR.a));
  SPEAR.ang = Math.atan2(SPEAR.dir[1], SPEAR.dir[0]);

  // footfalls
  const hz = 120;
  let prev = null;
  for (let i = 0; i <= DURATION * hz; i++) {
    const t = i / hz, K2 = kingPoseQ(t);
    if (prev) {
      for (const [k, nm] of [['fN', 'lwrist'], ['fF', 'handF'], ['hN', 'footN'], ['hF', 'footF']]) {
        if (K2.contact[k] && !prev.contact[k] && K2.speed > 4) {
          if ((k === 'fN' && K2.cw > 0.2) || (k === 'fF' && K2.sw > 0.2)) continue;
          const a = kingAnchor(K2, nm);
          DECALS.foot.push({ t, x: a[0], z: a[2], r: 4 + rnd(i) * 2, seed: i });
        }
      }
    }
    prev = K2;
    // sword groove
    if (K2.tipGround && t > 0.2) {
      const a = kingAnchor(K2, 'swordTip');
      DECALS.groove.push({ t, x: a[0], z: a[2] });
    }
  }
  // big impact craters
  for (const e of EVENTS) {
    if (e.shake >= 9 && e.at) {
      const a = resolvePoint(e.at, e.t);
      DECALS.foot.push({ t: e.t, x: a[0], z: a[2], r: 6 + e.shake * 0.35, seed: e.t * 100, big: true });
    }
  }
  // melt trail (glass re-freeze) where the streak skims the ice
  for (let i = 0; i <= 28 * 90; i++) {
    const t = i / 90;
    if (HIDDEN.some(h => t >= h[0] && t < h[1])) { DECALS.melt.push(null); continue; }
    const p = soldierPos(t);
    DECALS.melt.push(p[1] < 1.4 ? { t, x: p[0], z: p[2] } : null);
  }
  // the split that runs to the horizon at 26.4
  const tipK = kingPose(26.4), tp = kingAnchor(tipK, 'swordTip');
  DECALS.split = { t: 26.4, x: tp[0], z: tp[2] };
};

// ── drawing: sky & ground ──
function drawSky(ctx, t) {
  const C = CAMERA;
  const g = ctx.createLinearGradient(0, C.hY - C.H * 0.9, 0, C.hY);
  g.addColorStop(0, PAL.skyTop); g.addColorStop(0.6, PAL.skyMid); g.addColorStop(1, PAL.skyLow);
  ctx.fillStyle = g; ctx.fillRect(-C.W, C.hY - C.H * 3, C.W * 3, C.H * 3 + 1);
  // leaden cloud bands with slow parallax
  for (let i = 0; i < 9; i++) {
    const y = C.hY - 30 - Math.pow(i / 9, 1.4) * C.H * 0.75;
    const px = ((rnd(i) * 3000 - C.tx * (0.4 + i * 0.05) * 2 - t * 6 * (i + 1)) % 2600 + 2600) % 2600 - 650;
    ctx.globalAlpha = 0.22 + rnd(i + 9) * 0.18;
    ctx.fillStyle = i % 2 ? '#2a2e36' : '#6f7782';
    ctx.beginPath(); ctx.ellipse(px, y, 380 + rnd(i * 3) * 400, 10 + i * 4, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px - 1300, y, 380 + rnd(i * 3) * 400, 10 + i * 4, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px + 1300, y, 380 + rnd(i * 3) * 400, 10 + i * 4, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGround(ctx, t) {
  const C = CAMERA;
  const g = ctx.createLinearGradient(0, C.hY, 0, C.H * 1.4);
  g.addColorStop(0, '#f1f5f8'); g.addColorStop(0.08, '#e6edf2'); g.addColorStop(0.5, '#c6d3dc'); g.addColorStop(1, '#97aaba');
  ctx.fillStyle = g; ctx.fillRect(-C.W, C.hY, C.W * 3, C.H * 3);
  // horizon haze
  const hz = ctx.createLinearGradient(0, C.hY - 40, 0, C.hY + 30);
  hz.addColorStop(0, 'rgba(200,212,222,0)'); hz.addColorStop(0.55, 'rgba(214,224,232,0.8)'); hz.addColorStop(1, 'rgba(214,224,232,0)');
  ctx.fillStyle = hz; ctx.fillRect(-C.W, C.hY - 40, C.W * 3, 70);
  drawHexField(ctx, t);
}

const HEX = 9;
function hexCorner(cx, cz, i) {
  const a = Math.PI / 6 + i * Math.PI / 3;
  const x = cx + HEX * Math.cos(a), z = cz + HEX * Math.sin(a);
  // shared-vertex jitter keyed on rounded position
  const k = Math.round(x * 10) * 7.31 + Math.round(z * 10) * 3.17;
  return [x + rnds(k) * 1.6, z + rnds(k + 1) * 1.6];
}
function drawHexField(ctx, t) {
  const C = CAMERA;
  const dNear = 3, dFar = 260;
  // visible world bounds (approx, ignoring small yaw)
  const halfW = (C.W * 0.75) / C.f;
  const z0 = C.camZ + dNear, z1 = C.camZ + dFar;
  const xs = [C.tx - halfW * dFar - 40, C.tx + halfW * dFar + 40];
  const sq = Math.sqrt(3) * HEX;
  const r0 = Math.floor(z0 / (1.5 * HEX)) - 1, r1 = Math.ceil(z1 / (1.5 * HEX)) + 1;
  ctx.lineCap = 'round';
  const far = new Path2D(), mid = new Path2D(), near = new Path2D(), hi = new Path2D();
  for (let r = r0; r <= r1; r++) {
    const cz = r * 1.5 * HEX;
    const d = cz - C.camZ;
    if (d < dNear - HEX) continue;
    const hw = halfW * Math.max(d, 1) + 30;
    const q0 = Math.floor((C.tx - hw) / sq - r / 2) - 1, q1 = Math.ceil((C.tx + hw) / sq - r / 2) + 1;
    for (let q = q0; q <= q1; q++) {
      const cx = sq * (q + r / 2);
      if (cx < xs[0] || cx > xs[1]) continue;
      const pts = [];
      for (let i = 0; i < 4; i++) pts.push(hexCorner(cx, cz, i));
      const pp = pts.map(p => proj(p[0], 0, p[1]));
      const path = d > 140 ? far : d > 50 ? mid : near;
      for (let i = 0; i < 3; i++) {
        const a = pp[i], b = pp[i + 1];
        if (!a || !b) continue;
        path.moveTo(a.x, a.y); path.lineTo(b.x, b.y);
        if (d < 50) { hi.moveTo(a.x, a.y + 1.2); hi.lineTo(b.x, b.y + 1.2); }
      }
    }
  }
  ctx.strokeStyle = 'rgba(70,92,115,0.22)'; ctx.lineWidth = 0.7; ctx.stroke(far);
  ctx.strokeStyle = 'rgba(60,82,108,0.34)'; ctx.lineWidth = 1.1; ctx.stroke(mid);
  ctx.strokeStyle = 'rgba(52,74,100,0.45)'; ctx.lineWidth = 1.8; ctx.stroke(near);
  ctx.strokeStyle = 'rgba(240,250,255,0.35)'; ctx.lineWidth = 1.0; ctx.stroke(hi);
}

function groundPoly(ctx, pts) {
  let ok = false;
  ctx.beginPath();
  for (const p of pts) { const q = proj(p[0], 0, p[1]); if (!q) continue; ok ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); ok = true; }
  return ok;
}

function drawDecals(ctx, t) {
  // footfall shatter: radial cracks + deep blue-black ice in the fractures
  for (const f of DECALS.foot) {
    if (t < f.t || t > f.t + 14) continue;
    const age = t - f.t, grow = easeOut(sat(age / 0.12)), fade = 1 - sat((age - 9) / 5);
    const n = f.big ? 9 : 5, R0 = f.r * grow;
    const c = proj(f.x, 0, f.z); if (!c || c.d > 300) continue;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + rnds(f.seed + i) * 0.3;
      const L = R0 * (1 + rnd(f.seed + i * 3) * 0.9);
      const pts = [[f.x, f.z]];
      for (let j = 1; j <= 3; j++) pts.push([f.x + Math.cos(a + rnds(f.seed + i + j) * 0.25) * L * j / 3, f.z + Math.sin(a + rnds(f.seed + i * j) * 0.25) * L * j / 3]);
      if (groundPoly(ctx, pts)) {
        ctx.strokeStyle = `rgba(14,30,52,${0.5 * fade})`; ctx.lineWidth = Math.max(0.8, c.s * 0.16); ctx.stroke();
        ctx.strokeStyle = `rgba(235,248,255,${0.4 * fade})`; ctx.lineWidth = Math.max(0.5, c.s * 0.06); ctx.stroke();
      }
    }
    // shattered core hexagon (deep ice visible)
    const hex = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + f.seed; hex.push([f.x + Math.cos(a) * R0 * 0.45, f.z + Math.sin(a) * R0 * 0.45]); }
    if (groundPoly(ctx, hex)) { ctx.closePath(); ctx.fillStyle = `rgba(22,38,58,${0.55 * fade})`; ctx.fill(); }
  }
  // sword groove: black trench with embers still glowing
  ctx.lineCap = 'round';
  let last = null;
  for (const g of DECALS.groove) {
    if (g.t > t) break;
    if (t - g.t > 12) { last = null; continue; }
    if (last && g.t - last.t < 0.05) {
      const a = proj(last.x, 0, last.z), b = proj(g.x, 0, g.z);
      if (a && b) {
        const age = t - g.t;
        ctx.strokeStyle = 'rgba(16,14,18,0.8)'; ctx.lineWidth = Math.max(1.2, b.s * 0.9);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        const glowA = Math.max(0, 1 - age / 3.5);
        if (glowA > 0) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(255,120,30,${0.8 * glowA})`; ctx.lineWidth = Math.max(0.8, b.s * 0.35);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
    last = g;
  }
  // melt trail: violet lightning crawl → glassy re-frozen streak
  const M = DECALS.melt;
  const iEnd = Math.min(M.length - 1, Math.floor(t * 90));
  const iStart = Math.max(1, iEnd - 90 * 9);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = iStart; i <= iEnd; i++) {
    const m = M[i], pm = M[i - 1];
    if (!m || !pm) continue;
    const a = proj(pm.x, 0, pm.z), b = proj(m.x, 0, m.z);
    if (!a || !b) continue;
    const age = t - m.t;
    const hot = Math.max(0, 1 - age / 0.35);
    const glass = Math.max(0, 1 - age / 9);
    ctx.strokeStyle = `rgba(150,220,255,${0.28 * glass})`; ctx.lineWidth = Math.max(1, b.s * 0.7);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    if (hot > 0) {
      ctx.strokeStyle = `rgba(210,190,255,${0.9 * hot})`; ctx.lineWidth = Math.max(1.5, b.s * 0.5);
      const jx = rnds(i + Math.floor(t * 40)) * b.s * 0.8, jy = rnds(i * 3 + Math.floor(t * 40)) * b.s * 0.25;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo((a.x + b.x) / 2 + jx, (a.y + b.y) / 2 + jy); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // final split
  const S = DECALS.split;
  if (S && t > S.t) {
    const L = Math.min(2000, (t - S.t) * 1400);
    const pts = [];
    for (let i = 0; i <= 60; i++) { const u = i / 60; pts.push([S.x + rnds(i * 7.7) * 2.5 * (1 + u * 4), S.z - 4 + u * L]); }
    if (groundPoly(ctx, pts)) {
      ctx.strokeStyle = 'rgba(10,22,40,0.9)'; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = 'rgba(120,200,255,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    const pts2 = [];
    for (let i = 0; i <= 30; i++) { const u = i / 30; pts2.push([S.x - u * 140 + rnds(i * 3.3) * 2, S.z + rnds(i * 9.1) * 2]); }
    if (groundPoly(ctx, pts2)) { ctx.strokeStyle = 'rgba(10,22,40,0.8)'; ctx.lineWidth = 3; ctx.stroke(); }
  }
}

// glossy ice reflections: vertical streaks under glowing things
function drawReflections(ctx, t, K, S) {
  ctx.globalCompositeOperation = 'lighter';
  const streak = (x, y, z, col, a, wM) => {
    const g0 = proj(x, 0, z), g1 = proj(x, -y * 0.9, z);
    if (!g0 || !g1) return;
    const w = Math.max(2, wM * g0.s);
    for (let i = 0; i < 5; i++) {
      const ox = rnds(i * 3.1 + 1) * w;
      const gr = ctx.createLinearGradient(0, g0.y, 0, g1.y);
      gr.addColorStop(0, col.replace('A', (a * (0.6 + 0.4 * rnd(i))).toFixed(3))); gr.addColorStop(1, col.replace('A', '0'));
      ctx.fillStyle = gr;
      ctx.fillRect(g0.x + ox - w * 0.12, g0.y, w * 0.24, g1.y - g0.y);
    }
  };
  if (K.ember > 0) {
    const core = kingAnchor(K, 'core');
    streak(core[0], core[1] + 2, K.z, 'rgba(255,120,40,A)', 0.3 * Math.min(1, K.ember), 6);
    const e = kingAnchor(K, 'eye');
    streak(e[0], e[1], K.z, 'rgba(255,90,40,A)', 0.18, 2);
  }
  if (!S.hidden) streak(S.p[0], Math.max(1.5, S.p[1]), S.p[2], 'rgba(200,180,255,A)', 0.55 * (S.p[1] < 4 ? 1 : 0.4), 1.5);
  ctx.globalCompositeOperation = 'source-over';
}

// ── ice blocks & plates (sorted drawables) ──
function iceChunk(ctx, s, size, seed, rough, R) {
  // drawn in card space centred at block base
  const pts = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (i / (n - 1));
    const r = size * (0.5 + rnd(seed + i) * 0.25 * rough);
    pts.push([Math.cos(a) * r * 1.1, Math.sin(a) * r * 0.95]);
  }
  polyFill(ctx, pts, '#c7dbe6', R);
  if (R.sil) return;
  // cel shadow side + deep ice core
  ctx.save(); ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts) ctx.lineTo(...p); ctx.closePath(); ctx.clip();
  ctx.fillStyle = '#7f9db2'; ctx.beginPath(); ctx.moveTo(size * 0.1, 0); ctx.lineTo(size * 1.2, 0); ctx.lineTo(size * 0.5, size); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(25,45,72,0.55)'; ctx.beginPath(); ctx.moveTo(-size * 0.2, 0); ctx.lineTo(size * 0.25, size * 0.35); ctx.lineTo(size * 0.05, 0); ctx.fill();
  // snow cap
  ctx.fillStyle = '#f4f8fb';
  ctx.beginPath();
  for (let i = 1; i < n - 1; i++) { const p = pts[i]; i === 1 ? ctx.moveTo(p[0], p[1] - size * 0.12) : ctx.lineTo(p[0], p[1] - size * 0.12); }
  for (let i = n - 2; i >= 1; i--) { const p = pts[i]; ctx.lineTo(p[0], p[1] + 0.02); }
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = R.ol * 1.4;
  ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts) ctx.lineTo(...p); ctx.stroke();
}

function drawPlate(ctx, pl, st, R) {
  ctx.save();
  ctx.translate(pl.x, 0);
  if (st.broken) {
    // rubble
    for (let k = 0; k < 3; k++) {
      ctx.save(); ctx.translate((k - 1) * pl.w * 0.5 * pl.fallDir + pl.fallDir * pl.h * 0.4, 0);
      iceChunk(ctx, 1, pl.w * 0.22, pl.i * 10 + k, 1.4, R); ctx.restore();
    }
    ctx.restore(); return;
  }
  ctx.rotate(st.ang);
  const w = pl.w, h = st.h;
  const face = [[-w / 2, -1], [-w * 0.56, h * 0.7], [-w * 0.2, h], [w * 0.32, h * 0.94], [w / 2, h * 0.58], [w * 0.5, -1]];
  const side = face.map(p => [p[0] + 1.2, p[1] - 0.4]);
  polyFill(ctx, side, '#5f7f99', R);
  polyFill(ctx, face, '#d3e4ee', R);
  if (!R.sil) {
    // blue-black deep ice cross-section along the fractured top
    ctx.fillStyle = PAL.iceDeep;
    ctx.beginPath(); ctx.moveTo(-w * 0.56, h * 0.7); ctx.lineTo(-w * 0.2, h); ctx.lineTo(w * 0.32, h * 0.94); ctx.lineTo(w * 0.28, h * 0.84); ctx.lineTo(-w * 0.2, h * 0.88); ctx.lineTo(-w * 0.48, h * 0.62); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(-w * 0.35, h * 0.1); ctx.lineTo(-w * 0.25, h * 0.75); ctx.lineTo(-w * 0.18, h * 0.72); ctx.lineTo(-w * 0.28, h * 0.1); ctx.fill();
    ctx.strokeStyle = 'rgba(30,60,90,0.5)'; ctx.lineWidth = R.ol;
    ctx.beginPath(); ctx.moveTo(-w * 0.1, h * 0.2); ctx.lineTo(w * 0.1, h * 0.55); ctx.lineTo(w * 0.05, h * 0.8); ctx.stroke();
  }
  ctx.restore();
}

function drawSnow(ctx, t) {
  const C = CAMERA, wt = W(t);
  ctx.lineCap = 'round';
  const N = 520;
  for (let i = 0; i < N; i++) {
    const zr = 2.5 + Math.pow(rnd(i * 1.3), 1.6) * 160;
    const z = C.camZ + zr;
    const span = zr * C.W / C.f * 1.4 + 30;
    const v = 24 + rnd(i * 2.1) * 18;
    const x0 = rnd(i * 3.7) * 4000;
    const x = C.tx + ((((x0 + v * wt - C.tx) % span) + span) % span) - span / 2;
    const y = Math.pow(rnd(i * 5.3), 2.2) * 9 + Math.sin(wt * 3 + i) * 0.3;
    const p = proj(x, y, z);
    if (!p || p.x < -40 || p.x > C.W + 40) continue;
    const L = Math.max(1.5, v * 0.03 * p.s * timeScale(t));
    const a = clamp(1.2 - zr / 160, 0.15, 0.85);
    ctx.strokeStyle = `rgba(236,244,250,${a})`;
    ctx.lineWidth = clamp(p.s * 0.07, 0.6, 3.5);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - L, p.y + L * 0.04); ctx.stroke();
  }
  // low ground-hugging drift sheets
  for (let i = 0; i < 14; i++) {
    const zr = 8 + rnd(i * 7.7) * 120, z = C.camZ + zr;
    const span = zr * C.W / C.f * 1.6 + 60;
    const x = C.tx + ((((rnd(i) * 3000 + 30 * wt - C.tx) % span) + span) % span) - span / 2;
    const p = proj(x, 0.6, z); if (!p) continue;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18 * p.s);
    g.addColorStop(0, 'rgba(235,242,248,0.28)'); g.addColorStop(1, 'rgba(235,242,248,0)');
    ctx.fillStyle = g;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.18); ctx.translate(-p.x, -p.y);
    ctx.beginPath(); ctx.arc(p.x, p.y, 18 * p.s, 0, TAU); ctx.fill(); ctx.restore();
  }
}
