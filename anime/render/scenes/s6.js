// Scene s6 — the farewell on the hilltop (41.5–53.0).
// Uses the shared hilltop set painter s26_* defined in s2.js.
'use strict';

const S6 = {
  HX: 1060, HY: 920,                 // Hina's feet (world, p=1)
  K0: { x: 1390, y: 540 },          // Kira's floating spot in front of her
  KSIZE: 120,
};

// ---- timing helpers ----
function s6_wind(T) { return 0.45 + 0.4 * prog(T, 41.5, 44) + 0.15 * Math.sin(T * 0.7) * 0.5 + 0.2 * prog(T, 51.8, 53); }

function s6_hina(T) {
  const lift = prog(T, 41.5, 42.05, Ease.outCubic) * (1 - prog(T, 42.8, 43.8, Ease.inOutQuad));
  let expression = 'joy';
  if (T >= 42.0) expression = 'surprised';
  if (T >= 43.0) expression = 'smile';
  if (T >= 45.0) expression = 'teary';
  if (T >= 47.1) expression = 'smile';
  if (T >= 48.3) expression = 'gentle';
  if (T >= 52.1) expression = 'joy';
  const K = s6_kira(T);
  const KL = s6_kiraLight(K, T);
  const o = {
    T, x: S6.HX, y: S6.HY, scale: 1.0, facing: 1, view: 'threeQuarter',
    pose: 'hold', armRaise: 0.15 + 0.85 * lift,
    expression,
    mouth: mouthAt('hina', T),
    blink: T > 51.35 && T < 52.05 ? prog(T, 51.35, 51.5) * (1 - prog(T, 51.9, 52.05)) : blinkAt(T, 61),
    lookX: 0.6, lookY: -0.5,
    headTilt: T > 45 ? -0.08 - 0.06 * prog(T, 50.8, 51.4) : 0,
    wind: 0.55 + 0.4 * prog(T, 41.5, 44) + 0.1 * noise1(T * 1.5, 4),
    lantern: { glow: T < 42.0 ? 1.0 : lerp(1.0, 0.35, prog(T, 42.0, 42.8)), kiraInside: T < 42.0 },
  };
  if (KL) o.light = { x: KL.x, y: KL.y, color: '#ffd98a', radius: KL.r, strength: 0.9 };
  if (K) {
    // eyes follow Kira
    const hp = s26_headPos(o);
    const dx = K.x - hp.x, dy = K.y - hp.y, dl = Math.hypot(dx, dy) || 1;
    o.lookX = clamp(dx / dl, -1, 1); o.lookY = clamp(dy / dl * 1.2, -1, 1);
  }
  return o;
}

// Kira in world coords (p=1) or null while still inside the lantern
function s6_kira(T) {
  if (T < 42.0) return null;
  const bob = Math.sin(T * 2.1) * 12 + Math.sin(T * 0.9) * 6;
  let x = S6.K0.x, y = S6.K0.y + bob, size = S6.KSIZE, rot = Math.sin(T * 1.3) * 0.06;
  if (T < 43.3) {
    // burst out of the lantern, swell and float up to face her
    const hp0 = s26_lanternPos({ x: S6.HX, y: S6.HY, scale: 1, facing: 1, view: 'threeQuarter', pose: 'hold', armRaise: 1, lantern: { glow: 1 } });
    const u = prog(T, 42.0, 43.3, Ease.outCubic);
    x = lerp(hp0.x, S6.K0.x, u);
    y = lerp(hp0.y, S6.K0.y + bob, u) - Math.sin(u * Math.PI) * 120;
    size = lerp(8, S6.KSIZE, Ease.outBack(prog(T, 42.0, 43.1), 1.3));
    rot = (1 - u) * 1.8;
  }
  if (T > 50.6) {
    // drift close for the forehead touch
    const o = { x: S6.HX, y: S6.HY, scale: 1, facing: 1, view: 'threeQuarter', pose: 'hold', armRaise: 0.15, T, lantern: { glow: 0.35 } };
    const hp = s26_headPos(o);
    const u = prog(T, 50.6, 51.3, Ease.inOutCubic);
    x = lerp(x, hp.x + 175, u);
    y = lerp(y, hp.y - 40 + bob * 0.3, u);
    size = lerp(size, 95, u);
    rot = lerp(rot, -0.35, u);
  }
  if (T > 52.0) {
    // begins to rise (s7 takes over with the launch)
    const u = prog(T, 52.0, 53.0, Ease.inQuad);
    y -= u * 230;
    x += u * 40;
    rot = lerp(rot, 0, u);
  }
  let expression = 'gentle';
  if (T >= 49.8) expression = 'happy';
  const glowK = 1.3 + 0.25 * prog(T, 42.0, 42.5) * (1 - prog(T, 42.5, 43.5)) * 3 + 0.1 * Math.sin(T * 3.1) + 0.3 * prog(T, 52, 53);
  return { x, y, size, rot, expression, glow: glowK };
}

