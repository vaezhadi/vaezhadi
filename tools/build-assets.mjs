/* ------------------------------------------------------------------
 *  build-assets.mjs — the profile card.
 *
 *  Layout: everything is centred, wrapped in glassmorphism panels that sit
 *  on the profile page colour (#0d1117 dark / #ffffff light) and pick up
 *  GitHub's palette.
 *
 *  Text animation
 *    · every line types itself out, character by character, with a caret
 *    · the caret disappears for good once its line is finished
 *    · a neutral wipe (the page colour, not a coloured light) travels across
 *      the role on a slow loop — the name itself is left alone
 *    · every heading rises into place as it is typed, one line at a time
 *
 *  Panels / icons
 *    · frosted glass panels: page-tinted fill, hairline border, top sheen
 *    · language tiles: the brand glyph draws itself, fills with its colour,
 *      the tile floats and its halo breathes
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

/* ── the typeface ───────────────────────────────────────────────────────
   Mona Sans, GitHub's own face. It is subset down to the glyphs this card
   actually uses and embedded in the file, so the card keeps the same
   typography on every machine instead of falling back to whatever the
   viewer happens to have. tools/fonts/ holds the subsets + the OFL licence. */
const FONT_FILES = [
  new URL('./fonts/MonaSans-Regular.subset.ttf', import.meta.url).pathname,
  new URL('./fonts/MonaSans-SemiBold.subset.ttf', import.meta.url).pathname,
];
const b64 = (file) => readFileSync(new URL(`./fonts/${file}`, import.meta.url)).toString('base64');
const fontCss =
  `@font-face{font-family:'Mona Sans';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${b64('MonaSans-Regular.subset.woff2')}) format('woff2')}` +
  `@font-face{font-family:'Mona Sans';font-style:normal;font-weight:600;src:url(data:font/woff2;base64,${b64('MonaSans-SemiBold.subset.woff2')}) format('woff2')}`;
const CHARSET = new Set(readFileSync(new URL('./fonts/charset.txt', import.meta.url), 'utf8'));

/* Advance widths straight out of the embedded face (tools/fonts/metrics.json,
   exported by the subsetting script). The card can therefore measure a string
   before it draws it, which is what lets the icon column below sit exactly
   where it should instead of where a guess says it should. */
const METRICS = JSON.parse(readFileSync(new URL('./fonts/metrics.json', import.meta.url), 'utf8'));
const measure = (str, size, weight = 400) => {
  const table = METRICS.weights[String(weight)] || METRICS.weights['400'];
  let units = 0;
  for (const ch of str) units += table[ch] ?? table[' '] ?? 0;
  return (units / METRICS.unitsPerEm) * size;
};

/* The emoji is drawn, not typed: GitHub's SVG renderer has no emoji font, so
   a real vector is the only way U+1F611 is guaranteed to show up. Path data
   from Twemoji (CC-BY 4.0) — see tools/icons/README.md. */
const EMOJI = {
  '1f611': {
    viewBox: 36,
    paths: [
      { fill: '#FFCC4D', d: 'M36 18c0 9.941-8.059 18-18 18-9.94 0-18-8.059-18-18C0 8.06 8.06 0 18 0c9.941 0 18 8.06 18 18' },
      { fill: '#664500', d: 'M25 26H11c-.552 0-1-.447-1-1s.448-1 1-1h14c.553 0 1 .447 1 1s-.447 1-1 1zm-10-8H8c-.552 0-1-.448-1-1s.448-1 1-1h7c.552 0 1 .448 1 1s-.448 1-1 1zm13 0h-7c-.553 0-1-.448-1-1s.447-1 1-1h7c.553 0 1 .448 1 1s-.447 1-1 1z' },
    ],
  },
};

