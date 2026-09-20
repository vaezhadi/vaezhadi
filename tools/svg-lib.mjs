/* ------------------------------------------------------------------
 *  svg-lib.mjs — hand-written animated SVG toolkit (no dependencies)
 *  Everything is SMIL based so it animates inside <img src="*.svg">
 *  on GitHub (scripts are stripped there, SMIL/CSS-in-SVG survive).
 * ------------------------------------------------------------------ */

export const C = {
  bg: '#000000',
  bg1: '#030905',
  panel: '#04120a',
  panel2: '#020806',
  edge: '#0d3a22',
  edgeLit: '#1d6b41',
  neon: '#00ff41',
  neon2: '#39ff88',
  mint: '#7dffb0',
  dim: '#1f6b3d',
  dim2: '#12512c',
  text: '#c9ffdd',
  textDim: '#5fbf85',
  amber: '#ffd166',
  cyan: '#00fff9',
  magenta: '#ff00a0',
};

export const MONO =
  "'JetBrains Mono','Fira Code','Cascadia Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'DejaVu Sans Mono',monospace";

export const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* deterministic pseudo random so rebuilds are byte-stable */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* rough advance width of a monospace glyph at a given size */
export const cw = (size) => size * 0.6;

export function text({
  x, y, size = 14, fill = C.text, weight = 400, anchor = 'start',
  content, lock = null, cls = '', op = null, ls = null, extra = '',
}) {
  const attrs = [
    `x="${x}"`, `y="${y}"`,
    `font-family="${MONO}"`, `font-size="${size}"`,
    `fill="${fill}"`, `text-anchor="${anchor}"`,
  ];
  if (weight !== 400) attrs.push(`font-weight="${weight}"`);
  if (lock) attrs.push(`textLength="${round(lock)}"`, 'lengthAdjust="spacingAndGlyphs"');
  if (ls) attrs.push(`letter-spacing="${ls}"`);
  if (op !== null) attrs.push(`opacity="${op}"`);
  if (cls) attrs.push(`class="${cls}"`);
  if (extra) attrs.push(extra);
  return `<text ${attrs.join(' ')}>${esc(content)}</text>`;
}

export const rect = ({ x, y, w, h, fill = 'none', rx = 0, stroke = null, sw = 1, op = null, extra = '' }) => {
  const a = [`x="${round(x)}"`, `y="${round(y)}"`, `width="${round(w)}"`, `height="${round(h)}"`];
  if (rx) a.push(`rx="${rx}"`);
  a.push(`fill="${fill}"`);
  if (stroke) a.push(`stroke="${stroke}"`, `stroke-width="${sw}"`);
  if (op !== null) a.push(`opacity="${op}"`);
  if (extra) a.push(extra);
  return `<rect ${a.join(' ')}/>`;
};

export const round = (n) => Math.round(n * 100) / 100;

export const anim = (attr, values, dur, extra = '') =>
  `<animate attributeName="${attr}" values="${values}" dur="${dur}" repeatCount="indefinite" ${extra}/>`;

export const animT = (type, values, dur, extra = '') =>
  `<animateTransform attributeName="transform" type="${type}" values="${values}" dur="${dur}" repeatCount="indefinite" ${extra}/>`;

/* preview mode: emit the fully-settled frame (used for PNG rendering) */
let PREVIEW = false;
export const setPreview = (v) => { PREVIEW = v; };
export const isPreview = () => PREVIEW;

/* fade-in that holds forever (used for staggered reveals) */
export const appear = (begin, dur = 0.45, from = 0) => PREVIEW ? '' :
  `<animate attributeName="opacity" from="${from}" to="1" begin="${begin}s" dur="${dur}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.8 0.2 1" values="${from};1"/>`;

export const svg = ({ w, h, defs = '', body, title = '', cls = '' }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}"${cls ? ` class="${cls}"` : ''}>
<title>${esc(title)}</title>
${defs}
${body}
</svg>`;

/* svg <defs> fragments ------------------------------------------------ */

export const glow = (id, dev = 6, clr = C.neon, spread = 2) => `
<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%">
  <feGaussianBlur stdDeviation="${dev}" result="b"/>
  <feFlood flood-color="${clr}" flood-opacity="0.9" result="c"/>
  <feComposite in="c" in2="b" operator="in" result="g"/>
  <feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>`;

export const softGlow = (id, dev = 3, clr = C.neon) => `
<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%">
  <feDropShadow dx="0" dy="0" stdDeviation="${dev}" flood-color="${clr}" flood-opacity="0.85"/>
