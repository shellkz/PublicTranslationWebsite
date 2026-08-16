'use strict';

const { escapeHtml } = require('./layout');

function renderEntryRow(t) {
  return `<a class="entry-row" href="${escapeHtml(t.url)}">
      <div class="entry-title">${escapeHtml(t.title)}</div>
      <div class="entry-meta">原作・${escapeHtml(t.workTitle)}</div>
      ${t.excerpt ? `<div class="entry-excerpt">${escapeHtml(t.excerpt)}</div>` : ''}
    </a>`;
}

/**
 * 譯者頁(寬版)。純渲染。
 * @param {object} vm
 * @param {string} vm.displayName
 * @param {?string} vm.bio
 * @param {string} vm.charCountDisplay 已格式化好的累計字數(如「1.1萬字」),純顯示用字串
 * @param {Array<{url:string,title:string,workTitle:string,excerpt:?string}>} vm.translations
 * @param {string} vm.canonical
 */
function renderTranslator(vm) {
  const initial = vm.displayName.charAt(0);
  const list = vm.translations.map(renderEntryRow).join('\n');

  const body = `
<div class="detail-hero">
  <div class="avatar-lg">${escapeHtml(initial)}</div>
  <h1>${escapeHtml(vm.displayName)}</h1>
  ${vm.bio ? `<p class="desc">${escapeHtml(vm.bio)}</p>` : ''}
  <p class="translator-stats">已發表 ${vm.translations.length} 篇譯文・共 ${escapeHtml(vm.charCountDisplay)}</p>
</div>

<section class="block">
  <div class="block-head">
    <div class="block-title serif">翻譯作品 <span class="jp">Translations</span>(${vm.translations.length})</div>
  </div>
  ${vm.translations.length ? `<div class="entry-list">${list}</div>` : '<p class="block-empty-note">這位譯者還沒有發表譯文。</p>'}
</section>
`;

  return { title: vm.displayName, body, canonical: vm.canonical };
}

module.exports = { renderTranslator };
