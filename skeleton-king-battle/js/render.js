'use strict';
// ─────────────────────────────────────────────────────────────
//  Frame composition + player
// ─────────────────────────────────────────────────────────────
const RENDER = {};

function drawStreak(ctx, t, S) {
  // the soldier as a thin bar of pure energy wrapped in lightning
  const flung = t > 14.74 && t < 15.5;
  const span = flung ? 0.42 : 0.17, N = flung ? 30 : 20;
  const pts = [];
  for (let j = 0; j <= N; j++) {
    const tk = t - j * span / N;
    if (tk < 0) break;
    if (HIDDEN.some(h => tk >= h[0] && tk < h[1])) break;
    const p = soldierPos(tk);
    const q = proj(p[0], p[1] + 0.5, p[2]);
    if (!q) break;
    pts.push([q.x, q.y, q.s]);
  }
  if (pts.length < 2) return;
  const sc = clamp(pts[0][2] / 10, 1, 2.8) * (flung ? 2.2 : 1);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  const line = (w, col, jit, seed) => {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const taper = 1 - i / pts.length;
      const ox = jit ? rnds(seed + i * 3.1) * jit * taper : 0, oy = jit ? rnds(seed + i * 5.3) * jit * taper : 0;
      i ? ctx.lineTo(p[0] + ox, p[1] + oy) : ctx.moveTo(p[0], p[1]);
    });
    ctx.stroke();
  };
  // saturated halo with normal blending so the streak reads against bright ice
  ctx.globalCompositeOperation = 'source-over';
  line(15 * sc, 'rgba(105,60,235,0.42)', 0, 0);
  line(6 * sc, 'rgba(70,40,190,0.5)', 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  line(16 * sc, 'rgba(155,123,255,0.28)', 0, 0);
  line(7 * sc, 'rgba(217,200,255,0.75)', 0, 0);
  line(2.6 * sc, '#ffffff', 0, 0);
  const q = Math.floor(t * 40);
  for (let k = 0; k < 3; k++) line(1.3, 'rgba(225,210,255,0.9)', 9 * sc, q * 7 + k * 31);
  glow(ctx, pts[0][0], pts[0][1], 22 * sc, 'rgba(220,205,255,0.9)', 0.8);
  // arcs to the ice when skimming
  if (S.p[1] < 1.6) {
    const g = proj(S.p[0], 0, S.p[2]);
    if (g) for (let k = 0; k < 2; k++) {
      const a = [pts[0][0], pts[0][1]], b = [g.x + rnds(q + k) * 20 * sc, g.y];
      strokeBolt(ctx, jagged(a, b, q + k * 5, 0.3, 4), 1, { sil: false });
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawSoldierSolid(ctx, t, S, R, opts = {}) {
  const s = cardTransform(ctx, S.p[0], S.p[2]);
  if (!s) return;
  const slow = t > 11.6 && t < 14.42 ? 1.5 : 1;
  const k = Math.max(1, 56 / (1.7 * s)) * slow * (opts.scale || 1);
  ctx.translate(S.p[0], S.p[1]);
  ctx.scale(S.face * k, k);
  const RR = { sil: R.sil, ol: 1.25 / (s * k) };
  if (!R.sil && !opts.tint) {
    glow(ctx, 0.1, 0.4, 1.5, 'rgba(90,60,200,0.6)', 0.35);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0.1, 0.4, 1.6, 'rgba(180,150,255,0.8)', 0.35);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  const sp = drawSoldierFigure(ctx, S, RR, { tint: opts.tint, noSpear: t >= 26.5 });
  ctx.globalAlpha = 1;
  // charging lightning around the spear (slow-mo gather, strikes)
  if (!R.sil && !opts.tint) {
    const q = Math.floor(t * (t > 11.6 && t < 14.4 ? 14 : 40));
    const charge = S.poseName === 'charge' ? 2.5 : 1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3 * charge; i++) {
      const a = sp.tip, b = [a[0] + rnds(q + i) * 0.9 * charge, a[1] + rnds(q * 3 + i) * 0.9 * charge];
      strokeBolt(ctx, jagged(a, b, q + i * 13, 0.35, 5), 0.04 * charge, { sil: false });
    }
    if (S.poseName === 'charge' || S.poseName === 'dive') glow(ctx, sp.tip[0], sp.tip[1], 2.4 * charge, 'rgba(230,215,255,1)', 0.8);
    ctx.globalCompositeOperation = 'source-over';
  }
  // sweep slash crescent
  if (S.pose && S.pose.slash && !R.sil) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(225,210,255,0.85)'; ctx.lineWidth = 0.18;
    ctx.beginPath(); ctx.arc(0.2, 0.5, 1.7, -1.2, 0.9); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.06; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawFreeSpear(ctx, t, R) {
  const sp = spearFree(t);
  if (!sp || t >= 28) return;
  const s = cardTransform(ctx, sp.p[0], sp.p[2]);
  if (!s) return;
  const k = Math.max(1, 40 / (2.6 * s));
  ctx.translate(sp.p[0], sp.p[1]); ctx.rotate(sp.ang); ctx.scale(k, k);
  const ol = 1.2 / (s * k);
  ctx.lineCap = 'round';
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 0.06 + ol * 2; KDRAW.line(ctx, [[-1.3, 0], [1.3, 0]]);
  if (!R.sil) { ctx.strokeStyle = '#1b161a'; ctx.lineWidth = 0.06; KDRAW.line(ctx, [[-1.3, 0], [1.3, 0]]); }
  ctx.beginPath(); ctx.moveTo(1.3, 0.08); ctx.lineTo(1.8, 0); ctx.lineTo(1.3, -0.08); ctx.closePath();
  ctx.fillStyle = R.sil ? PAL.ink : iridescent(ctx, [1.3, 0], [1.8, 0]); ctx.fill();
  if (!R.sil && t < 26.7) {
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 1.6, 0, 1.2, 'rgba(230,215,255,1)', 0.9);
    strokeBolt(ctx, jagged([-1.3, 0], [1.8, 0], Math.floor(t * 50), 0.1, 8), 0.05, R);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawScene(ctx, t, R) {
  const C = CAMERA;
  const K = kingPose(t), S = soldierState(t);
  baseTransform(ctx);
  if (!R.sil) {
    drawSky(ctx, t);
    drawGround(ctx, t);
    drawDecals(ctx, t);
    drawReflections(ctx, t, K, S);
  } else {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-C.W, -C.H, C.W * 3, C.H * 3);
  }
  // depth-sorted drawables
  const items = [];
  const depth = (x, z) => { const p = proj(x, 0, z); return p ? p.d : -1; };
  if (!R.sil) {
    for (const b of BLOCKS) {
      if (b.destroyT && t >= b.destroyT) continue;
      const bp = blockPos(b, t);
      const d = depth(bp[0], bp[2]);
      if (d < 2 || d > 420) continue;
      items.push({ d, draw: () => {
        const s = cardTransform(ctx, bp[0], bp[2]); if (!s) return;
        ctx.translate(bp[0], bp[1] - b.size * 0.5); ctx.rotate(bp[3]);
        iceChunk(ctx, s, b.size, b.seed, 1, { sil: false, ol: 1.1 / s });
      } });
    }
    for (const pl of PLATES) {
      const st = plateState(pl, t); if (!st) continue;
      const d = depth(pl.x, pl.z); if (d < 2) continue;
      items.push({ d, draw: () => { const s = cardTransform(ctx, pl.x, pl.z); if (s) drawPlate(ctx, pl, st, { sil: false, ol: 1.1 / s }); } });
    }
    for (const sl of SLABS) {
      const p = slabPos(sl, t); if (!p) continue;
      const d = depth(p[0], p[2]); if (d < 2) continue;
      items.push({ d, draw: () => {
        const s = cardTransform(ctx, p[0], p[2]); if (!s) return;
        ctx.translate(p[0], p[1]); ctx.rotate(p[3]);
        polyFill(ctx, [[-3, -1.2], [-1, 2], [3.4, 1.4], [3, -1.6]], '#cfe2ee', { sil: false, ol: 1.1 / s });
        ctx.fillStyle = PAL.iceDeep; ctx.fillRect(-1, 1.2, 4, 0.5);
      } });
    }
  }
  const kd = depth(K.x, K.z);
  if (kd > 1) items.push({ d: kd, draw: () => { const s = cardTransform(ctx, K.x, K.z); if (s) drawKing(ctx, K, { sil: R.sil, ol: 1.5 / s }); } });
  const A = armorState(t);
  if (A) {
    const d = depth(A.p[0], A.p[2]);
    if (d > 1) items.push({ d, draw: () => {
      const s = cardTransform(ctx, A.p[0], A.p[2]); if (!s) return;
      ctx.translate(A.p[0], A.p[1]); ctx.rotate(A.r);
      drawChestArmorAt(ctx, 0, 0, { sil: R.sil, ol: 1.4 / s });
    } });
  }
  // afterimage left in the smoke (0:06.3 – 0:07.05)
  if (t > 6.3 && t < 7.05 && !R.sil) {
    const G = soldierState(6.3); G.t = t;
    const d = depth(G.p[0], G.p[2]);
    const a = (t < 6.98 ? 0.55 : 0.55 * (1 - (t - 6.98) / 0.07)) * (0.7 + 0.3 * Math.sin(t * 60));
    items.push({ d, draw: () => drawSoldierSolid(ctx, t, G, R, { tint: '#bca8ff', alpha: Math.max(0, a) }) });
  }
  if (!S.hidden) {
    const d = depth(S.p[0], S.p[2]);
    if (d > 0.8) items.push({ d: d - 0.01, draw: () => { if (S.solid) drawSoldierSolid(ctx, t, S, R); else if (!R.sil) { baseTransform(ctx); drawStreak(ctx, t, S); } else drawSoldierSolid(ctx, t, S, R); } });
  }
  const sf = spearFree(t);
  if (sf) items.push({ d: depth(sf.p[0], sf.p[2]), draw: () => drawFreeSpear(ctx, t, R) });
  items.sort((a, b) => b.d - a.d);
  for (const it of items) { ctx.save(); it.draw(); ctx.restore(); }

  // world FX on top
  baseTransform(ctx);
  drawEmberLeak(ctx, t, R);
  drawBursts(ctx, t, R);
  drawRings(ctx, t, R);
  drawBolts(ctx, t, R);
  if (!R.sil) drawSnow(ctx, t);
  return { K, S };
}

function grade(ctx, t) {
  const C = CAMERA;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // ice fog after the fall
  const fog = t >= 28 ? 0 : smooth(ramp(t, 27.1, 28));
  if (fog > 0) {
    const g = ctx.createLinearGradient(0, C.H, 0, C.H * (0.9 - fog * 0.9));
    g.addColorStop(0, `rgba(228,236,242,${0.95 * fog})`); g.addColorStop(1, 'rgba(228,236,242,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, C.W, C.H);
    ctx.fillStyle = `rgba(222,230,238,${0.55 * fog})`; ctx.fillRect(0, 0, C.W, C.H);
  }
  // whole field lit white-violet by the plate-row lightning (23.3)
  const vf = t >= 23.3 && t < 23.7 ? 1 - (t - 23.3) / 0.4 : 0;
  if (vf > 0) {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(150,120,255,${0.55 * vf})`; ctx.fillRect(0, 0, C.W, C.H);
    ctx.globalCompositeOperation = 'source-over';
  }
  // cold vignette
  const v = ctx.createRadialGradient(C.W / 2, C.H / 2, C.H * 0.35, C.W / 2, C.H / 2, C.H * 0.95);
  v.addColorStop(0, 'rgba(10,16,28,0)'); v.addColorStop(1, 'rgba(10,16,28,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, C.W, C.H);
}

function impactPost(ctx, t, imp) {
  const C = CAMERA;
  const p = imp.e.p ? proj(...imp.e.p) : null;
  // impact point in rolled screen space
  let cx = C.W / 2, cy = C.H / 2;
  if (p) {
    const r = C.roll, dx = p.x - C.W / 2, dy = p.y - C.H / 2;
    cx = C.W / 2 + dx * Math.cos(r) - dy * Math.sin(r); cy = C.H / 2 + dx * Math.sin(r) + dy * Math.cos(r);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const seed = Math.floor(t * 60) * 3.3;
  if (imp.kind === 'white') {
    ctx.fillStyle = `rgba(255,255,255,${0.85 * imp.strength})`; ctx.fillRect(0, 0, C.W, C.H);
    focusLines(ctx, cx, cy, `rgba(40,40,60,${0.5 * imp.strength})`, seed, 60);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, cx, cy, 220, 'rgba(220,205,255,1)', 0.8 * imp.strength);
    ctx.globalCompositeOperation = 'source-over';
  } else if (imp.kind === 'sil') {
    focusLines(ctx, cx, cy, PAL.ink, seed, 80);
  } else if (imp.kind === 'neon') {
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, C.W, C.H);
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createLinearGradient(0, 0, C.W, C.H);
    const A = 'rgba(255,122,26,0.55)', B = 'rgba(217,200,255,0.6)';
    g.addColorStop(0, imp.invertAccent ? B : A); g.addColorStop(1, imp.invertAccent ? A : B);
    ctx.fillStyle = g; ctx.fillRect(0, 0, C.W, C.H);
    ctx.globalCompositeOperation = 'source-over';
    focusLines(ctx, cx, cy, 'rgba(255,255,255,0.7)', seed, 70);
  }
}

function renderFrame(ctx, t) {
  t = clamp(t, 0, DURATION - 1e-4);
  const C = CAMERA;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (t >= 28) { drawHero(ctx, t); grade(ctx, t); return; }
  const cut = CUTINS.find(c => t >= c.t0 && t < c.t1);
  if (cut) { drawCutin(ctx, t, cut); return; }
  camSetup(t);
  const imp = impactAt(t);
  if (imp && imp.kind === 'sil') {
    drawScene(ctx, t, { sil: true });
    impactPost(ctx, t, imp);
    return;
  }
  drawScene(ctx, t, { sil: false });
  grade(ctx, t);
  if (imp) impactPost(ctx, t, imp);
}

// ── player ──────────────────────────────────────────────────
(function boot() {
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  CAMERA.W = canvas.width; CAMERA.H = canvas.height; CAMERA.f = canvas.height * 0.89;
  WORLD.init();
  FX.init();

  const ui = {
    play: document.getElementById('play'), scrub: document.getElementById('scrub'), time: document.getElementById('time'),
    section: document.getElementById('section'), speed: document.getElementById('speed'), loop: document.getElementById('loop'),
    marks: document.getElementById('marks'), fs: document.getElementById('fs'),
  };
  const params = new URLSearchParams(location.search);
  let t = parseFloat(params.get('t') || '0') || 0;
  let playing = params.get('paused') === null && params.get('t') === null;
  let speed = 1, last = performance.now();

  for (const [st, label] of SECTIONS) {
    const b = document.createElement('button');
    b.textContent = label.split(' ')[0];
    b.title = label;
    b.style.left = (st / DURATION * 100) + '%';
    b.onclick = () => { t = st; draw(); };
    ui.marks.appendChild(b);
  }
  function fmt(x) { const s = Math.floor(x), f = Math.floor((x - s) * 24); return `0:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`; }
  function draw() {
    renderFrame(ctx, t);
    ui.scrub.value = t;
    ui.time.textContent = fmt(t) + ' / 0:30:00';
    let lab = SECTIONS[0][1]; for (const s of SECTIONS) if (t >= s[0]) lab = s[1];
    if (t >= 11.62 && t < 14.42) lab += '  ⟨SUPER SLOW⟩';
    ui.section.textContent = lab;
    ui.play.textContent = playing ? '❚❚' : '▶';
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (playing) {
      t += dt * speed;
      if (t >= DURATION) { if (ui.loop.checked) t = 0; else { t = DURATION - 1e-3; playing = false; } }
    }
    draw();
    requestAnimationFrame(frame);
  }
  ui.play.onclick = () => { if (t >= DURATION - 0.01) t = 0; playing = !playing; };
  ui.scrub.oninput = () => { t = parseFloat(ui.scrub.value); playing = false; };
  ui.speed.onchange = () => { speed = parseFloat(ui.speed.value); };
  ui.fs.onclick = () => { const el = document.getElementById('wrap'); (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen()); };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); ui.play.onclick(); }
    else if (e.code === 'ArrowRight') { t = Math.min(DURATION - 1e-3, t + (e.shiftKey ? 1 : 1 / 24)); playing = false; }
    else if (e.code === 'ArrowLeft') { t = Math.max(0, t - (e.shiftKey ? 1 : 1 / 24)); playing = false; }
    else if (e.code === 'Home') { t = 0; }
  });
  // hooks for headless frame capture
  window.renderAt = (x) => { t = x; playing = false; renderFrame(ctx, x); return true; };
  window.BATTLE_READY = true;
  requestAnimationFrame(frame);
})();
