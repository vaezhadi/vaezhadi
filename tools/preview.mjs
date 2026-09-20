/* ------------------------------------------------------------------
 *  preview.mjs — renders README.md the way GitHub will, on port 8080
 *  run:  npm run preview
 * ------------------------------------------------------------------ */
import { createServer } from 'node:http';
import { readFileSync, watch, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT || 8080);

marked.setOptions({ gfm: true, breaks: false });

const MIME = {
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.mp4': 'video/mp4',
};

const CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0; background: #0d1117; color: #c9d1d9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  font-size: 16px; line-height: 1.55;
}
.topbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 12px;
  padding: 10px 20px; background: #010409e6; border-bottom: 1px solid #21262d; backdrop-filter: blur(6px);
  font-size: 13px; color: #8b949e; }
.topbar b { color: #c9d1d9; font-weight: 600; }
.live { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; color: #3fb950; }
.live i { width: 8px; height: 8px; border-radius: 50%; background: #3fb950; animation: p 1.6s infinite; }
@keyframes p { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
.wrap { max-width: 1040px; margin: 0 auto; padding: 32px 24px 80px; }
.markdown-body { font-size: 16px; word-wrap: break-word; }
.markdown-body h1, .markdown-body h2 { border-bottom: 1px solid #21262d; padding-bottom: .3em; }
.markdown-body h1 { font-size: 2em; margin: .67em 0; }
.markdown-body h2 { font-size: 1.5em; margin-top: 1.6em; }
.markdown-body h3 { font-size: 1.25em; margin-top: 1.4em; }
.markdown-body a { color: #58a6ff; text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
.markdown-body code { background: #161b22; padding: .2em .4em; border-radius: 6px; font-size: 85%;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
.markdown-body pre { background: #161b22; padding: 16px; border-radius: 6px; overflow: auto; }
.markdown-body pre code { background: none; padding: 0; }
.markdown-body blockquote { margin: 0; padding: 0 1em; color: #8b949e; border-left: .25em solid #30363d; }
.markdown-body table { border-collapse: collapse; display: block; width: max-content; max-width: 100%; overflow: auto; }
.markdown-body table th, .markdown-body table td { padding: 6px 13px; border: 1px solid #30363d; }
.markdown-body table tr { background: #0d1117; }
.markdown-body table tr:nth-child(2n) { background: #161b22; }
.markdown-body img { max-width: 100%; }
.markdown-body hr { height: .25em; padding: 0; margin: 24px 0; background: #30363d; border: 0; }
.markdown-body p { margin-top: 0; margin-bottom: 16px; }
.markdown-body ul, .markdown-body ol { padding-left: 2em; margin-bottom: 16px; }
.markdown-body .center { text-align: center; }
.note { margin: 26px 0 0; padding: 10px 14px; border: 1px dashed #30363d; border-radius: 8px;
  color: #8b949e; font-size: 13px; }
`;

const page = (html) => `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>README preview — vaezhadi</title><style>${CSS}</style>
</head><body>
<div class="topbar"><b>Preview</b> github.com/vaezhadi — README.md <span class="live"><i></i>auto-reload</span></div>
<div class="wrap"><article class="markdown-body">${html}</article>
<p class="note">این پیش‌نمایش تقریبی از نمایش گیت‌هاب است. انیمیشن‌های SVG داخل تصاویر رندر می‌شوند؛
کارت‌های آماری و سایر سرویس‌ها فقط در گیت‌هاب نمایش داده می‌شوند (اینجا ممکن است لود نشوند).</p>
</div>
<script>
/* live reload */
const es = new EventSource('/__reload');
es.onmessage = () => location.reload();
</script>
</body></html>`;

let version = 0;
watch(resolve(ROOT, 'README.md'), { persistent: true }, () => { version++; });
try {
  watch(resolve(ROOT, 'assets'), { recursive: true, persistent: true }, (e, f) => {
    if (f && f.endsWith('.svg')) version++;
  });
} catch { /* recursive watch unsupported */ }

const clients = new Set();

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);

  if (url === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (url === '/' || url === '/index.html') {
    const md = readFileSync(join(ROOT, 'README.md'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(page(marked.parse(md)).replace('<head>', `<head><!-- v${version} -->`));
    return;
  }

  /* static files (assets/…, banner, etc.) */
  const safe = normalize(url).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, safe);
  const hidden = safe.split(/[/\\]/).some((seg) => seg.startsWith('.'));
  if (hidden || !file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(readFileSync(file));
}).listen(PORT, '0.0.0.0', () => {
  console.log(`▸ README preview on http://0.0.0.0:${PORT}`);
});

/* push reload events */
setInterval(() => {
  if (!clients.size) return;
  for (const c of clients) c.write(`data: ${version}\n\n`);
}, 800);
