// Character rigs. API CONTRACT (scenes depend on it — do not change signatures):
//
// drawHina(ctx, o)   Hina, ~10 y/o girl in a navy yukata with a goldfish pattern,
//                    red obi, short bob hair with a yellow star hair-clip.
//   o.x, o.y       feet contact point (bottom centre) in current ctx space
//   o.scale        1 => ~420px tall standing
//   o.facing       1 = facing right, -1 = facing left
//   o.view         'side' | 'front' | 'back' | 'threeQuarter'  (default 'threeQuarter')
//   o.pose         'stand' | 'kneel' | 'run' | 'lookUp' | 'wave' | 'reach' | 'hold' | 'cheer'
//   o.runPhase     0..1 cycle position when pose==='run'
//   o.expression   'neutral' | 'surprised' | 'worried' | 'smile' | 'determined' | 'teary' | 'joy' | 'gentle'
//   o.mouth        from mouthAt('hina',T) (null => expression default mouth)
//   o.blink        0..1 lid closure (use blinkAt)
//   o.lookX,o.lookY  pupil offset -1..1
//   o.headTilt     radians
//   o.wind         0..1 hair/sleeve flutter strength
//   o.T            global time (for secondary motion)
//   o.lantern      null | {glow:0..1, kiraInside:bool}  paper lantern held in the front hand
//   o.armRaise     0..1 generic front-arm raise (for reach/wave blends)
//   o.bust         true => draw only head+shoulders (for close-ups), anchor o.y = chest bottom
//
//   Optional extras (added by the character designer; all may be omitted):
//   o.kneel        true => kneeling lower body with any upper-body pose (e.g. pose:'reach', kneel:true)
//   o.turn         0..1 continuous body/head yaw override (0 = front, 0.5 = threeQuarter, 1 = side)
//   o.windDir      +1 / -1 world direction the wind blows toward (default: toward her back)
//   o.light        {x, y, color, radius, strength} extra warm/cool light in world (ctx) space,
//                  e.g. Kira's glow: tints the side of Hina facing it. May also be an array.
//   o.rim          rim-light colour (default cool moonlight '#9fb4ff'); o.rimAlpha 0..1
//   o.lantern.open 0..1 lifts the lantern's top cap (for Kira hopping in)
//   o.lantern.swing extra swing angle (radians) for the lantern
//   o.alpha        overall opacity
//   Coordinates helpers: hinaHandPos(o), hinaHeadPos(o), hinaLanternPos(o) — see below.
//
// drawKira(ctx, o)   Kira, a fallen star: plump rounded 5-point star body, big
//                    shiny eyes, tiny arms, warm golden glow.
//   o.x, o.y       centre of body
//   o.size         radius in px of the star body
//   o.expression   'cry' | 'neutral' | 'hope' | 'happy' | 'gentle' | 'surprised'
//   o.mouth        from mouthAt('kira',T)
//   o.glow         0..1+ brightness (can exceed 1 for blazing)
//   o.tears        0..1 amount of glowing tears
//   o.squash       -1..1 (negative = squashed for hops)
//   o.rot          radians
//   o.blink, o.lookX, o.lookY, o.T as above
//   extras: o.alpha, o.arms ('auto'|'down'|'up'|'eyes'|'clasp'|'wave'|'reach'), o.halo (0..1 scale of the outer glow, default 1)
//
// drawVillager(ctx, o)   warm-backlit townsfolk in windows
//   o.kind 'grandpa' | 'grandma' | 'kid' | 'mother';  o.x,o.y = bottom centre (window sill);
//   o.scale (1 => ~260px tall upper body), o.mouth, o.wave 0..1, o.T, o.facing
//   extras: o.orb 0..1 (glowing orb held in both hands; grandpa shows it automatically when wave>0),
//           o.blink, o.backlight colour (default '#ffb347')
'use strict';

// =====================================================================
//  shared low-level helpers (private: ch_ prefix)
// =====================================================================
const CH_INK = '#1a1433';

function ch_spline(ctx, pts, closed, move = true, k = 1) {
  const n = pts.length;
  if (n < 2) return;
  if (move) ctx.moveTo(pts[0][0], pts[0][1]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % n];
    const p0 = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const p3 = closed ? pts[(i + 2) % n] : pts[Math.min(n - 1, i + 2)];
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k / 6, p1[1] + (p2[1] - p0[1]) * k / 6,
      p2[0] - (p3[0] - p1[0]) * k / 6, p2[1] - (p3[1] - p1[1]) * k / 6, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}
function ch_ell(ctx, x, y, rx, ry, rot = 0) {
  rx = Math.max(0.01, rx); ry = Math.max(0.01, ry);
  ctx.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx);
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}
function ch_rot(p, a) { const s = Math.sin(a), c = Math.cos(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
function ch_add(a, b, k = 1) { return [a[0] + b[0] * k, a[1] + b[1] * k]; }
function ch_sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function ch_mix(a, b, k) { return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]; }
function ch_len(v) { return Math.hypot(v[0], v[1]) || 1e-6; }
function ch_norm(v) { const l = ch_len(v); return [v[0] / l, v[1] / l]; }
function ch_dir(a) { return [Math.sin(a), Math.cos(a)]; } // angle from straight down; + => forward (+x)
function ch_lerpPts(A, B, k) { return A.map((p, i) => [lerp(p[0], B[i][0], k), lerp(p[1], B[i][1], k)]); }
function ch_tri(A, B, C, u) { return u <= 0.5 ? ch_lerpPts(A, B, u * 2) : ch_lerpPts(B, C, (u - 0.5) * 2); }

// crescent = shape minus (shape shifted by off); painted inside the current clip
function ch_crescent(ctx, path, off, color, a) {
  ctx.beginPath();
  ctx.rect(-6000, -6000, 12000, 12000);
  ctx.save(); ctx.translate(off[0], off[1]); path(ctx); ctx.restore();
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * a;
  ctx.fillStyle = color;
  ctx.fill('evenodd');
  ctx.globalAlpha = ga;
}
function ch_applyLights(ctx, lights, k = 1) {
  if (!lights) return;
  for (const L of lights) {
    if (!(L.a > 0)) continue;
    const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
    g.addColorStop(0, rgba(L.color, L.a * k));
    g.addColorStop(0.4, rgba(L.color, L.a * k * 0.45));
    g.addColorStop(1, rgba(L.color, 0));
    ctx.save();
    // mostly a warm tint (soft-light keeps darks dark), plus a little additive bloom
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha *= Math.min(1, 2.2);
    ctx.fillStyle = g;
    ctx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    ctx.globalAlpha *= 0.28;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    ctx.restore();
  }
}
// A cel-shaded part: base fill, shade crescent, optional highlight + rim crescents,
// scene lights, custom inner painting, and ink outline.
function ch_part(ctx, path, st) {
  ctx.beginPath(); path(ctx);
  ctx.fillStyle = st.fill; ctx.fill();
  if (st.shade || st.rim || st.hi || st.lights || st.inner) {
    ctx.save();
    ctx.clip();
    if (st.inner) st.inner(ctx);
    if (st.shade) ch_crescent(ctx, path, st.sh || [4, -4], st.shade, st.shadeA ?? 1);
    if (st.hi) ch_crescent(ctx, path, st.hio || [-4, 4], st.hi, st.hiA ?? 1);
    if (st.lights) ch_applyLights(ctx, st.lights, st.lightK ?? 1);
    if (st.rim) ch_crescent(ctx, path, st.rm || [3, 3], st.rim, st.rimA ?? 0.8);
    if (st.rim2) ch_crescent(ctx, path, st.rm2 || [-3, 3], st.rim2, st.rim2A ?? 0.8);
    if (st.after) st.after(ctx);
    ctx.restore();
  }
  if (st.lw) {
    ctx.beginPath(); (st.stroke || path)(ctx);
    ctx.lineWidth = st.lw; ctx.strokeStyle = st.ink || CH_INK;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
  }
}
// tapered limb outline through joint points with widths
function ch_limbPath(pts, ws) {
  return (ctx) => {
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const d = ch_norm(ch_sub(b, a)), n = [-d[1], d[0]];
      L.push(ch_add(pts[i], n, ws[i])); R.push(ch_add(pts[i], n, -ws[i]));
    }
    const d0 = ch_norm(ch_sub(pts[1], pts[0])), dn = ch_norm(ch_sub(pts[pts.length - 1], pts[pts.length - 2]));
    const endC = ch_add(pts[pts.length - 1], dn, ws[ws.length - 1] * 0.9);
    const startC = ch_add(pts[0], d0, -ws[0] * 0.9);
    ctx.moveTo(L[0][0], L[0][1]);
    ch_spline(ctx, L, false, false);
    ctx.quadraticCurveTo(endC[0] + (L[L.length - 1][0] - R[R.length - 1][0]) * 0, endC[1], R[R.length - 1][0], R[R.length - 1][1]);
    ch_spline(ctx, R.slice().reverse(), false, false);
    ctx.quadraticCurveTo(startC[0], startC[1], L[0][0], L[0][1]);
    ctx.closePath();
  };
}
function ch_star5(ctx, x, y, r, ri, rot = 0) {
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? ri : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}
// plump star with round tips (for Kira)
function ch_plumpStarPts(r, ri, legSpread = 0, tipR = 0.2) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    let a = -Math.PI / 2 + i * Math.PI / 5;
    if (i === 4) a -= legSpread; if (i === 6) a += legSpread;
    if (i % 2) { pts.push([Math.cos(a) * ri, Math.sin(a) * ri]); continue; }
    const rr = r * (1 - tipR * 0.42);
    for (const d of [-tipR, 0, tipR]) {
      const aa = a + d * 0.95;
      const k = d === 0 ? r : rr;
      pts.push([Math.cos(aa) * k, Math.sin(aa) * k]);
    }
  }
  return pts;
}
// rounded star through 10 points (plump)
function ch_softStarPts(r, ri, rot = 0, legSpread = 0) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    let a = rot - Math.PI / 2 + i * Math.PI / 5;
    if (i === 4) a -= legSpread; if (i === 6) a += legSpread;
    const rr = i % 2 ? ri : r;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return pts;
}

// =====================================================================
//  HINA
// =====================================================================
const CH_HS = 0.86;       // head-local units -> body units
const CH_C = {
  skin: '#ffe7d8', skinSh: '#f3b6a6', skinSh2: '#df9486', blush: '#ff7488', lip: '#e0717e',
  hair: '#2b1b18', hairSh: '#150b0d', hairHi: '#76503f', hairHi2: '#a07560',
  yuk: '#24346e', yukSh: '#151e48', yukHi: '#33498e', yukEdge: '#1b2758',
  obi: '#d8394a', obiSh: '#9d2236', obiHi: '#f37482',
  cord: '#ffd36a',
  fishO: '#ff8a3d', fishO2: '#ffb36a', fishW: '#fbf5e8',
  wood: '#d6a871', woodSh: '#9a6c43', strap: '#d8394a',
  iris0: '#1f0f24', iris1: '#5b2438', iris2: '#e08a52', pupil: '#14091a',
  clip: '#ffd23f', clipSh: '#e59a1c',
};
const CH_EXPR = {
  neutral:    { brow: 0,     browY: 0,  lidUp: 0.06, lidLow: 0.05, pupil: 1,    mouth: 'rest',  blush: 0.45, smile: 0.3 },
  surprised:  { brow: -0.08, browY: -7, lidUp: -0.1, lidLow: 0,    pupil: 0.72, mouth: 'o',     blush: 0.35, smile: 0, wide: 1.08 },
  worried:    { brow: -0.38, browY: -2, lidUp: 0.14, lidLow: 0.08, pupil: 0.95, mouth: 'wavy',  blush: 0.4,  smile: -0.6 },
  smile:      { brow: -0.05, browY: -2, lidUp: 0.05, lidLow: 0.3,  pupil: 1,    mouth: 'smile', blush: 0.75, smile: 1 },
  determined: { brow: 0.36,  browY: 3,  lidUp: 0.22, lidLow: 0.12, pupil: 0.9,  mouth: 'grin',  blush: 0.5,  smile: 0.2 },
  teary:      { brow: -0.36, browY: -2, lidUp: 0.1,  lidLow: 0.22, pupil: 1.05, mouth: 'wobble', blush: 0.95, smile: 0.6, tears: 1 },
  joy:        { brow: -0.1,  browY: -4, lidUp: 0,    lidLow: 0,    pupil: 1,    mouth: 'big',   blush: 0.95, smile: 1.2, happyEyes: true },
  gentle:     { brow: -0.14, browY: -1, lidUp: 0.3,  lidLow: 0.24, pupil: 1,    mouth: 'soft',  blush: 0.7,  smile: 0.8 },
};