/* the two line icons are drawn on a 24 grid in the accent colour */
const LINE_ICONS = {
  sparkle: {
    fill: 'M12 2.6l1.9 6 6 1.9-6 1.9-1.9 6-1.9-6-6-1.9 6-1.9z',
    extra: 'M18.6 3.2l.75 1.95 1.95.75-1.95.75-.75 1.95-.75-1.95L15.9 5.9l1.95-.75z',
  },
  terminal: {
    stroke: 'M3.2 5.4h17.6a1.6 1.6 0 0 1 1.6 1.6v10a1.6 1.6 0 0 1-1.6 1.6H3.2A1.6 1.6 0 0 1 1.6 17V7a1.6 1.6 0 0 1 1.6-1.6z',
    extra: 'M6.6 9.4l2.7 2.6-2.7 2.6',
    extra2: 'M12.4 15h4.6',
  },
};
const usedChars = new Set();

/* ── pacing ─────────────────────────────────────────────────────────────
   Everything on this card runs at half speed: durations and the gaps in
   between are scaled together so the choreography stays in order. */
const SLOW = 2;
const scaleTimes = (markup) =>
  markup.replace(/\b(begin|dur)="(-?[\d.]+)s"/g, (m, attr, value) => `${attr}="${round(parseFloat(value) * SLOW)}s"`);

/* ==================================================================
 *  palettes — GitHub colours + glass tokens
 * ================================================================== */
