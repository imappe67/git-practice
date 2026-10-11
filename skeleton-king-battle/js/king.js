'use strict';
// ─────────────────────────────────────────────────────────────
//  Subject A — the Skeleton King (50 m). Choreography + rig + cel drawing.
//  Local space: +x = forward (toward the skull), +y = up, metres.
// ─────────────────────────────────────────────────────────────
const KING = {};

KING.tr = {
  x: T([[0, -75], [0.6, -50], [1.2, -18], [1.6, -8], [2.1, -4], [2.6, -8], [2.8, -10], [3.3, -26],
    [4.0, -32], [4.8, -40], [5.4, -44], [6.2, -46], [6.8, -52], [7.2, -60], [8.0, -82], [8.6, -90],
    [9.6, -95], [10.8, -99], [11.7, -100], [14.4, -101.5], [14.8, -103], [15.6, -112], [16.2, -115],
    [17.2, -120], [18.0, -128], [18.6, -136], [19.2, -142], [19.8, -130], [20.4, -116], [21.2, -121],
    [22.0, -126], [22.8, -131], [23.4, -136], [23.9, -140], [24.4, -133], [25.2, -121], [26.0, -109],
    [26.5, -101], [27.0, -94], [27.8, -88], [30, -87]]),
  z: T([[0, 0], [7.2, 0], [8.0, 8], [8.6, 12], [9.6, 14], [11, 15], [14.4, 15.5], [15.6, 14], [17.2, 14],
    [19.2, 14], [19.8, 32], [20.4, 50], [21.2, 58], [22.0, 66], [22.8, 75], [23.4, 83], [23.9, 85], [30, 85]]),
  face: T([[0, 1], [1.6, 1], [2.15, -1], [23.4, -1], [23.9, 1], [30, 1]], 'ease'),
  spin: T([[0, 0], [16.3, 0], [17.2, TAU], [30, TAU]], 'ease'),
  dip: T([[0, 0.3], [1.0, 0.2], [2.6, 0.1], [2.8, 1], [3.3, 1], [3.6, 0.3], [6.0, 0.1], [7.2, 0.4],
    [8.6, 0.3], [10.8, 0.2], [14.7, 0.2], [15.2, 0.8], [15.8, 0.6], [16.3, 0.3], [18, 0.4], [24.0, 0.5],
    [24.4, 1], [26.4, 1], [26.8, 0.6], [30, 0.6]], 'ease'),
  pitch: T([[0, 0], [14.7, 0], [15.2, -0.15], [15.6, -0.25], [16.1, 0], [26.7, 0], [27.4, -0.12],
    [27.9, -0.3], [30, -0.3]], 'ease'),
  collapse: T([[0, 0], [26.75, 0], [27.9, 1], [30, 1]], 'ease'),
  ember: T([[0, 1], [14.72, 1], [14.76, 1.5], [15.5, 1.15], [26.7, 1.25], [26.74, 1.8], [26.8, 0], [30, 0]], 'lin'),
  jaw: T([[0, 0.2], [1.2, 0.8], [1.5, 0.2], [2.9, 1], [3.3, 0.3], [6.1, 1], [6.4, 0.3], [9.7, 1],
    [10.2, 0.3], [14.8, 1], [15.4, 0.4], [17.1, 0.9], [17.4, 0.3], [24.4, 1], [26.4, 1], [26.8, 0.1], [30, 0.1]], 'ease'),
  // sword arm (far / right hand) — attack weight, hand target (local), blade angle, foreshortening
  sw: T([[0, 0], [1.45, 0], [1.6, 1], [2.45, 1], [2.7, 0], [5.2, 0], [5.3, 1], [15.8, 1], [16.1, 0], [16.25, 0],
    [16.4, 1], [17.4, 1], [17.7, 0], [18.0, 0], [18.15, 1], [18.45, 1], [18.6, 0], [20.1, 0], [20.25, 1],
    [20.7, 1], [20.85, 0], [21.2, 0], [21.35, 1], [21.75, 1], [21.9, 0], [22.25, 0], [22.4, 1], [22.8, 1],
    [23.0, 0], [23.9, 0], [24.2, 1], [26.9, 1], [27.3, 0], [30, 0]], 'ease'),
  sx: T([[1.6, -4], [1.9, 4], [2.25, 16], [2.45, 18], [5.3, 14], [5.6, 6], [5.9, 6], [6.05, 14], [6.2, 17],
    [6.6, 15], [8.6, 14], [10.8, 14], [11.5, 0], [11.7, -2], [13.4, -1], [14.4, -1], [14.8, 4], [15.4, -6],
    [16.4, -6], [16.9, 0], [17.1, 16], [17.3, 18], [18.15, 14], [18.45, 14], [20.25, 6], [20.5, 20], [20.7, 18],
    [21.35, 4], [21.6, 22], [21.75, 20], [22.4, 2], [22.65, 22], [22.8, 20], [24.2, 8], [26.0, 8], [26.2, 14],
    [26.4, 17], [26.9, 17]]),
  sy: T([[1.6, -6], [2.25, -8], [2.45, -6], [5.3, 2], [5.6, 20], [5.9, 22], [6.05, 14], [6.2, -2], [6.6, -3],
    [8.6, -3], [10.8, -3], [11.5, 22], [11.7, 24], [13.4, 10.4], [14.4, 10], [14.8, 10], [15.4, -4], [16.4, -8],
    [17.1, -9], [17.3, -6], [18.15, 2], [18.45, 2], [20.25, 14], [20.5, -6], [20.7, -8], [21.35, 12], [21.6, -4],
    [21.75, -7], [22.4, 0], [22.65, -2], [22.8, -4], [24.2, 24], [26.0, 26], [26.2, 14], [26.4, -2], [26.9, -3]]),
  sa: T([[1.6, 0.05], [2.45, 0.05], [5.3, 1.4], [5.6, 1.9], [5.9, 2.0], [6.05, 0.6], [6.2, -0.45], [6.6, -0.5],
    [8.6, -0.55], [10.8, -0.55], [11.5, 1.3], [11.7, 1.2], [13.3, 0.05], [13.4, -0.12], [14.4, -0.15],
    [14.8, 0.5], [15.4, 2.8], [16.4, 0.05], [17.3, 0.05], [18.15, 1.4], [18.45, 1.4], [20.25, 1.6], [20.5, -0.6],
    [20.7, -0.6], [21.35, 1.5], [21.6, -0.3], [21.75, -0.4], [22.4, 0.1], [22.65, 0.0], [22.8, -0.1],
    [24.2, 1.5], [26.0, 1.6], [26.2, 0.6], [26.4, -0.45], [26.9, -0.45]]),
  fs: T([[0, 1], [1.55, 1], [1.6, -1], [1.85, -0.5], [2.05, 0.15], [2.3, 1], [16.35, 1], [16.4, -1],
    [16.95, -0.3], [17.12, 1], [22.35, 1], [22.4, -0.6], [22.6, 1], [30, 1]], 'lin'),
  // claw arm (near / left hand)
  cw: T([[0, 0], [0.85, 0], [0.95, 1], [1.35, 1], [1.6, 0], [6.8, 0], [6.9, 1], [7.2, 1], [7.4, 0], [8.4, 0],
    [8.5, 1], [10.6, 1], [11.0, 0], [18.5, 0], [18.6, 1], [19.1, 1], [19.3, 0], [20.9, 0], [21.0, 1], [21.3, 1],
    [21.45, 0], [30, 0]], 'ease'),
  cx: T([[0.95, 24], [1.15, 14], [1.35, 2], [6.9, 6], [7.0, 20], [7.15, 24], [8.5, 14], [8.72, 22], [9.0, 18],
    [9.5, 12], [10.0, 10], [10.6, 12], [18.6, 14], [18.78, 20], [19.1, 19], [21.0, 10], [21.15, 24], [21.3, 22]]),
  cy: T([[0.95, -6], [1.1, -10], [1.35, -9], [6.9, 4], [7.05, -4], [7.15, -6], [8.5, 4], [8.72, -6], [9.0, -2],
    [9.5, 0], [10.0, -2], [10.6, -4], [18.6, 8], [18.78, -10.5], [19.1, -10.5], [21.0, 6], [21.15, -4], [21.3, -6]]),
};

