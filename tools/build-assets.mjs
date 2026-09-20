/* ------------------------------------------------------------------
 *  build-assets.mjs — the profile card as one animated SVG.
 *
 *  Two effects, as requested:
 *    1. every line of text types itself out (character by character)
 *    2. the language icons animate: they draw themselves, fill in with
 *       their own brand colour and then breathe in sync with the theme
 *
 *  Usage
 *    node build-assets.mjs              → assets/card.svg
 *    node build-assets.mjs --png        → + tools/.preview/card-still.png
 *    node build-assets.mjs --gif        → + tools/.preview/card.gif
 *
 *  The same builder renders any point in time (frame mode), which is what
 *  makes the still PNG and the GIF possible — no SMIL evaluation needed.
 * ------------------------------------------------------------------ */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';
import { brand, slugFor } from './icons.mjs';
import { T, MONO, esc, text, rect, round, lgrad, rgrad, wrapText, svg } from './svg-lib.mjs';

const cfg = JSON.parse(readFileSync(new URL('./profile.config.json', import.meta.url), 'utf8'));
const { identity, skills, quote } = cfg;
const langs = (skills || []).map((s) => (typeof s === 'string' ? s : s.name));

/* ==================================================================
 *  animation helper — one code path for the animated file and for frames
 * ================================================================== */
let FRAME = null;              // null = emit SMIL, number = render that instant
const isFrame = () => FRAME !== null;
const ease = (x) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const prog = (begin, dur) => (isFrame() ? clamp01((FRAME - begin) / dur) : 0);
const done = (begin) => (isFrame() ? FRAME >= begin : false);

/* fade in (and optionally rise) a block of children */
const reveal = ({ begin, dur = 0.9, dy = 0, inner }) => {
  if (isFrame()) {
    const k = ease(prog(begin, dur));
    const tr = dy ? ` transform="translate(0 ${round(dy * (1 - k))})"` : '';
    return `<g opacity="${round(k)}"${tr}>${inner}</g>`;
  }
  return `<g opacity="0">${fade(begin, dur)}${dy ? rise(begin, dur, dy) : ''}${inner}</g>`;
};

const fade = (begin, dur = 0.9) =>
  `<animate attributeName="opacity" from="0" to="1" begin="${round(begin)}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.6 0.2 1" values="0;1"/>`;

const rise = (begin, dur, dy = 12) =>
  `<animateTransform attributeName="transform" type="translate" from="0 ${dy}" to="0 0" begin="${round(begin)}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.6 0.2 1" values="0 ${dy};0 0"/>`;

/* a hairline that draws itself */
const rule = ({ x, y, w, begin, dur = 1, fill = 'url(#hairGrad)' }) => {
  if (isFrame()) {
    return rect({ x, y, w: round(w * ease(prog(begin, dur))), h: 1, fill });
  }
  return rect({
    x, y, w: 0, h: 1, fill,
    extra: `<animate attributeName="width" from="0" to="${round(w)}" begin="${round(begin)}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 0.61 0.2 1" values="0;${round(w)}"/>`,
  });
};

/* one typewriter glyph, pinned to its own monospace cell */
const glyph = ({ ch, x, y, size, fill, begin, ls = 0, family = MONO }) => {
  const cell = size * 0.6 + ls;
  if (isFrame()) {
    return text({ x, y, size, fill, family, content: ch, lock: cell, op: done(begin) ? 1 : 0 });
  }
  return text({
    x, y, size, fill, family, content: ch, lock: cell, op: 0,
    extra: `<animate attributeName="opacity" from="0" to="1" begin="${round(begin)}s" dur="0.06s" fill="freeze" calcMode="discrete" values="0;1"/>`,
  });
};

/* a whole string typed out; returns the markup and when it finishes */
const type = ({ content, x, y, size, fill = T.text, begin, perChar = 0.03, ls = 0, family = MONO, anchor = 'start' }) => {
  const cell = size * 0.6 + ls;
  const chars = [...content];
  const width = chars.length * cell;
  const startX = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const body = chars
    .map((ch, i) => glyph({ ch, x: round(startX + i * cell), y, size, fill, ls, family, begin: begin + i * perChar }))
    .join('');
  return { svg: body, end: begin + chars.length * perChar, width, x: startX, cell };
};

