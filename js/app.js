import { SETTINGS } from "./config.js";
import { h } from "./dom.js";
import { LANGS, t, tx, getLang, setLang } from "./i18n.js";
import { createBackend, normaliseUsername, isTeacherName } from "./backend.js";
import { ACTIVITY_TYPES, renderIntro, renderKeywords, renderInfo, hasWork } from "./activities.js";
import { renderTower } from "./tower.js";
import { renderTeacher } from "./teacher.js";

const app = document.getElementById("app");
const langBar = document.getElementById("langbar");
const userBar = document.getElementById("userbar");
const titleEl = document.getElementById("apptitle");

let backend = null;
let user = null;            // e.g. "student07" or "teacher"
let index = null;           // lessons/index.json
let openMap = {};
let cleanup = null;         // called when leaving a page (stops the game loop)
const workCache = {};       // lessonId -> { activityId: data }
const lessonDefs = {};

// ------------------------------------------------------------ helpers
const isTeacher = () => !!user && isTeacherName(user);
async function fetchJSON(path) {
  const pre = window.__IPC_DATA__ && window.__IPC_DATA__[path]; // offline preview build
  if (pre) return JSON.parse(JSON.stringify(pre));
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
}
async function loadLesson(id) {
  if (!lessonDefs[id]) lessonDefs[id] = await fetchJSON(`lessons/${id}.json`);
  return lessonDefs[id];
}
function isOpen(item, map = openMap) {
  if (item.soon) return false;
  if (item.requires) return isOpen(index.lessons.find((l) => l.id === item.requires), map);
  return map[item.id] !== undefined ? !!map[item.id] : !!item.openByDefault;
}

// -------------------------------------------------------------- saving
const pending = new Map();
const statusEl = document.getElementById("savestatus");
let statusTimer;
function setStatus(kind) {
  clearTimeout(statusTimer);
  statusEl.textContent = kind ? t(kind) : "";
  statusEl.className = "savestatus " + (kind || "");
  statusEl.dataset.kind = kind || "";
  if (kind === "saved") statusTimer = setTimeout(() => setStatus(null), 2000);
}
function queueSave(lessonId, activityId, data) {
  (workCache[lessonId] ||= {})[activityId] = data;
  const key = lessonId + "__" + activityId;
  if (pending.has(key)) clearTimeout(pending.get(key).timer);
  pending.set(key, { lessonId, activityId, data, timer: setTimeout(() => flushOne(key), 700) });
  setStatus("saving");
  updateProgress();
}
async function flushOne(key) {
  const p = pending.get(key);
  if (!p) return;
  pending.delete(key);
  clearTimeout(p.timer);
  try {
    await backend.saveWork(user, p.lessonId, p.activityId, p.data);
    if (!pending.size) setStatus("saved");
  } catch (e) {
    console.error(e);
    setStatus("saveError");
  }
}
const flushAll = () => Promise.all([...pending.keys()].map(flushOne));
window.addEventListener("pagehide", flushAll);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushAll(); });

// ----------------------------------------------------------- chrome (header)
function renderChrome() {
  titleEl.textContent = t("appTitle");
  langBar.replaceChildren(...LANGS.map((l) => h("button", {
    type: "button", class: "lang" + (l.code === getLang() ? " on" : ""), lang: l.code,
    "aria-pressed": String(l.code === getLang()),
    onclick: async () => { await flushAll(); setLang(l.code); },
  }, l.short)));
  userBar.replaceChildren();
  if (user) {
    userBar.append(...[
      h("span", { class: "who" }, "👤 " + (isTeacher() ? "Teacher" : user.charAt(0).toUpperCase() + user.slice(1))),
      isTeacher() ? h("a", { class: "btn small", href: "#/teacher" }, t("teacherPanel")) : null,
      h("button", { type: "button", class: "btn small", onclick: async () => { await flushAll(); await backend.signOut(); } }, t("signOut")),
    ].filter(Boolean));
  }
}

// ------------------------------------------------------------------ pages
function loginPage() {
  const u = h("input", { type: "text", id: "u", autocomplete: "username", autocapitalize: "none", autocorrect: "off", spellcheck: "false", inputmode: "text" });
  const p = h("input", { type: "password", id: "p", autocomplete: "current-password" });
  const err = h("p", { class: "error", role: "alert" });
  const go = async (e) => {
    e.preventDefault();
    err.textContent = "";
    btn.disabled = true;
    try {
      await backend.signIn(normaliseUsername(u.value), p.value);
    } catch (ex) {
      console.error(ex);
      err.textContent = t("loginError");
      btn.disabled = false;
    }
  };
  const btn = h("button", { type: "submit", class: "btn primary big" }, t("signIn"));
  app.replaceChildren(h("form", { class: "login", onsubmit: go },
    h("div", { class: "login-emoji" }, "🏛️"),
    h("h2", {}, t("appTitle")),
    h("p", { class: "muted" }, t("loginHelp")),
    h("label", { for: "u" }, t("username")), u,
    h("label", { for: "p" }, t("password")), p,
    err, btn,
    backend.demo ? h("p", { class: "demo" }, "Demo mode – work is saved on this device only. Pupils: Student01 / abc. Teacher: teacher / teacher.") : null));
}