KING.BLADE = 22;
KING.STRIDE = 26;
KING.ARM = [12, 12];
KING.LEG = [7.2, 7.6];

// gait phase = distance travelled / stride (precomputed integral)
KING.gait = (() => {
  const hz = 240, n = Math.ceil((DURATION + 1) * hz);
  const ph = new Float32Array(n + 1), sp = new Float32Array(n + 1);
  let acc = 0, px = KING.tr.x.at(0), pz = KING.tr.z.at(0);
  for (let i = 0; i <= n; i++) {
    const t = i / hz;
    const x = KING.tr.x.at(t), z = KING.tr.z.at(t);
    const v = Math.hypot(x - px, z - pz) * hz;
    const spinV = Math.abs(KING.tr.spin.at(t) - KING.tr.spin.at(t - 1 / hz)) * hz * 6;
    const col = KING.tr.collapse.at(t);
    acc += (v + spinV) / hz / KING.STRIDE * (1 - col);
    ph[i] = acc; sp[i] = v;
    px = x; pz = z;
  }
  return { hz, ph, sp, n };
})();
function kingGait(t) {
  const g = KING.gait, i = clamp(Math.round(t * g.hz), 0, g.n);
  return { ph: g.ph[i], sp: g.sp[i] };
}

// foot / hand cycle in local x/y relative to rest point. u in [0,1)
function limbCycle(u, A, lift) {
  u = u - Math.floor(u);
  const st = 0.58;
  if (u < st) return [A * (1 - 2 * u / st), 0, 0];
  const s = (u - st) / (1 - st);
  return [-A + 2 * A * smooth(s), lift * Math.sin(Math.PI * s), 1];
}