/* the blinking caret that walks along while a line is typing */
const caret = ({ x, y, size, width, begin, perChar, count, ls = 0, color = T.accent }) => {
  const cell = size * 0.6 + ls;
  const end = begin + count * perChar;
  const barY = round(y - size * 0.78);
  const bar = (px, op, animated) =>
    rect({ x: round(px), y: barY, w: round(cell * 0.5), h: round(size * 0.92), rx: 1, fill: color, op });

  if (isFrame()) {
    if (FRAME < begin) return '';
    /* the still export renders the far future: no caret there */
    if (FRAME > 1000) return '';
    const typedCount = Math.min(count, Math.max(0, Math.floor((FRAME - begin) / perChar)));
    const px = x + typedCount * cell;
    return bar(px, 0.9, false);
  }
  /* while typing it steps cell by cell, then it just blinks */
  return `<g><animate attributeName="opacity" values="1;1;1;0;1" dur="1.05s" begin="${round(end)}s" repeatCount="indefinite"/>
  <g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${round(begin - 0.2)}s" dur="0.2s" fill="freeze"/>
    <g>
      <animateTransform attributeName="transform" type="translate" values="${round(x)} 0; ${round(x + count * cell)} 0"
        dur="${round(count * perChar)}s" begin="${round(begin)}s" fill="freeze" calcMode="discrete"/>
      ${bar(0, 0.9, true)}
    </g>
  </g></g>`;
};

/* ==================================================================
 *  ICON TILES — draw in, fill with the brand colour, then breathe
 * ================================================================== */
function iconTile({ item, x, y, size = 92, begin, index }) {
  const slug = slugFor(item);
  const icon = slug ? brand(slug, { tint: 0.3 }) : null;

  /* the outline draws itself … */
  const gIcon = icon ? 40 : 30;
  const k = gIcon / 24;
  const ix = round(x + size / 2 - gIcon / 2);
  const iy = round(y + size / 2 - gIcon / 2);

  const outline = icon
    ? `<g transform="translate(${ix} ${iy}) scale(${round(k)})">
      <path d="${icon.path}" pathLength="1" fill="none" stroke="${icon.color}" stroke-width="1.15"
        stroke-linejoin="round" stroke-linecap="round"
        stroke-dasharray="1" stroke-dashoffset="${isFrame() ? round(1 - ease(prog(begin + 0.12, 0.85))) : 1}"
        opacity="${round(0.55 + 0.35 * ease(prog(begin + 0.12, 0.85)))}">
        ${isFrame() ? '' : `<animate attributeName="stroke-dashoffset" from="1" to="0" begin="${round(begin + 0.12)}s" dur="0.85s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.3 0.6 0.2 1" values="1;0"/>`}
      </path>
    </g>`
    : '';

  /* … then the solid glyph fades in on top */
  const solid = icon
    ? `<g transform="translate(${ix} ${iy}) scale(${round(k)})" opacity="${isFrame() ? round(ease(prog(begin + 0.9, 0.6))) : 0}">
      ${isFrame() ? '' : fade(begin + 0.9, 0.6)}
      <path d="${icon.path}" fill="${icon.color}"/>
    </g>`
    : `<g opacity="${isFrame() ? round(ease(prog(begin + 0.9, 0.6))) : 0}">
      ${isFrame() ? '' : fade(begin + 0.9, 0.6)}
      ${text({ x: x + size / 2, y: y + size / 2 + 6, size: 17, weight: 600, fill: T.muted, anchor: 'middle', content: item.slice(0, 3) })}
    </g>`;

  /* halo behind the glyph: pulses in once, then keeps a slow breath.
     every tile uses the same period, so the row moves together. */
  const haloBegin = begin + 0.35;
  const breathe = isFrame()
    ? (() => {
        const local = FRAME - haloBegin;
        const phase = local <= 0 ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * local) / 4.4);
        return round(0.1 + 0.16 * phase);
      })()
    : 0.1;

  const haloOp = isFrame()
    ? breathe
    : `<animate attributeName="opacity" values="0;0.26;0.1;0.26;0.1" dur="4.4s" begin="${round(haloBegin)}s" repeatCount="indefinite"/>`;

  /* the whole tile floats gently, all tiles share the period */
  const floatBegin = begin + 0.9;
  const floatY = (() => {
    if (!isFrame()) return 0;
    const local = FRAME - floatBegin;
    if (local <= 0) return 0;
    return round(-2.6 * (0.5 - 0.5 * Math.cos((2 * Math.PI * local) / 4.4)));
  })();

  const inner = `
  <circle cx="${round(x + size / 2)}" cy="${round(y + size / 2)}" r="${round(size * 0.42)}" fill="url(#halo${index})" opacity="${haloOp}"/>
  ${outline}
  ${solid}`;

  const tile = reveal({
    begin, dur: 0.5, dy: 10,
    inner: `
    ${rect({ x, y, w: size, h: size, rx: 20, fill: T.track, op: 0.55, stroke: T.hair, sw: 1 })}
    <g transform="translate(0 ${isFrame() ? floatY : 0})">
      ${isFrame() ? '' : `<animateTransform attributeName="transform" type="translate" values="0 0; 0 -2.6; 0 0" dur="4.4s" begin="${round(floatBegin)}s" repeatCount="indefinite"/>`}
      ${inner}
    </g>`,
  });

  /* a brand-coloured underline draws under the tile, then settles to hairline */
  const underY = y + size + 12;
  const brandLine = isFrame()
    ? `<g opacity="${round(0.75 * (1 - prog(begin + 1.1, 0.9)))}">
        ${rect({ x, y: underY, w: round(size * ease(prog(begin + 0.15, 0.9))), h: 1, fill: icon ? icon.color : T.muted })}
      </g>`
    : `<g opacity="0"><animate attributeName="opacity" values="0.75;0.75;0" dur="1.6s" begin="${round(begin + 0.15)}s" fill="freeze"/>
        ${rect({ x, y: underY, w: 0, h: 1, fill: icon ? icon.color : T.muted, extra: `<animate attributeName="width" from="0" to="${size}" begin="${round(begin + 0.15)}s" dur="0.9s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 0.61 0.2 1" values="0;${size}"/>` })}
      </g>`;
  const hairLine = isFrame()
    ? rect({ x, y: underY, w: round(size * ease(prog(begin + 0.15, 0.9))), h: 1, fill: T.hair })
    : '';

  return { svg: `${tile}${brandLine}${hairLine}`, halo: `halo${index}` };
}

