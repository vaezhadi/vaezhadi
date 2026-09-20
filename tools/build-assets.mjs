/* ------------------------------------------------------------------
 *  build-assets.mjs — writes the animated SVGs into /assets
 *  run:  node tools/build-assets.mjs        (or: npm run assets)
 *        node tools/build-assets.mjs --preview    → also renders PNGs
 * ------------------------------------------------------------------ */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import {
  T, SANS, esc, text, rect, anim, animT, fadeIn, riseIn, growW, shimmer, lgrad, rgrad, svg, round,
} from './svg-lib.mjs';

const cfg = JSON.parse(readFileSync(new URL('./profile.config.json', import.meta.url), 'utf8'));
const { identity, skills } = cfg;

const PREVIEW = process.argv.includes('--preview');
mkdirSync(new URL('../assets', import.meta.url), { recursive: true });
if (PREVIEW) mkdirSync(new URL('./.preview', import.meta.url), { recursive: true });

const out = (name, content) => {
  const clean = content.replace(/\n{3,}/g, '\n\n');
  writeFileSync(new URL(`../assets/${name}`, import.meta.url), clean);
  let note = '';
  if (PREVIEW) {
    /* render the settled frame: drop the animations, force opacity 1,
       and materialise widths that only exist inside <animate to="…"> */
    const finals = [...clean.matchAll(/<animate attributeName="width"[^>]*to="([\d.]+)"/g)].map((m) => m[1]);
    let k = 0;
    const flat = clean
      .replace(/<animateTransform[^>]*>/g, '')
      .replace(/<animate[^>]*>/g, '')
      .replace(/width="0"/g, () => `width="${finals[k++] ?? 0}"`)
      .replace(/(?<!stop-)opacity="0"/g, 'opacity="1"');
    const png = new Resvg(flat, {
      fitTo: { mode: 'zoom', value: 1 },
      font: { loadSystemFonts: true, defaultFontFamily: 'sans-serif' },
    }).render().asPng();
    writeFileSync(new URL(`./.preview/${name.replace('.svg', '.png')}`, import.meta.url), png);
    note = `  → .preview/${name.replace('.svg', '.png')}`;
  }
  console.log(`  ✓ assets/${name}  (${(Buffer.byteLength(clean) / 1024).toFixed(1)} KB)${note}`);
};

/* ==================================================================
 * 1. HERO — name, role, one hairline that draws itself, and a slow
 *    light that drifts along it. Nothing else moves.
 * ================================================================== */
function hero() {
  const W = 1200, H = 258;
  const name = identity.name;
  const role = identity.role.toUpperCase();
  const lineW = 300, lineX = (W - lineW) / 2, lineY = 190;

  return svg({
    w: W, h: H,
    title: `${name} — ${identity.role}`,
    defs: `
${rgrad('heroGlow', [[0, T.accent, 0.08], [0.55, T.accent, 0.025], [1, T.accent, 0]])}
${lgrad('line', [[0, T.accent, 0], [0.5, T.accent, 0.55], [1, T.accent, 0]])}
${lgrad('shim', [[0, T.text, 0], [0.5, T.accentSoft, 0.9], [1, T.text, 0]])}`,
    body: `
<rect width="${W}" height="${H}" fill="${T.bg}"/>
<ellipse cx="${W / 2}" cy="26" rx="620" ry="196" fill="url(#heroGlow)">
  ${anim('opacity', '0.75;1;0.75', '11s')}
</ellipse>

<g opacity="0">${fadeIn(0.15, 1)}${riseIn(0.15, 1, 14)}
  ${text({ x: W / 2, y: 122, size: 52, weight: 600, ls: 6, fill: T.text, anchor: 'middle', content: name })}
</g>

<g opacity="0">${fadeIn(0.5, 0.9)}
  ${text({ x: W / 2, y: 164, size: 14, weight: 500, ls: 5, fill: T.accent, anchor: 'middle', content: role })}
</g>

<g opacity="0">${fadeIn(0.8, 0.6)}
  ${rect({ x: lineX, y: lineY, w: 0, h: 1.5, rx: 0.75, fill: 'url(#line)', extra: growW(lineW, 0.8, 1.2) })}
</g>
${shimmer({ x: lineX, y: lineY, w: 110, h: 1.5, travel: lineW, dur: 9, begin: 2.6, peak: 0.5, gradId: 'shim' })}

<g opacity="0">${fadeIn(1.15, 1)}
  ${text({ x: W / 2, y: 224, size: 15, fill: T.muted, anchor: 'middle', content: identity.tagline })}
</g>`,
  });
}

