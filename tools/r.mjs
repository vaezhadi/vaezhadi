import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
const f = process.argv[2];
const flat = readFileSync(f, 'utf8')
  .replace(/<animateTransform[^>]*>/g, '')
  .replace(/<animate[^>]*>/g, '')
  .replace(/(?<!stop-)opacity="0"/g, 'opacity="1"');
try {
  const png = new Resvg(flat, { fitTo: { mode: 'zoom', value: 1 } }).render().asPng();
  writeFileSync(f.replace('.svg', '.png').replace('/assets/', '/tools/.preview/'), png);
  console.log('OK', f);
} catch (e) { console.log('FAIL', f, e.message); }
