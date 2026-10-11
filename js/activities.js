// Reusable activity types. A lesson file (lessons/*.json) just lists blocks;
// each block's "type" picks one of the renderers below.
//   ctx = { saved, save(data) }   saved = what the pupil already did (or undefined)
import { h, makeDraggable } from "./dom.js";
import { t, tx, getLang, canSpeak, speak } from "./i18n.js";
import { EXTRA } from "./activities2.js";

export function listenBtn(getText, lang) {
  if (!canSpeak(lang)) return null;
  return h("button", {
    class: "listen", type: "button", "aria-label": t("listen"), title: t("listen"),
    onclick: (e) => { e.stopPropagation(); speak(getText(), lang); },
  }, "🔊");
}

export function shell(def, cls, ...body) {
  const instr = def.instructions || def.prompt;
  return h("section", { class: `activity ${cls}` },
    h("div", { class: "act-head" },
      h("h3", {}, tx(def.title)),
      listenBtn(() => tx(def.title) + ". " + tx(instr))),
    instr ? h("p", { class: "act-instr" }, tx(instr)) : null,
    def.image ? figure(def.image) : null,
    ...body);
}

export function scoreLine(n, m) { return h("div", { class: "score" }, `${t("score")}: ${n} / ${m}`); }

export function figure(img) {
  return h("figure", { class: "fig" },
    h("img", { src: img.src, alt: tx(img.alt || img.caption || ""), loading: "lazy" }),
    img.caption ? h("figcaption", {}, tx(img.caption)) : null);
}

// "info" block: a short teaching text (paragraphs, optional picture)
export function renderInfo(b) {
  const paras = (b.paras || []).map((p) => h("p", {}, tx(p)));
  return h("section", { class: "info" },
    h("div", { class: "act-head" }, h("h3", {}, "📖 " + tx(b.title)),
      listenBtn(() => tx(b.title) + ". " + (b.paras || []).map((p) => tx(p)).join(" "))),
    b.image ? figure(b.image) : null,
    ...paras,
    b.fact ? h("div", { class: "fact" }, "💡 ", tx(b.fact)) : null);
}

// ============================================================ intro / keywords
export function renderIntro(b) {
  return h("section", { class: "intro" },
    h("div", { class: "intro-emoji" }, b.emoji || "🏛️"),
    h("div", {},
      h("h2", {}, tx(b.title)),
      h("p", {}, tx(b.text), " ", listenBtn(() => tx(b.title) + ". " + tx(b.text)))));
}

export function renderKeywords(b) {
  const lang = getLang();
  const grid = h("div", { class: "kw-grid" });
  b.items.forEach((it) => {
    const card = h("div", {
      class: "kw", role: "button", tabindex: "0",
      onclick: () => card.classList.toggle("flipped"),
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.classList.toggle("flipped"); } },
    },
      h("div", { class: "kw-front" },
        h("div", { class: "kw-emo" }, it.emoji || "📘"),
        h("div", { class: "kw-term" }, it.term.en),
        lang !== "en" ? h("div", { class: "kw-trans" }, tx(it.term)) : null,
        listenBtn(() => `${it.term.en}. ${it.def.en}`, "en")),
      h("div", { class: "kw-back" },
        h("div", { class: "kw-def" }, tx(it.def)),
        lang !== "en" ? h("div", { class: "kw-en" }, it.def.en) : null));
    grid.append(card);
  });
  return h("section", { class: "activity keywords" },
    h("div", { class: "act-head" }, h("h3", {}, tx(b.title))),
    h("p", { class: "act-instr" }, t("tapWord")),
    grid);
}

