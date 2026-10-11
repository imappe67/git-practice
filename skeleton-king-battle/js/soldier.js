'use strict';
// ─────────────────────────────────────────────────────────────
//  Subject B — the magic soldier. Path, streak <-> sharp form, poses, drawing.
// ─────────────────────────────────────────────────────────────
const SOL = {};

function resolveKey(spec, t) {
  if (Array.isArray(spec)) return spec;
  return resolvePoint(spec, t);
}

function soldierPos(t) {
  const k = SOLDIER_KEYS, n = k.length;
  if (t <= k[0][0]) return resolveKey(k[0][1], t).slice();
  if (t >= k[n - 1][0]) {
    const p = resolveKey(k[n - 1][1], t);
    const q = resolveKey(k[n - 2][1], t);
    const dt = k[n - 1][0] - k[n - 2][0];
    const e = t - k[n - 1][0];
    return [p[0] + (p[0] - q[0]) / dt * e, p[1], p[2] + (p[2] - q[2]) / dt * e];
  }
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (k[m][0] <= t) lo = m; else hi = m; }
  const i = lo;
  const t0 = k[i][0], t1 = k[i + 1][0], h = t1 - t0, u = (t - t0) / h;
  const p0 = resolveKey(k[i][1], t), p1 = resolveKey(k[i + 1][1], t);
  const pm = i > 0 ? resolveKey(k[i - 1][1], t) : null, tm = i > 0 ? k[i - 1][0] : t0;
  const pp = i + 2 < n ? resolveKey(k[i + 2][1], t) : null, tp = i + 2 < n ? k[i + 2][0] : t1;
  const u2 = u * u, u3 = u2 * u;
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const m0 = pm ? (p1[c] - pm[c]) / (t1 - tm) : (p1[c] - p0[c]) / h;
    const m1 = pp ? (pp[c] - p0[c]) / (tp - t0) : (p1[c] - p0[c]) / h;
    out[c] = (2 * u3 - 3 * u2 + 1) * p0[c] + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * p1[c] + (u3 - u2) * h * m1;
  }
  out[1] = Math.max(out[1], 0.25);
  return out;
}

const POSES = {
  thrust: { lean: 0.55, thF: 0.9, kbF: 0.5, thB: -0.9, kbB: 0.3, grip: [0.45, 0.55], ext: 1.25 },
  cast: { lean: 0.3, thF: 0.5, kbF: 0.4, thB: -0.6, kbB: 0.5, grip: [0.38, 0.62], ext: 0.95 },
  butt: { lean: 0.4, thF: 0.7, kbF: 0.6, thB: -0.8, kbB: 0.4, grip: [0.3, 0.5], ext: 1.0, rev: 1 },
  sweep: { lean: 0.45, thF: 1.0, kbF: 0.8, thB: -0.5, kbB: 0.9, grip: [0.4, 0.55], ext: 1.0, off: -0.55, slash: 1 },
  kick: { lean: -0.2, thF: 1.5, kbF: 0.05, thB: -0.3, kbB: 1.2, grip: [-0.15, 0.6], ext: 0.6, aim: 2.7 },
  land: { lean: 0.5, thF: 1.3, kbF: 1.9, thB: -0.4, kbB: 1.6, grip: [0.3, 0.35], ext: 0.8, aim: 0.1 },
  run: { lean: 0.6, thF: 0.8, kbF: 0.7, thB: -0.7, kbB: 1.0, grip: [0.2, 0.45], ext: 0.7, aim: -0.25 },
  dive: { lean: 2.5, thF: -0.2, kbF: 0.3, thB: -0.6, kbB: 0.4, grip: [0.35, 0.45], ext: 1.2 },
  throw: { lean: 0.15, thF: 1.0, kbF: 0.4, thB: -1.0, kbB: 0.2, grip: [0.6, 0.95], ext: 0.8 },
  leap: { lean: 0.35, thF: 0.9, kbF: 1.4, thB: -0.3, kbB: 1.0, grip: [0.25, 0.5], ext: 0.7, aim: 0.4 },
  slide: { lean: 0.1, thF: 0.6, kbF: 0.9, thB: -0.2, kbB: 1.2, grip: [0.3, 0.4], ext: 0.9, rev: 1, aim: 1.6 },
  spin: { lean: 0.9, thF: 1.4, kbF: 2.0, thB: 0.6, kbB: 2.0, grip: [0.25, 0.45], ext: 0.7, aim: 0.5 },
  charge: { lean: -0.35, thF: 0.4, kbF: 0.9, thB: -0.5, kbB: 0.8, grip: [0.05, 0.95], ext: 0.8, aim: -1.25 },
};
function blendPose(a, b, u) {
  const o = {};
  for (const key of ['lean', 'thF', 'kbF', 'thB', 'kbB', 'ext']) o[key] = lerp(a[key] || 0, b[key] || 0, u);
  o.grip = v2.lerp(a.grip, b.grip, u);
  o.aim = (a.aim !== undefined && b.aim !== undefined) ? lerp(a.aim, b.aim, u) : (u < 0.5 ? a.aim : b.aim);
  o.rev = u < 0.5 ? a.rev : b.rev;
  o.off = lerp(a.off || 0, b.off || 0, u);
  o.slash = u < 0.5 ? a.slash : b.slash;
  return o;
}

