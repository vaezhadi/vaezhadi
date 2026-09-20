/* ------------------------------------------------------------------
 *  build-site.mjs — builds docs/index.html: a real, self-contained page
 *  (HTML + CSS + JS) that GitHub Pages serves. Here animation has no
 *  limits: real typewriters, scroll reveals, hover physics, ripples.
 *
 *  run:  node tools/build-site.mjs
 * ------------------------------------------------------------------ */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { brand, slugFor } from './icons.mjs';
import { esc } from './svg-lib.mjs';

const cfg = JSON.parse(readFileSync(new URL('./profile.config.json', import.meta.url), 'utf8'));
const { identity, skills, quote } = cfg;
const langs = (skills || []).map((s) => (typeof s === 'string' ? s : s.name));

/* ---------- language tiles -------------------------------------------------- */
const tiles = langs
  .map((name) => {
    const slug = slugFor(name);
    const icon = slug ? brand(slug, { tint: 0.18 }) : null;
    const glyph = icon
      ? `<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="${icon.path}" fill="${icon.color}"/></svg>`
      : `<span class="tile__fallback">${esc(name.slice(0, 3))}</span>`;
    return `      <li class="tile" style="--brand:${icon ? icon.color : '#8b949e'}">
        <span class="tile__icon">${glyph}</span>
        <span class="tile__name">${esc(name)}</span>
      </li>`;
  })
  .join('\n');