// ---------- rig ----------
function ch_leg(hip, a, b, dx) {
  const h = [hip[0] + dx, hip[1]];
  const k = ch_add(h, ch_dir(a), 92);
  const an = ch_add(k, ch_dir(a - b), 90);
  return { h, k, an, footA: 0 };
}
function ch_hinaRig(o) {
  const T = o.T || 0, pose = o.pose || 'stand', view = o.view || 'threeQuarter';
  const back = view === 'back', front = view === 'front';
  const turn = o.turn != null ? clamp(o.turn) : front ? 0 : view === 'side' ? 1 : back ? 0.5 : 0.5;
  const sym = front || back;
  const kneel = pose === 'kneel' || !!o.kneel;
  const run = pose === 'run';
  const ar = clamp(o.armRaise || 0);
  const br = Math.sin(T * 2.3);
  const ph = (o.runPhase || 0) * TAU;
  const R = { T, pose, view, back, front, sym, turn, kneel, run, ar, br, ph, lantern: o.lantern || null };
  R.wind = clamp(o.wind || 0, 0, 2);
  R.windX = (o.windDir != null ? o.windDir : -(o.facing || 1)) * (o.facing || 1); // local x dir of wind
  const t2 = clamp((turn - 0.5) * 2, 0, 1);

  // ---- lower body
  let hip, lean = 0;
  if (run) {
    hip = [0, -197 + 5 * Math.cos(2 * ph - 0.7)];
    lean = 0.2 + 0.03 * Math.sin(2 * ph);
    const legAt = (p) => {
      const a = 0.54 * Math.cos(p) + 0.3 * smooth(-Math.sin(p));
      const b = 0.14 + 1.45 * smooth(-Math.sin(p + 0.3) * 1.2);
      return [a, b];
    };
    const [a1, b1] = legAt(ph), [a2, b2] = legAt(ph + Math.PI);
    R.legF = ch_leg(hip, a1, b1, -2); R.legB = ch_leg(hip, a2, b2, 3);
    R.legF.footA = (a1 - b1) * 0.55 + 0.15; R.legB.footA = (a2 - b2) * 0.55 + 0.15;
  } else if (kneel) {
    hip = sym ? [0, -58] : [lerp(-6, -12, t2), -54];
    lean = sym ? 0.02 : 0.13;
    if (sym) {
      R.legF = { h: [hip[0] + 11, hip[1]], k: [16, -16], an: [12, -8], footA: 0 };
      R.legB = { h: [hip[0] - 11, hip[1]], k: [-16, -16], an: [-12, -8], footA: 0 };
    } else {
      const kx = lerp(64, 78, t2);
      R.legF = { h: [hip[0] - 3, hip[1]], k: [kx - 6, -15], an: [hip[0] - 34, -12], footA: Math.PI };
      R.legB = { h: [hip[0] + 4, hip[1]], k: [kx + 4, -16], an: [hip[0] - 26, -14], footA: Math.PI };
    }
  } else {
    hip = [0, -205];
    const sp = sym ? 10 : lerp(9, 3, t2);
    const fs = sym ? 1 : -1;
    R.legF = ch_leg(hip, -0.015 * fs, 0, fs * sp); R.legB = ch_leg(hip, 0.015 * fs, 0, -fs * sp);
    if (pose === 'lookUp') lean = -0.05;
    if (pose === 'cheer') { lean = -0.03; }
    if (pose === 'reach') lean = 0.06 + 0.04 * ar;
    if (pose === 'wave') lean = -0.03;
  }
  if (pose === 'reach' && kneel) lean = 0.2 + 0.06 * ar;
  if (pose === 'kneel' && ar > 0) lean += 0.07 * ar;
  R.hip = hip; R.lean = lean;
  const tl = (p) => ch_add(hip, ch_rot(p, lean)); // torso-local -> local
  R.tl = tl;

  // ---- torso measurements (torso-local, y up negative)
  const fw = sym ? 33 : lerp(28, 19, t2), bw = sym ? 33 : lerp(31, 22, t2);
  R.fw = fw; R.bw = bw;
  R.nx = sym ? 0 : lerp(1, 5, t2);
  R.neck = tl([R.nx, -92 - br * 0.5]);
  R.chest = tl([0, -50]);
  const sy = -84 - br * 0.6;
  let sF, sB;
  if (sym) { sF = [30, sy]; sB = [-30, sy]; } else { sF = [lerp(-19, -3, t2), sy]; sB = [lerp(18, 3, t2), sy]; }
  R.sF = tl(sF); R.sB = tl(sB);

  // ---- head
  let headRot = lean * 0.35 + (o.headTilt || 0), pitch = 0;
  if (pose === 'lookUp') { pitch = 1; headRot += back ? -0.22 : sym ? 0 : -0.34; }
  if (pose === 'cheer') headRot += sym ? 0 : -0.06;
  if (run) headRot -= 0.1;
  if (kneel && !sym) headRot += 0.06;
  R.pitch = pitch;
  R.headRot = headRot;
  const neckTop = ch_add(R.neck, ch_rot([0, -14], lean * 0.6));
  R.neckTop = neckTop;
  R.head = ch_add(neckTop, ch_rot([sym ? 0 : lerp(1, 5, turn), -41], headRot));

  // ---- arms (angles: 0 = hanging, + = forward/outward)
  const mF = 1, mB = sym ? -1 : 1;
  let aF, aB;
  const rest = { a1: sym ? 0.13 : -0.06, a2: sym ? 0.05 : 0.12, hand: 'relax' };
  const L = R.lantern;
  if (run) {
    aF = L ? { a1: 0.5 + 0.07 * Math.sin(ph * 2), a2: 0.62, hand: 'grip' }
      : { a1: -0.62 * Math.cos(ph) + 0.1, a2: 1.45, hand: 'fist' };
    aB = { a1: 0.42 * Math.cos(ph) + 0.05, a2: 1.25, hand: 'fist' };
    if (sym) { aF.a1 = 0.18; aF.a2 = 0.5; aB.a1 = 0.18; aB.a2 = 0.5; }
  } else if (pose === 'wave') {
    aF = sym ? { a1: 2.45, a2: 0.35 + 0.42 * Math.sin(T * 10), hand: 'open' } : { a1: 3.45, a2: -0.25 + 0.42 * Math.sin(T * 10), hand: 'open' };
    aB = { ...rest };
  } else if (pose === 'reach') {
    aF = { a1: 1.18 + 0.28 * ar, a2: 0.04, hand: 'palm' };
    aB = kneel ? { a1: 0.55, a2: 0.75, hand: 'relax' } : { ...rest };
  } else if (pose === 'hold') {
    if (sym) { aF = { a1: -0.18, a2: -1.5, hand: 'palm' }; aB = { a1: -0.18, a2: -1.5, hand: 'palm' }; }
    else { aF = { a1: 0.16, a2: 1.62, hand: 'palm' }; aB = { a1: -0.02, a2: 1.8, hand: 'palm' }; }
  } else if (pose === 'cheer') {
    aF = sym ? { a1: 2.45 + 0.07 * Math.sin(T * 7), a2: 0.62, hand: 'fist' } : { a1: 3.25 + 0.07 * Math.sin(T * 7), a2: -0.55, hand: 'fist' };
    aB = sym ? { a1: 0.3, a2: -1.9, hand: 'fist' } : { a1: 0.3, a2: 1.75, hand: 'fist' };
  } else if (kneel) {
    aF = { a1: lerp(0.5, 1.3, ar), a2: lerp(0.78, 0.05, ar), hand: ar > 0.35 ? 'palm' : 'relax' };
    aB = { a1: 0.52, a2: 0.78, hand: 'relax' };
    if (sym) { aF = { a1: lerp(-0.05, 1.2, ar), a2: lerp(-0.6, 0, ar), hand: ar > 0.35 ? 'palm' : 'relax' }; aB = { a1: -0.05, a2: -0.6, hand: 'relax' }; }
  } else {
    aF = { a1: lerp(rest.a1, 1.28, ar), a2: lerp(rest.a2, 0.08, ar), hand: ar > 0.4 ? 'palm' : 'relax' };
    aB = { ...rest };
  }
  if (o.bust && !sym) {
    // close-ups: bring offered hands up into frame (palm around shoulder height)
    if (pose === 'hold') { aF = { a1: 0.3, a2: 2.0, hand: 'palm' }; aB = { a1: 0.12, a2: 2.2, hand: 'palm' }; }
    if (pose === 'reach' || (kneel && ar > 0.35)) aF = { a1: 1.5 + 0.2 * ar, a2: 0.35, hand: 'palm' };
  } else if (o.bust && sym && pose === 'hold') { aF = { a1: -0.1, a2: -2.3, hand: 'palm' }; aB = { a1: -0.1, a2: -2.3, hand: 'palm' }; }
  if (L && pose !== 'run') {
    // front hand always grips the lantern stick
    if (pose === 'stand' || pose === 'lookUp' || kneel && pose === 'kneel') {
      aF = kneel ? { a1: lerp(0.62, 1.5, ar), a2: lerp(0.62, 0.25, ar), hand: 'grip' }
        : { a1: lerp(0.25, 1.85, ar), a2: lerp(0.95, 0.3, ar), hand: 'grip' };
      if (sym) aF = { a1: lerp(0.12, 1.2, ar), a2: lerp(0.35, 0.3, ar), hand: 'grip' };
    } else aF.hand = aF.hand === 'palm' ? 'grip' : aF.hand === 'open' ? 'grip' : 'grip';
  }
  const mk = (S, A, m, isF) => {
    const w1 = A.a1 * m - lean * 0.5;
    const E = ch_add(S, ch_dir(w1), 56);
    const w2 = (A.a1 + A.a2) * m - lean * 0.5;
    const Wr = ch_add(E, ch_dir(w2), 50);
    return { S, E, W: Wr, fd: ch_dir(w2), ud: ch_dir(w1), hand: A.hand, m, isF };
  };
  R.armF = mk(R.sF, aF, mF, true);
  R.armB = mk(R.sB, aB, mB, false);

  // ---- hand anchor points
  const hp = (arm) => {
    if (arm.hand === 'palm') {
      const hx = arm.fd[0] >= 0 || !sym ? 1 : -1;
      return ch_add(arm.W, [hx * 11, -7]);
    }
    return ch_add(arm.W, arm.fd, 9);
  };
  R.handF = hp(R.armF); R.handB = hp(R.armB);

  // ---- lantern
  if (L) {
    const grip = ch_add(R.armF.W, R.armF.fd, 8);
    const sd = sym ? [0.35, -0.94] : [0.82, -0.57];
    const tip = ch_add(grip, sd, 40);
    let sw = 0.05 * Math.sin(T * 1.7) + (L.swing || 0);
    if (run) sw += 0.28 + 0.2 * Math.sin(ph * 2 - 1.1);
    sw += R.wind * 0.22 * (0.6 + noise1(T * 1.4, 71)) * -R.windX * -1;
    const hd = [-Math.sin(sw), Math.cos(sw)];
    R.lan = { grip, tip, sw, hd, c: ch_add(tip, hd, 30), stickDir: sd };
  }
  return R;
}

// local -> world transform description
function ch_hinaXf(o, R) {
  const s = o.scale || 1, f = o.facing || 1;
  const oy = o.bust ? -R.chest[1] : 0;
  return { s, f, oy, ox: o.bust ? -R.chest[0] : 0 };
}
function ch_toWorld(o, R, p) {
  const X = ch_hinaXf(o, R);
  return { x: o.x + (p[0] + X.ox) * X.s * X.f, y: o.y + (p[1] + X.oy) * X.s };
}
function hinaHandPos(o) {
  const R = ch_hinaRig(o);
  const p = ch_toWorld(o, R, R.handF);
  const q = ch_toWorld(o, R, R.handB);
  return { x: p.x, y: p.y, back: q, palmUp: R.armF.hand === 'palm' };
}
function hinaHeadPos(o) {
  const R = ch_hinaRig(o);
  const s = o.scale || 1;
  const p = ch_toWorld(o, R, R.head);
  const fwd = R.sym ? 0 : 47 * Math.sin(R.turn * 1.3) * CH_HS;
  const fh = ch_toWorld(o, R, ch_add(R.head, ch_rot([fwd * 0.9, -22 * CH_HS], R.headRot)));
  const mo = ch_toWorld(o, R, ch_add(R.head, ch_rot([fwd, 40 * CH_HS], R.headRot)));
  return { x: p.x, y: p.y, r: 58 * CH_HS * s, forehead: fh, mouth: mo };
}
function hinaLanternPos(o) {
  if (!o.lantern) return null;
  const R = ch_hinaRig(o);
  const c = ch_toWorld(o, R, R.lan.c), g = ch_toWorld(o, R, R.lan.grip);
  return { x: c.x, y: c.y, r: 25 * (o.scale || 1), grip: g };
}

// ---------- drawing ----------
function drawHina(ctx, o) {
  const R = ch_hinaRig(o);
  const X = ch_hinaXf(o, R);
  const s = X.s, f = X.f;
  const E = CH_EXPR[o.expression] || CH_EXPR.neutral;
  R.E = E; R.o = o;
  R.detail = o.bust || s >= 1.6;
  R.lw = 2.7 * Math.pow(s, -0.3);
  R.rim = o.rim || '#9fb4ff';
  R.rimA = o.rimAlpha ?? 0.75;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
  ctx.translate(o.x, o.y);
  if (o.bust) { ctx.beginPath(); ctx.rect(-8000, -8000, 16000, 8000); ctx.clip(); }
  ctx.scale(s * f, s);
  ctx.translate(X.ox, X.oy);
  // lights in local space
  const lights = [];
  const toLocal = (wx, wy) => [(wx - o.x) / (s * f) - X.ox, (wy - o.y) / s - X.oy];
  if (R.lan && (R.lantern.glow || 0) > 0) {
    const g = clamp(R.lantern.glow, 0, 2);
    lights.push({ x: R.lan.c[0], y: R.lan.c[1], r: 190 + 70 * g, color: '#ff9f40', a: 0.55 * Math.min(g, 1.5) });
  }
  const extra = o.light ? (Array.isArray(o.light) ? o.light : [o.light]) : [];
  for (const L of extra) {
    const p = toLocal(L.x, L.y);
    lights.push({ x: p[0], y: p[1], r: (L.radius || 400) / s, color: L.color || '#ffc85a', a: 0.6 * (L.strength ?? 1) });
  }
  R.lights = lights.length ? lights : null;

  if (R.lan) ch_hinaLantern(ctx, R, 'behind');   // big halo sits behind her
  if (R.back) ch_hinaDrawBack(ctx, R, o);
  else ch_hinaDrawFront(ctx, R, o);
  ctx.restore();
}

function ch_hinaDrawFront(ctx, R, o) {
  const bustSkip = o.bust;
  // far arm (behind body)
  if (!R.sym) ch_hinaArm(ctx, R, R.armB, true);
  if (!bustSkip) {
    ch_hinaLeg(ctx, R, R.legB, true);
  }
  ch_hinaBow(ctx, R, false);
  // back hair
  ch_hinaHeadXf(ctx, R, () => ch_hinaHairBack(ctx, R));
  if (!bustSkip) ch_hinaLeg(ctx, R, R.legF, false);
  ch_hinaNeck(ctx, R);
  ch_hinaTorso(ctx, R);
  if (R.sym) ch_hinaArm(ctx, R, R.armB, false);
  ch_hinaHeadXf(ctx, R, () => ch_hinaFace(ctx, R, o));
  ch_hinaArm(ctx, R, R.armF, false);
  if (R.lan) ch_hinaLantern(ctx, R, 'front');
}
function ch_hinaDrawBack(ctx, R, o) {
  ch_hinaArm(ctx, R, R.armB, true);
  if (!o.bust) { ch_hinaLeg(ctx, R, R.legB, true); ch_hinaLeg(ctx, R, R.legF, false); }
  ch_hinaNeck(ctx, R);
  ch_hinaTorso(ctx, R);
  ch_hinaBow(ctx, R, true);
  ch_hinaHeadXf(ctx, R, () => { ch_hinaHairBack(ctx, R); });
  ch_hinaArm(ctx, R, R.armF, false);
  if (R.lan) ch_hinaLantern(ctx, R, 'front');
}
function ch_hinaHeadXf(ctx, R, fn) {
  ctx.save();
  ctx.translate(R.head[0], R.head[1]);
  ctx.rotate(R.headRot);
  ctx.scale(CH_HS, CH_HS);
  fn();
  ctx.restore();
}
function ch_lightsIn(R, xf) {
  // transform lights into a sub-space given a function local->sub
  if (!R.lights) return null;
  return R.lights.map((L) => { const p = xf([L.x, L.y]); return { ...L, x: p[0], y: p[1], r: L.r / CH_HS }; });
}

// ---- legs & geta
function ch_hinaLeg(ctx, R, leg, far) {
  const lw = R.lw;
  const skinSh = far ? CH_C.skinSh2 : CH_C.skinSh;
  const skin = far ? mixColor(CH_C.skin, CH_C.skinSh, 0.35) : CH_C.skin;
  if (R.kneel) {
    if (R.sym) return; // hidden by the skirt in front/back kneel
    // soles/geta peeking out behind the hips
    ctx.save();
    ctx.translate(leg.an[0], leg.an[1]);
    ch_part(ctx, (c) => { c.moveTo(-6, -6); c.quadraticCurveTo(-22, -9, -28, -3); c.quadraticCurveTo(-26, 4, -8, 4); c.closePath(); },
      { fill: skin, shade: skinSh, sh: [0, -2], lw });
    ch_part(ctx, (c) => { c.rect(-31, 3, 30, 5); }, { fill: CH_C.wood, shade: CH_C.woodSh, sh: [0, -2], lw });
    ctx.restore();
    return;
  }
  const path = ch_limbPath([leg.h, leg.k, leg.an], [15, 9.5, 6.8]);
  ch_part(ctx, path, { fill: skin, shade: skinSh, sh: [4, -2], lw, lights: R.lights, rim: R.rim, rimA: R.rimA * 0.5, rm: [2, 2] });
  // foot + geta
  ctx.save();
  ctx.translate(leg.an[0], leg.an[1]);
  if (R.sym) {
    ch_part(ctx, (c) => { c.moveTo(-6, 0); c.quadraticCurveTo(-8, 9, -7, 11); c.quadraticCurveTo(0, 14, 7, 11); c.quadraticCurveTo(8, 9, 6, 0); c.closePath(); },
      { fill: skin, shade: skinSh, sh: [2, -2], lw });
    ch_part(ctx, (c) => { c.rect(-10, 11, 20, 5); }, { fill: CH_C.wood, shade: CH_C.woodSh, sh: [0, -2], lw });
    ch_part(ctx, (c) => { c.rect(-8, 16, 16, 4); }, { fill: CH_C.woodSh, lw: lw * 0.8 });
    ctx.strokeStyle = CH_C.strap; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-6, 6); ctx.quadraticCurveTo(0, 12, 6, 6); ctx.stroke();
  } else {
    ctx.rotate(-leg.footA);
    ch_part(ctx, (c) => {
      c.moveTo(-5, -3); c.quadraticCurveTo(-9, 6, -6, 10); c.lineTo(19, 10);
      c.quadraticCurveTo(22, 7, 17, 4); c.quadraticCurveTo(8, 1, 5, -3); c.closePath();
    }, { fill: skin, shade: skinSh, sh: [2, -2], lw, lights: R.lights });
    ch_part(ctx, (c) => { c.moveTo(-9, 10); c.lineTo(23, 10); c.quadraticCurveTo(25, 12.5, 23, 15); c.lineTo(-9, 15); c.quadraticCurveTo(-11, 12.5, -9, 10); c.closePath(); },
      { fill: CH_C.wood, shade: CH_C.woodSh, sh: [0, -2], lw });
    ch_part(ctx, (c) => { c.rect(-5, 15, 5, 5); c.rect(13, 15, 5, 5); }, { fill: CH_C.woodSh, lw: lw * 0.8 });
    ctx.strokeStyle = CH_C.strap; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(15, 9); ctx.quadraticCurveTo(9, 2, 2, 3); ctx.stroke();
  }
  ctx.restore();
}