function kingPose(t) {
  const tr = KING.tr, P = { t };
  P.x = tr.x.at(t); P.z = tr.z.at(t);
  const face = tr.face.at(t) * Math.cos(tr.spin.at(t));
  P.face = face;
  P.fv = (face < 0 ? -1 : 1) * Math.max(0.14, Math.abs(face));
  const dip = tr.dip.at(t); P.dip = dip;
  P.pitch = tr.pitch.at(t);
  const col = tr.collapse.at(t); P.collapse = col;
  const g = kingGait(t); P.ph = g.ph; P.speed = g.sp;
  const run = clamp(g.sp / 22, 0, 1);
  const bob = Math.sin(g.ph * TAU * 2) * 0.7 * run;
  P.y = lerp(11 + bob - dip * 1.6, 4.2, col);
  P.ember = tr.ember.at(t) * (t > 26.8 ? 0 : 1);
  P.eye = t > 26.78 ? 0 : 1;
  P.jaw = tr.jaw.at(t) + col * 0.5;
  P.chestOn = t < 14.72;
  P.chainOn = t < 14.72;

  const gy = -P.y; // ground in local (pitch ignored for targets)
  const L = {};
  L.pelvis = [-10, -0.3];
  L.spineMid = [-2, 3.0 - dip * 0.8];
  L.chest = [5.0, 5.4 - dip * 2.0];
  L.neck = [10.6, 6.6 - dip * 4.5 - col * 3];
  L.skull = [16.2, 3.6 - dip * 6.5 - col * 5];
  P.skullAng = -0.38 - dip * 0.35 - col * 0.3 + Math.sin(t * 9) * 0.03;
  L.shN = [7.6, 4.4 - dip * 1.8];
  L.shF = [8.2, 5.2 - dip * 1.8];
  L.hipN = [-10, -0.9];
  L.hipF = [-9.5, -0.2];
  L.core = [3.8, 0.6 - dip * 1.0];
  L.rib = [2.6, 0.8 - dip * 1.0];
  L.ribEdge = [6.6, -1.8 - dip * 1.4];
  L.knot = [9.6, 1.4 - dip * 2.0];

  const A = KING.STRIDE / 4 * clamp(run * 1.1, 0.25, 1);
  const lift = 3.5 * clamp(run, 0.3, 1);
  const ph = g.ph;
  // gallop-ish phase offsets
  const fN = limbCycle(ph + 0.5, A, lift), fF = limbCycle(ph + 0.62, A, lift);
  const hN = limbCycle(ph + 0.0, A, lift * 0.8), hF = limbCycle(ph + 0.12, A, lift * 0.8);
  P.contact = { fN: fN[2] === 0, fF: fF[2] === 0, hN: hN[2] === 0, hF: hF[2] === 0 };

  // splay limbs when collapsing
  const spl = col * 6;
  const gaitHandN = [L.shN[0] + 5 + fN[0] + spl, gy + fN[1] * (1 - col)];
  const gaitHandF = [L.shF[0] + 5.5 + fF[0] + spl, gy + fF[1] * (1 - col)];
  const footN = [L.hipN[0] + 2.5 + hN[0] - spl * 0.5, gy + hN[1] * (1 - col)];
  const footF = [L.hipF[0] + 2.8 + hF[0] - spl * 0.5, gy + hF[1] * (1 - col)];

  const cw = tr.cw.at(t), sw = tr.sw.at(t);
  const clawT = v2.lerp(gaitHandN, [tr.cx.at(t), tr.cy.at(t)], cw);
  const swordT = v2.lerp(gaitHandF, [tr.sx.at(t), tr.sy.at(t)], sw);
  clawT[1] = Math.max(clawT[1], gy + 0.3); swordT[1] = Math.max(swordT[1], gy + 0.6);

  const armN = ik2(L.shN, clawT, KING.ARM[0], KING.ARM[1], 1);
  const armF = ik2(L.shF, swordT, KING.ARM[0], KING.ARM[1], 1);
  const legN = ik2(L.hipN, footN, KING.LEG[0], KING.LEG[1], -1);
  const legF = ik2(L.hipF, footF, KING.LEG[0], KING.LEG[1], -1);
  L.elN = armN.j; L.haN = armN.end; L.elF = armF.j; L.haF = armF.end;
  L.knN = legN.j; L.ftN = legN.end; L.knF = legF.j; L.ftF = legF.end;
  P.cw = cw; P.sw = sw;
  P.clawOpen = 0.4 + cw * 0.6;

  // sword direction: default trails backward; attack dir uses angle + foreshortening
  const fs = tr.fs.at(t), sa = tr.sa.at(t);
  const defDir = [Math.cos(Math.PI - 0.1), Math.sin(Math.PI - 0.1)];
  const atkDir = [Math.cos(sa) * fs, Math.sin(sa)];
  let dir = v2.lerp(defDir, atkDir, sw);
  const BL = KING.BLADE;
  let tip = v2.add(L.haF, v2.mul(dir, BL));
  P.tipGround = false;
  const floor = gy + 0.25;
  if (tip[1] < floor) {
    const dy = floor - L.haF[1];
    const mag = Math.hypot(dir[0], dir[1]) * BL;
    if (Math.abs(dy) < mag) {
      const hx = Math.sqrt(mag * mag - dy * dy) * (dir[0] < 0 ? -1 : 1);
      dir = [hx / BL, dy / BL];
      tip = v2.add(L.haF, v2.mul(dir, BL));
      P.tipGround = true;
    }
  }
  L.tip = tip;
  P.sdir = dir;
  P.L = L;

  // world transform of a local point
  const c = Math.cos(P.pitch), s = Math.sin(P.pitch);
  P.w = (l) => [P.x + P.fv * (l[0] * c - l[1] * s), P.y + (l[0] * s + l[1] * c)];
  // skull-space point → local
  const sk = L.skull, ca = Math.cos(P.skullAng), sa2 = Math.sin(P.skullAng);
  P.skullL = (p) => [sk[0] + p[0] * ca - p[1] * sa2, sk[1] + p[0] * sa2 + p[1] * ca];
  return P;
}

// cached pose lookup (quantised) for particles & anchors
KING.cache = new Map();
function kingPoseQ(t) {
  const q = Math.round(t * 240);
  let p = KING.cache.get(q);
  if (!p) { p = kingPose(q / 240); KING.cache.set(q, p); }
  return p;
}

// named anchor points (world [x,y,z])
function kingAnchor(P, name, u = 0.5) {
  const L = P.L;
  let l, dz = 0;
  switch (name) {
    case 'lclaw': l = v2.add(L.haN, v2.mul(v2.norm(v2.sub(L.haN, L.elN)), 2.2)); dz = -3; break;
    case 'lwrist': l = L.haN; dz = -3; break;
    case 'lfore': l = v2.lerp(L.elN, L.haN, u); dz = -3; break;
    case 'lupper': l = v2.lerp(L.shN, L.elN, u); dz = -3; break;
    case 'lelbow': l = L.elN; dz = -3; break;
    case 'lshoulder': l = [L.shN[0] + 0.4, L.shN[1] + 2.6]; dz = -3; break;
    case 'rwrist': l = L.haF; dz = 3; break;
    case 'blade': l = v2.lerp(v2.add(L.haF, v2.mul(P.sdir, 1.4)), L.tip, u); dz = 3; break;
    case 'bladeMid': l = v2.lerp(L.haF, L.tip, 0.45); dz = 3; break;
    case 'swordTip': l = L.tip; dz = 3; break;
    case 'skull': l = L.skull; break;
    case 'antler': l = P.skullL(antlerPt([0.4 * 1.1, 8.0 * 1.1])); break;
    case 'eye': l = P.skullL([1.6, 0.6]); dz = -1; break;
    case 'rib': l = L.rib; break;
    case 'ribEdge': l = L.ribEdge; dz = -2; break;
    case 'knot': l = L.knot; dz = -2.5; break;
    case 'core': l = L.core; dz = -1; break;
    case 'kneeN': l = L.knN; dz = -2.5; break;
    case 'kneeF': l = L.knF; dz = 2.5; break;
    case 'hipN': l = L.hipN; dz = -2; break;
    case 'footN': l = L.ftN; dz = -2.5; break;
    case 'footF': l = L.ftF; dz = 2.5; break;
    case 'handF': l = L.haF; dz = 3; break;
    case 'chest': l = L.chest; break;
    default: l = [0, 0];
  }
  const w = P.w(l);
  return [w[0], w[1], P.z + dz];
}