const THEMES = {
  dark: {
    name: 'dark',
    page: '#0d1117',
    surface: '#161b22',
    border: '#30363d',
    fg: '#e6edf3',
    fgMuted: '#8b949e',
    fgSubtle: '#6e7681',
    accent: '#3fb950',
    gold: '#d29922',
    iconTint: 0.3,
    glass: {
      fill: '#ffffff', fillOpacity: 0.045,
      border: '#ffffff', borderOpacity: 0.12,
      sheen: 0.09,
    },
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

/* ==================================================================
 *  TEXT — proportional type revealed one <tspan> per character
 * ================================================================== */
const nbsp = (str) => {
  usedChars.add('\u00a0'); /* the space substitute the typing engine emits */
  return str.replace(/ /g, '\u00a0');
};

const typedText = ({ content, x, y, size, fill, begin, perChar = 0.03, weight = 400, italic = false, anchor = 'middle' }) => {
  const chars = [...content];
  chars.forEach((c) => usedChars.add(c));
  const attrs = `x="${round(x)}" y="${round(y)}" font-family="${SANS}" font-size="${round(size)}" fill="${fill}" text-anchor="${anchor}" xml:space="preserve"${weight !== 400 ? ` font-weight="${weight}"` : ''}${italic ? ' font-style="italic"' : ''}`;
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

/* The caret lives inside the same text element as a trailing glyph, so it
   sits exactly where the line stopped — and once the line is finished it
   fades away and never comes back. */
const caretTail = ({ content, begin, perChar, color }) => {
  if (isFrame()) return '';
  const chars = [...content].length;
  const typing = Math.max(0.3, chars * perChar + 0.15);
  return `<tspan fill="${color}" opacity="0">
    <animate attributeName="opacity"
      values="0;0.95;0.95;0.95;0"
      keyTimes="0;0.06;0.55;0.88;1"
      dur="${round(typing)}s" begin="${round(begin)}s" fill="freeze"/>
    |</tspan>`;
};

/* ── a light that sweeps across a line of text, on a slow loop ───────── */
function textShine({ id, content, x, y, size, weight = 600, width, begin, theme, period = 7, dur = 1.5, anchor }) {
  [...content].forEach((c) => usedChars.add(c));
  const maskId = `${id}-mask`;
  const gradId = `${id}-grad`;
  const mask = `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="${round(x - width - 60)}" y="${round(y - size * 1.4)}" width="${round(width * 3 + 120)}" height="${round(size * 2.4)}">
    <text x="${round(x)}" y="${round(y)}" font-family="${SANS}" font-size="${round(size)}" fill="#ffffff" text-anchor="${anchor || 'middle'}"${weight !== 400 ? ` font-weight="${weight}"` : ''} xml:space="preserve">${esc(nbsp(content))}</text>
  </mask>`;
  const grad = `<linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0" stop-color="${theme.page}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${theme.page}" stop-opacity="0.92"/>
    <stop offset="1" stop-color="${theme.page}" stop-opacity="0"/>
  </linearGradient>`;

  const bandW = Math.max(120, width * 0.5);
  const from = round(x - bandW);
  const to = round(x + width * 1.4 + 60);
  const bandY = round(y - size * 1.05);
  const bandH = round(size * 1.35);

  const smil = `<g mask="url(#${maskId})">
    <g>
      <animateTransform attributeName="transform" type="translate" values="${from} 0; ${to} 0; ${to} 0" keyTimes="0;0.22;1" dur="${period}s" begin="${round(begin)}s" repeatCount="indefinite"/>
      ${rect({ x: 0, y: bandY, w: bandW, h: bandH, fill: `url(#${gradId})`, op: 0.9 })}
    </g>
  </g>`;

  const frame = (() => {
    const local = ((FRAME - begin) % period + period) % period;
    if (FRAME < begin || local > period * 0.22) return '';
    const k = local / (period * 0.22);
    const gx = from + (to - from) * k;
    return `<g mask="url(#${maskId})">${rect({ x: gx, y: bandY, w: bandW, h: bandH, fill: `url(#${gradId})`, op: round(0.9 * Math.sin(Math.PI * k)) })}</g>`;
  })();

  return { defs: [mask, grad], svg: isFrame() ? frame : smil };
}

/* ==================================================================
 *  GLASS PANEL — frosted card with an accent glow behind it
 * ================================================================== */
function glassPanel({ x, y, w, h, rx = 20, begin, theme }) {
  const g = theme.glass;
  const body = `
  ${rect({ x, y, w, h, rx, fill: g.fill, extra: `fill-opacity="${g.fillOpacity}"` })}
  ${rect({ x: x + 0.5, y: y + 0.5, w: w - 1, h: h - 1, rx, fill: 'none', extra: `stroke="${g.border}" stroke-opacity="${g.borderOpacity}" stroke-width="1"` })}
  ${rect({ x: x + 1, y: y + 1, w: w - 2, h: Math.min(46, h * 0.34), rx, fill: `url(#panelSheen)` })}`;
  return reveal({ begin, dur: 0.85, dy: 16, inner: body });
}

/* ==================================================================
 *  LANGUAGE TILE — glass tile with the brand glyph
 * ================================================================== */
/* the two the user reaches for most: a gold collar and a touch more size */
const FEATURED = new Set(['Python', 'JavaScript']);

function languageTile({ item, x, y, w, h, begin, theme, index }) {
  const featured = FEATURED.has(item);
  if (featured) { x -= 4; y -= 4; w += 8; h += 8; }
  const slug = slugFor(item);
  const icon = slug ? brand(slug, { tint: theme.iconTint }) : null;
  const glyph = 34;
  const k = glyph / 24;
  const cx = x + w / 2;
  const iconY = y + 30;
  const haloId = `tileGlow-${theme.name}-${index}`;
  const g = theme.glass;

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

  const haloBegin = begin + 0.4;
  const halo = (() => {
    if (isFrame()) {
      const local = FRAME - haloBegin;
      const phase = local <= 0 ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * local) / 4.4);
      return rect({ x: x + 1, y: y + 1, w: w - 2, h: h - 2, rx: 16, fill: `url(#${haloId})`, op: round(0.22 + 0.2 * phase) });
    }
    return rectEl(
      { x: x + 1, y: y + 1, w: w - 2, h: h - 2, rx: 16, fill: `url(#${haloId})`, op: 0.22 },
      `<animate attributeName="opacity" values="0.18;0.42;0.18" dur="4.4s" begin="${round(haloBegin)}s" repeatCount="indefinite"/>`
    );
  })();

  const floatBegin = begin + 0.9;
  const floatY = (() => {
    if (!isFrame()) return 0;
    const local = FRAME - floatBegin;
    if (local <= 0) return 0;
    return round(-2.2 * (0.5 - 0.5 * Math.cos((2 * Math.PI * local) / 4.4)));
  })();

  const label = typedText({
    content: item, x: cx, y: y + h - 20, size: 13.5,
    fill: theme.fgMuted, begin: begin + 1.05, perChar: 0.03,
  });

  const body = `
  ${rect({ x, y, w, h, rx: 16, fill: g.fill, extra: `fill-opacity="${round(g.fillOpacity * 0.9, 3)}"` })}
  ${rect({ x: x + 0.5, y: y + 0.5, w: w - 1, h: h - 1, rx: 16, fill: 'none', extra: `stroke="${g.border}" stroke-opacity="${g.borderOpacity}" stroke-width="1"` })}
  ${halo}
  <g transform="translate(0 ${isFrame() ? floatY : 0})">
    ${isFrame() ? '' : `<animateTransform attributeName="transform" type="translate" values="0 0; 0 -2.2; 0 0" dur="4.4s" begin="${round(floatBegin)}s" repeatCount="indefinite"/>`}
    ${iconSvg}
  </g>
  ${label.svg}
  ${featured ? rect({ x: x + 0.75, y: y + 0.75, w: w - 1.5, h: h - 1.5, rx: 15.2, fill: 'none', extra: `stroke="${theme.gold}" stroke-opacity="0.6" stroke-width="1.5"` }) : ''}
  ${featured ? rect({ x: round(x + w / 2 - 13), y: round(y + h - 9), w: 26, h: 3, rx: 1.5, fill: theme.gold, op: 0.85 }) : ''}`;

  return {
    svg: reveal({ begin, dur: 0.55, dy: 12, inner: body }),
    defs: [
      `<radialGradient id="${haloId}" cx="50%" cy="26%" r="90%">
        <stop offset="0" stop-color="${icon ? icon.color : theme.accent}" stop-opacity="0.2"/>
        <stop offset="1" stop-color="${icon ? icon.color : theme.accent}" stop-opacity="0"/>
      </radialGradient>`,
    ],
    end: label.end,
  };
}

/* ==================================================================
 *  THE CARD
 *
 *  One centred column with a lot of air around it. The name is the main
 *  title; every sentence after it is treated as a heading too — its own
 *  line, bold, generously spaced, big enough to read at a glance.
 *  The stack sits in a single frosted glass panel.
 * ================================================================== */
function buildCard(theme) {
  const W = 1000;
  const PAD = 56;
  const CW = W - PAD * 2;
  const CX = W / 2;
  const parts = [];
  const defs = [`<style>${fontCss}</style>`];

  /* every sentence gets a line of its own */
  const tagBits = identity.tagline.split(/,\s*/);
  const taglineLines = tagBits.map((b, i) => (i < tagBits.length - 1 ? `${b},` : b));
  const aboutLines = identity.about.split(/(?<=[.!?])\s+/).filter(Boolean);

  let t = 0.5;

  /* ── the main title ──────────────────────────────────────────────── */
  const nameY = 112;
  const name = typedText({
    content: identity.name, x: CX, y: nameY, size: 54, fill: theme.fg,
    begin: t, perChar: 0.055, weight: 600,
  });
  parts.push(name.svg.replace('</text>', caretTail({ content: identity.name, begin: t, perChar: 0.055, color: theme.fgSubtle }) + '</text>'));
  t = name.end + 0.3;

  /* ── role: the second title line ─────────────────────────────────── */
  const roleY = nameY + 54;
  const role = typedText({
    content: identity.role, x: CX, y: roleY, size: 26, fill: theme.fgMuted,
    begin: t, perChar: 0.04, weight: 600,
  });
  parts.push(role.svg.replace('</text>', caretTail({ content: identity.role, begin: t, perChar: 0.04, color: theme.fgSubtle }) + '</text>'));
  const roleWipe = textShine({
    id: `wipe-${theme.name}-role`, content: identity.role, x: CX, y: roleY, size: 26,
    weight: 600, width: measure(identity.role, 26, 600), begin: role.end + 0.8, theme, period: 9.5,
  });
  parts.push(roleWipe.svg);
  defs.push(roleWipe.defs);
  t = role.end + 0.6;

  /* ── the tagline, one clause per line ────────────────────────────── */
  const tagY = roleY + 94;
  const tagStep = 52;
  let cursor = t;
  taglineLines.forEach((line, i) => {
    /* strictly one after another: a line only starts once the one above it
       has finished typing and had a beat to be read */
    const begin = cursor;
    const ln = typedText({
      content: line, x: CX, y: tagY + i * tagStep, size: 27, fill: theme.fg,
      begin, perChar: 0.04, weight: 600,
    });
    parts.push(reveal({
      begin, dur: 0.6, dy: 12,
      inner: ln.svg.replace('</text>', caretTail({ content: line, begin, perChar: 0.04, color: theme.fgSubtle }) + '</text>'),
    }));
    cursor = ln.end + 0.85;
  });
  t = cursor + 0.3;

  /* ── about: a feature list — one line per row, each with its own mark ── */
  const rows = identity.aboutRows || aboutLines.map((line) => ({ icon: null, text: line }));
  const rowSize = 21.5;
  const badge = 42;
  const rowGap = 18;
  const rowStep = 60;
  const padX = 34;
  const padY = 28;

  /* full width, matching the stack panel below it — two panels of different
     widths read as an accident, the same width reads as a system */
  const aboutPanelW = CW;
  const aboutPanelX = PAD;
  const aboutPanelY = tagY + (taglineLines.length - 1) * tagStep + 78;
  const aboutH = padY * 2 + (rows.length - 1) * rowStep + badge;

  parts.push(glassPanel({ x: aboutPanelX, y: aboutPanelY, w: aboutPanelW, h: aboutH, begin: t, theme }));

  const rowsX = round(aboutPanelX + padX);
  const rowsTop = round(aboutPanelY + padY);

  /* a hairline rail behind the marks: it turns three rows into one story and
     draws itself downward as they appear */
  const railX = round(rowsX + badge / 2 - 0.5);
  const railY1 = round(rowsTop + badge / 2);
  const railY2 = round(rowsTop + (rows.length - 1) * rowStep + badge / 2);
  const railLen = round(railY2 - railY1);
  const railBegin = t + 0.45;
  parts.push(
    isFrame()
      ? rect({ x: railX, y: railY1, w: 1, h: round(railLen * ease(prog(railBegin, 1.1))), fill: theme.glass.border, op: round(theme.glass.borderOpacity * 1.4, 3) })
      : rectEl(
          { x: railX, y: railY1, w: 1, h: 0, fill: theme.glass.border, op: round(theme.glass.borderOpacity * 1.4, 3) },
          `<animate attributeName="height" from="0" to="${railLen}" begin="${round(railBegin)}s" dur="1.1s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.6 0.2 1" values="0;${railLen}"/>`,
        ),
  );
  let cursor2 = t + 0.4;

  rows.forEach((row, i) => {
    const top = rowsTop + i * rowStep;
    const cy = round(top + badge / 2);
    const textX = round(rowsX + badge + rowGap);
    const begin = cursor2;

    /* the mark: a glass badge holding a drawn icon (or the emoji) */
    /* an accent ring settles onto the badge a beat after the row lands */
    const ringBegin = begin + 0.55;
    const ring = isFrame()
      ? rect({ x: rowsX + 0.5, y: top + 0.5, w: badge - 1, h: badge - 1, rx: 12, fill: 'none', extra: `stroke="${theme.accent}" stroke-opacity="${round(0.32 * ease(prog(ringBegin, 0.6)), 3)}" stroke-width="1.25"` })
      : rectEl(
          { x: rowsX + 0.5, y: top + 0.5, w: badge - 1, h: badge - 1, rx: 12, fill: 'none', extra: `stroke="${theme.accent}" stroke-width="1.25"`, op: 0 },
          `<animate attributeName="opacity" from="0" to="0.32" begin="${round(ringBegin)}s" dur="0.6s" fill="freeze" values="0;0.32"/>`,
        );

    const mark = (() => {
      if (row.icon && row.icon.startsWith('emoji:')) {
        const e = EMOJI[row.icon.slice(6)];
        const k = round(26 / e.viewBox);
        return `<g transform="translate(${round(rowsX + (badge - 26) / 2)} ${round(top + (badge - 26) / 2)}) scale(${k})">${e.paths
          .map((p) => `<path d="${p.d}" fill="${p.fill}"/>`)
          .join('')}</g>`;
      }
      const icon = LINE_ICONS[row.icon] || LINE_ICONS.sparkle;
      const k = round(21 / 24);
      const inner = icon.stroke
        ? `<path d="${icon.stroke}" fill="none" stroke="${theme.fgMuted}" stroke-width="1.7" stroke-linejoin="round"/>
           <path d="${icon.extra}" fill="none" stroke="${theme.accent}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
           ${icon.extra2 ? `<path d="${icon.extra2}" fill="none" stroke="${theme.accent}" stroke-width="1.9" stroke-linecap="round"/>` : ''}`
        : `<path d="${icon.fill}" fill="${theme.accent}"/>${icon.extra ? `<path d="${icon.extra}" fill="${theme.accent}" opacity="0.75"/>` : ''}`;
      return `<g transform="translate(${round(rowsX + (badge - 21) / 2)} ${round(top + (badge - 21) / 2)}) scale(${k})">${inner}</g>`;
    })();

    parts.push(reveal({
      begin, dur: 0.5, dy: 8,
      inner: `
      ${rect({ x: rowsX, y: top, w: badge, h: badge, rx: 12, fill: theme.glass.fill, extra: `fill-opacity="${theme.glass.fillOpacity}"` })}
      ${rect({ x: rowsX + 0.5, y: top + 0.5, w: badge - 1, h: badge - 1, rx: 12, fill: 'none', extra: `stroke="${theme.glass.border}" stroke-opacity="${theme.glass.borderOpacity}" stroke-width="1"` })}
      ${ring}
      ${mark}`,
    }));

    const ln = typedText({
      content: row.text, x: textX, y: round(cy + 8), size: rowSize, fill: theme.fg,
      begin: begin + 0.12, perChar: 0.012, weight: 600, anchor: 'start',
    });
    parts.push(reveal({
      begin: begin + 0.12, dur: 0.5, dy: 8,
      inner: ln.svg.replace('</text>', caretTail({ content: row.text, begin: begin + 0.12, perChar: 0.012, color: theme.fgSubtle }) + '</text>'),
    }));
    cursor2 = ln.end + 0.85;
  });

  t = cursor2 + 0.45;

  /* ── one frosted panel holds the stack ───────────────────────────── */
  const innerPad = 30;
  const tileGap = 14;
  const tileH = 110;
  const tileW = Math.floor((CW - innerPad * 2 - tileGap * (langs.length - 1)) / langs.length);
  const rowW = tileW * langs.length + tileGap * (langs.length - 1);
  const panelY = aboutPanelY + aboutH + 44;
  const panelH = innerPad * 2 + tileH;

  parts.push(glassPanel({ x: PAD, y: panelY, w: CW, h: panelH, begin: t, theme }));

  const tilesX = round(PAD + (CW - rowW) / 2);
  const tilesY = panelY + innerPad;
  let tileEnd = t;
  langs.forEach((item, i) => {
    const built = languageTile({
      item, x: tilesX + i * (tileW + tileGap), y: tilesY, w: tileW, h: tileH,
      begin: t + 0.3 + i * 0.12, theme, index: i,
    });
    parts.push(built.svg);
    defs.push(built.defs);
    tileEnd = Math.max(tileEnd, built.end);
  });
  t = tileEnd + 0.5;

  /* ── footer ──────────────────────────────────────────────────────── */
  const footY = panelY + panelH + 64;
  const handleLine = `@${identity.handle} · ${identity.location}`;
  const handleW = round(handleLine.length * 6.9);
  const handle = typedText({
    content: handleLine, x: CX + 14, y: footY, size: 13.5, fill: theme.fgMuted,
    begin: t, perChar: 0.028,
  });
  parts.push(handle.svg);
  const dotBegin = t + handleLine.length * 0.028 + 0.15;
  const dotCx = round(CX + 14 - handleW / 2 - 18);
  parts.push(
    isFrame()
      ? `<circle cx="${dotCx}" cy="${footY - 4.5}" r="4" fill="${theme.accent}" opacity="${done(dotBegin) ? 1 : 0}"/>`
      : `<circle cx="${dotCx}" cy="${footY - 4.5}" r="4" fill="${theme.accent}" opacity="0">${fade(dotBegin, 0.4)}
          <animate attributeName="opacity" values="1;0.25;1" dur="2.4s" begin="${round(dotBegin + 0.4)}s" repeatCount="indefinite"/>
        </circle>`
  );
  const total = dotBegin + 0.8;

  const H = round(footY + 46);

  /* the page-colour plate under everything */
  parts.unshift(rect({ x: 0, y: 0, w: W, h: H, fill: theme.page }));

  defs.push(`<linearGradient id="panelSheen" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0" stop-color="#ffffff" stop-opacity="${theme.glass.sheen}"/>
    <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient>`);

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

/* one card, one theme — light mode was dropped on request */
const wanted = ['dark'];
const rendered = {};

for (const variant of wanted) {
  const theme = THEMES[variant];
  FRAME = null;
  const { canvas, total, W, H } = buildCard(theme);
  /* NBSP must survive this tidy-up: in JS \s matches U+00A0 too, and eating
     it is exactly what once glued every word together on GitHub. */
  const clean = scaleTimes(canvas.replace(/>[ \t\r\n]+</g, '><').replace(/\n{2,}/g, '\n'));
  const missing = [...usedChars].filter((c) => c !== ' ' && !CHARSET.has(c));
  if (missing.length) {
    throw new Error(
      `the card prints ${missing.length} character(s) missing from the embedded font: ` +
      `${missing.map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ')} — ` +
      'add them to tools/fonts/charset.txt and rebuild the subsets (see tools/fonts/README.md)',
    );
  }
  usedChars.clear();
  const info = validateCard(clean, `card-${variant}.svg`);
  writeFileSync(OUT(`assets/card-${variant}.svg`), clean);
  console.log(`  ✓ assets/card-${variant}.svg  ${W}×${H}, ${(info.bytes / 1024).toFixed(1)} KB, ${round(total * SLOW)}s — XML valid (${info.groups} groups)`);

  const render = (time, zoom) => {
    FRAME = time / SLOW;
    const { canvas: frame } = buildCard(theme);
    FRAME = null;
    return new Resvg(frame, {
      fitTo: { mode: 'zoom', value: zoom },
      font: { fontFiles: FONT_FILES, loadSystemFonts: true, defaultFontFamily: 'Mona Sans' },
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
    const step = 0.4;
    const frames = [];
    for (let i = 0, time = 0; time <= total * SLOW + 4; i++, time += step) {
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
