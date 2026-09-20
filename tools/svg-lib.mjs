/* ------------------------------------------------------------------
 *  svg-lib.mjs — the small animation toolkit used to build the profile
 *  card. SMIL only, so everything animates inside <img src="*.svg">.
 * ------------------------------------------------------------------ */

export const T = {
  bg: '#000000',
  card: '#050706',
  text: '#e6edf3',
  muted: '#8b949e',
  dim: '#6e7681',
  accent: '#3fb950',
  accentSoft: '#56d364',
  track: '#161c19',
  hair: '#1f2a24',
  hairLit: '#2d3d34',
};

export const SANS =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif";
export const MONO =
  "ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const round = (n) => Math.round(n * 100) / 100;

export function text({
  x, y, size = 14, fill = T.text, weight = 400, anchor = 'start', content,
  ls = null, op = null, family = SANS, lock = null, italic = false,
}) {
  const a = [
    `x="${round(x)}"`, `y="${round(y)}"`, `font-family="${family}"`, `font-size="${round(size)}"`,
    `fill="${fill}"`, `text-anchor="${anchor}"`,
  ];
  if (weight !== 400) a.push(`font-weight="${weight}"`);
  if (italic) a.push('font-style="italic"');
  if (lock) a.push(`textLength="${round(lock)}"`, 'lengthAdjust="spacingAndGlyphs"');
  if (ls) a.push(`letter-spacing="${ls}"`);
  if (op !== null) a.push(`opacity="${op}"`);
  return `<text ${a.join(' ')}>${esc(content)}</text>`;
}

export function rect({ x, y, w, h, fill = 'none', rx = 0, stroke = null, sw = 1, op = null, extra = '' }) {
  const a = [`x="${round(x)}"`, `y="${round(y)}"`, `width="${round(w)}"`, `height="${round(h)}"`];
  if (rx) a.push(`rx="${round(rx)}"`);
  a.push(`fill="${fill}"`);
  if (stroke) a.push(`stroke="${stroke}"`, `stroke-width="${sw}"`);
  if (op !== null) a.push(`opacity="${op}"`);
  if (extra) a.push(extra);
  return `<rect ${a.join(' ')}/>`;
}

/* rect + child elements (animation) — keeps the XML well formed */
export function rectEl(attrs, children = '') {
  const selfClosing = rect(attrs);
  return children ? selfClosing.replace(/\/>\s*$/, `>${children}</rect>`) : selfClosing;
}

export const anim = (attr, values, dur, extra = '') =>
  `<animate attributeName="${attr}" values="${values}" dur="${dur}" repeatCount="indefinite" ${extra}/>`;

export const animT = (type, values, dur, extra = '') =>
  `<animateTransform attributeName="transform" type="${type}" values="${values}" dur="${dur}" repeatCount="indefinite" ${extra}/>`;

/* ---- one-shot entrances (they settle and stay) ---------------------- */

export const fadeIn = (begin = 0, dur = 0.8, to = 1) =>
  `<animate attributeName="opacity" from="0" to="${to}" begin="${round(begin)}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.6 0.2 1" values="0;${to}"/>`;

export const riseIn = (begin = 0, dur = 0.9, dy = 12) =>
  `<animateTransform attributeName="transform" type="translate" from="0 ${dy}" to="0 0" begin="${round(begin)}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.6 0.2 1" values="0 ${dy};0 0"/>`;

export const growW = (to, begin = 0, dur = 1.1) =>
  `<animate attributeName="width" from="0" to="${round(to)}" begin="${round(begin)}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 0.61 0.2 1" values="0;${round(to)}"/>`;

export const growH = (to, begin = 0, dur = 0.9) =>
  `<animate attributeName="height" from="0" to="${round(to)}" begin="${round(begin)}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 0.61 0.2 1" values="0;${round(to)}"/>`;

