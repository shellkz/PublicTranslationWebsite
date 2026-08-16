'use strict';

const { escapeHtml } = require('./layout');

function renderEditionRow(e) {
  // 連結文字優先用 publisher(較短、可讀),沒有才退回顯示完整網址;
  // 網址本身沒有自然斷行點,搭配 CSS 的 overflow-wrap 才不會撐出容器。
  const linkLabel = e.publisher || e.url;
  const metaParts = [e.language, e.date, e.copyrightStatus].filter(Boolean).join(' · ');
  return `<div class="edition-row">
      <a href="${escapeHtml(e.url)}">${escapeHtml(linkLabel)}</a>
      <span class="edition-meta">${escapeHtml(metaParts)}</span>
    </div>`;
}

function renderTranslationRow(t) {
  // 整列本身就是 <a>(點哪裡都能進去讀這篇譯文),列內不能再放 <a>——
  // HTML 不允許 <a> 巢狀 <a>,瀏覽器會把外層提前關閉,害 entry-meta/entry-excerpt 跑到 .entry-row 外面。
  // 譯者名稱、來源版本網址在這裡只顯示純文字,要點進去看譯者頁請從別處(如 /translators/ 列表)點。
  return `<a class="entry-row" href="${escapeHtml(t.url)}">
      <div class="entry-title">${escapeHtml(t.title)}</div>
      <div class="entry-meta">譯者・${escapeHtml(t.translatorId)}</div>
      <div class="entry-meta">根據版本・${escapeHtml(t.editionUrl)}</div>
      ${t.excerpt ? `<div class="entry-excerpt">${escapeHtml(t.excerpt)}</div>` : ''}
    </a>`;
}

/**
 * 作品資訊頁(寬版)。純渲染。
 * @param {object} vm
 * @param {string} vm.title
 * @param {?string} vm.nativeTitle
 * @param {string} vm.authorName
 * @param {string} vm.authorUrl
 * @param {string} vm.originalLanguage
 * @param {?string} vm.category
 * @param {Array<{name:string,url:string}>} vm.tags
 * @param {Array<{language:string,url:string,publisher:?string,date:?string,copyrightStatus:string}>} vm.editions
 * @param {Array<object>} vm.translations
 * @param {string} vm.canonical
 */
function renderWork(vm) {
  const editionsHtml = vm.editions.map(renderEditionRow).join('\n');
  const translationsHtml = vm.translations.map(renderTranslationRow).join('\n');
  const tagsHtml = vm.tags
    .map((t) => `<a class="tag-pill" href="${escapeHtml(t.url)}">${escapeHtml(t.name)}</a>`)
    .join('\n');

  const translationsSection = vm.translations.length
    ? `<div class="entry-list">${translationsHtml}</div>`
    : `<div class="cta-note">這部作品目前還沒有站內譯本——想成為第一個翻譯它的人嗎?見 <a href="https://github.com/shellkz/PublicTranslationWebsite/blob/main/docs/翻譯者指南.md">翻譯者指南</a>。</div>`;

  const body = `
<div class="detail-hero">
  ${vm.nativeTitle ? `<div class="eyebrow serif">${escapeHtml(vm.nativeTitle)}</div>` : ''}
  <h1>${escapeHtml(vm.title)}</h1>
  <div class="detail-meta">
    <span>原作者・<a href="${escapeHtml(vm.authorUrl)}">${escapeHtml(vm.authorName)}</a></span>
    <span>原文語言・${escapeHtml(vm.originalLanguage)}</span>
    ${vm.category ? `<span>分類・${escapeHtml(vm.category)}</span>` : ''}
  </div>
  ${vm.tags.length ? `<div class="tag-pills">${tagsHtml}</div>` : ''}
</div>

<section class="block">
  <div class="block-head">
    <div class="block-title serif">所有譯本 <span class="jp">Translations</span>(${vm.translations.length})</div>
  </div>
  ${translationsSection}
</section>

<section class="block">
  <div class="block-head">
    <div class="block-title serif">來源版本 <span class="jp">Editions</span></div>
  </div>
  <div class="edition-list">${editionsHtml}</div>
</section>


`;

  return { title: vm.title, body, canonical: vm.canonical };
}

module.exports = { renderWork };
