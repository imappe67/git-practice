// Scene s1 — placeholder, see story/timeline.json for the brief.
'use strict';
registerScene('s1', {
  draw(ctx, t, T, d) {
    starfield(ctx, T, { seed: 1 });
    ctx.fillStyle = '#fff'; ctx.font = '60px "Noto Sans CJK JP"'; ctx.fillText('s1  t=' + t.toFixed(2), 80, 120);
    drawHina(ctx, { x: 800, y: 950, scale: 1, T, mouth: mouthAt('hina', T), expression: 'smile', lantern: { glow: 0.5 } });
    drawKira(ctx, { x: 1200, y: 700, size: 60, T, mouth: mouthAt('kira', T), glow: 1 });
  },
});