export const scaleIn = (begin = 0, dur = 0.9, from = 0.86) =>
  `<animateTransform attributeName="transform" type="scale" values="${from};1" begin="${round(begin)}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.6 0.2 1" additive="sum"/>`;

/* stroke draw-on: dashoffset from full length to zero */
export const drawIn = (length, begin = 0, dur = 1.1) =>
  `<animate attributeName="stroke-dashoffset" from="${round(length)}" to="0" begin="${round(begin)}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.3 0.6 0.2 1" values="${round(length)};0"/>`;

/* ---- typewriter ------------------------------------------------------
 * each glyph is its own <text> pinned to a fixed cell (textLength), so the
 * line is pixel-exact whatever monospace font the viewer actually has.
 * -------------------------------------------------------------------- */
export function typeLine({
  content, x, y, size = 17, start = 1.3, perChar = 0.045, fill = T.text,
  cursorFill = T.accent, family = MONO,
}) {
  const cw = size * 0.6;
  const chars = [...content];
  const glyphs = chars
    .map((ch, i) => text({
      x: x + i * cw, y, size, fill, family, lock: cw, content: ch, op: 0,
      extra: `<animate attributeName="opacity" from="0" to="1" begin="${round(start + i * perChar)}s" dur="0.06s" fill="freeze" calcMode="discrete" values="0;1"/>`,
    }))
    .join('');

  /* the caret steps one cell at a time while the sentence is being typed */
  const steps = chars.length + 1;
  const keys = Array.from({ length: steps }, (_, i) => round(i / (steps - 1))).join(';');
  const vals = Array.from({ length: steps }, (_, i) => `${round(x + i * cw)} 0`).join(';');
  const typedFor = round(chars.length * perChar + 0.4);

  const caret = `<g opacity="0">${fadeIn(start - 0.2, 0.2)}
  <g>
    <animateTransform attributeName="transform" type="translate" values="${round(x - cw)} 0; ${round(x - cw + chars.length * cw)} 0"
      dur="${typedFor}s" begin="${round(start)}s" fill="freeze" calcMode="discrete" keyTimes="${keys}"/>
    <rect x="0" y="${round(y - size * 0.78)}" width="${round(cw * 0.52)}" height="${round(size * 0.94)}" rx="1" fill="${cursorFill}">
      <animate attributeName="opacity" values="0.9;0;0.9" dur="1.05s" begin="${round(start + chars.length * perChar)}s" repeatCount="indefinite"/>
    </rect>
  </g>
</g>`;

  return { glyphs, caret, width: chars.length * cw, end: round(start + chars.length * perChar) };
}

/* a soft highlight that travels along a hairline, once */
export function lightSweep({ x, y, w, h = 2, begin = 2, dur = 1.6, gradId }) {
  return `<g opacity="0">
  <animate attributeName="opacity" values="0;0.9;0" dur="${dur}s" begin="${round(begin)}s" fill="freeze" keyTimes="0;0.35;1"/>
  <g>
    <animateTransform attributeName="transform" type="translate" values="${-90} 0; ${round(w)} 0" dur="${dur}s" begin="${round(begin)}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.3 0.7 0.3 1"/>
    ${rect({ x, y, w: 90, h, rx: h / 2, fill: `url(#${gradId})` })}
  </g>
</g>`;
}

/* ---- gradients ------------------------------------------------------ */

export const lgrad = (id, stops, x1 = '0%', y1 = '0%', x2 = '100%', y2 = '0%') => `
<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}
</linearGradient>`;

export const rgrad = (id, stops, cx = '50%', cy = '50%', r = '70%') => `
<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">
${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}
</radialGradient>`;

export const wrapText = (str, maxWidth, size, factor = 0.512) => {
  const perChar = size * factor;
  const words = String(str).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length * perChar > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export const svg = ({ w, h, defs = '', body, title = '' }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
${defs ? `<defs>${defs}</defs>` : ''}
${body}
</svg>`;
