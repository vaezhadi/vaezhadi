/* ------------------------------------------------------------------
 *  build-readme.mjs — writes README.md from profile.config.json
 *  run:  node tools/build-readme.mjs   (or: npm run readme)
 * ------------------------------------------------------------------ */
import { writeFileSync, readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('./profile.config.json', import.meta.url), 'utf8'));
const { identity, socials, stack, projects, quote } = cfg;
const U = identity.handle;

/* ---------- palette-matched query strings for the stat services ---------- */
const stats = `bg_color=00000000&title_color=3fb950&text_color=e6edf3&icon_color=3fb950&border_color=1f2a24&hide_border=true`;

const img = (src, alt, extra = '') => `<img src="${src}" alt="${alt}"${extra ? ' ' + extra : ''} />`;

const DIVIDER = `<div align="center">\n${img('./assets/divider.svg', '', 'width="100%"')}\n</div>`;

/* ---------- hero + contact row ---------- */
const hero = `<div align="center">

${img('./assets/hero.svg', `${identity.name} — ${identity.role}`, 'width="100%"')}

</div>`;

const contacts = (() => {
  const shown = socials.filter((s) => s.show && s.url);
  const links = shown.map((s) => {
    const label = s.label === 'Email' ? identity.email || s.label : s.label;
    return `[${label}](${s.url})`;
  });
  if (!links.length) return '';
  return `<p align="center">${links.join(' &nbsp;·&nbsp; ')}</p>`;
})();

/* ---------- about ---------- */
const about = `## About

${identity.about || `${identity.name} — ${identity.role.toLowerCase()} based in ${identity.location} (${identity.timezone}). I care about clean architecture, fast interfaces and shipping things that actually get used.`}

Currently building with **${stack.primary.slice(0, 3).join('**, **')}**  ·  learning ${stack.learning.slice(0, 3).join(', ')}  ·  open to ${identity.availableFor.toLowerCase()}.

${quote ? `<br />\n\n<div align="center"><em>${quote}</em></div>` : ''}`;

/* ---------- skills ---------- */
const skillsSection = `## Skills

<div align="center">

${img('./assets/skills.svg', 'skills', 'width="100%"')}

</div>`;

/* ---------- projects ---------- */
const projectsSection = (() => {
  if (!projects.length) return '';
  const rows = projects
    .map((p) => `| **[${p.name}](${p.url})** | ${p.desc} | \`${p.tech}\` |`)
    .join('\n');
  return `## Projects

| Project | Description | Built with |
|:--|:--|:--|
${rows}`;
})();

/* ---------- github ---------- */
const githubSection = `## GitHub

<div align="center">

${img(`https://github-readme-stats.vercel.app/api?username=${U}&show_icons=true&${stats}&include_all_commits=true&count_private=true&rank_icon=github`, 'GitHub stats')}
${img(`https://github-readme-stats.vercel.app/api/top-langs/?username=${U}&layout=compact&${stats}&langs_count=8&card_width=340`, 'Most used languages')}

</div>`;

/* ---------- footer ---------- */
const footer = `<div align="center">

${img('./assets/footer.svg', `Contact — ${identity.email || identity.handle}`, 'width="100%"')}

</div>`;

const md = `<!-- ─────────────────────────────────────────────────────────────────────────
     ${identity.name} · profile README
     generated from tools/profile.config.json — edit that file, then run:
       cd tools && npm run build
     ───────────────────────────────────────────────────────────────────────── -->

${[hero, contacts, about, DIVIDER, skillsSection, projectsSection, DIVIDER, githubSection, footer]
  .filter(Boolean)
  .join('\n\n')}
`;

writeFileSync(new URL('../README.md', import.meta.url), md);
console.log(`▸ README.md written (${(Buffer.byteLength(md) / 1024).toFixed(1)} KB)`);
