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
 *    · a light sweeps across the name and the headline on a slow loop
 *    · section labels type in, then their caption rule draws itself
 *    · paragraphs rise line by line as they are typed
 *
 *  Panels / icons
 *    · frosted glass panels with a soft accent glow behind them
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
    iconTint: 0.3,
    glass: {
      fill: '#ffffff', fillOpacity: 0.045,
      border: '#ffffff', borderOpacity: 0.12,
      sheen: 0.09, glow: '#3fb950', glowOpacity: 0.22,
    },
  },
  light: {
    name: 'light',
    page: '#ffffff',
    surface: '#f6f8fa',
    border: '#d1d9e0',
    fg: '#1f2328',
    fgMuted: '#59636e',
    fgSubtle: '#818b98',
    accent: '#1a7f37',
    iconTint: -0.22,
    glass: {
      fill: '#1f2328', fillOpacity: 0.03,
      border: '#1f2328', borderOpacity: 0.09,
      sheen: 0.85, glow: '#1a7f37', glowOpacity: 0.16,
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
const nbsp = (str) => str.replace(/ /g, '\u00a0');

const typedText = ({ content, x, y, size, fill, begin, perChar = 0.03, weight = 400, italic = false, anchor = 'middle' }) => {
  const chars = [...content];
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
    \u258c</tspan>`;
};

/* ── a light that sweeps across a line of text, on a slow loop ───────── */
function textShine({ id, content, x, y, size, weight = 600, width, begin, theme, period = 7, dur = 1.5, anchor }) {
  const maskId = `${id}-mask`;
  const gradId = `${id}-grad`;
  const mask = `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="${round(x - width - 60)}" y="${round(y - size * 1.4)}" width="${round(width * 3 + 120)}" height="${round(size * 2.4)}">
    <text x="${round(x)}" y="${round(y)}" font-family="${SANS}" font-size="${round(size)}" fill="#ffffff" text-anchor="${anchor || 'middle'}"${weight !== 400 ? ` font-weight="${weight}"` : ''} xml:space="preserve">${esc(nbsp(content))}</text>
  </mask>`;
  const grad = `<linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0" stop-color="${theme.accent}" stop-opacity="0"/>
    <stop offset="0.5" stop-color="${theme.accent}" stop-opacity="0.85"/>
    <stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
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
function glassPanel({ x, y, w, h, rx = 20, begin, theme, glowId, clipId }) {
  const g = theme.glass;
  const body = `
  <g clip-path="url(#${clipId})">
    <ellipse cx="${round(x + w / 2)}" cy="${round(y + h * 0.8)}" rx="${round(w * 0.42)}" ry="${round(h * 0.5)}" fill="url(#${glowId})"/>
  </g>
  ${rect({ x, y, w, h, rx, fill: g.fill, extra: `fill-opacity="${g.fillOpacity}"` })}
  ${rect({ x: x + 0.5, y: y + 0.5, w: w - 1, h: h - 1, rx, fill: 'none', extra: `stroke="${g.border}" stroke-opacity="${g.borderOpacity}" stroke-width="1"` })}
  ${rect({ x: x + 1, y: y + 1, w: w - 2, h: Math.min(46, h * 0.34), rx, fill: `url(#panelSheen)` })}`;
  return reveal({ begin, dur: 0.85, dy: 16, inner: body });
}

/* ==================================================================
 *  LANGUAGE TILE — glass tile with the brand glyph
 * ================================================================== */
function languageTile({ item, x, y, w, h, begin, theme, index }) {
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
      return rect({ x: x + 1, y: y + 1, w: w - 2, h: h - 2, rx: 16, fill: `url(#${haloId})`, op: round(0.3 + 0.25 * phase) });
    }
    return rectEl(
      { x: x + 1, y: y + 1, w: w - 2, h: h - 2, rx: 16, fill: `url(#${haloId})`, op: 0.3 },
      `<animate attributeName="opacity" values="0.25;0.55;0.25" dur="4.4s" begin="${round(haloBegin)}s" repeatCount="indefinite"/>`
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
  ${label.svg}`;

  return {
    svg: reveal({ begin, dur: 0.55, dy: 12, inner: body }),
    defs: [
      `<radialGradient id="${haloId}" cx="50%" cy="26%" r="90%">
        <stop offset="0" stop-color="${icon ? icon.color : theme.accent}" stop-opacity="0.26"/>
        <stop offset="1" stop-color="${icon ? icon.color : theme.accent}" stop-opacity="0"/>
      </radialGradient>`,
    ],
    end: label.end,
  };
}

/* ==================================================================
 *  THE CARD
 * ================================================================== */
function buildCard(theme) {
  const W = 1000;
  const PAD = 44;
  const CW = W - PAD * 2;
  const CX = W / 2;
  const parts = [];
  const defs = [];

  /* ── header ────────────────────────────────────────────────────────── */
  let t = 0.4;

  const nameY = 88;
  const name = typedText({ content: identity.name, x: CX, y: nameY, size: 34, fill: theme.fg, begin: t, perChar: 0.055, weight: 600 });
  parts.push(name.svg.replace('</text>', caretTail({ content: identity.name, begin: t, perChar: 0.055, color: theme.accent }) + '</text>'));
  const nameShine = textShine({
    id: `shine-${theme.name}-name`, content: identity.name, x: CX, y: nameY, size: 34,
    weight: 600, width: identity.name.length * 19, begin: name.end + 0.6, theme, period: 7.5,
  });
  parts.push(nameShine.svg);
  defs.push(nameShine.defs);
  t = name.end + 0.45;

  const roleY = nameY + 32;
  const role = typedText({ content: identity.role, x: CX, y: roleY, size: 15, fill: theme.fgMuted, begin: t, perChar: 0.034 });
  parts.push(role.svg.replace('</text>', caretTail({ content: identity.role, begin: t, perChar: 0.034, color: theme.fgSubtle }) + '</text>'));
  /* a short accent underline draws itself under the role */
  const underlineW = Math.max(60, identity.role.length * 8);
  parts.push(`<g opacity="0">${isFrame() ? '' : fade(role.end + 0.05, 0.4)}${(() => {
    if (isFrame()) return rect({ x: CX - underlineW / 2, y: roleY + 12, w: round(underlineW * ease(prog(role.end + 0.1, 0.7))), h: 2, rx: 1, fill: theme.accent, op: 0.75 });
    return rectEl({ x: CX - underlineW / 2, y: roleY + 12, w: 0, h: 2, rx: 1, fill: theme.accent, op: 0.75 },
      `<animate attributeName="width" from="0" to="${round(underlineW)}" begin="${round(role.end + 0.1)}s" dur="0.7s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 0.61 0.2 1" values="0;${round(underlineW)}"/>`);
  })()}</g>`);
  t = role.end + 0.85;

  const headY = roleY + 44;
  const headline = typedText({ content: identity.tagline, x: CX, y: headY, size: 17, fill: theme.fg, begin: t, perChar: 0.02 });
  parts.push(headline.svg.replace('</text>', caretTail({ content: identity.tagline, begin: t, perChar: 0.02, color: theme.accent }) + '</text>'));
  const headShine = textShine({
    id: `shine-${theme.name}-head`, content: identity.tagline, x: CX, y: headY, size: 17,
    weight: 400, width: identity.tagline.length * 9.2, begin: headline.end + 0.8, theme, period: 8.5,
  });
  parts.push(headShine.svg);
  defs.push(headShine.defs);
  t = headline.end + 0.85;

  /* ── glass panel: about ────────────────────────────────────────────── */
  const panelPad = 34;
  const aboutLines = wrapText(identity.about, CW - panelPad * 2, 15, 0.62);
  const aboutLabelY = 0;
  const aboutPanelY = headY + 62;
  const aboutPanelH = 74 + aboutLines.length * 27 + 26;

  const aboutClip = `panelClip-${theme.name}-about`;
  parts.push(glassPanel({
    x: PAD, y: aboutPanelY, w: CW, h: aboutPanelH, begin: t, theme,
    glowId: `panelGlow-${theme.name}-about`, clipId: aboutClip,
  }));
  defs.push(`<clipPath id="${aboutClip}"><rect x="${PAD}" y="${aboutPanelY}" width="${CW}" height="${aboutPanelH}" rx="20"/></clipPath>`);
  defs.push(`<radialGradient id="panelGlow-${theme.name}-about" cx="50%" cy="50%" r="60%">
    <stop offset="0" stop-color="${theme.glass.glow}" stop-opacity="${round(theme.glass.glowOpacity * 0.55, 3)}"/>
    <stop offset="1" stop-color="${theme.glass.glow}" stop-opacity="0"/>
  </radialGradient>`);

  const labelBegin = t + 0.5;
  const labelAbout = typedText({ content: 'ABOUT', x: CX, y: aboutPanelY + 40, size: 11.5, fill: theme.accent, begin: labelBegin, perChar: 0.05, weight: 600 });
  parts.push(labelAbout.svg);
  const captionW = 54;
  parts.push(reveal({
    begin: labelAbout.end + 0.05, dur: 0.5, dy: 0,
    inner: rect({ x: CX - captionW / 2, y: aboutPanelY + 50, w: captionW, h: 1, fill: theme.accent, op: 0.35 }),
  }));

  let lineT = labelAbout.end + 0.4;
  aboutLines.forEach((line, i) => {
    const y = aboutPanelY + 84 + i * 27;
    const begin = lineT + i * 0.16;
    const ln = typedText({ content: line, x: CX, y, size: 15, fill: theme.fgMuted, begin, perChar: 0.009 });
    parts.push(reveal({
      begin, dur: 0.45, dy: 7,
      inner: ln.svg.replace('</text>', caretTail({ content: line, begin, perChar: 0.009, color: theme.fgSubtle }) + '</text>'),
    }));
  });
  t = lineT + (aboutLines.length - 1) * 0.16 + Math.max(...aboutLines.map((l) => l.length)) * 0.009 + 0.5;

  /* ── glass panel: languages ────────────────────────────────────────── */
  const tileGap = 14;
  const tileW = Math.floor((CW - panelPad * 2 - tileGap * (langs.length - 1)) / langs.length);
  const tileH = 110;
  const langPanelY = aboutPanelY + aboutPanelH + 30;
  const langPanelH = 74 + tileH + 34;

  const langClip = `panelClip-${theme.name}-lang`;
  parts.push(glassPanel({
    x: PAD, y: langPanelY, w: CW, h: langPanelH, begin: t, theme,
    glowId: `panelGlow-${theme.name}-lang`, clipId: langClip,
  }));
  defs.push(`<clipPath id="${langClip}"><rect x="${PAD}" y="${langPanelY}" width="${CW}" height="${langPanelH}" rx="20"/></clipPath>`);
  defs.push(`<radialGradient id="panelGlow-${theme.name}-lang" cx="50%" cy="55%" r="60%">
    <stop offset="0" stop-color="${theme.glass.glow}" stop-opacity="${round(theme.glass.glowOpacity * 0.45, 3)}"/>
    <stop offset="1" stop-color="${theme.glass.glow}" stop-opacity="0"/>
  </radialGradient>`);

  const labelLangBegin = t + 0.5;
  const labelLang = typedText({ content: 'LANGUAGES', x: CX, y: langPanelY + 40, size: 11.5, fill: theme.accent, begin: labelLangBegin, perChar: 0.05, weight: 600 });
  parts.push(labelLang.svg);
  parts.push(reveal({
    begin: labelLang.end + 0.05, dur: 0.5, dy: 0,
    inner: rect({ x: CX - 62, y: langPanelY + 50, w: 124, h: 1, fill: theme.accent, op: 0.35 }),
  }));

  const tilesX = PAD + panelPad;
  const tilesY = langPanelY + 74;
  let tileEnd = labelLang.end + 0.5;
  langs.forEach((item, i) => {
    const built = languageTile({
      item, x: tilesX + i * (tileW + tileGap), y: tilesY, w: tileW, h: tileH,
      begin: labelLang.end + 0.55 + i * 0.16, theme, index: i,
    });
    parts.push(built.svg);
    defs.push(built.defs);
    tileEnd = Math.max(tileEnd, built.end);
  });
  t = tileEnd + 0.6;

  /* ── footer ────────────────────────────────────────────────────────── */
  const footY = langPanelY + langPanelH + 58;
  const handleLine = `@${identity.handle} · ${identity.location}`;
  const handle = typedText({ content: handleLine, x: CX + 10, y: footY, size: 13.5, fill: theme.fgMuted, begin: t, perChar: 0.028 });
  parts.push(handle.svg);
  const dotBegin = t + handleLine.length * 0.028 + 0.15;
  const dotCx = round(CX + 10 - handleLine.length * 3.9 - 16);
  parts.push(
    isFrame()
      ? `<circle cx="${dotCx}" cy="${footY - 4.5}" r="4" fill="${theme.accent}" opacity="${done(dotBegin) ? 1 : 0}"/>`
      : `<circle cx="${dotCx}" cy="${footY - 4.5}" r="4" fill="${theme.accent}" opacity="0">${fade(dotBegin, 0.4)}
          <animate attributeName="opacity" values="1;0.25;1" dur="2.4s" begin="${round(dotBegin + 0.4)}s" repeatCount="indefinite"/>
        </circle>`
  );
  const total = dotBegin + 0.7;

  const H = round(footY + 44);

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
