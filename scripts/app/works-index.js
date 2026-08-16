'use strict';

const { escapeHtml } = require('./layout');
const { renderMetaField, COVER_CLASSES } = require('./homepage');

// 純渲染,不碰 work_id 這類內部資料結構——只吃扁平 view model。
// Work-level:一部作品一張卡,不分譯本(多個譯本用「幾個譯本」的角落標籤呈現,
// 細節留給使用者點進 /works/{id}/ 才看)。可篩選欄位印成 data-* 屬性,篩選邏輯
// 完全交給 assets/js/works-filter.js 在瀏覽器端讀這些屬性做比對。

function renderCard(entry, index) {
  const coverClass = COVER_CLASSES[index % COVER_CLASSES.length];
  const isEmpty = entry.translationCount === 0;
  const dataAttrs = [
    `data-title="${escapeHtml(entry.workTitle)}"`,
    `data-author="${escapeHtml(entry.authorName)}"`,
    `data-translator="${escapeHtml((entry.translatorIds || []).join(','))}"`,
    `data-category="${escapeHtml(entry.category || '')}"`,
    `data-language="${escapeHtml(entry.originalLanguage || '')}"`,
    `data-tags="${escapeHtml((entry.tags || []).join(','))}"`,
  ].join(' ');

  return `<a class="card${isEmpty ? ' card-empty' : ''}" href="${escapeHtml(entry.url)}" ${dataAttrs}>
      <div class="cover ${coverClass}">
        <span class="cover-title">${escapeHtml(entry.workTitle)}</span>
        <span class="cover-count${isEmpty ? ' is-empty' : ''}">${entry.translationCount} 個譯本</span>
      </div>
      <div class="card-title-cn">${escapeHtml(entry.workNativeTitle)}</div>
      ${renderMetaField('作者', entry.authorName)}
      ${isEmpty ? '<div class="needs-translator">尚無譯者・想挑戰看看?</div>' : ''}
    </a>`;
}

function renderFilters({ categories, languages, tags }) {
  const categoryOptions = categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  const languageOptions = languages.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
  const tagCheckboxes = tags
    .map((t) => `<label><input type="checkbox" value="${escapeHtml(t)}"> ${escapeHtml(t)}</label>`)
    .join('\n');

  return `
<form id="works-filters" class="works-filters">
  <div class="filter-field">
    <label for="f-search">作品標題</label>
    <input type="search" id="f-search" placeholder="搜尋作品標題">
  </div>
  <div class="filter-field">
    <label for="f-author">原作者</label>
    <input type="text" id="f-author" placeholder="搜尋原作者">
  </div>
  <div class="filter-field">
    <label for="f-translator">譯者</label>
    <input type="text" id="f-translator" placeholder="搜尋譯者">
  </div>
  <div class="filter-field">
    <label for="f-category">分類</label>
    <select id="f-category"><option value="">全部</option>${categoryOptions}</select>
  </div>
  <div class="filter-field">
    <label for="f-language">原文語言</label>
    <select id="f-language"><option value="">全部</option>${languageOptions}</select>
  </div>
  <fieldset class="filter-tags">
    <legend>標籤</legend>
    <div class="filter-tags-options">${tagCheckboxes}</div>
  </fieldset>
</form>`;
}

/**
 * 全作品列表頁,work-level:一部作品一張卡(不分譯本)。
 * @param {object} vm
 * @param {Array<{url:string,workTitle:string,workNativeTitle:string,authorName:string,tags:string[],category:?string,
 *   originalLanguage:?string,translatorIds:string[],translationCount:number,excerpt:?string}>} vm.entries
 * @param {string[]} vm.categories
 * @param {string[]} vm.languages
 * @param {string[]} vm.tags
 */
function renderWorksIndex({ entries, categories, languages, tags }) {
  const cardsHtml = entries.map(renderCard).join('\n');

  const body = `
<div class="detail-hero">
  <h1>全部作品</h1>
</div>
${renderFilters({ categories, languages, tags })}
<section class="block">
  <div id="works-grid" class="grid">${cardsHtml}</div>
  <p id="works-empty-note" class="block-empty-note" style="display:none;">找不到符合條件的作品。</p>
</section>
<script src="/assets/js/works-filter.js" defer></script>
`;

  return { title: '全部作品', body, canonical: '/works/' };
}

module.exports = { renderWorksIndex };