function s6_kiraLight(K, T) {
  if (!K) return null;
  return { x: K.x, y: K.y, gy: S6.HY, r: 700 + K.size * 3, a: clamp(0.35 + 0.35 * (K.glow - 0.8)), color: '#ffd98a' };
}

// orbiting sparkles + glow + Kira herself (world coords or screen, whatever ctx is in)
function s6_drawKiraFx(ctx, T, K, sc = 1) {
  const s = K.size * sc;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, K.x, K.y, s * 7, '#ffa040', 0.11);
  glow(ctx, K.x, K.y, s * 3.2, '#ffe39a', 0.3);
  // orbit ring: back half
  const r = rng(616);
  const orbit = [];
  for (let i = 0; i < 16; i++) {
    const sp = 0.7 + r() * 0.8, ph = r() * TAU, rad = s * (1.35 + r() * 0.7), tilt = 0.28 + r() * 0.15;
    const a = T * sp + ph;
    orbit.push({ x: K.x + Math.cos(a) * rad, y: K.y + Math.sin(a) * rad * tilt - s * 0.1, front: Math.sin(a) > 0, sz: s * (0.06 + r() * 0.08), tw: 0.6 + 0.4 * Math.sin(T * 6 + i) });
  }
  for (const q of orbit) if (!q.front) sparkle(ctx, q.x, q.y, q.sz, '#fff3c0', 0.6 * q.tw, T);
  ctx.restore();
  drawKira(ctx, { x: K.x, y: K.y, size: s, T, mouth: mouthAt('kira', T), glow: K.glow, expression: K.expression, rot: K.rot, blink: blinkAt(T, 77), lookX: -0.5, lookY: 0.1, tears: 0 });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const q of orbit) if (q.front) { sparkle(ctx, q.x, q.y, q.sz * 1.3, '#ffffff', q.tw, -T); glow(ctx, q.x, q.y, q.sz * 3, '#ffd76a', 0.3 * q.tw); }
  ctx.restore();
}

// the emergence burst from the lantern (world)
function s6_emergeFx(ctx, T) {
  const tt = T - 42.0;
  if (tt < -0.4 || tt > 1.6) return;
  const hp = s26_lanternPos({ x: S6.HX, y: S6.HY, scale: 1, facing: 1, view: 'threeQuarter', pose: 'hold', armRaise: 1, lantern: { glow: 1 } });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (tt < 0) {
    glow(ctx, hp.x, hp.y, 160 + 200 * invLerp(-0.4, 0, tt), '#ffd76a', 0.5 * invLerp(-0.4, 0, tt));
  } else {
    const k = Math.exp(-tt * 3);
    glow(ctx, hp.x, hp.y, 250 + tt * 500, '#fff3c0', 0.9 * k);
    ctx.strokeStyle = rgba('#fff3c0', 0.8 * k);
    ctx.lineWidth = 6 * k + 1;
    ctx.beginPath(); ctx.ellipse(hp.x, hp.y, 40 + tt * 520, 30 + tt * 380, 0, 0, TAU); ctx.stroke();
    const r = rng(4200);
    for (let i = 0; i < 40; i++) {
      const a = r() * TAU, sp = 200 + r() * 500, life = 0.8 + r() * 0.8;
      if (tt > life) continue;
      const d = sp * (1 - Math.exp(-tt * 2.5)) / 2.5 * 2;
      const x = hp.x + Math.cos(a) * d, y = hp.y + Math.sin(a) * d * 0.8 + tt * tt * 60;
      sparkle(ctx, x, y, 6 + r() * 12, r() < 0.5 ? '#ffffff' : '#ffe39a', 1 - tt / life, tt * 4 + i);
    }
  }
  ctx.restore();
}

