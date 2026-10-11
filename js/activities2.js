// Extra activity types: pin (map), order (timeline), table, rate, checklist, choose, storyboard.
// Each entry: { render(def, ctx), hasWork(def, data), summarise(def, data, {en, mark}) }
import { h } from "./dom.js";
import { t, tx } from "./i18n.js";
import { shell, scoreLine, makePad, compositeImg } from "./activities.js";

const checkBtn = (onclick) => h("button", { type: "button", class: "btn primary", onclick }, t("check"));
const lbl = (o) => (typeof o === "string" ? o : tx(o));

// deterministic shuffle so a pupil sees the same order every visit
function shuffled(ids, seed) {
  const a = [...ids];
  let x = 0;
  for (const ch of String(seed)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 1664525 + 1013904223) >>> 0;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a.every((v, i) => v === ids[i]) && a.length > 1) a.push(a.shift());
  return a;
}

// ------------------------------------------------------------------ pin
function pinActivity(def, ctx) {
  const saved = ctx.saved || {};
  const st = { pins: { ...(saved.pins || {}) }, checked: !!saved.checked };
  let selected = null;
  const tol = def.tolerance || 9;
  const root = h("div", { class: "pin" });
  const persist = () => ctx.save({ pins: st.pins, checked: st.checked });
  const okPin = (p) => { const pl = def.places.find((x) => x.id === p); const pos = st.pins[p]; return !!pl && !!pos && Math.hypot(pos[0] - pl.x, (pos[1] - pl.y) * (def.aspect || 0.8)) <= tol; };
  function render() {
    const chips = def.places.filter((p) => !st.pins[p.id]).map((p) => h("button", {
      type: "button", class: "chip pinchip" + (selected === p.id ? " selected" : ""),
      onclick: () => { selected = selected === p.id ? null : p.id; render(); },
    }, lbl(p.label)));
    const map = h("div", { class: "pinmap", style: `max-width:min(100%, calc(78vh / ${def.aspect || 0.8}))`, onclick: (e) => {
      if (e.target.closest(".marker") || !selected) return;
      const r = map.getBoundingClientRect();
      st.pins[selected] = [+(((e.clientX - r.left) / r.width) * 100).toFixed(1), +(((e.clientY - r.top) / r.height) * 100).toFixed(1)];
      st.checked = false; selected = null; persist(); render();
    } }, h("img", { src: def.map.src, alt: tx(def.map.alt || def.title), draggable: "false" }));
    def.places.forEach((p) => {
      const pos = st.pins[p.id];
      if (!pos) return;
      const cls = st.checked ? (okPin(p.id) ? "ok" : "bad") : "";
      map.append(h("button", {
        type: "button", class: "marker " + cls, style: `left:${pos[0]}%;top:${pos[1]}%`, title: t("tapRemove"),
        onclick: () => { delete st.pins[p.id]; st.checked = false; persist(); render(); },
      }, h("span", {}, "📍"), h("em", {}, lbl(p.label))));
      if (st.checked && !okPin(p.id)) map.append(h("span", { class: "answer-dot", style: `left:${p.x}%;top:${p.y}%` }, "✓"));
    });
    const n = def.places.filter((p) => okPin(p.id)).length;
    root.replaceChildren(
      h("div", { class: "pool" }, h("div", { class: "pool-label" }, selected ? t("tapMap") : t("tapPlace")), h("div", { class: "zone-items" }, chips)),
      map,
      def.check === false ? null : h("div", { class: "controls" }, checkBtn(() => { st.checked = true; persist(); render(); }), st.checked ? scoreLine(n, def.places.length) : null));
  }
  render();
  return shell(def, "act-pin", root);
}

