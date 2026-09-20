/* ------------------------------------------------------------------
 *  build-assets.mjs — the profile card.
 *
 *  Colours come straight from GitHub's palettes and the background is the
 *  profile page colour itself (#0d1117 dark / #ffffff light), so the card
 *  reads as part of the page — while the animations stay rich.
 *
 *  Language icons are back to rounded tiles, one per language.
 *
 *  Text animations
 *    · character-by-character typing with a travelling caret (every line)
 *    · a light that sweeps across the name and the headline every few seconds
 *    · section titles type in, then their hairline draws and a pulse runs
 *      along it
 *    · paragraphs rise line by line as they are typed
 *    · tile captions type in under their icon
 *
 *  Usage
 *    node build-assets.mjs             → assets/card-{dark,light}.svg
 *    node build-assets.mjs --png       → + still frames
 *    node build-assets.mjs --gif       → + animated previews
 * ------------------------------------------------------------------ */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';
import { brand, slugFor } from './icons.mjs';
import { validateCard } from './validate-svg.mjs';
import { SANS, esc, text, rect, rectEl, round, wrapText, svg } from './svg-lib.mjs';

const cfg = JSON.parse(readFileSync(new URL('./profile.config.json', import.meta.url), 'utf8'));
const { identity, skills, quote } = cfg;
const langs = (skills || []).map((s) => (typeof s === 'string' ? s : s.name));

/* ==================================================================
 *  GitHub palettes — backgrounds are the profile page colours
 * ================================================================== */
const THEMES = {
  dark: {
    name: 'dark',
    page: '#0d1117',            /* profile page background */
    surface: '#161b22',         /* tiles / cards */
    surfaceAlt: '#0d1117',
    border: '#30363d',
    borderMuted: '#21262d',
    fg: '#e6edf3',
    fgMuted: '#8b949e',
    fgSubtle: '#6e7681',
    accent: '#3fb950',
    iconTint: 0.3,
    contrib: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
    today: '#39d353',
  },
  light: {
    name: 'light',
    page: '#ffffff',
    surface: '#f6f8fa',
    surfaceAlt: '#ffffff',
    border: '#d1d9e0',
    borderMuted: '#d8dee4',
    fg: '#1f2328',
    fgMuted: '#59636e',
    fgSubtle: '#818b98',
    accent: '#1a7f37',
    iconTint: -0.22,
    contrib: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    today: '#216e39',
  },
};

/* ==================================================================
 *  animation helpers — SMIL for the file, exact maths for still frames
 * ================================================================== */
let FRAME = null;
const isFrame = () => FRAME !== null;
const ease = (x) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const prog = (begin, dur) => (isFrame() ? clamp01((FRAME - begin) / dur) : 0);
const done = (begin) => (isFrame() ? FRAME >= begin : false);
const at = (begin, dur) => (isFrame() ? { k: (FRAME - begin) / dur, on: FRAME >= begin && FRAME <= begin + dur } : null);

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

/* ==================================================================
 *  TEXT — proportional type, revealed one <tspan> per character
 * ================================================================== */
const nbsp = (str) => str.replace(/ /g, '\u00a0');

const typedText = ({ content, x, y, size, fill, begin, perChar = 0.03, weight = 400, italic = false, anchor = 'start' }) => {
  const chars = [...content];
  const attrs = `x="${round(x)}" y="${round(y)}" font-family="${SANS}" font-size="${round(size)}" fill="${fill}" text-anchor="${anchor}" xml:space="preserve"${weight !== 400 ? ` font-weight="${weight}"` : ''}${italic ? ' font-style="italic"' : ''}`;
  const end = begin + chars.length * perChar;

  if (isFrame()) {
    const typed = FRAME <= 0 ? 0 : Math.min(chars.length, Math.max(0, Math.round((FRAME - begin) / perChar)));
    return { svg: `<text ${attrs}>${esc(nbsp(chars.slice(0, typed).join('')))}</text>`, end, length: chars.length, attrs };
  }

  const tspans = chars
    .map((ch, i) => `<tspan opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${round(begin + i * perChar)}s" dur="0.09s" fill="freeze" values="0;1"/>${esc(nbsp(ch))}</tspan>`)
    .join('');
  return { svg: `<text ${attrs}>${tspans}</text>`, end, length: chars.length, attrs };
};

