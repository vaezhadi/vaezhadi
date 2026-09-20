/* ------------------------------------------------------------------
 *  build-assets.mjs — builds the whole profile as ONE framed card:
 *  assets/card.svg   (text types itself, avatar and sections fade in)
 *
 *  run:  node tools/build-assets.mjs [--preview]
 * ------------------------------------------------------------------ */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import {
  T, SANS, MONO, esc, text, rect, anim, animT, fadeIn, riseIn, growW, growH, scaleIn, drawIn,
  typeLine, lightSweep, lgrad, rgrad, wrapText, svg, round,
} from './svg-lib.mjs';

const cfg = JSON.parse(readFileSync(new URL('./profile.config.json', import.meta.url), 'utf8'));
const { identity, skills, quote } = cfg;

const PREVIEW = process.argv.includes('--preview');
mkdirSync(new URL('../assets', import.meta.url), { recursive: true });
if (PREVIEW) mkdirSync(new URL('./.preview', import.meta.url), { recursive: true });

/* ---------- optional avatar photo (drop assets/avatar.png in) -------- */
const avatarData = (() => {
  const candidates = ['avatar.png', 'avatar.jpg', 'avatar.jpeg', 'avatar.webp', 'photo.png'];
  for (const name of candidates) {
    const url = new URL(`../assets/${name}`, import.meta.url);
    if (!existsSync(url)) continue;
    const ext = name.split('.').pop().toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
    return `data:${mime};base64,${readFileSync(url).toString('base64')}`;
  }
  return null;
})();

/* ==================================================================
 *  LAYOUT
 * ================================================================== */
const W = 1000;
const M = 76;                 // side margin
const CW = W - M * 2;         // content width
const TECH = 0.045;           // seconds per typed character

const name = identity.name;
const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const role = identity.role.toUpperCase();
const tagline = identity.tagline;
const aboutLines = wrapText(identity.about, CW, 15.5);
const skillItems = (skills || []).map((s) => (typeof s === 'string' ? s : s.name));
const skillRows = Math.ceil(skillItems.length / 2);
const colW = CW / 2;

const sweep = (args) => (PREVIEW ? '' : lightSweep(args));

const S = [];                 // body parts
const P = [];                 // defs parts

/* ---- timeline ---- */
const t = {
  card: 0.05,
  ring: 0.45,
  avatar: 0.85,
  name: 0.95,
  role: 1.15,
  typed: 1.35,
  sep1: 1.9,
  aboutLabel: 2.05,
  about: 2.2,
  quote: 2.75,
  sep2: 3.0,
  stackLabel: 3.15,
  stack: 3.3,
  sep3: 4.15,
  closing: 4.35,
};
const typedEnd = round(t.typed + tagline.length * TECH);

/* ---- canvas ---------------------------------------------------------- */
const H = (() => {
  let h = 300;                                   // hero block
  h += 60;                                       // separator 1
  h += 48 + aboutLines.length * 27 + 44;         // about + quote
  h += 56;                                       // separator 2
  h += 56 + skillRows * 44 + 20;                 // stack
  h += 56;                                       // separator 3
  h += 84;                                       // closing
  return h;
})();

S.push(rect({ x: 0, y: 0, w: W, h: H, fill: T.bg }));
const perim = round(2 * (W - 1.5) + 2 * (H - 1.5) - 8 * 22 + 2 * Math.PI * 22);
S.push(`<g opacity="0">${fadeIn(t.card, 0.6)}
  ${rect({
    x: 0.75, y: 0.75, w: W - 1.5, h: H - 1.5, rx: 22, fill: T.card, stroke: T.hair, sw: 1.5,
    extra: `stroke-dasharray="${perim}" stroke-dashoffset="${perim}" ${drawIn(perim, t.card, 1.3)}`,
  })}
</g>`);
S.push(`<ellipse cx="${W / 2}" cy="6" rx="540" ry="250" fill="url(#cardGlow)">
  ${anim('opacity', '0.85;1;0.85', '12s')}
</ellipse>`);

