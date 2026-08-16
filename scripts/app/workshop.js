'use strict';

// /workshop/create-translation/ 的靜態頁面骨架。永遠是三個表單區塊
// ——新增翻譯、新增作品、新增作者——結構本身不會被拆開。循序揭露
// (depth-first)發生在**每個區塊內部**:一開始只看得到「新增翻譯」
// 這個區塊,而且只看得到裡面的作品搜尋欄;選到既有作品,或往下把
// 依賴的作品/作者都解完,才會逐步 unhide 同一個區塊裡剩下的欄位、
// 或是讓下一個區塊整個出現——不是把欄位拆成更多獨立區塊。
//
// 「純資料欄位」的群組(作者自己的欄位、來源版本欄位、作品剩餘欄位)
// 結尾都放一顆「完成」按鈕,必填欄位沒填完/格式不合法時按鈕是 disabled
// 的——不是欄位一變合法就自動跳下一步,避免文字欄位打到一半就被誤判
// 成做完了。每個欄位旁邊的 ✓ 記號則是即時的欄位層級驗證提示,跟按鈕
// 是否可按互相獨立(見 assets/js/workshop.js)。
// 這支檔案本身只負責吐出完整的 HTML 結構,不含任何互動邏輯
// (見架構規格.md、開發者指南.md)。

// 目前只收青空文庫、古騰堡計畫這兩個來源(避免自行認定公版狀態帶來的
// 著作權風險,見翻譯者指南.md),用 pattern 屬性擋掉其他網址——跟
// assets/js/workshop.js 的 AOZORA_WORK_RE/GUTENBERG_WORK_RE 等呼應,
// build.js 那邊也有一份對應的硬性檢查,這裡的 pattern 只是前端先擋一次,
// 真正的把關還是在 build 那層。
const EDITION_URL_PATTERN =
  'https://www\\.aozora\\.gr\\.jp/cards/\\d+/card\\d+\\.html|https://www\\.aozora\\.gr\\.jp/cards/\\d+/files/\\d+_\\d+\\.html|https://www\\.gutenberg\\.org/ebooks/\\d+/?|https://www\\.gutenberg\\.org/cache/epub/\\d+/.+';
const AUTHOR_SOURCE_URL_PATTERN =
  'https://www\\.aozora\\.gr\\.jp/index_pages/person\\d+\\.html|https://www\\.gutenberg\\.org/ebooks/author/\\d+/?';
const WIKIDATA_URL_PATTERN = 'https://www\\.wikidata\\.org/(wiki|entity)/Q\\d+';

function renderLanguageOptions() {
  return `
<option value="ja">日文</option>
<option value="en">英文</option>
<option value="zh">中文</option>`;
}

function renderTranslationFieldset() {
  return `
<fieldset class="workshop-fieldset">
  <legend>新增翻譯</legend>

  <div class="filter-field">
    <label for="work-search">要翻譯哪部作品——搜尋既有作品(標題 / Wikidata 連結 / 來源網址)</label>
    <div class="workshop-search-row">
      <input type="search" id="work-search" placeholder="輸入標題,或貼上作品的來源網址/Wikidata 連結" autocomplete="off">
      <button type="button" id="work-search-clear" class="workshop-clear" aria-label="清除選取">✕</button>
    </div>
  </div>
  <div id="work-search-results" class="workshop-results"></div>
  <input type="hidden" id="work-id" required>

  <div class="filter-field" id="edition-field" hidden>
    <label for="edition-url">依據哪個來源版本 <span class="field-check" aria-hidden="true">✓</span></label>
    <select id="edition-url" required></select>
  </div>

  <div id="translation-own-fields" hidden>
    <div class="filter-field">
      <label for="t-language">翻譯目標語言 <span class="field-check" aria-hidden="true">✓</span></label>
      <select id="t-language" required>${renderLanguageOptions()}</select>
    </div>
    <div class="filter-field">
      <label for="t-title">譯文標題 <span class="field-check" aria-hidden="true">✓</span></label>
      <input type="text" id="t-title" required>
    </div>
    <div class="filter-field">
      <label for="t-excerpt">譯文摘要 <span class="field-check" aria-hidden="true">✓</span></label>
      <textarea id="t-excerpt" rows="2"></textarea>
    </div>
    <input type="hidden" id="t-date">
    <button type="button" id="translation-own-fields-done" class="workshop-group-done" disabled>完成翻譯資訊 ↓</button>
  </div>
</fieldset>`;
}