// ---------------------------------------------------------------- order
function orderActivity(def, ctx) {
  const saved = ctx.saved || {};
  const ids = def.items.map((i) => i.id);
  const st = { order: saved.order && saved.order.length === ids.length ? [...saved.order] : shuffled(ids, def.items[0].id + def.items.length), checked: !!saved.checked, touched: !!saved.touched };
  const byId = Object.fromEntries(def.items.map((i) => [i.id, i]));
  const root = h("div", { class: "order" });
  const persist = () => ctx.save({ order: st.order, checked: st.checked, touched: st.touched });
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= st.order.length) return; [st.order[i], st.order[j]] = [st.order[j], st.order[i]]; st.checked = false; st.touched = true; persist(); render(); };
  const graded = def.check !== false;
  function render() {
    const rows = st.order.map((id, i) => {
      const it = byId[id];
      const cls = st.checked && graded ? (ids[i] === id ? "ok" : "bad") : "";
      return h("li", { class: "order-row " + cls },
        h("span", { class: "num" }, String(i + 1)),
        it.emoji ? h("span", { class: "emo" }, it.emoji) : null,
        h("span", { class: "otext" }, lbl(it.text)),
        h("span", { class: "arrows" },
          h("button", { type: "button", class: "arrow", "aria-label": "up", disabled: i === 0, onclick: () => move(i, -1) }, "▲"),
          h("button", { type: "button", class: "arrow", "aria-label": "down", disabled: i === st.order.length - 1, onclick: () => move(i, 1) }, "▼")));
    });
    const ends = def.ends ? [h("div", { class: "order-end" }, "⬆ ", tx(def.ends[0]))] : [];
    const endB = def.ends ? [h("div", { class: "order-end" }, "⬇ ", tx(def.ends[1]))] : [];
    root.replaceChildren(...ends, h("ol", { class: "order-list" }, rows), ...endB,
      graded ? h("div", { class: "controls" }, checkBtn(() => { st.checked = true; st.touched = true; persist(); render(); }),
        st.checked ? scoreLine(st.order.filter((id, i) => ids[i] === id).length, ids.length) : null) : null);
  }
  render();
  return shell(def, "act-order", root);
}

// ---------------------------------------------------------------- table
function tableActivity(def, ctx) {
  const saved = ctx.saved || {};
  const cells = { ...(saved.cells || {}) };
  const rows = def.rows.map((r) => h("tr", {},
    h("th", { scope: "row" }, lbl(r.label), r.hint ? h("small", {}, tx(r.hint)) : null),
    ...def.cols.map((c) => {
      const ta = h("textarea", { rows: "3", class: "cell", "aria-label": lbl(r.label) + " – " + lbl(c.label), placeholder: t("writeHere") });
      ta.value = cells[r.id + "_" + c.id] || "";
      ta.addEventListener("input", () => { cells[r.id + "_" + c.id] = ta.value; ctx.save({ cells }); });
      return h("td", {}, ta);
    })));
  return shell(def, "act-table", h("div", { class: "table-wrap" }, h("table", { class: "ptable" },
    h("thead", {}, h("tr", {}, h("th", {}), ...def.cols.map((c) => h("th", {}, lbl(c.label))))), h("tbody", {}, rows))));
}

// ----------------------------------------------------------------- rate
function rateActivity(def, ctx) {
  const saved = ctx.saved || {};
  const r = { ...(saved.r || {}) };
  const opts = [[1, "notYet", "🌱"], [2, "gettingThere", "🌿"], [3, "gotIt", "🌳"]];
  const root = h("div", { class: "rate" });
  function render() {
    root.replaceChildren(...def.items.map((it, i) => h("div", { class: "rate-row" },
      h("div", { class: "rate-text" }, lbl(it)),
      h("div", { class: "rate-btns" }, opts.map(([v, k, e]) => h("button", {
        type: "button", class: "rate-btn" + (r[i] === v ? " on" : ""), "aria-pressed": String(r[i] === v),
        onclick: () => { r[i] = v; ctx.save({ r }); render(); },
      }, e + " " + t(k)))))));
  }
  render();
  return shell(def, "act-rate", root);
}

// ------------------------------------------------------------ checklist
function checklistActivity(def, ctx) {
  const saved = ctx.saved || {};
  const done = { ...(saved.done || {}) };
  const root = h("ul", { class: "checklist" });
  function render() {
    root.replaceChildren(...def.items.map((it) => h("li", { class: done[it.id] ? "on" : "" },
      h("label", {}, h("input", { type: "checkbox", checked: !!done[it.id], onchange: (e) => { done[it.id] = e.target.checked; ctx.save({ done }); render(); } }),
        " ", it.emoji ? it.emoji + " " : "", lbl(it.text)))));
  }
  render();
  return shell(def, "act-checklist", root);
}

// --------------------------------------------------------------- choose
function chooseActivity(def, ctx) {
  const saved = ctx.saved || {};
  const st = { picks: [...(saved.picks || [])], why: saved.why || "" };
  const max = def.max || 1;
  const root = h("div", { class: "choose" });
  const persist = () => ctx.save({ picks: st.picks, why: st.why });
  function render() {
    const cards = def.options.map((o) => {
      const on = st.picks.includes(o.id);
      return h("button", {
        type: "button", class: "choice" + (on ? " on" : ""), "aria-pressed": String(on),
        onclick: () => {
          if (on) st.picks = st.picks.filter((x) => x !== o.id);
          else { st.picks.push(o.id); if (st.picks.length > max) st.picks.shift(); }
          persist(); render();
        },
      }, h("span", { class: "emo" }, o.emoji || "⭐"), h("b", {}, lbl(o.label)), o.desc ? h("small", {}, tx(o.desc)) : null);
    });
    const ta = h("textarea", { rows: "3", class: "write-box", placeholder: def.why ? tx(def.why) : t("writeHere") });
    ta.value = st.why;
    ta.addEventListener("input", () => { st.why = ta.value; persist(); });
    root.replaceChildren(h("div", { class: "choices" }, cards), def.why === null ? null : ta);
  }
  render();
  return shell(def, "act-choose", root);
}