/* ---- avatar ---------------------------------------------------------- */
const AV = { cx: W / 2, cy: 138, r: 58 };
S.push(`<g>
  ${rect({ x: AV.cx - AV.r, y: AV.cy - AV.r, w: AV.r * 2, h: AV.r * 2, rx: AV.r, fill: T.track, op: 0.5, extra: fadeIn(t.ring, 0.8) })}
  <circle cx="${AV.cx}" cy="${AV.cy}" r="${AV.r}" fill="none" stroke="${T.hairLit}" stroke-width="1.5"
    stroke-dasharray="${round(2 * Math.PI * AV.r)}" stroke-dashoffset="${round(2 * Math.PI * AV.r)}">
    ${drawIn(2 * Math.PI * AV.r, t.ring, 1.15)}
  </circle>
  <g opacity="0">${fadeIn(t.ring + 0.6, 1)}
    <circle cx="${AV.cx}" cy="${AV.cy}" r="${AV.r + 10}" fill="none" stroke="${T.accent}" stroke-width="1.6" opacity="0.5"
      stroke-dasharray="2 12" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" from="0 ${AV.cx} ${AV.cy}" to="360 ${AV.cx} ${AV.cy}" dur="30s" repeatCount="indefinite"/>
    </circle>
  </g>
</g>`);

S.push(`<g opacity="0">${fadeIn(t.ring + 0.35, 0.9)}${scaleIn(t.ring + 0.35, 0.9, 0.9)}
  <g transform="translate(${AV.cx} ${AV.cy})">
    ${text({ x: 0, y: 12, size: 34, weight: 600, ls: 2, fill: T.text, anchor: 'middle', content: initials })}
  </g>
</g>`);

if (avatarData) {
  /* the photo sits on top of the monogram, so a missing image is harmless */
  P.push(`<clipPath id="avClip"><circle cx="${AV.cx}" cy="${AV.cy}" r="${AV.r - 3}"/></clipPath>`);
  S.push(`<g clip-path="url(#avClip)" opacity="0">${fadeIn(t.avatar, 1)}${scaleIn(t.avatar, 1.1, 0.92)}
  <g transform="translate(${AV.cx} ${AV.cy})">
    <image href="${avatarData}" x="${-(AV.r - 3)}" y="${-(AV.r - 3)}" width="${(AV.r - 3) * 2}" height="${(AV.r - 3) * 2}" preserveAspectRatio="xMidYMid slice"/>
  </g>
</g>`);
}

/* ---- name · role · typed sentence ------------------------------------ */
S.push(`<g opacity="0">${fadeIn(t.name, 0.9)}${riseIn(t.name, 0.9, 14)}
  ${text({ x: W / 2, y: 262, size: 40, weight: 600, ls: 0.5, fill: T.text, anchor: 'middle', content: name })}
</g>`);

S.push(`<g opacity="0">${fadeIn(t.role, 0.8)}
  ${text({ x: W / 2, y: 296, size: 12.5, weight: 500, ls: 4, fill: T.accent, anchor: 'middle', content: role })}
</g>`);

const TITLE_SIZE = 19;
const cw = TITLE_SIZE * 0.6;
const ty = round((W - tagline.length * cw) / 2);
const typed = typeLine({ content: tagline, x: ty, y: 350, size: TITLE_SIZE, start: t.typed, perChar: TECH, fill: T.text });
S.push(`<g opacity="0">${fadeIn(t.typed - 0.2, 0.4)}${typed.glyphs}${PREVIEW ? '' : typed.caret}</g>`);

/* ---- helper: hairline separator (drawn left → right) ---------------- */
const sepAt = (y, begin) =>
  `<g opacity="0">${fadeIn(begin, 0.5)}
  ${rect({ x: M, y, w: 0, h: 1, fill: 'url(#hairGrad)', extra: growW(CW, begin, 1) })}
</g>`;

/* ---- about ----------------------------------------------------------- */
let y = 430;
S.push(sepAt(y - 40, t.sep1));
S.push(`<g opacity="0">${fadeIn(t.aboutLabel, 0.6)}
  ${text({ x: M, y, size: 11.5, weight: 600, ls: 3.2, fill: T.accent, content: 'ABOUT' })}
</g>`);
aboutLines.forEach((line, i) => {
  const b = t.about + i * 0.12;
  S.push(`<g opacity="0">${fadeIn(b, 0.75)}${riseIn(b, 0.75, 8)}
    ${text({ x: M, y: y + 32 + i * 27, size: 15.5, fill: T.muted, content: line })}
  </g>`);
});
y += 32 + aboutLines.length * 27;

if (quote) {
  const b = t.quote;
  S.push(`<g opacity="0">${fadeIn(b, 0.9)}
    ${text({ x: W / 2, y: y + 24, size: 14.5, italic: true, fill: T.dim, anchor: 'middle', content: quote })}
  </g>`);
  y += 24;
}

