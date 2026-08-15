'use strict';

// /workshop/create-translation/ 的靜態頁面骨架。翻譯表單是主體,一直顯示;
// 「作品」區塊、「作品裡的作者」區塊預設隱藏,靠 assets/js/workshop.js
// 在使用者選「找不到,登記新作品/新作者」時切換顯示——這支檔案本身
// 只負責吐出完整的 HTML 結構,不含任何互動邏輯(見架構規格.md、開發者指南.md)。

function renderTranslationFieldset() {
  return `
<fieldset class="workshop-fieldset">
  <legend>這篇翻譯</legend>
  <div class="filter-field">
    <label for="t-title">譯文標題</label>
    <input type="text" id="t-title" required>
  </div>
  <div class="filter-field">
    <label for="t-date">提交日期</label>
    <input type="date" id="t-date" readonly>
  </div>
  <div class="filter-field">
    <label for="t-excerpt">摘要</label>
    <textarea id="t-excerpt" rows="2"></textarea>
  </div>
  <div class="filter-field">
    <label for="t-language">譯文語言</label>
    <select id="t-language" required>
      <option value="zh">繁體中文</option>
    </select>
  </div>
  <div class="filter-field">
    <label for="work-search">依據作品——搜尋既有作品(標題 / Wikidata 連結 / 來源網址)</label>
    <input type="search" id="work-search" placeholder="輸入標題,或貼上作品的來源網址/Wikidata 連結" autocomplete="off">
  </div>
  <div id="work-search-results" class="workshop-results"></div>
  <div class="filter-field">
    <label for="edition-url">依據哪個來源版本</label>
    <select id="edition-url" required disabled>
      <option value="">先選擇作品</option>
    </select>
  </div>
  <button type="button" id="work-create-toggle" class="workshop-toggle">找不到?登記新作品</button>
  <input type="hidden" id="work-id" required>

  <div id="work-create-section" class="workshop-nested" hidden>
    ${renderWorkFields()}
  </div>
</fieldset>`;
}

function renderWorkFields() {
  return `
<div class="filter-field">
  <label for="w-title-zh">作品標題(中文)</label>
  <input type="text" id="w-title-zh" required>
</div>
<div class="filter-field">
  <label for="w-title-native">原文標題(選填)</label>
  <input type="text" id="w-title-native">
</div>
<div class="filter-field">
  <label for="w-original-language">原文語言</label>
  <input type="text" id="w-original-language" placeholder="例:ja、en" required>
</div>
<div class="filter-field">
  <label for="w-tags">標籤(逗號分隔,選填)</label>
  <input type="text" id="w-tags">
</div>
<div class="filter-field">
  <label for="w-category">分類(選填)</label>
  <input type="text" id="w-category">
</div>

${renderAuthorPicker()}

<fieldset class="workshop-fieldset">
  <legend>來源版本(至少一筆)</legend>
  <div class="filter-field">
    <label for="e-url">來源網址</label>
    <input type="url" id="e-url" required>
  </div>
  <div class="filter-field">
    <label for="e-language">該版本語言</label>
    <input type="text" id="e-language" required>
  </div>
  <div class="filter-field">
    <label for="e-publisher">出版社/底本(選填)</label>
    <input type="text" id="e-publisher">
  </div>
  <div class="filter-field">
    <label for="e-date">出版日期(選填)</label>
    <input type="text" id="e-date">
  </div>
  <div class="filter-field">
    <label for="e-copyright-status">公版/著作權狀態</label>
    <input type="text" id="e-copyright-status" placeholder="例:日本公版" required>
  </div>
</fieldset>`;
}

function renderAuthorPicker() {
  return `
<fieldset class="workshop-fieldset">
  <legend>原作者</legend>
  <div class="filter-field">
    <label for="author-search">搜尋既有原作者(姓名 / Wikidata 連結)</label>
    <input type="search" id="author-search" placeholder="輸入姓名,或貼上 Wikidata 連結" autocomplete="off">
  </div>
  <div id="author-search-results" class="workshop-results"></div>
  <button type="button" id="author-create-toggle" class="workshop-toggle">找不到?登記新作者</button>
  <input type="hidden" id="author-id" required>

  <div id="author-create-section" class="workshop-nested" hidden>
    ${renderAuthorFields()}
  </div>
</fieldset>`;
}

function renderAuthorFields() {
  return `
<div class="filter-field">
  <label for="a-wikidata-id">Wikidata QID(選填,有的話姓名等資訊會自動帶出)</label>
  <input type="text" id="a-wikidata-id" placeholder="例:Q317685">
</div>
<div class="filter-field">
  <label for="a-name-native">姓名(原文)</label>
  <input type="text" id="a-name-native">
</div>
<div class="filter-field">
  <label for="a-name-zh">姓名(中文)</label>
  <input type="text" id="a-name-zh">
</div>
<div class="filter-field">
  <label for="a-source-url">來源站作者頁連結(選填)</label>
  <input type="url" id="a-source-url">
</div>`;
}

function renderWorkshop() {
  const body = `
<div class="detail-hero">
  <h1>登記新翻譯</h1>
  <p class="desc">填好下面的表單,會產生對應的檔案內容;找不到既有作品/作者時,可以順便一起登記,不用分開跑好幾次。填完之後怎麼提交,見<a href="https://github.com/shellkz/PublicTranslationWebsite/blob/main/docs/翻譯者指南.md">翻譯者指南</a>。</p>
</div>
<form id="workshop-form" class="works-filters workshop-form">
  ${renderTranslationFieldset()}
  <button type="submit" class="workshop-submit">產生檔案內容</button>
</form>
<div id="workshop-output"></div>
<script src="/assets/js/workshop.js" defer></script>
`;

  return { title: '登記新翻譯', body, canonical: '/workshop/create-translation/' };
}

module.exports = { renderWorkshop };