// ===================================================================== sort
// Drag (or tap) chips into zones. layout:"venn" draws overlapping circles.
// If items have a "zone" the pupil can press Check. allowCustom lets them add ideas.
function sortActivity(def, ctx) {
  const saved = ctx.saved || {};
  const st = { placed: { ...(saved.placed || {}) }, custom: [...(saved.custom || [])], checked: !!saved.checked };
  let selected = null;
  const root = h("div", { class: def.layout === "venn" ? "sort venn" : "sort" });
  const allItems = () => [
    ...def.items,
    ...st.custom.map((c) => ({ id: c.id, text: c.text, custom: true })),
  ];
  const zoneOf = (id) => st.placed[id] || "pool";
  const persist = () => ctx.save({ placed: st.placed, custom: st.custom, checked: st.checked });

  function place(id, zone) {
    if (zone === "pool") delete st.placed[id]; else st.placed[id] = zone;
    st.checked = false;
    selected = null;
    persist();
    render();
  }
  function zoneClick(e, zone) {
    if (e.target.closest(".chip") || !selected) return;
    place(selected, zone);
  }
  function chip(it) {
    const graded = st.checked && it.zone && zoneOf(it.id) !== "pool";
    const cls = graded ? (zoneOf(it.id) === it.zone ? "ok" : "bad") : "";
    const label = typeof it.text === "string" ? it.text : tx(it.text);
    const c = h("div", { class: `chip ${cls} ${selected === it.id ? "selected" : ""}` },
      it.emoji ? h("span", { class: "emo" }, it.emoji) : null,
      h("span", {}, label),
      it.custom ? h("button", {
        class: "chip-x", type: "button", "aria-label": "remove",
        onpointerdown: (e) => e.stopPropagation(),
        onclick: (e) => {
          e.stopPropagation();
          st.custom = st.custom.filter((x) => x.id !== it.id);
          delete st.placed[it.id];
          persist();
          render();
        },
      }, "×") : null);
    makeDraggable(c, {
      root,
      onDrop: (z) => place(it.id, z),
      onTap: () => { selected = selected === it.id ? null : it.id; render(); },
    });
    return c;
  }

  function render() {
    const its = allItems();
    const pool = h("div", { class: "pool", dataset: { zone: "pool" }, onclick: (e) => zoneClick(e, "pool") },
      h("div", { class: "pool-label" }, t("dragFromHere")),
      h("div", { class: "zone-items" }, its.filter((i) => zoneOf(i.id) === "pool").map(chip)));
    const zones = h("div", { class: "zones" },
      def.zones.map((z) => h("div", {
        class: `zone z-${z.id}`, dataset: { zone: z.id }, onclick: (e) => zoneClick(e, z.id),
      },
        h("div", { class: "zone-label" }, z.emoji ? z.emoji + " " : "", tx(z.label)),
        h("div", { class: "zone-items" }, its.filter((i) => zoneOf(i.id) === z.id).map(chip)))));
    const parts = [pool, zones];

    if (def.allowCustom) {
      const input = h("input", { type: "text", class: "idea-input", placeholder: t("typeIdea"), maxlength: "40" });
      const add = () => {
        const v = input.value.trim();
        if (!v) return;
        st.custom.push({ id: "c" + Date.now().toString(36), text: v });
        persist();
        render();
      };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
      parts.push(h("div", { class: "idea-row" }, input, h("button", { type: "button", class: "btn", onclick: add }, t("add"))));
    }
    const graded = def.items.filter((i) => i.zone);
    if (def.check && graded.length) {
      parts.push(h("div", { class: "controls" },
        h("button", { type: "button", class: "btn primary", onclick: () => { st.checked = true; persist(); render(); } }, t("check")),
        st.checked ? scoreLine(graded.filter((i) => zoneOf(i.id) === i.zone).length, graded.length) : null));
    }
    root.replaceChildren(...parts);
  }
  render();
  return shell(def, "act-sort", root);
}