/* ==================================================================
 *  THE CARD
 * ================================================================== */
function build() {
  const W = 1000;
  const M = 76;
  const CW = W - M * 2;

  const name = identity.name;
  const role = identity.role.toUpperCase();
  const headline = identity.tagline;
  const aboutLines = wrapText(identity.about, CW, 14, 0.6);

  /* ---- timeline: each text starts once the previous one is done ---- */
  const S = [];
  const P = [];
  let t = 0.45;

  /* frame */
  const perimeter = 2 * (W - 1.5) + 2 * (700 - 1.5);
  void perimeter;

  /* name */
  const n = type({ content: name, x: W / 2, y: 100, size: 40, weight: 400, begin: t, perChar: 0.05, anchor: 'middle' });
  S.push(n.svg, caret({ x: n.x, y: 100, size: 40, width: n.width, begin: t, perChar: 0.05, count: name.length }));
  t = n.end + 0.35;

  /* role */
  const r = type({ content: role, x: W / 2, y: 134, size: 13, fill: T.accent, begin: t, perChar: 0.035, ls: 3, anchor: 'middle' });
  S.push(r.svg, caret({ x: r.x, y: 134, size: 13, width: r.width, begin: t, perChar: 0.035, count: role.length, ls: 3 }));
  t = r.end + 0.4;

  /* headline */
  const h = type({ content: headline, x: W / 2, y: 182, size: 18, begin: t, perChar: 0.024, anchor: 'middle' });
  S.push(h.svg, caret({ x: h.x, y: 182, size: 18, width: h.width, begin: t, perChar: 0.024, count: headline.length }));
  t = h.end + 0.6;

  /* about */
  S.push(reveal({ begin: t - 0.2, dur: 0.5, inner: rule({ x: M, y: 214, w: CW, begin: t - 0.2, dur: 0.9 }) }));
  t += 0.35;
  const aboutLabel = type({ content: 'ABOUT', x: M, y: 252, size: 11.5, fill: T.accent, begin: t, perChar: 0.045, ls: 3 });
  S.push(aboutLabel.svg);
  t = aboutLabel.end + 0.3;

  aboutLines.forEach((line, i) => {
    const y = 288 + i * 26;
    const lineBegin = t + i * 0.18;
    const ln = type({ content: line, x: M, y, size: 14, fill: T.muted, begin: lineBegin, perChar: 0.011 });
    const cr = caret({ x: ln.x, y, size: 14, width: ln.width, begin: lineBegin, perChar: 0.011, count: line.length, color: T.muted });
    S.push(reveal({ begin: lineBegin, dur: 0.4, dy: 6, inner: ln.svg + cr }));
  });
  t = t + 0.18 + aboutLines.length * 0.18 + Math.max(...aboutLines.map((l) => l.length)) * 0.011 + 0.35;

  if (quote) {
    const q = type({ content: quote, x: W / 2, y: 288 + aboutLines.length * 26 + 16, size: 13.5, fill: T.dim, begin: t, perChar: 0.018, anchor: 'middle' });
    S.push(q.svg);
    t = q.end + 0.6;
  }

  /* stack */
  S.push(reveal({ begin: t, dur: 0.5, inner: rule({ x: M, y: t > 0 ? 0 : 0, w: CW, begin: t, dur: 0.9 }) }));
  const stackRuleY = 288 + aboutLines.length * 26 + (quote ? 52 : 12);
  S.length -= 1;                                  /* drop the placeholder above */
  S.push(reveal({ begin: t - 0.1, dur: 0.5, inner: rule({ x: M, y: stackRuleY, w: CW, begin: t - 0.1, dur: 0.9 }) }));
  t += 0.4;

  const stackLabel = type({ content: 'STACK', x: M, y: stackRuleY + 40, size: 11.5, fill: T.accent, begin: t, perChar: 0.045, ls: 3 });
  S.push(stackLabel.svg);
  t = stackLabel.end + 0.35;

  /* tiles */
  const tile = 92;
  const gap = (CW - langs.length * tile) / Math.max(1, langs.length - 1);
  const tileY = stackRuleY + 66;
  const tileX = (i) => round(M + i * (tile + gap));

  langs.forEach((item, i) => {
    P.push(`<radialGradient id="halo${i}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${(slugFor(item) ? brand(slugFor(item)).color : T.accent)}" stop-opacity="0.45"/>
      <stop offset="0.6" stop-color="${T.accent}" stop-opacity="0.07"/>
      <stop offset="1" stop-color="${T.accent}" stop-opacity="0"/>
    </radialGradient>`);
    const begin = t + i * 0.16;
    const built = iconTile({ item, x: tileX(i), y: tileY, size: tile, begin, index: i });
    S.push(built.svg);

    const label = type({ content: item, x: tileX(i) + tile / 2, y: tileY + tile + 34, size: 12.5, fill: T.muted, begin: begin + 1.05, perChar: 0.03, anchor: 'middle' });
    S.push(label.svg);
  });
  t = t + (langs.length - 1) * 0.16 + 1.05 + Math.max(...langs.map((l) => l.length)) * 0.03 + 0.5;

  /* closing */
  const closeRuleY = tileY + tile + 64;
  S.push(reveal({ begin: t, dur: 0.5, inner: rule({ x: M, y: closeRuleY, w: CW, begin: t, dur: 0.9 }) }));
  t += 0.45;

  const head = cfg.footer?.headline || 'Let’s build something.';
  const hp = type({ content: head, x: W / 2, y: closeRuleY + 52, size: 20, begin: t, perChar: 0.035, anchor: 'middle' });
  S.push(hp.svg, caret({ x: hp.x, y: closeRuleY + 52, size: 20, width: hp.width, begin: t, perChar: 0.035, count: head.length }));
  t = hp.end + 0.3;

  const handleLine = `@${identity.handle} · ${identity.location}`;
  const hl = type({ content: handleLine, x: W / 2, y: closeRuleY + 84, size: 13, fill: T.dim, begin: t, perChar: 0.03, anchor: 'middle' });
  S.push(hl.svg);
  /* the live dot appears once the handle is typed */
  const dotX = hl.x - 18;
  const dotBegin = hl.end + 0.1;
  S.push(
    isFrame()
      ? `<circle cx="${round(dotX)}" cy="${closeRuleY + 79.5}" r="3.6" fill="${T.accent}" opacity="${done(dotBegin) ? 1 : 0}"/>`
      : `<circle cx="${round(dotX)}" cy="${closeRuleY + 79.5}" r="3.6" fill="${T.accent}" opacity="0">
          ${fade(dotBegin, 0.4)}
          <animate attributeName="opacity" values="1;0.25;1" dur="2.4s" begin="${round(dotBegin + 0.4)}s" repeatCount="indefinite"/>
        </circle>`
  );
  t = t + handleLine.length * 0.03 + 0.6;

  /* height follows the content */
  const H = round(closeRuleY + 84 + 52);

  /* card shell */
  const shell = [
    rect({ x: 0, y: 0, w: W, h: H, fill: T.bg }),
    (() => {
      const per = round(2 * (W - 1.5) + 2 * (H - 1.5) - 8 * 22 + 2 * Math.PI * 22);
      const drawn = isFrame() ? ease(prog(0.05, 1.3)) : 0;
      return `<g opacity="${isFrame() ? drawn : 0}">
        ${isFrame() ? '' : fade(0.05, 0.6)}
        ${rect({
          x: 0.75, y: 0.75, w: W - 1.5, h: H - 1.5, rx: 22, fill: T.card, stroke: T.hair, sw: 1.5,
          extra: isFrame()
            ? `stroke-dasharray="${per}" stroke-dashoffset="${round(per * (1 - drawn))}"`
            : `stroke-dasharray="${per}" stroke-dashoffset="${per}"><animate attributeName="stroke-dashoffset" from="${per}" to="0" begin="0.05s" dur="1.3s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.6 0.2 1" values="${per};0"/>`,
        }).replace('></rect>', '>')}
      </g>`;
    })(),
    `<ellipse cx="${W / 2}" cy="4" rx="540" ry="250" fill="url(#cardGlow)" opacity="${isFrame() ? round(0.85 + 0.1 * Math.sin(FRAME)) : 0.9}">
      ${isFrame() ? '' : '<animate attributeName="opacity" values="0.8;1;0.8" dur="12s" repeatCount="indefinite"/>'}
    </ellipse>`,
  ].join('\n');

  P.push(lgrad('hairGrad', [[0, T.accent, 0], [0.5, T.hair, 1], [1, T.accent, 0]]));
  P.push(rgrad('cardGlow', [[0, T.accent, 0.07], [0.6, T.accent, 0.02], [1, T.accent, 0]]));
  P.push(`<clipPath id="cardClip"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="21"/></clipPath>`);

  const card = svg({
    w: W, h: H,
    title: `${name} — ${identity.role}`,
    defs: P.join('\n'),
    body: `<g clip-path="url(#cardClip)">${shell}\n${S.join('\n')}</g>`,
  });

  return { card, total: t, W, H };
}

