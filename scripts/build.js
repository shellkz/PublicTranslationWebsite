'use strict';

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');
const { renderLayout } = require('./templates/layout');
const { renderHomepage } = require('./templates/homepage');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const ASSETS_DIR = path.join(ROOT, 'assets');
const OUT_DIR = path.join(ROOT, 'dist');

const md = new MarkdownIt({ html: false, linkify: true });

// 全站譯文授權固定,不是逐篇 frontmatter 欄位——見 /LICENSE、/CONTRIBUTING.md
const SITE_LICENSE = 'CC BY-SA 4.0';

// ---------- small helpers ----------

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function readDescription(dir) {
  const file = path.join(dir, 'description.md');
  if (!fs.existsSync(file)) return {};
  const parsed = matter(fs.readFileSync(file, 'utf8'));
  return parsed.data || {};
}

function pickLocalized(value, fallbackKeyOrder = ['zh', 'romaji', 'ja', 'en']) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  for (const key of fallbackKeyOrder) {
    if (value[key]) return value[key];
  }
  const firstKey = Object.keys(value)[0];
  return firstKey ? value[firstKey] : null;
}

// gray-matter (js-yaml) auto-parses YYYY-MM-DD strings into Date objects;
// normalize back to plain date strings so rendering is consistent everywhere.
function toPlainDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