// ------------------------------------------------------------ storyboard
function storyboardActivity(def, ctx) {
  const saved = ctx.saved || {};
  const panels = Array.from({ length: def.panels }, (_, i) => ({ png: "", caption: "", ...((saved.panels || [])[i] || {}) }));
  const persist = () => ctx.save({ panels });
  const grid = h("div", { class: "story-grid" }, panels.map((p, i) => {
    const pad = makePad({ width: 480, height: 320, maxChars: 220000 }, p.png, (png) => { p.png = png; persist(); });
    const cap = h("input", { type: "text", class: "caption", maxlength: "90", placeholder: t("caption") });
    cap.value = p.caption;
    cap.addEventListener("input", () => { p.caption = cap.value; persist(); });
    return h("div", { class: "story-panel" }, h("div", { class: "story-n" }, t("scene", { n: i + 1 }), def.labels && def.labels[i] ? " – " + tx(def.labels[i]) : ""), ...pad, cap);
  }));
  return shell(def, "act-story", grid);
}

export const EXTRA = {
  pin: {
    render: pinActivity,
    hasWork: (d, x) => Object.keys(x.pins || {}).length > 0,
    summarise: (d, x, { mark }) => h("div", {}, d.places.map((p) => {
      const pos = (x.pins || {})[p.id];
      const ok = pos && Math.hypot(pos[0] - p.x, (pos[1] - p.y) * (d.aspect || 0.8)) <= (d.tolerance || 9);
      return h("div", {}, lbl({ en: p.label.en }) + ": " + (pos ? "placed" + mark(ok) : "–"));
    })),
  },
  order: {
    render: orderActivity,
    hasWork: (d, x) => !!x.touched || !!x.checked,
    summarise: (d, x, { en, mark }) => {
      const ids = d.items.map((i) => i.id);
      const by = Object.fromEntries(d.items.map((i) => [i.id, i]));
      return h("ol", {}, (x.order || []).map((id, i) => h("li", {}, en(by[id].text) + (d.check === false ? "" : mark(ids[i] === id)))));
    },
  },
  table: {
    render: tableActivity,
    hasWork: (d, x) => Object.values(x.cells || {}).some((v) => v && v.trim()),
    summarise: (d, x) => h("table", { class: "t-table" },
      h("thead", {}, h("tr", {}, h("th", {}), d.cols.map((c) => h("th", {}, c.label.en)))),
      h("tbody", {}, d.rows.map((r) => h("tr", {}, h("th", {}, r.label.en), d.cols.map((c) => h("td", { class: "pre" }, (x.cells || {})[r.id + "_" + c.id] || "–")))))),
  },
  rate: {
    render: rateActivity,
    hasWork: (d, x) => Object.keys(x.r || {}).length > 0,
    summarise: (d, x) => h("div", {}, d.items.map((it, i) => h("div", {}, `${it.en}: ` + (["–", "Not yet", "Getting there", "Got it!"][(x.r || {})[i] || 0])))),
  },
  checklist: {
    render: checklistActivity,
    hasWork: (d, x) => Object.values(x.done || {}).some(Boolean),
    summarise: (d, x) => h("div", {}, d.items.map((it) => h("div", {}, ((x.done || {})[it.id] ? "☑ " : "☐ ") + it.text.en))),
  },
  choose: {
    render: chooseActivity,
    hasWork: (d, x) => (x.picks || []).length > 0 || !!(x.why && x.why.trim()),
    summarise: (d, x) => h("div", {}, h("div", {}, "Chose: " + (x.picks || []).map((p) => (d.options.find((o) => o.id === p) || { label: { en: p } }).label.en).join(", ")), x.why ? h("div", { class: "pre" }, x.why) : null),
  },
  storyboard: {
    render: storyboardActivity,
    hasWork: (d, x) => (x.panels || []).some((p) => p && (p.png || (p.caption && p.caption.trim()))),
    summarise: (d, x) => h("div", { class: "story-grid" }, (x.panels || []).map((p, i) => h("div", {}, h("b", {}, "Scene " + (i + 1)), p.png ? h("img", { src: p.png, class: "sum-img" }) : null, h("div", {}, p.caption || "")))),
  },
};