</filter>`;

export const lgrad = (id, stops, x1 = '0%', y1 = '0%', x2 = '100%', y2 = '0%') => `
<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('\n')}
</linearGradient>`;

export const rgrad = (id, stops, cx = '50%', cy = '50%', r = '70%') => `
<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">
${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('\n')}
</radialGradient>`;

/* matrix digital rain -------------------------------------------------
 * columns of glyphs falling top → bottom, each column its own speed,
 * wrapped in a tall group animated with SMIL translate.
 * -------------------------------------------------------------------- */
export function rain({ w, h, cols = 42, seed = 7, size = 14, opacity = 0.5, charset = 'katakana', fade = true }) {
  const rand = rng(seed);
  const sets = {
    katakana: 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ',
    hex: '0123456789ABCDEF',
    binary: '01',
    mix: '01ｱｲｳｴｵｶｷｸ<>/[]{}$#@%&*+=',
  };
  const chars = sets[charset] || sets.mix;
  const out = [];
  const step = w / cols;
  for (let i = 0; i < cols; i++) {
    const x = i * step + step / 2 + (rand() - 0.5) * step * 0.5;
    const len = 8 + Math.floor(rand() * 16);
    const dur = (5 + rand() * 7).toFixed(2);
    const delay = (-rand() * dur).toFixed(2);
    const fs = size * (0.75 + rand() * 0.55);
    const colOpacity = (opacity * (0.35 + rand() * 0.65)).toFixed(3);
    let s = '';
    for (let k = 0; k < len; k++) {
      s += esc(chars[Math.floor(rand() * chars.length)]) + (k < len - 1 ? '\n' : '');
    }
    const gradId = `rainG${i % 6}`;
    const y0 = PREVIEW ? -rand() * h : 0;
    out.push(
      `<g transform="translate(${round(x)},${round(y0)})" opacity="${colOpacity}">
  <g>
    <animateTransform attributeName="transform" type="translate" values="0 ${-len * fs * 1.35}; 0 ${h}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
    <text x="0" y="0" font-family="${MONO}" font-size="${round(fs)}" fill="url(#${gradId})" text-anchor="middle" xml:space="preserve">${s}</text>
  </g>
</g>`
    );
  }
  const grads = Array.from({ length: 6 }, (_, i) =>
    lgrad(`rainG${i}`, [[0, C.bg, 0], [0.15, C.neon, 0.15 + i * 0.03], [0.55, C.mint, 0.75], [0.95, C.neon, 1]], '0%', '0%', '0%', '100%')
  ).join('\n');
  const fadeRect = fade
    ? rect({ x: 0, y: 0, w, h, fill: 'url(#rainFade)' })
    : '';
  return {
    defs: `${grads}
${rgrad('rainFade', [[0.55, C.bg, 0], [1, C.bg, 1]])}`,
    body: `<g>${out.join('\n')}</g>${fadeRect}`,
  };
}

/* glitch title ---------------------------------------------------------
 * base text revealed by a sweeping mask + cyan/magenta sliced copies
 * jittering on discrete time steps (real RGB-split / datamosh look)
 * -------------------------------------------------------------------- */
export function glitchTitle({
  text: label, x, y, size, lock, maskId, glowId, anchor = 'middle',
  glitchStart = 2.6, cycle = 3.4, weight = 800,
}) {
  const w = lock || label.length * cw(size);
  const bands = [0.14, 0.34, 0.52, 0.71, 0.86];
  const slices = bands
    .map((b, i) => {
      const bh = size * (0.16 + (i % 3) * 0.08);
      const by = y - size * 0.82 + size * 1.16 * b;
      const v = i % 2 ? [-7, 4, -2, 6, 0] : [5, -5, 2, -3, 0];
      return { bh, by, values: v.map((t) => `${t} 0`).join(';'), dur: (1.6 + i * 0.37).toFixed(2), delay: (i * 0.21).toFixed(2) };
    });

  const layer = (fill, dx, key) =>
    `<g mask="url(#${maskId})" opacity="0">
  <animate attributeName="opacity" from="0" to="0.7" begin="${glitchStart + key * 0.4}s" dur="0.2s" fill="freeze"/>
  <g>
    ${anim('opacity', '0.7;0.2;0.75;0.3;0.7;0.25;0.7', `${cycle}s`, `begin="${glitchStart}s" calcMode="discrete"`)}
    ${slices.map((s, i) => `<g clip-path="url(#clip${maskId}${key}${i})">
      <g>${animT('translate', s.values, `${s.dur}s`, `begin="${s.delay}s" calcMode="discrete"`)}
      ${text({ x: x + dx, y, size, fill, weight, anchor, content: label, lock: w })}
      </g></g>`).join('\n')}
  </g>