/* ---- stack ----------------------------------------------------------- */
const stackTop = y + 66;
S.push(sepAt(stackTop - 46, t.sep2));
S.push(`<g opacity="0">${fadeIn(t.stackLabel, 0.6)}
  ${text({ x: M, y: stackTop, size: 11.5, weight: 600, ls: 3.2, fill: T.accent, content: 'STACK' })}
</g>`);

const nameW = 150, ruleW = 250;
skillItems.slice(0, skillRows * 2).forEach((item, i) => {
  const col = Math.floor(i / skillRows), row = i % skillRows;
  const x = M + col * colW;
  const ry = stackTop + 34 + row * 44;
  const ruleX = x + nameW;
  const b = t.stack + (row * 2 + col) * 0.09;
  S.push(`<g opacity="0">${fadeIn(b, 0.65)}
  ${text({ x, y: ry, size: 15, fill: T.text, content: item })}
  ${rect({ x: ruleX, y: ry - 5, w: 0, h: 1, fill: T.hair, extra: growW(ruleW, b + 0.18, 0.9) })}
  ${sweep({ x: ruleX, y: ry - 5.5, w: ruleW, h: 2, begin: b + 0.85, dur: 1.5, gradId: 'sweepG' })}
</g>`);
});
const stackBottom = stackTop + 34 + (skillRows - 1) * 44;

/* ---- closing --------------------------------------------------------- */
const closeY = stackBottom + 76;
S.push(sepAt(closeY - 46, t.sep3));
const handleLine = `@${identity.handle} · ${identity.location}`;
S.push(`<g opacity="0">${fadeIn(t.closing, 0.9)}${riseIn(t.closing, 0.9, 6)}
  ${cfg.footer?.headline ? text({ x: W / 2, y: closeY, size: 19, weight: 600, fill: T.text, anchor: 'middle', content: cfg.footer.headline }) : ''}
</g>`);
S.push(`<g opacity="0">${fadeIn(t.closing + 0.35, 0.9)}
  ${text({ x: W / 2, y: closeY + 30, size: 13, fill: T.dim, anchor: 'middle', content: handleLine })}
</g>`);
S.push(`<circle cx="${round(W / 2 - handleLine.length * 3.55 - 14)}" cy="${closeY + 25.5}" r="3.6" fill="${T.accent}">
  ${anim('opacity', '1;0.2;1', '2.4s')}
  ${anim('r', '3.6;4.6;3.6', '2.4s')}
</circle>`);

/* ---- a single light that sweeps the whole card at the very end ------- */
S.push(`<g clip-path="url(#cardClip)">${sweep({ x: M, y: 0, w: CW, h: H, begin: typedEnd + 0.6, dur: 2.6, gradId: 'cardSweep' })}</g>`);

/* ==================================================================
 *  DEFS + OUTPUT
 * ================================================================== */
P.push(lgrad('hairGrad', [[0, T.accent, 0], [0.5, T.hair, 1], [1, T.accent, 0]]));
P.push(lgrad('sweepG', [[0, T.accent, 0], [0.5, T.accentSoft, 0.95], [1, T.accent, 0]]));
P.push(lgrad('cardSweep', [[0, T.accent, 0], [0.5, T.accentSoft, 0.05], [1, T.accent, 0]], '0%', '0%', '100%', '100%'));
P.push(`<clipPath id="cardClip"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="21"/></clipPath>`);
P.push(rgrad('cardGlow', [[0, T.accent, 0.07], [0.6, T.accent, 0.02], [1, T.accent, 0]]));
P.push(rgrad('avGlow', [[0, T.accent, 0.16], [0.7, T.accent, 0.04], [1, T.accent, 0]]));

const card = svg({
  w: W, h: H,
  title: `${name} — ${identity.role}`,
  defs: P.join('\n'),
  body: `<g clip-path="url(#cardClip)">${S.join('\n')}</g>`,
});

const clean = card.replace(/\n{3,}/g, '\n\n');
writeFileSync(new URL('../assets/card.svg', import.meta.url), clean);
console.log(`  ✓ assets/card.svg  (${(Buffer.byteLength(clean) / 1024).toFixed(1)} KB, ${W}×${H})`);
console.log(`    avatar photo: ${avatarData ? 'embedded from assets/avatar.*' : 'none — add assets/avatar.png and rebuild'}`);

if (PREVIEW) {
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
  writeFileSync(new URL('./.preview/card.png', import.meta.url), png);
  console.log('    → tools/.preview/card.png');
}