// ---- torso / yukata
function ch_hinaTorsoPath(R) {
  const { tl, fw, bw, sym, turn } = R;
  const t2 = clamp((turn - 0.5) * 2);
  const nx = R.nx, nw = 8.5;
  const P = [];
  // upper body (torso-local)
  const up = [
    [nx - nw, -93], [-bw + 5, -89], [-bw, -80], [-bw + 0.5, -62], [-bw + 3, -34], [-bw + 2, -6],
  ];
  const upF = [
    [fw - 2, -6], [fw - 3, -34], [fw + (sym ? 0 : 2 + 2 * t2), -58], [fw, -80], [fw - 5, -89], [nx + nw, -93],
  ];
  // skirt (local)
  let skirt;
  const lf = R.legF, lb = R.legB;
  if (R.kneel) {
    if (sym) {
      skirt = [[-38, -30], [-40, -6], [-20, 0], [0, -2], [20, 0], [40, -6], [38, -30]];
    } else {
      const k = lf.k[0] > lb.k[0] ? lf.k : lb.k;
      skirt = [[R.hip[0] - bw - 8, -30], [R.hip[0] - bw - 12, -3], [k[0] - 4, -1], [k[0] + 14, -8], [k[0] + 13, -24], [k[0] - 10, -32], [R.hip[0] + fw + 10, R.hip[1] + 4]];
    }
  } else if (R.run) {
    const fl = lf.k[0] > lb.k[0] ? lf : lb, bl = fl === lf ? lb : lf;
    const hf = ch_add(ch_mix(fl.k, fl.an, 0.3), [11, 0]);
    const hb = ch_add(ch_mix(bl.k, bl.an, 0.35), [-12, 2]);
    const kf = ch_add(fl.k, [10, -8]);
    const mid = [(hf[0] + hb[0]) / 2, Math.max(hf[1], hb[1]) - 30];
    skirt = [[R.hip[0] - bw - 4, R.hip[1] + 40], hb, ch_mix(hb, mid, 0.55), mid, ch_mix(mid, hf, 0.45), hf, kf];
  } else {
    const xs = [lf.an[0], lb.an[0]];
    const minx = Math.min(...xs), maxx = Math.max(...xs);
    const sway = R.wind * 5 * noise1(R.T * 1.3, 17) * R.windX;
    skirt = [[minx - (sym ? 26 : 25), -80], [minx - (sym ? 24 : 22) + sway, -34], [(minx + maxx) / 2 + sway, -30],
      [maxx + (sym ? 24 : 24) + sway, -35], [maxx + (sym ? 26 : 25), -80]];
  }
  return { up: up.map(tl), upF: upF.map(tl), skirt };
}
function ch_hinaTorso(ctx, R) {
  const { tl, lw, sym, turn } = R;
  const t2 = clamp((turn - 0.5) * 2);
  const TP = ch_hinaTorsoPath(R);
  const nx = R.nx;
  // V-neck crossing point (left over right)
  const vx = sym ? (R.back ? 0 : 0) : lerp(9, 14, t2);
  const V = tl([vx - 2, -50]);
  const nL = TP.up[0], nR = TP.upF[TP.upF.length - 1];
  const path = (c) => {
    c.moveTo(nL[0], nL[1]);
    ch_spline(c, TP.up, false, false);
    ch_spline(c, [TP.up[TP.up.length - 1], ...TP.skirt, TP.upF[0]], false, false);
    ch_spline(c, TP.upF, false, false);
    if (!R.back) { c.lineTo(V[0], V[1]); }
    c.closePath();
  };
  const ls = R.lights;
  ch_part(ctx, path, {
    fill: CH_C.yuk, shade: CH_C.yukSh, sh: [7, -5], lw, lights: ls, lightK: 0.8,
    rim: R.rim, rimA: R.rimA * 0.55, rm: [3.5, 3],
    inner: (c) => {
      // soft vertical fabric gradient
      const g = c.createLinearGradient(0, R.hip[1] - 100, 0, 0);
      g.addColorStop(0, 'rgba(70,95,170,0.18)'); g.addColorStop(1, 'rgba(10,14,40,0.25)');
      c.fillStyle = g; c.fillRect(-200, -460, 400, 470);
      ch_hinaPattern(c, R);
      // folds
      c.strokeStyle = 'rgba(10,14,40,0.45)'; c.lineWidth = 1.6; c.lineCap = 'round';
      if (!R.kneel) {
        const sk = TP.skirt;
        const a = sk[1], b = sk[sk.length - 2];
        c.beginPath();
        if (!sym && !R.back) { // okumi overlap line
          const top = tl([fw_(R) - 8, -16]);
          c.moveTo(top[0], top[1]); c.quadraticCurveTo(top[0] + 6, (top[1] + b[1]) / 2, b[0] - 8, b[1] + 1);
        } else if (!R.back) {
          const top = tl([-6, -16]);
          c.moveTo(top[0], top[1]); c.quadraticCurveTo(top[0] - 4, (top[1] + b[1]) / 2, -12, b[1] - 2);
        }
        c.stroke();
        c.strokeStyle = 'rgba(10,14,40,0.3)';
        c.beginPath();
        const f1 = tl([-bw_(R) * 0.4, -14]);
        c.moveTo(f1[0], f1[1]); c.quadraticCurveTo(f1[0] - 3, f1[1] + 60, a[0] + 16, a[1] - 4);
        c.stroke();
      }
      // underarm fold lines
      c.strokeStyle = 'rgba(10,14,40,0.35)';
      c.beginPath();
      const u1 = tl([-bw_(R) + 6, -70]);
      c.moveTo(u1[0], u1[1]); c.quadraticCurveTo(u1[0] + 8, u1[1] + 14, u1[0] + 6, u1[1] + 24);
      c.stroke();
    },
  });
  // collar
  if (!R.back) ch_hinaCollar(ctx, R, V, nL, nR);
  else {
    // back collar band
    ctx.strokeStyle = CH_C.yukEdge; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(nL[0] + 1, nL[1] + 2); ctx.quadraticCurveTo((nL[0] + nR[0]) / 2, nL[1] + 6, nR[0] - 1, nR[1] + 2); ctx.stroke();
  }
  ch_hinaObi(ctx, R);
}
function fw_(R) { return R.fw; }
function bw_(R) { return R.bw; }

function ch_hinaCollar(ctx, R, V, nL, nR) {
  const { tl, lw, sym } = R;
  // under-panel edge (right panel, goes under): from nL towards V
  // top panel edge: from nR (wearer's left) down to V
  const band = (a, ctrl, b, width) => {
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = CH_INK; ctx.lineWidth = width + lw * 1.3;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(ctrl[0], ctrl[1], b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = CH_C.yukEdge; ctx.lineWidth = width;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,150,230,0.35)'; ctx.lineWidth = width * 0.25;
    ctx.stroke();
    ctx.restore();
  };
  const Vb = ch_add(V, [0, 3]);
  const ctlL = ch_mix(nL, Vb, 0.5), ctlR = ch_mix(nR, Vb, 0.5);
  band(ch_add(nL, [-1, 1]), ch_add(ctlL, [-2, 4]), ch_add(Vb, [5, -9]), 4.6);
  band(ch_add(nR, [1, 1]), ch_add(ctlR, [3, 3]), ch_add(Vb, [-6, 4]), 5);
}
function ch_hinaObi(ctx, R) {
  const { tl, fw, bw, lw, sym } = R;
  const top = -47, bot = -17;
  const pts = [[-bw + 2.5, top], [fw - 2.5, top + (sym ? 0 : 1)], [fw - 1.5, bot], [-bw + 1.5, bot + (sym ? 0 : -1)]].map(tl);
  const path = (c) => {
    c.moveTo(pts[0][0], pts[0][1]);
    const m1 = tl([(fw - bw) / 2, top - 2]);
    c.quadraticCurveTo(m1[0], m1[1], pts[1][0], pts[1][1]);
    c.lineTo(pts[2][0], pts[2][1]);
    const m2 = tl([(fw - bw) / 2, bot + 2.5]);
    c.quadraticCurveTo(m2[0], m2[1], pts[3][0], pts[3][1]);
    c.closePath();
  };
  ch_part(ctx, path, {
    fill: CH_C.obi, shade: CH_C.obiSh, sh: [6, -5], hi: CH_C.obiHi, hio: [0, 4], hiA: 0.55, lw, lights: R.lights,
    rim: R.rim, rimA: R.rimA * 0.4,
    inner: (c) => {
      // subtle woven stripes
      c.strokeStyle = 'rgba(120,10,30,0.35)'; c.lineWidth = 1.2;
      for (let i = 1; i < 3; i++) {
        const a = tl([-bw, top + i * 10]), b = tl([fw, top + i * 10]);
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      }
    },
  });
  // obijime cord
  const a = tl([-bw + 2, -31]), b = tl([fw - 2, -31]), m = tl([(fw - bw) / 2, -29]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = CH_INK; ctx.lineWidth = 4 + lw;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]); ctx.stroke();
  ctx.strokeStyle = CH_C.cord; ctx.lineWidth = 3.6; ctx.stroke();
  if (!R.back) {
    // little knot at the front
    const kx = sym ? 0 : lerp(4, 12, clamp((R.turn - 0.5) * 2));
    const k = tl([kx, -30]);
    ch_part(ctx, (c) => ch_ell(c, k[0], k[1], 4.2, 3.4), { fill: CH_C.cord, shade: '#d99a2a', sh: [1.5, -1.5], lw: lw * 0.7 });
  }
}
// goldfish + bubbles pattern (painted inside the yukata clip, torso-local)
function ch_hinaPattern(c, R) {
  const { tl, lean } = R;
  const fish = R.kneel
    ? [[-18, -72, 0.4, 1], [14, -8, -0.3, 1.1], [-40, 20, 0.2, 1], [30, 32, -0.2, 0.9], [60, 42, 0.5, 1], [-4, 40, 0.1, 0.9]]
    : [[-16, -74, 0.4, 1], [14, -6, -0.35, 1.1], [-14, 36, 0.25, 1], [18, 82, -0.2, 1.05], [-12, 128, 0.3, 1], [22, 150, -0.4, 0.9], [-22, 100, 0.1, 0.8]];
  const ox = R.turn * 6;
  for (let i = 0; i < fish.length; i++) {
    const [fx, fy, fr, fs] = fish[i];
    const p = tl([fx + ox, fy]);
    const wig = Math.sin(R.T * 2 + i) * 0.08;
    ch_goldfish(c, p[0], p[1], 7.5 * fs, fr + lean + wig, i % 2 ? 1 : -1);
  }
  // bubbles
  c.strokeStyle = 'rgba(240,245,255,0.55)'; c.lineWidth = 1.1;
  const bub = [[26, -4, 2], [-2, 44, 2.4], [4, 50, 1.3], [32, 90, 2], [0, 140, 2.2], [-30, 90, 1.6]];
  for (const [bx, by, br] of bub) {
    const p = tl([bx + ox, by]);
    c.beginPath(); c.arc(p[0], p[1], br, 0, TAU); c.stroke();
  }
}
function ch_goldfish(c, x, y, r, rot, dir) {
  c.save();
  c.translate(x, y); c.rotate(rot); c.scale(dir, 1);
  // tail fins (flowing)
  c.fillStyle = 'rgba(255,190,140,0.85)';
  c.beginPath();
  c.moveTo(-r * 0.7, 0);
  c.bezierCurveTo(-r * 1.3, -r * 1.1, -r * 2.0, -r * 0.7, -r * 2.1, -r * 0.2);
  c.quadraticCurveTo(-r * 1.6, 0, -r * 2.1, r * 0.4);
  c.bezierCurveTo(-r * 1.9, r * 0.9, -r * 1.2, r * 0.9, -r * 0.7, 0);
  c.fill();
  // body
  c.fillStyle = CH_C.fishO;
  c.beginPath(); ch_ell(c, 0, 0, r, r * 0.62); c.fill();
  c.fillStyle = CH_C.fishW;
  c.beginPath(); ch_ell(c, r * 0.1, r * 0.25, r * 0.6, r * 0.28); c.fill();
  c.fillStyle = CH_C.fishO2;
  c.beginPath(); ch_ell(c, -r * 0.2, -r * 0.2, r * 0.45, r * 0.2); c.fill();
  c.fillStyle = '#2a1030';
  c.beginPath(); c.arc(r * 0.55, -r * 0.1, r * 0.13, 0, TAU); c.fill();
  c.restore();
}
// obi bow on her back
function ch_hinaBow(ctx, R, backView) {
  const { tl, lw, turn, sym } = R;
  const T = R.T;
  const fl = R.wind * (0.5 + 0.5 * noise1(T * 2.2, 33));
  const flut = Math.sin(T * 1.6) * 0.04 + R.wind * 0.18 * noise1(T * 3.1, 44) + (R.run ? 0.15 * Math.sin(R.ph * 2) + 0.2 : 0);
  ctx.save();
  let c0, sx;
  if (backView) { c0 = tl([0, -36]); sx = 1; }
  else if (sym) { c0 = tl([0, -40]); sx = 1; }
  else { c0 = tl([-R.bw - lerp(4, 7, clamp((turn - 0.5) * 2)), -36]); sx = lerp(0.62, 0.45, clamp((turn - 0.5) * 2)); }
  ctx.translate(c0[0], c0[1]);
  ctx.rotate(R.lean * 0.5);
  const wx = R.windX * fl * 8;
  // tails
  const tail = (side) => (c) => {
    const bx = side * 8 * sx;
    const sw = (flut + side * 0.05) * 60;
    c.moveTo(bx - 7 * sx, 2);
    c.bezierCurveTo(bx - 10 * sx + wx * 0.3, 30, bx - 10 * sx + wx + sw * 0.4, 50, bx - 8 * sx + wx + sw, 70 - Math.abs(wx) * 0.4);
    c.lineTo(bx + 9 * sx + wx + sw, 66 - Math.abs(wx) * 0.4);
    c.bezierCurveTo(bx + 10 * sx + wx, 46, bx + 10 * sx, 24, bx + 7 * sx, 2);
    c.closePath();
  };
  const loop = (side) => (c) => {
    const sw = flut * 20 * side;
    c.moveTo(0, -2);
    c.bezierCurveTo(side * 14 * sx, -26 + sw, side * 44 * sx + wx * 0.3, -30 + sw, side * 46 * sx + wx * 0.4, -10 + sw);
    c.bezierCurveTo(side * 48 * sx + wx * 0.4, 8 + sw, side * 22 * sx, 14, 0, 3);
    c.closePath();
  };
  const st = (col, sh, hi) => ({ fill: col, shade: sh, sh: [5 * sx, -4], hi, hio: [-2, 4], hiA: 0.4, lw, rim: R.rim, rimA: R.rimA * 0.5, lights: R.lights });
  if (sym && !backView) {
    // front view: only the loops peek out behind the shoulders/waist
    ch_part(ctx, loop(-1), st(CH_C.obi, CH_C.obiSh, CH_C.obiHi));
    ch_part(ctx, loop(1), st(CH_C.obi, CH_C.obiSh, CH_C.obiHi));
    ctx.restore();
    return;
  }
  ch_part(ctx, tail(-1), st('#e2505e', CH_C.obiSh, CH_C.obiHi));
  ch_part(ctx, tail(1), st('#e2505e', CH_C.obiSh, CH_C.obiHi));
  ch_part(ctx, loop(-1), st(CH_C.obi, CH_C.obiSh, CH_C.obiHi));
  ch_part(ctx, loop(1), st(CH_C.obi, CH_C.obiSh, CH_C.obiHi));
  // fold lines on loops
  ctx.strokeStyle = 'rgba(110,10,30,0.55)'; ctx.lineWidth = 1.3;
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sd * 6 * sx, -3); ctx.quadraticCurveTo(sd * 24 * sx, -14, sd * 36 * sx, -12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sd * 6 * sx, 3); ctx.quadraticCurveTo(sd * 22 * sx, 6, sd * 34 * sx, 2); ctx.stroke();
  }
  // knot
  ch_part(ctx, (c) => { c.moveTo(-8 * sx, -9); c.quadraticCurveTo(0, -12, 8 * sx, -9); c.lineTo(8 * sx, 9); c.quadraticCurveTo(0, 12, -8 * sx, 9); c.closePath(); },
    st('#e5505f', CH_C.obiSh, CH_C.obiHi));
  ctx.restore();
}

// ---- neck
function ch_hinaNeck(ctx, R) {
  const a = R.neck, b = ch_add(R.head, ch_rot([R.sym ? 0 : 2, 30], R.headRot));
  const path = ch_limbPath([ch_add(a, [0, 6]), b], [11.5, 10.5]);
  ch_part(ctx, path, {
    fill: CH_C.skin, lw: R.lw, lights: R.lights,
    after: (c) => {
      // chin shadow
      c.fillStyle = rgba(CH_C.skinSh2, 0.85);
      c.beginPath();
      const h = R.head, r = R.headRot;
      const p = ch_add(h, ch_rot([R.sym ? 0 : 6, 42], r));
      ch_ell(c, p[0], p[1], 20, 12, r);
      c.fill();
    },
  });
}

