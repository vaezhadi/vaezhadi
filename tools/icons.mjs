/* ------------------------------------------------------------------
 *  icons.mjs — real brand glyphs, pulled from simple-icons (CC0) at
 *  build time and re-tinted so they sit inside the black/green theme.
 * ------------------------------------------------------------------ */
import * as si from 'simple-icons';

/* how far to push a brand colour towards white so it stays readable
   on a near-black background */
const lighten = (hex, amount = 0.32) => {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

/* simple-icons does not export the raw paths as named exports, so read
   the module table and index it by slug */
const bySlug = {};
for (const [key, value] of Object.entries(si)) {
  if (value && typeof value === 'object' && value.slug) bySlug[value.slug] = value;
}

export function brand(slug, { tint = 0.32 } = {}) {
  const icon = bySlug[slug];
  if (!icon) throw new Error(`simple-icons: unknown slug "${slug}"`);
  return {
    title: icon.title,
    path: icon.path,
    hex: `#${icon.hex}`,
    color: lighten(`#${icon.hex}`, tint),
  };
}

/* the icon set used by the profile, keyed by the names in profile.config.json */
export const LANG_SLUGS = {
  flutter: 'flutter',
  dart: 'dart',
  python: 'python',
  javascript: 'javascript',
  go: 'go',
  cpp: 'cplusplus',
  'c++': 'cplusplus',
};

export const slugFor = (name) => LANG_SLUGS[String(name).trim().toLowerCase()] || null;
