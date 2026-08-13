'use strict';

const { escapeHtml } = require('./layout');

const COVER_CLASSES = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
const AVATAR_COLORS = ['var(--indigo)', 'var(--seal)', '#5b6b4f', '#8a6a3f', '#3a5560', '#7a3f56'];

// 只吃扁平、已經整理好的顯示用資料(view model),不碰 work_id/edition_url
// 這類內部資料結構——那些查找/反查邏輯留在 build.js,這裡純粹是「資料轉 HTML」。

function renderLatestCard(item, index) {
  const coverClass = COVER_CLASSES[index % COVER_CLASSES.length];
  return `<a class="card" href="${escapeHtml(item.url)}">
      <div class="cover ${coverClass}"><span class="cover-title">${escapeHtml(item.workTitle)}</span></div>
      <div class="card-title-cn">${escapeHtml(item.title)}</div>
      <div class="card-meta">譯者・${escapeHtml(item.translatorId)}${item.date ? `　·　${escapeHtml(item.date)}` : ''}</div>
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
 * @param {Array<{url:string,title:string,translatorId:string,date:?string,workTitle:string}>} data.latestTranslations
 * @param {Array<{url:string,displayName:string,bio:?string,count:number}>} data.translatorList
 */
function renderHomepage({ latestTranslations, translatorList }) {
  const latestHtml = latestTranslations.map(renderLatestCard).join('\n');
  const translatorsHtml = translatorList.map(renderTranslatorCard).join('\n');

  const body = `
<section class="hero">
  <div>
    <div class="hero-eyebrow">非營利 · 開源典藏 · 讀者共築</div>
    <h1 class="serif">把海的那一邊<br>寫成的故事,<span class="kanji-accent">渡</span>給你。</h1>
    <p class="lede">一個由讀者與譯者共同維護的翻譯典藏站。沒有廣告,沒有付費牆——你的每一次閱讀,就是給譯者最直接的回饋。</p>
    <div class="hero-actions">
      <a class="btn btn-primary serif" href="#latest">開始閱讀 →</a>
      <a class="btn btn-ghost" href="https://github.com/shellkz/PublicTranslationWebsite/blob/main/CONTRIBUTING.md">關於這個計畫</a>
    </div>
    <div class="no-ads-note"><span class="dot"></span>本站永久無廣告、無追蹤、原始碼公開於 GitHub</div>
  </div>
  <div class="shelf">
    <div class="shelf-line"></div>
  </div>
</section>

<section class="block" id="latest">
  <div class="block-head">
    <div class="block-title serif">最新譯作 <span class="jp">Latest Translations</span></div>
  </div>
  ${latestTranslations.length ? `<div class="grid">${latestHtml}</div>` : '<p class="block-empty-note">目前還沒有譯文,敬請期待。</p>'}
</section>

<section class="block" id="series" style="background:var(--paper-deep); border-top:1px solid rgba(32,31,27,0.08); border-bottom:1px solid rgba(32,31,27,0.08); max-width:none; padding-left:0; padding-right:0;">
  <div style="max-width:1180px; margin:0 auto; padding:0 28px;">
    <div class="block-head">
      <div class="block-title serif">連載系列 <span class="jp">Ongoing Series</span></div>
    </div>
    <p class="block-empty-note">此功能尚未推出。</p>
  </div>
</section>

<section class="block" id="translators">
  <div class="block-head">
    <div class="block-title serif">譯者一覽 <span class="jp">Translators</span></div>
  </div>
  ${translatorList.length ? `<div class="translator-grid">${translatorsHtml}</div>` : '<p class="block-empty-note">目前還沒有譯者,敬請期待。</p>'}
</section>
`;

  return { title: '渡書 とうしょ｜個人翻譯典藏站', body };
}

module.exports = { renderHomepage };
