'use strict';

// 共用外殼(<head> + header + footer)。目前只有 homepage.js 使用,
// 但刻意設計成跟頁面內容無關,未來其他頁面(translation/work/translator...)
// 要換成這份新版視覺時可以直接複用,不用重寫 header/footer/CSS 引用。

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
      <span class="logo-cn serif">標題</span>
      <span class="logo-jp">副標題</span>
    </div>
    <nav>
      <a href="/#about">關於本站</a>
    </nav>
  </div>
</header>

${body}

<footer id="about">
  <div class="footer-inner">
    <div>
      <div class="footer-brand serif">標題</div>
      <div class="footer-note">描述描述描述描述描述描述描述描述</div>
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