// ---- arms, sleeves, hands
function ch_hinaArm(ctx, R, A, far) {
  const lw = R.lw;
  const skin = far ? mixColor(CH_C.skin, CH_C.skinSh, 0.55) : CH_C.skin;
  const T = R.T;
  const up = clamp(-A.fd[1]);                 // forearm pointing up => sleeve slides down
  const cuffK = lerp(0.42, 0.02, up);
  const C = ch_add(A.E, ch_sub(A.W, A.E), cuffK);
  // exposed forearm + hand (drawn before sleeve)
  const fore = ch_limbPath([ch_mix(A.E, A.W, Math.max(0, cuffK - 0.1)), A.W], [7.2, 6]);
  ch_part(ctx, fore, { fill: skin, shade: CH_C.skinSh, sh: [2, -2], lw, lights: R.lights });
  if (!(A.hand === 'grip' && R.lan)) ch_hinaHand(ctx, R, A, skin);
  // sleeve
  const g0 = [R.windX * R.wind * 0.55 + (R.run ? -0.35 : 0), 1];
  const nz = noise1(T * 2.3 + (far ? 5 : 0), far ? 91 : 92);
  const g = ch_norm([g0[0] + R.wind * 0.25 * nz * R.windX, g0[1]]);
  const u1 = ch_norm(ch_sub(A.E, A.S)), u2 = ch_norm(ch_sub(C, A.E).map((v, i) => v + A.fd[i] * 0.01));
  let n1 = [-u1[1], u1[0]];
  let sgn = (n1[0] * g[0] + n1[1] * g[1]) + 0.35 * (-n1[0]) * (R.sym ? 0 : 1) < 0 ? -1 : 1;
  if (R.sym) sgn = (n1[0] * A.m >= 0 ? 1 : -1) * ((n1[0] * g[0] + n1[1] * g[1]) < -0.4 ? -1 : 1);
  n1 = [n1[0] * sgn, n1[1] * sgn];
  let n2 = [-u2[1] * sgn, u2[0] * sgn];
  const nm = ch_norm(ch_add(n1, n2));
  const hw1 = 13, hw2 = 12.5;
  const depth = 30 + 6 * (1 - Math.abs(u1[1])) + R.wind * 6;
  const sway = R.wind * 7 * nz + (R.run ? 6 * Math.sin(R.ph * 2 + (far ? 2 : 0)) : 0) + Math.sin(T * 1.8 + (far ? 1 : 0)) * 1.2;
  const sv = [sway * R.windX + (R.run ? -8 : 0), 0];
  const top0 = ch_add(A.S, n1, -hw1 * 0.85), topE = ch_add(A.E, nm, -hw1), topC = ch_add(C, n2, -hw2);
  const botC = ch_add(C, n2, hw2);
  const pf = ch_add(ch_add(botC, g, depth * 0.95), sv);
  const midArm = ch_mix(A.S, A.E, 0.55);
  const pb = ch_add(ch_add(ch_add(midArm, n1, hw1), g, depth), sv, 0.8);
  const pit = ch_add(ch_add(A.S, n1, hw1 * 0.7), u1, 8);
  const path = (c) => {
    c.moveTo(top0[0], top0[1]);
    c.quadraticCurveTo(topE[0] - u1[0] * 4, topE[1] - u1[1] * 4, topE[0], topE[1]);
    c.quadraticCurveTo(topE[0] + u2[0] * 3, topE[1] + u2[1] * 3, topC[0], topC[1]);
    c.lineTo(botC[0], botC[1]);
    const cb1 = ch_add(pf, g, -8);
    c.quadraticCurveTo(cb1[0] + u2[0] * 2, cb1[1], pf[0], pf[1]);
    const mm = ch_mix(pf, pb, 0.5);
    c.quadraticCurveTo(mm[0] + g[0] * 6, mm[1] + g[1] * 6, pb[0], pb[1]);
    c.quadraticCurveTo(pit[0] + g[0] * 10, pit[1] + g[1] * 10, pit[0], pit[1]);
    c.quadraticCurveTo(A.S[0], A.S[1], top0[0], top0[1]);
    c.closePath();
  };
  ch_part(ctx, path, {
    fill: far ? CH_C.yukSh : CH_C.yuk, shade: far ? '#0f1638' : CH_C.yukSh, sh: [6, -6], lw,
    rim: R.rim, rimA: R.rimA * (far ? 0.25 : 0.6), rm: [3, 3], lights: R.lights, lightK: 0.8,
    inner: (c) => {
      // sleeve opening shadow + a goldfish on the near sleeve
      c.fillStyle = 'rgba(8,10,30,0.55)';
      c.beginPath(); ch_ell(c, C[0], C[1], 5, hw2 * 0.95, Math.atan2(n2[1], n2[0])); c.fill();
      if (!far) {
        const fp = ch_add(ch_mix(pb, pf, 0.5), g, -12);
        ch_goldfish(c, fp[0], fp[1], 6.5, 0.3, 1);
      }
      c.strokeStyle = 'rgba(10,14,40,0.4)'; c.lineWidth = 1.4;
      c.beginPath(); const q = ch_mix(topE, pb, 0.25); c.moveTo(q[0], q[1]); const q2 = ch_mix(pf, pb, 0.4); c.quadraticCurveTo(q[0] + g[0] * 8, q[1] + g[1] * 14, q2[0], q2[1] - 4); c.stroke();
    },
  });
}
function ch_hinaHand(ctx, R, A, skin) {
  const lw = R.lw;
  const W = A.W;
  ctx.save();
  ctx.translate(W[0], W[1]);
  const st = { fill: skin, shade: CH_C.skinSh, sh: [2, -2], lw: lw * 0.9, lights: R.lights };
  if (A.hand === 'palm') {
    // open palm facing up, fingers forward, slightly cupped
    const hx = A.fd[0] >= 0 || !R.sym ? 1 : -1;
    ctx.scale(hx, 1);
    ch_part(ctx, (c) => {
      c.moveTo(-3, -5);
      c.quadraticCurveTo(8, -3, 18, -5);    // palm surface
      c.quadraticCurveTo(24, -7, 26, -11);  // curled finger tips
      c.quadraticCurveTo(29, -10, 27, -5);
      c.quadraticCurveTo(22, 5, 8, 5);      // back of hand
      c.quadraticCurveTo(0, 6, -3, 4);
      c.closePath();
    }, st);
    // thumb
    ch_part(ctx, (c) => { c.moveTo(4, -5); c.quadraticCurveTo(9, -12, 14, -11); c.quadraticCurveTo(14, -7, 9, -4); c.closePath(); }, st);
    ctx.strokeStyle = rgba(CH_C.skinSh2, 0.9); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(18, -4); ctx.quadraticCurveTo(22, -3, 24, -7); ctx.stroke();
  } else {
    const ang = Math.atan2(-A.fd[0], A.fd[1]);
    ctx.rotate(ang);
    const th = (R.sym ? A.m : 1) * (A.isF ? 1 : 1);
    ctx.scale(th, 1);
    if (A.hand === 'fist' || A.hand === 'grip') {
      ch_part(ctx, (c) => ch_ell(c, 0, 8, 8.5, 9), st);
      ctx.strokeStyle = rgba(CH_C.skinSh2, 0.9); ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(-5, 12); ctx.lineTo(4, 13); ctx.moveTo(-5, 7.5); ctx.lineTo(3, 8.5); ctx.stroke();
      ch_part(ctx, (c) => { c.moveTo(4, 2); c.quadraticCurveTo(10, 6, 7, 12); c.quadraticCurveTo(4, 10, 3, 6); c.closePath(); }, st);
    } else if (A.hand === 'open') {
      ch_part(ctx, (c) => {
        c.moveTo(-6, 0);
        c.quadraticCurveTo(-9, 8, -8, 13);
        c.quadraticCurveTo(-9, 22, -6, 22); c.quadraticCurveTo(-4, 16, -3.5, 14);
        c.quadraticCurveTo(-4, 25, -1, 25); c.quadraticCurveTo(1, 18, 0.5, 15);
        c.quadraticCurveTo(2, 25, 5, 24); c.quadraticCurveTo(6, 17, 4.5, 14);
        c.quadraticCurveTo(7, 21, 9, 19.5); c.quadraticCurveTo(10, 13, 7, 10);
        c.quadraticCurveTo(12, 7, 13, 3); c.quadraticCurveTo(11, 1, 7, 4);
        c.quadraticCurveTo(7, 0, 6, 0);
        c.closePath();
      }, st);
    } else {
      // relaxed hanging hand
      ch_part(ctx, (c) => {
        c.moveTo(-5.5, 0); c.quadraticCurveTo(-7.5, 10, -5, 16);
        c.quadraticCurveTo(-1, 20, 3.5, 16); c.quadraticCurveTo(6, 11, 5.5, 0); c.closePath();
      }, st);
      ch_part(ctx, (c) => { c.moveTo(4, 3); c.quadraticCurveTo(9, 7, 7.5, 11); c.quadraticCurveTo(5, 10, 4, 7); c.closePath(); }, st);
    }
  }
  ctx.restore();
}

// ---- lantern (chochin)
function ch_hinaLantern(ctx, R, layer) {
  const L = R.lantern, P = R.lan, lw = R.lw;
  const g = clamp(L.glow || 0, 0, 2.5);
  const T = R.T;
  if (layer === 'behind') {
    // outer glow halo (behind arm)
    if (g > 0) {
      glow(ctx, P.c[0], P.c[1], 110 + 140 * g, '#ffb347', 0.22 + 0.25 * Math.min(g, 1.5));
      glow(ctx, P.c[0], P.c[1], 50 + 40 * g, '#ffe2a8', 0.25 * Math.min(g, 1.5));
    }
    return;
  }
  // stick (bamboo)
  const grip = P.grip, tip = P.tip;
  ctx.lineCap = 'round';
  ctx.strokeStyle = CH_INK; ctx.lineWidth = 5.2 + lw * 0.4;
  const back = ch_add(grip, P.stickDir, -10);
  ctx.beginPath(); ctx.moveTo(back[0], back[1]); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
  ctx.strokeStyle = '#b98d56'; ctx.lineWidth = 3.4; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,180,0.5)'; ctx.lineWidth = 1; ctx.stroke();
  // hand on top of the stick
  const A = R.armF;
  ch_hinaHand(ctx, R, { ...A, hand: 'grip' }, CH_C.skin);
  // string + hook
  const top = ch_add(tip, P.hd, 8);
  ctx.strokeStyle = CH_INK; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
  // lantern body in its own frame
  ctx.save();
  ctx.translate(P.c[0], P.c[1]);
  ctx.rotate(-P.sw);
  const rx = 24, ry = 21;
  const open = clamp(L.open || 0);
  // top cap (lifts when open)
  const capY = -ry - 1 - open * 16;
  // paper
  const k = Math.min(g, 1.6);
  const paperC = g > 0 ? mixColor('#f6ecd8', '#fff6d6', k * 0.8) : '#efe4cf';
  const body = (c) => {
    c.moveTo(-rx * 0.62, -ry + 1);
    c.bezierCurveTo(-rx * 1.12, -ry * 0.6, -rx * 1.12, ry * 0.6, -rx * 0.62, ry - 1);
    c.lineTo(rx * 0.62, ry - 1);
    c.bezierCurveTo(rx * 1.12, ry * 0.6, rx * 1.12, -ry * 0.6, rx * 0.62, -ry + 1);
    c.closePath();
  };
  ch_part(ctx, body, {
    fill: paperC, lw,
    inner: (c) => {
      // inner light
      const gr = c.createRadialGradient(-3, 2, 2, 0, 0, rx * 1.3);
      gr.addColorStop(0, rgba('#fff8e0', 0.15 + 0.6 * Math.min(k, 1)));
      gr.addColorStop(0.55, rgba('#ffc768', 0.1 + 0.55 * Math.min(k, 1)));
      gr.addColorStop(1, rgba('#c86a2a', g > 0 ? 0.35 : 0.25));
      c.fillStyle = gr; c.fillRect(-rx * 1.5, -ry * 1.5, rx * 3, ry * 3);
      // red bands (top and bottom) + red painted band in the middle
      const red = g > 0 ? mixColor('#d8343a', '#ff5a3a', Math.min(k, 1) * 0.5) : '#c9343a';
      c.fillStyle = red;
      c.fillRect(-rx * 1.5, -ry, rx * 3, ry * 0.36);
      c.fillRect(-rx * 1.5, ry * 0.64, rx * 3, ry * 0.36);
      c.globalAlpha = 0.9;
      c.beginPath(); ch_ell(c, 0, 0, rx * 0.36, ry * 0.3); c.fill();
      c.globalAlpha = 1;
      // Kira silhouette inside
      if (L.kiraInside) {
        const bob = Math.sin(T * 3) * 1.5;
        c.save();
        c.globalCompositeOperation = 'source-over';
        const kp = ch_plumpStarPts(12, 8, 0.08, 0.28).map((p) => [p[0], p[1] + bob]);
        c.fillStyle = rgba('#e0901c', 0.55);
        c.beginPath(); ch_spline(c, kp.map((p) => [p[0] + 1, p[1] + 1.5]), true); c.fill();
        c.fillStyle = rgba('#ffd24a', 0.95);
        c.beginPath(); ch_spline(c, kp, true); c.fill();
        c.fillStyle = 'rgba(90,40,20,0.8)';
        c.beginPath(); ch_ell(c, -3, bob + 0.5, 1.2, 1.7); ch_ell(c, 3, bob + 0.5, 1.2, 1.7); c.fill();
        c.restore();
        glow(c, 0, bob, 30, '#fff3c0', 0.35 + 0.4 * Math.min(k, 1));
      }
      // ribs
      c.strokeStyle = g > 0 ? rgba('#b0602a', 0.45) : 'rgba(120,80,60,0.45)'; c.lineWidth = 0.9;
      for (let i = -3; i <= 3; i++) {
        const y = i * ry * 0.27;
        const w = rx * Math.sqrt(Math.max(0, 1 - (y / (ry * 1.08)) ** 2)) * 1.02;
        c.beginPath(); c.moveTo(-w, y); c.quadraticCurveTo(0, y + 3, w, y); c.stroke();
      }
      // specular
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.beginPath(); ch_ell(c, -rx * 0.5, -ry * 0.25, 3, 8, 0.25); c.fill();
    },
  });
  // caps
  const cap = (y, w) => (c) => { c.moveTo(-w, y - 3); c.lineTo(w, y - 3); c.quadraticCurveTo(w + 2, y, w, y + 3); c.lineTo(-w, y + 3); c.quadraticCurveTo(-w - 2, y, -w, y - 3); c.closePath(); };
  if (open > 0 && g > 0) glow(ctx, 0, -ry, 30 * open + 10, '#fff3c0', 0.6 * open);
  ch_part(ctx, cap(capY, rx * 0.62), { fill: '#2e211c', hi: '#5a4538', hio: [0, 2], lw: lw * 0.8 });
  ch_part(ctx, cap(ry + 1, rx * 0.62), { fill: '#2e211c', hi: '#5a4538', hio: [0, 2], lw: lw * 0.8 });
  // tassel
  const tw = Math.sin(T * 2.4) * 2 + R.wind * 3 * noise1(T * 2, 5);
  ctx.strokeStyle = '#d33a3a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, ry + 4); ctx.quadraticCurveTo(tw * 0.5, ry + 10, tw, ry + 16); ctx.stroke();
  ctx.restore();
  if (g > 0) {
    glow(ctx, P.c[0], P.c[1], 34 + 20 * g, '#fff2c8', 0.28 * Math.min(g, 1.5));
    if (g > 1) {
      for (let i = 0; i < 6; i++) {
        const a = T * 0.8 + i * TAU / 6;
        const rr = 36 + 10 * Math.sin(T * 2 + i);
        sparkle(ctx, P.c[0] + Math.cos(a) * rr, P.c[1] + Math.sin(a) * rr * 0.8, 5 + 3 * Math.sin(T * 5 + i), '#fff6d0', clamp(g - 1) * (0.5 + 0.5 * Math.sin(T * 4 + i * 2)));
      }
    }
  }
}

// ---- head: back hair
const CH_BOB_F = [[-50, 50], [-60, 34], [-66, 8], [-65, -22], [-55, -47], [-33, -65], [0, -71], [33, -65], [55, -47], [65, -22], [66, 8], [60, 34], [50, 50], [38, 44], [20, 42], [0, 40], [-20, 42], [-38, 44]];
const CH_BOB_T = [[-46, 53], [-60, 38], [-67, 10], [-66, -21], [-56, -49], [-34, -66], [-3, -72], [30, -66], [50, -48], [58, -22], [58, 6], [52, 30], [42, 46], [28, 42], [12, 44], [-6, 42], [-20, 48], [-34, 48]];
const CH_BOB_S = [[-40, 52], [-56, 38], [-64, 9], [-63, -24], [-52, -50], [-30, -66], [-2, -71], [26, -67], [44, -50], [52, -27], [53, -2], [46, 22], [36, 40], [22, 38], [8, 44], [-8, 40], [-22, 50], [-32, 50]];
const CH_BOB_B = [[-52, 52], [-62, 34], [-67, 8], [-66, -22], [-56, -47], [-33, -66], [0, -72], [33, -66], [56, -47], [66, -22], [67, 8], [62, 34], [52, 52], [38, 56], [22, 52], [8, 58], [-8, 54], [-24, 58], [-40, 54]];

