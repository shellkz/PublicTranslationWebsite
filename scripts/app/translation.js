'use strict';

const { escapeHtml } = require('./layout');

/**
 * 譯文內容頁(窄欄閱讀版面)。純渲染,不碰 work_id/edition_url 這類內部資料結構。
 * @param {object} vm
 * @param {string} vm.title 這篇譯文自己的標題
 * @param {string} vm.workUrl
 * @param {string} vm.workTitle 作品的中文/主要顯示標題(麵包屑用)
 * @param {?string} vm.workNativeTitle 作品的原文標題(小字副標)
 * @param {string} vm.translatorId
 * @param {string} vm.translatorUrl
 * @param {string} vm.authorName
 * @param {string} vm.authorUrl
 * @param {?string} vm.date
 * @param {string} vm.bodyHtml 已經 render 好的正文 HTML
 * @param {string} vm.editionUrl
 * @param {?string} vm.editionPublisher 有填才顯示,取代網址當連結文字(避免長網址溢出,也更好讀)
 * @param {string} vm.editionLanguage
 * @param {?string} vm.sourceTranslatorName 若這次翻譯依據的版本本身是翻譯,該版本譯者名稱
 * @param {?string} vm.sourceTranslatorUrl
 * @param {string} vm.license
 * @param {string} vm.canonical
 */
function renderTranslation(vm) {
  const body = `
<div class="breadcrumb">
  <a href="/">首頁</a><span class="sep">›</span>
  <a href="${escapeHtml(vm.workUrl)}">${escapeHtml(vm.workTitle)}</a><span class="sep">›</span>
  <span>${escapeHtml(vm.title)}</span>
</div>

<div class="article-header">
  ${vm.workNativeTitle ? `<div class="work-jp serif">${escapeHtml(vm.workNativeTitle)}</div>` : ''}
  <h1>${escapeHtml(vm.title)}</h1>
  <div class="byline">
    <span>譯者・<a href="${escapeHtml(vm.translatorUrl)}">${escapeHtml(vm.translatorId)}</a></span>
    <span class="dot">·</span>
    <span>原作・<a href="${escapeHtml(vm.authorUrl)}">${escapeHtml(vm.authorName)}</a></span>
    ${vm.date ? `<span class="dot">·</span><span>${escapeHtml(vm.date)}</span>` : ''}
  </div>
</div>

<article class="article-body">
${vm.bodyHtml}
</article>
<div class="article-end-mark">◆ ◆ ◆</div>

<div class="citation-block">
  <div class="citation-card">
    <div class="row"><span class="label">來源版本</span><a href="${escapeHtml(vm.editionUrl)}">${escapeHtml(vm.editionPublisher || vm.editionUrl)}</a>(語言:${escapeHtml(vm.editionLanguage)})</div>
    ${vm.sourceTranslatorName ? `<div class="row"><span class="label">該版本譯者</span><a href="${escapeHtml(vm.sourceTranslatorUrl)}">${escapeHtml(vm.sourceTranslatorName)}</a></div>` : ''}
    <div class="row"><span class="label">本譯文授權</span><span class="license-badge">${escapeHtml(vm.license)}</span></div>
  </div>
</div>
`;

  return { title: vm.title, body, canonical: vm.canonical };
}

module.exports = { renderTranslation };