// ===================================================================== fill
// Sentences with a ___ blank and a word bank. Words can be dragged or tapped in.
function fillActivity(def, ctx) {
  const saved = ctx.saved || {};
  const st = { filled: { ...(saved.filled || {}) }, checked: !!saved.checked };
  let selected = null;
  const root = h("div", { class: "fill" });
  const wordById = Object.fromEntries(def.words.map((w) => [w.id, w]));
  const persist = () => ctx.save({ filled: st.filled, checked: st.checked });

  function place(wordId, zone) {
    for (const k of Object.keys(st.filled)) if (st.filled[k] === wordId) delete st.filled[k];
    if (zone !== "bank") st.filled[zone.slice(1)] = wordId; // replaces any word already there
    st.checked = false;
    selected = null;
    persist();
    render();
  }
  function wordChip(w) {
    const c = h("div", { class: `chip word ${selected === w.id ? "selected" : ""}` }, tx(w.text));
    makeDraggable(c, {
      root,
      onDrop: (z) => place(w.id, z),
      onTap: () => { selected = selected === w.id ? null : w.id; render(); },
    });
    return c;
  }
  function render() {
    const used = new Set(Object.values(st.filled));
    const bank = h("div", {
      class: "pool", dataset: { zone: "bank" },
      onclick: (e) => { if (!e.target.closest(".chip") && selected) place(selected, "bank"); },
    }, h("div", { class: "zone-items" }, def.words.filter((w) => !used.has(w.id)).map(wordChip)));

    const sentences = def.sentences.map((s, i) => {
      const [before, ...rest] = tx(s.text).split("___");
      const after = rest.join("___");
      const wid = st.filled[i];
      const state = st.checked && wid ? (wid === s.answer ? "ok" : "bad") : "";
      const blank = h("span", {
        class: `blank ${state}`, dataset: { zone: "s" + i },
        onclick: (e) => { if (!e.target.closest(".chip") && selected) place(selected, "s" + i); },
      }, wid ? wordChip(wordById[wid]) : "     ");
      return h("li", {}, before, blank, after);
    });
    const parts = [bank, h("ol", { class: "sentences" }, sentences)];
    parts.push(h("div", { class: "controls" },
      h("button", { type: "button", class: "btn primary", onclick: () => { st.checked = true; persist(); render(); } }, t("check")),
      st.checked ? scoreLine(def.sentences.filter((s, i) => st.filled[i] === s.answer).length, def.sentences.length) : null));
    root.replaceChildren(...parts);
  }
  render();
  return shell(def, "act-fill", root);
}

// ===================================================================== quiz
function quizActivity(def, ctx) {
  const saved = ctx.saved || {};
  const st = { answers: { ...(saved.answers || {}) } };
  const root = h("div", { class: "quiz" });
  function render() {
    const qs = def.questions.map((q, qi) => {
      const chosen = st.answers[qi];
      const opts = q.options.map((o) => {
        const cls = chosen === o.id ? (o.id === q.answer ? "ok" : "bad") : "";
        return h("button", {
          type: "button", class: `opt ${cls}`,
          onclick: () => { st.answers[qi] = o.id; ctx.save({ answers: st.answers }); render(); },
        }, tx(o.text));
      });
      return h("div", { class: "q" },
        h("div", { class: "q-text" }, `${qi + 1}. `, tx(q.q), " ", listenBtn(() => tx(q.q))),
        h("div", { class: "opts" }, opts),
        chosen ? h("div", { class: `explain ${chosen === q.answer ? "ok" : "bad"}` },
          h("b", {}, chosen === q.answer ? t("correct") : t("notQuite")), " ", tx(q.explain)) : null);
    });
    const n = def.questions.filter((q, i) => st.answers[i] === q.answer).length;
    const done = Object.keys(st.answers).length === def.questions.length;
    root.replaceChildren(...qs, done ? scoreLine(n, def.questions.length) : null);
  }
  render();
  return shell(def, "act-quiz", root);
}

// ==================================================================== write
function writeActivity(def, ctx) {
  const saved = ctx.saved || {};
  const ta = h("textarea", { rows: String(def.rows || 5), placeholder: t("writeHere"), class: "write-box" });
  ta.value = saved.text || "";
  ta.addEventListener("input", () => ctx.save({ text: ta.value }));
  const lang = getLang();
  const starters = (def.starters || []).map((s) => h("button", {
    type: "button", class: "starter",
    onclick: () => {
      const sep = ta.value && !/\s$/.test(ta.value) ? " " : "";
      ta.setRangeText(sep + s.en + " ", ta.value.length, ta.value.length, "end"); // always English: pupils are learning it
      ta.dispatchEvent(new Event("input"));
      ta.focus();
    },
  }, h("b", {}, s.en), lang !== "en" ? h("small", {}, tx(s)) : null));
  return shell(def, "act-write",
    starters.length ? h("div", { class: "starter-label" }, t("sentenceStarters")) : null,
    starters.length ? h("div", { class: "starters" }, starters) : null,
    ta);
}

