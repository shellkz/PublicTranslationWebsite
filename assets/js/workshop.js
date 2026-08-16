'use strict';

// /workshop/create-translation/ 的搜尋 + 循序揭露邏輯。
//
// 表單結構永遠是三個區塊(新增翻譯、新增作品、新增作者),不會被拆開;
// 循序揭露發生在**每個區塊內部**——一次只解鎖一步,不會因為某個決定
// 做了就把後面好幾步一次全開。依賴鏈是單向的:翻譯 → 作品 → 作者,
// 畫面上對應反過來,由淺入深,每一步的觸發時機不一樣:
//   work-search(一開始就看得到,新增翻譯區塊裡)
//     → 選到既有作品(有明確的點擊動作):work_id 已確定,直接開放
//       「新增翻譯」剩下的欄位(#translation-own-fields)
//     → 登錄新作品:讓「新增作品」整個區塊出現,但裡面先只看得到作者搜尋欄
//         → 選到既有作者(點擊):只往下開放一步(#work-edition-fields 來源版本)
//         → 登錄新作者(點擊):只開放「新增作者」自己的欄位(#author-create-section),
//           其餘(來源版本、原文標題等)都還收著
//
// 「純資料欄位」的區塊(作者自己的欄位、來源版本欄位、作品剩餘欄位)沒有
// 明確的「選擇」動作,結尾各放一顆「完成」按鈕——必填欄位還沒通過瀏覽器
// 原生驗證(required / type="url" 等)時按鈕是 disabled 的,按下去才揭露
// 下一步,見 wireGroupCompletion()。不是欄位一變合法就自動往下跳,避免
// 文字欄位打到一半(例如標題才打兩三個字,已經算「非空」)就被誤判成
// 做完了。串起來就是:作者自己的欄位填完按「完成」→ 來源版本出現 →
// 填完按「完成」→ 作品剩餘欄位出現 → 填完按「完成」→ 翻譯自己的欄位出現。
//
// 每個欄位旁邊另外有一個 ✓ 記號,即時反映「這個欄位目前的值有沒有通過
// 驗證」,純粹是視覺提示,跟按鈕能不能按是各自獨立的兩套邏輯,見
// refreshFieldIndicator()。「完成」按鈕按下去之後會自己隱藏,避免重複
// 觸發;區塊被上層 cascade 收合時,裡面填過的值、✓ 記號、按鈕本身的
// 顯示/disabled 狀態都會一起還原,見 resetGroupFields()/resetGroupDoneButton()。
//
// 揭露只往下疊(累積式),已經出現的不會自動收合;但清除/重新搜尋時會
// 依單向依賴的方向級聯收合——收掉作品,連作品裡的作者一起收掉;收掉
// 作者,不影響「要不要新增這個作品」這個決定本身(新增作品區塊仍在)。
//
// 「產生檔案內容」按下去之後(見 handleSubmit()):依表單最終狀態組出
// 1~3 份檔案內容(翻譯一定要,新增作品/新增作者是選擇性的,依 work-id/
// author-id 這兩個隱藏欄位有沒有值判斷),用 codeblock + 複製按鈕依序
// 顯示在同一頁下方,不會真的寫檔——這個工具只到「產生內容給你貼上
// GitHub 網頁」為止,實際送出還是走翻譯者指南裡描述的 PR 流程。
// 送出按鈕本身沒有被 hidden 屬性擋住(從頭到尾都在畫面上),所以
// submit 時額外檢查 translation-own-fields 是否已經解鎖到——如果還沒,
// 代表使用者跳過中間步驟直接按到底下的按鈕,擋下來而不是生成殘缺內容。

