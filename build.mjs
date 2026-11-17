// Static site generator for Radioklub Karlovac.
// Reads content/novosti/*.md, regenerates:
//   - novosti/<slug>/index.html  (article pages)
//   - novosti/index.html         (news listing)
//   - index.html                 (homepage, latest 6 cards)
// Usage: node build.mjs
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import sharp from 'sharp';

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, 'content', 'novosti');
const HOMEPAGE_CARDS = 6;

marked.setOptions({ mangle: false, headerIds: false });

// ---------- helpers ----------
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');
}
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1).replace(/\\"/g, '"');
    }
    data[kv[1]] = v;
  }
  return { data, body: m[2] };
}

function formatDate(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}.` : String(iso);
}

function plainText(html) {
  const spaced = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|figcaption|blockquote|tr)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(spaced).replace(/\s+/g, ' ').trim();
}

function makeExcerpt(html, max = 180) {
  const text = plainText(html);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd() + '...';
}

// Rewrite "user/..." or "/user/..." asset paths to a given prefix
function rewriteAssets(html, prefix) {
  return html
    .replace(/(src|href)="(?:\.\.\/)*\/?user\//g, `$1="${prefix}user/`)
    .replace(/(src|href)="\/user\//g, `$1="${prefix}user/`);
}

// ---------- templates ----------
const header = (p) => `  <header class="site-header">
    <a class="brand" href="${p}">
      <span class="brand-mark">9A1CVW</span>
      <span class="brand-text">Radioklub Karlovac</span>
    </a>
    <nav class="site-nav" aria-label="Glavna navigacija">
      <a href="${p}">Na početak</a>
      <a href="${p}povijest-kluba/">Povijest kluba</a>
      <a href="${p}prostorije-kluba/">Prostorije Kluba</a>
      <a href="${p}galerija/">Galerija</a>
      <a href="${p}lorawan/">LoRaWAN</a>
      <a href="${p}novosti/">Novosti</a>
      <a href="${p}kontakt/">Kontakt</a>
    </nav>
  </header>`;

const footer = `  <footer class="site-footer">
    <div>
      <strong>9A1CVW</strong>
      <span>Radioklub Karlovac</span>
    </div>
    <p>Maksimilijana Vrhovca 15, Karlovac · 9a1cvw@hamradio.hr</p>
  </footer>`;

const articlePage = (post) => `<!doctype html>
<html lang="hr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(post.title)} - Radioklub Karlovac</title>
  <link rel="stylesheet" href="../../user/themes/radioklub/css/site.css">
  <script src="../../user/themes/radioklub/js/site.js" defer></script>
</head>
<body>
${header('../../')}
  <main>
    <article class="page-shell article">
  <p class="meta">${formatDate(post.date)}</p>
  <h1>${escapeHtml(post.title)}</h1>
${post.image ? `  <img class="article-cover" src="../../${post.image}" alt="">\n` : ''}${post.html}
</article>
  </main>
${footer}
</body>
</html>
`;

const card = (post, { assetPrefix, linkPrefix }) => `        <article class="post-card">
          <img src="${assetPrefix}${post.image}" alt="">
          <div>
            <p class="meta">${formatDate(post.date)}</p>
            <h2><a href="${linkPrefix}${post.slug}/">${escapeHtml(post.title)}</a></h2>
            <p>${escapeHtml(post.excerpt)}</p>
          </div>
        </article>`;

// Replace the inner content of <div class="CLASS"> ... matching </div>
function replaceDiv(html, className, inner) {
  const openTag = `<div class="${className}">`;
  const open = html.indexOf(openTag);
  if (open === -1) throw new Error(`${className} not found`);
  const start = open + openTag.length;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) {
      return html.slice(0, start) + '\n' + inner + '\n  ' + html.slice(m.index);
    }
  }
  throw new Error(`unclosed ${className}`);
}

// ---------- load posts ----------
const files = (await readdir(POSTS_DIR)).filter(f => f.endsWith('.md'));
const posts = [];

for (const file of files) {
  const raw = await readFile(path.join(POSTS_DIR, file), 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const slug = (data.slug || file.replace(/\.md$/, '')).trim();
  if (!data.title) throw new Error(`${file}: missing "title" in frontmatter`);
  if (!data.date) throw new Error(`${file}: missing "date" in frontmatter`);

  let html = await marked.parse(body);
  html = rewriteAssets(html, '../../');
  const image = (data.image || '').replace(/^(?:\.\.\/)+/, '').replace(/^\//, '');

  posts.push({
    slug,
    title: decodeEntities(data.title),
    date: String(data.date),
    image,
    excerpt: data.excerpt ? decodeEntities(data.excerpt) : makeExcerpt(html),
    html: html.trim(),
  });
}

posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

// ---------- write article pages ----------
for (const post of posts) {
  const dir = path.join(ROOT, 'novosti', post.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), articlePage(post), 'utf8');
}

// ---------- update novosti listing ----------
const listPath = path.join(ROOT, 'novosti', 'index.html');
const listHtml = await readFile(listPath, 'utf8');
const listCards = posts
  .map(p => card(p, { assetPrefix: '../', linkPrefix: './' }))
  .join('\n');
await writeFile(listPath, replaceDiv(listHtml, 'post-grid', listCards), 'utf8');

// ---------- update homepage ----------
const homePath = path.join(ROOT, 'index.html');
const homeHtml = await readFile(homePath, 'utf8');
const homeCards = posts
  .slice(0, HOMEPAGE_CARDS)
  .map(p => card(p, { assetPrefix: './', linkPrefix: './novosti/' }))
  .join('\n');
await writeFile(homePath, replaceDiv(homeHtml, 'post-grid', homeCards), 'utf8');

console.log(`Built ${posts.length} posts (homepage shows ${Math.min(posts.length, HOMEPAGE_CARDS)})`);
for (const p of posts) console.log(`  ${p.date}  ${p.slug}  — ${p.title}`);

// ================= galleries =================
const GALLERY_DIR = path.join(ROOT, 'content', 'galerija');
const THUMB_WIDTH = 800;

async function ensureThumb(srcRel, slug) {
  const srcAbs = path.join(ROOT, srcRel);
  const base = path.basename(srcRel, path.extname(srcRel));
  const outRel = `user/data/media/cache/gallery/${slug}/${base}.jpg`;
  const outAbs = path.join(ROOT, outRel);
  // In CI always regenerate: a fresh checkout gives every file the same mtime,
  // so a replaced photo would otherwise keep its old thumbnail.
  if (!process.env.CI) {
    try {
      const [srcStat, outStat] = await Promise.all([stat(srcAbs), stat(outAbs)]);
      if (outStat.mtimeMs >= srcStat.mtimeMs) return outRel;
    } catch { /* regenerate */ }
  }
  await mkdir(path.dirname(outAbs), { recursive: true });
  await sharp(srcAbs).rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 80, progressive: true })
    .toFile(outAbs);
  return outRel;
}

function galleryItems(body) {
  const items = [];
  const mdImg = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  let m;
  while ((m = mdImg.exec(body))) items.push({ caption: m[1].trim(), src: m[2].trim() });
  if (!items.length) {
    for (const line of body.split(/\r?\n/)) {
      const t = line.trim();
      if (/^(?:\.\.\/)*\/?user\/.+\.(jpe?g|png|webp)$/i.test(t)) items.push({ caption: '', src: t });
    }
  }
  return items.map(i => ({
    ...i,
    src: i.src.replace(/^(?:\.\.\/)+/, '').replace(/^\//, ''),
  }));
}

function pluralSlika(n) {
  const d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return `${n} slika`;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${n} slike`;
  return `${n} slika`;
}