// ===================================================================== draw
export function makePad(def, savedPng, onSave) {
  const W = def.width || 900, H = def.height || 520;
  const canvas = h("canvas", { width: String(W), height: String(H), class: `draw-canvas ${def.bgImage ? "" : "grid"}` });
  if (def.bgImage) canvas.style.backgroundImage = `url(${def.bgImage})`;
  const g = canvas.getContext("2d");
  g.lineCap = "round"; g.lineJoin = "round";
  const colours = ["#1f2a37", "#1d5c8a", "#b9552e", "#6b7a3a", "#c8a23a", "#8a3b8f"];
  let colour = colours[0], size = 5, erasing = false, drawing = false, penSeen = false, last = null, activeId = null;
  const snaps = [];

  if (savedPng) {
    const img = new Image();
    img.onload = () => g.drawImage(img, 0, 0, W, H);
    img.src = savedPng;
  }
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };
  const snap = () => { snaps.push(g.getImageData(0, 0, W, H)); if (snaps.length > 15) snaps.shift(); };
  function save() {
    let url = canvas.toDataURL("image/png");
    if (url.length > (def.maxChars || 800000)) { // keep under Firestore's 1 MB document limit
      const c2 = document.createElement("canvas");
      c2.width = W; c2.height = H;
      const g2 = c2.getContext("2d");
      g2.fillStyle = "#fff"; g2.fillRect(0, 0, W, H); g2.drawImage(canvas, 0, 0);
      url = c2.toDataURL("image/jpeg", 0.6);
    }
    onSave(url);
  }
  function seg(a, b, pressure) {
    g.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    g.strokeStyle = colour;
    g.lineWidth = (erasing ? size * 3 : size) * (pressure ? 0.5 + pressure : 1);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "pen") penSeen = true;
    if (e.pointerType === "touch" && penSeen) return; // palm rejection once a pencil is in use
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    snap();
    drawing = true; activeId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    last = pos(e);
    seg(last, { x: last.x + 0.01, y: last.y }, e.pointerType === "pen" ? e.pressure : 0);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing || e.pointerId !== activeId) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    (evs.length ? evs : [e]).forEach((ev) => {
      const p = pos(ev);
      seg(last, p, e.pointerType === "pen" ? ev.pressure : 0);
      last = p;
    });
  });
  const end = (e) => {
    if (!drawing || e.pointerId !== activeId) return;
    drawing = false;
    save();
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  const swatches = colours.map((c) => {
    const b = h("button", {
      type: "button", class: "swatch", style: `background:${c}`, "aria-label": c,
      onclick: () => { colour = c; erasing = false; refresh(); },
    });
    b.dataset.c = c;
    return b;
  });
  const sizeBtns = [3, 6, 12].map((s) => h("button", {
    type: "button", class: "size", dataset: { s: String(s) }, "aria-label": "size " + s,
    onclick: () => { size = s; refresh(); },
  }, h("i", { style: `width:${s * 2}px;height:${s * 2}px` })));
  const eraserBtn = h("button", { type: "button", class: "btn", onclick: () => { erasing = !erasing; refresh(); } }, "🧽 " + t("eraser"));
  function refresh() {
    swatches.forEach((b) => b.classList.toggle("on", !erasing && b.dataset.c === colour));
    sizeBtns.forEach((b) => b.classList.toggle("on", Number(b.dataset.s) === size));
    eraserBtn.classList.toggle("on", erasing);
  }
  refresh();
  const undoBtn = h("button", {
    type: "button", class: "btn",
    onclick: () => { const s = snaps.pop(); if (s) { g.globalCompositeOperation = "source-over"; g.putImageData(s, 0, 0); save(); } },
  }, "↩ " + t("undo"));
  const clearBtn = h("button", {
    type: "button", class: "btn",
    onclick: () => { if (confirm(t("clearConfirm"))) { snap(); g.clearRect(0, 0, W, H); save(); } },
  }, "🗑 " + t("clear"));

  return [
    h("div", { class: "toolbar" }, h("div", { class: "tool-group" }, swatches), h("div", { class: "tool-group" }, sizeBtns), eraserBtn, undoBtn, clearBtn),
    h("div", { class: "canvas-wrap" }, canvas)];
}
function drawActivity(def, ctx) {
  return shell(def, "act-draw", ...makePad(def, ctx.saved && ctx.saved.png, (png) => ctx.save({ png })));
}

