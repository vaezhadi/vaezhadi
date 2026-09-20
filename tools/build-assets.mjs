/* ------------------------------------------------------------------
 *  build-assets.mjs — the profile card, dressed in GitHub's own theme.
 *
 *  Two variants are built so the card blends into the profile page in
 *  both colour modes (README uses <picture> to switch automatically):
 *      assets/card-dark.svg    ·  assets/card-light.svg
 *
 *  Backgrounds are transparent, so the card sits on the page like native
 *  GitHub UI rather than as a separate framed file.
 *
 *  Usage
 *    node build-assets.mjs            → both SVGs
 *    node build-assets.mjs --png      → + assets/card-<variant>.png stills
 *    node build-assets.mjs --gif      → + tools/.preview/card-<variant>.gif
 * ------------------------------------------------------------------ */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';
import { brand, slugFor } from './icons.mjs';
import { validateCard } from './validate-svg.mjs';
import { MONO, SANS, esc, text, rect, rectEl, round, wrapText, svg } from './svg-lib.mjs';

const cfg = JSON.parse(readFileSync(new URL('./profile.config.json', import.meta.url), 'utf8'));
const { identity, skills, quote } = cfg;
const langs = (skills || []).map((s) => (typeof s === 'string' ? s : s.name));

/* ==================================================================
 *  GitHub's own palettes
 * ================================================================== */
const THEMES = {
  dark: {
    name: 'dark',
    bg: 'none',                 /* transparent: the page shows through */
    canvas: '#161b22',
    canvasSubtle: '#0d1117',
    border: '#30363d',
    borderMuted: '#21262d',
    fg: '#e6edf3',
    fgMuted: '#8b949e',
    fgSubtle: '#6e7681',
    accent: '#3fb950',
    link: '#58a6ff',
    iconTint: 0.3,              /* brand colours are lightened for dark bg */
    contrib: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
  },
  light: {
    name: 'light',
    bg: 'none',
    canvas: '#f6f8fa',
    canvasSubtle: '#ffffff',
    border: '#d1d9e0',
    borderMuted: '#d8dee4',
    fg: '#1f2328',
    fgMuted: '#59636e',
    fgSubtle: '#818b98',
    accent: '#1a7f37',
    link: '#0969da',
    iconTint: -0.22,            /* …and darkened for a white background */
    contrib: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  },
};

/* ==================================================================
 *  animation helpers — one code path emits SMIL or renders any instant
 * ================================================================== */
let FRAME = null;
const isFrame = () => FRAME !== null;
const ease = (x) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const prog = (begin, dur) => (isFrame() ? clamp01((FRAME - begin) / dur) : 0);
const done = (begin) => (isFrame() ? FRAME >= begin : false);

const fade = (begin, dur = 0.8) =>
  `<animate attributeName="opacity" from="0" to="1" begin="${round(begin)}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.6 0.2 1" values="0;1"/>`;

const rise = (begin, dur, dy = 10) =>
  `<animateTransform attributeName="transform" type="translate" from="0 ${dy}" to="0 0" begin="${round(begin)}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.6 0.2 1" values="0 ${dy};0 0"/>`;

const reveal = ({ begin, dur = 0.8, dy = 0, inner }) => {
  if (isFrame()) {
    const k = ease(prog(begin, dur));
    return `<g opacity="${round(k)}"${dy ? ` transform="translate(0 ${round(dy * (1 - k))})"` : ''}>${inner}</g>`;
  }
  return `<g opacity="0">${fade(begin, dur)}${dy ? rise(begin, dur, dy) : ''}${inner}</g>`;
};

const rule = ({ x, y, w, begin, dur = 0.9, color }) => {
  if (isFrame()) return rect({ x, y, w: round(w * ease(prog(begin, dur))), h: 1, fill: color });
  return rectEl(
    { x, y, w: 0, h: 1, fill: color },
    `<animate attributeName="width" from="0" to="${round(w)}" begin="${round(begin)}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 0.61 0.2 1" values="0;${round(w)}"/>`
  );
};

/* ---- text -----------------------------------------------------------
 * GitHub profile text is proportional (not monospace), so rather than
 * pinning each glyph to a cell we let the renderer lay the line out and
 * reveal one <tspan> per character. Layout is identical in both modes.
 * ------------------------------------------------------------------ */