/* ==================================================================
 *  OUTPUT
 * ================================================================== */
const OUT = (rel) => new URL(`../${rel}`, import.meta.url);
mkdirSync(OUT('assets'), { recursive: true });
mkdirSync(new URL('./.preview', import.meta.url), { recursive: true });

const render = (t, zoom = 1) => {
  FRAME = t;
  const { card } = build();
  FRAME = null;
  const png = new Resvg(card, {
    fitTo: { mode: 'zoom', value: zoom },
    font: { loadSystemFonts: true, defaultFontFamily: 'monospace' },
  }).render().asPng();
  return { png, card };
};

/* the animated file */
FRAME = null;
const { card, total, W, H } = build();
const clean = card.replace(/\n{3,}/g, '\n\n');
writeFileSync(OUT('assets/card.svg'), clean);
console.log(`  ✓ assets/card.svg  ${W}×${H}, ${(Buffer.byteLength(clean) / 1024).toFixed(1)} KB, animation runs ${round(total)}s`);

if (process.argv.includes('--png')) {
  const { png } = render(1e6, 2);
  writeFileSync(new URL('./.preview/card-still.png', import.meta.url), png);
  console.log('  ✓ tools/.preview/card-still.png  (settled frame @2×)');
}

if (process.argv.includes('--gif')) {
  const step = 0.3;
  const frames = [];
  for (let i = 0, t = 0; t <= total + 2.6; i++, t += step) {
    const { png } = render(t, 1);
    const file = new URL(`./.preview/frames/f${String(i).padStart(3, '0')}.png`, import.meta.url);
    mkdirSync(new URL('./.preview/frames/', import.meta.url), { recursive: true });
    writeFileSync(file, png);
    frames.push(file.pathname);
  }
  const gif = new URL('./.preview/card.gif', import.meta.url);
  execFileSync('convert', [
    '-delay', String(Math.round(step * 100)), '-loop', '0',
    ...frames, '-resize', '760x', '-colors', '96', '-layers', 'OptimizePlus', gif.pathname,
  ]);
  console.log(`  ✓ tools/.preview/card.gif  (${frames.length} frames)`);
}
