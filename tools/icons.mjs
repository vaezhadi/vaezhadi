/* ------------------------------------------------------------------
 *  icons.mjs — real brand glyphs, pulled from simple-icons (CC0) at
 *  build time and re-tinted so they sit inside the black/green theme.
 * ------------------------------------------------------------------ */
import * as si from 'simple-icons';

/* nudge a brand colour towards white (amount > 0) or black (amount < 0)
   so it keeps contrast on the theme's background */
const adjust = (hex, amount = 0.32) => {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const target = amount >= 0 ? 255 : 0;
  const k = Math.abs(amount);
  const mix = (c) => Math.round(c + (target - c) * k);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

/* kept for backwards compatibility with earlier call sites */
const lighten = (hex, amount = 0.32) => adjust(hex, amount);

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
    color: adjust(`#${icon.hex}`, tint),
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