const nbsp = (str) => str.replace(/ /g, '\u00a0');

const typedText = ({ content, x, y, size, fill, begin, perChar = 0.03, weight = 400, italic = false }) => {
  const chars = [...content];
  const attrs = `x="${round(x)}" y="${round(y)}" font-family="${SANS}" font-size="${round(size)}" fill="${fill}" text-anchor="start" xml:space="preserve"${weight !== 400 ? ` font-weight="${weight}"` : ''}${italic ? ' font-style="italic"' : ''}`;
  const end = begin + chars.length * perChar;

  if (isFrame()) {
    const typed = FRAME <= 0 ? 0 : Math.min(chars.length, Math.max(0, Math.round((FRAME - begin) / perChar)));
    return { svg: `<text ${attrs}>${esc(nbsp(chars.slice(0, typed).join('')))}</text>`, end, length: chars.length };
  }

  const tspans = chars
    .map((ch, i) => `<tspan opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${round(begin + i * perChar)}s" dur="0.09s" fill="freeze" values="0;1"/>${esc(nbsp(ch))}</tspan>`)
    .join('');
  return { svg: `<text ${attrs}>${tspans}</text>`, end, length: chars.length };
};

/* the caret rides inside the same text element as a trailing glyph, so it
   always sits right after the last character the renderer drew */
const caretTail = ({ content, begin, perChar, color }) => {
  const count = [...content].length;
  const settle = begin + count * perChar;
  if (isFrame()) return '';
  return `<tspan fill="${color}" opacity="0.95">\u258c<animate attributeName="opacity" values="0;0;0.95;0.95;0;0.95;0.95" dur="1.1s" begin="${round(settle)}s" repeatCount="indefinite"/></tspan>`;
};

/* ==================================================================
 *  SECTION HEADER — GitHub's own section pattern: title + hairline
 * ================================================================== */
const sectionHeader = ({ title, x, y, w, begin, theme, size = 16 }) => {
  const typed = typedText({ content: title, x, y, size, fill: theme.fg, begin, perChar: 0.04, weight: 600 });
  const lineBegin = typed.end + 0.15;
  return {
    svg: `${typed.svg}<g opacity="0">${isFrame() ? '' : fade(lineBegin - 0.1, 0.4)}${rule({ x, y: y + 12, w, begin: lineBegin, color: theme.border })}</g>`,
    end: lineBegin + 0.9,
  };
};

/* ==================================================================
 *  LANGUAGE LEGEND — GitHub's dot language style, with the real brand mark
 * ================================================================== */
function legendEntry({ item, x, y, begin, theme, index }) {
  const slug = slugFor(item);
  const icon = slug ? brand(slug, { tint: theme.iconTint }) : null;
  const R = 11;                                    /* icon box */
  const k = R / 24;
  const dotR = 4;

  /* GitHub's own signature: a coloured dot, then the name */
  const dot = isFrame()
    ? `<circle cx="${x + dotR}" cy="${y - 4}" r="${dotR}" fill="${icon ? icon.color : theme.fgMuted}" opacity="${round(ease(prog(begin, 0.5)))}"/>`
    : `<circle cx="${x + dotR}" cy="${y - 4}" r="${dotR}" fill="${icon ? icon.color : theme.fgMuted}" opacity="0">
        ${fade(begin, 0.5)}
        <animate attributeName="r" values="0;${dotR + 1.6};${dotR}" begin="${round(begin)}s" dur="0.7s" fill="freeze"/>
      </circle>`;

  /* …and the brand glyph, which draws itself and fills in */
  const glyphBegin = begin + 0.25;
  const drawK = isFrame() ? ease(prog(glyphBegin, 0.7)) : 0;
  const fillK = isFrame() ? ease(prog(glyphBegin + 0.55, 0.5)) : 0;
  const iconGroup = icon
    ? `<g transform="translate(${round(x + 18)} ${round(y - 4 - R / 2)}) scale(${round(k)})">
        <path d="${icon.path}" pathLength="1" fill="none" stroke="${icon.color}" stroke-width="1.3" stroke-linejoin="round"
          stroke-dasharray="1" stroke-dashoffset="${isFrame() ? round(1 - drawK) : 1}">
          ${isFrame() ? '' : `<animate attributeName="stroke-dashoffset" from="1" to="0" begin="${round(glyphBegin)}s" dur="0.7s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.3 0.6 0.2 1" values="1;0"/>`}
        </path>
        <path d="${icon.path}" fill="${icon.color}" opacity="${isFrame() ? round(fillK) : 0}">
          ${isFrame() ? '' : fade(glyphBegin + 0.55, 0.5)}
        </path>
      </g>`
    : '';

  /* the label types itself, like every other piece of text on the card */
  const label = typedText({ content: item, x: x + 40, y, size: 14, fill: theme.fg, begin: glyphBegin + 0.5, perChar: 0.03 });

  return `${dot}${iconGroup}${label.svg}`;
}

