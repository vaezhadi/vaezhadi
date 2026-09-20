/* ------------------------------------------------------------------
 *  build-readme.mjs — writes README.md from profile.config.json
 *  run:  node tools/build-readme.mjs   (or: npm run build)
 * ------------------------------------------------------------------ */
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cfg = JSON.parse(readFileSync(new URL('./profile.config.json', import.meta.url), 'utf8'));
const { identity, status, stack, skills, socials, projects, funFacts } = cfg;
const U = identity.handle;
const OUT = new URL('../README.md', import.meta.url);

/* ---------- theme tokens (keep in sync with svg-lib.mjs) ---------- */
const T = {
  stats: 'bg_color=00000000&title_color=00ff41&text_color=c9ffdd&icon_color=00ff41&border_color=0d3a22',
  streak: 'theme=dark&hide_border=true&background=00000000&ring=00ff41&fire=00ff41&currStreakLabel=00ff41&sideLabels=c9ffdd&dates=5fbf85&currStreakNum=7dffb0&sideNums=c9ffdd&stroke=0d3a22',
  activity: 'bg_color=00000000&color=7dffb0&line=00ff41&point=ffffff&area=true&area_color=1d6b41&hide_border=true&title_color=00ff41',
};

const img = (src, alt, extra = '') => `<img src="${src}" alt="${alt}"${extra ? ' ' + extra : ''} />`;

const badge = (label, message, color, logo, url) => {
  const b = img(
    `https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(message)}-${color}?style=for-the-badge&labelColor=0d1117&logo=${logo}&logoColor=${color}`,
    label
  );
  return url ? `<a href="${url}" target="_blank">${b}</a>` : b;
};

/* ---------- sections ------------------------------------------------- */
const hero = `<div align="center">

${img('./assets/banner.jpg', 'night shift — the screen never sleeps', 'width="100%"')}

${img('./assets/hero.svg', `${identity.name} — ${identity.role}`, 'width="100%"')}

</div>`;

const socialRow = (() => {
  const shown = socials.filter((s) => s.show && s.url);
  if (!shown.length) return '';
  const items = shown.map((s) => badge(s.label, s.label.toUpperCase(), s.color, s.icon, s.url));
  items.push(
    img(`https://komarev.com/ghpvc/?username=${U}&label=PROFILE+VIEWS&color=00ff41&style=for-the-badge&labelColor=0d1117`, 'profile views')
  );
  items.push(
    `<a href="https://github.com/${U}?tab=followers" target="_blank">${img(`https://img.shields.io/github/followers/${U}?style=for-the-badge&label=FOLLOWERS&color=00ff41&labelColor=0d1117&logo=github&logoColor=00ff41`, 'followers')}</a>`
  );
  return `<div align="center">

${items.join('\n')}

</div>`;
})();

const about = (() => {
  const rows = [
    ['🖥️ &nbsp;Role', `${identity.role} · Mobile Engineer`],
    ['📍 &nbsp;Based in', `${identity.location} · ${identity.timezone}`],
    ['🧠 &nbsp;Currently building', status.building],
    ['📚 &nbsp;Currently learning', status.learning],
    ['🧰 &nbsp;Daily drivers', stack.primary.slice(0, 4).join(' · ')],
    ['🤝 &nbsp;Open to', identity.availableFor + (identity.openToWork ? ' ✅' : '')],
  ];
  const table = rows.map(([k, v]) => `| ${k} | ${v} |`).join('\n');
  return `## ⚡ About

<table>
<tr>
<td width="230" align="center" valign="top">
${img('./assets/id-plate.svg', 'vaezhadi', 'width="210"')}
</td>
<td valign="top">

| | |
|:--|:--|
${table}

> ${identity.tagline}

</td>
</tr>
</table>`;
})();

const liveNow = `## 📡 Live now

${img('./assets/live-now.svg', 'live status', 'width="100%"')}`;

const boot = `## 🖥️ Boot sequence

${img('./assets/terminal.svg', `${identity.handle} — profile boot log`, 'width="100%"')}`;

const stackSection = `## 🧬 Stack

${img('./assets/stack.svg', 'tech stack', 'width="100%"')}`;

const skillsSection = `## 📊 Skills

${img('./assets/skills.svg', 'skills', 'width="100%"')}`;

const projectsSection = (() => {
  if (!projects.length) return '';
  const cards = projects
    .map(
      (p) => `<a href="${p.url}" target="_blank">
  <img src="https://github-readme-stats.vercel.app/api/pin/?username=${U}&repo=${p.name}&${T.stats}&show_owner=false" alt="${p.name}" />
</a>`
    )
    .join('\n');
  const rows = projects
    .map((p) => `| **[${p.name}](${p.url})** | ${p.desc} | \`${p.tech}\` | \`${p.status}\` |`)
    .join('\n');
  return `## 🚀 Projects

<div align="center">
${cards}
</div>

| Project | What it is | Stack | Status |
|:--|:--|:--|:--|
${rows}`;
})();

const statsSection = `## 📈 GitHub telemetry

<div align="center">

${img(`https://github-readme-stats.vercel.app/api?username=${U}&show_icons=true&${T.stats}&include_all_commits=true&count_private=true&rank_icon=github&hide_rank=false`, 'github stats')}
${img(`https://streak-stats.demolab.com?user=${U}&${T.streak}`, 'streak')}

${img(`https://github-readme-stats.vercel.app/api/top-langs/?username=${U}&layout=compact&${T.stats}&langs_count=8&card_width=400`, 'top languages')}
${img(`https://github-profile-trophy.vercel.app/?username=${U}&column=4&margin-w=8&margin-h=8&no-frame=true&no-bg=true&theme=matrix&row=1`, 'trophies')}

${img(`https://github-readme-activity-graph.vercel.app/graph?username=${U}&${T.activity}&custom_title=${encodeURIComponent('Contribution activity')}`, 'activity graph', 'width="100%"')}

</div>`;

const snakeSection = `## 🌐 Contribution skyline

<div align="center">

${img('./profile-3d-contrib/profile-night-green.svg', '3D contribution graph', 'width="100%"')}

</div>

## 🐍 Contribution grid, but it plays snake

<div align="center">

${img('./assets/generated/snake.svg', 'contribution snake', 'width="100%"')}

</div>`;

const quoteSection = (() => {
  const facts = funFacts && funFacts.length
    ? `\n<details>\n<summary>⚡ &nbsp;Random facts</summary>\n\n${funFacts.map((f) => `- ${f}`).join('\n')}\n\n</details>\n`
    : '';
  return `## 💬 One line I live by

<div align="center">

> **${cfg.quote}**

</div>
${facts}`;
})();

const footer = `<div align="center">

${img('./assets/footer.svg', 'call to action', 'width="100%"')}

</div>`;

/* ---------- assemble ------------------------------------------------- */
const body = [
  hero + (socialRow ? '\n\n' + socialRow : ''),
  about,
  liveNow,
  boot,
  stackSection,
  skillsSection,
  projectsSection,
  statsSection,
  snakeSection,
  quoteSection,
  footer,
].filter(Boolean);

const md = `<!-- ═══════════════════════════════════════════════════════════════════════════
     ${identity.name} — profile README
     generated from tools/profile.config.json  ·  rebuild: cd tools && npm run build
     ═══════════════════════════════════════════════════════════════════════════ -->

${body.join('\n\n')}

<div align="center">

<sub>built in the dark, with ❤️ and too much ☕ — see you in the commits</sub>

</div>
`;

writeFileSync(OUT, md);
console.log(`▸ README.md written (${(Buffer.byteLength(md) / 1024).toFixed(1)} KB)`);
