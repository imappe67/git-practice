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
//
// drawVillager(ctx, o)   warm-backlit townsfolk in windows
//   o.kind 'grandpa' | 'grandma' | 'kid' | 'mother';  o.x,o.y = bottom centre (window sill);
//   o.scale (1 => ~260px tall upper body), o.mouth, o.wave 0..1, o.T, o.facing
'use strict';

// ---- PLACEHOLDER IMPLEMENTATIONS (to be replaced by the character designer) ----
function drawHina(ctx, o) {
  const s = o.scale || 1, f = o.facing || 1;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(s * f, s);
  ctx.fillStyle = '#1f2f6b';
  ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(60, 0); ctx.lineTo(40, -250); ctx.lineTo(-40, -250); ctx.fill();
  ctx.fillStyle = '#c8323c'; ctx.fillRect(-45, -190, 90, 30);
  ctx.fillStyle = '#ffe1c8'; ctx.beginPath(); ctx.arc(0, -320, 70, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b1b18'; ctx.beginPath(); ctx.arc(0, -340, 75, Math.PI, 0); ctx.fill();
  const open = o.mouth ? MOUTH_OPEN[o.mouth] : 0;
  ctx.fillStyle = '#7a2230'; ctx.beginPath(); ctx.ellipse(20, -285, 12, 3 + open * 12, 0, 0, TAU); ctx.fill();
  if (o.lantern) glow(ctx, 70, -120, 120 * (0.5 + o.lantern.glow), '#ffb347', 0.8);
  ctx.restore();
}
function drawKira(ctx, o) {
  const r = o.size || 40;
  glow(ctx, o.x, o.y, r * 4 * (0.4 + (o.glow ?? 1)), '#ffd76a', 0.7);
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.rot || 0);
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.55 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.fill();
  const open = o.mouth ? MOUTH_OPEN[o.mouth] : 0;
  ctx.fillStyle = '#3a2a10';
  ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.05, r * 0.08, 0, TAU); ctx.arc(r * 0.2, -r * 0.05, r * 0.08, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, r * 0.18, r * 0.08, r * 0.02 + open * r * 0.08, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawVillager(ctx, o) {
  const s = o.scale || 1;
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s);
  ctx.fillStyle = '#3b2a22';
  ctx.beginPath(); ctx.ellipse(0, -40, 90, 60, 0, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -150, 55, 0, TAU); ctx.fill();
  ctx.restore();
}
