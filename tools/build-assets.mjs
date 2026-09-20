/* ------------------------------------------------------------------
 *  build-assets.mjs — generates every animated SVG in /assets
 *  run:  node tools/build-assets.mjs   (or: npm run build)
 * ------------------------------------------------------------------ */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import {
  C, MONO, esc, text, rect, anim, animT, appear, svg, glow, softGlow, lgrad, rgrad,
  rain, glitchTitle, typewriter, meterRow, marquee, scanlines, sweep, SWEEP_GRAD,
  brackets, sectionTag, cw, round, rng, setPreview,
} from './svg-lib.mjs';

const cfg = JSON.parse(
  (await import('node:fs')).readFileSync(new URL('./profile.config.json', import.meta.url), 'utf8')
);

const PREVIEW = process.argv.includes('--preview');
setPreview(PREVIEW);
mkdirSync(new URL('../assets', import.meta.url), { recursive: true });
mkdirSync(new URL('./.preview', import.meta.url), { recursive: true });
const outAt = (rel, content) => {
  const clean = content.replace(/\n{3,}/g, '\n\n');
  const url = new URL(`../${rel}`, import.meta.url);
  mkdirSync(new URL('.', url), { recursive: true });
  writeFileSync(url, clean);
  console.log(`  ✓ ${rel}  (${(Buffer.byteLength(clean) / 1024).toFixed(1)} KB)`);
  return clean;
};
const out = (name, content) => {
  const clean = content.replace(/\n{3,}/g, '\n\n');
  writeFileSync(new URL(`../assets/${name}`, import.meta.url), clean);
  const kb = (Buffer.byteLength(clean) / 1024).toFixed(1);
  let extra = '';
  if (PREVIEW) {
    const flat = clean
      .replace(/<animateTransform[^>]*>/g, '')
      .replace(/<animate[^>]*>/g, '')
      .replace(/(?<!stop-)opacity="0"/g, 'opacity="1"');
    /* resvg panics when content extends far outside the viewport (marquee rows),
       so previews are rendered on a widened canvas — the 0..W region is identical */
    const flatWide = flat.replace(/viewBox="0 0 (\d+) (\d+)" width="\d+" height="\d+"/,
      (m, w, h) => `viewBox="0 0 ${+w * 2} ${h}" width="${+w * 2}" height="${h}"`);
    const png = new Resvg(flatWide, { fitTo: { mode: 'zoom', value: 1 }, font: { loadSystemFonts: true, defaultFontFamily: 'monospace' } })
      .render()
      .asPng();
    writeFileSync(new URL(`./.preview/${name.replace('.svg', '.png')}`, import.meta.url), png);
    extra = `  → .preview/${name.replace('.svg', '.png')}`;
  }
  console.log(`  ✓ assets/${name}  (${kb} KB)${extra}`);
};

const { identity, stack, skills, status } = cfg;

/* ==================================================================
 * 1. HERO — digital rain + glitch name + typed taglines
 * ================================================================== */
