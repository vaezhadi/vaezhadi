/* ------------------------------------------------------------------
 *  svg-lib.mjs — small, calm SVG toolkit
 *  Only SMIL + CSS-free primitives, so everything animates inside an
 *  <img src="*.svg"> on GitHub.
 * ------------------------------------------------------------------ */

/* restrained palette: black canvas, near-white type, one green accent */
export const T = {
  bg: '#000000',
  text: '#e6edf3',
  muted: '#8b949e',
  dim: '#6e7681',
  accent: '#3fb950',
  accentSoft: '#56d364',
  deep: '#238636',
  track: '#161c19',
  hair: '#1f2a24',
};

export const SANS =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif";

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const round = (n) => Math.round(n * 100) / 100;

export function text({
  x, y, size = 14, fill = T.text, weight = 400, anchor = 'start',
  content, ls = null, op = null, family = SANS, cls = '', lock = null,
}) {
  const a = [
    `x="${x}"`, `y="${y}"`, `font-family="${family}"`, `font-size="${size}"`,
    `fill="${fill}"`, `text-anchor="${anchor}"`,
  ];
  if (weight !== 400) a.push(`font-weight="${weight}"`);
  if (lock) a.push(`textLength="${round(lock)}"`, 'lengthAdjust="spacingAndGlyphs"');
  if (ls) a.push(`letter-spacing="${ls}"`);
  if (op !== null) a.push(`opacity="${op}"`);
  if (cls) a.push(`class="${cls}"`);
  return `<text ${a.join(' ')}>${esc(content)}</text>`;
}

export function rect({ x, y, w, h, fill = 'none', rx = 0, stroke = null, sw = 1, op = null, extra = '' }) {
  const a = [`x="${round(x)}"`, `y="${round(y)}"`, `width="${round(w)}"`, `height="${round(h)}"`];
  if (rx) a.push(`rx="${rx}"`);
  a.push(`fill="${fill}"`);
  if (stroke) a.push(`stroke="${stroke}"`, `stroke-width="${sw}"`);
  if (op !== null) a.push(`opacity="${op}"`);
  if (extra) a.push(extra);
  return `<rect ${a.join(' ')}/>`;
}

export const anim = (attr, values, dur, extra = '') =>
  `<animate attributeName="${attr}" values="${values}" dur="${dur}" repeatCount="indefinite" ${extra}/>`;

export const animT = (type, values, dur, extra = '') =>
  `<animateTransform attributeName="transform" type="${type}" values="${values}" dur="${dur}" repeatCount="indefinite" ${extra}/>`;

/* one-shot entrance: fades in and settles (fill="freeze" so it stays visible) */
export const fadeIn = (begin = 0, dur = 0.8) =>
  `<animate attributeName="opacity" from="0" to="1" begin="${begin}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.6 0.2 1" values="0;1"/>`;

/* one-shot entrance: rises a few pixels while fading in.
   put this inside a <g opacity="0"> that has no transform of its own */
export const riseIn = (begin = 0, dur = 0.9, dy = 12) =>
  `<animateTransform attributeName="transform" type="translate" from="0 ${dy}" to="0 0" begin="${begin}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.6 0.2 1" values="0 ${dy};0 0"/>`;

/* one-shot: a rect grows from 0 to its final width (skill bars, rules) */
export const growW = (to, begin = 0, dur = 1.1) =>
  `<animate attributeName="width" from="0" to="${round(to)}" begin="${begin}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 0.61 0.2 1" values="0;${round(to)}"/>`;

/* a soft highlight that drifts along a line, on a long calm loop */
export const shimmer = ({ x, y, w, h, travel, dur = 9, begin = 2.4, peak = 0.45, gradId }) => `
<g opacity="0">
  <animate attributeName="opacity" values="0;0;${peak};${peak};0;0" keyTimes="0;0.25;0.4;0.6;0.75;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
  <g>
    <animateTransform attributeName="transform" type="translate" values="${-w} 0; ${round(travel)} 0" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
    ${rect({ x, y, w, h, rx: h / 2, fill: `url(#${gradId})` })}
  </g>
</g>`;

export const lgrad = (id, stops, x1 = '0%', y1 = '0%', x2 = '100%', y2 = '0%') => `
<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}
</linearGradient>`;

export const rgrad = (id, stops, cx = '50%', cy = '50%', r = '70%') => `
<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">
${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}
</radialGradient>`;

export const svg = ({ w, h, defs = '', body, title = '' }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
${defs ? `<defs>${defs}</defs>` : ''}
${body}
</svg>`;
