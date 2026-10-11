// Teacher panel (English only): open/close lessons, see who has done what, read pupil work.
import { h } from "./dom.js";
import { hasWork, summarise, ACTIVITY_TYPES } from "./activities.js";
const pupilName = (i) => "student" + String(i).padStart(2, "0");
const pretty = (u) => u.charAt(0).toUpperCase() + u.slice(1);

export async function renderTeacher(root, { backend, lessons, loadLesson, pupilCount, isOpen }) {
  const real = lessons.filter((l) => !l.soon && l.type !== "game");
  let openMap = await backend.getOpen();

  // ---- 1. open / close lessons
  const toggles = lessons.filter((l) => !l.soon).map((l) => {
    const cb = h("input", { type: "checkbox" });
    cb.checked = isOpen(l, openMap);
    cb.addEventListener("change", async () => {
      openMap = { ...openMap, [l.id]: cb.checked };
      try { await backend.setOpen(openMap); status.textContent = "Saved ✓"; } catch (_) { status.textContent = "Could not save – check your connection."; }
    });
    return h("label", { class: "toggle" }, cb, " ", `${l.emoji || ""} ${l.title.en}`, l.requires ? h("small", { class: "muted" }, " (needs " + l.requires + ")") : null);
  });
  const status = h("span", { class: "muted" });

  // ---- 2. class overview + pupil work
  const lessonSel = h("select", {}, real.map((l) => h("option", { value: l.id }, l.title.en)));
  const out = h("div", { class: "t-out" });
  const detail = h("div", { class: "t-detail" });

  async function loadOverview() {
    const id = lessonSel.value;
    out.replaceChildren(h("p", {}, "Loading…"));
    detail.replaceChildren();
    const def = await loadLesson(id);
    const acts = def.blocks.filter((b) => ACTIVITY_TYPES[b.type]);
    const names = Array.from({ length: pupilCount }, (_, i) => pupilName(i + 1));
    const work = await Promise.all(names.map((n) => backend.loadWork(n, id).catch(() => ({}))));
    const head = h("tr", {}, h("th", {}, "Pupil"), acts.map((a, i) => h("th", { title: a.title.en }, "A" + (i + 1))), h("th", {}, "Done"));
    const rows = names.map((n, ri) => {
      const done = acts.map((a) => hasWork(a, work[ri][a.id]));
      return h("tr", { class: "clickable", onclick: () => showPupil(n, def, work[ri]) },
        h("td", {}, pretty(n)),
        done.map((d) => h("td", { class: d ? "yes" : "no" }, d ? "✓" : "–")),
        h("td", {}, `${done.filter(Boolean).length}/${acts.length}`));
    });
    const legend = h("p", { class: "muted" }, acts.map((a, i) => `A${i + 1} = ${a.title.en}`).join("   ·   "));
    out.replaceChildren(h("table", { class: "t-table" }, h("thead", {}, head), h("tbody", {}, rows)), legend, h("p", { class: "muted" }, "Click a pupil to read their work."));
  }

  function showPupil(name, def, work) {
    const acts = def.blocks.filter((b) => ACTIVITY_TYPES[b.type]);
    detail.replaceChildren(
      h("h3", {}, `${pretty(name)} – ${def.title.en}`),
      ...acts.map((a, i) => h("div", { class: "t-card" }, h("h4", {}, `A${i + 1}. ${a.title.en}`), summarise(a, work[a.id]))));
    detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const resetBtn = h("button", {
    type: "button", class: "btn",
    onclick: async () => {
      if (!confirm("Reset the Tower Builder leaderboard for everyone?")) return;
      await backend.resetScores();
      resetBtn.textContent = "Leaderboard reset ✓";
    },
  }, "Reset tower leaderboard");

  root.replaceChildren(
    h("section", { class: "teacher" },
      h("h2", {}, "Teacher panel"),
      h("div", { class: "t-card" }, h("h3", {}, "Lessons open to pupils"), h("div", { class: "toggles" }, toggles), status),
      h("div", { class: "t-card" },
        h("h3", {}, "Class overview & pupil work"),
        h("div", { class: "controls" }, lessonSel, h("button", { type: "button", class: "btn primary", onclick: loadOverview }, "Load class")),
        out, detail),
      h("div", { class: "t-card" }, h("h3", {}, "Tower Builder"), resetBtn)));
}