function ch_hinaHairWind(R, i, amt) {
  const T = R.T;
  const w = R.wind;
  const idle = Math.sin(T * 1.6 + i * 0.7) * 0.8;
  const run = R.run ? Math.sin(R.ph * 2 + i * 0.5) * 2.5 - 3 : 0;
  return [(w * (6 + 7 * noise1(T * 2.6 + i * 0.37, 13)) * R.windX + idle + run) * amt, -w * 3 * amt * Math.abs(noise1(T * 2 + i, 29))];
}
function ch_hinaHairBack(ctx, R) {
  const turn = R.turn;
  let pts = R.back ? CH_BOB_B.map((p) => p.slice()) : ch_tri(CH_BOB_F, CH_BOB_T, CH_BOB_S, turn);
  // hair ends react to wind (lower points)
  pts = pts.map((p, i) => {
    if (i === 0 || i === 12 && !R.back) p = [p[0] + (p[0] > 0 ? 5 : -5), p[1] - 3];
    if (p[1] < 20) return p;
    const k = clamp((p[1] - 20) / 35);
    const w = ch_hinaHairWind(R, i, 1);
    return [p[0] + w[0] * k * 1.3, p[1] + w[1] * k];
  });
  const lw = R.lw / CH_HS;
  const lights = ch_lightsIn(R, (p) => ch_hinaToHead(R, p));
  const path = (c) => ch_spline(c, pts, true);
  ch_part(ctx, path, {
    fill: CH_C.hair, shade: CH_C.hairSh, sh: [7, -6], lw, lights, lightK: 0.6,
    rim: R.rim, rimA: R.rimA * 0.45, rm: [2.2, 2.2],
    inner: (c) => {
      const sx = R.back ? 0 : -Math.sin(turn * 1.3) * 10;
      ch_hinaHairRing(c, R, sx, R.back ? -26 : -32);
      // darker inner hair behind the face/neck
      if (!R.back) {
        const gd = c.createRadialGradient(sx + 20 * Math.sin(turn * 1.3), 40, 5, sx, 40, 60);
        gd.addColorStop(0, 'rgba(5,2,4,0.7)'); gd.addColorStop(1, 'rgba(5,2,4,0)');
        c.fillStyle = gd; c.fillRect(-90, -20, 180, 90);
      }
      // clump lines near the ends
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1.1; c.lineCap = 'round';
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p[1] < 30 || i % 2) continue;
        c.beginPath(); c.moveTo(p[0] * 0.96, p[1] - 2); c.quadraticCurveTo(p[0] * 1.02, p[1] - 16, p[0] * 0.98, p[1] - 30); c.stroke();
      }
      c.strokeStyle = rgba(CH_C.hairHi2, 0.35); c.lineWidth = 1;
      for (const sd of [-1, 1]) {
        c.beginPath(); c.moveTo(sx + sd * 58, -8); c.quadraticCurveTo(sx + sd * 63, 14, sx + sd * 56, 34); c.stroke();
      }
      if (R.back) {
        // strand lines from crown
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.4;
        for (let i = -3; i <= 3; i++) {
          c.beginPath(); c.moveTo(i * 3, -60); c.quadraticCurveTo(i * 14, -10, i * 15 + (i % 2) * 4, 50); c.stroke();
        }
      }
    },
  });
  if (R.back) {
    // star clip visible from behind on the right side
    ch_hinaClip(ctx, 50, -26, 1, lw);
  }
}
function ch_hinaToHead(R, p) {
  const d = ch_sub(p, R.head);
  const q = ch_rot(d, -R.headRot);
  return [q[0] / CH_HS, q[1] / CH_HS];
}
function ch_hinaHairRing(c, R, sx, y0) {
  // glossy "angel ring" highlight band with zigzag lower edge
  c.save();
  const g = c.createLinearGradient(0, y0 - 14, 0, y0 + 12);
  g.addColorStop(0, rgba(CH_C.hairHi, 0));
  g.addColorStop(0.45, rgba(CH_C.hairHi, 0.9));
  g.addColorStop(1, rgba(CH_C.hairHi, 0.6));
  c.fillStyle = g;
  c.beginPath();
  const x0 = sx - 50, x1 = sx + 50;
  c.moveTo(x0, y0 + 6);
  c.quadraticCurveTo(sx, y0 - 22, x1, y0 + 6);
  const n = 9;
  for (let i = n; i >= 0; i--) {
    const x = lerp(x0, x1, i / n);
    const yy = y0 + 6 - 13 * Math.sin((i / n) * Math.PI) * 0.6;
    c.lineTo(x + 2, yy + (i % 2 ? 11 : 2));
  }
  c.closePath();
  c.fill();
  c.fillStyle = rgba(CH_C.hairHi2, 0.55);
  c.beginPath();
  c.moveTo(sx - 30, y0 - 2);
  c.quadraticCurveTo(sx - 18, y0 - 10, sx - 6, y0 - 8);
  c.lineTo(sx - 12, y0 + 3); c.lineTo(sx - 18, y0 - 1); c.lineTo(sx - 24, y0 + 4);
  c.closePath(); c.fill();
  c.restore();
}
function ch_hinaClip(ctx, x, y, s, lw) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-0.25); ctx.scale(s, s);
  ch_part(ctx, (c) => { c.beginPath && 0; const p = ch_softStarPts(11.5, 6.2); ch_spline(c, p, true, true, 0.35); },
    { fill: CH_C.clip, shade: CH_C.clipSh, sh: [2.5, -2.5], hi: '#fff7c0', hio: [-2, 2.2], hiA: 0.8, lw: lw * 0.85 });
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ch_ell(ctx, -3, -4, 2, 1.2, -0.6); ctx.fill();
  ctx.restore();
}

// ---- head: face + front hair
const CH_FACE_F = [[0, -50], [35, -36], [50, -4], [49, 10], [47, 24], [42, 36], [31, 47], [14, 56], [0, 58], [-14, 56], [-31, 47], [-42, 36], [-47, 24], [-49, 10], [-50, -4], [-35, -36]];
const CH_FACE_T = [[-2, -51], [37, -36], [49, -6], [47, 9], [49, 22], [45, 34], [36, 46], [23, 55], [13, 58], [-3, 55], [-22, 47], [-34, 35], [-40, 22], [-42, 6], [-42, -8], [-30, -40]];
const CH_FACE_S = [[4, -52], [38, -36], [50, -8], [48, 9], [57, 24], [50, 31], [51, 39], [47, 50], [38, 57], [20, 52], [4, 44], [-6, 34], [-12, 20], [-14, 6], [-14, -14], [-8, -40]];

function ch_hinaFace(ctx, R, o) {
  const E = R.E, turn = R.turn, T = R.T;
  const phi = turn * 1.3;
  const lw = R.lw / CH_HS;
  const det = R.detail;
  const lights = ch_lightsIn(R, (p) => ch_hinaToHead(R, p));
  const face = ch_tri(CH_FACE_F, CH_FACE_T, CH_FACE_S, turn);
  const fpath = (c) => ch_spline(c, face, true);
  const pitchY = R.pitch ? -4 : 0;
  // --- skin
  ch_part(ctx, fpath, {
    fill: CH_C.skin, lw, lights, lightK: 0.55,
    rim: '#ffffff', rimA: 0.0,
    inner: (c) => {
      // cheek shading on the far/back side
      c.fillStyle = rgba(CH_C.skinSh, 0.9);
      c.beginPath();
      if (turn > 0.1) {
        const bx = lerp(-60, -50, turn);
        c.moveTo(bx, -10); c.quadraticCurveTo(-26 + 20 * turn, 10, -24 + 30 * turn, 44); c.lineTo(-80, 60); c.lineTo(-80, -10); c.closePath();
        c.globalAlpha = 0.18 * clamp(turn * 2);
        c.fill(); c.globalAlpha = 1;
      }
      // hair shadow across the forehead (under bangs)
      const cx = 46 * Math.sin(phi);
      c.fillStyle = rgba(CH_C.skinSh, 0.95);
      c.beginPath();
      c.moveTo(-70, -80); c.lineTo(80, -80);
      for (let i = 12; i >= 0; i--) {
        const th = -1.2 + i * 0.2;
        const x = 50 * Math.sin(clamp(th + phi, -1.57, 1.57));
        c.lineTo(x, 2 + (i % 2 ? 9 : 0) + Math.abs(th) * 8);
      }
      c.closePath(); c.fill();
      // soft blush
      const bl = E.blush;
      for (const th of [-0.82, 0.82]) {
        const a = th + phi;
        if (Math.cos(a) < 0.12) continue;
        const bx2 = 43 * Math.sin(a), by = 30 + pitchY;
        const wf = Math.pow(Math.cos(a), 0.6);
        const gr = c.createRadialGradient(bx2, by, 0, bx2, by, 12);
        gr.addColorStop(0, rgba(CH_C.blush, 0.55 * bl)); gr.addColorStop(1, rgba(CH_C.blush, 0));
        c.save(); c.translate(bx2, by); c.scale(wf, 0.6); c.translate(-bx2, -by);
        c.fillStyle = gr; c.fillRect(bx2 - 14, by - 14, 28, 28); c.restore();
        if (det && bl > 0.4) {
          c.strokeStyle = rgba('#ff5a78', 0.5 * bl); c.lineWidth = 0.9;
          for (let j = -1; j <= 1; j++) {
            const hx = bx2 + j * 3.6 * wf;
            c.beginPath(); c.moveTo(hx + 1.5 * wf, by - 2.5); c.lineTo(hx - 1.5 * wf, by + 2.5); c.stroke();
          }
        }
      }
      // under-chin/jaw shade on the neck side
      c.fillStyle = rgba(CH_C.skinSh, 0.55);
      c.beginPath(); ch_ell(c, cx * 0.8 - 6, 60, 40, 9); c.fill();
    },
  });
  // --- eyes
  const eyeY = 12 + pitchY;
  const wide = E.wide || 1;
  const lookX = clamp(o.lookX ?? 0, -1, 1), lookY = clamp(o.lookY ?? (R.pitch ? -0.85 : 0), -1, 1);
  const blink = clamp(o.blink || 0);
  for (const th of [-0.5, 0.5]) {
    const a = th + phi;
    const cs = Math.cos(a);
    if (cs < 0.06) continue;
    const wf = Math.pow(cs, 0.55);
    const ex = 42 * Math.sin(a);
    ch_hinaEye(ctx, ex, eyeY, 25 * wf * wide, 31 * wide, {
      side: th > 0 ? 1 : -1, wf, blink, lookX, lookY, E, det, lw, T, turn,
    });
  }
  // --- nose
  const nX = 47 * Math.sin(phi) + 2, nY = 28 + pitchY;
  ctx.strokeStyle = rgba(CH_C.skinSh2, 1); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  if (turn < 0.9) {
    ctx.beginPath(); ctx.moveTo(nX - 1, nY - 3); ctx.quadraticCurveTo(nX + 2.5, nY + 0.5, nX - 0.5, nY + 2); ctx.stroke();
  }
  if (turn > 0.2) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ch_ell(ctx, nX + 1, nY - 3, 1, 1.4); ctx.fill();
  }
  // --- mouth
  const mX = 47 * Math.sin(phi) - (turn > 0.8 ? 2 : 0), mY = 41 + pitchY;
  ch_hinaMouth(ctx, mX, mY, Math.max(0.42, Math.pow(Math.cos(phi), 0.6)), o.mouth, E, det, lw, T, turn);
  // --- tears (teary)
  if (E.tears) ch_hinaTears(ctx, R, phi, eyeY, det);
  // --- front hair
  ch_hinaHairFront(ctx, R, phi, lw, lights);
  // --- brows (over the bangs, softened)
  for (const th of [-0.5, 0.5]) {
    const a = th + phi;
    const cs = Math.cos(a);
    if (cs < 0.1) continue;
    const wf = Math.pow(cs, 0.55);
    const bx = 42 * Math.sin(a) + 1, by = -8 + (E.browY || 0) + pitchY;
    const sd = th > 0 ? 1 : -1;
    const ang = E.brow * sd;   // + => inner end down
    const L = 11 * wf;
    ctx.save();
    ctx.translate(bx, by); ctx.rotate(ang);
    const brow = (c) => { c.moveTo(-L * sd * 1, 1); c.quadraticCurveTo(0, -3.4, L * sd, 0.4); c.quadraticCurveTo(0, -0.8, -L * sd, 2.6); c.closePath(); };
    // 'see-through bangs' brow: soft skin halo then the brow
    const ga0 = ctx.globalAlpha;
    ctx.globalAlpha = ga0 * 0.22;
    ctx.strokeStyle = CH_C.skin; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
    ctx.beginPath(); brow(ctx); ctx.stroke();
    ctx.globalAlpha = ga0;
    ctx.fillStyle = '#4a2226';
    ctx.beginPath(); brow(ctx); ctx.fill();
    ctx.restore();
  }
  // --- clip
  const ca = -0.98 + phi;
  ch_hinaClip(ctx, 52 * Math.sin(clamp(ca, -1.5, 1.5)), -30, 1, lw);
}

function ch_hinaEye(ctx, cx, cy, w, h, P) {
  const { side, E, det, lw } = P;
  const s = side;
  let close = clamp(Math.max(P.blink, E.lidUp || 0));
  if (E.lidUp < 0 && P.blink < 0.05) close = E.lidUp;
  const lr = clamp(E.lidLow || 0);
  ctx.save();
  ctx.translate(cx, cy);
  const I = [-s * w / 2, -0.02 * h], O = [s * w / 2, -0.1 * h];
  const inkEye = '#24101c';
  if (E.happyEyes || P.blink > 0.82) {
    // closed eyes: happy ^ arcs or blink line
    ctx.strokeStyle = inkEye; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2.2, h * 0.1);
    ctx.beginPath();
    if (E.happyEyes) {
      ctx.moveTo(-s * w * 0.5, h * 0.14);
      ctx.quadraticCurveTo(0, -h * 0.34, s * w * 0.55, h * 0.12);
    } else {
      ctx.moveTo(-s * w * 0.5, h * 0.12);
      ctx.quadraticCurveTo(0, h * 0.34, s * w * 0.55, h * 0.08);
    }
    ctx.stroke();
    if (det) {
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(s * w * 0.5, h * 0.1); ctx.lineTo(s * w * 0.66, E.happyEyes ? h * 0.18 : h * 0.02); ctx.stroke();
    }
    ctx.restore();
    return;
  }
  const cuY = lerp(-0.74 * h, 0.52 * h, clamp(close)) + (close < 0 ? close * h * 0.4 : 0);
  const cu = [-s * w * 0.06, cuY];
  const oY = lerp(O[1], 0.2 * h, clamp(close));
  const Oc = [O[0], oY];
  const Ic = [I[0], lerp(I[1], 0.1 * h, clamp(close))];
  const cl = [s * 0.05 * w, lerp(0.64 * h, 0.2 * h, lr)];
  const Ol = [s * w * 0.46, lerp(0.22 * h, 0.12 * h, lr)];
  const sclera = (c) => {
    c.moveTo(Ic[0], Ic[1]);
    c.quadraticCurveTo(cu[0], cu[1], Oc[0], Oc[1]);
    c.quadraticCurveTo(s * w * 0.52, (Oc[1] + Ol[1]) / 2, Ol[0], Ol[1]);
    c.quadraticCurveTo(cl[0], cl[1], Ic[0], Ic[1]);
    c.closePath();
  };
  // sclera
  ctx.beginPath(); sclera(ctx);
  ctx.fillStyle = '#fdfbff'; ctx.fill();
  ctx.save();
  ctx.clip();
  // iris
  const pk = E.pupil || 1;
  const ix = P.lookX * w * 0.17 + s * w * 0.02, iy = 0.08 * h + P.lookY * h * 0.12;
  const irx = w * 0.4, iry = h * 0.47;
  const gi = ctx.createLinearGradient(0, iy - iry, 0, iy + iry);
  gi.addColorStop(0, CH_C.iris0); gi.addColorStop(0.45, CH_C.iris1); gi.addColorStop(0.85, CH_C.iris2); gi.addColorStop(1, '#f7b56e');
  ctx.fillStyle = gi;
  ctx.beginPath(); ch_ell(ctx, ix, iy, irx, iry); ctx.fill();
  // pupil
  ctx.fillStyle = CH_C.pupil;
  ctx.beginPath(); ch_ell(ctx, ix + w * 0.01, iy - h * 0.02, irx * 0.46 * pk, iry * 0.5 * pk); ctx.fill();
  // lower iris glow
  ctx.fillStyle = 'rgba(255,196,120,0.55)';
  ctx.beginPath(); ch_ell(ctx, ix, iy + iry * 0.55, irx * 0.62, iry * 0.28); ctx.fill();
  if (det) {
    // iris radial streaks
    ctx.strokeStyle = 'rgba(255,200,150,0.25)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.15 + i * Math.PI * 0.1;
      ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * irx * 0.5, iy + Math.sin(a) * iry * 0.45); ctx.lineTo(ix + Math.cos(a) * irx * 0.9, iy + Math.sin(a) * iry * 0.9); ctx.stroke();
    }
  }
  // iris rim
  ctx.strokeStyle = 'rgba(30,10,30,0.8)'; ctx.lineWidth = Math.max(0.8, w * 0.045);
  ctx.beginPath(); ch_ell(ctx, ix, iy, irx, iry); ctx.stroke();
  // upper lid shadow on the eyeball
  const gs = ctx.createLinearGradient(0, cuY * 0.6 - 2, 0, cuY * 0.6 + h * 0.42);
  gs.addColorStop(0, 'rgba(60,30,90,0.55)'); gs.addColorStop(1, 'rgba(60,30,90,0)');
  ctx.fillStyle = gs; ctx.fillRect(-w, -h, w * 2, h * 2);
  // highlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ch_ell(ctx, ix - irx * 0.36, iy - iry * 0.42, irx * 0.36, iry * 0.25, -0.5); ctx.fill();
  ctx.beginPath(); ch_ell(ctx, ix + irx * 0.38, iy + iry * 0.38, irx * 0.14, irx * 0.14); ctx.fill();
  if (det) {
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ch_ell(ctx, ix + irx * 0.1, iy - iry * 0.58, irx * 0.1, irx * 0.1); ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ch_ell(ctx, ix - irx * 0.1, iy + iry * 0.55, irx * 0.4, iry * 0.12); ctx.fill();
    ctx.globalAlpha = 1;
    sparkle(ctx, ix - irx * 0.36, iy - iry * 0.42, irx * 0.5, '#ffffff', 0.9, 0.2);
  }
  if (E.tears) {
    // brimming tears: glossy water line
    ctx.fillStyle = 'rgba(190,230,255,0.45)';
    ctx.beginPath(); ch_ell(ctx, 0, cl[1] * 0.62, w * 0.5, h * 0.16); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ch_ell(ctx, -s * w * 0.05, h * 0.3, w * 0.18, h * 0.04, 0.1 * s); ctx.fill();
    const tw = 0.5 + 0.5 * Math.sin(P.T * 6);
    ctx.globalAlpha = tw;
    ctx.beginPath(); ch_ell(ctx, ix + irx * 0.3, iy - iry * 0.1, irx * 0.08, irx * 0.08); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // lower lid line
  ctx.strokeStyle = 'rgba(90,40,60,0.85)'; ctx.lineWidth = Math.max(0.9, h * 0.035); ctx.lineCap = 'round';
  ctx.beginPath();
  const lm = [(Ol[0] + cl[0]) / 2 + s * w * 0.04, (Ol[1] + cl[1]) / 2 + 1];
  ctx.moveTo(Ol[0] - s * 0.5, Ol[1] + 1);
  ctx.quadraticCurveTo(lm[0] + s * w * 0.05, lm[1] + h * 0.05, s * -w * 0.02, cl[1] * 0.78);
  ctx.stroke();
  // upper lid (thick lash line) with wing
  const th = Math.max(1.6, h * 0.11);
  ctx.fillStyle = inkEye;
  ctx.beginPath();
  ctx.moveTo(Ic[0] + s * 0.5, Ic[1] + 0.5);
  ctx.quadraticCurveTo(cu[0], cu[1], Oc[0], Oc[1]);
  ctx.lineTo(Oc[0] + s * w * 0.1, Oc[1] + h * 0.1);  // wing tip
  ctx.lineTo(Oc[0] + s * w * 0.12, Oc[1] - h * 0.06);
  ctx.quadraticCurveTo(cu[0] + s * w * 0.03, cu[1] - th * 2, Ic[0] + s * w * 0.05, Ic[1] - th * 0.4);
  ctx.closePath(); ctx.fill();
  if (det) {
    // lashes
    ctx.strokeStyle = inkEye; ctx.lineWidth = Math.max(1, h * 0.04); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = 0.62 + i * 0.16;
      const px = lerp(lerp(Ic[0], cu[0], k), lerp(cu[0], Oc[0], k), k), py = lerp(lerp(Ic[1], cu[1], k), lerp(cu[1], Oc[1], k), k) - th * 0.5;
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + s * w * 0.12, py - h * 0.05, px + s * w * (0.16 + i * 0.03), py - h * (0.02 - i * 0.04) - h * 0.06);
      ctx.stroke();
    }
    // lid crease
    ctx.strokeStyle = 'rgba(140,70,80,0.55)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(Ic[0] + s * w * 0.2, Ic[1] - h * 0.3); ctx.quadraticCurveTo(cu[0], cu[1] - h * 0.18, Oc[0] - s * w * 0.1, Oc[1] - h * 0.22); ctx.stroke();
  }
  ctx.restore();
}

