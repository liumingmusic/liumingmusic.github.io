/* =========================================================
   星盘控制台 · 前端逻辑
   - fetch apps.json + localStorage 覆盖层
   - 实时时钟 / 问候
   - 命令面板（⌘K / Ctrl+K / /，↑↓ Enter Esc）
   - 鼠标跟随光晕 + 克制 3D 倾斜 + 首屏 stagger
   - 页面内「＋ 添加应用」写入 localStorage
   ========================================================= */
(function () {
  "use strict";

  const LS_KEY = "appcenter:userapps:v1";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  // ---------- 状态 ----------
  let DATA = null;          // 来自 apps.json 的基础数据
  let userApps = loadUserApps();
  let mergedCats = [];
  let allApps = [];

  // ---------- DOM ----------
  const bento = $("#bento");
  const clockTime = $("#clock-time");
  const clockDate = $("#clock-date");
  const greetEl = $("#greet");
  const githubLink = $("#github-link");
  const heroSub = $("#hero-sub");

  // 命令面板
  const cmdk = $("#cmdk");
  const cmdkInput = $("#cmdk-input");
  const cmdkList = $("#cmdk-list");
  const cmdTrigger = $("#cmd-trigger");
  let cmdkActive = -1;

  // 添加 / 管理
  const addModal = $("#add-modal");
  const addForm = $("#add-form");
  const addCategory = $("#add-category");
  const manageModal = $("#manage-modal");
  const manageList = $("#manage-list");
  const manageEmpty = $("#manage-empty");

  /* =====================================================================
     数据：加载 / 合并
     ===================================================================== */
  function loadUserApps() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function saveUserApps() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(userApps)); } catch (e) {}
  }

  function merge() {
    // 深拷贝基础分类，再并入用户添加的应用
    mergedCats = JSON.parse(JSON.stringify((DATA && DATA.categories) || []));
    userApps.forEach((app) => {
      let cat = mergedCats.find((c) => c.name === app.category);
      if (!cat) {
        cat = { name: app.category, apps: [] };
        mergedCats.push(cat);
      }
      cat.apps.push(app);
    });
    // 扁平化（供命令面板 / 统计）
    allApps = [];
    mergedCats.forEach((c) => {
      (c.apps || []).forEach((a) => {
        allApps.push(Object.assign({}, a, { category: c.name }));
      });
    });
  }

  /* =====================================================================
     渲染：状态栏 / 英雄 / Bento
     ===================================================================== */
  function renderProfile() {
    if (!DATA || !DATA.profile) return;
    const p = DATA.profile;
    if (p.github) githubLink.href = p.github;
    if (p.subtitle) heroSub.textContent = p.subtitle;
    document.title = (p.name || "星盘控制台") + " · 我的小应用母舰";
  }

  function renderBento() {
    bento.innerHTML = "";
    let order = 0;
    mergedCats.forEach((cat) => {
      const apps = cat.apps || [];
      if (!apps.length) return;

      const section = document.createElement("section");
      section.className = "cat";

      const title = document.createElement("h2");
      title.className = "cat-title";
      title.innerHTML = `${escapeHtml(cat.name)}<span class="cat-count">${apps.length}</span>`;
      section.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "cat-grid";

      apps.forEach((app) => {
        grid.appendChild(buildTile(app, order++));
      });

      section.appendChild(grid);
      bento.appendChild(section);
    });
  }

  function buildTile(app, order) {
    const el = document.createElement("div");
    el.className = "tile" + (app.size === "lg" ? " lg" : "");
    el.style.setProperty("--glow", app.color || "#22d3ee");
    el.setAttribute("role", "link");
    el.setAttribute("tabindex", "0");
    el.dataset.url = app.url || "#";
    if (!reduceMotion) el.style.animationDelay = Math.min(order * 45, 900) + "ms";

    const badgeClass =
      app.status === "建设中" ? "badge-build" : app.status === "计划中" ? "badge-plan" : "badge-on";
    const badgeText = app.status || "已上线";

    el.innerHTML = `
      <span class="tile-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      <span class="tile-emoji">${escapeHtml(app.emoji || "✦")}</span>
      <div class="tile-title">${escapeHtml(app.title || "未命名")}</div>
      <div class="tile-desc">${escapeHtml(app.desc || "")}</div>
      <div class="tile-tags">${(app.tags || []).map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>
      ${app.repo ? `<a class="tile-src" href="${escapeAttr(app.repo)}" target="_blank" rel="noopener" title="查看源码" aria-label="查看源码">{'</>'}</a>` : ""}
    `;

    // 点击 / 键盘：跳应用；但点源码图标不触发
    el.addEventListener("click", (e) => {
      if (e.target.closest(".tile-src")) return; // 让 <a> 自己去 repo
      if (app.url) window.open(app.url, "_blank", "noopener");
    });
    el.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && app.url) {
        e.preventDefault();
        window.open(app.url, "_blank", "noopener");
      }
    });

    if (!coarse && !reduceMotion) attachTileFx(el);
    return el;
  }

  // 鼠标跟随光晕 + 克制 3D 倾斜
  function attachTileFx(tile) {
    tile.addEventListener("pointermove", (e) => {
      const r = tile.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      tile.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
      tile.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      const rx = (0.5 - py) * 8;  // ≤ 4°
      const ry = (px - 0.5) * 8;  // ≤ 4°
      tile.style.transform = `perspective(820px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-4px)`;
    });
    tile.addEventListener("pointerleave", () => {
      tile.style.transform = "";
    });
  }

  /* =====================================================================
     时钟 / 问候
     ===================================================================== */
  const WD = ["日", "一", "二", "三", "四", "五", "六"];
  function tick() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    clockTime.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    clockDate.textContent = `${d.getFullYear()}·${d.getMonth() + 1}·${d.getDate()} 周${WD[d.getDay()]}`;
    const h = d.getHours();
    let g = "你好";
    if (h < 5) g = "凌晨好";
    else if (h < 11) g = "早上好";
    else if (h < 13) g = "中午好";
    else if (h < 18) g = "下午好";
    else g = "晚上好";
    greetEl.textContent = g;
  }

  /* =====================================================================
     命令面板
     ===================================================================== */
  function openCmdk() {
    cmdk.hidden = false;
    cmdkInput.value = "";
    renderCmdk("");
    setTimeout(() => cmdkInput.focus(), 30);
  }
  function closeCmdk() {
    cmdk.hidden = true;
    cmdkInput.blur();
  }
  function renderCmdk(query) {
    const q = query.trim().toLowerCase();
    const list = allApps.filter((a) => {
      if (!q) return true;
      return (
        (a.title || "").toLowerCase().includes(q) ||
        (a.desc || "").toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q) ||
        (a.tags || []).join(" ").toLowerCase().includes(q)
      );
    });
    cmdkList.innerHTML = "";
    if (!list.length) {
      const li = document.createElement("li");
      li.className = "cmdk-empty";
      li.textContent = "没有匹配的应用…";
      cmdkList.appendChild(li);
      cmdkActive = -1;
      return;
    }
    list.forEach((a, i) => {
      const li = document.createElement("li");
      li.className = "cmdk-item" + (i === 0 ? " active" : "");
      li.dataset.i = i;
      li.innerHTML = `
        <span class="ci-emoji">${escapeHtml(a.emoji || "✦")}</span>
        <div class="ci-main">
          <div class="ci-title">${escapeHtml(a.title)}</div>
          <div class="ci-meta">${(a.desc || "") + (a.status ? " · " + a.status : "")}</div>
        </div>
        <span class="ci-cat">${escapeHtml(a.category)}</span>`;
      li.addEventListener("mouseenter", () => setActive(i));
      li.addEventListener("click", () => openApp(a));
      cmdkList.appendChild(li);
    });
    cmdkActive = 0;
    cmdk._list = list;
  }
  function setActive(i) {
    const items = $$(".cmdk-item", cmdkList);
    if (!items.length) return;
    cmdkActive = (i + items.length) % items.length;
    items.forEach((el, idx) => el.classList.toggle("active", idx === cmdkActive));
    items[cmdkActive].scrollIntoView({ block: "nearest" });
  }
  function openActive() {
    const list = cmdk._list || [];
    if (cmdkActive >= 0 && list[cmdkActive]) openApp(list[cmdkActive]);
  }
  function openApp(a) {
    if (a && a.url) window.open(a.url, "_blank", "noopener");
    closeCmdk();
  }

  /* =====================================================================
     添加应用 / 管理
     ===================================================================== */
  function fillCategorySelect() {
    const names = (DATA && DATA.categories || []).map((c) => c.name);
    userApps.forEach((a) => { if (a.category && !names.includes(a.category)) names.push(a.category); });
    addCategory.innerHTML = names
      .map((n) => `<option value="${escapeAttr(n)}">${escapeHtml(n)}</option>`)
      .join("") + `<option value="__new__">＋ 新建分类…</option>`;
  }

  let newCatInput = null;
  function ensureNewCatInput() {
    if (newCatInput) return newCatInput;
    newCatInput = document.createElement("input");
    newCatInput.name = "newcat";
    newCatInput.placeholder = "输入新分类名";
    newCatInput.className = "fld-input";
    newCatInput.style.cssText =
      "margin-top:10px;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:10px;color:var(--txt);font-size:14px;padding:10px 12px;outline:0;font-family:inherit;display:none;";
    addCategory.closest(".fld").appendChild(newCatInput);
    return newCatInput;
  }

  function openAdd() {
    fillCategorySelect();
    if (newCatInput) newCatInput.style.display = "none";
    addForm.reset();
    addModal.hidden = false;
    setTimeout(() => addForm.querySelector('[name="title"]').focus(), 30);
  }
  function closeAdd() { addModal.hidden = true; }

  addCategory.addEventListener("change", () => {
    const inp = ensureNewCatInput();
    inp.style.display = addCategory.value === "__new__" ? "block" : "none";
    if (addCategory.value === "__new__") inp.focus();
  });

  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(addForm);
    let category = fd.get("category");
    if (category === "__new__") {
      category = (fd.get("newcat") || "").toString().trim() || "未分类";
    }
    const app = {
      id: "u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      title: (fd.get("title") || "").toString().trim() || "未命名",
      url: (fd.get("url") || "").toString().trim(),
      desc: (fd.get("desc") || "").toString().trim(),
      emoji: (fd.get("emoji") || "🚀").toString().trim() || "🚀",
      color: (fd.get("color") || "#22d3ee").toString(),
      tags: (fd.get("tags") || "").toString().split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      status: (fd.get("status") || "已上线").toString(),
      size: (fd.get("size") || "sm").toString(),
      category: category,
    };
    if (!app.url) { alert("请填写有效的链接 URL"); return; }
    userApps.push(app);
    saveUserApps();
    merge();
    renderBento();
    closeAdd();
  });

  function openManage() {
    renderManage();
    manageModal.hidden = false;
  }
  function closeManage() { manageModal.hidden = true; }
  function renderManage() {
    manageList.innerHTML = "";
    if (!userApps.length) {
      manageEmpty.hidden = false;
      return;
    }
    manageEmpty.hidden = true;
    userApps.forEach((a) => {
      const li = document.createElement("li");
      li.className = "manage-item";
      li.innerHTML = `
        <span class="mi-emoji">${escapeHtml(a.emoji || "✦")}</span>
        <div class="mi-main">
          <div class="mi-title">${escapeHtml(a.title)}</div>
          <div class="mi-cat">${escapeHtml(a.category)} · ${escapeHtml(a.status || "")}</div>
        </div>
        <button class="mi-del" type="button" data-id="${escapeAttr(a.id)}">删除</button>`;
      li.querySelector(".mi-del").addEventListener("click", () => {
        userApps = userApps.filter((x) => x.id !== a.id);
        saveUserApps();
        merge();
        renderBento();
        renderManage();
      });
      manageList.appendChild(li);
    });
  }

  /* =====================================================================
     工具
     ===================================================================== */
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function isTyping() {
    const a = document.activeElement;
    return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable);
  }

  /* =====================================================================
     事件绑定
     ===================================================================== */
  function bind() {
    cmdTrigger.addEventListener("click", openCmdk);
    $("#cmdk-close").addEventListener("click", closeCmdk);
    cmdk.addEventListener("click", (e) => { if (e.target === cmdk) closeCmdk(); });
    cmdkInput.addEventListener("input", () => renderCmdk(cmdkInput.value));
    cmdkInput.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(cmdkActive + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(cmdkActive - 1); }
      else if (e.key === "Enter") { e.preventDefault(); openActive(); }
      else if (e.key === "Escape") { e.preventDefault(); closeCmdk(); }
    });

    $("#btn-add").addEventListener("click", openAdd);
    $("#add-close").addEventListener("click", closeAdd);
    addModal.addEventListener("click", (e) => { if (e.target === addModal) closeAdd(); });
    $("#manage-btn").addEventListener("click", () => { closeAdd(); openManage(); });
    $("#manage-close").addEventListener("click", closeManage);
    manageModal.addEventListener("click", (e) => { if (e.target === manageModal) closeManage(); });

    document.addEventListener("keydown", (e) => {
      // ⌘K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        cmdk.hidden ? openCmdk() : closeCmdk();
        return;
      }
      // "/" 唤起（非输入态、面板关闭时）
      if (e.key === "/" && !isTyping() && cmdk.hidden) {
        e.preventDefault();
        openCmdk();
        return;
      }
      // 全局 Esc 关弹窗
      if (e.key === "Escape") {
        if (!addModal.hidden) closeAdd();
        else if (!manageModal.hidden) closeManage();
      }
    });
  }

  /* =====================================================================
     启动
     ===================================================================== */
  async function init() {
    tick();
    setInterval(tick, 1000);
    bind();
    try {
      const res = await fetch("data/apps.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      DATA = await res.json();
    } catch (err) {
      // 本地 file:// 直接打开会失败，给出提示
      bento.innerHTML =
        `<div style="padding:40px;text-align:center;color:var(--txt-2);max-width:600px;margin:0 auto;line-height:1.7">
          无法加载 <code>data/apps.json</code>。<br/>
          请通过本地服务器访问（如 <code>python3 -m http.server</code>），<br/>
          或部署到 GitHub Pages 后访问线上地址。<br/><br/>
          <small style="color:var(--txt-3)">${escapeHtml(String(err))}</small>
        </div>`;
      return;
    }
    renderProfile();
    merge();
    renderBento();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