/* the caret trails the line as a glyph inside the same text element, so it
   always sits exactly where the text stopped */
const caretTail = ({ content, begin, perChar, color }) => {
  if (isFrame()) return '';
  const settle = begin + [...content].length * perChar;
  return `<tspan fill="${color}" opacity="0.95">\u258c<animate attributeName="opacity" values="0;0;0.95;0.95;0;0.95;0.95" dur="1.1s" begin="${round(settle)}s" repeatCount="indefinite"/></tspan>`;
};

/* ── a light that sweeps across a line of text, every few seconds ────── */
function textShine({ id, content, x, y, size, weight = 600, width, begin, theme, period = 7, dur = 1.5 }) {
  const maskId = `${id}-mask`;
  const gradId = `${id}-grad`;
  const mask = `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="${round(x - 40)}" y="${round(y - size * 1.3)}" width="${round(width + 260)}" height="${round(size * 2.2)}">
    <text x="${round(x)}" y="${round(y)}" font-family="${SANS}" font-size="${round(size)}" fill="#ffffff"${weight !== 400 ? ` font-weight="${weight}"` : ''} xml:space="preserve">${esc(nbsp(content))}</text>
  </mask>`;
  const grad = `<linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0" stop-color="${theme.accent}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${theme.accent}" stop-opacity="0.85"/>
    <stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
  </linearGradient>`;

  const bandW = Math.max(120, width * 0.5);
  const from = round(x - bandW);
  /* generous over-travel: proportional metrics vary between renderers */
  const to = round(x + width * 1.35 + 60);

  /* the band travels during the first third of every period */
  const smil = `<g mask="url(#${maskId})">
    <g>
      <animateTransform attributeName="transform" type="translate" values="${from} 0; ${to} 0; ${to} 0" keyTimes="0;0.22;1" dur="${period}s" begin="${round(begin)}s" repeatCount="indefinite"/>
      ${rect({
        x: 0, y: round(y - size * 1.05), w: bandW, h: round(size * 1.35),
        fill: `url(#${gradId})`, op: 0.9,
      })}
    </g>
  </g>`;

  const frame = (() => {
    const local = ((FRAME - begin) % period + period) % period;
    if (FRAME < begin || local > period * 0.22) return '';
    const k = local / (period * 0.22);
    const gx = from + (to - from) * k;
    const op = round(0.9 * Math.sin(Math.PI * k));
    return `<g mask="url(#${maskId})">${rect({ x: gx, y: round(y - size * 1.05), w: bandW, h: round(size * 1.35), fill: `url(#${gradId})`, op })}</g>`;
  })();

  return { defs: [mask, grad], svg: isFrame() ? frame : smil };
}

/* ==================================================================
 *  SECTION HEADER — title types in, rule draws, a pulse runs along it
 * ================================================================== */
const sectionHeader = ({ title, x, y, w, begin, theme, size = 16, sweepId }) => {
  const typed = typedText({ content: title, x, y, size, fill: theme.fg, begin, perChar: 0.04, weight: 600 });
  const lineBegin = typed.end + 0.15;

  const pulseAt = lineBegin + 1.15;
  const gradId = `${sweepId}-grad`;
  const bandW = 150;
  const pulse = (() => {
    const period = 6.5;
    if (isFrame()) {
      const local = ((FRAME - pulseAt) % period + period) % period;
      if (FRAME < pulseAt || local > 1.3) return '';
      const k = local / 1.3;
      return rect({ x: round(x + (w - bandW) * k), y: y + 11.4, w: bandW, h: 2.2, fill: `url(#${gradId})`, op: round(0.85 * Math.sin(Math.PI * k)) });
    }
    return `<g>
      <animateTransform attributeName="transform" type="translate" values="0 0; ${round(w - bandW)} 0; ${round(w - bandW)} 0" keyTimes="0;0.2;1" dur="${period}s" begin="${round(pulseAt)}s" repeatCount="indefinite"/>
      <g opacity="0"><animate attributeName="opacity" values="0;0;0.9;0.9;0;0" keyTimes="0;0.02;0.1;0.16;0.2;1" dur="${period}s" begin="${round(pulseAt)}s" repeatCount="indefinite"/>
        ${rect({ x, y: y + 11.4, w: bandW, h: 2.2, fill: `url(#${gradId})` })}
      </g>
    </g>`;
  })();

  return {
    svg: `${typed.svg}<g opacity="0">${isFrame() ? '' : fade(lineBegin - 0.1, 0.4)}${rule({ x, y: y + 12, w, begin: lineBegin, color: theme.border })}</g>${pulse}`,
    defs: `<linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0" stop-color="${theme.accent}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${theme.accent}" stop-opacity="0.6"/>
      <stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
    </linearGradient>`,
    end: lineBegin + 0.9,
  };
};

/* ==================================================================
 *  LANGUAGE TILES — rounded GitHub-style cards, one per language
 * ================================================================== */
function languageTile({ item, x, y, w, h, begin, theme, index }) {
  const slug = slugFor(item);
  const icon = slug ? brand(slug, { tint: theme.iconTint }) : null;
  const glyph = 34;
  const k = glyph / 24;
  const cx = x + w / 2;
  const iconY = y + 30;
  const haloId = `tileGlow-${theme.name}-${index}`;

  /* icon draws itself, then fills with the brand colour */
  const drawK = isFrame() ? ease(prog(begin + 0.25, 0.65)) : 0;
  const fillK = isFrame() ? ease(prog(begin + 0.75, 0.5)) : 0;
  const iconSvg = icon
    ? `<g transform="translate(${round(cx - glyph / 2)} ${round(iconY)}) scale(${round(k)})">
        <path d="${icon.path}" pathLength="1" fill="none" stroke="${icon.color}" stroke-width="1.4" stroke-linejoin="round"
          stroke-dasharray="1" stroke-dashoffset="${isFrame() ? round(1 - drawK) : 1}">
          ${isFrame() ? '' : `<animate attributeName="stroke-dashoffset" from="1" to="0" begin="${round(begin + 0.25)}s" dur="0.65s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.3 0.6 0.2 1" values="1;0"/>`}
        </path>
        <path d="${icon.path}" fill="${icon.color}" opacity="${isFrame() ? round(fillK) : 0}">
          ${isFrame() ? '' : fade(begin + 0.75, 0.5)}
        </path>
      </g>`
    : text({ x: cx, y: iconY + glyph * 0.75, size: 20, weight: 600, fill: theme.fgMuted, anchor: 'middle', content: item.slice(0, 3) });

  /* halo behind the icon breathes for the life of the card */
  const haloBegin = begin + 0.4;
  const halo = (() => {
    if (isFrame()) {
      const local = FRAME - haloBegin;
      const phase = local <= 0 ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * local) / 4.4);
      return rect({ x, y, w, h, rx: 14, fill: `url(#${haloId})`, op: round(0.35 + 0.25 * phase) });
    }
    return rectEl(
      { x, y, w, h, rx: 14, fill: `url(#${haloId})`, op: 0.35 },
      `<animate attributeName="opacity" values="0.3;0.55;0.3" dur="4.4s" begin="${round(haloBegin)}s" repeatCount="indefinite"/>`
    );
  })();

  /* the tile lifts a little while the icon arrives, then floats gently */
  const floatBegin = begin + 0.9;
  const floatY = (() => {
    if (!isFrame()) return 0;
    const local = FRAME - floatBegin;
    if (local <= 0) return 0;
    return round(-2.2 * (0.5 - 0.5 * Math.cos((2 * Math.PI * local) / 4.4)));
  })();

  const label = typedText({
    content: item, x: cx, y: y + h - 20, size: 13.5,
    fill: theme.fgMuted, begin: begin + 1.05, perChar: 0.03, anchor: 'middle',
  });

  const body = `
  ${rect({ x, y, w, h, rx: 14, fill: theme.surface, stroke: theme.border, sw: 1 })}
  ${halo}
  <g transform="translate(0 ${isFrame() ? floatY : 0})">
    ${isFrame() ? '' : `<animateTransform attributeName="transform" type="translate" values="0 0; 0 -2.2; 0 0" dur="4.4s" begin="${round(floatBegin)}s" repeatCount="indefinite"/>`}
    ${iconSvg}
  </g>
  ${label.svg}`;

  return {
    svg: reveal({ begin, dur: 0.55, dy: 12, inner: body }),
    defs: `<radialGradient id="${haloId}" cx="50%" cy="30%" r="80%">
      <stop offset="0" stop-color="${icon ? icon.color : theme.accent}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${theme.surface}" stop-opacity="0"/>
    </radialGradient>`,
    end: label.end,
  };
}