/* ==================================================================
 *  CONTRIBUTION STRIP — the most GitHub thing there is
 * ================================================================== */
function contributionStrip({ x, y, cols, rows, size, gap, begin, theme }) {
  const seed = 20260920;
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = rnd();
      const level = v > 0.92 ? 4 : v > 0.78 ? 3 : v > 0.58 ? 2 : v > 0.3 ? 1 : 0;
      const cx = x + c * (size + gap);
      const cy = y + r * (size + gap);
      const b = begin + (c * rows + r) * 0.0035;
      const color = theme.contrib[level];
      /* squares pop in one by one — the same little dance GitHub does */
      cells.push(
        isFrame()
          ? `<rect x="${round(cx)}" y="${round(cy)}" width="${size}" height="${size}" rx="2" fill="${color}" opacity="${round(ease(prog(b, 0.35)))}"/>`
          : `<g opacity="0">${fade(b, 0.35)}
              <rect x="${round(cx)}" y="${round(cy)}" width="0" height="0" rx="2" fill="${color}">
                <animate attributeName="width" from="0" to="${size}" begin="${round(b)}s" dur="0.35s" fill="freeze" values="0;${size}"/>
                <animate attributeName="height" from="0" to="${size}" begin="${round(b)}s" dur="0.35s" fill="freeze" values="0;${size}"/>
              </rect>
            </g>`
      );
    }
  }

  /* one light sweeps the grid once it is full — a nod to “updated daily” */
  const sweepBegin = begin + cols * rows * 0.0035 + 0.5;
  const gradId = `contribSweep-${theme.name}`;
  const sweep = isFrame()
    ? (() => {
        const local = FRAME - sweepBegin;
        if (local < 0 || local > 1.6) return '';
        const k = local / 1.6;
        const gw = 180;
        const gx = x + (cols * (size + gap) - gw) * k;
        return `<rect x="${round(gx)}" y="${y}" width="${gw}" height="${rows * (size + gap) - gap}" fill="url(#${gradId})" opacity="${round(0.5 * Math.sin(Math.PI * k))}"/>`;
      })()
    : `<g opacity="0">
        <animate attributeName="opacity" values="0;0;0.55;0" dur="5.2s" begin="${round(sweepBegin)}s" repeatCount="indefinite" keyTimes="0;0.55;0.72;1"/>
        <g>
          <animateTransform attributeName="transform" type="translate" values="0 0; ${round(cols * (size + gap))} 0" dur="5.2s" begin="${round(sweepBegin)}s" repeatCount="indefinite"/>
          <rect x="${round(x - 180)}" y="${y}" width="180" height="${rows * (size + gap) - gap}" fill="url(#${gradId})"/>
        </g>
      </g>`;

  const def = `<linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0" stop-color="${theme.accent}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${theme.accent}" stop-opacity="0.5"/>
    <stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
  </linearGradient>`;

  return { svg: cells.join(''), sweep, def, height: rows * (size + gap) - gap };
}

/* ==================================================================
 *  THE CARD
 * ================================================================== */
