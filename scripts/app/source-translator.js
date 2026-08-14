'use strict';

const { escapeHtml } = require('./layout');

function renderWorkRow(w) {
  return `<a class="entry-row" href="${escapeHtml(w.url)}">
      <div class="entry-title serif">${escapeHtml(w.title)}</div>
    </a>`;
}

/**
 * 中間譯者頁(寬版)。純渲染。
 * @param {object} vm
 * @param {string} vm.name
 * @param {string} vm.language
 * @param {Array<{url:string,title:string}>} vm.works
 * @param {string} vm.canonical
 */
function renderSourceTranslator(vm) {
  const initial = vm.name.charAt(0);
  const list = vm.works.map(renderWorkRow).join('\n');

  const body = `
<div class="detail-hero">
  <div class="avatar-lg" style="background:#5b6b4f;">${escapeHtml(initial)}</div>
  <h1>${escapeHtml(vm.name)}</h1>
  <div class="detail-meta"><span>譯入語言・${escapeHtml(vm.language)}</span></div>
</div>

<section class="block">
  <div class="block-head">
    <div class="block-title serif">相關作品 <span class="jp">Related Works</span>(${vm.works.length})</div>
  </div>
  ${vm.works.length ? `<div class="entry-list">${list}</div>` : '<p class="block-empty-note">目前還沒有相關作品。</p>'}
</section>
`;

  return { title: vm.name, body, canonical: vm.canonical };
}

module.exports = { renderSourceTranslator };