function renderWorkCreateSection() {
  return `
<section id="work-create-section" class="workshop-block" hidden>
  <h2 class="workshop-block-title">新增作品</h2>
  <p class="workshop-subheading">作品的翻譯目標語言標題會直接沿用「新增翻譯」的譯文標題欄位,不用重複填一次</p>

  <div class="filter-field">
    <label for="author-search">原作者是誰——搜尋既有原作者(姓名 / Wikidata 連結)</label>
    <div class="workshop-search-row">
      <input type="search" id="author-search" placeholder="輸入姓名,或貼上 Wikidata 連結" autocomplete="off">
      <button type="button" id="author-search-clear" class="workshop-clear" aria-label="清除選取">✕</button>
    </div>
  </div>
  <div id="author-search-results" class="workshop-results"></div>
  <input type="hidden" id="author-id" required>

  <div id="work-edition-fields" hidden>
    <p class="workshop-subheading">來源版本(至少一筆)</p>
    <div class="filter-field">
      <label for="e-url">版本連結 <span class="field-check" aria-hidden="true">✓</span></label>
      <input type="url" id="e-url" required pattern="${EDITION_URL_PATTERN}"
        placeholder="例:https://www.aozora.gr.jp/cards/000035/files/1567_14913.html"
        title="只接受青空文庫、古騰堡計畫的作品資訊頁或本文頁連結">
    </div>
    <div class="filter-field">
      <label for="e-language">版本語言 <span class="field-check" aria-hidden="true">✓</span></label>
      <select id="e-language" required>${renderLanguageOptions()}</select>
    </div>
    <div class="filter-field">
      <label for="e-publisher">出版社/底本(選填) <span class="field-check" aria-hidden="true">✓</span></label>
      <input type="text" id="e-publisher">
    </div>
    <div class="filter-field">
      <label for="e-date">出版日期(選填) <span class="field-check" aria-hidden="true">✓</span></label>
      <input type="text" id="e-date">
    </div>
    <div class="filter-field">
      <label for="e-copyright-status">著作權狀態 <span class="field-check" aria-hidden="true">✓</span></label>
      <select id="e-copyright-status" required>
        <option value="日本公版">日本公版</option>
        <option value="美國公版">美國公版</option>
      </select>
    </div>
    <button type="button" id="work-edition-fields-done" class="workshop-group-done" disabled>完成版本資訊 →</button>
  </div>

  <div id="work-own-fields" hidden>
    <div class="filter-field">
      <label for="w-title-native">原文標題 <span class="field-check" aria-hidden="true">✓</span></label>
      <input type="text" id="w-title-native" required>
    </div>
    <div class="filter-field">
      <label for="w-tags">標籤(逗號分隔,選填) <span class="field-check" aria-hidden="true">✓</span></label>
      <input type="text" id="w-tags">
    </div>
    <div class="filter-field">
      <label for="w-category">分類(選填) <span class="field-check" aria-hidden="true">✓</span></label>
      <input type="text" id="w-category">
    </div>
    <button type="button" id="work-own-fields-done" class="workshop-group-done" disabled>完成作品資訊 →</button>
  </div>
</section>`;
}

function renderAuthorCreateSection() {
  return `
<section id="author-create-section" class="workshop-block" hidden>
  <h2 class="workshop-block-title">新增作者</h2>
  <div class="filter-field">
    <label for="a-source-url">來源站作者連結(選填) <span class="field-check" aria-hidden="true">✓</span></label>
    <input type="url" id="a-source-url" pattern="${AUTHOR_SOURCE_URL_PATTERN}"
      placeholder="例:https://www.aozora.gr.jp/index_pages/person35.html"
      title="只接受青空文庫、古騰堡計畫的作者資訊頁連結">
  </div>
  <div class="filter-field">
    <label for="a-wikidata-link">Wikidata 作者連結(選填,有的話姓名等資訊會自動帶出) <span class="field-check" aria-hidden="true">✓</span></label>
    <input type="url" id="a-wikidata-link" pattern="${WIKIDATA_URL_PATTERN}"
      placeholder="例:https://www.wikidata.org/wiki/Q317685"
      title="Wikidata 條目連結,格式如 https://www.wikidata.org/wiki/Q317685">
  </div>
  <div class="filter-field">
    <label for="a-name-native">原文姓名 <span class="field-check" aria-hidden="true">✓</span></label>
    <input type="text" id="a-name-native" required>
  </div>
  <div class="filter-field">
    <label for="a-name-target">目標語言姓名 <span class="field-check" aria-hidden="true">✓</span></label>
    <input type="text" id="a-name-target" required>
  </div>
  <button type="button" id="author-create-section-done" class="workshop-group-done" disabled>完成作者資訊 →</button>
</section>`;
}

function renderWorkshop() {
  const body = `
<div class="detail-hero">
  <h1>新增翻譯</h1>
  <p class="desc">先找要翻譯的作品開始——找不到既有作品/作者時,可以順便一起登記,表單會依序往下解鎖,不用一次面對整個大表單。填完之後怎麼提交,見<a href="https://github.com/shellkz/PublicTranslationWebsite/blob/main/docs/翻譯者指南.md">翻譯者指南</a>。</p>
</div>
<form id="workshop-form" class="works-filters workshop-form" novalidate>
  ${renderTranslationFieldset()}
  ${renderWorkCreateSection()}
  ${renderAuthorCreateSection()}
  <button type="submit" id="workshop-submit" class="workshop-submit">產生檔案內容</button>
</form>
<div id="workshop-output"></div>
<script src="/assets/js/workshop.js" defer></script>
`;

  return { title: '新增翻譯', body, canonical: '/workshop/create-translation/' };
}

module.exports = { renderWorkshop };