function buildCard(theme) {
  const W = 1000;
  const PAD = 28;
  const CW = W - PAD * 2;
  const parts = [];
  const defs = [];
  let t = 0.35;

  /* ── header ───────────────────────────────────────────────────────── */
  const name = typedText({ content: identity.name, x: PAD, y: 62, size: 30, fill: theme.fg, begin: t, perChar: 0.055, weight: 600 });
  parts.push(name.svg.replace('</text>', caretTail({ content: identity.name, begin: t, perChar: 0.055, color: theme.accent }) + '</text>'));
  t = name.end + 0.35;

  const role = typedText({ content: identity.role, x: PAD, y: 92, size: 15, fill: theme.fgMuted, begin: t, perChar: 0.034 });
  parts.push(role.svg.replace('</text>', caretTail({ content: identity.role, begin: t, perChar: 0.034, color: theme.fgSubtle }) + '</text>'));
  t = role.end + 0.5;

  const headline = typedText({ content: identity.tagline, x: PAD, y: 128, size: 16, fill: theme.fg, begin: t, perChar: 0.02 });
  parts.push(headline.svg.replace('</text>', caretTail({ content: identity.tagline, begin: t, perChar: 0.02, color: theme.accent }) + '</text>'));
  t = headline.end + 0.6;

  /* ── about ────────────────────────────────────────────────────────── */
  const aboutY = 172;
  const aboutHead = sectionHeader({ title: 'About', x: PAD, y: aboutY, w: CW, begin: t, theme });
  parts.push(aboutHead.svg);
  t = aboutHead.end + 0.25;

  const aboutLines = wrapText(identity.about, CW - 16, 15, 0.62);
  aboutLines.forEach((line, i) => {
    const y = aboutY + 46 + i * 25;
    const begin = t + i * 0.14;
    const ln = typedText({ content: line, x: PAD, y, size: 15, fill: theme.fgMuted, begin, perChar: 0.009 });
    parts.push(reveal({ begin, dur: 0.4, dy: 6, inner: ln.svg.replace('</text>', caretTail({ content: line, begin, perChar: 0.009, color: theme.fgSubtle }) + '</text>') }));
  });
  const aboutEnd = t + (aboutLines.length - 1) * 0.14 + Math.max(...aboutLines.map((l) => l.length)) * 0.009 + 0.4;

  /* ── quote ────────────────────────────────────────────────────────── */
  let cursor = aboutY + 46 + aboutLines.length * 25;
  if (quote) {
    const q = typedText({ content: `“${quote}”`, x: PAD, y: cursor + 14, size: 14, fill: theme.fgSubtle, begin: aboutEnd, perChar: 0.016, italic: true });
    parts.push(q.svg);
    cursor += 14;
    t = q.end + 0.6;
  } else {
    t = aboutEnd;
  }

  /* ── languages ────────────────────────────────────────────────────── */
  const stackY = cursor + 64;
  const stackHead = sectionHeader({ title: 'Languages', x: PAD, y: stackY, w: CW, begin: t, theme });
  parts.push(stackHead.svg);
  t = stackHead.end + 0.3;

  const legendCols = 3;
  const legendW = CW / legendCols;
  const legendTop = stackY + 44;
  langs.forEach((item, i) => {
    const col = i % legendCols, row = Math.floor(i / legendCols);
    parts.push(legendEntry({
      item, x: PAD + col * legendW, y: legendTop + row * 40, begin: t + i * 0.14, theme, index: i,
    }));
  });
  t = t + (langs.length - 1) * 0.14 + 1;
  const legendBottom = legendTop + Math.ceil(langs.length / legendCols) * 40 - 40;

  /* ── contribution strip ───────────────────────────────────────────── */
  const contribY = legendBottom + 64;
  const contribHead = sectionHeader({ title: 'Contribution activity', x: PAD, y: contribY, w: CW, begin: t, theme });
  parts.push(contribHead.svg);
  t = contribHead.end + 0.3;

  const cellSize = 11, cellGap = 3;
  const cols = Math.floor((CW + cellGap) / (cellSize + cellGap));
  const strip = contributionStrip({ x: PAD, y: contribY + 36, cols, rows: 7, size: cellSize, gap: cellGap, begin: t, theme });
  parts.push(strip.svg, strip.sweep);
  defs.push(strip.def);
  const contribBottom = contribY + 36 + strip.height;

  /* ── footer ───────────────────────────────────────────────────────── */
  const footY = contribBottom + 56;
  parts.push(`<g opacity="0">${isFrame() ? '' : fade(t + 0.6, 0.6)}${rule({ x: PAD, y: footY - 26, w: CW, begin: t + 0.5, color: theme.borderMuted })}</g>`);

  const handleLine = `@${identity.handle} · ${identity.location}`;
  const handleBegin = t + 0.95;
  const handleTyped = typedText({ content: handleLine, x: PAD + 16, y: footY, size: 13.5, fill: theme.fgMuted, begin: handleBegin, perChar: 0.028 });
  parts.push(handleTyped.svg);
  const dotBegin = handleBegin + handleLine.length * 0.028 + 0.15;
  parts.push(
    isFrame()
      ? `<circle cx="${PAD + 4}" cy="${footY - 4.5}" r="4" fill="${theme.accent}" opacity="${done(dotBegin) ? 1 : 0}"/>`
      : `<circle cx="${PAD + 4}" cy="${footY - 4.5}" r="4" fill="${theme.accent}" opacity="0">${fade(dotBegin, 0.4)}
          <animate attributeName="opacity" values="1;0.25;1" dur="2.4s" begin="${round(dotBegin + 0.4)}s" repeatCount="indefinite"/>
        </circle>`
  );

  const total = dotBegin + 0.6;
  const H = round(footY + 32);

  const canvas = svg({
    w: W, h: H,
    title: `${identity.name} — ${identity.role}`,
    defs: defs.join('\n'),
    body: parts.join('\n'),
  });

  return { canvas, total, W, H };
}

