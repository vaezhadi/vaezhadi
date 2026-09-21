/* ------------------------------------------------------------------
 *  validate-svg.mjs — sanity checks for the generated cards:
 *    1. well-formed XML (GitHub refuses anything else)
 *    2. every url(#id) points at something that exists
 *    3. balanced <g> groups
 *  run:  node tools/validate-svg.mjs   (the build runs it too)
 * ------------------------------------------------------------------ */
import { readFileSync, existsSync } from 'node:fs';
import { XMLValidator } from 'fast-xml-parser';

export function validateCard(svgText, label = 'card.svg') {
  const verdict = XMLValidator.validate(svgText);
  if (verdict !== true) {
    const { err } = verdict;
    throw new Error(`${label} is not well-formed XML (line ${err.line}, col ${err.col}: ${err.msg})`);
  }

  const defined = new Set([...svgText.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const used = new Set([...svgText.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]));
  const missing = [...used].filter((id) => !defined.has(id));
  if (missing.length) throw new Error(`${label} references undefined ids: ${missing.join(', ')}`);

  const opens = (svgText.match(/<g[\s>]/g) || []).length;
  const closes = (svgText.match(/<\/g>/g) || []).length;
  if (opens !== closes) throw new Error(`${label}: unbalanced <g> (${opens} open / ${closes} close)`);

  return { defined: defined.size, used: used.size, groups: opens, bytes: Buffer.byteLength(svgText) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = ['assets/card-dark.svg'];
  let bad = 0;
  for (const rel of files) {
    const url = new URL(`../${rel}`, import.meta.url);
    if (!existsSync(url)) { console.log(`· ${rel} — not built yet`); continue; }
    const info = validateCard(readFileSync(url, 'utf8'), rel);
    console.log(`✓ ${rel} — ${info.groups} groups, ${info.defined} ids, ${(info.bytes / 1024).toFixed(1)} KB`);
  }
  process.exit(bad);
}