function extractUuid(filename) {
  const match = filename.match(UUID_RE);
  if (!match) {
    throw new Error(`檔名「${filename}」找不到符合格式的 UUID 段,無法作為身分識別碼`);
  }
  return match[0];
}

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeHtml(outPath, html) {
  ensureDirFor(outPath);
  fs.writeFileSync(outPath, html, 'utf8');
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function layout({ title, body, canonical }) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">\n` : ''}<style>
  body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.7; }
  nav a { margin-right: .75rem; }
  .meta { color: #555; font-size: .9rem; }
  ul.list { list-style: none; padding: 0; }
  ul.list li { margin-bottom: .75rem; }
  hr { margin: 2rem 0; }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

// ---------- load registries ----------

function loadRegistry(subdir) {
  const dir = path.join(CONTENT_DIR, subdir);
  const map = {};
  for (const id of listDirs(dir)) {
    const data = { id, ...readDescription(path.join(dir, id)) };
    if (Array.isArray(data.editions)) {
      data.editions = data.editions.map((e) => ({ ...e, date: toPlainDate(e.date) }));
    }
    map[id] = data;
  }
  return map;
}

function loadTranslations() {
  const translatorsDir = path.join(CONTENT_DIR, 'translators');
  const translations = [];
  for (const translatorId of listDirs(translatorsDir)) {
    const translatorDir = path.join(translatorsDir, translatorId);
    const files = fs
      .readdirSync(translatorDir)
      .filter((f) => f.endsWith('.md') && f !== 'description.md');
    for (const filename of files) {
      const fullPath = path.join(translatorDir, filename);
      const parsed = matter(fs.readFileSync(fullPath, 'utf8'));
      const uuid = extractUuid(filename);
      const frontmatter = parsed.data || {};
      frontmatter.date = toPlainDate(frontmatter.date);
      translations.push({
        uuid,
        filename,
        translatorId,
        frontmatter,
        bodyMarkdown: parsed.content || '',
        sourcePath: path.relative(ROOT, fullPath),
      });
    }
  }
  return translations;
}

// ---------- resolve references ----------

function resolveAll() {
  const works = loadRegistry('works');
  const sourceAuthors = loadRegistry('source-authors');
  const sourceTranslators = loadRegistry('source-translators');
  const translators = loadRegistry('translators');
  const translations = loadTranslations();

  const errors = [];

  for (const t of translations) {
    const fm = t.frontmatter;

    const work = works[fm.work_id];
    if (!work) {
      errors.push(`[${t.sourcePath}] work_id "${fm.work_id}" 在 /content/works/ 找不到對應資料夾`);
      continue;
    }
    t.work = work;

    const author = sourceAuthors[work.author_id];
    if (!author) {
      errors.push(`[${t.sourcePath}] 作品 "${fm.work_id}" 的 author_id "${work.author_id}" 在 /content/source-authors/ 找不到對應資料夾`);
    }
    t.author = author || null;

    const editions = Array.isArray(work.editions) ? work.editions : [];
    const edition = editions.find((e) => e.url === fm.edition_url);
    if (!edition) {
      errors.push(`[${t.sourcePath}] edition_url "${fm.edition_url}" 在作品 "${fm.work_id}" 的 editions 清單裡找不到相符項目`);
    }
    t.edition = edition || null;

    if (edition && edition.translator_id) {
      const sourceTranslator = sourceTranslators[edition.translator_id];
      if (!sourceTranslator) {
        errors.push(`[${t.sourcePath}] edition 的 translator_id "${edition.translator_id}" 在 /content/source-translators/ 找不到對應資料夾`);
      }
      t.sourceTranslator = sourceTranslator || null;
    } else {
      t.sourceTranslator = null;
    }
  }

  if (errors.length) {
    throw new Error('Build 參照完整性檢查失敗:\n' + errors.map((e) => '  - ' + e).join('\n'));
  }

  return { works, sourceAuthors, sourceTranslators, translators, translations };
}

// ---------- render ----------

function renderTranslationPage(t) {
  const authorName = t.author ? pickLocalized(t.author.names) : '(未知作者)';
  const workTitle = pickLocalized(t.work.title);
  const editionTranslatorName = t.sourceTranslator ? pickLocalized(t.sourceTranslator.names) : null;

  const body = `
<nav><a href="/">首頁</a> <a href="/works/${escapeHtml(t.work.id)}/">回作品頁</a></nav>
<h1>${escapeHtml(t.frontmatter.title)}</h1>
<p class="meta">
  譯者:<a href="/translators/${escapeHtml(t.translatorId)}/">${escapeHtml(t.translatorId)}</a> ·
  原作:${escapeHtml(workTitle)} · 原作者:<a href="/source-authors/${escapeHtml(t.author.id)}/">${escapeHtml(authorName)}</a>
</p>
<article>
${md.render(t.bodyMarkdown)}
</article>
<hr>
<p class="meta">
  來源版本:<a href="${escapeHtml(t.frontmatter.edition_url)}">${escapeHtml(t.frontmatter.edition_url)}</a>(語言:${escapeHtml(t.edition.language)})
  ${editionTranslatorName ? ` · 該版本譯者:${escapeHtml(editionTranslatorName)}` : ''}<br>
  本譯文授權:<a href="/LICENSE">${escapeHtml(SITE_LICENSE)}</a>
</p>
`;
  return layout({ title: t.frontmatter.title, body, canonical: `/translations/${t.uuid}/` });
}

function build() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  const { works, sourceAuthors, sourceTranslators, translators, translations } = resolveAll();

  // group translations by work / translator / source-author / source-translator / tag
  const byWork = {};
  const byTranslator = {};
  const byTag = {};

  for (const t of translations) {
    (byWork[t.frontmatter.work_id] ||= []).push(t);
    (byTranslator[t.translatorId] ||= []).push(t);
    for (const tag of t.work.tags || []) {
      (byTag[tag] ||= []).push(t);
    }
  }

  // ---- /translations/{uuid}/ ----
  for (const t of translations) {
    writeHtml(path.join(OUT_DIR, 'translations', t.uuid, 'index.html'), renderTranslationPage(t));
  }

  // ---- /translations.json ----
  const translationsJson = translations.map((t) => ({
    id: t.uuid,
    title: t.frontmatter.title,
    translator_id: t.translatorId,
    work_id: t.frontmatter.work_id,
    work_title: pickLocalized(t.work.title),
    excerpt: t.frontmatter.excerpt || null,
    date: t.frontmatter.date || null,
    url: `/translations/${t.uuid}/`,
  }));
  ensureDirFor(path.join(OUT_DIR, 'translations.json'));
  fs.writeFileSync(path.join(OUT_DIR, 'translations.json'), JSON.stringify(translationsJson, null, 2), 'utf8');

  // ---- /works/{work-id}/ ----
  for (const [workId, work] of Object.entries(works)) {
    const author = sourceAuthors[work.author_id];
    const authorName = author ? pickLocalized(author.names) : '(未知作者)';
    const list = (byWork[workId] || [])
      .map((t) => {
        const editionLang = t.edition ? t.edition.language : '?';
        const via = t.sourceTranslator ? `,經 ${escapeHtml(pickLocalized(t.sourceTranslator.names))} 譯本轉譯` : '';
        return `<li><a href="/translations/${escapeHtml(t.uuid)}/">${escapeHtml(t.frontmatter.title)}</a> — 譯者:<a href="/translators/${escapeHtml(t.translatorId)}/">${escapeHtml(t.translatorId)}</a>(依據語言:${escapeHtml(editionLang)}${via}) — ${escapeHtml(t.frontmatter.excerpt || '')}</li>`;
      })
      .join('\n');

    const editionsList = (work.editions || [])
      .map((e) => `<li>${escapeHtml(e.language)} — <a href="${escapeHtml(e.url)}">${escapeHtml(e.url)}</a>(${escapeHtml(e.publisher || '')} ${escapeHtml(e.date || '')}, ${escapeHtml(e.copyright_status)})</li>`)
      .join('\n');

    const body = `
<nav><a href="/">首頁</a></nav>
<h1>${escapeHtml(pickLocalized(work.title))}</h1>
<p class="meta">
  原作者:<a href="/source-authors/${escapeHtml(work.author_id)}/">${escapeHtml(authorName)}</a> ·
  原文語言:${escapeHtml(work.original_language)} ·
  分類:${escapeHtml(work.category || '')} ·
  標籤:${(work.tags || []).map((tg) => `<a href="/tags/${escapeHtml(tg)}/">${escapeHtml(tg)}</a>`).join('、')}
</p>
<h2>已知來源版本</h2>
<ul class="list">${editionsList}</ul>
<h2>站內譯本(${(byWork[workId] || []).length})</h2>
<ul class="list">${list}</ul>
`;
    writeHtml(path.join(OUT_DIR, 'works', workId, 'index.html'), layout({ title: pickLocalized(work.title), body }));
  }

  // ---- /translators/{id}/ ----
  const allTranslatorIds = new Set([...Object.keys(translators), ...Object.keys(byTranslator)]);
  for (const translatorId of allTranslatorIds) {
    const profile = translators[translatorId] || {};
    const list = (byTranslator[translatorId] || [])
      .map((t) => `<li><a href="/translations/${escapeHtml(t.uuid)}/">${escapeHtml(t.frontmatter.title)}</a> — 原作:${escapeHtml(pickLocalized(t.work.title))}</li>`)
      .join('\n');
    const body = `
<nav><a href="/">首頁</a></nav>
<h1>${escapeHtml(profile.display_name || translatorId)}</h1>
${profile.bio ? `<p>${escapeHtml(profile.bio)}</p>` : ''}
<h2>翻譯作品(${(byTranslator[translatorId] || []).length})</h2>
<ul class="list">${list}</ul>
`;
    writeHtml(path.join(OUT_DIR, 'translators', translatorId, 'index.html'), layout({ title: profile.display_name || translatorId, body }));
  }

  // ---- /source-authors/{id}/ ----
  for (const [authorId, author] of Object.entries(sourceAuthors)) {
    const worksOfAuthor = Object.entries(works).filter(([, w]) => w.author_id === authorId);
    const list = worksOfAuthor
      .map(([wid, w]) => `<li><a href="/works/${escapeHtml(wid)}/">${escapeHtml(pickLocalized(w.title))}</a></li>`)
      .join('\n');
    const body = `
<nav><a href="/">首頁</a></nav>
<h1>${escapeHtml(pickLocalized(author.names))}</h1>
<h2>站內收錄作品(${worksOfAuthor.length})</h2>
<ul class="list">${list}</ul>
`;
    writeHtml(path.join(OUT_DIR, 'source-authors', authorId, 'index.html'), layout({ title: pickLocalized(author.names), body }));
  }

  // ---- /source-translators/{id}/ ----
  for (const [stId, st] of Object.entries(sourceTranslators)) {
    const relatedWorks = Object.entries(works).filter(([, w]) =>
      (w.editions || []).some((e) => e.translator_id === stId)
    );
    const list = relatedWorks
      .map(([wid, w]) => `<li><a href="/works/${escapeHtml(wid)}/">${escapeHtml(pickLocalized(w.title))}</a></li>`)
      .join('\n');
    const body = `
<nav><a href="/">首頁</a></nav>
<h1>${escapeHtml(pickLocalized(st.names))}</h1>
<p class="meta">譯入語言:${escapeHtml(st.language)}</p>
<h2>相關作品(${relatedWorks.length})</h2>
<ul class="list">${list}</ul>
`;
    writeHtml(path.join(OUT_DIR, 'source-translators', stId, 'index.html'), layout({ title: pickLocalized(st.names), body }));
  }

  // ---- /tags/{tag}/ ----
  for (const [tag, list] of Object.entries(byTag)) {
    const items = list
      .map((t) => `<li><a href="/translations/${escapeHtml(t.uuid)}/">${escapeHtml(t.frontmatter.title)}</a></li>`)
      .join('\n');
    const body = `<nav><a href="/">首頁</a></nav><h1>標籤:${escapeHtml(tag)}</h1><ul class="list">${items}</ul>`;
    writeHtml(path.join(OUT_DIR, 'tags', tag, 'index.html'), layout({ title: `標籤:${tag}`, body }));
  }

  // ---- / (首頁:最新譯作 + 譯者一覽,新版視覺,見 scripts/templates/) ----
  const latestTranslations = translations
    .slice()
    .sort((a, b) => String(b.frontmatter.date || '').localeCompare(String(a.frontmatter.date || '')))
    .slice(0, 8)
    .map((t) => ({
      url: `/translations/${t.uuid}/`,
      title: t.frontmatter.title,
      translatorId: t.translatorId,
      date: t.frontmatter.date || null,
      workTitle: pickLocalized(t.work.title),
    }));

  const translatorList = Object.keys(byTranslator).map((translatorId) => {
    const profile = translators[translatorId] || {};
    return {
      url: `/translators/${translatorId}/`,
      displayName: profile.display_name || translatorId,
      bio: profile.bio || null,
      count: byTranslator[translatorId].length,
    };
  });

  const { title: homeTitle, body: homeBody } = renderHomepage({ latestTranslations, translatorList });
  writeHtml(path.join(OUT_DIR, 'index.html'), renderLayout({ title: homeTitle, body: homeBody }));

  // ---- 複製 assets/ 靜態資源(CSS/JS)到 dist/assets/ ----
  if (fs.existsSync(ASSETS_DIR)) {
    fs.cpSync(ASSETS_DIR, path.join(OUT_DIR, 'assets'), { recursive: true });
  }

  return {
    translations: translations.length,
    works: Object.keys(works).length,
    sourceAuthors: Object.keys(sourceAuthors).length,
    sourceTranslators: Object.keys(sourceTranslators).length,
    translators: allTranslatorIds.size,
    tags: Object.keys(byTag).length,
  };
}

if (require.main === module) {
  try {
    const stats = build();
    console.log('Build 成功:', JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { build };
