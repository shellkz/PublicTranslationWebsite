'use strict';

// 共用外殼(<head> + header + footer)。build.js 統一透過這裡輸出每一種頁面
// (homepage/works-index/translation/work/translator/source-author/
// source-translator/tag),刻意設計成跟頁面內容無關,新增頁面類型時只要吃
// { title, body, canonical } 就能直接套用,不用重寫 header/footer/CSS 引用。

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function renderLayout({ title, body, canonical }) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">\n` : ''}<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;500;700;900&family=Shippori+Mincho:wght@400;500;700&family=Noto+Sans+TC:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
<header>
  <div class="header-inner">
    <div class="logo">
      <span class="logo-cn serif">公領域書籍翻譯閱讀平台</span>
      <span class="logo-jp">翻譯者可以貢獻翻譯，讀者可以免費閱讀，還在開發中</span>
    </div>
    <nav>
      <a href="/works/">全部作品</a>
      <a href="/#about">關於本站</a>
    </nav>
  </div>
</header>

${body}

<footer id="about">
  <div class="footer-inner">
    <div class="footer-about">
      <div class="footer-brand serif">公領域書籍翻譯閱讀平台</div>
      <div class="footer-note">青空文庫、古騰堡計畫等公版書籍的社群翻譯典藏站,透過 GitHub Pull Request 收錄譯者貢獻的中譯版本,人人皆可免費閱讀、轉載、改作。</div>
      <dl class="footer-roles">
        <div class="footer-role">
          <dt>讀者</dt>
          <dd>免費閱讀、轉載、改作站上所有譯文(<a href="https://github.com/shellkz/PublicTranslationWebsite/blob/main/LICENSE">CC BY-SA 4.0</a>),不需要註冊帳號。</dd>
        </div>
        <div class="footer-role">
          <dt>譯者</dt>
          <dd>用 GitHub 帳號提交譯文,著作權仍屬於你本人,PR 通過自動檢查即可上線,目前不須額外等待人工審核。詳見<a href="https://github.com/shellkz/PublicTranslationWebsite/blob/main/docs/翻譯者指南.md">翻譯者指南</a>。</dd>
        </div>
        <div class="footer-role">
          <dt>開發者</dt>
          <dd>站台程式碼採 <a href="https://github.com/shellkz/PublicTranslationWebsite/blob/main/scripts/LICENSE">MIT</a> 授權,歡迎提交 PR 改進功能。詳見<a href="https://github.com/shellkz/PublicTranslationWebsite/blob/main/docs/開發者指南.md">開發者指南</a>。</dd>
        </div>
      </dl>
    </div>
    <div class="footer-links">
      <a href="https://github.com/shellkz/PublicTranslationWebsite">GitHub 原始碼</a>
      <a href="https://github.com/shellkz/PublicTranslationWebsite/blob/main/CONTRIBUTING.md">投稿須知</a>
    </div>
  </div>
</footer>
</body>
</html>
`;
}

module.exports = { renderLayout, escapeHtml };