const headline = identity.tagline;
const aboutText = identity.about;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(identity.name)} — ${esc(identity.role)}</title>
<meta name="description" content="${esc(aboutText)}" />
<meta name="theme-color" content="#000000" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23000'/><circle cx='16' cy='16' r='6' fill='%233fb950'/></svg>" />
<style>
/* ─── tokens ─────────────────────────────────────────────────────────────── */
:root {
  --bg: #000;
  --card: #050706;
  --text: #e6edf3;
  --muted: #8b949e;
  --dim: #6e7681;
  --accent: #3fb950;
  --accent-soft: #56d364;
  --hair: #1f2a24;
  --track: #161c19;
  --sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html { color-scheme: dark; scroll-behavior: smooth; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font-family: var(--sans); font-size: 16px; line-height: 1.6;
  -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
::selection { background: rgba(63, 185, 80, .28); }

/* ─── ambience: two slow auroras + a faint grid ──────────────────────────── */
.ambience { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
.aurora {
  position: absolute; width: 78vmax; height: 78vmax; border-radius: 50%;
  filter: blur(90px); opacity: .28; will-change: transform;
}
.aurora--a { background: radial-gradient(circle at 50% 50%, #2ea043 0%, rgba(46,160,67,0) 62%); top: -34vmax; left: -14vmax; animation: drift 26s ease-in-out infinite alternate; }
.aurora--b { background: radial-gradient(circle at 50% 50%, #1f6feb 0%, rgba(31,111,235,0) 62%); bottom: -40vmax; right: -18vmax; opacity: .12; animation: drift 34s ease-in-out infinite alternate-reverse; }
.grid {
  position: absolute; inset: -1px; opacity: .16;
  background-image: linear-gradient(var(--hair) 1px, transparent 1px), linear-gradient(90deg, var(--hair) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(120% 80% at 50% 0%, #000 0%, transparent 72%);
}
@keyframes drift {
  from { transform: translate3d(0,0,0) scale(1); }
  to   { transform: translate3d(4vmax, 3vmax, 0) scale(1.12); }
}
/* spotlight that follows the pointer */
.spotlight {
  position: fixed; width: 520px; height: 520px; border-radius: 50%; pointer-events: none; z-index: 1;
  background: radial-gradient(circle, rgba(63,185,80,.10) 0%, rgba(63,185,80,0) 62%);
  transform: translate3d(-50%, -50%, 0); transition: opacity .4s ease; opacity: 0;
}

/* ─── shell ─────────────────────────────────────────────────────────────── */
.shell { position: relative; z-index: 2; max-width: 880px; margin: 0 auto; padding: 0 28px 96px; }
.progress { position: fixed; top: 0; left: 0; height: 2px; width: 0; z-index: 5;
  background: linear-gradient(90deg, var(--accent), var(--accent-soft)); box-shadow: 0 0 18px rgba(63,185,80,.65); }

/* ─── hero ──────────────────────────────────────────────────────────────── */
.hero { padding: 22vh 0 12vh; }
.eyebrow {
  display: inline-flex; align-items: center; gap: 9px; margin: 0 0 22px;
  font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--accent);
}
.eyebrow i { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 12px var(--accent); animation: pulse 2.4s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .3; transform: scale(.7); } }
h1 { margin: 0; font-size: clamp(38px, 7vw, 68px); font-weight: 650; letter-spacing: -.02em; line-height: 1.03; }
.role { margin: 14px 0 34px; font-size: 14px; letter-spacing: .34em; text-transform: uppercase; color: var(--accent); }
.typed { min-height: 2.2em; font-family: var(--mono); font-size: clamp(15px, 2.4vw, 20px); color: var(--text); }
.caret { display: inline-block; width: .58ch; height: 1.05em; margin-left: 2px; background: var(--accent); vertical-align: -.15em; animation: blink 1.05s steps(1) infinite; }
@keyframes blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }

/* ─── sections ──────────────────────────────────────────────────────────── */
section { padding: 56px 0; border-top: 1px solid var(--hair); }
.label { margin: 0 0 20px; font-size: 11.5px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: var(--accent); }
p.body { margin: 0; max-width: 62ch; color: var(--muted); font-size: 16.5px; }
.quote { margin: 30px 0 0; color: var(--dim); font-style: italic; font-size: 15px; }

/* tiles */
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); gap: 14px; margin: 0; padding: 0; list-style: none; }
.tile {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 20px 10px 16px; border: 1px solid var(--hair); border-radius: 18px; background: var(--track);
  overflow: hidden; transition: transform .35s cubic-bezier(.2,.7,.2,1), border-color .35s, box-shadow .35s, background .35s;
}
.tile::after { /* brand glow that follows the cursor inside the tile */
  content: ""; position: absolute; inset: 0; opacity: 0; transition: opacity .4s ease;
  background: radial-gradient(140px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--brand) 26%, transparent), transparent 68%);
}
.tile:hover { transform: translateY(-6px); border-color: color-mix(in srgb, var(--brand) 55%, var(--hair)); box-shadow: 0 18px 40px -22px color-mix(in srgb, var(--brand) 70%, transparent); }
.tile:hover::after { opacity: 1; }
.tile__icon { position: relative; z-index: 1; display: grid; place-items: center; width: 44px; height: 44px; transition: transform .45s cubic-bezier(.2,.7,.2,1); }
.tile:hover .tile__icon { transform: translateY(-2px) scale(1.12) rotate(-3deg); }
.tile__name { position: relative; z-index: 1; font-size: 12.5px; color: var(--muted); transition: color .3s; }
.tile:hover .tile__name { color: var(--text); }
.tile__fallback { font-weight: 700; color: var(--muted); }

/* footer */
footer { padding-top: 50px; border-top: 1px solid var(--hair); display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; justify-content: space-between; color: var(--dim); font-size: 13px; }
.cta { font-size: 19px; font-weight: 600; color: var(--text); letter-spacing: -.01em; }
.handle { display: inline-flex; align-items: center; gap: 9px; }
.handle i { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); animation: pulse 2.4s ease-in-out infinite; }

/* reveal-on-scroll */
[data-reveal] { opacity: 0; transform: translateY(22px); transition: opacity .9s cubic-bezier(.2,.7,.2,1), transform .9s cubic-bezier(.2,.7,.2,1); }
[data-reveal].in { opacity: 1; transform: none; }

/* click ripple — a small piece of UI wit */
.ripple { position: fixed; z-index: 4; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%;
  border: 1.5px solid var(--accent); pointer-events: none; animation: ripple .7s ease-out forwards; }
@keyframes ripple { from { transform: scale(1); opacity: .9; } to { transform: scale(14); opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
  [data-reveal] { opacity: 1; transform: none; }
  .aurora { animation: none; }
}
</style>
</head>
<body>

<div class="ambience">
  <div class="aurora aurora--a"></div>
  <div class="aurora aurora--b"></div>
  <div class="grid"></div>
</div>
<div class="spotlight" id="spotlight"></div>
<div class="progress" id="progress"></div>

<main class="shell">

  <header class="hero">
    <p class="eyebrow"><i></i> available for ${esc(identity.availableFor)}</p>
    <h1>${esc(identity.name)}</h1>
    <p class="role">${esc(identity.role)}</p>
    <p class="typed"><span id="typed"></span><span class="caret" aria-hidden="true"></span></p>
  </header>

  <section data-reveal>
    <p class="label">About</p>
    <p class="body">${esc(aboutText)}</p>
    ${quote ? `<p class="quote">“${esc(quote)}”</p>` : ''}
  </section>

  <section data-reveal>
    <p class="label">Stack</p>
    <ul class="tiles">
${tiles}
    </ul>
  </section>

  <footer>
    <p class="cta">${esc(cfg.footer?.headline || 'Let’s build something.')}</p>
    <p class="handle"><i></i> @${esc(identity.handle)} · ${esc(identity.location)}</p>
  </footer>

</main>

<script>
/* ─── typewriter: types, holds, deletes, moves to the next line ─────────── */
(() => {
  const target = document.getElementById('typed');
  const lines = ${JSON.stringify([headline])};
  const TYPE = 42, ERASE = 22, HOLD = 2400, GAP = 420;
  let line = 0, char = 0, erasing = false;

  const tick = () => {
    const text = lines[line];
    if (!erasing) {
      char++;
      target.textContent = text.slice(0, char);
      if (char === text.length) { erasing = true; return setTimeout(tick, HOLD); }
      return setTimeout(tick, TYPE + Math.random() * 26);
    }
    char--;
    target.textContent = text.slice(0, char);
    if (char === 0) { erasing = false; line = (line + 1) % lines.length; return setTimeout(tick, GAP); }
    setTimeout(tick, ERASE);
  };
  setTimeout(tick, 600);
})();

/* ─── reveal on scroll ──────────────────────────────────────────────────── */
(() => {
  const items = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (!e.isIntersecting) return;
      setTimeout(() => e.target.classList.add('in'), i * 90);
      io.unobserve(e.target);
    });
  }, { threshold: .18 });
  items.forEach((el) => io.observe(el));
})();