const CH_MOUTH = { a: [16, 15, 0.3], i: [18, 5.5, 0.7], u: [8, 8, 0], e: [16, 10, 0.4], o: [11, 14, 0], n: [11, 2.6, 0], c: [13, 6.5, 0.35] };
function ch_hinaMouth(ctx, x, y, wf, mouth, E, det, lw, T, turn) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(wf * 1.1, 1.1);
  let shape = mouth;
  const sm = E.smile || 0;
  let spec = null, closed = null;
  if (shape && shape !== 'x') spec = CH_MOUTH[shape];
  else if (shape === 'x') closed = { w: 9, c: sm * 2 };
  else {
    switch (E.mouth) {
      case 'o': spec = [7, 8, 0]; break;
      case 'smile': spec = [12, 5.5, 0.4]; break;
      case 'big': spec = [17, 12, 0.35]; break;
      case 'grin': spec = [12, 4.5, 0.8]; break;
      case 'wavy': closed = { w: 9, wavy: true }; break;
      case 'wobble': closed = { w: 10, c: 2, wavy: true }; break;
      case 'soft': closed = { w: 10, c: 2.6 }; break;
      default: closed = { w: 8, c: 1.6 };
    }
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (closed) {
    ctx.strokeStyle = '#5a2030'; ctx.lineWidth = Math.max(1.4, lw * 0.6);
    ctx.beginPath();
    const w = closed.w;
    if (closed.wavy) {
      const wob = Math.sin(T * 12) * 0.6;
      ctx.moveTo(-w / 2, 1 - (closed.c || 0) * 0.3);
      ctx.quadraticCurveTo(-w / 4, -1.8 + wob, 0, 0.5);
      ctx.quadraticCurveTo(w / 4, 2.2 - wob, w / 2, 0.2 - (closed.c || 0) * 0.3);
    } else {
      ctx.moveTo(-w / 2, -closed.c * 0.4); ctx.quadraticCurveTo(0, closed.c, w / 2, -closed.c * 0.4);
    }
    ctx.stroke();
  } else {
    let [w, h, teeth] = spec;
    const up = sm > 0 ? sm * 1.6 : sm * 1.2;        // raise corners when smiling
    if (sm > 0.6 && shape) w *= 1.08;
    const L = [-w / 2, -up * 0.5], Rr = [w / 2, -up * 0.5];
    const topY = -h * 0.3 + (sm > 0 ? sm * 0.8 : 0);
    const path = (c) => {
      c.moveTo(L[0], L[1]);
      c.bezierCurveTo(-w * 0.25, topY, w * 0.25, topY, Rr[0], Rr[1]);
      c.bezierCurveTo(w * 0.42, h * 0.95, -w * 0.42, h * 0.95, L[0], L[1]);
      c.closePath();
    };
    ch_part(ctx, path, {
      fill: '#6a1f33', lw: Math.max(1.1, lw * 0.55), ink: '#40111f',
      inner: (c) => {
        if (h > 5) { c.fillStyle = '#e8747f'; c.beginPath(); ch_ell(c, 0, h * 0.72, w * 0.32, h * 0.3); c.fill(); }
        if (teeth > 0) { c.fillStyle = '#ffffff'; c.fillRect(-w, topY - 2, w * 2, h * teeth * 0.45 + 2); }
      },
    });
  }
  ctx.restore();
}
function ch_hinaTears(ctx, R, phi, eyeY, det) {
  const T = R.T;
  for (const th of [-0.5, 0.5]) {
    const a = th + phi;
    if (Math.cos(a) < 0.1) continue;
    const wf = Math.pow(Math.cos(a), 0.55);
    const sd = th > 0 ? 1 : -1;
    const ox = 42 * Math.sin(a) + sd * 12 * wf, oy = eyeY + 9;
    // streak down the cheek
    const k = (T * 0.35 + (sd > 0 ? 0.4 : 0)) % 1;
    ctx.strokeStyle = 'rgba(200,235,255,0.55)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.quadraticCurveTo(ox + sd * 2, oy + 12, ox + sd * 1, oy + 12 + 16 * k); ctx.stroke();
    // drop
    const dy = oy + 12 + 16 * k;
    ctx.save();
    ctx.translate(ox + sd, dy);
    ctx.fillStyle = 'rgba(210,240,255,0.9)';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(3.4, 1, 0, 3.2); ctx.quadraticCurveTo(-3.4, 1, 0, -5); ctx.fill();
    ctx.strokeStyle = 'rgba(80,120,190,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ch_ell(ctx, -0.8, 0, 0.8, 1.2); ctx.fill();
    ctx.restore();
    if (det) sparkle(ctx, ox + sd * 1.2, dy - 1, 4, '#ffffff', 0.6 + 0.4 * Math.sin(T * 5 + sd), 0);
  }
}
function ch_hinaHairFront(ctx, R, phi, lw, lights) {
  const T = R.T;
  const Rh = 53;
  const X = (th) => Rh * Math.sin(clamp(th + phi, -1.52, 1.52));
  const seq = [
    [-1.62, -12, 'v'], [-1.42, 14, 'v'], [-1.22, 52, 't'], [-1.02, 14, 'v'],
    [-0.9, -2, 't'], [-0.76, -17, 'v'], [-0.58, 6, 't'], [-0.42, -15, 'v'], [-0.22, 10, 't'],
    [-0.05, -14, 'v'], [0.14, 7, 't'], [0.32, -15, 'v'], [0.5, 5, 't'], [0.68, -16, 'v'], [0.85, -1, 't'],
    [1.02, 14, 'v'], [1.22, 52, 't'], [1.42, 14, 'v'], [1.62, -12, 'v'],
  ];
  const pts = seq.map(([th, y, ty], i) => {
    let x = X(th);
    let yy = y;
    // a side lock turned away from camera collapses into the face edge: hide it
    if (Math.abs(th) > 1.1 && ty === 't' && Math.cos(th + phi) < 0.3) yy = lerp(14, y, clamp(Math.cos(th + phi) / 0.3));
    if (ty === 't') {
      const amt = y > 30 ? 1 : 0.35;
      const w = ch_hinaHairWind(R, i, amt);
      x += w[0]; yy += w[1];
    }
    // side lock bulges slightly outward
    if (Math.abs(th) > 1.1) x += Math.sign(th) * 4 * Math.cos(th + phi);
    return [x, yy, ty];
  });
  const lower = (c, move) => {
    if (move) c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      let cx, cy;
      if (b[2] === 't') { cx = a[0] + (b[0] - a[0]) * 0.2; cy = a[1] + (b[1] - a[1]) * 0.8; }
      else { cx = a[0] + (b[0] - a[0]) * 0.8; cy = a[1] + (b[1] - a[1]) * 0.2; }
      c.quadraticCurveTo(cx, cy, b[0], b[1]);
    }
  };
  // outline only the strands that sit over skin (not the outer edge of side locks, which lies over the back hair)
  const lowerPart = (c) => {
    const a0 = 2, a1 = pts.length - 3;
    c.moveTo(pts[a0][0], pts[a0][1]);
    for (let i = a0 + 1; i <= a1; i++) {
      const a = pts[i - 1], b = pts[i];
      let cx, cy;
      if (b[2] === 't') { cx = a[0] + (b[0] - a[0]) * 0.2; cy = a[1] + (b[1] - a[1]) * 0.8; }
      else { cx = a[0] + (b[0] - a[0]) * 0.8; cy = a[1] + (b[1] - a[1]) * 0.2; }
      c.quadraticCurveTo(cx, cy, b[0], b[1]);
    }
  };
  const sx = -Math.sin(phi) * 10;
  const topPts = [[pts[pts.length - 1][0], pts[pts.length - 1][1]], [X(1.2) * 0.95 + sx * 0.2, -52], [sx * 0.2 + X(0) * 0.4, -72], [X(-1.2) * 0.95 + sx * 0.5, -54], [pts[0][0], pts[0][1]]];
  const path = (c) => {
    lower(c, true);
    ch_spline(c, topPts, false, false);
    c.closePath();
  };
  ch_part(ctx, path, {
    fill: CH_C.hair, shade: CH_C.hairSh, sh: [6, -5], lw, stroke: (c) => lowerPart(c), lights, lightK: 0.5,
    inner: (c) => {
      ch_hinaHairRing(c, R, sx, -32);
      // strand lines in the bangs
      c.strokeStyle = 'rgba(8,4,6,0.45)'; c.lineWidth = 0.9; c.lineCap = 'round';
      for (let i = 4; i < pts.length - 4; i++) {
        if (pts[i][2] !== 'v') continue;
        const p = pts[i];
        c.beginPath(); c.moveTo(p[0], p[1] - 1); c.quadraticCurveTo(p[0] + (p[0] - sx) * 0.04, p[1] - 8, p[0] * 0.9 + sx * 0.1, p[1] - 16); c.stroke();
      }
      if (R.detail) {
        c.strokeStyle = rgba(CH_C.hairHi2, 0.5); c.lineWidth = 0.9;
        for (let i = 3; i < pts.length - 3; i++) {
          if (pts[i][2] !== 't') continue;
          const p = pts[i];
          c.beginPath(); c.moveTo(p[0] - 1, p[1] - 6); c.quadraticCurveTo(p[0] - 2, p[1] - 18, p[0] * 0.9 - 2, p[1] - 30); c.stroke();
        }
      }
    },
  });
  // flyaway strands in wind
  if (R.wind > 0.15 || R.run) {
    const k = R.run ? 0.6 : R.wind;
    ctx.strokeStyle = CH_C.hair; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const base = [X(-1.1 + i * 0.25) + sx, -40 + i * 6];
      const w = ch_hinaHairWind(R, 20 + i, 1);
      const dx = (R.windX || -1) * (18 + i * 6) * k + w[0];
      ctx.beginPath(); ctx.moveTo(base[0], base[1]);
      ctx.bezierCurveTo(base[0] + dx * 0.4, base[1] - 10, base[0] + dx * 0.8, base[1] + 6 * Math.sin(T * 4 + i), base[0] + dx, base[1] - 4 + 4 * noise1(T * 3 + i, 5));
      ctx.stroke();
    }
  }
}