const galleryFigure = (f) => `  <figure class="gallery-figure">
    <a href="../../${f.src}" data-lightbox-item data-caption="${escapeHtml(f.caption)}"><img src="../../${f.thumb}" alt="${escapeHtml(f.caption)}" loading="lazy"></a>
  </figure>`;

const galleryPage = (a) => `<!doctype html>
<html lang="hr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(a.title)} - Radioklub Karlovac</title>
  <link rel="stylesheet" href="../../user/themes/radioklub/css/site.css">
  <script src="../../user/themes/radioklub/js/site.js" defer></script>
</head>
<body>
${header('../../')}
  <main>
      <section class="page-shell gallery-page">
<p><a class="back-link" href="../">Natrag na galeriju</a></p>
<h1>${escapeHtml(a.title)}</h1>
${a.description ? `<p>${a.description}</p>\n` : ''}<div class="gallery-grid">
${a.figures}
</div>
</section>
  </main>
${footer}
</body>
</html>
`;

const albumCard = (a) => `<a class="gallery-card" href="./${a.slug}/">
  <img src="../${a.coverThumb}" alt="">
  <span>${escapeHtml(a.title)}</span>
  <small>${pluralSlika(a.count)}</small>
</a>`;

const galFiles = (await readdir(GALLERY_DIR)).filter(f => f.endsWith('.md'));
const albums = [];

for (const file of galFiles) {
  const raw = await readFile(path.join(GALLERY_DIR, file), 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const slug = (data.slug || file.replace(/\.md$/, '')).trim();
  if (!data.title) throw new Error(`${file}: missing "title" in frontmatter`);
  if (!data.date) throw new Error(`${file}: missing "date" in frontmatter`);

  const items = galleryItems(body);
  if (!items.length) throw new Error(`${file}: no images found in body`);

  const figures = [];
  for (const item of items) {
    const thumb = await ensureThumb(item.src, slug);
    figures.push(galleryFigure({ ...item, thumb }));
  }

  const coverRel = (data.cover || items[0].src)
    .replace(/^(?:\.\.\/)+/, '').replace(/^\//, '');
  const coverThumb = await ensureThumb(coverRel, slug);

  albums.push({
    slug,
    title: decodeEntities(data.title),
    date: String(data.date),
    description: data.description || '',
    count: items.length,
    figures: figures.join('\n'),
    coverThumb,
  });
}

albums.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

for (const album of albums) {
  const dir = path.join(ROOT, 'galerija', album.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), galleryPage(album), 'utf8');
}

const galIndexPath = path.join(ROOT, 'galerija', 'index.html');
const galHtml = await readFile(galIndexPath, 'utf8');
const galCards = albums.map(albumCard).join('\n');
await writeFile(galIndexPath, replaceDiv(galHtml, 'gallery-album-grid', galCards), 'utf8');

console.log(`\nBuilt ${albums.length} gallery albums`);
for (const a of albums) console.log(`  ${a.date}  ${String(a.count).padStart(2)} img  ${a.slug}`);
