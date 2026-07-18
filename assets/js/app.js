/* =========================================================
   应用中心 · 前端逻辑（沉浸式公开展示版）
   - fetch data/apps.json
   - 渲染 Bento 卡片（3D 倾斜 / 辉光 / 旋转描边 / 逐张浮现）
   - 分类筛选 + Hero 搜索 + 命令面板(⌘K / /)
   - 深色/浅色主题切换 + 全局光标聚光 + 数字滚动
   ========================================================= */
(function () {
  "use strict";

  var THEME_KEY = "appcenter:theme";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

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
  var spotlight = $("#spotlight");
  var statApps = $("#stat-apps");
  var statCats = $("#stat-cats");

  // 命令面板
  var cmdOverlay = $("#cmd-overlay");
  var cmdInput = $("#cmd-input");
  var cmdResults = $("#cmd-results");
  var cmdClose = $("#cmd-close");
  var cmdActive = -1;
  var cmdListRef = [];

  /* ---------- 工具 ---------- */
  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function isTyping() {
    var el = document.activeElement;
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  }

  /* ---------- 主题 ---------- */
  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved === "dark" ? "dark" : "light");
  }
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    themeToggle.textContent = t === "dark" ? "☀️" : "🌙";
    themeToggle.title = t === "dark" ? "切换到浅色" : "切换到深色";
    themeMeta.content = t === "dark" ? "#070912" : "#eef0f8";
    try { localStorage.setItem(THEME_KEY, t); } catch (_) {}
  }

  /* ---------- 数据扁平化 ---------- */
  function flattenApps() {
    allApps = [];
    if (!DATA || !DATA.categories) return;
    DATA.categories.forEach(function (cat) {
      (cat.apps || []).forEach(function (app) {
        allApps.push(Object.assign({}, app, { _cat: cat.name }));
      });
    });
  }

  /* ---------- 分类筛选条 ---------- */
  function renderCats() {
    var names = ["全部"];
    if (DATA && DATA.categories) DATA.categories.forEach(function (c) { names.push(c.name); });
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
        btn.animate(
          [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
          { duration: 380, delay: i * 45, fill: "forwards", easing: "cubic-bezier(.25,.46,.45,.94)" }
        );
      }
    });
  }
  function setCat(name) {
    currentCat = name;
    $$(".cat-chip", catBar).forEach(function (el) { el.classList.toggle("active", el.textContent === name); });
    applyFilter();
  }

  /* ---------- 卡片网格（Bento） ---------- */
  function buildCard(app, idx) {
    var wrap = document.createElement("div");
    wrap.className = "card-wrap" + (app.size === "lg" ? " lg" : "");
    wrap.dataset.cat = app._cat || "";
    wrap.style.setProperty("--i", idx);
    wrap.style.setProperty("--color", app.color || "#5b6ef5");

    var card = document.createElement("div");
    card.className = "card";
    card.setAttribute("role", "link");
    card.tabIndex = 0;

    var tagsHtml = (app.tags || []).map(function (t) {
      return '<span class="card-tag">' + esc(t) + "</span>";
    }).join("");

    card.innerHTML =
      '<span class="card-emoji">' + esc(app.emoji || "✦") + "</span>" +
      '<span class="card-cat">' + esc(app._cat || "") + "</span>" +
      '<div class="card-title">' + esc(app.title || "未命名") + "</div>" +
      '<div class="card-desc">' + esc(app.desc || "") + "</div>" +
      '<div class="card-foot">' +
        '<div class="card-tags">' + tagsHtml + "</div>" +
        '<span class="card-arrow">→</span>' +
      "</div>";

    wrap.appendChild(card);

    // 点击跳转
    var go = function () { if (app.url) window.open(app.url, "_blank", "noopener"); };
    card.addEventListener("click", go);
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
    });

    // 3D 倾斜 + 辉光位置 + emoji 视差
    if (!isTouch && !reduceMotion && app.size !== "lg") {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width;
        var y = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
        card.style.setProperty("--rx", ((0.5 - y) * 7).toFixed(2) + "deg");
        card.style.setProperty("--ry", ((x - 0.5) * 7).toFixed(2) + "deg");
        card.style.setProperty("--ex", ((x - 0.5) * 10).toFixed(1) + "px");
        card.style.setProperty("--ey", ((y - 0.5) * 10).toFixed(1) + "px");
      });
      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--ex", "0px");
        card.style.setProperty("--ey", "0px");
      });
    }

    return wrap;
  }

  function renderGrid() {
    appGrid.innerHTML = "";
    var frag = document.createDocumentFragment();
    allApps.forEach(function (app, i) { frag.appendChild(buildCard(app, i)); });
    appGrid.appendChild(frag);
    setupReveal();
  }

  /* 筛选（分类 + Hero 搜索共用） */
  function applyFilter() {
    var q = (hsInput.value || "").trim().toLowerCase();
    $$(".card-wrap", appGrid).forEach(function (w) {
      var byCat = currentCat === "全部" || w.dataset.cat === currentCat;
      var byText = !q || (w.textContent || "").toLowerCase().indexOf(q) !== -1;
      w.classList.toggle("hide", !(byCat && byText));
    });
  }

  /* ---------- 滚动逐张浮现 ---------- */
  function setupReveal() {
    var wraps = $$(".card-wrap", appGrid);
    if (!reduceMotion) {
      // 全部立即以交错延迟浮现（整页在 1~2 屏内，无需滚动触发）
      requestAnimationFrame(function () { wraps.forEach(function (w) { w.classList.add("in"); }); });
    } else {
      wraps.forEach(function (w) { w.classList.add("in"); });
    }
  }

  /* ---------- 全局光标聚光 ---------- */
  function setupSpotlight() {
    if (isTouch || reduceMotion) return;
    var raf = null, px = 0, py = 0;
    document.addEventListener("pointermove", function (e) {
      px = e.clientX; py = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        spotlight.style.setProperty("--mx", px + "px");
        spotlight.style.setProperty("--my", py + "px");
        raf = null;
      });
    });
  }

  /* ---------- 数字滚动 ---------- */
  function countUp(el, target, dur) {
    if (!el || reduceMotion) { if (el) el.textContent = target; return; }
    var start = performance.now(), from = 0;
    function step(now) {
      var p = Math.min((now - start) / dur, 1);
      p = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = Math.round(from + (target - from) * p);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- 命令面板 ---------- */
  function openCmd() {
    cmdOverlay.hidden = false;
    cmdInput.value = "";
    renderCmd("");
    setTimeout(function () { cmdInput.focus(); }, 30);
  }
  function closeCmd() { cmdOverlay.hidden = true; cmdInput.blur(); }

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
      cmdListRef = []; cmdActive = -1; return;
    }
    list.forEach(function (a, i) {
      var li = document.createElement("li");
      li.className = "cmd-item" + (i === 0 ? " active" : "");
      li.dataset.idx = i;
      li.innerHTML =
        '<span class="ci-icon">' + esc(a.emoji || "✦") + "</span>" +
        '<div class="ci-info">' +
          '<div class="ci-name">' + esc(a.title || "") + "</div>" +
          '<div class="ci-detail">' + esc(a.desc || "") + "</div>" +
        "</div>" +
        '<span class="ci-cat-pill">' + esc(a._cat || "") + "</span>";
      li.addEventListener("mouseenter", function () { setCmdActive(i); });
      li.addEventListener("click", function () { openApp(a); });
      cmdResults.appendChild(li);
    });
    cmdListRef = list; cmdActive = 0;
  }
  function setCmdActive(i) {
    var items = $$(".cmd-item", cmdResults);
    if (!items.length) return;
    cmdActive = ((i % items.length) + items.length) % items.length;
    items.forEach(function (el, idx) { el.classList.toggle("active", idx === cmdActive); });
    if (items[cmdActive]) items[cmdActive].scrollIntoView({ block: "nearest" });
  }
  function openApp(a) { if (a && a.url) window.open(a.url, "_blank", "noopener"); closeCmd(); }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    themeToggle.addEventListener("click", function () {
      var cur = document.documentElement.dataset.theme || "light";
      applyTheme(cur === "dark" ? "light" : "dark");
    });
    hsInput.addEventListener("input", applyFilter);
    searchTrigger.addEventListener("click", openCmd);
    cmdClose.addEventListener("click", closeCmd);
    cmdOverlay.addEventListener("click", function (e) { if (e.target === cmdOverlay) closeCmd(); });
    cmdInput.addEventListener("input", function () { renderCmd(cmdInput.value); });
    cmdInput.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setCmdActive(cmdActive + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setCmdActive(cmdActive - 1); }
      else if (e.key === "Enter") { e.preventDefault(); if (cmdActive >= 0 && cmdListRef[cmdActive]) openApp(cmdListRef[cmdActive]); }
      else if (e.key === "Escape") { e.preventDefault(); closeCmd(); }
    });
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); cmdOverlay.hidden ? openCmd() : closeCmd(); return; }
      if (e.key === "/" && !isTyping() && cmdOverlay.hidden) { e.preventDefault(); openCmd(); return; }
      if (e.key === "Escape" && !cmdOverlay.hidden) closeCmd();
    });
  }

  /* ---------- 启动 ---------- */
  async function init() {
    initTheme();
    bind();
    setupSpotlight();

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

    if (DATA.profile) {
      if (DATA.profile.name) heroTitle.textContent = DATA.profile.name;
      if (DATA.profile.subtitle) heroDesc.textContent = DATA.profile.subtitle;
    }

    flattenApps();
    renderCats();
    renderGrid();

    // 统计数字滚动
    countUp(statApps, allApps.length, 900);
    countUp(statCats, (DATA.categories || []).length, 900);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
