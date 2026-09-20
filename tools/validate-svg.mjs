/* ------------------------------------------------------------------
 *  validate-svg.mjs — sanity checks for the generated card:
 *    1. it must be well-formed XML (GitHub refuses anything else)
 *    2. every url(#id) must point at something that exists
 *  run:  node tools/validate-svg.mjs   (the build runs it too)
 * ------------------------------------------------------------------ */
import { readFileSync } from 'node:fs';
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
  if (missing.length) throw new Error(`${label} references undefined gradient/mask/clip ids: ${missing.join(', ')}`);

  const opens = (svgText.match(/<g[\s>]/g) || []).length;
  const closes = (svgText.match(/<\/g>/g) || []).length;
  if (opens !== closes) throw new Error(`${label}: unbalanced <g> (${opens} open / ${closes} close)`);

  return { defined: defined.size, used: used.size, groups: opens, bytes: Buffer.byteLength(svgText) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = new URL('../assets/card.svg', import.meta.url);
  const info = validateCard(readFileSync(file, 'utf8'));
  console.log(`✓ ${'assets/card.svg'} is valid — ${info.groups} groups, ${info.defined} ids, ${(info.bytes / 1024).toFixed(1)} KB`);
}
