// Frame compositor: picks the scene(s) for global time T, applies
// transitions, subtitles and film post-processing.
'use strict';

const SUB_COLORS = { narrator: '#e8e0c8', hina: '#ffd0d6', kira: '#ffe9a0', grandpa: '#d9c7a8', kid: '#bfe3ff' };
const SUB_NAMES = { narrator: '', hina: 'ヒナ', kira: 'キラ', grandpa: 'おじいさん', kid: 'こども' };

const _buffers = {};
function buffer(name) {
  if (!_buffers[name]) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    _buffers[name] = c;
  }
  return _buffers[name];
}

function drawScene(ctx, sc, T) {
  const def = SCENES[sc.id];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (def) def.draw(ctx, T - sc.start, T, sc.end - sc.start);
  else {
    ctx.fillStyle = '#333'; ctx.font = '80px sans-serif'; ctx.fillText(`missing scene ${sc.id}`, 100, 200);
  }
  ctx.restore();
}

function renderFrame(T) {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const scenes = TIMELINE.scenes;
  let idx = scenes.findIndex((s) => T >= s.start && T < s.end);
  if (idx < 0) idx = scenes.length - 1;
  const sc = scenes[idx];
  const tr = sc.transitionIn || { type: 'cut' };
  const into = T - sc.start;

  drawScene(ctx, sc, T);

  // transitions blend the tail of the previous scene (rendered at its own end, time-frozen-ish)
  if (idx > 0 && tr.dur && into < tr.dur) {
    const k = smooth(into / tr.dur);
    const prev = scenes[idx - 1];
    if (tr.type === 'crossfade' || tr.type === 'wipe') {
      const b = buffer('prev');
      const bctx = b.getContext('2d');
      // prev scene keeps animating past its end for continuity
      drawScene(bctx, prev, T);
      ctx.save();
      if (tr.type === 'crossfade') {
        ctx.globalAlpha = 1 - k;
        ctx.drawImage(b, 0, 0);
      } else {
        // soft diagonal wipe revealing the new scene from the left
        const x = lerp(-400, W + 400, k);
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(W + 800, 0); ctx.lineTo(W + 800, H); ctx.lineTo(x - 300, H); ctx.closePath();
        ctx.clip();
        ctx.drawImage(b, 0, 0);
      }
      ctx.restore();
    }
  }
  post(ctx, T);
  if (tr.type === 'fadeFromBlack' && into < tr.dur) {
    ctx.fillStyle = `rgba(0,0,0,${1 - smooth(into / tr.dur)})`; ctx.fillRect(0, 0, W, H);
  }
  if (tr.type === 'fromWhite' && into < tr.dur) {
    ctx.fillStyle = `rgba(255,252,240,${1 - Ease.outQuad(into / tr.dur)})`; ctx.fillRect(0, 0, W, H);
  }
  endFade(ctx, T);
  subtitles(ctx, T);
}

function post(ctx, T) {
  // vignette (suppressed while the impact whiteout fills the frame)
  const white = invLerp(13.1, 13.4, T) * (T < 13.5 ? 1 : 0);
  ctx.save();
  ctx.globalAlpha = 1 - white;
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,10,0)');
  g.addColorStop(1, 'rgba(0,0,12,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // film grain: tiled deterministic noise, changes every frame
  const grain = buffer('grain');
  if (!grain._made) {
    grain.width = 256; grain.height = 256;
    const gctx = grain.getContext('2d');
    const img = gctx.createImageData(256, 256);
    const r = rng(42);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    gctx.putImageData(img, 0, 0);
    grain._made = true;
  }
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.globalCompositeOperation = 'overlay';
  const f = Math.floor(T * 30);
  const pat = ctx.createPattern(grain, 'repeat');
  ctx.translate((hash(f) * 256) | 0, (hash(f + 1) * 256) | 0);
  ctx.fillStyle = pat;
  ctx.fillRect(-256, -256, W + 512, H + 512);
  ctx.restore();
}

function endFade(ctx, T) {
  // global fade out at the very end
  const end = TIMELINE.duration;
  if (T > end - 1.0) { ctx.fillStyle = `rgba(0,0,0,${smooth((T - (end - 1.0)) / 1.0)})`; ctx.fillRect(0, 0, W, H); }
}

function subtitles(ctx, T) {
  // show a line from its start until shortly after it ends
  for (const d of TIMELINE.dialogue) {
    const L = LIPSYNC[d.id];
    const a = d.start - 0.05, b = d.start + L.duration + 0.35;
    if (T < a || T > b) continue;
    const alpha = Math.min(invLerp(a, a + 0.15, T), 1 - invLerp(b - 0.2, b, T));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const y = H - 70;
    const text = L.sub;
    const narr = L.who === 'narrator';
    ctx.font = `${narr ? '500' : '700'} 50px "Noto ${narr ? 'Serif' : 'Sans'} CJK JP", sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(8,10,30,0.85)';
    ctx.strokeText(text, W / 2, y);
    ctx.fillStyle = narr ? '#f4ecd6' : '#ffffff';
    ctx.fillText(text, W / 2, y);
    const name = SUB_NAMES[L.who];
    if (name) {
      ctx.font = '700 30px "Noto Sans CJK JP", sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeText(name, W / 2, y - 62);
      ctx.fillStyle = SUB_COLORS[L.who];
      ctx.fillText(name, W / 2, y - 62);
    }
    ctx.restore();
  }
}

window.renderFrame = renderFrame;
