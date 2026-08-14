'use strict';

const { escapeHtml } = require('./layout');

const COVER_CLASSES = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
const AVATAR_COLORS = ['var(--indigo)', 'var(--seal)', '#5b6b4f', '#8a6a3f', '#3a5560', '#7a3f56'];

// 只吃扁平、已經整理好的顯示用資料(view model),不碰 work_id/edition_url
// 這類內部資料結構——那些查找/反查邏輯留在 build.js,這裡純粹是「資料轉 HTML」。

function renderMetaField(label, value) {
  return `<div class="card-meta"><span class="meta-label">${escapeHtml(label)}</span><span class="meta-value">${escapeHtml(value)}</span></div>`;
}

function renderLatestCard(item, index) {
  const coverClass = COVER_CLASSES[index % COVER_CLASSES.length];
  return `<a class="card" href="${escapeHtml(item.url)}">
      <div class="cover ${coverClass}">
        <span class="cover-title">${escapeHtml(item.workNativeTitle)}</span>
      </div>
      <div class="card-title-cn">${escapeHtml(item.title)}</div>
      ${renderMetaField('作者', item.authorName)}
      ${renderMetaField('譯者', item.translatorId)}
      ${item.date ? renderMetaField('更新於', item.date) : ''}
    </a>`;
}

function renderTranslatorCard(item, index) {
  const initial = item.displayName.charAt(0);
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return `<a class="t-card" href="${escapeHtml(item.url)}">
      <div class="t-avatar" style="background:${color};">${escapeHtml(initial)}</div>
      <div>
        <div class="t-name">${escapeHtml(item.displayName)}</div>
        <div class="t-desc">${escapeHtml(item.bio || '這位譯者還沒有寫自我介紹。')}</div>
        <div class="t-count">累積 ${item.count} 篇譯文</div>
      </div>
    </a>`;
}

/**
 * @param {object} data
 * @param {Array<{url:string,title:string,translatorId:string,authorName:string,date:?string,workNativeTitle:string}>} data.latestTranslations
 * @param {Array<{url:string,displayName:string,bio:?string,count:number}>} data.translatorList
 */
function renderHomepage({ latestTranslations, translatorList }) {
  const latestHtml = latestTranslations.map(renderLatestCard).join('\n');
  const translatorsHtml = translatorList.map(renderTranslatorCard).join('\n');

  const body = `


<section class="block" id="latest">
  <div class="block-head">
    <div class="block-title serif">最新譯作 <span class="jp">Latest Translations</span></div>
  </div>
  ${latestTranslations.length ? `<div class="grid">${latestHtml}</div>` : '<p class="block-empty-note">目前還沒有譯文,敬請期待。</p>'}
</section>

<section class="block" id="translators">
  <div class="block-head">
    <div class="block-title serif">譯者一覽 <span class="jp">Translators</span></div>
  </div>
  ${translatorList.length ? `<div class="translator-grid">${translatorsHtml}</div>` : '<p class="block-empty-note">目前還沒有譯者,敬請期待。</p>'}
</section>
`;

  return { title: '標題標題標題標題標題', body };
}

module.exports = { renderHomepage };
