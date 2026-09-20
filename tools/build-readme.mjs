/* ------------------------------------------------------------------
 *  build-readme.mjs — the README is just the card.
 *  Everything visible lives inside the generated SVGs, and a <picture>
 *  element lets GitHub pick the variant that matches the reader's theme.
 *
 *  run:  node tools/build-readme.mjs   (or: npm run readme)
 * ------------------------------------------------------------------ */
import { writeFileSync, readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('./profile.config.json', import.meta.url), 'utf8'));
const { identity } = cfg;
const V = '3';                     /* bump to bust GitHub's image cache */

const md = `<!-- ─────────────────────────────────────────────────────────────────────────
     ${identity.name} · profile card
     every word and pixel lives in assets/card-{dark,light}.svg, generated
     from tools/profile.config.json — edit that file, then run:
       cd tools && npm run build
     ───────────────────────────────────────────────────────────────────────── -->

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/card-dark.svg?v=${V}" />
  <source media="(prefers-color-scheme: light)" srcset="./assets/card-light.svg?v=${V}" />
  <img src="./assets/card-dark.svg?v=${V}" alt="${identity.name} — ${identity.role}. ${identity.tagline}" width="100%" />
</picture>

</div>
`;

writeFileSync(new URL('../README.md', import.meta.url), md);
console.log(`▸ README.md written (${(Buffer.byteLength(md) / 1024).toFixed(1)} KB)`);