// forehead touch: tiny point of light + bloom + chime ring
function s6_touchFx(ctx, T, fh, K, sc = 1) {
  if (T < 50.95 || T > 53) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // point travels from Kira's front tip to the forehead
  const tip = { x: K.x - K.size * sc * 0.95, y: K.y - K.size * sc * 0.1 };
  const u = prog(T, 50.95, 51.5, Ease.inOutQuad);
  const px = lerp(tip.x, fh.x, u), py = lerp(tip.y, fh.y, u) - Math.sin(u * Math.PI) * 20 * sc;
  const fade = 1 - prog(T, 52.2, 52.9);
  if (T < 51.5) {
    glow(ctx, px, py, 40 * sc, '#fff3c0', 0.9);
    sparkle(ctx, px, py, 14 * sc, '#ffffff', 1, T * 3);
    // faint thread of light back to Kira
    ctx.strokeStyle = rgba('#ffe7a0', 0.35 * u);
    ctx.lineWidth = 2 * sc;
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(px, py); ctx.stroke();
  } else {
    const tt = T - 51.5;
    const bloom = Math.exp(-tt * 2.2);
    glow(ctx, fh.x, fh.y, (60 + 220 * (1 - Math.exp(-tt * 4))) * sc, '#ffe6a8', (0.18 + 0.4 * bloom) * fade);
    glow(ctx, fh.x, fh.y, 22 * sc, '#ffffff', 0.75 * fade);
    sparkle(ctx, fh.x, fh.y, (18 + 10 * Math.sin(T * 8)) * sc, '#ffffff', fade, T);
    // chime rings
    for (let i = 0; i < 3; i++) {
      const v = tt - i * 0.18;
      if (v <= 0 || v > 1.4) continue;
      ctx.strokeStyle = rgba('#ffe7a0', 0.6 * (1 - v / 1.4));
      ctx.lineWidth = 3 * sc;
      ctx.beginPath(); ctx.arc(fh.x, fh.y, (20 + v * 260) * sc, 0, TAU); ctx.stroke();
    }
    // little motes spilling out
    const r = rng(5151);
    for (let i = 0; i < 18; i++) {
      const a = r() * TAU, sp = (60 + r() * 160) * sc;
      const x = fh.x + Math.cos(a) * sp * Math.min(tt, 1.2), y = fh.y + Math.sin(a) * sp * Math.min(tt, 1.2) - tt * 30 * sc;
      sparkle(ctx, x, y, (4 + r() * 6) * sc, '#fff3c0', fade * (1 - Math.min(1, tt / 1.5)), tt * 3 + i);
    }
  }
  ctx.restore();
}

