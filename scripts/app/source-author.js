'use strict';

const { escapeHtml } = require('./layout');

function renderWorkRow(w) {
  return `<a class="entry-row" href="${escapeHtml(w.url)}">
      <div class="entry-title serif">${escapeHtml(w.title)}</div>
    </a>`;
}

/**
 * 原作者頁(寬版)。純渲染。
 * @param {object} vm
 * @param {string} vm.name
 * @param {Array<{url:string,title:string}>} vm.works
 * @param {string} vm.canonical
 */
function renderSourceAuthor(vm) {
  const initial = vm.name.charAt(0);
  const list = vm.works.map(renderWorkRow).join('\n');

  const body = `
<div class="detail-hero">
  <div class="avatar-lg" style="background:var(--seal);">${escapeHtml(initial)}</div>
  <h1>${escapeHtml(vm.name)}</h1>
</div>

<section class="block">
  <div class="block-head">
    <div class="block-title serif">站內收錄作品 <span class="jp">Works</span>(${vm.works.length})</div>
  </div>
  ${vm.works.length ? `<div class="entry-list">${list}</div>` : '<p class="block-empty-note">目前還沒有這位作者的作品被登記。</p>'}
</section>
`;

  return { title: vm.name, body, canonical: vm.canonical };
}

module.exports = { renderSourceAuthor };