/* ==================================================================
 *  OUTPUT
 * ================================================================== */
const OUT = (rel) => new URL(`../${rel}`, import.meta.url);
mkdirSync(OUT('assets'), { recursive: true });
mkdirSync(new URL('./.preview', import.meta.url), { recursive: true });

const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const wanted = only ? [only] : ['dark', 'light'];

const rendered = {};
for (const variant of wanted) {
  const theme = THEMES[variant];
  FRAME = null;
  const { canvas, total, W, H } = buildCard(theme);
  const clean = canvas.replace(/>\s+</g, '><').replace(/\n{2,}/g, '\n');
  const info = validateCard(clean, `card-${variant}.svg`);
  writeFileSync(OUT(`assets/card-${variant}.svg`), clean);
  console.log(`  ✓ assets/card-${variant}.svg  ${W}×${H}, ${(info.bytes / 1024).toFixed(1)} KB, ${round(total)}s — XML valid (${info.groups} groups)`);

  const render = (time, zoom) => {
    FRAME = time;
    const { canvas: frame } = buildCard(theme);
    FRAME = null;
    return new Resvg(frame, {
      fitTo: { mode: 'zoom', value: zoom },
      font: { loadSystemFonts: true, defaultFontFamily: 'sans-serif' },
    }).render().asPng();
  };
  rendered[variant] = { render, total, W, H };
}

if (process.argv.includes('--png')) {
  for (const variant of wanted) {
    const png = rendered[variant].render(1e6, 2);
    writeFileSync(OUT(`assets/card-${variant}.png`), png);
    console.log(`  ✓ assets/card-${variant}.png  (settled frame @2×, ${(png.length / 1024).toFixed(0)} KB)`);
  }
}

if (process.argv.includes('--gif')) {
  const bg = { dark: '#0d1117', light: '#ffffff' };
  for (const variant of wanted) {
    const { render, total } = rendered[variant];
    const dir = new URL(`./.preview/frames-${variant}/`, import.meta.url);
    mkdirSync(dir, { recursive: true });
    const step = 0.3;
    const frames = [];
    for (let i = 0, time = 0; time <= total + 2.4; i++, time += step) {
      const file = new URL(`f${String(i).padStart(3, '0')}.png`, dir);
      writeFileSync(file, render(time, 1));
      frames.push(file.pathname);
    }
    const gif = new URL(`./.preview/card-${variant}.gif`, import.meta.url);
    execFileSync('convert', [
      '-size', `${rendered[variant].W}x${rendered[variant].H}`, `xc:${bg[variant]}`,
      ...frames.map((f) => ['(', f, '-background', bg[variant], '-alpha', 'remove', ')']).flat(),
      '-delay', String(Math.round(step * 100)), '-loop', '0',
      '-resize', '760x', '-colors', '96', '-layers', 'OptimizePlus', gif.pathname,
    ]);
    console.log(`  ✓ tools/.preview/card-${variant}.gif  (${frames.length} frames)`);
  }
}
