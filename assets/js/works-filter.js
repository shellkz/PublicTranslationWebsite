'use strict';

// 全作品列表頁的篩選邏輯。全部卡片已經在 build 時就完整渲染進 HTML(見 works-index.js),
// 這支腳本只負責讀每張卡片的 data-* 屬性、跟目前的篩選條件比對、切換顯示/隱藏——
// 沒有 JS 時,頁面本身就是「顯示全部作品」的完整清單,不影響內容可見性。

(function () {
  function normalize(str) {
    return (str || '').toLowerCase().trim();
  }

  function getFilterState() {
    return {
      q: normalize(document.getElementById('f-search').value),
      author: normalize(document.getElementById('f-author').value),
      translator: normalize(document.getElementById('f-translator').value),
      category: document.getElementById('f-category').value,
      language: document.getElementById('f-language').value,
      tags: Array.from(document.querySelectorAll('.filter-tags-options input:checked')).map((el) => el.value),
    };
  }

  function cardMatches(card, state) {
    const title = normalize(card.dataset.title);
    const author = normalize(card.dataset.author);
    // 一部作品可能有多位譯者,data-translator 是逗號分隔清單(跟 data-tags 同款處理)——
    // 只要輸入的字串是「任何一位」譯者名稱的子字串就算符合。
    const translators = (card.dataset.translator || '').split(',').filter(Boolean).map(normalize);
    const category = card.dataset.category || '';
    const language = card.dataset.language || '';
    const tags = (card.dataset.tags || '').split(',').filter(Boolean);

    return (
      (!state.q || title.includes(state.q)) &&
      (!state.author || author.includes(state.author)) &&
      (!state.translator || translators.some((t) => t.includes(state.translator))) &&
      (!state.category || category === state.category) &&
      (!state.language || language === state.language) &&
      state.tags.every((tag) => tags.includes(tag))
    );
  }

  function applyFilters() {
    const grid = document.getElementById('works-grid');
    const emptyNote = document.getElementById('works-empty-note');
    if (!grid) return;

    const state = getFilterState();
    let anyVisible = false;

    grid.querySelectorAll('.card').forEach((card) => {
      const matches = cardMatches(card, state);
      card.style.display = matches ? '' : 'none';
      if (matches) anyVisible = true;
    });

    if (emptyNote) emptyNote.style.display = anyVisible ? 'none' : '';
  }

  function init() {
    const form = document.getElementById('works-filters');
    if (!form) return;

    // 首頁的搜尋框把查詢字串帶到這一頁,一進頁就套用
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) document.getElementById('f-search').value = q;

    form.addEventListener('submit', (e) => e.preventDefault());
    form.querySelectorAll('input, select').forEach((el) => {
      el.addEventListener('input', applyFilters);
      el.addEventListener('change', applyFilters);
    });

    applyFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