// Hina in the world with warm rim light from Kira & lantern, long soft shadow
function s6_drawHinaWorld(ctx, T, cam, o, K) {
  // long soft shadow cast away from Kira along the ground
  if (K) {
    const dx = o.x - K.x, len = 160 + 120 * clamp(Math.abs(dx) / 400);
    ctx.save();
    ctx.translate(o.x, o.y + 4);
    ctx.scale(1, 0.18);
    const sgn = Math.sign(dx) || -1;
    const g = ctx.createLinearGradient(0, 0, sgn * len * 2, 0);
    g.addColorStop(0, 'rgba(2,6,14,0.55)'); g.addColorStop(1, 'rgba(2,6,14,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(sgn * len, 0, len * 1.1, 90, 0, 0, TAU); ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(2,6,12,0.45)';
    ctx.beginPath(); ctx.ellipse(o.x - 20, o.y + 3, 90, 14, 0, 0, TAU); ctx.fill();
  }
  let lx = 1, ly = -0.2;
  if (K) {
    const a = s26_toScreen(cam, 1, o.x, o.y - 300), b = s26_toScreen(cam, 1, K.x, K.y);
    const dl = Math.hypot(b.x - a.x, b.y - a.y) || 1; lx = (b.x - a.x) / dl; ly = (b.y - a.y) / dl;
  }
  const zoom = cam.zoom || 1;
  s26_litActor(ctx, (c) => drawHina(c, o), {
    lx, ly, width: 3 + 3 * zoom, rim: '#ffe2a0', rimA: K ? 0.75 : 0.35,
    shade: '#141a44', shadeA: 0, blur: 3 * zoom, box: s26_hinaBox(cam, o),
  });
}

function s6_lights(T, o, K) {
  const hp = s26_lanternPos(o);
  const lg = o.lantern.glow;
  const L = [{ x: hp.x, y: hp.y + 20, gy: o.y, r: 300 + 250 * lg, a: 0.3 + 0.5 * lg, color: '#ffb347' }];
  const KL = s6_kiraLight(K, T);
  if (KL) L.push(KL);
  return L;
}

// ------------------------------------------------------------------
// shots
// ------------------------------------------------------------------
function s6_worldShot(ctx, T, cam, { drawHinaInSet = true } = {}) {
  const o = s6_hina(T);
  const K = s6_kira(T);
  const lights = s6_lights(T, o, K);
  const wind = s6_wind(T);
  s26_drawSet(ctx, T, cam, {
    lights, wind, fireflies: 16,
    villageDim: 0,
    actorY: o.y,
    actors: (c) => {
      if (drawHinaInSet) {
        s6_drawHinaWorld(c, T, cam, o, K);
        const hp = s26_lanternPos(o);
        glow(c, hp.x, hp.y, 120 + 120 * o.lantern.glow, '#ffb347', 0.25 + 0.3 * o.lantern.glow);
      }
      s6_emergeFx(c, T);
      if (K) s6_drawKiraFx(c, T, K);
      if (K && drawHinaInSet) {
        const hp = s26_headPos(o);
        const fh = hp.forehead || { x: hp.x + hp.r * 0.25, y: hp.y - hp.r * 0.35 };
        s6_touchFx(c, T, fh, K);
      }
    },
    drift: { n: 46, wind, seed: 646, motes: 1 },
  });
  return { o, K };
}

// A: wide (41.5–43.4): lantern lifted, Kira bursts out
function s6_shotA(ctx, T) {
  const u = prog(T, 41.5, 43.4, Ease.inOutQuad);
  s6_worldShot(ctx, T, { x: 1060 + u * 40, y: 520 + u * 10, zoom: 1.02 + u * 0.1 });
}
// B: medium two-shot (43.4–45.9)
function s6_shotB(ctx, T) {
  const u = prog(T, 43.4, 45.9, Ease.inOutQuad);
  s6_worldShot(ctx, T, { x: 1215 + u * 10, y: 590 - u * 5, zoom: 1.62 + u * 0.1 });
}
// C: close-up on Hina (45.9–48.1) — bust, teary then smiling
function s6_shotC(ctx, T) {
  const u = prog(T, 45.9, 48.1, Ease.inOutQuad);
  const cam = { x: 1120 + u * 10, y: 520, zoom: 2.3 + u * 0.12 };
  const K = s6_kira(T);
  const o = s6_hina(T);
  const lights = s6_lights(T, o, K);
  s26_drawSet(ctx, T, cam, { lights, wind: s6_wind(T), fireflies: 10, drift: { n: 30, wind: s6_wind(T), seed: 647 } });
  // Kira's glow spilling in from off-frame right
  const ks = s26_toScreen(cam, 1, K.x, K.y);
  glow(ctx, Math.min(ks.x, W + 100), ks.y, 1100, '#ffc870', 0.45);
  glow(ctx, Math.min(ks.x, W + 100), ks.y, 420, '#fff3c0', 0.45);
  const hb = {
    ...o, x: 760 - u * 12, y: 1180, scale: 2.35, bust: true,
    lookX: 0.75, lookY: -0.25, headTilt: -0.1 + 0.03 * Math.sin(T * 0.8),
    lantern: null,
  };
  s26_litActor(ctx, (c) => drawHina(c, hb), {
    lx: 0.95, ly: -0.3, width: 9, rim: '#ffe2a0', rimA: 0.85, shade: '#141a44', shadeA: 0.1, blur: 6,
    box: { x: hb.x - 700, y: 0, w: 1400, h: H },
  });
  // tears glinting
  const hp = s26_headPos(hb);
  const tearK = prog(T, 45.3, 46.2) * (1 - 0.5 * prog(T, 47.6, 48.1));
  if (tearK > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [ex, dir] of [[0.12, 1], [0.52, -1]]) {
      const x = hp.x + hp.r * ex, y0 = hp.y + hp.r * 0.12;
      const fall = ((T * 0.35 + ex) % 1);
      const y = y0 + fall * hp.r * 0.35 * (T > 46.6 ? 1 : 0);
      const tw = 0.6 + 0.4 * Math.sin(T * 9 + ex * 20);
      glow(ctx, x, y, 22, '#ffffff', 0.45 * tearK * tw);
      sparkle(ctx, x, y, 12 + 6 * tw, '#ffffff', tearK * tw, 0.3 * dir);
    }
    ctx.restore();
  }
}
// D: Kira close-up over Hina's shoulder (48.1–50.6) — the promise
function s6_shotD(ctx, T) {
  const u = prog(T, 48.1, 50.6, Ease.inOutQuad);
  const K = s6_kira(T);
  const cam = { x: K.x - 170 + u * 20, y: S6.K0.y + 30, zoom: 2.0 + u * 0.15 };
  const o = s6_hina(T);
  const lights = s6_lights(T, o, K);
  s26_drawSet(ctx, T, cam, {
    lights, wind: s6_wind(T), fireflies: 12,
    actors: (c) => s6_drawKiraFx(c, T, K),
    drift: { n: 40, wind: s6_wind(T), seed: 648 },
  });
  // Hina's shoulder & back of head, out of focus in the foreground, warm rim from Kira
  const hb = {
    ...o, x: 330, y: 1260, scale: 2.7, bust: true, view: 'back', facing: 1,
    mouth: null, lantern: null, headTilt: -0.05,
  };
  s26_litActor(ctx, (c) => drawHina(c, hb), {
    lx: 0.9, ly: -0.4, width: 12, rim: '#ffe2a0', rimA: 0.9, shade: '#070a20', shadeA: 0.55, blur: 8,
    box: { x: 0, y: 0, w: 1000, h: H },
  });
}
// E: side two-shot (50.6–53.0): forehead touch, then Kira begins to rise
function s6_shotE(ctx, T) {
  const u = prog(T, 50.6, 51.6, Ease.inOutQuad);
  const rise = prog(T, 52.0, 53.0, Ease.inOutQuad);
  s6_worldShot(ctx, T, { x: 1185 + u * 20, y: 560 - rise * 70, zoom: 1.95 + u * 0.12 - rise * 0.1 });
}

registerScene('s6', {
  draw(ctx, t, T, d) {
    if (T < 43.4) s6_shotA(ctx, T);
    else if (T < 45.9) s6_shotB(ctx, T);
    else if (T < 48.1) s6_shotC(ctx, T);
    else if (T < 50.6) s6_shotD(ctx, T);
    else s6_shotE(ctx, T);
  },
});
