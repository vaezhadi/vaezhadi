/* ------------------------------------------------------------------
 *  build-readme.mjs — the README is just the card.
 *  Everything visible lives inside assets/card-dark.svg; there is no light
 *  variant any more, so a plain <img> is all this needs.
 *
 *  run:  node tools/build-readme.mjs   (or: npm run readme)
 * ------------------------------------------------------------------ */
import { writeFileSync, readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('./profile.config.json', import.meta.url), 'utf8'));
const { identity } = cfg;
const V = '7';                     /* bump to bust GitHub's image cache */

const md = `<!-- ─────────────────────────────────────────────────────────────────────────
     ${identity.name} · profile card
     every word and pixel lives in assets/card-dark.svg, generated
     from tools/profile.config.json — edit that file, then run:
       cd tools && npm run build
     ───────────────────────────────────────────────────────────────────────── -->

<div align="center">

<img src="./assets/card-dark.svg?v=${V}" alt="${identity.name} — ${identity.role}. ${identity.tagline}" width="100%" />

</div>
`;

writeFileSync(new URL('../README.md', import.meta.url), md);
console.log(`▸ README.md written (${(Buffer.byteLength(md) / 1024).toFixed(1)} KB)`);
