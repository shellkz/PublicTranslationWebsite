'use strict';

// header 漢堡選單。<html> 預設帶 no-js class,layout.js 的 inline script
// 一旦執行就換成 js class——只有換成 js 之後,CSS 才會把 nav 收起來、
// 顯示這顆按鈕(見 style.css)。這支腳本沒載入或執行失敗時,nav 維持展開
// 的 no-js 預設狀態,e-reader/JS 關閉的環境依然能看到完整導覽。

(function () {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', function () {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
})();
