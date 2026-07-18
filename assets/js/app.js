/* =========================================================
   应用中心 · 前端逻辑（公开展示版）
   - fetch data/apps.json
   - 渲染应用卡片网格（自适应，内容不截断）
   - 分类筛选
   - 搜索（Hero 输入框 + 命令面板 ⌘K / /）
   - 深色/浅色主题切换
   ========================================================= */
(function () {
  "use strict";

  var THEME_KEY = "appcenter:theme";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.from((r || document).querySelectorAll(s)); };

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 状态 ---------- */
  var DATA = null;
  var allApps = [];
  var currentCat = "全部";

  /* ---------- DOM ---------- */
  var appGrid = $("#app-grid");
  var catBar = $("#cat-bar");
  var heroTitle = $("#hero-title");
  var heroDesc = $("#hero-desc");
  var hsInput = $("#hs-input");
  var searchTrigger = $("#search-trigger");

  var themeToggle = $("#theme-toggle");
  var themeMeta = $("#theme-color-meta");

  // 命令面板
  var cmdOverlay = $("#cmd-overlay");
  var cmdInput = $("#cmd-input");
  var cmdResults = $("#cmd-results");
  var cmdClose = $("#cmd-close");
  var cmdActive = -1;
  var cmdListRef = [];

  /* =====================================================================
     工具函数
     ===================================================================== */
  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function isTyping() {
    var el = document.activeElement;
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  }

  /* =====================================================================
     主题
     ===================================================================== */
  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved === "dark" ? "dark" : "light"); // 默认浅色
  }
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    themeToggle.textContent = t === "dark" ? "☀️" : "🌙";
    themeToggle.title = t === "dark" ? "切换到浅色" : "切换到深色";
    themeMeta.content = t === "dark" ? "#0c1022" : "#f8f9fc";
    try { localStorage.setItem(THEME_KEY, t); } catch (_) {}
  }

  /* =====================================================================
     数据加载与合并
     ===================================================================== */
  function flattenApps() {
    allApps = [];
    if (!DATA || !DATA.categories) return;
    DATA.categories.forEach(function (cat) {
      (cat.apps || []).forEach(function (app) {
        allApps.push(Object.assign({}, app, { _cat: cat.name }));
      });
    });
  }

  /* =====================================================================
     渲染：分类筛选
     ===================================================================== */
  function renderCats() {
    var names = ["全部"];
    if (DATA && DATA.categories) {
      DATA.categories.forEach(function (c) { names.push(c.name); });
    }
    catBar.innerHTML = "";
    names.forEach(function (name, i) {
      var btn = document.createElement("button");
      btn.className = "cat-chip" + (name === currentCat ? " active" : "");
      btn.type = "button";
      btn.textContent = name;
      btn.addEventListener("click", function () { setCat(name); });
      catBar.appendChild(btn);
      if (!reduceMotion) {
        btn.style.opacity = "0";
        btn.style.animation = "fadeIn .25s " + (i * 50) + "ms ease forwards";
      }
    });
  }
  function setCat(name) {
    currentCat = name;
    $$(".cat-chip", catBar).forEach(function (el) {
      el.classList.toggle("active", el.textContent === name);
    });
    applyFilter();
  }

  /* =====================================================================
     渲染：卡片网格
     ===================================================================== */
  function renderGrid() {
    appGrid.innerHTML = "";
    allApps.forEach(function (app, i) {
      var card = buildCard(app, i);
      appGrid.appendChild(card);
    });
  }

  function buildCard(app, idx) {
    var card = document.createElement("div");
    card.className = "card";
    card.setAttribute("role", "link");
    card.tabIndex = 0;
    card.dataset.cat = app._cat || "";
    card.style.setProperty("--card-accent", app.color || "#6c8cff");
    if (!reduceMotion) {
      card.style.animationDelay = Math.min(idx * 50, 800) + "ms";
    }

    // 标签 HTML
    var tagsHtml = (app.tags || []).map(function (t) {
      return '<span class="card-tag">' + esc(t) + '</span>';
    }).join("");

    card.innerHTML =
      '<span class="card-emoji">' + esc(app.emoji || '✦') + '</span>' +
      '<span class="card-cat">' + esc(app._cat || '') + '</span>' +
      '<div class="card-title">' + esc(app.title || '未命名') + '</div>' +
      '<div class="card-desc">' + esc(app.desc || '') + '</div>' +
      '<div class="card-foot">' +
        '<div class="card-tags">' + tagsHtml + '</div>' +
        '<span class="card-arrow">→</span>' +
      '</div>';

    // 点击跳转
    card.addEventListener("click", function () {
      if (app.url) window.open(app.url, "_blank", "noopener");
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (app.url) window.open(app.url, "_blank", "noopener");
      }
    });

    return card;
  }

  /* 筛选 */
  function applyFilter() {
    $$(".card", appGrid).forEach(function (c) {
      var show = currentCat === "全部" || c.dataset.cat === currentCat;
      c.hidden = !show;
    });
  }

  /* Hero 内嵌搜索过滤 */
  function onHsInput() {
    var q = hsInput.value.trim().toLowerCase();
    if (!q) { applyFilter(); return; }
    $$(".card", appGrid).forEach(function (c) {
      var text = (c.textContent || "").toLowerCase();
      c.hidden = !text.includes(q);
    });
  }

  /* =====================================================================
     命令面板
     ===================================================================== */
  function openCmd() {
    cmdOverlay.hidden = false;
    cmdInput.value = "";
    renderCmd("");
    setTimeout(function () { cmdInput.focus(); }, 30);
  }
  function closeCmd() {
    cmdOverlay.hidden = true;
    cmdInput.blur();
  }

  function renderCmd(query) {
    var q = query.trim().toLowerCase();
    var list = allApps.filter(function (a) {
      if (!q) return true;
      var fields = [a.title, a.desc, a._cat].concat(a.tags || []).join(" ").toLowerCase();
      return fields.indexOf(q) !== -1;
    });

    cmdResults.innerHTML = "";

    if (list.length === 0) {
      var empty = document.createElement("li");
      empty.className = "cmd-empty";
      empty.textContent = "没有找到匹配的应用";
      cmdResults.appendChild(empty);
      cmdListRef = [];
      cmdActive = -1;
      return;
    }

    list.forEach(function (a, i) {
      var li = document.createElement("li");
      li.className = "cmd-item" + (i === 0 ? " active" : "");
      li.dataset.idx = i;
      li.innerHTML =
        '<span class="ci-icon">' + esc(a.emoji || '✦') + '</span>' +
        '<div class="ci-info">' +
          '<div class="ci-name">' + esc(a.title || '') + '</div>' +
          '<div class="ci-detail">' + esc(a.desc || '') + '</div>' +
        '</div>' +
        '<span class="ci-cat-pill">' + esc(a._cat || '') + '</span>';

      li.addEventListener("mouseenter", function () { setCmdActive(i); });
      li.addEventListener("click", function () { openApp(a); });
      cmdResults.appendChild(li);
    });

    cmdListRef = list;
    cmdActive = 0;
  }

  function setCmdActive(i) {
    var items = $$(".cmd-item", cmdResults);
    if (!items.length) return;
    cmdActive = ((i % items.length) + items.length) % items.length;
    items.forEach(function (el, idx) {
      el.classList.toggle("active", idx === cmdActive);
    });
    if (items[cmdActive]) items[cmdActive].scrollIntoView({ block: "nearest" });
  }

  function openApp(a) {
    if (a && a.url) window.open(a.url, "_blank", "noopener");
    closeCmd();
  }

  /* =====================================================================
     事件绑定
     ===================================================================== */
  function bind() {
    themeToggle.addEventListener("click", function () {
      var cur = document.documentElement.dataset.theme || "light";
      applyTheme(cur === "dark" ? "light" : "dark");
    });

    // Hero 搜索
    hsInput.addEventListener("input", onHsInput);

    // 顶栏搜索按钮
    searchTrigger.addEventListener("click", openCmd);

    // 命令面板
    cmdClose.addEventListener("click", closeCmd);
    cmdOverlay.addEventListener("click", function (e) {
      if (e.target === cmdOverlay) closeCmd();
    });
    cmdInput.addEventListener("input", function () { renderCmd(cmdInput.value); });
    cmdInput.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setCmdActive(cmdActive + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setCmdActive(cmdActive - 1); }
      else if (e.key === "Enter") { e.preventDefault(); var l = cmdListRef; if (cmdActive >= 0 && l[cmdActive]) openApp(l[cmdActive]); }
      else if (e.key === "Escape") { e.preventDefault(); closeCmd(); }
    });

    // 全局快捷键
    document.addEventListener("keydown", function (e) {
      // ⌘K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        cmdOverlay.hidden ? openCmd() : closeCmd();
        return;
      }
      // / 打开命令面板
      if (e.key === "/" && !isTyping() && cmdOverlay.hidden) {
        e.preventDefault();
        openCmd();
        return;
      }
      // Esc 关闭
      if (e.key === "Escape" && !cmdOverlay.hidden) {
        closeCmd();
      }
    });
  }

  /* =====================================================================
     启动
     ===================================================================== */
  async function init() {
    initTheme();
    bind();

    try {
      var res = await fetch("data/apps.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      DATA = await res.json();
    } catch (err) {
      appGrid.innerHTML =
        '<div style="grid-column:1/-1;padding:48px 16px;text-align:center;color:var(--text2);line-height:1.8">' +
        '<p style="font-size:16px;margin-bottom:8px;">无法加载应用数据</p>' +
        '<p style="font-size:13px;color:var(--text3);">请确认通过 HTTP 服务器访问或已部署到线上。</p></div>';
      return;
    }

    // 设置 Hero 文案
    if (DATA.profile) {
      if (DATA.profile.name) heroTitle.textContent = DATA.profile.name;
      if (DATA.profile.subtitle) heroDesc.textContent = DATA.profile.subtitle;
    }

    flattenApps();
    renderCats();
    renderGrid();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