</g>`;

  const clips = [0, 1].map((key) =>
    slices.map((s, i) => `<clipPath id="clip${maskId}${key}${i}"><rect x="${x - w / 2 - 40}" y="${round(s.by)}" width="${w + 80}" height="${round(s.bh)}"/></clipPath>`).join('\n')
  ).join('\n');

  return {
    defs: `${clips}
<mask id="${maskId}">
  <rect x="${x - w / 2 - 60}" y="${y - size}" width="${w + 120}" height="${size * 1.6}" fill="black"/>
  <rect x="${x - w / 2 - 60}" y="${y - size}" width="${PREVIEW ? w + 120 : 0}" height="${size * 1.6}" fill="white">
    <animate attributeName="width" from="0" to="${w + 120}" begin="0.35s" dur="1.1s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.25 0.9 0.2 1" values="0;${w + 120}"/>
  </rect>
  <rect x="${x - w / 2 - 60}" y="${y - size}" width="${w + 120}" height="${size * 1.6}" fill="white" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="1.45s" dur="0.01s" fill="freeze"/>
  </rect>
</mask>`,
    body: `<g opacity="0">
  <animate attributeName="opacity" from="0" to="1" begin="0.2s" dur="0.4s" fill="freeze"/>
  <g filter="url(#${glowId})" opacity="0.9">
    ${text({ x, y, size, fill: C.neon, weight, anchor, content: label, lock: w })}
  </g>
  ${layer(C.cyan, -Math.max(2, size * 0.032), 0)}
  ${layer(C.magenta, Math.max(2, size * 0.032), 1)}
  <g mask="url(#${maskId})">
    ${text({ x, y, size, fill: C.mint, weight, anchor, content: label, lock: w })}
  </g>
</g>`,
  };
}

/* typewriter ----------------------------------------------------------
 * phrases typed char-by-char, held, erased, looped forever.
 * ------------------------------------------------------------------- */
export function typewriter({
  phrases, x, y, size = 20, cycle = 18, speed = 0.055, erase = 0.028,
  hold = 1.9, gap = 0.7, prompt = '> ', promptColor = C.neon, textColor = C.text,
}) {
  const chW = cw(size);
  const promptW = prompt.length * chW;
  if (PREVIEW) {
    const p0 = phrases[0].text;
    return {
      width: promptW + Math.max(...phrases.map((p) => p.text.length)) * chW + chW * 2,
      body: `${text({ x, y, size, fill: promptColor, content: prompt, lock: promptW })}
${text({ x: round(x + promptW), y, size, fill: phrases[0].color || textColor, content: p0, lock: p0.length * chW })}
${rect({ x: round(x + promptW + p0.length * chW + 3), y: round(y - size * 0.82), w: chW * 0.92, h: size * 0.98, fill: C.neon, op: 0.9 })}`,
    };
  }
  const totalLen = phrases.reduce((a, p) => a + p.text.length, 0);
  const raw = phrases.reduce(
    (a, p) => a + p.text.length * speed + hold + p.text.length * erase + gap, 0
  );
  const scale = cycle / raw;
  const cursorY = y;
  let t = 0;
  const body = [];
  const cursorStops = [];

  phrases.forEach((p, pi) => {
    const chars = [...p.text];
    const typeDur = chars.length * speed * scale;
    const eraseDur = chars.length * erase * scale;
    const tStart = t;
    const tEnd = t + chars.length * speed * scale + hold * scale + eraseDur;
    chars.forEach((ch, i) => {
      const inT = (tStart + i * speed * scale) / cycle;
      const outT = (tStart + chars.length * speed * scale + hold * scale + (chars.length - 1 - i) * erase * scale) / cycle;
      const kt = [0, Math.max(0, inT - 0.002), inT, outT, Math.min(1, outT + 0.002), 1]
        .map((v) => round(Math.min(1, Math.max(0, v)))).join(';');
      body.push(
        `<g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="${kt}" dur="${cycle}s" repeatCount="indefinite" calcMode="discrete"/>