// =====================================================================
//  KIRA
// =====================================================================
const CH_KEXPR = {
  cry:       { eyes: 'cry', mouth: 'wobble', brow: -1, blush: 0.8, tears: 1, arms: 'eyes' },
  neutral:   { eyes: 'open', mouth: 'small', brow: 0, blush: 0.6, arms: 'down' },
  hope:      { eyes: 'sparkle', mouth: 'smallOpen', brow: -0.4, blush: 0.8, arms: 'clasp', lookY: -0.5 },
  happy:     { eyes: 'happy', mouth: 'big', brow: 0, blush: 1, arms: 'up' },
  gentle:    { eyes: 'soft', mouth: 'soft', brow: -0.2, blush: 0.8, arms: 'down' },
  surprised: { eyes: 'wide', mouth: 'o', brow: 0.5, blush: 0.5, arms: 'up' },
};
function drawKira(ctx, o) {
  const r = Math.max(4, o.size || 40), T = o.T || 0;
  const g = Math.max(0, o.glow ?? 1);
  const X = CH_KEXPR[o.expression] || CH_KEXPR.neutral;
  const small = r < 34;
  const sq = clamp(o.squash || 0, -1, 1);
  const breath = 1 + 0.025 * Math.sin(T * 3.1);
  const sx = (1 - sq * 0.18) * (1 / Math.sqrt(breath)), sy = (1 + sq * 0.22) * breath;
  const alpha = o.alpha ?? 1;
  ctx.save();
  if (alpha < 1) ctx.globalAlpha *= clamp(alpha);
  // --- outer glow & blazing effects (world space)
  const halo = o.halo ?? 1;
  const gg = Math.min(g, 3);
  glow(ctx, o.x, o.y, r * (2.4 + 1.6 * gg) * halo, '#ffc85a', (0.2 + 0.28 * Math.min(gg, 1.5)) * Math.min(1, halo * 1.5));
  glow(ctx, o.x, o.y, r * 1.6 * halo, '#fff3c0', 0.18 + 0.22 * Math.min(gg, 1.5));
  if (g > 1) {
    const k = clamp(g - 1, 0, 2);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.globalCompositeOperation = 'lighter';
    const nr = 12;
    for (let i = 0; i < nr; i++) {
      const a = T * 0.25 + i * TAU / nr + 0.3 * Math.sin(i * 7.3);
      const len = r * (1.5 + 1.1 * k) * (0.6 + 0.4 * Math.sin(T * 1.7 + i * 2.1)) * (i % 2 ? 0.65 : 1);
      const wdt = r * 0.16 * (i % 2 ? 0.7 : 1);
      ctx.save();
      ctx.rotate(a);
      const gr = ctx.createLinearGradient(0, 0, len, 0);
      gr.addColorStop(0, rgba('#fff3c0', 0.45 * Math.min(k, 1)));
      gr.addColorStop(1, rgba('#ffd76a', 0));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(r * 0.3, -wdt); ctx.lineTo(len, 0); ctx.lineTo(r * 0.3, wdt); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    const ns = 6 + Math.floor(8 * Math.min(k, 1.5));
    for (let i = 0; i < ns; i++) {
      const sp = 0.5 + hash(i * 13 + 1) * 0.8;
      const a = T * sp * (i % 2 ? 1 : -1) + hash(i * 7 + 3) * TAU;
      const rr = r * (1.35 + hash(i * 5 + 2) * 1.1 + 0.15 * Math.sin(T * 2 + i));
      const px = o.x + Math.cos(a) * rr, py = o.y + Math.sin(a) * rr * 0.85;
      const tw = 0.5 + 0.5 * Math.sin(T * (3 + hash(i) * 3) + i);
      sparkle(ctx, px, py, r * (0.1 + 0.1 * hash(i * 3 + 9)) * (0.6 + tw * 0.6), i % 3 ? '#fff6d0' : '#ffe08a', Math.min(1, k) * (0.4 + 0.6 * tw), a);
      glow(ctx, px, py, r * 0.3, '#ffe9a8', 0.3 * Math.min(1, k) * tw);
    }
  }
  ctx.translate(o.x, o.y);
  ctx.rotate(o.rot || 0);
  ctx.scale(sx, sy);
  // --- tiny arms (behind body)
  const armMode = o.arms && o.arms !== 'auto' ? o.arms : X.arms;
  const lwk = Math.max(1, r * 0.05);
  // --- body
  const pts = ch_plumpStarPts(r, r * 0.66, 0.08, 0.28);
  const body = (c) => ch_spline(c, pts, true, true, 1);
  const gbody = ctx.createRadialGradient(-r * 0.22, -r * 0.3, r * 0.05, 0, 0, r * 1.05);
  const hot = clamp(g * 0.6);
  gbody.addColorStop(0, '#fffdf2');
  gbody.addColorStop(0.3, mixColor('#fff3c0', '#fffbe8', hot));
  gbody.addColorStop(0.72, mixColor('#ffd76a', '#ffe79a', hot * 0.6));
  gbody.addColorStop(1, mixColor('#f4ac3e', '#ffcf66', hot * 0.5));
  ch_kiraArms(ctx, r, armMode, T, lwk, 'back');
  ch_part(ctx, body, {
    fill: gbody, lw: lwk * 1.05, ink: mixColor('#8a4a14', '#c47a24', hot * 0.5),
    shade: '#f2a13a', sh: [-r * 0.06, -r * 0.1], shadeA: 0.35 * (1 - hot * 0.5),
    hi: '#ffffff', hio: [r * 0.05, r * 0.07], hiA: 0.6,
    inner: (c) => {
      const gi = c.createRadialGradient(0, r * 0.05, 0, 0, r * 0.05, r * 0.7);
      gi.addColorStop(0, rgba('#fffef5', 0.45 * clamp(g))); gi.addColorStop(1, rgba('#fffef5', 0));
      c.fillStyle = gi; c.fillRect(-r, -r, r * 2, r * 2);
    },
  });
  // gloss on top point
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ch_ell(ctx, -r * 0.08, -r * 0.62, r * 0.07, r * 0.16, 0.25); ctx.fill();
  if (!small) { ctx.beginPath(); ch_ell(ctx, -r * 0.62, -r * 0.2, r * 0.1, r * 0.045, -0.3); ctx.fill(); }
  // --- face
  const fy = r * 0.08;
  const blink = clamp(o.blink || 0);
  const lookX = clamp(o.lookX ?? 0, -1, 1), lookY = clamp(o.lookY ?? (X.lookY || 0), -1, 1);
  // blush
  for (const sd of [-1, 1]) {
    const bx = sd * r * 0.42, by = fy + r * 0.2;
    const gr = ctx.createRadialGradient(bx, by, 0, bx, by, r * 0.16);
    gr.addColorStop(0, rgba('#ff8a8a', 0.7 * X.blush)); gr.addColorStop(1, rgba('#ff8a8a', 0));
    ctx.fillStyle = gr; ctx.fillRect(bx - r * 0.2, by - r * 0.2, r * 0.4, r * 0.4);
  }
  for (const sd of [-1, 1]) ch_kiraEye(ctx, sd * r * 0.25, fy - r * 0.02, r, sd, X, blink, lookX, lookY, T, small);
  ch_kiraMouth(ctx, 0, fy + r * 0.27, r, o.mouth, X, T, small);
  // tears
  const tears = o.tears != null ? clamp(o.tears) : X.tears ? 1 : 0;
  if (tears > 0) ch_kiraTears(ctx, r, fy, tears, T);
  ch_kiraArms(ctx, r, armMode, T, lwk, 'front');
  ctx.restore();
}
function ch_kiraEye(ctx, x, y, r, sd, X, blink, lx, ly, T, small) {
  const ew = r * 0.25, eh = r * 0.34;
  ctx.save();
  ctx.translate(x, y);
  const ink = '#2a1330';
  if (X.eyes === 'happy' || blink > 0.8) {
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.4, r * 0.055); ctx.lineCap = 'round';
    ctx.beginPath();
    if (X.eyes === 'happy') { ctx.moveTo(-ew * 0.5, eh * 0.12); ctx.quadraticCurveTo(0, -eh * 0.42, ew * 0.5, eh * 0.12); }
    else { ctx.moveTo(-ew * 0.5, 0); ctx.quadraticCurveTo(0, eh * 0.3, ew * 0.5, 0); }
    ctx.stroke();
    ctx.restore();
    return;
  }
  let open = 1 - blink;
  let top = -eh * 0.5, bot = eh * 0.5;
  if (X.eyes === 'soft') top = -eh * 0.18;
  if (X.eyes === 'cry') top = -eh * 0.38;
  if (X.eyes === 'wide') { top = -eh * 0.56; bot = eh * 0.54; }
  top = lerp(bot - 1, top, open);
  const shape = (c) => {
    c.moveTo(-ew * 0.5, (top + bot) / 2);
    c.bezierCurveTo(-ew * 0.5, top - eh * 0.05, ew * 0.5, top - eh * 0.05, ew * 0.5, (top + bot) / 2);
    c.bezierCurveTo(ew * 0.5, bot + eh * 0.12, -ew * 0.5, bot + eh * 0.12, -ew * 0.5, (top + bot) / 2);
    c.closePath();
  };
  // dark iris fills most of the eye (kawaii mascot eyes)
  ctx.beginPath(); shape(ctx);
  const gi = ctx.createLinearGradient(0, top, 0, bot);
  gi.addColorStop(0, '#1a1240'); gi.addColorStop(0.55, '#3a2f7a'); gi.addColorStop(1, '#7d8cf0');
  ctx.fillStyle = gi; ctx.fill();
  ctx.save(); ctx.clip();
  const ix = lx * ew * 0.15, iy = ly * eh * 0.12;
  // starry specks inside
  ctx.fillStyle = 'rgba(190,210,255,0.8)';
  if (!small) for (let i = 0; i < 4; i++) { ctx.beginPath(); ch_ell(ctx, ix + (hash(i * 3 + (sd > 0 ? 1 : 0)) - 0.5) * ew * 0.6, iy + eh * (0.05 + hash(i + 11) * 0.3), r * 0.012, r * 0.012); ctx.fill(); }
  // highlights
  ctx.fillStyle = '#ffffff';
  const pk = X.eyes === 'wide' ? 0.7 : 1;
  ctx.beginPath(); ch_ell(ctx, ix - ew * 0.14, iy - eh * 0.18, ew * 0.26 * pk, eh * 0.2 * pk, -0.3); ctx.fill();
  ctx.beginPath(); ch_ell(ctx, ix + ew * 0.18, iy + eh * 0.22, ew * 0.1, ew * 0.1); ctx.fill();
  if (X.eyes === 'sparkle' || X.eyes === 'cry') {
    sparkle(ctx, ix + ew * 0.12, iy - eh * 0.02, ew * 0.28, '#ffffff', 0.95, 0.15 * Math.sin(T * 3));
  }
  if (X.eyes === 'cry') {
    ctx.fillStyle = 'rgba(170,220,255,0.45)';
    ctx.beginPath(); ch_ell(ctx, 0, bot - eh * 0.08, ew * 0.55, eh * 0.2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ch_ell(ctx, -ew * 0.1, bot - eh * 0.14, ew * 0.2, eh * 0.04); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.beginPath(); shape(ctx); ctx.stroke();
  // lid line
  if (!small || r > 18) {
    ctx.lineWidth = Math.max(1.2, r * 0.045); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-ew * 0.52, (top + bot) / 2 - eh * 0.08); ctx.bezierCurveTo(-ew * 0.45, top - eh * 0.06, ew * 0.45, top - eh * 0.06, ew * 0.56, (top + bot) / 2 - eh * 0.12); ctx.stroke();
    if (!small) { ctx.beginPath(); ctx.moveTo(sd * ew * 0.5, (top + bot) / 2 - eh * 0.1); ctx.lineTo(sd * ew * 0.66, (top + bot) / 2 - eh * 0.24); ctx.stroke(); }
  }
  // brows (tiny)
  if (X.brow) {
    ctx.strokeStyle = 'rgba(140,70,20,0.8)'; ctx.lineWidth = Math.max(1, r * 0.03);
    const by = -eh * 0.78;
    // X.brow < 0 : worried (inner end up); > 0 : raised
    const inner = -sd * ew * 0.32, outer = sd * ew * 0.34;
    const yi = by + (X.brow < 0 ? X.brow * eh * 0.16 : -X.brow * eh * 0.2), yo = by + (X.brow < 0 ? -X.brow * eh * 0.05 : -X.brow * eh * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(inner, yi); ctx.quadraticCurveTo(0, Math.min(yi, yo) - eh * 0.1, outer, yo); ctx.stroke();
  }
  ctx.restore();
}
function ch_kiraMouth(ctx, x, y, r, mouth, X, T, small) {
  ctx.save();
  ctx.translate(x, y);
  const u = r / 40;
  ctx.scale(u, u);
  const ink = '#4a1a1a';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const open = (w, h, smile) => {
    const mp = (c) => {
      c.moveTo(-w / 2, -smile);
      c.bezierCurveTo(-w * 0.2, -h * 0.25, w * 0.2, -h * 0.25, w / 2, -smile);
      c.bezierCurveTo(w * 0.45, h, -w * 0.45, h, -w / 2, -smile);
      c.closePath();
    };
    ch_part(ctx, mp, {
      fill: '#7a2230', lw: 1.6, ink,
      inner: (c) => { if (h > 4) { c.fillStyle = '#ff8a8e'; c.beginPath(); ch_ell(c, 0, h * 0.95, w * 0.34, h * 0.4); c.fill(); } },
    });
  };
  if (mouth && mouth !== 'x') {
    const m = { a: [10, 10], i: [11, 4], u: [5.5, 5.5], e: [10, 7], o: [7, 9], n: [7, 2], c: [8, 4.5] }[mouth] || [7, 5];
    if (X.mouth === 'wobble') {
      const wob = Math.sin(T * 14) * 0.8;
      ctx.beginPath();
      ctx.moveTo(-m[0] / 2, 1);
      ctx.quadraticCurveTo(-m[0] / 4, -2 + wob, 0, -0.5); ctx.quadraticCurveTo(m[0] / 4, -2 - wob, m[0] / 2, 1);
      ctx.bezierCurveTo(m[0] * 0.4, m[1] * 1.2, -m[0] * 0.4, m[1] * 1.2, -m[0] / 2, 1);
      ctx.fillStyle = '#7a2230'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.stroke();
    } else open(m[0], m[1], X.mouth === 'big' || X.mouth === 'soft' ? 1.2 : 0.3);
  } else {
    switch (X.mouth) {
      case 'wobble': {
        const wob = Math.sin(T * 14) * 0.8;
        ctx.strokeStyle = ink; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-5, 1.5); ctx.quadraticCurveTo(-2.5, -1.5 + wob, 0, 0.5); ctx.quadraticCurveTo(2.5, 2.5 - wob, 5, 1.2); ctx.stroke();
        break;
      }
      case 'big': open(10, 8, 1.5); break;
      case 'smallOpen': open(6, 4.5, 1); break;
      case 'o': open(5.5, 7, 0); break;
      case 'soft':
        ctx.strokeStyle = ink; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-4.5, -0.5); ctx.quadraticCurveTo(0, 3.2, 4.5, -0.5); ctx.stroke(); break;
      default:
        ctx.strokeStyle = ink; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-3.5, -1); ctx.quadraticCurveTo(-1.8, 1.5, 0, 0); ctx.quadraticCurveTo(1.8, 1.5, 3.5, -1); ctx.stroke();
    }
  }
  ctx.restore();
}
function ch_kiraTears(ctx, r, fy, k, T) {
  for (const sd of [-1, 1]) {
    const x0 = sd * r * 0.33, y0 = fy + r * 0.12;
    // stream
    const len = r * (0.35 + 0.45 * k);
    const gr = ctx.createLinearGradient(0, y0, 0, y0 + len);
    gr.addColorStop(0, rgba('#e8f6ff', 0.95 * k)); gr.addColorStop(1, rgba('#9fd8ff', 0.2 * k));
    ctx.fillStyle = gr;
    const wob = Math.sin(T * 9 + sd) * r * 0.015;
    ctx.beginPath();
    ctx.moveTo(x0 - sd * r * 0.02, y0);
    ctx.quadraticCurveTo(x0 + sd * r * 0.12 + wob, y0 + len * 0.5, x0 + sd * r * 0.08, y0 + len);
    ctx.lineTo(x0 + sd * r * 0.16, y0 + len);
    ctx.quadraticCurveTo(x0 + sd * r * 0.2 + wob, y0 + len * 0.4, x0 + sd * r * 0.1, y0 - r * 0.02);
    ctx.closePath(); ctx.fill();
    glow(ctx, x0 + sd * r * 0.1, y0 + len * 0.5, r * 0.3, '#bfe6ff', 0.35 * k);
    // falling drops
    for (let i = 0; i < 2; i++) {
      const ph = (T * 1.3 + i * 0.5 + (sd > 0 ? 0.25 : 0)) % 1;
      const dx = x0 + sd * r * (0.12 + ph * 0.15), dy = y0 + len + ph * r * 0.5;
      const a = k * (1 - ph);
      ctx.fillStyle = rgba('#e8f6ff', a);
      ctx.beginPath(); ctx.moveTo(dx, dy - r * 0.06); ctx.quadraticCurveTo(dx + r * 0.04, dy + r * 0.01, dx, dy + r * 0.03); ctx.quadraticCurveTo(dx - r * 0.04, dy + r * 0.01, dx, dy - r * 0.06); ctx.fill();
      glow(ctx, dx, dy, r * 0.12, '#cfeeff', 0.4 * a);
    }
  }
}
function ch_kiraArms(ctx, r, mode, T, lw, layer) {
  const st = { fill: '#ffcb62', shade: '#e8923a', sh: [r * 0.02, -r * 0.045], shadeA: 0.8, hi: '#fffbe8', hio: [-r * 0.02, r * 0.03], hiA: 0.8, lw, ink: '#8a4a14' };
  const wv = Math.sin(T * 9);
  // [baseX, baseY, angle(rad, 0=+x, screen y down), length] in units of r
  let defs, paws = null;
  switch (mode) {
    case 'up': defs = [[-0.5, 0.12, -2.35 + wv * 0.15, 0.3], [0.5, 0.12, -0.8 - wv * 0.15, 0.3]]; break;
    case 'wave': defs = [[-0.5, 0.2, 2.5, 0.22], [0.5, 0.1, -0.8 + wv * 0.45, 0.32]]; break;
    case 'reach': defs = [[-0.5, 0.2, 2.5, 0.22], [0.5, 0.14, -0.25, 0.34]]; break;
    case 'eyes': defs = []; paws = [[-0.36, 0.28 + wv * 0.01], [0.36, 0.28 - wv * 0.01]]; break;   // rubbing tears
    case 'clasp': defs = []; paws = [[-0.09, 0.56], [0.09, 0.56]]; break;
    default: defs = [[-0.52, 0.24, 2.45 + wv * 0.03, 0.22], [0.52, 0.24, 0.69 - wv * 0.03, 0.22]];
  }
  if (layer === 'back') {
    for (const [x, y, a, l] of defs) {
      const b = [x * r, y * r], e = [b[0] + Math.cos(a) * l * r, b[1] + Math.sin(a) * l * r];
      ch_part(ctx, ch_limbPath([b, e], [r * 0.12, r * 0.1]), st);
    }
  } else if (paws) {
    for (const [x, y] of paws) ch_part(ctx, (c) => ch_ell(c, x * r, y * r, r * 0.11, r * 0.095), st);
  }
}