/* ─── spotlight that trails the pointer ─────────────────────────────────── */
(() => {
  const spot = document.getElementById('spotlight');
  let x = innerWidth / 2, y = innerHeight / 3, tx = x, ty = y, raf;
  addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; spot.style.opacity = 1; });
  addEventListener('pointerleave', () => { spot.style.opacity = 0; });
  const loop = () => { x += (tx - x) * .07; y += (ty - y) * .07; spot.style.transform = \`translate3d(\${x}px, \${y}px, 0) translate(-50%, -50%)\`; raf = requestAnimationFrame(loop); };
  loop();
})();

/* ─── tiles: keep the brand glow under the cursor ───────────────────────── */
document.querySelectorAll('.tile').forEach((tile) => {
  tile.addEventListener('pointermove', (e) => {
    const r = tile.getBoundingClientRect();
    tile.style.setProperty('--mx', \`\${e.clientX - r.left}px\`);
    tile.style.setProperty('--my', \`\${e.clientY - r.top}px\`);
  });
});

/* ─── scroll progress ───────────────────────────────────────────────────── */
(() => {
  const bar = document.getElementById('progress');
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + '%';
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ─── click ripple ──────────────────────────────────────────────────────── */
addEventListener('pointerdown', (e) => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = document.createElement('span');
  r.className = 'ripple';
  r.style.left = e.clientX + 'px';
  r.style.top = e.clientY + 'px';
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 720);
});
</script>
</body>
</html>
`;

mkdirSync(new URL('../docs', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/index.html', import.meta.url), html);
console.log(`▸ docs/index.html written (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
console.log(`  page: name, role, typed headline, about, ${langs.length} brand-icon tiles, footer`);