${text({ x: round(x + promptW + i * chW), y, size, fill: p.color || textColor, content: ch, lock: chW })}</g>`
      );
      cursorStops.push({ t: (tStart + i * speed * scale) / cycle, i: i + 1 });
    });
    cursorStops.push({ t: (tStart + chars.length * speed * scale + hold * scale) / cycle, i: chars.length });
    t = tEnd + gap * scale;
  });

  const vals = cursorStops
    .map((s) => `${round(x + promptW + s.i * chW)} 0`)
    .join(';');
  const kts = cursorStops.map((s) => round(Math.min(1, Math.max(0, s.t)))).join(';');

  return {
    width: promptW + Math.max(...phrases.map((p) => p.text.length)) * chW + chW * 2,
    body: `${text({ x, y, size, fill: promptColor, content: prompt, lock: promptW })}
<g>
${animT('translate', vals, `${cycle}s`, `calcMode="discrete" keyTimes="${kts}"`)}
  <g>
    ${anim('opacity', '1;1;0;0', '1s', 'calcMode="discrete"')}
    ${rect({ x: 0, y: cursorY - size * 0.82, w: chW * 0.92, h: size * 0.98, fill: C.neon, op: 0.9, extra: 'filter="url(#twGlow)"' })}
  </g>
</g>
${body.join('\n')}`,
  };
}

/* animated meters -----------------------------------------------------
 * label | bar | value%, all alignable so two columns line up perfectly
 * -------------------------------------------------------------------- */
export function meterRow({
  label, level, x, y, w, size = 15, labelW = 210, barW = null, begin = 0, delay = 0, rowH = 34, valueW = 62,
}) {
  const bw = barW || w - labelW - valueW;
  const fillW = (bw * level) / 100;
  const bx = x + labelW;
  const labelSize = Math.min(size, (labelW - 14) / (label.length * 0.6));
  const fillId = `bar-${label.replace(/[^a-z0-9]/gi, '')}-${Math.round(level)}-${Math.round(x)}`;
  const barY = y + size * 0.45;
  return `<g>
  ${text({ x, y: y + size * 0.9, size: round(labelSize), fill: C.textDim, content: label, op: 0, extra: appear(begin, 0.5) })}
  ${rect({ x: bx, y: barY, w: bw, h: 7, rx: 3.5, fill: '#072012', stroke: C.dim2, sw: 1, op: 0, extra: appear(begin, 0.5) })}
  ${rect({
    x: bx, y: barY, w: 0, h: 7, rx: 3.5, fill: `url(#${fillId})`, op: 0,
    extra: `${appear(begin + 0.1, 0.3)}` +
      `<animate attributeName="width" from="0" to="${round(fillW)}" begin="${begin + 0.15}s" dur="1.25s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.85 0.15 1" values="0;${round(fillW)}"/>`,
  })}
  <g opacity="0">${appear(begin + 1.3, 0.4)}
    <circle cx="${round(bx + fillW)}" cy="${round(barY + 3.5)}" r="3.2" fill="${C.neon}">
      ${anim('r', '3.2;4.9;3.2', '1.9s', `begin="${(begin + 1.6).toFixed(2)}s"`)}
      ${anim('opacity', '1;0.3;1', '1.9s', `begin="${(begin + 1.6).toFixed(2)}s"`)}
    </circle>
  </g>
  <g opacity="0">${appear(begin + 1.35, 0.4)}
    ${text({ x: x + w, y: y + size * 0.9, size: size - 1, fill: C.neon, content: `${level}%`, anchor: 'end' })}
  </g>
  <defs>
    ${lgrad(fillId, [[0, C.dim2], [0.3, C.neon], [0.7, C.neon2], [1, C.mint]])}
    ${lgrad(`shine-${fillId}`, [[0, C.mint, 0], [0.5, '#ffffff', 0.55], [1, C.mint, 0]], '0%', '0%', '100%', '0%')}
  </defs>
