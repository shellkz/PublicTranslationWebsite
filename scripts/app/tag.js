'use strict';

const { escapeHtml } = require('./layout');

function renderEntryRow(t) {
  // 整列已經是 <a>,列內不能再放 <a>(HTML 不允許巢狀 <a>,會害外層提前關閉)——見 work.js 同樣的註解。
  return `<a class="entry-row" href="${escapeHtml(t.url)}">
      <div class="entry-title">${escapeHtml(t.title)}</div>
      <div class="entry-meta">原作・${escapeHtml(t.workTitle)} · 譯者・${escapeHtml(t.translatorId)}</div>
    </a>`;
}

/**
 * 標籤索引頁(寬版)。純渲染。
 * @param {object} vm
 * @param {string} vm.tag
 * @param {Array<object>} vm.translations
 * @param {string} vm.canonical
 */
function renderTag(vm) {
  const list = vm.translations.map(renderEntryRow).join('\n');

  const body = `
<div class="detail-hero">
  <div class="eyebrow">標籤 TAG</div>
  <h1>${escapeHtml(vm.tag)}</h1>
</div>

<section class="block">
  <div class="block-head">
    <div class="block-title serif">相關譯文 <span class="jp">Translations</span>(${vm.translations.length})</div>
  </div>
  <div class="entry-list">${list}</div>
</section>
`;

  return { title: `標籤:${vm.tag}`, body, canonical: vm.canonical };
}

module.exports = { renderTag };