const SLOW_POSES = [[11.62, 'leap'], [12.75, 'slide'], [13.35, 'spin'], [13.95, 'charge'], [14.34, 'dive']];

function soldierState(t) {
  const S = { t };
  S.p = soldierPos(t);
  const a = soldierPos(t - 0.012), b = soldierPos(t + 0.012);
  S.v = [(b[0] - a[0]) / 0.024, (b[1] - a[1]) / 0.024, (b[2] - a[2]) / 0.024];
  S.speed = Math.hypot(S.v[0], S.v[1], S.v[2]);
  S.hidden = HIDDEN.some(h => t >= h[0] && t < h[1]) || t >= 28;
  S.solid = false; S.pose = null; S.tgt = null;
  for (const e of EVENTS) {
    if (e.pose && t >= e.t - 0.035 && t < e.t + 0.1) {
      S.solid = true; S.pose = POSES[e.pose] || POSES.run; S.poseName = e.pose; S.ev = e;
      const ts = e.tgt || e.bolt;
      if (ts) S.tgt = resolvePoint(ts, e.t);
      break;
    }
  }
  for (const w of SOLID_WINDOWS) {
    if (t >= w[0] && t < w[1]) {
      S.solid = true;
      let i = 0; while (i + 1 < SLOW_POSES.length && t >= SLOW_POSES[i + 1][0]) i++;
      const cur = POSES[SLOW_POSES[i][1]];
      const nxt = SLOW_POSES[i + 1];
      if (nxt) {
        const u = smooth(ramp(t, nxt[0] - 0.18, nxt[0]));
        S.pose = blendPose(cur, POSES[nxt[1]], u);
      } else S.pose = cur;
      S.poseName = SLOW_POSES[i][1];
      S.slowSpin = S.poseName === 'spin' ? (t - 13.35) / 0.6 * TAU : 0;
      if (S.poseName === 'dive' || S.poseName === 'charge') S.tgt = resolvePoint({ a: 'knot' }, t);
    }
  }
  // facing: toward target when striking, else along velocity
  let fx = S.tgt ? S.tgt[0] - S.p[0] : S.v[0];
  if (Math.abs(fx) < 0.5) {
    const c = soldierPos(t - 0.15), d = soldierPos(t + 0.05);
    fx = d[0] - c[0];
  }
  S.face = fx < 0 ? -1 : 1;
  if (t >= 11.62 && t < 14.42) S.face = -1;
  return S;
}

// spear world-space tip (for bolts) — approximate
function soldierSpearTip(S) {
  const tg = S.tgt || [S.p[0] + S.face * 5, S.p[1], S.p[2]];
  const d = v2.norm([tg[0] - S.p[0], tg[1] - S.p[1]]);
  return [S.p[0] + d[0] * 2.0, S.p[1] + 0.5 + d[1] * 2.0, S.p[2]];
}

