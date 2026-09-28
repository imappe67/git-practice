// Headless renderer.
//   node render.mjs still 3.0 15.2 ... [--out dir] [--scale 0.5]   -> PNG stills
//   node render.mjs video [--from 0] [--to 60] [--workers 4] [--fps 30] [--out file.mp4]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

function writeData() {
  const tl = fs.readFileSync(path.join(ROOT, 'story/timeline.json'), 'utf8');
  const ls = fs.readFileSync(path.join(ROOT, 'audio/voice/lipsync.json'), 'utf8');
  fs.writeFileSync(path.join(HERE, 'data.js'), `window.TIMELINE=${tl};\nwindow.LIPSYNC=${ls};\n`);
}

function parseArgs(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
    else pos.push(argv[i]);
  }
  return { pos, opt };
}

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(pathToFileURL(path.join(HERE, 'index.html')).href);
  await page.evaluate(() => document.fonts.ready);
  // warm up fonts used by subtitles/titles
  await page.evaluate(() => Promise.all([
    document.fonts.load('700 50px "Noto Sans CJK JP"', 'あ'),
    document.fonts.load('500 50px "Noto Serif CJK JP"', 'あ'),
  ]));
  if (errors.length) console.error('PAGE ERRORS:\n' + errors.join('\n'));
  page._errors = errors;
  return page;
}

async function grab(page, T, fmt = 'png', scale = 1) {
  const b64 = await page.evaluate(([T, fmt, scale]) => {
    window.renderFrame(T);
    let c = document.getElementById('c');
    if (scale !== 1) {
      const s = document.createElement('canvas');
      s.width = Math.round(1920 * scale); s.height = Math.round(1080 * scale);
      s.getContext('2d').drawImage(c, 0, 0, s.width, s.height);
      c = s;
    }
    return c.toDataURL(fmt === 'png' ? 'image/png' : 'image/jpeg', 0.95).split(',')[1];
  }, [T, fmt, scale]);
  return Buffer.from(b64, 'base64');
}

async function stills(times, opt) {
  const out = opt.out || path.join(ROOT, 'preview');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await openPage(browser);
  for (const t of times) {
    const buf = await grab(page, parseFloat(t), 'png', parseFloat(opt.scale || '0.5'));
    const f = path.join(out, `f_${parseFloat(t).toFixed(2)}.png`);
    fs.writeFileSync(f, buf);
    console.log(f);
  }
  if (page._errors.length) console.error('ERRORS:', page._errors.slice(0, 20).join('\n'));
  await browser.close();
}

async function video(opt) {
  const fps = parseFloat(opt.fps || '30');
  const from = parseFloat(opt.from || '0');
  const to = parseFloat(opt.to || '60');
  const workers = parseInt(opt.workers || '4', 10);
  const scale = parseFloat(opt.scale || '1');
  const out = opt.out || path.join(ROOT, 'out/video_noaudio.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const n = Math.round((to - from) * fps);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', opt.preset || 'medium', '-crf', opt.crf || '16', '-pix_fmt', 'yuv420p', '-tune', 'animation', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser)));
  const done = new Map();
  let next = 0, written = 0;
  const t0 = Date.now();
  const flush = async () => {
    while (done.has(written)) {
      const buf = done.get(written); done.delete(written);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      written++;
      if (written % 60 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`frame ${written}/${n}  ${(written / el).toFixed(1)} fps`);
      }
    }
  };
  await Promise.all(pages.map(async (page) => {
    while (true) {
      const i = next++;
      if (i >= n) break;
      // keep the reorder buffer bounded
      while (i - written > workers * 8) await new Promise((r) => setTimeout(r, 5));
      done.set(i, await grab(page, from + i / fps, 'png', scale));
      await flush();
    }
  }));
  await flush();
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  const errs = pages.flatMap((p) => p._errors);
  if (errs.length) console.error('PAGE ERRORS:', [...new Set(errs)].slice(0, 20).join('\n'));
  await browser.close();
  console.log('wrote', out, `in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

const { pos, opt } = parseArgs(process.argv.slice(2));
writeData();
if (pos[0] === 'still') await stills(pos.slice(1), opt);
else if (pos[0] === 'video') await video(opt);
else console.log('usage: node render.mjs still <t...> [--out dir] [--scale 0.5] | video [--from --to --workers --out]');