/* ==================================================================
 * 2. STACK — an index of technologies. Each hairline draws itself, a
 *    single soft light travels along it, then everything stays quiet.
 * ================================================================== */
function skillsPanel() {
  const W = 1064, H = 176;
  const colX = [40, 580], rowH = 46, startY = 40;
  const nameW = 160, ruleW = 300;
  const items = (cfg.skills || []).map((s) => (typeof s === 'string' ? s : s.name));
  const rows = [];

  items.slice(0, 6).forEach((name, i) => {
    const col = Math.floor(i / 3), row = i % 3;
    const x = colX[col], y = startY + row * rowH;
    const ruleX = x + nameW;
    const t = 0.25 + (row * 2 + col) * 0.1;

    rows.push(`<g opacity="0">${fadeIn(t, 0.65)}
  ${text({ x, y, size: 15, fill: T.text, content: name })}
  ${rect({ x: ruleX, y: y - 5, w: 0, h: 1, fill: T.hair, extra: growW(ruleW, t + 0.18, 0.95) })}
  <g opacity="0">
    <animate attributeName="opacity" values="0;0.85;0" dur="1.5s" begin="${round(t + 0.9)}s" fill="freeze" keyTimes="0;0.35;1"/>
    <g>
      <animateTransform attributeName="transform" type="translate" values="-90 0; ${round(ruleW)} 0" dur="1.5s" begin="${round(t + 0.9)}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.3 0.7 0.3 1" values="-90 0;${round(ruleW)} 0"/>
      ${rect({ x: ruleX, y: y - 5.5, w: 90, h: 2, rx: 1, fill: 'url(#skShim)' })}
    </g>
  </g>
</g>`);
  });

  return svg({
    w: W, h: H,
    title: 'Stack',
    defs: lgrad('skShim', [[0, T.accent, 0], [0.5, T.accentSoft, 0.9], [1, T.accent, 0]]),
    body: `
<rect width="${W}" height="${H}" fill="${T.bg}"/>
${rows.join('\n')}`,
  });
}

/* ==================================================================
 * 3. DIVIDER — hairline with a slow travelling light
 * ================================================================== */
function divider() {
  const W = 1200, H = 26, y = 13;
  return svg({
    w: W, h: H,
    title: '',
    defs: `${lgrad('dvLine', [[0, T.accent, 0], [0.5, T.hair, 1], [1, T.accent, 0]])}
${lgrad('dvShim', [[0, T.text, 0], [0.5, T.accent, 0.7], [1, T.text, 0]])}`,
    body: `
<rect width="${W}" height="${H}" fill="${T.bg}"/>
${rect({ x: 60, y, w: W - 120, h: 1, fill: 'url(#dvLine)' })}
${shimmer({ x: 60, y: y - 0.5, w: 140, h: 2, travel: W - 260, dur: 12, begin: 1.5, peak: 0.4, gradId: 'dvShim' })}`,
  });
}

/* ==================================================================
 * 4. FOOTER — one line of invitation, a quiet live handle
 * ================================================================== */
function footer() {
  const W = 1200, H = 156;
  const cta = cfg.footer?.headline || 'Let\u2019s build something.';
  const handle = `@${identity.handle}`;
  return svg({
    w: W, h: H,
    title: cta,
    defs: lgrad('ftRule', [[0, T.accent, 0], [0.5, T.hair, 1], [1, T.accent, 0]]),
    body: `
<rect width="${W}" height="${H}" fill="${T.bg}"/>
${rect({ x: 60, y: 26, w: W - 120, h: 1, fill: 'url(#ftRule)' })}

<g opacity="0">${fadeIn(0.2, 0.9)}${riseIn(0.2, 0.9, 10)}
  ${text({ x: W / 2, y: 80, size: 26, weight: 600, ls: 0.5, fill: T.text, anchor: 'middle', content: cta })}
</g>

<g opacity="0">${fadeIn(0.6, 0.9)}
  ${text({ x: W / 2, y: 114, size: 14, fill: T.muted, anchor: 'middle', content: handle })}
</g>

<circle cx="${round(W / 2 - handle.length * 4.05 - 16)}" cy="109.5" r="4" fill="${T.accent}">
  ${anim('opacity', '1;0.2;1', '2.4s')}
</circle>

<g opacity="0">${fadeIn(0.9, 0.8)}
  ${text({ x: W / 2, y: 142, size: 12, fill: T.dim, anchor: 'middle', content: identity.location })}
</g>`,
  });
}

/* ================================================================== */
console.log('▸ building assets');
out('hero.svg', hero());
out('skills.svg', skillsPanel());
out('divider.svg', divider());
out('footer.svg', footer());
console.log('▸ done');