</g>`;
}

/* infinite marquee ---------------------------------------------------- */
export function marquee({ items, x, y, h = 40, size = 15, dir = -1, speed = 60, gap = 14, rowId, palette = [C.neon, C.mint, C.neon2] }) {
  const chW = cw(size);
  const pad = 16;
  const chips = items.map((it, i) => {
    const tw = it.length * chW;
    const w = tw + pad * 2 + 14;
    const color = palette[i % palette.length];
    return { w, svg: '', tw, color, label: it };
  });
  const total = chips.reduce((a, c) => a + c.w + gap, 0);
  const draw = (offset) => {
    let cx = 0;
    return chips
      .map((c) => {
        const px = offset + cx;
        const s = `<g transform="translate(${round(px)},0)">
  <rect x="0" y="0" width="${round(c.w)}" height="${h}" rx="${round(h / 2)}" fill="#04160d" stroke="${c.color}" stroke-width="1" opacity="0.95"/>
  <circle cx="${14}" cy="${h / 2}" r="3" fill="${c.color}">
    ${anim('opacity', '1;0.25;1', `${(1.4 + (px % 7) / 9).toFixed(2)}s`)}
  </circle>
  <text x="${pad + 10}" y="${round(h / 2 + size * 0.35)}" font-family="${MONO}" font-size="${size}" fill="${C.text}" textLength="${round(c.tw)}" lengthAdjust="spacingAndGlyphs">${esc(c.label)}</text>
</g>`;
        cx += c.w + gap;
        return s;
      })
      .join('\n');
  };

  const row1 = draw(0);
  const row2 = draw(total);
  const from = dir < 0 ? '0 0' : `${-total} 0`;
  const to = dir < 0 ? `${-total} 0` : '0 0';
  return {
    width: total,
    body: `<g transform="translate(${x},${y})">
  <g>
    ${animT('translate', `${from}; ${to}`, `${round(total / speed)}s`)}
    ${row1}
    ${row2}
  </g>
</g>`,
  };
}

/* CRT scanlines + travelling sweep ------------------------------------ */
export const scanlines = (id, w, h) => `
<pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse">
  <rect width="4" height="4" fill="none"/>
  <rect y="0" width="4" height="1.15" fill="#000" opacity="0.55"/>
</pattern>`;

export const sweep = (y, h, w, dur = 5, delay = 0) => `
<g opacity="0.5">
  ${animT('translate', `0 ${y}; 0 ${y + h}`, `${dur}s`, `begin="${delay}s"`)}
  ${rect({ x: 0, y: 0, w, h: 22, fill: 'url(#sweepG)' })}
</g>`;

export const SWEEP_GRAD = lgrad('sweepG', [[0, C.neon, 0], [0.5, C.mint, 0.22], [1, C.neon, 0]], '0%', '0%', '0%', '100%');

/* corner brackets HUD ------------------------------------------------- */
export const brackets = (x, y, w, h, len = 18, color = C.neon, sw = 2, op = 0.75) => {
  const p = (d) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="square" opacity="${op}"/>`;
  return `<g>${anim('opacity', `${op};0.25;${op}`, '3.6s')}
${p(`M${x} ${y + len} L${x} ${y} L${x + len} ${y}`)}
${p(`M${x + w - len} ${y} L${x + w} ${y} L${x + w} ${y + len}`)}
${p(`M${x + w} ${y + h - len} L${x + w} ${y + h} L${x + w - len} ${y + h}`)}
${p(`M${x + len} ${y + h} L${x} ${y + h} L${x} ${y + h - len}`)}
</g>`;
};

/* label helpers ------------------------------------------------------- */
export const sectionTag = (label, x, y, size = 13, color = C.neon) =>
  `<g>
  ${text({ x, y, size, fill: color, content: `[ ${label} ]`, weight: 600 })}
  ${rect({ x, y: y + 6, w: 0, h: 1, fill: color, op: 0.6, extra: `<animate attributeName="width" from="0" to="${label.length * cw(size) + 60}" begin="0.1s" dur="0.9s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.8 0.2 1" values="0;${label.length * cw(size) + 60}"/>` })}
</g>`;