// ── drawing ────────────────────────────────────────────────
// ctx is already in the "card" transform for depth P.z (metres, y-up).
const KDRAW = {};
KDRAW.line = (ctx, pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); };

function boneSeg(ctx, a, b, w, R, far, pal) {
  const ol = R.ol;
  ctx.lineCap = 'round';
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = w + ol * 2;
  KDRAW.line(ctx, [a, b]);
  if (R.sil) return;
  const base = pal ? (far ? pal.far : pal.base) : (far ? PAL.boneFar : PAL.bone);
  const sh = pal ? pal.sh : (far ? PAL.boneFarSh : PAL.boneSh);
  ctx.strokeStyle = base; ctx.lineWidth = w;
  KDRAW.line(ctx, [a, b]);
  const d = v2.norm(v2.sub(b, a)), n = [-d[1], d[0]];
  const side = n[1] > 0 ? -1 : 1; // shadow on the lower side (cel)
  const o = v2.mul(n, side * w * 0.24);
  ctx.strokeStyle = sh; ctx.lineWidth = w * 0.46;
  KDRAW.line(ctx, [v2.add(a, o), v2.add(b, o)]);
  if (!far) {
    const h = v2.mul(n, -side * w * 0.3);
    ctx.strokeStyle = pal ? pal.hi : PAL.boneHi; ctx.lineWidth = w * 0.14;
    KDRAW.line(ctx, [v2.add(a, h), v2.add(b, h)]);
  }
  // stringy dried sinew along long limbs
  if (!pal && w > 0.9 && v2.len(v2.sub(b, a)) > 4) {
    ctx.strokeStyle = far ? '#1f1c1e' : '#2a2628'; ctx.lineWidth = w * 0.08;
    const m = v2.lerp(a, b, 0.5), q = v2.mul(n, w * 0.12);
    ctx.beginPath(); ctx.moveTo(...v2.add(a, q)); ctx.quadraticCurveTo(...v2.sub(m, q), ...v2.add(b, q)); ctx.stroke();
  }
}
function knob(ctx, p, r, R, far) {
  ctx.beginPath(); ctx.arc(p[0], p[1], r + R.ol, 0, TAU); ctx.fillStyle = PAL.ink; ctx.fill();
  if (R.sil) return;
  ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fillStyle = far ? PAL.boneFar : PAL.bone; ctx.fill();
  ctx.beginPath(); ctx.arc(p[0] + r * 0.2, p[1] - r * 0.25, r * 0.62, 0, TAU); ctx.fillStyle = far ? PAL.boneFarSh : PAL.boneSh; ctx.fill();
}
function polyFill(ctx, pts, fill, R, ol = true) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = R.sil ? PAL.ink : fill; ctx.fill();
  if (ol) { ctx.lineJoin = 'round'; ctx.strokeStyle = PAL.ink; ctx.lineWidth = R.ol * 1.6; ctx.stroke(); }
}
function glow(ctx, x, y, r, col, a) {
  if (a <= 0.003) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}

function goldPlate(ctx, pts, R, far) {
  polyFill(ctx, pts, far ? '#9c7426' : PAL.gold, R);
  if (R.sil) return;
  // cel shadow: lower half of the plate
  let minY = 1e9, maxY = -1e9; for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  const mid = lerp(minY, maxY, 0.42);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.clip();
  ctx.fillStyle = far ? '#5e3f12' : PAL.goldSh;
  ctx.fillRect(-1e3, minY - 1, 2e3, mid - minY + 1);
  ctx.fillStyle = far ? '#c9a24a' : PAL.goldHi;
  ctx.fillRect(-1e3, maxY - (maxY - minY) * 0.16, 2e3, (maxY - minY) * 0.1);
  ctx.restore();
}
function engrave(ctx, cx, cy, s, R) {
  if (R.sil) return;
  ctx.strokeStyle = PAL.goldLine; ctx.lineWidth = R.ol * 0.8; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - s, cy); ctx.bezierCurveTo(cx - s * 0.5, cy + s * 0.7, cx, cy - s * 0.5, cx + s * 0.4, cy + s * 0.2);
  ctx.moveTo(cx - s * 0.2, cy - s * 0.4); ctx.arc(cx - s * 0.2, cy - s * 0.1, s * 0.3, -1.5, 2.5);
  ctx.stroke();
}

function pauldron(ctx, c, R, far, t) {
  for (let j = 2; j >= 0; j--) {
    const rx = 2.9 - j * 0.22, ry = 1.35, oy = -j * 0.95;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (i / 12);
      pts.push([c[0] + Math.cos(a) * rx, c[1] + oy + Math.sin(a) * ry * (j === 0 ? 1.6 : 1)]);
    }
    pts.push([c[0] - rx * 0.9, c[1] + oy - 0.6], [c[0] + rx * 0.9, c[1] + oy - 0.6]);
    goldPlate(ctx, pts, R, far);
  }
  if (!far) engrave(ctx, c[0], c[1] + 0.9, 1.2, R);
}