// =====================================================================
//  VILLAGERS
// =====================================================================
const CH_VIL = {
  grandpa: { body: '#6b5240', body2: '#3a2a20', shirt: '#cfc3a8', skin: '#e8bf9c', hair: '#ece8e0', headR: 50, shoulder: 96, headY: -160 },
  grandma: { body: '#6d4d60', body2: '#3e2636', shirt: '#e6dccb', skin: '#ecc4a4', hair: '#bdb8b4', headR: 48, shoulder: 88, headY: -156 },
  kid: { body: '#ebe5d6', body2: '#b8ae98', shirt: '#ebe5d6', skin: '#dca274', hair: '#1c1412', headR: 52, shoulder: 74, headY: -154 },
  mother: { body: '#7c5c4a', body2: '#48302a', shirt: '#f0e6d2', skin: '#f0c8a6', hair: '#2a1a16', headR: 47, shoulder: 84, headY: -162 },
};
// backlit tone: pull colours towards a warm dark
function ch_vdk(c, k = 0.38) { return mixColor(c, '#2a1810', k); }
function drawVillager(ctx, o) {
  const kind = CH_VIL[o.kind] ? o.kind : 'grandpa';
  const V = CH_VIL[kind];
  const s = o.scale || 1, f = o.facing || 1, T = o.T || 0;
  const wave = clamp(o.wave || 0);
  const back = o.backlight || '#ffb347';
  const lw = 2.6 * Math.pow(s, -0.3);
  const br = Math.sin(T * 2 + kind.length);
  const orb = o.orb != null ? clamp(o.orb) : kind === 'grandpa' ? wave : 0;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
  ctx.translate(o.x, o.y);
  ctx.scale(s * f, s);
  // warm room light blooming around the silhouette
  glow(ctx, 0, -130, 250, back, 0.25);
  const rim = mixColor(back, '#fff4d8', 0.45);
  const RS = { rim, rimA: 0.95, rm: [7, 4], rim2: rim, rim2A: 0.7, rm2: [-6, 4] };
  const light = [{ x: 20, y: -170, r: 200, color: '#ffcf8a', a: 0.1 }];
  const headY = V.headY + br * 0.8;
  const hx = 3 + Math.sin(T * 1.3) * 2;
  const sw = V.shoulder;
  const bodyCol = ch_vdk(V.body), bodySh = ch_vdk(V.body2, 0.3);
  const skin = ch_vdk(V.skin, 0.22), skinSh = ch_vdk(V.skin, 0.55);
  const bodyPath = (c) => {
    c.moveTo(-sw - 16, 6);
    c.bezierCurveTo(-sw - 12, -50, -sw + 2, -86 + br, -sw * 0.42, -94 + br);
    c.quadraticCurveTo(0, -104 + br, sw * 0.42, -94 + br);
    c.bezierCurveTo(sw - 2, -86 + br, sw + 12, -50, sw + 16, 6);
    c.closePath();
  };
  ch_part(ctx, bodyPath, {
    fill: bodyCol, shade: bodySh, sh: [10, 6], lw, ...RS, lights: light,
    inner: (c) => {
      if (kind === 'grandpa') {
        c.fillStyle = ch_vdk(V.shirt);
        c.beginPath(); c.moveTo(-18, -100); c.lineTo(18, -100); c.lineTo(8, 10); c.lineTo(-8, 10); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(20,12,8,0.7)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(-18, -100); c.lineTo(-8, 10); c.moveTo(18, -100); c.lineTo(8, 10); c.stroke();
        c.fillStyle = '#20150f';
        for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-11 + i * 0.3, -60 + i * 26, 2.6, 0, TAU); c.fill(); }
        c.strokeStyle = 'rgba(20,12,8,0.3)'; c.lineWidth = 1.2;
        for (let y = -86; y < 0; y += 9) { c.beginPath(); c.moveTo(-sw, y); c.quadraticCurveTo(-40, y + 3, -22, y); c.moveTo(22, y); c.quadraticCurveTo(40, y + 3, sw, y); c.stroke(); }
      } else if (kind === 'grandma') {
        c.fillStyle = ch_vdk('#8a6a78');
        c.beginPath(); c.moveTo(-sw - 10, -64); c.quadraticCurveTo(0, -26, sw + 10, -64); c.lineTo(sw, -92); c.quadraticCurveTo(0, -56, -sw, -92); c.closePath(); c.fill();
        c.fillStyle = ch_vdk(V.shirt);
        c.beginPath(); c.moveTo(-14, -102); c.lineTo(0, -78); c.lineTo(14, -102); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,220,230,0.25)';
        for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(-60 + i * 15, -40 + (i % 2) * 18, 3, 0, TAU); c.fill(); }
      } else if (kind === 'kid') {
        c.fillStyle = skin;
        for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * (sw + 20), -110); c.lineTo(sd * 28, -110); c.quadraticCurveTo(sd * 32, -60, sd * (sw - 6), -40); c.lineTo(sd * (sw + 20), -40); c.closePath(); c.fill(); }
        c.beginPath(); c.moveTo(-16, -108); c.quadraticCurveTo(0, -84, 16, -108); c.closePath(); c.fill();
        c.fillStyle = ch_vdk('#4a7ac8', 0.3);
        c.fillRect(-sw, -26, sw * 2, 8);
      } else {
        c.fillStyle = ch_vdk(V.shirt);
        c.beginPath(); c.moveTo(-40, -30); c.quadraticCurveTo(0, -46, 40, -30); c.lineTo(46, 10); c.lineTo(-46, 10); c.closePath(); c.fill();
        c.strokeStyle = ch_vdk('#d8c8a8'); c.lineWidth = 3;
        c.beginPath(); c.moveTo(-40, -30); c.lineTo(-26, -100); c.moveTo(40, -30); c.lineTo(26, -100); c.stroke();
        c.fillStyle = ch_vdk(V.shirt);
        c.beginPath(); c.moveTo(-14, -102); c.lineTo(0, -84); c.lineTo(14, -102); c.closePath(); c.fill();
      }
    },
  });
  // neck
  ch_part(ctx, (c) => { c.moveTo(hx - 15, headY + 32); c.lineTo(hx + 15, headY + 32); c.lineTo(16, -96); c.lineTo(-16, -96); c.closePath(); },
    { fill: skin, shade: skinSh, sh: [0, 12], lw });
  ch_vilHead(ctx, kind, V, hx, headY, lw, o, T, RS, light, skin, skinSh);
  // orb held in both hands
  if (orb > 0) {
    const oy = -44 - 5 * Math.sin(T * 2);
    glow(ctx, 0, oy, 120 * (0.6 + orb), '#ffd28a', 0.55 * orb);
    ctx.save();
    ctx.globalAlpha *= orb;
    ch_part(ctx, (c) => ch_ell(c, 0, oy, 21, 21), { fill: '#fff6d6', shade: '#ffc868', sh: [-5, -5], shadeA: 0.7 });
    glow(ctx, 0, oy, 46, '#fff6d8', 0.8);
    sparkle(ctx, 9, oy - 11, 11, '#ffffff', 0.9, T);
    ctx.restore();
    const hl = [{ x: 0, y: oy, r: 90, color: '#ffd28a', a: 0.55 * orb }];
    for (const sd of [-1, 1]) {
      ch_part(ctx, ch_limbPath([[sd * (sw - 6), -30], [sd * 50, -12], [sd * 20, -24]], [16, 14, 12]), { fill: bodyCol, shade: bodySh, sh: [0, -6], lw, ...RS, lights: hl });
      ch_part(ctx, (c) => { c.moveTo(sd * 26, -30); c.quadraticCurveTo(sd * 22, -12, sd * 4, -20); c.quadraticCurveTo(sd * 2, -30, sd * 6, -34); c.quadraticCurveTo(sd * 16, -30, sd * 26, -30); c.closePath(); },
        { fill: skin, shade: skinSh, sh: [sd * 3, -3], lw, lights: hl });
    }
  }
  if (wave > 0 && orb <= 0) {
    const kidA = kind === 'kid';
    const a1 = lerp(0.3, 2.55, wave);
    const a2 = a1 + 0.35 + Math.sin(T * (kidA ? 11 : 8)) * 0.35 * wave;
    const S = [sw * 0.74, -86];
    const E = ch_add(S, ch_dir(a1), 54);
    const Hn = ch_add(E, ch_dir(a2), 46);
    const armCol = kidA ? skin : bodyCol;
    ch_part(ctx, ch_limbPath([S, E, Hn], kidA ? [12, 10, 9] : [15, 12, 10]), { fill: armCol, shade: kidA ? skinSh : bodySh, sh: [4, 4], lw, ...RS });
    ctx.save();
    ctx.translate(Hn[0], Hn[1]);
    ctx.rotate(Math.atan2(-Math.sin(a2), Math.cos(a2)) + Math.PI);
    ch_part(ctx, (c) => {
      c.moveTo(-8, 2); c.quadraticCurveTo(-11, -10, -9, -16); c.quadraticCurveTo(-7, -20, -5, -14);
      c.quadraticCurveTo(-5, -24, -1, -23); c.quadraticCurveTo(2, -16, 1, -14);
      c.quadraticCurveTo(4, -24, 7, -21); c.quadraticCurveTo(8, -14, 7, -10);
      c.quadraticCurveTo(12, -12, 12, -7); c.quadraticCurveTo(9, 0, 8, 2); c.closePath();
    }, { fill: skin, shade: skinSh, sh: [2, 2], lw: lw * 0.9, rim, rimA: 0.8, rm: [3, 2] });
    ctx.restore();
  }
  ctx.restore();
}
function ch_vilHead(ctx, kind, V, hx, hy, lw, o, T, RS, light, skin, skinSh) {
  const r = V.headR;
  ctx.save();
  ctx.translate(hx, hy);
  const hair = ch_vdk(V.hair, kind === 'grandpa' || kind === 'grandma' ? 0.25 : 0.1);
  const hairSh = ch_vdk(V.hair, 0.6);
  if (kind === 'grandma') ch_part(ctx, (c) => ch_ell(c, -4, -r * 1.02, r * 0.42, r * 0.36), { fill: hair, shade: hairSh, sh: [5, 5], lw, ...RS });
  if (kind === 'mother') {
    ch_part(ctx, (c) => { c.moveTo(-r * 0.9, -r * 0.2); c.quadraticCurveTo(-r * 1.3, r * 0.9, -r * 0.85, r * 1.5); c.quadraticCurveTo(-r * 0.3, r * 1.25, -r * 0.4, r * 0.4); c.closePath(); },
      { fill: hair, shade: hairSh, sh: [5, 5], lw, ...RS });
  }
  for (const sd of [-1, 1]) ch_part(ctx, (c) => ch_ell(c, sd * r * 0.95, r * 0.12, r * 0.16, r * 0.24), { fill: skin, shade: skinSh, sh: [sd * -2, 2], lw, rim: RS.rim, rimA: 0.9, rm: [sd * 3, 2] });
  const facePath = (c) => {
    c.moveTo(0, -r);
    c.bezierCurveTo(r * 0.62, -r, r * 0.98, -r * 0.6, r * 0.96, -r * 0.05);
    c.bezierCurveTo(r * 0.95, r * 0.6, r * 0.5, r * 1.0, 0, r * 1.02);
    c.bezierCurveTo(-r * 0.5, r * 1.0, -r * 0.95, r * 0.6, -r * 0.96, -r * 0.05);
    c.bezierCurveTo(-r * 0.98, -r * 0.6, -r * 0.62, -r, 0, -r);
    c.closePath();
  };
  ch_part(ctx, facePath, { fill: skin, shade: skinSh, sh: [10, 7], shadeA: 0.8, lw, ...RS, lights: light });
  if (kind === 'grandpa') {
    for (const sd of [-1, 1]) ch_part(ctx, (c) => { c.moveTo(sd * r * 0.95, -r * 0.4); c.quadraticCurveTo(sd * r * 1.14, -r * 0.05, sd * r * 0.98, r * 0.3); c.quadraticCurveTo(sd * r * 0.8, 0, sd * r * 0.82, -r * 0.44); c.closePath(); }, { fill: hair, shade: hairSh, sh: [sd * -2, 2], lw, rim: RS.rim, rimA: 0.9, rm: [sd * 3, 2] });
    ctx.fillStyle = 'rgba(255,240,220,0.35)'; ctx.beginPath(); ch_ell(ctx, -r * 0.3, -r * 0.72, r * 0.22, r * 0.1, -0.4); ctx.fill();
  } else if (kind === 'grandma') {
    ch_part(ctx, (c) => { c.moveTo(-r * 1.0, r * 0.1); c.bezierCurveTo(-r * 1.1, -r * 1.2, r * 1.1, -r * 1.2, r * 1.0, r * 0.1); c.quadraticCurveTo(r * 0.7, -r * 0.5, 0, -r * 0.55); c.quadraticCurveTo(-r * 0.7, -r * 0.5, -r * 1.0, r * 0.1); c.closePath(); },
      { fill: hair, shade: hairSh, sh: [6, 5], lw, ...RS });
  } else if (kind === 'kid') {
    const pts = [];
    const n = 11;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      const rr = i % 2 ? r * 1.02 : r * 1.3 + Math.sin(T * 3 + i) * 1.5;
      pts.push([Math.cos(a) * rr * 1.02, Math.sin(a) * rr * 0.95 - r * 0.12]);
    }
    ch_part(ctx, (c) => { c.moveTo(-r * 1.0, r * 0.1); for (const p of pts) c.lineTo(p[0], p[1]); c.lineTo(r * 1.0, r * 0.1); c.quadraticCurveTo(r * 0.6, -r * 0.45, r * 0.2, -r * 0.3); c.lineTo(0, -r * 0.5); c.lineTo(-r * 0.3, -r * 0.3); c.quadraticCurveTo(-r * 0.7, -r * 0.45, -r * 1.0, r * 0.1); c.closePath(); },
      { fill: hair, shade: '#000000', sh: [6, 5], lw, ...RS });
  } else {
    ch_part(ctx, (c) => { c.moveTo(-r * 1.02, r * 0.4); c.bezierCurveTo(-r * 1.15, -r * 1.25, r * 1.15, -r * 1.25, r * 1.02, r * 0.2); c.quadraticCurveTo(r * 0.5, -r * 0.55, -r * 0.1, -r * 0.6); c.quadraticCurveTo(-r * 0.6, -r * 0.3, -r * 1.02, r * 0.4); c.closePath(); },
      { fill: hair, shade: hairSh, sh: [6, 5], lw, ...RS });
  }
  // face features
  const blink = clamp(o.blink || 0);
  const ey = r * 0.14, ex = r * 0.36;
  const ink = '#241410';
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineCap = 'round';
  const smiling = kind === 'grandma' || kind === 'grandpa';
  for (const sd of [-1, 1]) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = ink; ctx.fillStyle = ink;
    if (smiling || blink > 0.6) {
      ctx.beginPath(); ctx.moveTo(sd * ex - 7, ey + 1); ctx.quadraticCurveTo(sd * ex, ey - 6, sd * ex + 7, ey + 1); ctx.stroke();
    } else {
      ctx.beginPath(); ch_ell(ctx, sd * ex, ey, 5, 7 * (1 - blink)); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ch_ell(ctx, sd * ex - 1.4, ey - 2.6, 1.7, 1.7); ctx.fill();
    }
    ctx.lineWidth = kind === 'grandpa' ? 5 : 2.6;
    ctx.strokeStyle = kind === 'grandpa' ? ch_vdk('#f0ece4', 0.15) : kind === 'grandma' ? '#7a7470' : ink;
    ctx.beginPath(); ctx.moveTo(sd * ex - 8, ey - 15); ctx.quadraticCurveTo(sd * ex, ey - 20, sd * ex + 8, ey - 15); ctx.stroke();
  }
  if (kind === 'grandpa') {
    ctx.strokeStyle = '#2a1c16'; ctx.lineWidth = 2.2;
    for (const sd of [-1, 1]) { ctx.beginPath(); ch_ell(ctx, sd * ex, ey, 12.5, 11.5); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-ex + 12.5, ey); ctx.quadraticCurveTo(0, ey - 4, ex - 12.5, ey); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,210,0.85)'; ctx.lineWidth = 1.6;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * ex, ey, 8.5, -2.4, -1.7); ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(255,110,100,0.25)';
  for (const sd of [-1, 1]) { ctx.beginPath(); ch_ell(ctx, sd * r * 0.55, r * 0.44, r * 0.16, r * 0.09); ctx.fill(); }
  ctx.strokeStyle = skinSh; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(2, r * 0.27); ctx.quadraticCurveTo(6, r * 0.4, 0, r * 0.44); ctx.stroke();
  // mouth (lip-sync)
  const my = r * 0.64;
  const m = o.mouth;
  const openK = m ? MOUTH_OPEN[m] ?? 0 : 0;
  if (openK > 0.05) {
    const w = 13 + (m === 'i' || m === 'e' ? 6 : m === 'a' ? 3 : 0) - (m === 'u' || m === 'o' ? 4 : 0), h = 3 + openK * 11;
    ch_part(ctx, (c) => { c.moveTo(-w / 2, my); c.quadraticCurveTo(0, my - 2, w / 2, my); c.quadraticCurveTo(w * 0.42, my + h, 0, my + h); c.quadraticCurveTo(-w * 0.42, my + h, -w / 2, my); c.closePath(); }, {
      fill: '#5a1c20', lw: 1.8, ink,
      inner: (c) => { c.fillStyle = '#c86468'; c.beginPath(); ch_ell(c, 0, my + h, w * 0.32, h * 0.35); c.fill(); },
    });
  } else {
    ctx.strokeStyle = ink; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-8, my); ctx.quadraticCurveTo(0, my + 5, 8, my); ctx.stroke();
  }
  if (kind === 'grandpa') {
    const mh = openK > 0.05 ? -2 : 0;
    ch_part(ctx, (c) => {
      c.moveTo(0, my - 10 + mh);
      c.bezierCurveTo(10, my - 15 + mh, 27, my - 9, 30, my + 4);
      c.quadraticCurveTo(19, my - 2, 12, my + 1 + mh);
      c.quadraticCurveTo(4, my - 4 + mh, 0, my - 4 + mh);
      c.quadraticCurveTo(-4, my - 4 + mh, -12, my + 1 + mh);
      c.quadraticCurveTo(-19, my - 2, -30, my + 4);
      c.bezierCurveTo(-27, my - 9, -10, my - 15 + mh, 0, my - 10 + mh);
      c.closePath();
    }, { fill: hair, shade: hairSh, sh: [0, -3], lw: lw * 0.8, rim: RS.rim, rimA: 0.7, rm: [3, 2] });
  }
  ctx.restore();
}