function hero() {
  const W = 1200, H = 360;
  const r = rain({ w: W, h: H, cols: 50, seed: 21, size: 15, opacity: 0.6, charset: 'mix' });
  const nameSize = 88;
  const lock = identity.nameUpper.length * cw(nameSize) * 1.16;
  const g = glitchTitle({
    text: identity.nameUpper, x: W / 2, y: 158, size: nameSize, lock,
    maskId: 'nameMask', glowId: 'nameGlow', glitchStart: 3.1,
  });
  const tw = typewriter({
    phrases: cfg.typing.map((t) => ({ text: t })),
    x: 0, y: 0, size: 20, cycle: 24, speed: 0.05, hold: 2.1, gap: 0.6,
  });
  const twX = (W - tw.width) / 2 + cw(20) * 0.4;

  const defs = `
${r.defs}
${g.defs}
${SWEEP_GRAD}
${glow('nameGlow', 9, C.neon)}
${softGlow('twGlow', 4, C.neon)}
${scanlines('heroScan', W, H)}
${lgrad('roleLine', [[0, C.neon, 0], [0.5, C.neon, 0.9], [1, C.neon, 0]], '0%', '0%', '100%', '0%')}
<mask id="heroEdgeFade">
  <rect width="${W}" height="${H}" fill="black"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#heroFadeX)"/>
</mask>
${lgrad('heroFadeX', [[0, '#000', 0.15], [0.12, '#fff', 1], [0.88, '#fff', 1], [1, '#000', 0.15]])}`;

  const role = identity.role.toUpperCase();
  const roleLock = role.length * cw(17) * 1.22;

  const hudBottom = (x, y, label, value, anchor = 'start', color = C.textDim) => `
${text({ x, y, size: 12, fill: color, content: label, anchor, op: 0, extra: appear(2.6, 0.6) })}
${text({ x: anchor === 'end' ? x : x + label.length * cw(12) * 1.05, y, size: 12, fill: C.neon, content: value, anchor, op: 0, extra: appear(2.9, 0.6) })}`;

  const body = `
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<g mask="url(#heroEdgeFade)" opacity="0.95">${r.body}</g>
<rect width="${W}" height="${H}" fill="url(#heroVig)"/>
<rect width="${W}" height="${H}" fill="url(#heroScan)" opacity="0.26"/>

${brackets(26, 22, W - 52, H - 44, 22, C.dim, 2, 0.9)}

<!-- glitch name -->
${g.body}

<!-- role -->
<g opacity="0" fill="${C.mint}">${text({ x: W / 2, y: 209, size: 17, fill: C.mint, content: role, lock: roleLock, ls: 3, op: 0, extra: appear(2.05, 0.7) })}</g>

<!-- animated underline -->
<g opacity="0">${appear(2.3, 0.6)}
  ${rect({ x: W / 2 - roleLock / 2 - 90, y: 228, w: roleLock + 180, h: 1, fill: `url(#roleLine)` })}
  ${rect({ x: W / 2 - roleLock / 2 - 90, y: 227, w: 90, h: 3, rx: 1.5, fill: C.neon, op: 0.9, extra: animT('translate', `0 0; ${round(roleLock + 180)} 0`, '4.4s') })}
</g>

<!-- typewriter -->
<g transform="translate(${round(twX)},284)">${tw.body}</g>

${hudBottom(50, 330, '// PROFILE_BUILD ', 'v2.0.26', 'start')}
${text({ x: W - 50, y: 330, size: 12, fill: C.textDim, content: 'SIGNAL', anchor: 'end', op: 0, extra: appear(2.6, 0.6) })}
<g opacity="0">${appear(2.9, 0.6)}
  ${text({ x: W - 128, y: 330, size: 12, fill: C.neon, content: '▮▮▮▮▮▮▮▮░░ 82%', anchor: 'end' })}
</g>

${sweep(0, H, W, 7, 1.2)}`;

  const defsFull = `${defs}
${rgrad('heroVig', [[0.45, C.bg, 0], [1, C.bg, 0.88]])}`;

  return svg({
    w: W, h: H,
    defs: `<defs>${defsFull}</defs>`,
    title: `${identity.name} — ${identity.role}`,
    body,
  });
}

/* ==================================================================
 * 2. TERMINAL — boot sequence that types itself line by line
 * ================================================================== */
function terminal() {
  const W = 1180, H = 508, PX = 22, PY = 16, PW = W - 44, PH = H - 32;
  const size = 15.5, lh = 27.4, chW = cw(size);
  const bodyX = PX + 30;
  let y = PY + 78;
  const t0 = 1.05;
  const L = [];

  const line = (segs, opts = {}) => {
    const el = segs
      .map((s) => text({
        x: round(bodyX + (s.i || 0) * chW), y: round(y), size, fill: s.c || C.text,
        content: s.t, weight: s.w || 400, lock: s.lock ?? s.t.length * chW,
        op: 0, extra: appear(opts.begin ?? t0, 0.3),
      }))
      .join('\n');
    const s = `<g>${el}</g>`;
    y += opts.lh || lh;
    return s;
  };

  const seg = (i, t, c, w) => ({ i, t, c, w });
  const kv = (label, value, color = C.text, padTo = 16) =>
    line([
      seg(0, '[ OK ]', C.neon, 700),
      seg(7, label.padEnd(padTo, '.'), C.dim),
      seg(7 + padTo, value, color),
    ]);

  L.push(
    `<g>${text({ x: bodyX, y: round(PY + 78), size, fill: C.neon, content: '$ ', op: 0, extra: appear(0.5, 0.3) })}
    <g opacity="0">${appear(0.5, 0.3)}
      <g mask="url(#t-typing)">
        ${text({ x: round(bodyX + 2 * chW), y: round(PY + 78), size, fill: C.text, content: './init_profile.sh --user ' + identity.handle, lock: (('./init_profile.sh --user ' + identity.handle).length) * chW })}
      </g>
    </g></g>`
  );
  y += lh;

  L.push(line([seg(0, `[${new Date().toISOString().slice(0, 10).replace(/-/g, '.')} ${C.dim ? '' : ''}] bootstrap: vaezhadi.profile v2.0.26`, C.dim2)], { begin: 0.95 }));

  const rows = [
    ['identity', `${identity.name}  (${identity.handle})`, C.text],
    ['role', identity.role + ' · Mobile Engineer', C.neon2],
    ['location', `${identity.location}  ·  ${identity.timezone}`, C.text],
    ['status', `ONLINE — ${status.text}`, C.mint],
    ['learning', stack.learning.join(' · '), C.text],
    ['stack', stack.primary.join(' · '), C.text],
    ['mission', `"${identity.tagline}"`, C.amber],
  ];
  rows.forEach(([k, v, c], i) => L.push(kv(k, v, c, 14, i)));
  L.push(line([seg(0, '─'.repeat(58), C.dim2)], { begin: 3.2 }));
  y += 6;
  L.push(line([seg(0, '[✓] profile loaded in 0.042s', C.neon), seg(29, '· 0 warnings · 0 errors', C.dim)], { begin: 3.5 }));

  const cursorY = y - lh + 2;

  const defs = `
<defs>
${scanlines('tScan', PW, PH)}
${glow('tGlow', 10, C.neon)}
${softGlow('tSoft', 3, C.neon)}
${SWEEP_GRAD}
${lgrad('tPanel', [[0, '#04150c', 1], [1, '#020a06', 1]], '0%', '0%', '100%', '100%')}
${lgrad('tEdge', [[0, C.neon, 0.9], [0.5, C.dim, 0.4], [1, C.neon2, 0.9]])}
${lgrad('tBar', [[0, '#07231388', 1], [1, '#04160d', 1]])}
${lgrad('tProg', [[0, C.dim2], [0.5, C.neon], [1, C.mint]])}
<mask id="t-typing">
  <rect x="${round(bodyX + 2 * chW - 4)}" y="${round(PY + 60)}" width="0" height="30" fill="white">
    <animate attributeName="width" from="0" to="${round(('./init_profile.sh --user ' + identity.handle).length * chW + 8)}" begin="0.7s" dur="1.15s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.3 0.9 0.2 1" values="0;${round(('./init_profile.sh --user ' + identity.handle).length * chW + 8)}"/>
  </rect>
</mask>
<filter id="tShadow" x="-20%" y="-20%" width="140%" height="140%">
  <feDropShadow dx="0" dy="6" stdDeviation="14" flood-color="#000" flood-opacity="0.9"/>
</filter>
</defs>`;

  const progress = `
<g opacity="0">${appear(4.4, 0.5)}
  ${text({ x: bodyX, y: round(y + 26), size: 13, fill: C.dim, content: 'SCANNING REPOSITORIES', lock: null })}
  ${rect({ x: bodyX + 170, y: round(y + 15), w: 420, h: 9, rx: 4.5, fill: '#072012', stroke: C.dim2 })}
  ${rect({ x: bodyX + 171, y: round(y + 16), w: 0, h: 7, rx: 3.5, fill: 'url(#tProg)', extra: `<animate attributeName="width" from="0" to="418" begin="4.7s" dur="1.6s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.8 0.2 1" values="0;418"/>` })}
  <g opacity="0">${appear(6.3, 0.4)}${text({ x: bodyX + 604, y: round(y + 24), size: 13, fill: C.neon, content: '100%' })}</g>
  <g>${anim('opacity', '0;0;0.9;0.9', '2.6s')}${rect({ x: bodyX + 165, y: round(y + 12), w: 430, h: 15, rx: 7, fill: C.neon, op: 0.12 })}</g>
</g>`;
  const yAfterProgress = y + 56;

  return svg({
    w: W, h: H,
    defs,
    title: `${identity.handle} — boot sequence`,
    body: `
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<g filter="url(#tShadow)">
  <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="14" fill="url(#tPanel)" stroke="url(#tEdge)" stroke-width="1.6"/>
</g>
<path d="M${PX} ${PY + 54} H${PX + PW}" stroke="${C.dim2}" stroke-width="1"/>

<!-- title bar -->
<circle cx="${PX + 34}" cy="${PY + 27}" r="6" fill="#0e3d26" stroke="${C.dim}" stroke-width="1"/>
<circle cx="${PX + 58}" cy="${PY + 27}" r="6" fill="${C.amber}" opacity="0.85"/>
<circle cx="${PX + 82}" cy="${PY + 27}" r="6" fill="${C.neon}">${anim('opacity', '1;0.25;1', '2.2s')}</circle>
${text({ x: PX + 106, y: PY + 32, size: 14, fill: C.mint, content: `${identity.handleHost}: ~/profile — bash` })}
${text({ x: PX + PW - 26, y: PY + 32, size: 12, fill: C.dim2, content: '80×24', anchor: 'end' })}

${L.join('\n')}
${progress}

<rect x="${PX + 1}" y="${PY + 1}" width="${PW - 2}" height="${PH - 2}" rx="13" fill="url(#tScan)" opacity="0.4" pointer-events="none"/>
${sweep(PY, PH, W, 8.5, 1.6)}

<!-- prompt + blinking cursor -->
<g>${anim('opacity', '0;0;1;1', '1s')}
  ${text({ x: bodyX, y: round(yAfterProgress + 24), size, fill: C.neon, content: '$', op: 0, extra: appear(6.6, 0.3) })}
  <g opacity="0">${appear(6.9, 0.3)}<g>${anim('opacity', '1;1;0;0', '1.05s')}${rect({ x: round(bodyX + 1.6 * chW), y: round(yAfterProgress + 10), w: round(chW * 0.95), h: size * 1.15, fill: C.neon, op: 0.85, extra: 'filter="url(#tSoft)"' })}</g></g>
  ${text({ x: round(bodyX + 3 * chW), y: round(yAfterProgress + 24), size: 13, fill: C.dim2, content: '# always shipping something', op: 0, extra: appear(7.4, 0.5) })}
</g>` ,
  });
}

/* ==================================================================
 * 3. STACK — two infinite marquee rows of tech
 * ================================================================== */
function stackStrip() {
  const W = 1200, H = 244;
  const m1 = marquee({
    items: [...stack.primary, ...stack.primary.slice(0, 2)], x: 0, y: 62, h: 46, size: 17,
    dir: -1, speed: 52, gap: 16,
  });
  const m2 = marquee({
    items: [...stack.tools, ...stack.learning], x: 0, y: 156, h: 46, size: 17,
    dir: 1, speed: 44, gap: 16, palette: [C.mint, C.neon2, C.dim],
  });

  return svg({
    w: W, h: H,
    defs: `<defs>
${lgrad('chipFade', [[0, '#000', 0.04], [0.06, '#fff', 1], [0.94, '#fff', 1], [1, '#000', 0.04]])}
<mask id="chipMask"><rect width="${W}" height="${H}" fill="url(#chipFade)"/></mask>
${lgrad('stRule', [[0, C.neon, 0], [0.45, C.neon, 0.55], [1, C.neon, 0]], '0%', '0%', '100%', '0%')}
</defs>`,
    title: `Tech stack — ${stack.primary.join(', ')}`,
    body: `
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${text({ x: 30, y: 26, size: 13, fill: C.neon, weight: 600, content: '[ DAILY DRIVERS ]' })}
${text({ x: 30, y: 120, size: 13, fill: C.mint, weight: 600, content: '[ TOOLS & LEARNING ]' })}
${text({ x: W - 30, y: 26, size: 11.5, fill: C.dim2, anchor: 'end', content: '// the stuff I actually use every day' })}
${text({ x: W - 30, y: 120, size: 11.5, fill: C.dim2, anchor: 'end', content: '// currently on the workbench' })}
<path d="M30 36 H${W - 30}" stroke="url(#stRule)" stroke-width="1"/>
<path d="M30 130 H${W - 30}" stroke="url(#stRule)" stroke-width="1"/>
<g mask="url(#chipMask)">
  ${m1.body}
  ${m2.body}
</g>`,
  });
}

/* ==================================================================
 * 4. SKILLS — animated meters, two columns
 * ================================================================== */
function skillsGrid() {
  const W = 1200, H = 402;
  const colX = [48, 636], colW = 516, labelW = 196, rowH = 66, startY = 104;
  const rows = [];
  skills.slice(0, 8).forEach((sk, i) => {
    const col = Math.floor(i / 4), row = i % 4;
    rows.push(meterRow({
      label: sk.name, level: sk.level, x: colX[col], y: startY + row * rowH,
      w: colW, labelW, size: 15, begin: 0.35 + i * 0.15, delay: i,
    }));
    if (col === 0 && row === 0) {
      /* vertical separator between the two columns */
    }
  });
  return svg({
    w: W, h: H,
    defs: `<defs>${glow('skGlow', 4, C.neon)}${scanlines('skScan', W, H)}
${lgrad('skRule', [[0, C.neon, 0], [0.5, C.neon, 0.7], [1, C.neon, 0]], '0%', '0%', '100%', '0%')}
${lgrad('skSep', [[0, C.dim2, 0], [0.5, C.dim, 0.6], [1, C.dim2, 0]], '0%', '0%', '0%', '100%')}</defs>`,
    title: 'Skills',
    body: `
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${sectionTag('CORE SKILLS', 48, 40, 14)}
${text({ x: W - 48, y: 40, size: 12, fill: C.dim2, content: 'self-assessed · updated continuously', anchor: 'end', op: 0, extra: appear(0.8, 0.6) })}
<path d="M48 60 H${W - 48}" stroke="url(#skRule)" stroke-width="1"/>
<path d="M606 76 V370" stroke="url(#skSep)" stroke-width="1" stroke-dasharray="4 7"/>
<rect x="0" y="0" width="${W}" height="${H}" fill="url(#skScan)" op="0.22"/>
${rows.join('\n')}
${text({ x: W / 2, y: H - 24, size: 12, fill: C.dim2, content: '// percentages are self-chosen, not measured — the code is the real proof', anchor: 'middle', op: 0, extra: appear(2.7, 0.8) })}
${rect({ x: 0, y: 0, width: W, height: H, fill: 'url(#skScan)', opacity: 0.2 })}`,
  });
}

/* ==================================================================
 * 5. LIVE STATUS — equalizer + current focus
 * ================================================================== */
function liveNow() {
  const W = 1200, H = 212;
  const bars = 24, bw = 6, gap = 5, barBase = 186;
  const eq = Array.from({ length: bars }, (_, i) => {
    const r = rng(i + 3)();
    const h = 12 + r * 42;
    const dur = (0.6 + r * 0.7).toFixed(2);
    const d = (r * 0.5).toFixed(2);
    return rect({
      x: round(52 + i * (bw + gap)), y: round(barBase - h), w: bw, h: round(h), rx: 3,
      fill: i % 3 === 0 ? C.neon : C.dim, op: 0.9,
      extra: `${appear(0.6 + i * 0.04, 0.4)}<animate attributeName="height" values="${round(h)};${round(h * 0.25)};${round(h * 0.75)};${round(h)}" dur="${dur}s" begin="${d}s" repeatCount="indefinite"/><animate attributeName="y" values="${round(barBase - h)};${round(barBase - h * 0.25)};${round(barBase - h * 0.75)};${round(barBase - h)}" dur="${dur}s" begin="${d}s" repeatCount="indefinite"/>`,
    });
  }).join('\n');

  const col = (x, label, value, color) => `
${text({ x, y: 92, size: 11.5, fill: C.dim, content: label, op: 0, extra: appear(0.9, 0.5) })}
${text({ x, y: 120, size: 16, fill: color, content: value, op: 0, extra: appear(1.15, 0.6) })}`;

  return svg({
    w: W, h: H,
    defs: `<defs>${scanlines('lnScan', W, H)}${glow('lnGlow', 5, C.neon)}
${lgrad('lnEdge', [[0, C.dim, 0.2], [0.5, C.edgeLit, 0.9], [1, C.dim, 0.2]])}
${lgrad('lnPanel', [[0, '#04150c', 1], [1, '#020a06', 1]])}
${lgrad('lnBadge', [[0, C.neon, 0.16], [1, C.neon, 0.04]])}</defs>`,
    title: 'Live status',
    body: `
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<rect x="20" y="14" width="${W - 40}" height="${H - 28}" rx="14" fill="url(#lnPanel)" stroke="url(#lnEdge)" stroke-width="1.4"/>
<rect x="20" y="14" width="${W - 40}" height="${H - 28}" rx="14" fill="url(#lnScan)" opacity="0.3"/>

<g opacity="0">${appear(0.3, 0.5)}
  <rect x="48" y="32" width="104" height="26" rx="13" fill="url(#lnBadge)" stroke="${C.neon}" stroke-width="1.1"/>
  ${text({ x: 100, y: 49, size: 12.5, fill: C.neon, weight: 700, anchor: 'middle', content: status.label })}
  <circle cx="140" cy="45" r="5" fill="${C.neon}" filter="url(#lnGlow)">${anim('r', '5;7.5;5', '1.7s')}${anim('opacity', '1;0.3;1', '1.7s')}</circle>
</g>
${text({ x: 162, y: 49, size: 13, fill: C.mint, content: status.text, op: 0, extra: appear(0.6, 0.6) })}
<path d="M48 74 H${W - 48}" stroke="${C.dim2}" stroke-width="1" stroke-dasharray="3 6"/>

${col(48, 'BUILDING', status.building, C.text)}
${col(448, 'LEARNING', status.learning, C.text)}
${col(824, 'OPEN TO', identity.availableFor, C.amber)}
<path d="M412 84 V136" stroke="${C.dim2}" stroke-dasharray="3 6"/>
<path d="M796 84 V136" stroke="${C.dim2}" stroke-dasharray="3 6"/>
<path d="M48 142 H${W - 48}" stroke="${C.dim2}" stroke-width="1" stroke-dasharray="3 6"/>
<text x="0" y="0"/>
${text({ x: W - 48, y: 180, size: 11, fill: C.dim2, anchor: 'end', content: '// playlists, coffee and shipping features', op: 0, extra: appear(1.6, 0.7) })}
${eq}`,
  });
}

/* ==================================================================
 * 6. DIVIDER — marching data line with a travelling pulse
 * ================================================================== */
function divider() {
  const W = 1200, H = 46, y = 23;
  return svg({
    w: W, h: H,
    defs: `<defs>${glow('dvGlow', 5, C.neon)}
${lgrad('dvLine', [[0, C.neon, 0], [0.2, C.dim, 0.9], [0.8, C.dim, 0.9], [1, C.neon, 0]], '0%', '0%', '100%', '0%')}</defs>`,
    title: 'divider',
    body: `
<path d="M40 ${y} H${W - 40}" stroke="url(#dvLine)" stroke-width="1.4"/>
<path d="M40 ${y} H${W - 40}" stroke="${C.neon}" stroke-width="1.4" stroke-dasharray="6 14" opacity="0.8">
  <animate attributeName="stroke-dashoffset" from="0" to="-200" dur="6s" repeatCount="indefinite"/>
</path>
<g>
  ${animT('translate', `-560 0; 560 0`, '5.5s')}
  <circle cx="600" cy="${y}" r="3.6" fill="${C.mint}" filter="url(#dvGlow)"/>
  <rect x="596" y="${y - 1}" width="70" height="2" fill="url(#dvLine)" opacity="0.9"/>
</g>
<g transform="translate(600 ${y})">
  <g>${animT('rotate', '0;360', '14s')}
    <path d="M0 -11 L9.5 -5.5 L9.5 5.5 L0 11 L-9.5 5.5 L-9.5 -5.5 Z" fill="${C.bg}" stroke="${C.neon}" stroke-width="1.2" opacity="0.85"/>
  </g>
  <circle r="3" fill="${C.neon}">${anim('opacity', '1;0.2;1', '2.1s')}</circle>
  <g>${animT('rotate', '360;0', '22s')}
    <circle r="16" fill="none" stroke="${C.dim}" stroke-width="1" stroke-dasharray="2 6"/>
  </g>
</g>`,
  });
}

/* ==================================================================
 * 7. FOOTER — call to action
 * ================================================================== */
function footer() {
  const W = 1200, H = 186;
  const cta = (cfg.footerCta || identity.footerCta).toUpperCase();
  const lock = cta.length * cw(34) * 1.1;
  return svg({
    w: W, h: H,
    defs: `<defs>${glow('ftGlow', 7, C.neon)}${scanlines('ftScan', W, H)}
${lgrad('ftRule', [[0, C.neon, 0], [0.5, C.mint, 0.9], [1, C.neon, 0]], '0%', '0%', '100%', '0%')}
${lgrad('ftPill', [[0, '#04160d', 1], [1, '#031009', 1]])}</defs>`,
    title: 'call to action',
    body: `
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<rect width="${W}" height="${H}" fill="url(#ftScan)" opacity="0.28"/>
<path d="M0 0 H${W}" stroke="url(#ftRule)" stroke-width="1"/>
${text({ x: W / 2, y: 76, size: 34, fill: C.mint, weight: 700, anchor: 'middle', content: cta, lock, op: 0, extra: appear(0.2, 0.8) })}
<g opacity="0">${appear(0.9, 0.7)}
  ${rect({ x: W / 2 - 150, y: 100, w: 300, h: 42, rx: 21, fill: 'url(#ftPill)', stroke: C.neon, sw: 1.4 })}
  ${text({ x: W / 2, y: 127, size: 15, fill: C.neon, anchor: 'middle', content: '▸  send a signal  ◂' })}
  <g>${animT('translate', '-6 0; 6 0; -6 0', '2.6s')}${text({ x: W / 2 - 172, y: 127, size: 15, fill: C.dim, anchor: 'end', content: '>>' })}</g>
  <g>${animT('translate', '6 0; -6 0; 6 0', '2.6s')}${text({ x: W / 2 + 172, y: 127, size: 15, fill: C.dim, anchor: 'start', content: '<<' })}</g>
</g>
${text({ x: 40, y: 168, size: 11.5, fill: C.dim2, content: '// EOF — thanks for scrolling to the bottom', op: 0, extra: appear(1.4, 0.7) })}
${text({ x: W - 40, y: 168, size: 11.5, fill: C.dim2, content: `${identity.handle} · ${new Date().getFullYear()}`, anchor: 'end', op: 0, extra: appear(1.5, 0.7) })}`,
  });
}

/* ==================================================================
 * 8. ASCII MONOGRAM — hex ID plate (works without the avatar)
 * ================================================================== */
function idPlate() {
  const W = 300, H = 300, cx = 150, cy = 150, r = 132;
  const hexPoints = (rr) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i - 30);
      return `${round(cx + rr * Math.cos(a))},${round(cy + rr * Math.sin(a))}`;
    }).join(' ');
  return svg({
    w: W, h: H,
    defs: `<defs>${glow('idGlow', 8, C.neon)}${scanlines('idScan', W, H)}
${lgrad('idEdge', [[0, C.neon, 1], [0.5, C.dim, 0.5], [1, C.mint, 1]])}</defs>`,
    title: 'ID plate',
    body: `
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<g>
  ${animT('rotate', '0;360', '40s')}
  <polygon points="${hexPoints(r + 10)}" fill="none" stroke="${C.dim}" stroke-width="1" stroke-dasharray="4 10" transform="translate(${cx} ${cy}) scale(0.5) translate(${-cx} ${-cy})"/>
</g>
<g transform="translate(${cx} ${cy}) scale(0.5) translate(${-cx} ${-cy})">
  <g>${animT('rotate', '0;-360', '26s')}
    <polygon points="${hexPoints(r + 4)}" fill="none" stroke="${C.dim2}" stroke-width="1.6" stroke-dasharray="2 7"/>
  </g>
</g>
<polygon points="${hexPoints(r)}" fill="#03110a" stroke="url(#idEdge)" stroke-width="2"/>
<polygon points="${hexPoints(r - 12)}" fill="none" stroke="${C.dim2}" stroke-width="1"/>
<g filter="url(#idGlow)" opacity="0.95">
  ${text({ x: cx, y: cy + 18, size: 64, fill: C.neon, weight: 700, anchor: 'middle', content: 'HV', lock: 96 })}
</g>
${text({ x: cx, y: cy + 58, size: 13, fill: C.mint, anchor: 'middle', content: identity.name, lock: identity.name.length * cw(13) })}
${text({ x: cx, y: cy + 80, size: 11, fill: C.dim, anchor: 'middle', content: identity.role.toUpperCase(), lock: identity.role.length * cw(11) })}
<g>${anim('opacity', '1;0.25;1', '2s')}${circle({ cx, cy: 52, r: 3.6, fill: C.neon })}</g>
${text({ x: cx, y: 34, size: 10.5, fill: C.dim2, anchor: 'middle', content: 'VERIFIED HUMAN ▸ DEV' })}
<rect width="${W}" height="${H}" fill="url(#idScan)" opacity="0.3"/>`,
  });
}

const circle = ({ cx, cy, r, fill }) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

/* ==================================================================
 * 9. SNAKE PLACEHOLDER — replaced by .github/workflows/snake.yml
 * ================================================================== */
function snakePlaceholder() {
  const W = 1000, H = 232, cols = 48, rows = 7, cell = 15, gapX = 4.5, gapY = 5, ox = 40, oy = 44;
  const rand = rng(11);
  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lvl = rand();
      const on = lvl > 0.55;
      const color = on
        ? [C.dim2, C.dim, C.neon, C.neon2, C.mint][Math.min(4, Math.floor((lvl - 0.55) / 0.1))]
        : '#0a1f14';
      dots.push(rect({
        x: round(ox + c * (cell + gapX)), y: round(oy + r * (cell + gapY)),
        w: cell, h: cell, rx: 3.5, fill: color, op: on ? 0.95 : 1,
      }));
    }
  }
  const gridW = cols * (cell + gapX) - gapX;
  const path = `M${ox - 26} ${oy + 3.2 * (cell + gapY)}
    h120 q14 0 22 10 q8 10 22 10 h150 q14 0 22 -10 q8 -10 22 -10 h150 q14 0 22 10 q8 10 22 10 h150`;
  return svg({
    w: W, h: H,
    defs: `<defs>${glow('snGlow', 6, C.neon)}
${lgrad('snBody', [[0, C.dim], [0.25, C.neon], [0.6, C.neon2], [1, C.mint]])}</defs>`,
    title: 'contribution snake (pending first run)',
    body: `
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${text({ x: 40, y: 26, size: 12.5, fill: C.dim, content: '[ CONTRIBUTION GRID ]' })}
${text({ x: W - 40, y: 26, size: 11, fill: C.dim2, anchor: 'end', content: '// the live snake is generated by the snake workflow' })}
${dots.join('\n')}
<g opacity="0.95" filter="url(#snGlow)">
  <path d="${path}" fill="none" stroke="url(#snBody)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
  <circle r="7.5" fill="${C.neon}">
    ${animT('translate', `${ox - 26} ${oy + 3.2 * (cell + gapY)}; ${ox + gridW + 60} ${oy + 3.2 * (cell + gapY)}`, '9s')}
  </circle>
</g>
<g>
  ${animT('translate', `${ox - 26} ${oy + 3.2 * (cell + gapY)}; ${ox + gridW + 60} ${oy + 3.2 * (cell + gapY)}`, '9s')}
  <circle r="13" fill="${C.neon}" opacity="0.18"/>
</g>
${text({ x: W / 2, y: H - 16, size: 11, fill: C.dim2, anchor: 'middle', content: 'placeholder — run the “Contribution snake” action once to fill this with real data' })}`,
  });
}

/* ==================================================================
 * 10. 3D CONTRIBUTION PLACEHOLDER — replaced by the 3d-contrib workflow
 * ================================================================== */
function threeDPlaceholder() {
  const W = 1000, H = 360, cols = 30, rows = 9, tw = 26, th = 13;
  const rand = rng(29);
  const bars = [];
  const originY = 122;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const px = round(W / 2 + (i - j) * (tw / 2) - (cols * tw) / 4 + tw / 4);
      const py = round(originY + (i + j) * (th / 2) - (rows * th) / 4);
      const lvl = rand();
      const h = lvl > 0.5 ? 6 + lvl * 44 : 2;
      const top = lvl > 0.78 ? C.mint : lvl > 0.62 ? C.neon : lvl > 0.5 ? C.dim : '#0b2416';
      const left = lvl > 0.5 ? '#0a3f23' : '#081a10';
      const right = lvl > 0.5 ? '#0e5730' : '#0b2416';
      const rhombus = `M${px} ${py - h} L${px + tw / 2} ${py - h + th / 2} L${px} ${py - h + th} L${px - tw / 2} ${py - h + th / 2} Z`;
      const leftFace = `M${px - tw / 2} ${py - h + th / 2} L${px} ${py - h + th} L${px} ${py + th} L${px - tw / 2} ${py + th / 2} Z`;
      const rightFace = `M${px} ${py - h + th} L${px + tw / 2} ${py - h + th / 2} L${px + tw / 2} ${py + th / 2} L${px} ${py + th} Z`;
      const pulse = lvl > 0.62
        ? `<animateTransform attributeName="transform" type="scale" values="1 1;1 ${(0.65 + lvl * 0.2).toFixed(2)};1 1" dur="${(2.2 + lvl * 2).toFixed(2)}s" begin="${(lvl * 2).toFixed(2)}s" repeatCount="indefinite" additive="sum"/>`
        : '';
      bars.push(`<g transform="translate(${px} ${py})">
  <g transform="translate(${-px} ${-py})">
    ${pulse}
    <path d="${leftFace}" fill="${left}" stroke="#0a2e1b" stroke-width="0.6"/>
    <path d="${rightFace}" fill="${right}" stroke="#0a2e1b" stroke-width="0.6"/>
    <path d="${rhombus}" fill="${top}" stroke="#00ff4144" stroke-width="0.6"/>
  </g>
</g>`);
    }
  }
  return svg({
    w: W, h: H,
    defs: `<defs>${glow('tdGlow', 8, C.neon)}
${rgrad('tdFloor', [[0, C.neon, 0.12], [1, C.neon, 0]])}
${lgrad('tdTitle', [[0, C.neon, 0], [0.5, C.mint, 0.9], [1, C.neon, 0]], '0%', '0%', '100%', '0%')}</defs>`,
    title: '3D contribution graph (pending first run)',
    body: `
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<ellipse cx="${W / 2}" cy="210" rx="430" ry="120" fill="url(#tdFloor)"/>
${text({ x: 30, y: 34, size: 12.5, fill: C.neon, weight: 600, content: '[ 3D CONTRIBUTION SKYLINE ]' })}
${text({ x: W - 30, y: 34, size: 11, fill: C.dim2, anchor: 'end', content: '// placeholder — filled by the 3d-contrib workflow' })}
<path d="M30 46 H${W - 30}" stroke="url(#tdTitle)" stroke-width="1"/>
${bars.join('\n')}
${text({ x: W / 2, y: H - 18, size: 11, fill: C.dim2, anchor: 'middle', content: 'every block is a day — keep them tall' })}`,
  });
}

/* ================================================================== */
console.log('▸ building animated SVG assets');
out('hero.svg', hero());
out('terminal.svg', terminal());
out('stack.svg', stackStrip());
out('skills.svg', skillsGrid());
out('live-now.svg', liveNow());
out('divider.svg', divider());
out('footer.svg', footer());
out('id-plate.svg', idPlate());
outAt('assets/generated/snake.svg', snakePlaceholder());
outAt('profile-3d-contrib/profile-night-green.svg', threeDPlaceholder());
console.log('▸ done');
