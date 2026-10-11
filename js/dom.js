// Tiny DOM helper: h('div', {class:'x', onclick:fn}, child, child...)
export function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "dataset") Object.assign(e.dataset, v);
    else if (k === "html") e.innerHTML = v;
    else if (k === "value") e.value = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return e;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

// Drag-and-drop that works with finger, Apple Pencil and mouse.
// A short touch (no movement) counts as a TAP, so pupils can also
// "tap a chip, then tap where it goes".
export function makeDraggable(chip, { root, onDrop, onTap }) {
  chip.style.touchAction = "none";
  const zoneAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const z = el ? el.closest("[data-zone]") : null;
    return z && root.contains(z) ? z : null;
  };
  chip.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    let ghost = null, moved = false, over = null, lastX = sx, lastY = sy, scroller = null;
    try { chip.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }

    const move = (ev) => {
      lastX = ev.clientX; lastY = ev.clientY;
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
        moved = true;
        const r = chip.getBoundingClientRect();
        ghost = chip.cloneNode(true);
        ghost.classList.add("ghost");
        ghost.style.width = r.width + "px";
        document.body.append(ghost);
        chip.classList.add("dragging");
        // scroll the page when the chip is held near the top or bottom edge
        scroller = setInterval(() => {
          const topEdge = (document.querySelector(".top")?.getBoundingClientRect().bottom || 0) + 50;
          if (lastY > window.innerHeight - 80) window.scrollBy(0, 14);
          else if (lastY < topEdge) window.scrollBy(0, -14);
          else return;
          const z = zoneAt(lastX, lastY);
          if (z !== over) { if (over) over.classList.remove("over"); over = z; if (over) over.classList.add("over"); }
        }, 16);
      }
      if (moved) {
        ghost.style.left = ev.clientX + "px";
        ghost.style.top = ev.clientY + "px";
        const z = zoneAt(ev.clientX, ev.clientY);
        if (z !== over) {
          if (over) over.classList.remove("over");
          over = z;
          if (over) over.classList.add("over");
        }
      }
    };
    const up = (ev) => {
      chip.removeEventListener("pointermove", move);
      chip.removeEventListener("pointerup", up);
      chip.removeEventListener("pointercancel", up);
      if (scroller) clearInterval(scroller);
      if (over) over.classList.remove("over");
      if (ghost) ghost.remove();
      chip.classList.remove("dragging");
      if (moved) {
        const z = ev.type === "pointercancel" ? null : zoneAt(ev.clientX, ev.clientY);
        if (z) onDrop(z.dataset.zone);
      } else if (ev.type === "pointerup") {
        onTap();
      }
    };
    chip.addEventListener("pointermove", move);
    chip.addEventListener("pointerup", up);
    chip.addEventListener("pointercancel", up);
  });
}