function drawCape(ctx, P, R, t) {
  // dark maroon, heavily tattered; long strips trail and fray into black smoke (ref: Image 1)
  const sp = clamp(P.speed / 30, 0.2, 1);
  const fl = (i, a) => Math.sin(t * 7 + i * 1.3) * a * (0.5 + sp);
  const top = [[8.6, 7.6], [3, 8.8 + fl(0, 0.4)], [-5, 7.6 + fl(1, 0.6)], [-13, 5.6 + fl(2, 0.9)], [-20 - sp * 4, 4.0 + fl(3, 1.2)]];
  const bot = [[-23 - sp * 6, -0.5 + fl(4, 1.4)], [-20, -6.5 + fl(5, 1)], [-17.5, -2.6 + fl(6, 0.8)], [-15, -9 + fl(7, 0.9)],
    [-12, -3.8 + fl(8, 0.6)], [-9, -9.5 + fl(9, 0.7)], [-6, -4.5 + fl(10, 0.5)], [-3, -8.8 + fl(11, 0.6)], [0, -3.6], [2.6, -7 + fl(12, 0.5)],
    [5, -1.5], [7, -3.5 + fl(13, 0.4)], [8.4, 2.5]];
  const pts = top.concat(bot);
  polyFill(ctx, pts, PAL.cape, R);
  if (!R.sil) {
    // fold shadows + worn lighter edge
    ctx.save(); ctx.beginPath(); ctx.moveTo(...pts[0]); for (const q of pts) ctx.lineTo(...q); ctx.closePath(); ctx.clip();
    ctx.fillStyle = PAL.capeSh;
    for (let i = 0; i < 5; i++) {
      const x = 5 - i * 5.5;
      ctx.beginPath();
      ctx.moveTo(x - 0.6, 8); ctx.quadraticCurveTo(x - 1.6, 1, x - 3.2 + fl(i, 0.8), -9); ctx.lineTo(x - 1.6 + fl(i, 0.8), -9); ctx.quadraticCurveTo(x - 0.6, 1, x + 0.4, 8);
      ctx.closePath(); ctx.fill();
    }
    // lower half falls into shadow
    ctx.fillStyle = 'rgba(30,8,10,0.35)'; ctx.fillRect(-40, -12, 60, 10);
    ctx.restore();
    ctx.strokeStyle = '#6e2a2c'; ctx.lineWidth = R.ol * 1.2;
    KDRAW.line(ctx, top);
  }
  // hem dissolving into black smoke strips
  if (!R.sil) {
    for (let k = 0; k < 22; k++) {
      const ph = (t * 0.9 + k / 22) % 1;
      const b = bot[k % (bot.length - 2)];
      const x = b[0] - ph * (7 + sp * 12) + Math.sin(k * 3.1 + t) * 0.8;
      const y = b[1] - ph * 1.5 + Math.sin(ph * 6 + k) * 0.6;
      const r = 0.8 + ph * 3;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(14,10,14,${(1 - ph) * 0.6})`); g.addColorStop(1, 'rgba(14,10,14,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  }
}

const ANTLER = { base: PAL.antler, far: '#3a2e24', sh: PAL.antlerSh, hi: PAL.antlerHi };
// antlers sweep back from their base on the skull (skull-local)
const ANTLER_BASE = [-0.8, 1.8], ANTLER_ROT = 0.55;
function antlerPt(p) { return v2.add(ANTLER_BASE, v2.rot(v2.sub(p, ANTLER_BASE), ANTLER_ROT)); }
function drawSkull(ctx, P, R, t) {
  // gilded beast skull with dark antlers (ref: Image 1)
  const L = P.L;
  ctx.save();
  ctx.translate(L.skull[0], L.skull[1]);
  ctx.rotate(P.skullAng);
  const antler = (ox, far) => {
    const k = 1.1;
    const beams = [
      [[-0.8, 1.8], [-2.6, 4.4], [-3.6, 7.6], [-5.6, 10.4], [-6.0, 13.4]],
      [[-2.5, 4.2], [-0.6, 6.0], [0.4, 8.0]],
      [[-3.5, 7.2], [-1.8, 9.4], [-1.4, 11.6]],
      [[-5.4, 10.0], [-3.8, 12.0], [-3.4, 14.0]],
      [[-5.6, 10.6], [-8.0, 11.6], [-9.4, 13.4]],
      [[-2.8, 5.0], [-5.4, 5.8], [-7.0, 5.2]],
      [[-3.8, 8.2], [-6.4, 8.4], [-8.0, 9.6]],
    ];
    for (let bi = 0; bi < beams.length; bi++) {
      const b = beams[bi].map(p => antlerPt([p[0] * k + ox, p[1] * k]));
      for (let i = 0; i < b.length - 1; i++) boneSeg(ctx, b[i], b[i + 1], (bi === 0 ? 0.95 : 0.62) * (1 - i * 0.2), R, far, ANTLER);
    }
  };
  antler(-1.2, true);
  const jaw = P.jaw * 0.9;
  const jawPts = [[0.6, -1.0], [5.4, -1.4 - jaw], [5.3, -2.1 - jaw], [3.0, -2.3 - jaw * 0.6], [0.0, -2.5]];
  goldPlate(ctx, jawPts, R, true);
  const head = [[-2.3, 0.2], [-2.0, 1.8], [-0.6, 2.6], [1.2, 2.3], [3.4, 1.3], [6.0, 0.4], [6.4, -0.6], [5.6, -1.2], [2.0, -1.4], [-0.6, -1.9], [-2.0, -1.2]];
  goldPlate(ctx, head, R, false);
  if (!R.sil) {
    // teeth (bone) under the gold
    ctx.fillStyle = PAL.tooth; ctx.strokeStyle = PAL.ink; ctx.lineWidth = R.ol * 0.7;
    for (let i = 0; i < 6; i++) {
      const x = 1.8 + i * 0.65;
      ctx.beginPath(); ctx.moveTo(x, -1.3); ctx.lineTo(x + 0.25, -1.85 - jaw * 0.3); ctx.lineTo(x + 0.5, -1.3); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // engraved ridge lines on the mask
    ctx.strokeStyle = PAL.goldLine; ctx.lineWidth = R.ol;
    ctx.beginPath(); ctx.moveTo(-1.6, 1.6); ctx.quadraticCurveTo(1.5, 2.2, 5.8, 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.4, -1.2); ctx.quadraticCurveTo(-1.2, 0.4, -0.4, 2.3); ctx.stroke();
    // nasal cavity + deep socket
    ctx.fillStyle = '#140708';
    ctx.beginPath(); ctx.ellipse(5.1, 0.0, 0.45, 0.25, -0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(1.5, 0.65, 0.9, 0.62, -0.15, 0, TAU); ctx.fill();
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = R.ol * 1.4; ctx.stroke();
  }
  antler(0, false);
  ctx.restore();
}

function drawKingGlowEye(ctx, P, R, t) {
  if (R.sil || P.eye <= 0) return;
  const e = P.skullL([1.6, 0.65]);
  const fl = 0.8 + 0.2 * Math.sin(t * 31);
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, e[0], e[1], 3.4, 'rgba(255,90,30,0.9)', 0.55 * fl);
  glow(ctx, e[0], e[1], 0.8, 'rgba(255,230,170,1)', 1);
  ctx.globalCompositeOperation = 'source-over';
}

function drawRibcage(ctx, P, R, t) {
  const L = P.L;
  const em = P.ember, fl = 0.75 + 0.25 * Math.sin(t * 23 + Math.sin(t * 7) * 3);
  // inner embers (behind ribs)
  if (!R.sil && em > 0) {
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, L.core[0], L.core[1], 9, 'rgba(255,110,30,0.85)', 0.5 * em * fl);
    glow(ctx, L.core[0] + 4, L.core[1] - 1, 5, 'rgba(255,160,60,0.9)', 0.35 * em * fl);
    ctx.globalCompositeOperation = 'source-over';
  }
  const n = 9;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const sx = lerp(-3, 7.4, u);
    const sy = lerp(L.spineMid[1], L.chest[1], u) - 0.2;
    const depth = (0.45 + 0.55 * Math.sin(Math.PI * (u * 0.85 + 0.12))) * 6.6;
    const a = [sx, sy], c = [sx + 3.2, sy - depth * 0.45], b = [sx + 2.2 + u * 1.2, sy - depth];
    ctx.lineCap = 'round';
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 0.75 + R.ol * 2;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]); ctx.stroke();
    if (!R.sil) {
      ctx.strokeStyle = PAL.bone; ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = PAL.boneHi; ctx.lineWidth = 0.18;
      ctx.beginPath(); ctx.moveTo(a[0] - 0.15, a[1] - 0.2); ctx.quadraticCurveTo(c[0] - 0.2, c[1] - 0.2, b[0] - 0.2, b[1]); ctx.stroke();
    }
  }
  // sternum
  boneSeg(ctx, [-0.2, L.spineMid[1] - 5.2], [11.2, L.chest[1] - 5.6], 0.6, R, false);
  // exposed core after the chest plate is torn away
  if (!P.chestOn && !R.sil && em > 0) {
    const beat = 0.7 + 0.3 * Math.sin(t * 14);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, L.core[0], L.core[1], 6.5, 'rgba(255,120,30,1)', 0.8 * beat * Math.min(1, em));
    glow(ctx, L.core[0], L.core[1], 2.4, 'rgba(255,240,200,1)', beat * Math.min(1, em));
    ctx.globalCompositeOperation = 'source-over';
  }
  if (!P.chestOn && !R.sil) {
    // the core: a burning knot of embers
    ctx.fillStyle = em > 0 ? PAL.emberHot : '#2a1a14';
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = R.ol * 1.4;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU, r = 1.3 + (i % 2) * 0.55 + Math.sin(t * 9 + i) * 0.15 * em;
      const p = [L.core[0] + Math.cos(a) * r, L.core[1] + Math.sin(a) * r];
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

function chestArmorShape(cx, cy) {
  return [[cx - 2.8, cy + 3.2], [cx + 1.8, cy + 3.8], [cx + 3.2, cy + 0.4], [cx + 2.2, cy - 2.6], [cx - 0.2, cy - 3.6], [cx - 3.0, cy - 1.4]];
}
function drawChestArmorAt(ctx, cx, cy, R) {
  const pts = chestArmorShape(cx, cy);
  goldPlate(ctx, pts, R, false);
  if (!R.sil) {
    ctx.strokeStyle = PAL.goldLine; ctx.lineWidth = R.ol;
    ctx.beginPath(); ctx.moveTo(cx - 0.4, cy + 3.5); ctx.lineTo(cx + 0.2, cy - 3.3); ctx.stroke();
    engrave(ctx, cx - 1.4, cy + 0.6, 1.0, R);
    engrave(ctx, cx + 1.4, cy - 0.4, 0.9, R);
  }
}

function drawChain(ctx, P, R, t) {
  if (!P.chainOn) return;
  const L = P.L;
  const a = [L.shN[0] + 1.2, L.shN[1] - 0.6], k = L.knot, b = [L.neck[0] + 1.6, L.neck[1] - 1.2];
  const links = [];
  const cat = (p, q, sag, n) => {
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      links.push([lerp(p[0], q[0], u), lerp(p[1], q[1], u) - Math.sin(Math.PI * u) * sag]);
    }
  };
  cat(a, k, 0.9, 7); cat(k, b, 0.8, 6);
  // loose end swinging (the chain that swings toward the soldier at 9.35)
  const sw = Math.sin(t * 4.2) * 0.6 + Math.sin(t * 1.3) * 0.25 + (P.speed / 60);
  for (let i = 1; i <= 10; i++) links.push([k[0] + Math.sin(sw) * i * 0.75, k[1] - 1.2 - Math.cos(sw) * i * 0.75]);
  for (let i = 1; i <= 8; i++) links.push([k[0] - 0.8 + Math.sin(sw * 0.7 + 0.4) * i * 0.75, k[1] - 1.0 - Math.cos(sw * 0.7 + 0.4) * i * 0.75]);
  for (const p of links) {
    ctx.beginPath(); ctx.ellipse(p[0], p[1], 0.36, 0.24, 0.6, 0, TAU);
    ctx.fillStyle = R.sil ? PAL.ink : PAL.gold; ctx.fill();
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = R.ol; ctx.stroke();
  }
  // heavy gold ring at the chest that the chains hang from
  ctx.lineWidth = 0.55 + R.ol * 2; ctx.strokeStyle = PAL.ink;
  ctx.beginPath(); ctx.arc(k[0], k[1], 1.25, 0, TAU); ctx.stroke();
  ctx.lineWidth = 0.55; ctx.strokeStyle = R.sil ? PAL.ink : PAL.gold; ctx.stroke();
  if (!R.sil) { ctx.lineWidth = 0.16; ctx.strokeStyle = PAL.goldHi; ctx.beginPath(); ctx.arc(k[0], k[1], 1.3, 2.2, 3.6); ctx.stroke(); }
}

function drawArm(ctx, P, sh, el, ha, R, far, gauntlet) {
  boneSeg(ctx, sh, el, 1.3, R, far);
  const d = v2.norm(v2.sub(ha, el)), n = [-d[1] * 0.32, d[0] * 0.32];
  boneSeg(ctx, v2.add(el, n), v2.add(ha, n), 0.6, R, far);
  boneSeg(ctx, v2.sub(el, n), v2.sub(ha, n), 0.6, R, far);
  knob(ctx, el, 0.9, R, far);
  if (gauntlet) {
    // gold bracer from 35% to 95% of the forearm
    const a = v2.lerp(el, ha, 0.12), b = v2.lerp(el, ha, 0.9);
    const m = [-d[1] * 1.2, d[0] * 1.2], m2 = [-d[1] * 1.45, d[0] * 1.45];
    goldPlate(ctx, [v2.add(a, m), v2.add(b, m2), v2.sub(b, m2), v2.sub(a, m)], R, far);
    if (!R.sil) {
      ctx.strokeStyle = PAL.goldLine; ctx.lineWidth = R.ol;
      for (let i = 1; i < 6; i++) {
        const p = v2.lerp(a, b, i / 6); const mm = v2.lerp(m, m2, i / 6);
        KDRAW.line(ctx, [v2.add(p, mm), v2.sub(p, mm)]);
      }
    }
  }
}

function drawClaw(ctx, P, R, t) {
  const L = P.L, h = L.haN;
  const d = v2.norm(v2.sub(L.haN, L.elN));
  const base = Math.atan2(d[1], d[0]);
  const open = P.clawOpen;
  knob(ctx, h, 1.0, R, false);
  for (let f = 0; f < 4; f++) {
    let ang = base + (f - 1.5) * 0.32 * open - 0.15;
    let p = h;
    const segs = [2.7, 2.3, 1.9];
    for (let s = 0; s < 3; s++) {
      const q = [p[0] + Math.cos(ang) * segs[s], p[1] + Math.sin(ang) * segs[s]];
      boneSeg(ctx, p, q, 0.55 - s * 0.12, R, false);
      p = q;
      ang -= (0.35 + (1 - open) * 0.5) * (P.fv > 0 ? 1 : 1);
    }
    // talon
    const tip = [p[0] + Math.cos(ang) * 1.3, p[1] + Math.sin(ang) * 1.3];
    polyFill(ctx, [[p[0] - 0.25, p[1]], tip, [p[0] + 0.25, p[1] - 0.15]], '#151214', R);
  }
}

function drawSword(ctx, P, R, t) {
  const L = P.L, h = L.haF, d = P.sdir;
  const mag = Math.hypot(d[0], d[1]) || 1;
  const u = [d[0] / mag, d[1] / mag], n = [-u[1], u[0]];
  const BL = KING.BLADE * mag;
  const at = (s, w) => [h[0] + u[0] * s + n[0] * w, h[1] + u[1] * s + n[1] * w];
  // grip + pommel
  boneSeg(ctx, at(-3, 0), at(0.6, 0), 0.7, R, true);
  knob(ctx, at(-3.2, 0), 0.6, R, true);
  // blade: straight spine (峰) on +n side, edge on -n side
  const s0 = 1.6, wB = 0.95;
  const blade = [at(s0, wB), at(s0 + BL * 0.55, wB * 0.95), at(BL, wB * 0.2), at(BL + 0.6, -0.1), at(BL - 1.0, -wB * 0.9), at(s0 + BL * 0.5, -wB * 1.15), at(s0, -wB)];
  polyFill(ctx, blade, PAL.steel, R);
  if (!R.sil) {
    // cel shadow half (edge side)
    polyFill(ctx, [at(s0, 0), at(BL + 0.3, -0.05), at(BL - 1.0, -wB * 0.9), at(s0 + BL * 0.5, -wB * 1.15), at(s0, -wB)], PAL.steelSh, R, false);
    // rust patches
    ctx.fillStyle = 'rgba(138,67,37,0.75)';
    for (let i = 0; i < 9; i++) {
      const s = s0 + 1 + rnd(i * 7.1) * (BL - 3), w = rnds(i * 3.3) * 0.5;
      const r = 0.25 + rnd(i * 1.7) * 0.5;
      const c = at(s, w);
      ctx.beginPath(); ctx.ellipse(c[0], c[1], r * 1.3 * mag + 0.08, r * 0.55, Math.atan2(u[1], u[0]), 0, TAU); ctx.fill();
    }
    // spine highlight
    ctx.strokeStyle = PAL.steelHi; ctx.lineWidth = R.ol * 1.2;
    KDRAW.line(ctx, [at(s0, wB * 0.75), at(s0 + BL * 0.55, wB * 0.72), at(BL - 0.5, wB * 0.15)]);
    // ember cracks along the blade
    const em = P.ember;
    if (em > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,140,40,${0.75 * Math.min(1, em)})`; ctx.lineWidth = R.ol * 1.6;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        let s = s0 + 2 + k * BL / 4.4;
        ctx.moveTo(...at(s, rnds(k) * 0.3));
        for (let j = 1; j < 5; j++) ctx.lineTo(...at(s + j * 0.9, rnds(k * 9 + j + Math.floor(t * 12)) * 0.45));
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // crossguard
  boneSeg(ctx, at(1.0, 2.4), at(1.0, -2.4), 0.8, R, true);
  if (!R.sil) {
    ctx.strokeStyle = '#9c6a26'; ctx.lineWidth = 0.5; KDRAW.line(ctx, [at(1.0, 2.2), at(1.0, -2.2)]);
  }
  // fist around the grip
  knob(ctx, h, 1.15, R, true);
}

function drawLeg(ctx, hip, kn, ft, R, far, forward) {
  boneSeg(ctx, hip, kn, 1.25, R, far);
  boneSeg(ctx, kn, ft, 1.0, R, far);
  knob(ctx, kn, 0.95, R, far);
  const toe = [ft[0] + 2.6 * forward, ft[1] - 0.15];
  boneSeg(ctx, ft, toe, 0.7, R, far);
  boneSeg(ctx, toe, [toe[0] + 1.0 * forward, toe[1] - 0.25], 0.45, R, far);
}

function drawKing(ctx, P, R) {
  const t = P.t, L = P.L;
  ctx.save();
  ctx.translate(P.x, P.y);
  ctx.scale(P.fv, 1);
  ctx.rotate(P.pitch);
  R = Object.assign({}, R, { ol: R.ol });

  drawCape(ctx, P, R, t);
  // far limbs
  drawLeg(ctx, L.hipF, L.knF, L.ftF, R, true, 1);
  drawArm(ctx, P, L.shF, L.elF, L.haF, R, true, true);
  pauldron(ctx, [L.shF[0] + 0.3, L.shF[1] + 0.9], R, true, t);
  // spine & pelvis
  const spine = [L.pelvis, L.spineMid, L.chest, L.neck];
  for (let i = 0; i < spine.length - 1; i++) boneSeg(ctx, spine[i], spine[i + 1], 1.3, R, false);
  for (let i = 0; i < 14; i++) {
    const u = i / 13, seg = Math.min(2, Math.floor(u * 3)), uu = u * 3 - seg;
    const p = v2.lerp(spine[seg], spine[seg + 1], uu);
    polyFill(ctx, [[p[0] - 0.45, p[1] + 0.5], [p[0] - 0.9, p[1] + 1.6], [p[0] + 0.35, p[1] + 0.6]], PAL.boneSh, R);
  }
  drawRibcage(ctx, P, R, t);
  // pelvis wing
  const pv = L.pelvis;
  polyFill(ctx, [[pv[0] - 2.6, pv[1] + 1.4], [pv[0] + 1.2, pv[1] + 2.2], [pv[0] + 2.4, pv[1] - 0.6], [pv[0] + 0.6, pv[1] - 2.8], [pv[0] - 2.2, pv[1] - 1.8]], PAL.boneFar, R);
  if (!R.sil) { ctx.fillStyle = '#1c1215'; ctx.beginPath(); ctx.ellipse(pv[0] - 0.1, pv[1] - 0.2, 0.8, 0.6, 0.3, 0, TAU); ctx.fill(); }
  // waist tassets
  for (let i = 0; i < 3; i++) {
    const x = pv[0] + 3.5 - i * 2.4, y = pv[1] - 0.8 + i * 0.3;
    goldPlate(ctx, [[x - 1.3, y + 1.4], [x + 1.3, y + 1.4], [x + 1.1, y - 2.2], [x - 1.1, y - 2.6]], R, false);
  }
  // neck vertebrae
  boneSeg(ctx, L.neck, v2.lerp(L.neck, L.skull, 0.75), 1.0, R, false);
  if (P.chestOn) drawChestArmorAt(ctx, L.knot[0] - 0.4, L.knot[1] + 1.4, R);
  drawChain(ctx, P, R, t);
  drawSkull(ctx, P, R, t);
  drawKingGlowEye(ctx, P, R, t);
  // sword sits on top of the body for readability
  drawSword(ctx, P, R, t);
  // near limbs
  drawLeg(ctx, L.hipN, L.knN, L.ftN, R, false, 1);
  drawArm(ctx, P, L.shN, L.elN, L.haN, R, false, true);
  drawClaw(ctx, P, R, t);
  pauldron(ctx, [L.shN[0] + 0.4, L.shN[1] + 1.0], R, false, t);
  // ember seams at the joints
  if (!R.sil && P.ember > 0) {
    ctx.globalCompositeOperation = 'lighter';
    const fl = 0.6 + 0.4 * Math.sin(t * 19);
    for (const j of [L.elN, L.knN, L.shN, L.hipN, L.neck]) glow(ctx, j[0], j[1], 2.2, 'rgba(255,120,40,0.9)', 0.4 * fl * Math.min(1, P.ember));
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}