/* ==================================================================
 *  CONTRIBUTION STRIP — cells pop in, a light sweeps, today keeps ticking
 * ================================================================== */
function contributionStrip({ x, y, cols, rows, size, gap, begin, theme }) {
  let s = 20260920;
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

  const gridBottom = y + rows * (size + gap) - gap;

  /* today's cell keeps a slow pulse — the grid is never really finished */
  const todayX = x + (cols - 1) * (size + gap);
  const todayY = y + 6 * (size + gap);
  cells.push(
    isFrame()
      ? `<rect x="${round(todayX - 1.5)}" y="${round(todayY - 1.5)}" width="${size + 3}" height="${size + 3}" rx="3" fill="none" stroke="${theme.today}" stroke-width="1.2" opacity="${round(0.35 + 0.35 * (0.5 - 0.5 * Math.cos(FRAME * 2.2)))}"/>`
      : `<rect x="${round(todayX - 1.5)}" y="${round(todayY - 1.5)}" width="${size + 3}" height="${size + 3}" rx="3" fill="none" stroke="${theme.today}" stroke-width="1.2" opacity="0.4">
          <animate attributeName="opacity" values="0.15;0.7;0.15" dur="2.6s" repeatCount="indefinite"/>
        </rect>`
  );

  /* one light sweeps the finished grid, forever, slowly */
  const sweepBegin = begin + cols * rows * 0.0035 + 0.6;
  const gradId = `contribSweep-${theme.name}`;
  const bandW = 200;
  const period = 9;
  const sweep = (() => {
    if (isFrame()) {
      const local = ((FRAME - sweepBegin) % period + period) % period;
      if (FRAME < sweepBegin || local > 2.2) return '';
      const k = local / 2.2;
      return rect({ x: round(x + (cols * (size + gap) + bandW) * k - bandW), y, w: bandW, h: rows * (size + gap) - gap, fill: `url(#${gradId})`, op: round(0.5 * Math.sin(Math.PI * k)) });
    }
    return `<g>
      <animateTransform attributeName="transform" type="translate" values="${round(-bandW)} 0; ${round(cols * (size + gap) + bandW)} 0" dur="${period}s" begin="${round(sweepBegin)}s" repeatCount="indefinite"/>
      ${rect({ x, y, w: bandW, h: rows * (size + gap) - gap, fill: `url(#${gradId})` })}
    </g>`;
  })();

  return {
    svg: cells.join(''),
    sweep,
    defs: `<linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0" stop-color="${theme.accent}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${theme.accent}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
    </linearGradient>`,
    height: rows * (size + gap) - gap,
  };
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

  parts.push(rect({ x: 0, y: 0, w: W, h: 10000, fill: theme.page }));   /* page colour base — height fixed later */

  let t = 0.4;

  /* ── name: types, caret, and a light that keeps sweeping across it ── */
  const name = typedText({ content: identity.name, x: PAD, y: 64, size: 31, fill: theme.fg, begin: t, perChar: 0.055, weight: 600 });
  parts.push(name.svg.replace('</text>', caretTail({ content: identity.name, begin: t, perChar: 0.055, color: theme.accent }) + '</text>'));
  const nameShine = textShine({
    id: `shine-${theme.name}-name`, content: identity.name, x: PAD, y: 64, size: 31,
    weight: 600, width: identity.name.length * 17, begin: name.end + 0.5, theme,
  });
  parts.push(nameShine.svg);
  defs.push(nameShine.defs);
  t = name.end + 0.4;

  /* ── role: types, then a short underline draws under it ─────────────── */
  const role = typedText({ content: identity.role, x: PAD, y: 94, size: 15, fill: theme.fgMuted, begin: t, perChar: 0.034 });
  parts.push(role.svg.replace('</text>', caretTail({ content: identity.role, begin: t, perChar: 0.034, color: theme.fgSubtle }) + '</text>'));
  const roleUnderlineY = 102;
  parts.push(`<g opacity="0">${isFrame() ? '' : fade(role.end + 0.1, 0.4)}
    ${rule({ x: PAD, y: roleUnderlineY, w: round(identity.role.length * 7.2), begin: role.end + 0.15, dur: 0.7, color: theme.accent })}
  </g>`);
  t = role.end + 0.7;

  /* ── headline: types, then shimmers ────────────────────────────────── */
  const headline = typedText({ content: identity.tagline, x: PAD, y: 132, size: 16, fill: theme.fg, begin: t, perChar: 0.02 });
  parts.push(headline.svg.replace('</text>', caretTail({ content: identity.tagline, begin: t, perChar: 0.02, color: theme.accent }) + '</text>'));
  const headlineShine = textShine({
    id: `shine-${theme.name}-head`, content: identity.tagline, x: PAD, y: 132, size: 16,
    weight: 400, width: identity.tagline.length * 8.6, begin: headline.end + 0.7, theme, period: 8,
  });
  parts.push(headlineShine.svg);
  defs.push(headlineShine.defs);
  t = headline.end + 0.7;

  /* ── about ─────────────────────────────────────────────────────────── */
  const aboutY = 176;
  const aboutHead = sectionHeader({ title: 'About', x: PAD, y: aboutY, w: CW, begin: t, theme, sweepId: `aboutPulse-${theme.name}` });
  parts.push(aboutHead.svg);
  defs.push(aboutHead.defs);
  t = aboutHead.end + 0.3;

  const aboutLines = wrapText(identity.about, CW - 16, 15, 0.62);
  aboutLines.forEach((line, i) => {
    const y = aboutY + 46 + i * 25;
    const begin = t + i * 0.16;
    const ln = typedText({ content: line, x: PAD, y, size: 15, fill: theme.fgMuted, begin, perChar: 0.009 });
    parts.push(reveal({
      begin, dur: 0.45, dy: 7,
      inner: ln.svg.replace('</text>', caretTail({ content: line, begin, perChar: 0.009, color: theme.fgSubtle }) + '</text>'),
    }));
  });
  const aboutEnd = t + (aboutLines.length - 1) * 0.16 + Math.max(...aboutLines.map((l) => l.length)) * 0.009 + 0.45;

  /* ── quote ─────────────────────────────────────────────────────────── */
  let cursor = aboutY + 46 + aboutLines.length * 25;
  if (quote) {
    const quoted = `“${quote}”`;
    const q = typedText({ content: quoted, x: PAD, y: cursor + 16, size: 14, fill: theme.fgSubtle, begin: aboutEnd, perChar: 0.016, italic: true });
    parts.push(q.svg.replace('</text>', caretTail({ content: quoted, begin: aboutEnd, perChar: 0.016, color: theme.fgSubtle }) + '</text>'));
    cursor += 16;
    t = q.end + 0.65;
  } else {
    t = aboutEnd;
  }

  /* ── languages: one tile per language ──────────────────────────────── */
  const stackY = cursor + 66;
  const stackHead = sectionHeader({ title: 'Languages', x: PAD, y: stackY, w: CW, begin: t, theme, sweepId: `stackPulse-${theme.name}` });
  parts.push(stackHead.svg);
  defs.push(stackHead.defs);
  t = stackHead.end + 0.35;

  const tileCount = langs.length;
  const gap = 14;
  const tileW = Math.floor((CW - gap * (tileCount - 1)) / tileCount);
  const tileH = 104;
  const tileY = stackY + 42;
  let tileEnd = t;
  langs.forEach((item, i) => {
    const built = languageTile({
      item, x: PAD + i * (tileW + gap), y: tileY, w: tileW, h: tileH,
      begin: t + i * 0.16, theme, index: i,
    });
    parts.push(built.svg);
    defs.push(built.defs);
    tileEnd = Math.max(tileEnd, built.end);
  });
  t = tileEnd + 0.6;
  const tilesBottom = tileY + tileH;

  /* ── contribution activity ─────────────────────────────────────────── */
  const contribY = tilesBottom + 66;
  const contribHead = sectionHeader({ title: 'Contribution activity', x: PAD, y: contribY, w: CW, begin: t, theme, sweepId: `contribPulse-${theme.name}` });
  parts.push(contribHead.svg);
  defs.push(contribHead.defs);
  t = contribHead.end + 0.35;

  const cellSize = 11, cellGap = 3;
  const cols = Math.floor((CW + cellGap) / (cellSize + cellGap));
  const strip = contributionStrip({ x: PAD, y: contribY + 38, cols, rows: 7, size: cellSize, gap: cellGap, begin: t, theme });
  parts.push(strip.svg, strip.sweep);
  defs.push(strip.defs);
  const contribBottom = contribY + 38 + strip.height;

  /* ── footer ────────────────────────────────────────────────────────── */
  const footY = contribBottom + 58;
  parts.push(`<g opacity="0">${isFrame() ? '' : fade(t + 0.7, 0.6)}${rule({ x: PAD, y: footY - 28, w: CW, begin: t + 0.6, color: theme.borderMuted })}</g>`);

  const handleLine = `@${identity.handle} · ${identity.location}`;
  const handleBegin = t + 1.05;
  const handleTyped = typedText({ content: handleLine, x: PAD + 18, y: footY, size: 13.5, fill: theme.fgMuted, begin: handleBegin, perChar: 0.028 });
  parts.push(handleTyped.svg);
  const dotBegin = handleBegin + handleLine.length * 0.028 + 0.15;
  parts.push(
    isFrame()
      ? `<circle cx="${PAD + 5}" cy="${footY - 4.5}" r="4" fill="${theme.accent}" opacity="${done(dotBegin) ? 1 : 0}"/>`
      : `<circle cx="${PAD + 5}" cy="${footY - 4.5}" r="4" fill="${theme.accent}" opacity="0">${fade(dotBegin, 0.4)}
          <animate attributeName="opacity" values="1;0.25;1" dur="2.4s" begin="${round(dotBegin + 0.4)}s" repeatCount="indefinite"/>
        </circle>`
  );
  const total = dotBegin + 0.7;

  /* ── card frame: rounded, bordered, drawn on ───────────────────────── */
  const H = round(footY + 32);
  const per = round(2 * (W - 1) + 2 * (H - 1) - 8 * 18 + 2 * Math.PI * 18);
  const drawn = isFrame() ? ease(prog(0.08, 1.2)) : 0;
  parts.push(
    `<g opacity="${isFrame() ? drawn : 0}">
      ${isFrame() ? '' : fade(0.08, 0.6)}
      ${rectEl(
        {
          x: 0.5, y: 0.5, w: W - 1, h: H - 1, rx: 18, fill: 'none', stroke: theme.border, sw: 1,
          extra: `stroke-dasharray="${per}" stroke-dashoffset="${isFrame() ? round(per * (1 - drawn)) : per}"`,
        },
        isFrame() ? '' : `<animate attributeName="stroke-dashoffset" from="${per}" to="0" begin="0.08s" dur="1.2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.6 0.2 1" values="${per};0"/>`,
      )}
    </g>`
  );

  /* the page-colour plate, sized to the finished card */
  parts.unshift(rect({ x: 0, y: 0, w: W, h: H, fill: theme.page }));

  const canvas = svg({
    w: W, h: H,
    title: `${identity.name} — ${identity.role}`,
    defs: defs.flat().join('\n'),
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
  rendered[variant] = { render, total, W, H, page: theme.page };
}

if (process.argv.includes('--png')) {
  for (const variant of wanted) {
    const png = rendered[variant].render(1e6, 2);
    writeFileSync(OUT(`assets/card-${variant}.png`), png);
    console.log(`  ✓ assets/card-${variant}.png  (settled frame @2×, ${(png.length / 1024).toFixed(0)} KB)`);
  }
}

if (process.argv.includes('--gif')) {
  for (const variant of wanted) {
    const { render, total, W, H, page } = rendered[variant];
    const dir = new URL(`./.preview/frames-${variant}/`, import.meta.url);
    mkdirSync(dir, { recursive: true });
    const step = 0.3;
    const frames = [];
    for (let i = 0, time = 0; time <= total + 3.4; i++, time += step) {
      const file = new URL(`f${String(i).padStart(3, '0')}.png`, dir);
      writeFileSync(file, render(time, 1));
      frames.push(file.pathname);
    }
    const gif = new URL(`./.preview/card-${variant}.gif`, import.meta.url);
    execFileSync('convert', [
      '-delay', String(Math.round(step * 100)), '-loop', '0',
      ...frames, '-resize', '760x', '-colors', '96', '-layers', 'OptimizePlus', gif.pathname,
    ]);
    console.log(`  ✓ tools/.preview/card-${variant}.gif  (${frames.length} frames, ${W}×${H} on ${page})`);
  }
}
