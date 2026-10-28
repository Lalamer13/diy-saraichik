(() => {
  "use strict";
  const STORAGE_KEY = "diy-saraichik-ideas-v1";
  const $ = (selector) => document.querySelector(selector);
  const form = $("#ideaForm");
  const list = $("#ideaList");
  const emptyState = $("#emptyState");
  const count = $("#ideaCount");
  const searchInput = $("#searchInput");
  const dataPanel = $("#dataPanel");
  const editDialog = $("#editDialog");
  let ideas = loadIdeas();
  let activeStatus = "Все";
  let deferredInstallPrompt = null;
  let toastTimer = null;

  function loadIdeas() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
    render();
  }
  function makeId() {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `idea-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  function today() {
    return new Date().toISOString();
  }
  function safeUrl(raw) {
    if (!raw) return "";
    try {
      const u = new URL(raw);
      return ["http:", "https:"].includes(u.protocol) ? u.href : "";
    } catch { return ""; }
  }
  function titleFromUrl(raw) {
    try {
      const u = new URL(raw);
      return `Находка: ${u.hostname.replace(/^www\./, "")}`;
    } catch { return ""; }
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ru-RU", { day:"numeric", month:"short", year:"numeric" }).format(date);
  }
  function iconFor(category) {
    if (category.includes("3D")) return "🧩";
    if (category.includes("Электроника")) return "⚡";
    if (category.includes("Механизмы")) return "⚙️";
    if (category.includes("Дом")) return "🪴";
    if (category.includes("Программирование")) return "🤖";
    return "💡";
  }
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }
  function addIdea({title = "", source = "", note = "", category = "Не разобрано", priority = "Сохранить"} = {}) {
    const cleanSource = safeUrl(source.trim());
    const cleanTitle = title.trim() || titleFromUrl(cleanSource) || (note.trim().slice(0, 48)) || "Новая идея";
    const idea = {
      id: makeId(),
      title: cleanTitle,
      source: cleanSource,
      note: note.trim(),
      category,
      priority,
      status: "Входящие",
      tags: [],
      createdAt: today(),
      updatedAt: today(),
      aiStatus: "not_configured"
    };
    ideas.unshift(idea);
    persist();
    return idea;
  }
  function render() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = ideas.filter((idea) => {
      const matchesStatus = activeStatus === "Все" || idea.status === activeStatus;
      const haystack = [idea.title, idea.note, idea.source, idea.category, ...(idea.tags || [])].join(" ").toLowerCase();
      return matchesStatus && haystack.includes(query);
    });
    count.textContent = String(ideas.length);
    list.innerHTML = filtered.map((idea) => {
      const source = safeUrl(idea.source);
      const tags = (idea.tags || []).map((tag) => `<span class="pill">#${escapeHtml(tag)}</span>`).join("");
      const note = idea.note ? `<p class="card-note">${escapeHtml(idea.note)}</p>` : "";
      const sourceLink = source ? `<a class="card-source" href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">↗ Открыть источник</a>` : "";
      const nextStatus = idea.status === "Входящие" ? "На полке" :
        idea.status === "На полке" ? "На верстаке" :
        idea.status === "На верстаке" ? "Готово" : "На полке";
      return `<article class="idea-card" data-id="${escapeHtml(idea.id)}">
        <div class="card-top">
          <div class="card-symbol">${iconFor(idea.category || "")}</div>
          <div class="card-main">
            <h3 class="card-title">${escapeHtml(idea.title)}</h3>
            <div class="card-date">Добавлено ${escapeHtml(formatDate(idea.createdAt))}</div>
          </div>
        </div>
        ${note}
        ${sourceLink}
        <div class="card-meta">
          <span class="pill status">${escapeHtml(idea.status)}</span>
          <span class="pill">${escapeHtml(idea.category)}</span>
          <span class="pill priority">${escapeHtml(idea.priority)}</span>
          ${tags}
        </div>
        <div class="card-actions">
          <button class="small-btn main-action" data-action="advance" data-id="${escapeHtml(idea.id)}" type="button">→ ${escapeHtml(nextStatus)}</button>
          <button class="small-btn" data-action="edit" data-id="${escapeHtml(idea.id)}" type="button">Редактировать</button>
        </div>
      </article>`;
    }).join("");
    emptyState.classList.toggle("hidden", filtered.length > 0);
    if (ideas.length === 0) {
      emptyState.querySelector("h3").textContent = "Пока здесь пусто";
      emptyState.querySelector("p").textContent = "Сохрани первую находку — пусть хорошим идеям будет где жить.";
    } else if (filtered.length === 0) {
      emptyState.querySelector("h3").textContent = "Ничего не найдено";
      emptyState.querySelector("p").textContent = "Попробуй изменить запрос или фильтр.";
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const source = String(data.get("source") || "");
    if (source.trim() && !safeUrl(source.trim())) {
      showToast("Ссылка должна начинаться с https:// или http://");
      $("#ideaSource").focus();
      return;
    }
    addIdea({
      title: String(data.get("title") || ""),
      source,
      note: String(data.get("note") || ""),
      category: String(data.get("category") || "Не разобрано"),
      priority: String(data.get("priority") || "Сохранить")
    });
    form.reset();
    $("#ideaCategory").value = "Не разобрано";
    $("#ideaPriority").value = "Сохранить";
    showToast("Идея сохранена в Сарайчик");
    $("#ideaTitle").focus();
  });
  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      activeStatus = button.dataset.status;
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.toggle("active", b === button));
      render();
    });
  });
  searchInput.addEventListener("input", render);

  list.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const idea = ideas.find((item) => item.id === button.dataset.id);
    if (!idea) return;
    if (button.dataset.action === "advance") {
      const flow = ["Входящие", "На полке", "На верстаке", "Готово"];
      idea.status = flow[(flow.indexOf(idea.status) + 1) % flow.length];
      idea.updatedAt = today();
      persist();
      showToast(`Статус изменён: ${idea.status}`);
    } else {
      openEdit(idea);
    }
  });

  function openEdit(idea) {
    $("#editId").value = idea.id;
    $("#editTitle").value = idea.title || "";
    $("#editSource").value = idea.source || "";
    $("#editNote").value = idea.note || "";
    $("#editCategory").value = idea.category || "Не разобрано";
    $("#editPriority").value = idea.priority || "Сохранить";
    $("#editStatus").value = idea.status || "Входящие";
    $("#editTags").value = (idea.tags || []).join(", ");
    editDialog.showModal();
  }
  $("#cancelEditBtn").addEventListener("click", () => editDialog.close());
  $("#editForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const id = $("#editId").value;
    const idea = ideas.find((item) => item.id === id);
    if (!idea) return;
    const sourceRaw = $("#editSource").value.trim();
    if (sourceRaw && !safeUrl(sourceRaw)) {
      showToast("Проверь ссылку: нужен http:// или https://");
      return;
    }
    Object.assign(idea, {
      title: $("#editTitle").value.trim() || "Новая идея",
      source: safeUrl(sourceRaw),
      note: $("#editNote").value.trim(),
      category: $("#editCategory").value,
      priority: $("#editPriority").value,
      status: $("#editStatus").value,
      tags: $("#editTags").value.split(",").map((x) => x.trim().replace(/^#/, "")).filter(Boolean).slice(0, 20),
      updatedAt: today()
    });
    persist();
    editDialog.close();
    showToast("Карточка обновлена");
  });
  $("#deleteIdeaBtn").addEventListener("click", () => {
    const id = $("#editId").value;
    if (!confirm("Удалить эту идею без возможности отмены?")) return;
    ideas = ideas.filter((item) => item.id !== id);
    persist();
    editDialog.close();
    showToast("Идея удалена");
  });

  $("#toolsBtn").addEventListener("click", () => dataPanel.classList.toggle("hidden"));
  $("#closeToolsBtn").addEventListener("click", () => dataPanel.classList.add("hidden"));
  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ app: "DIY Сарайчик", version: 1, exportedAt: today(), ideas }, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diy-saraichik-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Резервная копия подготовлена");
  });
  $("#importFile").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.ideas;
      if (!Array.isArray(incoming)) throw new Error("В файле нет массива ideas");
      const map = new Map(ideas.map((idea) => [idea.id, idea]));
      incoming.forEach((idea) => {
        if (!idea || typeof idea !== "object") return;
        const id = String(idea.id || makeId());
        const clean = {
          id, title: String(idea.title || "Новая идея"),
          source: safeUrl(String(idea.source || "")), note: String(idea.note || ""),
          category: String(idea.category || "Не разобрано"),
          priority: String(idea.priority || "Сохранить"),
          status: ["Входящие","На полке","На верстаке","Готово"].includes(idea.status) ? idea.status : "Входящие",
          tags: Array.isArray(idea.tags) ? idea.tags.map(String) : [],
          createdAt: idea.createdAt || today(), updatedAt: idea.updatedAt || today(),
          aiStatus: idea.aiStatus || "not_configured"
        };
        map.set(id, clean);
      });
      ideas = Array.from(map.values()).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      persist();
      showToast("Импорт завершён");
    } catch (error) {
      showToast(`Не удалось импортировать: ${error.message}`);
    } finally { event.target.value = ""; }
  });
  $("#clearBtn").addEventListener("click", () => {
    if (!confirm("Точно удалить ВСЕ идеи из этого браузера? Сначала скачай резервную копию, если она нужна.")) return;
    ideas = [];
    persist();
    showToast("Локальная коллекция очищена");
  });

  // Android Share Target: PWA must be installed and hosted over HTTPS for this to work.
  function consumeSharedLink() {
    const params = new URLSearchParams(location.search);
    if (!params.has("share-target")) return;
    const sharedUrl = params.get("url") || "";
    const sharedText = params.get("text") || "";
    const sharedTitle = params.get("title") || "";
    $("#ideaSource").value = safeUrl(sharedUrl) || "";
    $("#ideaTitle").value = sharedTitle;
    $("#ideaNote").value = sharedText && sharedText !== sharedUrl ? sharedText : "";
    if (sharedUrl || sharedText || sharedTitle) {
      $("#ideaForm").scrollIntoView({behavior:"smooth", block:"start"});
      showToast("Ссылка получена из меню «Поделиться». Нажми «Сохранить идею».");
    }
    history.replaceState({}, "", location.pathname);
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $("#installBtn").classList.remove("hidden");
  });
  $("#installBtn").addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $("#installBtn").classList.add("hidden");
  });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
  consumeSharedLink();
  render();
})();