(function () {
  function normalize(str) {
    return (str || '').toLowerCase().trim();
  }

  function clearNode(node) {
    if (node) node.innerHTML = '';
  }

  // 支援直接貼 Wikidata 網址,或單純打 QID 本身
  function extractWikidataId(query) {
    const q = (query || '').trim();
    const urlMatch = q.match(/wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i);
    if (urlMatch) return urlMatch[1].toUpperCase();
    if (/^Q\d+$/i.test(q)) return q.toUpperCase();
    return null;
  }

  // 目前只收青空文庫、古騰堡計畫這兩個來源(見架構規格.md)。同一部作品的
  // 「作品資訊頁」跟「本文頁」用的是同一個作品編號(青空文庫:card42618.html
  // 跟 files/42618_21410.html 都是 42618;古騰堡:ebooks/79366 跟
  // cache/epub/79366/... 也都是 79366),所以認是不是同一份來源不能只比
  // 對網址字串是否完全相同,要先各自解析出編號再比對編號——跟 build.js 的
  // AOZORA_ID_RE/GUTENBERG_ID_RE 呼應,但這裡多認得「資訊頁」格式。
  const AOZORA_WORK_RE = /^https:\/\/www\.aozora\.gr\.jp\/cards\/\d+\/(?:card(\d+)\.html|files\/(\d+)_\d+\.html)$/;
  const AOZORA_AUTHOR_RE = /^https:\/\/www\.aozora\.gr\.jp\/index_pages\/person(\d+)\.html$/;
  const GUTENBERG_WORK_RE = /^https:\/\/www\.gutenberg\.org\/(?:ebooks\/(\d+)\/?|cache\/epub\/(\d+)\/.+)$/;
  const GUTENBERG_AUTHOR_RE = /^https:\/\/www\.gutenberg\.org\/ebooks\/author\/(\d+)\/?$/;

  function extractWorkSourceId(url) {
    const u = (url || '').trim();
    const aozora = u.match(AOZORA_WORK_RE);
    if (aozora) return `aozora:${aozora[1] || aozora[2]}`;
    const gutenberg = u.match(GUTENBERG_WORK_RE);
    if (gutenberg) return `gutenberg:${gutenberg[1] || gutenberg[2]}`;
    return null;
  }

  function extractAuthorSourceId(url) {
    const u = (url || '').trim();
    const aozora = u.match(AOZORA_AUTHOR_RE);
    if (aozora) return `aozora:${aozora[1]}`;
    const gutenberg = u.match(GUTENBERG_AUTHOR_RE);
    if (gutenberg) return `gutenberg:${gutenberg[1]}`;
    return null;
  }

  // 跟 build.js 的比對邏輯呼應:wikidata_id 精確符合 > 來源網址(依編號正規化後比對,
  // 不是單純字串完全相同)> 標題部分符合
  function matchWork(query, work) {
    const q = normalize(query);
    if (!q) return false;
    const qid = extractWikidataId(query);
    if (qid && work.wikidataId && work.wikidataId.toUpperCase() === qid) return true;
    const querySourceId = extractWorkSourceId(query);
    if (
      (work.editions || []).some((e) => {
        if (!e.url) return false;
        if (e.url.trim() === query.trim()) return true;
        return querySourceId && extractWorkSourceId(e.url) === querySourceId;
      })
    ) {
      return true;
    }
    if (work.title && normalize(work.title).includes(q)) return true;
    return false;
  }

  function matchAuthor(query, author) {
    const q = normalize(query);
    if (!q) return false;
    const qid = extractWikidataId(query);
    if (qid && author.wikidataId && author.wikidataId.toUpperCase() === qid) return true;
    if (author.sourceUrl) {
      if (author.sourceUrl.trim() === query.trim()) return true;
      const querySourceId = extractAuthorSourceId(query);
      if (querySourceId && extractAuthorSourceId(author.sourceUrl) === querySourceId) return true;
    }
    if (author.name && normalize(author.name).includes(q)) return true;
    return false;
  }

  function appendResultRow(container, label, meta, onPick) {
    const row = document.createElement('div');
    row.className = 'workshop-result-item';
    row.setAttribute('role', 'button');
    row.tabIndex = 0;

    const strong = document.createElement('strong');
    strong.textContent = label;
    row.appendChild(strong);

    if (meta) {
      const metaEl = document.createElement('span');
      metaEl.className = 'workshop-result-meta';
      metaEl.textContent = meta;
      row.appendChild(document.createTextNode(' '));
      row.appendChild(metaEl);
    }

    row.addEventListener('click', onPick);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPick();
      }
    });
    container.appendChild(row);
  }

  // 既有項目的搜尋結果 + 固定放在最後一項的「登錄新___」,樣式統一,
  // 不管有沒有找到符合的既有項目,這一項永遠都在——不是另外一個獨立按鈕。
  function renderPickList(container, matches, labelOf, metaOf, onPick, createLabel, onCreateNew) {
    clearNode(container);
    matches.forEach((item) => {
      appendResultRow(container, labelOf(item), metaOf(item), () => onPick(item));
    });
    appendResultRow(container, createLabel, null, onCreateNew);
  }

  function renderConfirmation(container, primaryText, metaText, uuid) {
    clearNode(container);
    const box = document.createElement('div');
    box.className = 'workshop-confirm';

    const line = document.createElement('div');
    line.appendChild(document.createTextNode('已選擇:'));
    const strong = document.createElement('strong');
    strong.textContent = primaryText;
    line.appendChild(strong);
    if (metaText) {
      line.appendChild(document.createTextNode(`(${metaText})`));
    }
    box.appendChild(line);

    const uuidLine = document.createElement('div');
    uuidLine.className = 'workshop-uuid';
    uuidLine.textContent = `uuid: ${uuid}`;
    box.appendChild(uuidLine);

    container.appendChild(box);
  }

  function populateEditions(work) {
    const field = document.getElementById('edition-field');
    const select = document.getElementById('edition-url');
    if (!field || !select) return;
    clearNode(select);
    const editions = work.editions || [];
    if (!editions.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '這部作品還沒有登記任何來源版本';
      select.appendChild(opt);
      showSection('edition-field');
      return;
    }
    editions.forEach((e) => {
      const opt = document.createElement('option');
      opt.value = e.url;
      opt.textContent = e.publisher ? `${e.language}・${e.publisher}` : e.language;
      select.appendChild(opt);
    });
    showSection('edition-field');
  }

  function hideEditionField() {
    const field = document.getElementById('edition-field');
    const select = document.getElementById('edition-url');
    if (field) field.hidden = true;
    if (select) clearNode(select);
  }

  // 解鎖新區塊時,把畫面捲過去給使用者看,不用自己往下找剛剛出現的地方。
  function showSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideSection(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }

  function resetPicker(searchId, resultsId, hiddenId) {
    const search = document.getElementById(searchId);
    const results = document.getElementById(resultsId);
    const hidden = document.getElementById(hiddenId);
    if (search) search.value = '';
    if (results) clearNode(results);
    if (hidden) hidden.value = '';
  }

  // ---- 依賴鏈由淺入深的顯示/收合(單向:收掉外層連內層一起收,收掉內層不影響外層)----

  // 收合一個「純資料欄位」區塊時,連裡面填過的值、✓ 記號都一起清掉——
  // 不然表單往回退之後,欄位裡還留著舊值,重新走一次流程會誤帶到上一輪
  // 填的東西。type="hidden" 的欄位(work-id/author-id/t-date)不在這裡處理,
  // 各自的呼叫端本來就有自己的清空邏輯。
  function resetGroupFields(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('input, select, textarea').forEach((el) => {
      if (el.type === 'hidden') return;
      if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
      } else {
        el.value = '';
      }
      const wrapper = el.closest('.filter-field');
      if (wrapper) wrapper.classList.remove('is-valid');
    });
  }

  // 「完成」按鈕按下去之後會自己隱藏(見 wireGroupCompletion),區塊被
  // 收合、要重新走一次流程時,要把按鈕重新顯示、恢復成 disabled。
  function resetGroupDoneButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.hidden = false;
    button.disabled = true;
  }

  // 下面「產生檔案內容」按下去之後出現的步驟引導區塊,是根據表單當下
  // 的狀態產生的一次性結果——表單只要有任何回退(不管從哪一層觸發),
  // 這份結果就跟目前表單內容對不上了,一起清掉,不留著舊的誤導使用者。
  function hideOutput() {
    const output = document.getElementById('workshop-output');
    if (output) clearNode(output);
  }

  function hideTranslationOwnFields() {
    hideSection('translation-own-fields');
    resetGroupFields('translation-own-fields');
    resetGroupDoneButton('translation-own-fields-done');
    hideOutput(); // 依賴鏈上所有回退路徑最終都會走到這裡,收在同一個進入點清空即可
  }

  function showTranslationOwnFields() {
    showSection('translation-own-fields');
  }

  function hideWorkOwnFields() {
    hideSection('work-own-fields');
    resetGroupFields('work-own-fields');
    resetGroupDoneButton('work-own-fields-done');
  }

  function showWorkOwnFields() {
    showSection('work-own-fields');
  }

  function hideWorkEditionFields() {
    hideSection('work-edition-fields');
    resetGroupFields('work-edition-fields');
    resetGroupDoneButton('work-edition-fields-done');
  }

  function showWorkEditionFields() {
    showSection('work-edition-fields');
  }

  // 從外部(例如作品搜尋框重新打字)放棄整個「登記新作者」流程時用——
  // 連同搜尋框本身的內容,以及依賴作者才會出現的區塊一起清空/收合。
  function hideAuthorCreateSection() {
    hideSection('author-create-section');
    resetPicker('author-search', 'author-search-results', 'author-id');
    resetGroupFields('author-create-section');
    resetGroupDoneButton('author-create-section-done');
    hideWorkEditionFields();
    hideWorkOwnFields();
    hideTranslationOwnFields();
  }

  // 在作者搜尋框「自己的」input 事件裡用——只收掉區塊、清掉隱藏的 uuid,
  // 不能連同搜尋框自己剛打的字一起清掉,不然每打一個字就會被自己清空。
  function exitAuthorCreateModeWhileTyping() {
    hideSection('author-create-section');
    const hiddenId = document.getElementById('author-id');
    if (hiddenId) hiddenId.value = '';
    resetGroupFields('author-create-section');
    resetGroupDoneButton('author-create-section-done');
    hideWorkEditionFields();
    hideWorkOwnFields();
    hideTranslationOwnFields();
  }

  function hideWorkCreateSection() {
    hideSection('work-create-section');
    hideAuthorCreateSection();
  }

  // 單一欄位目前的值有沒有通過驗證,即時反映在旁邊的 ✓ 記號 + 綠框上。
  // 直接借用瀏覽器原生的 Constraint Validation API(required / type="url"
  // 等 HTML attribute 就是驗證規則本身),不用另外重刻一套。空的選填欄位
  // 雖然 checkValidity() 會是 true,但刻意不算「通過」——沒填就沒有打勾
  // 的意義,只有實際填了值又合法才顯示。
  function refreshFieldIndicator(el) {
    const wrapper = el.closest('.filter-field');
    if (!wrapper) return;
    const filled = (el.value || '').trim() !== '';
    wrapper.classList.toggle('is-valid', filled && el.checkValidity());
  }

  function wireFieldIndicators(form) {
    if (!form) return;
    const handler = (e) => {
      if (e.target.matches('input, select, textarea')) refreshFieldIndicator(e.target);
    };
    form.addEventListener('input', handler);
    form.addEventListener('change', handler);
  }

  // 一個「純資料欄位」區塊結尾的「完成」按鈕:必填欄位全部通過驗證才會
  // 是可按的狀態,按下去才揭露下一步——不是欄位變合法的當下就自動跳過去。
  function wireGroupCompletion(containerId, requiredFieldIds, buttonId, onComplete) {
    const container = document.getElementById(containerId);
    const button = document.getElementById(buttonId);
    if (!container || !button) return;

    function refresh() {
      const valid = requiredFieldIds.every((id) => {
        const el = document.getElementById(id);
        return el && el.checkValidity();
      });
      button.disabled = !valid;
    }

    container.addEventListener('input', refresh);
    container.addEventListener('change', refresh);
    button.addEventListener('click', () => {
      if (button.disabled) return;
      button.hidden = true; // 這一步已經確認完成,按鈕自己收起來,避免被誤按第二次
      onComplete();
    });
    refresh();
  }

  function setupWorkSearch(works) {
    const input = document.getElementById('work-search');
    const results = document.getElementById('work-search-results');
    const hiddenId = document.getElementById('work-id');
    const clearBtn = document.getElementById('work-search-clear');
    if (!input || !results || !hiddenId) return;

    // 不依賴瀏覽器原生 type="search" 的清除鍵(readonly 狀態下不一定會顯示/生效),
    // 自己刻一顆清除按鈕,行為等同「把搜尋框清空」。
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.readOnly = false;
        input.value = '';
        hideWorkCreateSection();
        hiddenId.value = '';
        hideEditionField();
        clearNode(results);
      });
    }

    input.addEventListener('input', () => {
      input.readOnly = false; // 不管是點清除鍵清掉、還是想改回搜尋,先解除鎖定
      hideWorkCreateSection();
      hiddenId.value = '';
      hideEditionField();

      const q = input.value;
      if (!q.trim()) {
        clearNode(results);
        return;
      }
      const matches = works.filter((w) => matchWork(q, w));
      renderPickList(
        results,
        matches,
        (w) => w.title,
        (w) => w.authorName || '未知作者',
        (w) => {
          hiddenId.value = w.uuid;
          renderConfirmation(results, w.title, w.authorName, w.uuid);
          populateEditions(w);
          showTranslationOwnFields(); // 選到既有作品,work_id 已確定,可以開放翻譯自己的欄位
        },
        '登錄新作品',
        () => {
          hiddenId.value = '';
          hideEditionField();
          clearNode(results);
          input.value = '下方新增作品';
          input.readOnly = true;
          showSection('work-create-section'); // 先只問作者是誰,work-own-fields/翻譯欄位還不出現
        }
      );
    });
  }

  function setupAuthorSearch(authors) {
    const input = document.getElementById('author-search');
    const results = document.getElementById('author-search-results');
    const hiddenId = document.getElementById('author-id');
    const clearBtn = document.getElementById('author-search-clear');
    if (!input || !results || !hiddenId) return;

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.readOnly = false;
        input.value = '';
        exitAuthorCreateModeWhileTyping();
        hiddenId.value = '';
        clearNode(results);
      });
    }

    input.addEventListener('input', () => {
      input.readOnly = false; // 不管是點清除鍵清掉、還是想改回搜尋,先解除鎖定
      exitAuthorCreateModeWhileTyping();
      hiddenId.value = '';

      const q = input.value;
      if (!q.trim()) {
        clearNode(results);
        return;
      }
      const matches = authors.filter((a) => matchAuthor(q, a));
      renderPickList(
        results,
        matches,
        (a) => a.name,
        () => null,
        (a) => {
          hiddenId.value = a.uuid;
          renderConfirmation(results, a.name, null, a.uuid);
          showWorkEditionFields(); // 作者這個依賴解決了,只往下開放「來源版本」這一步,不跳過中間
        },
        '登錄新作者',
        () => {
          hiddenId.value = '';
          clearNode(results);
          input.value = '下方新增作者';
          input.readOnly = true;
          showSection('author-create-section'); // 依賴鏈到底,只開放作者自己的欄位,其餘等這裡填完再往下揭露
        }
      );
    });
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  // crypto.randomUUID() 需要安全context(https 或 localhost),用其他方式
  // (例如區網 IP、非 localhost 的 http)開發測試時會直接不存在;
  // crypto.getRandomValues() 沒有這個限制,不行的話才退到 Math.random——
  // 這裡只是拿來當顯示用的識別碼草稿,不是安全情境,不需要密碼學等級。
  function generateUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
      return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // 保守判斷:有任何一種可能讓這個字串在 YAML 裡被誤解成別的型別、或
  // 打斷 key: value 語法的情況,就用雙引號包起來——寧可多包不必要的引號
  // (仍然是合法 YAML),也不要漏掉真正需要引號的情況。
  function needsYamlQuote(str) {
    if (str === '') return true;
    if (/^\s|\s$/.test(str)) return true;
    if (/^[-?:,\[\]{}#&*!|>'"%@`]/.test(str)) return true;
    if (/:(\s|$)/.test(str)) return true;
    if (/\s#/.test(str)) return true;
    if (/[\n\t]/.test(str)) return true;
    if (/^(true|false|null|~|yes|no|on|off)$/i.test(str)) return true;
    if (/^-?\d+(\.\d+)?$/.test(str)) return true;
    return false;
  }

  function yamlScalar(value) {
    const str = String(value);
    return needsYamlQuote(str) ? JSON.stringify(str) : str;
  }

  function slugifyFilename(title) {
    const cleaned = (title || '').trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-');
    return cleaned || 'untitled';
  }

  function buildTranslationFile(d) {
    const lines = ['---'];
    lines.push(`uuid: ${d.uuid}`);
    lines.push(`work_id: ${d.workId}`);
    lines.push(`edition_url: ${yamlScalar(d.editionUrl)}`);
    lines.push(`title: ${yamlScalar(d.title)}`);
    if (d.language) lines.push(`language: ${yamlScalar(d.language)}`);
    lines.push(`date: ${d.date}`);
    if (d.excerpt) lines.push(`excerpt: ${yamlScalar(d.excerpt)}`);
    lines.push('---', '', '(請將譯文正文貼在這裡,取代這一行)');
    return {
      path: `content/translators/{你的翻譯者id}/${slugifyFilename(d.title)}.md`,
      content: lines.join('\n') + '\n',
    };
  }

  function buildWorkFile(d) {
    const lines = ['---'];
    lines.push(`uuid: ${d.uuid}`);
    lines.push('title:');
    lines.push(`  ${d.nativeLang}: ${yamlScalar(d.nativeTitle)}`);
    if (d.targetLang && d.targetLang !== d.nativeLang) {
      lines.push(`  ${d.targetLang}: ${yamlScalar(d.targetTitle)}`);
    }
    lines.push(`author_id: ${d.authorId}`);
    lines.push(`original_language: ${d.nativeLang}`);
    // tags 是 flow sequence(`[a, b]`),裡面的逗號/中括號/大括號在字串中間
    // 出現也會被當成分隔符提早截斷,不像一般 block scalar 只有開頭要擋——
    // 乾脆一律用雙引號包,不用 yamlScalar 那套「盡量不加引號」的判斷。
    const tags = (d.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length) lines.push(`tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]`);
    if (d.category) lines.push(`category: ${yamlScalar(d.category)}`);
    lines.push('editions:');
    lines.push(`  - url: ${yamlScalar(d.edition.url)}`);
    lines.push(`    language: ${yamlScalar(d.edition.language)}`);
    if (d.edition.publisher) lines.push(`    publisher: ${yamlScalar(d.edition.publisher)}`);
    if (d.edition.date) lines.push(`    date: ${yamlScalar(d.edition.date)}`);
    lines.push(`    copyright_status: ${yamlScalar(d.edition.copyrightStatus)}`);
    lines.push('    translator_id: null');
    lines.push('---', '');
    return {
      path: `content/works/${slugifyFilename(d.nativeTitle)}.md`,
      content: lines.join('\n') + '\n',
    };
  }

  function buildAuthorFile(d) {
    const lines = ['---'];
    lines.push(`uuid: ${d.uuid}`);
    if (d.wikidataId) lines.push(`wikidata_id: ${d.wikidataId}`);
    lines.push('names:');
    lines.push(`  ${d.nativeLang}: ${yamlScalar(d.nativeName)}`);
    if (d.targetLang && d.targetLang !== d.nativeLang) {
      lines.push(`  ${d.targetLang}: ${yamlScalar(d.targetName)}`);
    }
    if (d.sourceUrl) lines.push(`source_url: ${yamlScalar(d.sourceUrl)}`);
    lines.push('---', '');
    return {
      path: `content/source-authors/${slugifyFilename(d.nativeName)}.md`,
      content: lines.join('\n') + '\n',
    };
  }

  function renderCodeBlock(container, label, path, content) {
    const block = document.createElement('div');
    block.className = 'workshop-step';

    const heading = document.createElement('div');
    heading.className = 'workshop-step-label';
    heading.textContent = label;
    block.appendChild(heading);

    const pathEl = document.createElement('div');
    pathEl.className = 'workshop-step-path';
    pathEl.textContent = path;
    block.appendChild(pathEl);

    const wrapper = document.createElement('div');
    wrapper.className = 'workshop-code-wrapper';

    const pre = document.createElement('pre');
    pre.className = 'workshop-code';
    const code = document.createElement('code');
    code.textContent = content;
    pre.appendChild(code);
    wrapper.appendChild(pre);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'workshop-copy';
    copyBtn.textContent = '複製';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(
        () => {
          copyBtn.textContent = '已複製';
          setTimeout(() => { copyBtn.textContent = '複製'; }, 1500);
        },
        () => {
          copyBtn.textContent = '複製失敗';
          setTimeout(() => { copyBtn.textContent = '複製'; }, 1500);
        }
      );
    });
    wrapper.appendChild(copyBtn);

    block.appendChild(wrapper);
    container.appendChild(block);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const output = document.getElementById('workshop-output');
    if (!output) return;

    // 送出按鈕本身沒有被 hidden 擋住,額外檢查依賴鏈是否真的解鎖到最後
    // 一步,避免使用者跳過中間步驟、產生欄位是空的殘缺內容。
    const translationFields = document.getElementById('translation-own-fields');
    if (!translationFields || translationFields.hidden) {
      clearNode(output);
      const warn = document.createElement('p');
      warn.className = 'workshop-warning';
      warn.textContent = '請先照順序完成上面的步驟(選擇/新增作品、選擇/新增作者、來源版本等),才能產生檔案內容。';
      output.appendChild(warn);
      output.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // 不能直接用 form.checkValidity()/reportValidity():瀏覽器的原生驗證
    // 不會排除「目前被 hidden 收合起來的必填欄位」(例如選了既有作者,
    // a-name-native/a-name-target 永遠不會出現,但 required 屬性還在)——
    // 硬要驗證這些欄位還會想把焦點移過去,但 hidden 元素不可 focus,
    // Chrome 會直接印出「not focusable」的警告然後整個中止送出、
    // submit 事件根本不會觸發。所以表單本身標了 novalidate,改成只掃
    // 「目前真的看得到」的必填欄位——跟這次送出無關的路徑(沒走到的
    // 分支)裡的必填欄位,略過不檢查。
    const invalidEl = Array.from(form.querySelectorAll('[required]')).find(
      (el) => !el.closest('[hidden]') && !el.checkValidity()
    );
    if (invalidEl) {
      invalidEl.focus();
      invalidEl.reportValidity();
      return;
    }

    const workId = val('work-id');
    const authorId = val('author-id');
    const needsWorkFile = !workId;
    const needsAuthorFile = needsWorkFile && !authorId;

    const targetLang = val('t-language');
    const nativeLang = val('e-language');
    const finalWorkId = needsWorkFile ? generateUuid() : workId;
    const finalAuthorId = needsWorkFile ? (needsAuthorFile ? generateUuid() : authorId) : null;
    const editionUrl = needsWorkFile ? val('e-url') : val('edition-url');

    const files = [];

    if (needsAuthorFile) {
      files.push(Object.assign({ label: '新增原作者' }, buildAuthorFile({
        uuid: finalAuthorId,
        nativeLang,
        nativeName: val('a-name-native'),
        targetLang,
        targetName: val('a-name-target'),
        wikidataId: extractWikidataId(val('a-wikidata-link')),
        sourceUrl: val('a-source-url'),
      })));
    }

    if (needsWorkFile) {
      files.push(Object.assign({ label: '新增作品' }, buildWorkFile({
        uuid: finalWorkId,
        nativeLang,
        nativeTitle: val('w-title-native'),
        targetLang,
        targetTitle: val('t-title'),
        authorId: finalAuthorId,
        tags: val('w-tags'),
        category: val('w-category'),
        edition: {
          url: val('e-url'),
          language: val('e-language'),
          publisher: val('e-publisher'),
          date: val('e-date'),
          copyrightStatus: val('e-copyright-status'),
        },
      })));
    }

    files.push(Object.assign({ label: '新增翻譯' }, buildTranslationFile({
      uuid: generateUuid(),
      workId: finalWorkId,
      editionUrl,
      title: val('t-title'),
      language: targetLang,
      date: val('t-date'),
      excerpt: val('t-excerpt'),
    })));

    clearNode(output);

    const intro = document.createElement('p');
    intro.className = 'workshop-output-intro';
    intro.textContent = '依序完成以下步驟,把對應內容貼進 GitHub 上的新檔案,最後開一個 Pull Request 就完成提交。';
    output.appendChild(intro);

    let stepNum = 1;
    files.forEach((f) => {
      renderCodeBlock(output, `步驟 ${stepNum++}・${f.label}`, f.path, f.content);
    });

    const finalStep = document.createElement('div');
    finalStep.className = 'workshop-step';
    const finalHeading = document.createElement('div');
    finalHeading.className = 'workshop-step-label';
    finalHeading.textContent = `步驟 ${stepNum}・開 Pull Request`;
    finalStep.appendChild(finalHeading);
    const finalBody = document.createElement('p');
    finalBody.className = 'workshop-step-note';
    finalBody.innerHTML = '到 repo 頁面用 GitHub 網頁版的「Add file」功能,依序貼上以上內容並建立對應路徑的檔案,GitHub 會自動幫你開分支、建立 PR。完整步驟見<a href="https://github.com/shellkz/PublicTranslationWebsite/blob/main/docs/翻譯者指南.md">翻譯者指南</a>。';
    finalStep.appendChild(finalBody);
    output.appendChild(finalStep);

    output.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function init() {
    const dateEl = document.getElementById('t-date');
    if (dateEl) {
      dateEl.value = new Date().toISOString().slice(0, 10);
    }

    const form = document.getElementById('workshop-form');
    wireFieldIndicators(form);
    if (form) form.addEventListener('submit', handleSubmit);

    // 「純資料欄位」區塊之間的循序揭露:按下這一組結尾的「完成」按鈕,
    // 才揭露下一組——不是選到/決定新增的當下就一次全開,也不是欄位一
    // 變合法就自動往下跳。
    wireGroupCompletion('author-create-section', ['a-name-native', 'a-name-target'], 'author-create-section-done', showWorkEditionFields);
    wireGroupCompletion('work-edition-fields', ['e-url', 'e-language', 'e-copyright-status'], 'work-edition-fields-done', showWorkOwnFields);
    wireGroupCompletion('work-own-fields', ['w-title-native'], 'work-own-fields-done', showTranslationOwnFields);
    // 翻譯自己的欄位是整個表單最後一組,完成之後沒有下一個區塊要解鎖,
    // 只是把畫面捲到最下面的送出按鈕。
    wireGroupCompletion('translation-own-fields', ['t-language', 't-title'], 'translation-own-fields-done', () => {
      const submit = document.getElementById('workshop-submit');
      if (submit) submit.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    Promise.all([
      fetch('/works.json').then((r) => r.json()),
      fetch('/source-authors.json').then((r) => r.json()),
    ])
      .then(([works, authors]) => {
        setupWorkSearch(works);
        setupAuthorSearch(authors);
      })
      .catch((err) => {
        console.error('workshop:讀取索引失敗', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