export const ACTIVITY_TYPES = {
  sort: sortActivity, fill: fillActivity, quiz: quizActivity, write: writeActivity, draw: drawActivity,
  ...Object.fromEntries(Object.entries(EXTRA).map(([k, v]) => [k, v.render])),
};

// ============================================== teacher view helpers
export function hasWork(def, data) {
  if (!data) return false;
  if (EXTRA[def.type]) return EXTRA[def.type].hasWork(def, data);
  switch (def.type) {
    case "sort": return Object.keys(data.placed || {}).length > 0 || (data.custom || []).length > 0;
    case "fill": return Object.keys(data.filled || {}).length > 0;
    case "quiz": return Object.keys(data.answers || {}).length > 0;
    case "write": return !!(data.text && data.text.trim());
    case "draw": return !!data.png;
    default: return false;
  }
}

// Read-only summary of one pupil's answer, always shown in English.
export function summarise(def, data) {
  const wrap = h("div", { class: "sum" });
  const en = (o) => (typeof o === "string" ? o : o.en);
  const mark = (ok) => (ok ? " ✓" : " ✗");
  if (!hasWork(def, data)) { wrap.append(h("em", {}, "No work yet.")); return wrap; }
  if (EXTRA[def.type]) { wrap.append(EXTRA[def.type].summarise(def, data, { en, mark })); return wrap; }
  switch (def.type) {
    case "sort": {
      const placed = data.placed || {};
      def.zones.forEach((z) => {
        const items = [...def.items, ...(data.custom || []).map((c) => ({ id: c.id, text: c.text, own: true }))]
          .filter((i) => placed[i.id] === z.id)
          .map((i) => en(i.text) + (i.own ? " (own idea)" : i.zone ? mark(i.zone === z.id) : ""));
        wrap.append(h("div", {}, h("b", {}, en(z.label) + ": "), items.join(", ") || "–"));
      });
      const left = def.items.filter((i) => !placed[i.id]).map((i) => en(i.text));
      if (left.length) wrap.append(h("div", { class: "muted" }, "Not placed: " + left.join(", ")));
      break;
    }
    case "fill": {
      const words = Object.fromEntries(def.words.map((w) => [w.id, en(w.text)]));
      def.sentences.forEach((s, i) => {
        const w = data.filled[i];
        wrap.append(h("div", {}, en(s.text).replace("___", w ? `[${words[w]}]` : "[ ]") + (w ? mark(w === s.answer) : "")));
      });
      break;
    }
    case "quiz": {
      def.questions.forEach((q, i) => {
        const a = data.answers[i];
        const o = q.options.find((x) => x.id === a);
        wrap.append(h("div", {}, `${i + 1}. ${en(q.q)} → `, o ? en(o.text) + mark(a === q.answer) : "–"));
      });
      break;
    }
    case "write": wrap.append(h("div", { class: "pre" }, data.text)); break;
    case "draw": wrap.append(compositeImg(def.bgImage, data.png)); break;
    default: break;
  }
  return wrap;
}

// pupil drawing on top of its template (so the teacher sees both)
export function compositeImg(bg, png) {
  const img = h("img", { src: png, class: "sum-img", alt: "pupil drawing" });
  if (!bg) return img;
  const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  Promise.all([load(bg), load(png)]).then(([b, p]) => {
    if (!p) return;
    const c = document.createElement("canvas");
    c.width = p.naturalWidth; c.height = p.naturalHeight;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    if (b) g.drawImage(b, 0, 0, c.width, c.height);
    g.drawImage(p, 0, 0, c.width, c.height);
    img.src = c.toDataURL("image/jpeg", 0.8);
  });
  return img;
}