// ── drawing (side view, local metres, origin = hips, facing +x) ──
function iridescent(ctx, a, b) {
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  g.addColorStop(0, '#9fb6c8'); g.addColorStop(0.25, '#c9a6ff'); g.addColorStop(0.5, '#8ff0e0');
  g.addColorStop(0.75, '#ffd98a'); g.addColorStop(1, '#ff9fd4');
  return g;
}

function drawSoldierFigure(ctx, S, R, opts = {}) {
  const t = S.t, pose = S.pose || POSES.run, ol = R.ol;
  const sil = R.sil;
  const ink = PAL.ink;
  const col = (c) => (sil ? ink : (opts.tint || c));
  const face = S.face;
  // aim angle in local (mirrored) space
  let aim = pose.aim !== undefined ? pose.aim : 0;
  if (S.tgt && pose.aim === undefined) {
    const dx = (S.tgt[0] - S.p[0]) * face, dy = S.tgt[1] - (S.p[1] + 0.5);
    aim = Math.atan2(dy, dx);
  }
  aim += pose.off || 0;
  if (pose.rev) aim += Math.PI;

  ctx.save();
  if (S.slowSpin) ctx.rotate(-S.slowSpin);
  const lean = pose.lean;
  const up = [Math.sin(lean), Math.cos(lean)];
  const hip = [0, 0];
  const sh = v2.add(hip, v2.mul(up, 0.6));
  const head = v2.add(hip, v2.mul(up, 0.84));
  const leg = (th, kb) => {
    const k = [hip[0] + Math.sin(th) * 0.44, hip[1] - Math.cos(th) * 0.44];
    const a = [k[0] + Math.sin(th - kb) * 0.45, k[1] - Math.cos(th - kb) * 0.45];
    return [k, a];
  };
  let thF = pose.thF, thB = pose.thB;
  if (S.poseName === 'run') { const c = Math.sin(t * 28); thF = 0.2 + c * 0.9; thB = 0.2 - c * 0.9; }
  const [kF, aF] = leg(thF, pose.kbF), [kB, aB] = leg(thB, pose.kbB);
  const grip = v2.add(sh, v2.rot([pose.grip[0], pose.grip[1] - 0.6], 0));
  const sd = [Math.cos(aim), Math.sin(aim)];
  const ext = pose.ext;
  const spTip = v2.add(grip, v2.mul(sd, pose.rev ? -0.8 : 1.5 * ext));
  const spButt = v2.add(grip, v2.mul(sd, pose.rev ? 1.6 * ext : -0.9));
  const handF = v2.add(grip, v2.mul(sd, pose.rev ? -0.1 : 0.15));
  const handB = v2.add(grip, v2.mul(sd, pose.rev ? 0.45 : -0.4));
  const armF = ik2(sh, handF, 0.3, 0.3, 1), armB = ik2([sh[0] - 0.05, sh[1]], handB, 0.3, 0.3, 1);
  const vel = [S.v[0] * face, S.v[1]];
  const flow = clamp(Math.hypot(vel[0], vel[1]) / 25, 0.25, 1);
  const back = v2.norm([-vel[0] - 1, -vel[1] * 0.3 + 0.2]);

  const stroke = (pts, w, c) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = ink; ctx.lineWidth = w + ol * 2; KDRAW.line(ctx, pts);
    if (sil) return;
    ctx.strokeStyle = col(c); ctx.lineWidth = w; KDRAW.line(ctx, pts);
  };
  // long black hair streaming behind
  const hairPts = [v2.add(head, [-0.04, 0.12])];
  for (let i = 1; i <= 6; i++) {
    const w = Math.sin(t * 30 + i * 1.2) * 0.04 * i * flow;
    hairPts.push(v2.add(head, [back[0] * i * 0.16 * (0.6 + flow) + w, back[1] * i * 0.16 + 0.06 - i * 0.03 * (1 - flow) + w]));
  }
  const hairPoly = hairPts.concat(hairPts.slice().reverse().map((p, i) => v2.add(p, [0.02, -0.1 - (6 - i) * 0.008])));
  polyFill(ctx, hairPoly, PAL.hair, R);

  // back limbs (shaded)
  stroke([hip, kB, aB], 0.13, '#1a1a22');
  stroke([v2.lerp(kB, aB, 0.5), aB, v2.add(aB, [0.14, -0.02])], 0.13, '#aaa4b0');
  stroke([sh, armB.j, armB.end], 0.1, PAL.coatSh);

  // spear (behind front arm)
  if (!opts.noSpear) {
    // pale wooden shaft, brown cord below the head, black wrap at the butt (ref: Image 2)
    stroke([spButt, spTip], 0.05, PAL.shaft);
    if (!sil) {
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#6a4a3e'; ctx.lineWidth = 0.06; KDRAW.line(ctx, [v2.lerp(spButt, spTip, 0.74), v2.lerp(spButt, spTip, 0.88)]);
      ctx.strokeStyle = '#1b1820'; ctx.lineWidth = 0.06; KDRAW.line(ctx, [v2.lerp(spButt, spTip, 0.04), v2.lerp(spButt, spTip, 0.16)]);
      ctx.lineCap = 'round';
    }
    const head0 = spTip;
    const hd = v2.norm(v2.sub(spTip, spButt)), hn = [-hd[1], hd[0]];
    // crossbar lugs
    stroke([v2.add(head0, v2.mul(hn, 0.16)), v2.sub(head0, v2.mul(hn, 0.16))], 0.035, '#a9b0c4');
    const blade = [v2.add(head0, v2.mul(hn, 0.06)), v2.add(v2.add(head0, v2.mul(hd, 0.28)), v2.mul(hn, 0.08)), v2.add(head0, v2.mul(hd, 0.62)),
      v2.sub(v2.add(head0, v2.mul(hd, 0.28)), v2.mul(hn, 0.08)), v2.sub(head0, v2.mul(hn, 0.06))];
    ctx.beginPath(); ctx.moveTo(...blade[0]); for (const p of blade) ctx.lineTo(...p); ctx.closePath();
    ctx.fillStyle = sil ? ink : iridescent(ctx, head0, blade[2]); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = ol * 1.4; ctx.stroke();
    // butt spike
    const bs = [v2.add(spButt, v2.mul(hn, 0.03)), v2.sub(spButt, v2.mul(hd, 0.14)), v2.sub(spButt, v2.mul(hn, 0.03))];
    ctx.beginPath(); ctx.moveTo(...bs[0]); ctx.lineTo(...bs[1]); ctx.lineTo(...bs[2]); ctx.closePath();
    ctx.fillStyle = sil ? ink : '#8f7bb8'; ctx.fill(); ctx.stroke();
  }

  // coat body (white quilted coat + frayed surcoat)
  const hemBack = v2.add(hip, [-0.25 - flow * 0.35, -0.42 + flow * 0.12]);
  const hemFront = v2.add(hip, [0.18, -0.4]);
  const body = [v2.add(sh, [-0.14, 0.06]), v2.add(sh, [0.14, 0.02]), v2.add(hip, [0.16, 0]), hemFront, hemBack, v2.add(hip, [-0.18, 0.02])];
  polyFill(ctx, body, PAL.coat, R);
  if (!sil) {
    // quilting stitches + cel shadow
    ctx.strokeStyle = 'rgba(120,128,140,0.7)'; ctx.lineWidth = ol * 0.6;
    for (let i = 1; i < 4; i++) KDRAW.line(ctx, [v2.lerp(body[0], body[5], i / 4), v2.lerp(body[1], body[2], i / 4)]);
    polyFill(ctx, [v2.add(hip, [-0.18, 0.02]), v2.add(hip, [0.0, 0.0]), v2.lerp(hemFront, hemBack, 0.5), hemBack], PAL.coatSh, R, false);
    // frayed surcoat hem
    ctx.fillStyle = PAL.surcoat; ctx.strokeStyle = ink; ctx.lineWidth = ol;
    ctx.beginPath(); ctx.moveTo(...v2.add(hip, [0.14, 0.04]));
    for (let i = 0; i <= 6; i++) {
      const p = v2.lerp(hemFront, hemBack, i / 6);
      ctx.lineTo(p[0], p[1] - (i % 2) * 0.07 + Math.sin(t * 40 + i) * 0.015);
    }
    ctx.lineTo(...v2.add(hip, [-0.16, 0.06])); ctx.closePath(); ctx.fill(); ctx.stroke();
    // two brown belts
    ctx.strokeStyle = '#7a4a26'; ctx.lineWidth = 0.035;
    KDRAW.line(ctx, [v2.add(hip, [-0.17, 0.06]), v2.add(hip, [0.16, 0.05])]);
    KDRAW.line(ctx, [v2.add(hip, [-0.16, -0.02]), v2.add(hip, [0.17, -0.05])]);
  }
  // thick collar + iridescent gorget
  const neck = v2.add(hip, v2.mul(up, 0.66));
  polyFill(ctx, [v2.add(neck, [-0.08, -0.04]), v2.add(neck, [-0.1, 0.13]), v2.add(neck, [-0.02, 0.15]), v2.add(neck, [0.0, -0.02])], PAL.coat, R);
  ctx.beginPath(); ctx.arc(neck[0] + 0.03, neck[1] + 0.06, 0.035, 0, TAU); ctx.fillStyle = sil ? ink : '#1b1820'; ctx.fill();
  ctx.beginPath(); ctx.arc(neck[0], neck[1], 0.08, 0, TAU);
  ctx.fillStyle = sil ? ink : iridescent(ctx, v2.add(neck, [-0.08, 0]), v2.add(neck, [0.08, 0])); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = ol; ctx.stroke();
  // head: pale skin, black hair cap, violet eye
  ctx.beginPath(); ctx.arc(head[0], head[1], 0.11, 0, TAU);
  ctx.fillStyle = col(PAL.skin); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = ol * 1.2; ctx.stroke();
  if (!sil) {
    ctx.fillStyle = PAL.hair;
    ctx.beginPath(); ctx.arc(head[0] - 0.02, head[1] + 0.02, 0.115, Math.PI * 0.15 + lean * 0, Math.PI * 1.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d9ccf5';
    ctx.fillRect(head[0] + 0.045, head[1] + 0.005, 0.035, 0.014);
  }
  // front leg: black tights, metal knee, white scuffed boot
  stroke([hip, kF, aF], 0.14, '#16161e');
  if (!sil) { ctx.beginPath(); ctx.arc(kF[0], kF[1], 0.06, 0, TAU); ctx.fillStyle = iridescent(ctx, v2.add(kF, [-0.06, 0]), v2.add(kF, [0.06, 0])); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = ol; ctx.stroke(); }
  stroke([v2.lerp(kF, aF, 0.5), aF, v2.add(aF, [0.15, -0.02])], 0.15, PAL.boot);
  // front arm: white sleeve + mechanical gauntlet
  stroke([sh, armF.j], 0.15, PAL.coat);
  stroke([armF.j, armF.end], 0.12, '#aab2c4');
  if (!sil) { ctx.strokeStyle = '#c9a6ff'; ctx.lineWidth = 0.02; KDRAW.line(ctx, [v2.lerp(armF.j, armF.end, 0.3), v2.lerp(armF.j, armF.end, 0.8)]); }
  // round black patch on the left sleeve
  if (!sil) { const m = v2.lerp(sh, armF.j, 0.45); ctx.fillStyle = ink; ctx.fillRect(m[0] - 0.035, m[1] - 0.04, 0.07, 0.08); }
  ctx.restore();
  return { tip: spTip, butt: spButt };
}