function menuPage() {
  const cards = index.lessons.map((it) => {
    const open = isOpen(it);
    const teacherView = isTeacher();
    const soon = !!it.soon;
    const canOpen = open || (teacherView && !soon);
    const href = it.type === "game" ? `#/game/${it.game}` : `#/lesson/${it.id}`;
    return h("article", { class: `card ${canOpen ? "" : "off"} ${it.type === "game" ? "game" : ""}` },
      h("div", { class: "card-emoji" }, it.emoji || "📘"),
      h("div", { class: "card-body" },
        it.week ? h("div", { class: "card-week" }, tx(it.week)) : null,
        h("h3", {}, tx(it.title)),
        it.summary ? h("p", {}, tx(it.summary)) : null),
      canOpen
        ? h("a", { class: "btn primary", href }, it.type === "game" ? t("play") : t("openLesson"), teacherView && !open ? " 🔒" : "")
        : h("span", { class: "badge" }, soon ? t("comingSoon") : "🔒 " + t("locked")));
  });
  app.replaceChildren(h("h2", { class: "page-title" }, t("lessons")), h("div", { class: "cards" }, cards));
}

let progressEl = null, currentLesson = null;
function updateProgress() {
  if (!progressEl || !currentLesson) return;
  const acts = currentLesson.blocks.filter((b) => ACTIVITY_TYPES[b.type]);
  const done = acts.filter((a) => hasWork(a, (workCache[currentLesson.id] || {})[a.id])).length;
  progressEl.firstChild.textContent = t("progress", { n: done, m: acts.length });
  progressEl.lastChild.firstChild.style.width = acts.length ? (done / acts.length) * 100 + "%" : "0%";
}

function nextLink(id) {
  const list = index.lessons.filter((l) => l.type !== "game");
  const n = list[list.findIndex((l) => l.id === id) + 1];
  if (!n || n.soon || (!isOpen(n) && !isTeacher())) return null;
  return h("a", { class: "btn primary next", href: `#/lesson/${n.id}` }, t("nextLesson") + ": " + tx(n.title) + " →");
}

async function lessonPage(id) {
  const meta = index.lessons.find((l) => l.id === id);
  if (!meta || meta.soon || (!isOpen(meta) && !isTeacher())) { location.hash = "#/"; return; }
  app.replaceChildren(h("p", { class: "loading" }, t("loading")));
  const def = await loadLesson(id);
  if (!workCache[id]) workCache[id] = await backend.loadWork(user, id);
  currentLesson = def;
  progressEl = h("div", { class: "progress" }, h("span", {}), h("div", { class: "bar" }, h("i", {})));
  const blocks = def.blocks.map((b) => {
    if (b.type === "intro") return renderIntro(b);
    if (b.type === "keywords") return renderKeywords(b);
    if (b.type === "info") return renderInfo(b);
    if (b.type === "game") {
      return h("section", { class: "activity game-link" },
        h("div", { class: "act-head" }, h("h3", {}, "🧱 " + tx(b.title))),
        h("p", { class: "act-instr" }, tx(b.text)),
        h("a", { class: "btn primary", href: `#/game/${b.game}` }, t("play")));
    }
    const render = ACTIVITY_TYPES[b.type];
    if (!render) return null;
    return render(b, { saved: workCache[id][b.id], save: (data) => queueSave(id, b.id, data) });
  });
  app.replaceChildren(
    h("a", { class: "back", href: "#/" }, "← " + t("back")),
    progressEl, ...blocks,
    nextLink(id),
    h("a", { class: "back", href: "#/" }, "← " + t("back")));
  updateProgress();
}

async function gamePage(game) {
  const meta = index.lessons.find((l) => l.game === game);
  if (!meta || (!isOpen(meta) && !isTeacher())) { location.hash = "#/"; return; }
  const holder = h("div", {});
  app.replaceChildren(h("a", { class: "back", href: "#/" }, "← " + t("back")), holder);
  const g = await renderTower(holder, { backend, username: user, className: SETTINGS.className });
  cleanup = () => g.destroy();
  gameApi = g;
}
let gameApi = null;

async function teacherPage() {
  if (!isTeacher()) { location.hash = "#/"; return; }
  app.replaceChildren(h("a", { class: "back", href: "#/" }, "← " + t("back")), h("div", { id: "tp" }, h("p", { class: "loading" }, t("loading"))));
  await renderTeacher(document.getElementById("tp"), {
    backend, lessons: index.lessons, loadLesson, pupilCount: SETTINGS.pupilCount, isOpen,
  });
}

// ----------------------------------------------------------------- router
async function route(opts = {}) {
  if (cleanup) { cleanup(); cleanup = null; gameApi = null; }
  progressEl = null; currentLesson = null;
  renderChrome();
  window.scrollTo(0, opts.keepScroll ? window.scrollY : 0);
  if (!user) { loginPage(); return; }
  try {
    openMap = await backend.getOpen().catch(() => ({}));
    const [, page, arg] = location.hash.replace(/^#/, "").split("/");
    if (page === "lesson" && arg) await lessonPage(arg);
    else if (page === "game" && arg) await gamePage(arg);
    else if (page === "teacher") await teacherPage();
    else menuPage();
  } catch (e) {
    console.error(e);
    app.replaceChildren(h("p", { class: "error" }, t("loadError")));
  }
}

window.addEventListener("hashchange", () => route());
window.addEventListener("langchange", () => {
  if (gameApi) { renderChrome(); gameApi.relabel(); return; } // don't restart a game in progress
  route({ keepScroll: true });
});

// ------------------------------------------------------------------- boot
(async function boot() {
  renderChrome();
  app.replaceChildren(h("p", { class: "loading" }, t("loading")));
  try {
    index = await fetchJSON("lessons/index.json");
    backend = await createBackend();
  } catch (e) {
    console.error(e);
    app.replaceChildren(h("p", { class: "error" }, t("loadError")));
    return;
  }
  backend.onAuth((u) => {
    const changed = u !== user;
    user = u;
    if (changed) {
      Object.keys(workCache).forEach((k) => delete workCache[k]);
      if (!u && location.hash && location.hash !== "#/") history.replaceState(null, "", "#/"); // no second render
    }
    route();
  });
})();
