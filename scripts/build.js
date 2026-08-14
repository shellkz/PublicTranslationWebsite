'use strict';

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');
const { renderLayout } = require('./app/layout');
const { renderHomepage } = require('./app/homepage');
const { renderTranslation } = require('./app/translation');
const { renderWork } = require('./app/work');
const { renderTranslator } = require('./app/translator');
const { renderSourceAuthor } = require('./app/source-author');
const { renderSourceTranslator } = require('./app/source-translator');
const { renderTag } = require('./app/tag');
const { renderWorksIndex } = require('./app/works-index');

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

// 給讀者看的「這部作品叫什麼」,一律直接用 title.zh,不做語言 fallback——
// 顯示原文(如日文假名)對只讀中文的讀者沒有意義,尤其是放大顯示的封面標題。
// 只有明確要展示「原文標題」當引用/小字副標(如 translation.js 的 .work-jp、
// work.js 的 .eyebrow)才用 pickLocalized(title, ['ja','en','romaji','zh']) 保留原文。
function workDisplayTitle(work) {
  return (work && work.title && work.title.zh) || '';
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

function writePage(outPath, { title, body, canonical }) {
  writeHtml(outPath, renderLayout({ title, body, canonical }));
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

// ---------- build ----------

function build() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  const { works, sourceAuthors, sourceTranslators, translators, translations } = resolveAll();

  // group translations by work / translator / tag
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
    const authorName = t.author ? pickLocalized(t.author.names) : '(未知作者)';
    const sourceTranslatorName = t.sourceTranslator ? pickLocalized(t.sourceTranslator.names) : null;

    const page = renderTranslation({
      title: t.frontmatter.title,
      workUrl: `/works/${t.work.id}/`,
      workTitle: workDisplayTitle(t.work),
      workNativeTitle: pickLocalized(t.work.title, ['ja', 'en', 'romaji', 'zh']),
      translatorId: t.translatorId,
      translatorUrl: `/translators/${t.translatorId}/`,
      authorName,
      authorUrl: `/source-authors/${t.work.author_id}/`,
      date: t.frontmatter.date || null,
      bodyHtml: md.render(t.bodyMarkdown),
      editionUrl: t.frontmatter.edition_url,
      editionPublisher: t.edition.publisher || null,
      editionLanguage: t.edition.language,
      sourceTranslatorName,
      sourceTranslatorUrl: t.sourceTranslator ? `/source-translators/${t.sourceTranslator.id}/` : null,
      license: SITE_LICENSE,
      canonical: `/translations/${t.uuid}/`,
    });
    writePage(path.join(OUT_DIR, 'translations', t.uuid, 'index.html'), page);
  }

  // ---- /translations.json ----
  const translationsJson = translations.map((t) => ({
    id: t.uuid,
    title: t.frontmatter.title,
    translator_id: t.translatorId,
    work_id: t.frontmatter.work_id,
    work_title: workDisplayTitle(t.work),
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

    const page = renderWork({
      title: workDisplayTitle(work),
      nativeTitle: pickLocalized(work.title, ['ja', 'en', 'romaji', 'zh']),
      authorName,
      authorUrl: `/source-authors/${work.author_id}/`,
      originalLanguage: work.original_language,
      category: work.category || null,
      tags: (work.tags || []).map((tg) => ({ name: tg, url: `/tags/${tg}/` })),
      editions: (work.editions || []).map((e) => ({
        language: e.language,
        url: e.url,
        publisher: e.publisher || null,
        date: e.date || null,
        copyrightStatus: e.copyright_status,
      })),
      translations: (byWork[workId] || []).map((t) => ({
        url: `/translations/${t.uuid}/`,
        title: t.frontmatter.title,
        translatorId: t.translatorId,
        translatorUrl: `/translators/${t.translatorId}/`,
        editionLanguage: t.edition ? t.edition.language : '?',
        sourceTranslatorName: t.sourceTranslator ? pickLocalized(t.sourceTranslator.names) : null,
        sourceTranslatorUrl: t.sourceTranslator ? `/source-translators/${t.sourceTranslator.id}/` : null,
        excerpt: t.frontmatter.excerpt || null,
      })),
      canonical: `/works/${workId}/`,
    });
    writePage(path.join(OUT_DIR, 'works', workId, 'index.html'), page);
  }

  // ---- /works/(全作品列表頁,work-level:一部作品一張卡,不分譯本) ----
  const worksIndexEntries = Object.entries(works).map(([workId, w]) => {
    const author = sourceAuthors[w.author_id];
    const workTranslations = byWork[workId] || [];
    const translatorIds = [...new Set(workTranslations.map((t) => t.translatorId))];
    return {
      url: `/works/${workId}/`,
      workTitle: workDisplayTitle(w),
      authorName: author ? pickLocalized(author.names) : '(未知作者)',
      tags: w.tags || [],
      category: w.category || null,
      originalLanguage: w.original_language,
      translatorIds,
      translationCount: workTranslations.length,
      excerpt: w.excerpt || null,
    };
  });

  const worksIndexPage = renderWorksIndex({
    entries: worksIndexEntries,
    categories: [...new Set(Object.values(works).map((w) => w.category).filter(Boolean))].sort(),
    languages: [...new Set(Object.values(works).map((w) => w.original_language).filter(Boolean))].sort(),
    tags: Object.keys(byTag).sort(),
  });
  writePage(path.join(OUT_DIR, 'works', 'index.html'), worksIndexPage);

  // ---- /translators/{id}/ ----
  const allTranslatorIds = new Set([...Object.keys(translators), ...Object.keys(byTranslator)]);
  for (const translatorId of allTranslatorIds) {
    const profile = translators[translatorId] || {};

    const page = renderTranslator({
      displayName: profile.display_name || translatorId,
      bio: profile.bio || null,
      translations: (byTranslator[translatorId] || []).map((t) => ({
        url: `/translations/${t.uuid}/`,
        title: t.frontmatter.title,
        workTitle: workDisplayTitle(t.work),
        excerpt: t.frontmatter.excerpt || null,
      })),
      canonical: `/translators/${translatorId}/`,
    });
    writePage(path.join(OUT_DIR, 'translators', translatorId, 'index.html'), page);
  }

  // ---- /source-authors/{id}/ ----
  for (const [authorId, author] of Object.entries(sourceAuthors)) {
    const worksOfAuthor = Object.entries(works).filter(([, w]) => w.author_id === authorId);

    const page = renderSourceAuthor({
      name: pickLocalized(author.names),
      works: worksOfAuthor.map(([wid, w]) => ({ url: `/works/${wid}/`, title: workDisplayTitle(w) })),
      canonical: `/source-authors/${authorId}/`,
    });
    writePage(path.join(OUT_DIR, 'source-authors', authorId, 'index.html'), page);
  }

  // ---- /source-translators/{id}/ ----
  for (const [stId, st] of Object.entries(sourceTranslators)) {
    const relatedWorks = Object.entries(works).filter(([, w]) =>
      (w.editions || []).some((e) => e.translator_id === stId)
    );

    const page = renderSourceTranslator({
      name: pickLocalized(st.names),
      language: st.language,
      works: relatedWorks.map(([wid, w]) => ({ url: `/works/${wid}/`, title: workDisplayTitle(w) })),
      canonical: `/source-translators/${stId}/`,
    });
    writePage(path.join(OUT_DIR, 'source-translators', stId, 'index.html'), page);
  }

  // ---- /tags/{tag}/ ----
  for (const [tag, list] of Object.entries(byTag)) {
    const page = renderTag({
      tag,
      translations: list.map((t) => ({
        url: `/translations/${t.uuid}/`,
        title: t.frontmatter.title,
        workTitle: workDisplayTitle(t.work),
        translatorId: t.translatorId,
        translatorUrl: `/translators/${t.translatorId}/`,
      })),
      canonical: `/tags/${tag}/`,
    });
    writePage(path.join(OUT_DIR, 'tags', tag, 'index.html'), page);
  }

  // ---- / (首頁:最新譯作 + 譯者一覽) ----
  const latestTranslations = translations
    .slice()
    .sort((a, b) => String(b.frontmatter.date || '').localeCompare(String(a.frontmatter.date || '')))
    .slice(0, 8)
    .map((t) => ({
      url: `/translations/${t.uuid}/`,
      title: t.frontmatter.title,
      translatorId: t.translatorId,
      authorName: t.author ? pickLocalized(t.author.names) : '(未知作者)',
      date: t.frontmatter.date || null,
      workTitle: workDisplayTitle(t.work),
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

  const homePage = renderHomepage({ latestTranslations, translatorList });
  writePage(path.join(OUT_DIR, 'index.html'), homePage);

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
