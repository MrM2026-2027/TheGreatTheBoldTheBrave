// Tower Builder: build a Greek or Roman building as tall (and as beautiful) as you like.
// Physics by Matter.js (loaded on demand). The world is much taller than the screen:
// the view follows the top of the building, and pupils can look up and down.
// Best heights go to a class leaderboard.
import { h, clamp } from "./dom.js";
import { t } from "./i18n.js";

const W = 900;              // world and view width
const VIEW_H = 1000;        // visible height of the canvas
const WORLD_H = 2200;       // full height of the world (about 260 m above the platform)
const GRASS_Y = WORLD_H - 60;
const STEP_H = 18;
const STEPS = [640, 600, 560];               // widths of the three platform steps, bottom to top
const GROUND_Y = GRASS_Y - STEP_H * STEPS.length; // top of the platform: heights are measured from here
const PX_PER_M = 8;         // 8 pixels = 1 "metre" on the score
const MAX_SCORE = 200;      // keep in step with firestore.rules
const MAX_BODIES = 350;     // keeps the game smooth on older iPads
const MAX_CAM = WORLD_H - VIEW_H;

const PIECES = {
  column:      { w: 26,  h: 110, shape: "column", key: "pieceColumn",      fill: "#efe6d0" },
  shortColumn: { w: 22,  h: 60,  shape: "column", key: "pieceShortColumn", fill: "#efe6d0" },
  beam:        { w: 150, h: 22,  shape: "beam",   key: "pieceBeam",        fill: "#d9c9a3" },
  longBeam:    { w: 270, h: 22,  shape: "beam",   key: "pieceLongBeam",    fill: "#d9c9a3" },
  block:       { w: 70,  h: 44,  shape: "block",  key: "pieceBlock",       fill: "#c9b896" },
  smallBlock:  { w: 36,  h: 24,  shape: "block",  key: "pieceSmallBlock",  fill: "#c9b896" },
  roof:        { w: 150, h: 56,  shape: "roof",   key: "pieceRoof",        fill: "#c0623a" },
  bigRoof:     { w: 280, h: 80,  shape: "roof",   key: "pieceBigRoof",     fill: "#c0623a" },
  arch:        { w: 120, h: 90,  shape: "arch",   key: "pieceArch",        fill: "#d8c7a4", ow: 60, spring: -5 },
  dome:        { w: 140, h: 70,  shape: "dome",   key: "pieceDome",        fill: "#cfd6dc" },
  statue:      { w: 26,  h: 64,  shape: "statue", key: "pieceStatue",      fill: "#f3eee2" },
};

// "null" = each piece's own stone colour
const PAINTS = [null, "#f6f2e8", "#d9c08f", "#c0623a", "#a83a2a", "#d9a92e", "#3b78b0", "#5b7b3a", "#7a5c9e"];

const STROKE = "#6b5b3a", DETAIL = "rgba(60,45,20,.3)";

// Draw a piece centred on (0,0), unrotated. Used for the game, the ghost and the tray icons.
function drawShape(c, kind, fill) {
  const p = PIECES[kind], w = p.w, hh = p.h;
  c.fillStyle = fill; c.strokeStyle = STROKE; c.lineWidth = 2; c.lineJoin = "round";
  const box = (x, y, bw, bh) => { c.beginPath(); c.rect(x, y, bw, bh); c.fill(); c.stroke(); };
  const detail = (fn) => { c.save(); c.strokeStyle = DETAIL; c.lineWidth = 1.5; c.beginPath(); fn(); c.stroke(); c.restore(); };
  switch (p.shape) {
    case "column": {
      const cap = Math.min(8, hh * 0.1);
      box(-w / 2 + 3, -hh / 2 + cap, w - 6, hh - 2 * cap);
      box(-w / 2, -hh / 2, w, cap);
      box(-w / 2, hh / 2 - cap, w, cap);
      detail(() => { for (const fx of [-w / 4 + 1.5, 0, w / 4 - 1.5]) { c.moveTo(fx, -hh / 2 + cap + 3); c.lineTo(fx, hh / 2 - cap - 3); } });
      break;
    }
    case "beam":
      box(-w / 2, -hh / 2, w, hh);
      detail(() => { for (let x = -w / 2 + 14; x < w / 2 - 8; x += 22) { c.moveTo(x, -hh / 2 + 4); c.lineTo(x, hh / 2 - 4); c.moveTo(x + 4, -hh / 2 + 4); c.lineTo(x + 4, hh / 2 - 4); } });
      break;
    case "block":
      box(-w / 2, -hh / 2, w, hh);
      if (w > 50) detail(() => { c.moveTo(-w / 2 + 3, 0); c.lineTo(w / 2 - 3, 0); c.moveTo(-w / 6, -hh / 2 + 3); c.lineTo(-w / 6, 0); c.moveTo(w / 6, 0); c.lineTo(w / 6, hh / 2 - 3); });
      break;
    case "roof":
      c.beginPath(); c.moveTo(-w / 2, hh / 2); c.lineTo(w / 2, hh / 2); c.lineTo(0, -hh / 2); c.closePath(); c.fill(); c.stroke();
      detail(() => { c.moveTo(-w / 2 + w * 0.2, hh / 2 - 5); c.lineTo(w / 2 - w * 0.2, hh / 2 - 5); c.lineTo(0, -hh / 2 + hh * 0.35); c.closePath(); });
      break;
    case "arch": {
      const ow = p.ow, r = ow / 2, sp = p.spring;
      c.beginPath();
      c.moveTo(-w / 2, hh / 2); c.lineTo(-w / 2, -hh / 2); c.lineTo(w / 2, -hh / 2); c.lineTo(w / 2, hh / 2);
      c.lineTo(ow / 2, hh / 2); c.lineTo(ow / 2, sp); c.arc(0, sp, r, 0, Math.PI, true); c.lineTo(-ow / 2, hh / 2); c.closePath();
      c.fill(); c.stroke();
      detail(() => { for (let k = 1; k < 6; k++) { const a = Math.PI + (k * Math.PI) / 6; c.moveTo(Math.cos(a) * r, sp + Math.sin(a) * r); c.lineTo(Math.cos(a) * (r + 14), sp + Math.sin(a) * (r + 14)); } });
      break;
    }
    case "dome":
      c.beginPath(); c.moveTo(-w / 2, hh / 2); c.arc(0, hh / 2, w / 2, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      detail(() => { for (const k of [-0.5, 0, 0.5]) { c.moveTo(k * w * 0.8, hh / 2); c.quadraticCurveTo(k * w * 0.45, -hh / 4, 0, -hh / 2 + 2); } });
      break;
    case "statue": {
      box(-w / 2, hh / 2 - 10, w, 10);                       // plinth
      c.beginPath(); c.moveTo(-w / 2 + 4, hh / 2 - 10); c.lineTo(-w / 2 + 6, -hh / 2 + 18); c.lineTo(w / 2 - 6, -hh / 2 + 18); c.lineTo(w / 2 - 4, hh / 2 - 10); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.arc(0, -hh / 2 + 9, 7, 0, Math.PI * 2); c.fill(); c.stroke();
      detail(() => { c.moveTo(-3, -hh / 2 + 24); c.lineTo(-5, hh / 2 - 14); c.moveTo(4, -hh / 2 + 24); c.lineTo(3, hh / 2 - 14); });
      break;
    }
  }
}

function loadMatter() {
  if (window.Matter) return Promise.resolve(window.Matter);
  const urls = [
    new URL("./vendor/matter.min.js", import.meta.url).href, // bundled copy (works offline / behind filters)
    "https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js",
    "https://cdn.jsdelivr.net/npm/matter-js@0.19.0/build/matter.min.js",
  ];
  return new Promise((resolve, reject) => {
    if (window.Matter) return resolve(window.Matter);
    const tryUrl = (i) => {
      if (i >= urls.length) return reject(new Error("Matter.js could not be loaded"));
      const s = document.createElement("script");
      s.src = urls[i];
      s.onload = () => resolve(window.Matter);
      s.onerror = () => { s.remove(); tryUrl(i + 1); };
      document.head.append(s);
    };
    tryUrl(0);
  });
}

const pretty = (u) => u.charAt(0).toUpperCase() + u.slice(1);
const boundsCenter = (b) => ({ x: (b.bounds.min.x + b.bounds.max.x) / 2, y: (b.bounds.min.y + b.bounds.max.y) / 2 });

// fixed scenery (same every game)
const CLOUDS = (() => {
  let s = 7; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: 22 }, () => ({ x: rnd() * W, y: 60 + rnd() * (GROUND_Y - 420), s: 0.6 + rnd() * 0.9 }));
})();

export async function renderTower(root, { backend, username, className }) {
  root.replaceChildren(h("p", { class: "loading" }, t("loading")));
  let Matter;
  try { Matter = await loadMatter(); } catch (e) {
    root.replaceChildren(h("p", { class: "error" }, t("loadError")));
    return { destroy() {}, relabel() {} };
  }
  const { Engine, World, Bodies, Body } = Matter;

  // ---------------------------------------------------------------- UI
  const canvas = h("canvas", { class: "tower-canvas" });
  canvas.style.touchAction = "none";
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * ratio; canvas.height = VIEW_H * ratio;
  const g = canvas.getContext("2d");

  const el = {
    title: h("h2", {}), help: h("p", { class: "act-instr" }),
    count: h("b", {}), height: h("b", {}), best: h("b", {}),
    status: h("div", { class: "tower-status" }),
    fact: h("div", { class: "fact", hidden: true }),
    board: h("ol", { class: "board" }), boardTitle: h("h3", {}),
    paintLabel: h("span", { class: "paint-label" }),
  };
  const labels = {}, trayBtns = {}, paintBtns = [];
  const tray = h("div", { class: "tray" });
  Object.keys(PIECES).forEach((kind) => {
    const p = PIECES[kind];
    const ic = h("canvas", { class: "piece-icon", width: 112, height: 80 });
    const c = ic.getContext("2d");
    const s = Math.min(100 / p.w, 68 / p.h, 0.9);
    c.translate(56, 40); c.scale(s, s);
    drawShape(c, kind, p.fill);
    labels[kind] = h("span", {});
    const b = h("button", { type: "button", class: "piece", onclick: () => { current = kind; refreshTray(); } }, ic, labels[kind]);
    trayBtns[kind] = b;
    tray.append(b);
  });
  const paints = h("div", { class: "paints" }, el.paintLabel);
  PAINTS.forEach((col, i) => {
    const b = h("button", { type: "button", class: "swatch" + (col ? "" : " natural"), onclick: () => { paint = col; refreshTray(); } });
    if (col) b.style.background = col;
    paintBtns.push(b);
    paints.append(b);
  });
  const btn = (fn) => h("button", { type: "button", class: "btn", onclick: fn });
  const rotateBtn = btn(() => { rot = !rot; refreshTray(); });
  const undoBtn = btn(() => undo());
  const upBtn = btn(() => { follow = false; camY = clamp(camY - 350, 0, MAX_CAM); refreshTray(); });
  const downBtn = btn(() => { follow = false; camY = clamp(camY + 350, 0, MAX_CAM); refreshTray(); });
  const followBtn = btn(() => { follow = true; refreshTray(); });
  const measureBtn = h("button", { type: "button", class: "btn primary", onclick: () => startMeasure() });
  const newBtn = btn(() => { if (bodies.length < 5 || confirm(t("confirmNew"))) newGame(); });

  root.replaceChildren(
    h("section", { class: "tower" },
      el.title, el.help,
      h("div", { class: "tower-play" },
        h("div", { class: "canvas-wrap tower-wrap" }, canvas),
        h("div", { class: "tower-side" },
          h("div", { class: "hud" },
            h("span", {}, h("span", { class: "k", "data-k": "count" }), " ", el.count),
            h("span", {}, h("span", { class: "k", "data-k": "height" }), " ", el.height),
            h("span", {}, h("span", { class: "k", "data-k": "best" }), " ", el.best)),
          h("div", { class: "tower-controls" }, tray),
          h("div", { class: "tower-controls" }, paints),
          h("div", { class: "tower-controls tower-actions" }, rotateBtn, undoBtn, upBtn, downBtn, followBtn, measureBtn, newBtn),
          el.status, el.fact)),
      h("div", { class: "board-wrap" }, el.boardTitle, el.board)));

  // ------------------------------------------------------------ state
  let engine, bodies, statics, current = "column", rot = false, paint = null;
  let pointer = null, touchAim = false, down = false, lastDrop = 0, raf = 0, dead = false;
  let measuring = false, settledFrames = 0, measureFrames = 0, best = 0, liveHeight = 0, frame = 0;
  let camY = MAX_CAM, follow = true;

  function newGame() {
    engine = Engine.create({ positionIterations: 10, velocityIterations: 8, enableSleeping: true });
    engine.gravity.y = 1;
    bodies = [];
    const st = { isStatic: true, friction: 1, frictionStatic: 1.5 };
    statics = [
      Bodies.rectangle(W / 2, GRASS_Y + 60, W + 400, 120, { ...st, label: "ground" }),
      Bodies.rectangle(-30, WORLD_H / 2, 60, WORLD_H * 3, { ...st, label: "wall" }),
      Bodies.rectangle(W + 30, WORLD_H / 2, 60, WORLD_H * 3, { ...st, label: "wall" }),
      ...STEPS.map((sw, i) => Bodies.rectangle(W / 2, GRASS_Y - STEP_H * i - STEP_H / 2, sw, STEP_H, { ...st, label: "step" })),
    ];
    World.add(engine.world, statics);
    measuring = false; liveHeight = 0; camY = MAX_CAM; follow = true;
    el.fact.hidden = true;
    el.status.textContent = "";
    el.status.className = "tower-status";
    updateHud(); refreshTray();
  }

  function makeBody(kind, x, y, angle, fill) {
    const p = PIECES[kind], w = p.w, hh = p.h;
    const opts = { friction: 0.9, frictionStatic: 1.3, restitution: 0, density: 0.002, frictionAir: 0.02, slop: 0.04 };
    let b;
    if (p.shape === "roof") {
      b = Bodies.fromVertices(x, y, [[{ x: -w / 2, y: hh / 2 }, { x: w / 2, y: hh / 2 }, { x: 0, y: -hh / 2 }]], opts);
    } else if (p.shape === "dome") {
      const vs = [];
      for (let k = 0; k <= 16; k++) { const a = Math.PI + (k * Math.PI) / 16; vs.push({ x: (w / 2) * Math.cos(a), y: hh / 2 + (w / 2) * Math.sin(a) }); }
      b = Bodies.fromVertices(x, y, [vs], opts);
    } else if (p.shape === "arch") {
      const lw = (w - p.ow) / 2;
      b = Body.create({
        ...opts,
        parts: [
          Bodies.rectangle(x - w / 2 + lw / 2, y, lw, hh, opts),
          Bodies.rectangle(x + w / 2 - lw / 2, y, lw, hh, opts),
          Bodies.rectangle(x, y + (-hh / 2 + p.spring) / 2, p.ow, p.spring + hh / 2, opts),
        ],
      });
    } else {
      b = Bodies.rectangle(x, y, w, hh, opts);
    }
    // where the drawing's centre sits relative to the body's centre of mass (unrotated)
    const c0 = boundsCenter(b);
    const off = { x: c0.x - b.position.x, y: c0.y - b.position.y };
    Body.setAngle(b, angle);
    const c1 = boundsCenter(b);
    Body.translate(b, { x: x - c1.x, y: y - c1.y });
    b.plugin = { kind, fill: fill || p.fill, off, born: frame };
    return b;
  }

  // Where the piece would go: under the pointer, lifted so it never overlaps anything.
  function ghostPos() {
    if (!pointer) return null;
    const p = PIECES[current];
    const gw = rot ? p.h : p.w, gh = rot ? p.w : p.h;
    const x = clamp(pointer.x, gw / 2 + 2, W - gw / 2 - 2);
    let y = clamp(pointer.y - (touchAim ? 80 : 0) + camY, gh / 2 + 2, GRASS_Y - gh / 2 - 1);
    const all = bodies.concat(statics);
    const hitAt = (yy) => all.find((b) => b.bounds.min.x < x + gw / 2 && b.bounds.max.x > x - gw / 2 && b.bounds.min.y < yy + gh / 2 && b.bounds.max.y > yy - gh / 2);
    // slide up (or down) past anything in the way; keep whichever free spot is nearer the finger
    const slide = (yy, dir) => {
      for (let k = 0; k < 80; k++) {
        const hit = hitAt(yy);
        if (!hit) return yy;
        yy = dir < 0 ? hit.bounds.min.y - gh / 2 - 1 : hit.bounds.max.y + gh / 2 + 1;
        if (yy < gh / 2 || yy > GRASS_Y - gh / 2) return null;
      }
      return null;
    };
    const up = slide(y, -1), dn = slide(y, 1);
    if (up === null && dn === null) return { x, y, blocked: true };
    if (up === null) return { x, y: dn };
    if (dn === null) return { x, y: up };
    return { x, y: Math.abs(dn - y) < Math.abs(up - y) ? dn : up };
  }

  function drop() {
    if (measuring || performance.now() - lastDrop < 250) return;
    if (bodies.length >= MAX_BODIES) { el.status.textContent = t("maxPieces"); return; }
    const gp = ghostPos();
    if (!gp) return;
    if (gp.blocked) { el.status.textContent = t("skyTop"); return; }
    lastDrop = performance.now();
    const b = makeBody(current, gp.x, gp.y, rot ? Math.PI / 2 : 0, paint);
    World.add(engine.world, b);
    bodies.push(b);
    if (!el.fact.hidden || el.status.classList.contains("done")) { el.status.textContent = ""; el.status.className = "tower-status"; }
    updateHud();
  }

  function undo() {
    if (measuring || !bodies.length) return;
    World.remove(engine.world, bodies.pop());
    bodies.forEach((b) => Matter.Sleeping.set(b, false));
    updateHud();
  }

  const isSettled = (b) => b.isSleeping || (b.speed < 0.15 && b.angularSpeed < 0.02);
  // settledOnly: ignore pieces still falling, so the view and the live height don't chase them
  function topY(settledOnly) {
    let top = GROUND_Y;
    for (const b of bodies) if (b.bounds.min.y < top && (!settledOnly || (frame - b.plugin.born > 40 && b.speed < 0.6))) top = b.bounds.min.y;
    return top;
  }
  const towerHeight = (settledOnly) => Math.max(0, Math.round(((GROUND_Y - topY(settledOnly)) / PX_PER_M) * 10) / 10);

  // ----------------------------------------------------------- loop
  function step() {
    if (dead) return;
    Engine.update(engine, 1000 / 60);
    frame += 1;
    bodies = bodies.filter((b) => {
      if (b.position.y > WORLD_H + 200) { World.remove(engine.world, b); return false; }
      return true;
    });
    if (frame % 6 === 0) { liveHeight = Math.min(MAX_SCORE, towerHeight(true)); updateHud(); }
    if (follow && !down) {
      const target = clamp(topY(true) - VIEW_H * 0.4, 0, MAX_CAM);
      camY += (target - camY) * 0.06;
    }
    if (measuring) {
      settledFrames = bodies.some((b) => !isSettled(b)) ? 0 : settledFrames + 1;
      measureFrames += 1;
      if (settledFrames > 60 || measureFrames > 480) finishMeasure();
    }
    draw();
    raf = requestAnimationFrame(step);
  }

  function startMeasure() {
    if (measuring) return;
    if (!bodies.length) { el.status.textContent = t("towerHelp"); return; }
    measuring = true; settledFrames = 0; measureFrames = 0;
    el.status.className = "tower-status";
    el.status.textContent = t("waitSettle");
    follow = true; refreshTray();
  }

  async function finishMeasure() {
    measuring = false;
    const score = Math.min(MAX_SCORE, towerHeight());
    liveHeight = score;
    el.status.className = "tower-status done";
    el.status.textContent = `${t("measured")} ${score} m`;
    el.fact.replaceChildren(h("b", {}, "💡 " + t("factTitle")), " ", t("factText"));
    el.fact.hidden = false;
    updateHud();
    if (score > best) {
      try {
        const saved = await backend.submitScore(username, score);
        if (saved) {
          best = score;
          el.status.textContent += `  ★ ${t("newBest")}`;
          updateHud();
        }
      } catch (_) { /* offline: keep playing */ }
    }
    loadBoard();
  }

  // ------------------------------------------------------- drawing
  let sky = null;
  function cloud(x, y, s) {
    g.beginPath();
    g.ellipse(x, y, 46 * s, 16 * s, 0, 0, Math.PI * 2);
    g.ellipse(x - 26 * s, y + 4 * s, 26 * s, 12 * s, 0, 0, Math.PI * 2);
    g.ellipse(x + 24 * s, y - 6 * s, 28 * s, 14 * s, 0, 0, Math.PI * 2);
    g.fill();
  }
  function cypress(x, ht) {
    g.fillStyle = "#3f6b3a";
    g.beginPath(); g.ellipse(x, GRASS_Y - ht / 2, 13, ht / 2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#6b4f2e"; g.fillRect(x - 2, GRASS_Y - 8, 4, 8);
  }
  function scenery(v0, v1) {
    if (!sky) {
      sky = g.createLinearGradient(0, 0, 0, WORLD_H);
      sky.addColorStop(0, "#2d6aa3"); sky.addColorStop(0.55, "#7fbbe5"); sky.addColorStop(1, "#eaf4f9");
    }
    g.fillStyle = sky; g.fillRect(0, v0, W, v1 - v0);
    g.fillStyle = "rgba(255,255,255,.85)";
    for (const c of CLOUDS) if (c.y > v0 - 60 && c.y < v1 + 60) cloud(c.x, c.y, c.s);
    if (v1 < GRASS_Y - 260) return;
    // far hills, near hills, sea glimpse
    g.fillStyle = "#b8cba3";
    g.beginPath(); g.moveTo(0, GRASS_Y); g.bezierCurveTo(140, GRASS_Y - 220, 300, GRASS_Y - 120, 430, GRASS_Y - 150);
    g.bezierCurveTo(560, GRASS_Y - 190, 700, GRASS_Y - 90, W, GRASS_Y - 170); g.lineTo(W, GRASS_Y); g.closePath(); g.fill();
    g.fillStyle = "#97b37f";
    g.beginPath(); g.moveTo(0, GRASS_Y); g.bezierCurveTo(120, GRASS_Y - 90, 240, GRASS_Y - 40, 330, GRASS_Y - 55);
    g.bezierCurveTo(520, GRASS_Y - 90, 660, GRASS_Y - 20, W, GRASS_Y - 80); g.lineTo(W, GRASS_Y); g.closePath(); g.fill();
    cypress(70, 120); cypress(105, 90); cypress(800, 130); cypress(838, 95);
    // grass
    g.fillStyle = "#7da45a"; g.fillRect(0, GRASS_Y, W, WORLD_H - GRASS_Y);
    g.fillStyle = "#93ba6c"; g.fillRect(0, GRASS_Y, W, 6);
    // marble platform with three steps and stone joints
    STEPS.forEach((sw, i) => {
      const y = GRASS_Y - STEP_H * (i + 1), x = W / 2 - sw / 2;
      g.fillStyle = i === STEPS.length - 1 ? "#f1eadb" : "#e6dcc6";
      g.fillRect(x, y, sw, STEP_H);
      g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(x, y, sw, 3);
      g.strokeStyle = "#a8986e"; g.lineWidth = 1.5; g.strokeRect(x, y, sw, STEP_H);
      g.strokeStyle = "rgba(120,100,60,.35)"; g.beginPath();
      for (let jx = x + (i % 2 ? 20 : 40); jx < x + sw - 10; jx += 40) { g.moveTo(jx, y + 3); g.lineTo(jx, y + STEP_H); }
      g.stroke();
    });
  }
  function marks(v0, v1) {
    g.font = "bold 13px system-ui"; g.textAlign = "left"; g.textBaseline = "middle";
    for (let m = 10; m <= 250; m += 10) {
      const y = GROUND_Y - m * PX_PER_M;
      if (y < v0 - 10 || y > v1 + 10) continue;
      g.fillStyle = "rgba(255,255,255,.75)"; g.fillRect(8, y - 9, 50, 18);
      g.fillStyle = "rgba(31,42,55,.75)"; g.fillRect(8, y, 10, 1.5); g.fillText(m + " m", 21, y + 1);
    }
    if (best > 0) {
      const y = GROUND_Y - best * PX_PER_M;
      if (y > v0 && y < v1) {
        g.save(); g.setLineDash([10, 8]); g.strokeStyle = "#c9a23c"; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(64, y); g.lineTo(W - 24, y); g.stroke(); g.restore();
        const txt = `★ ${t("best")}: ${best} m`;
        g.font = "bold 14px system-ui"; const tw = g.measureText(txt).width;
        g.fillStyle = "#c9a23c"; g.fillRect(W - 34 - tw - 12, y - 12, tw + 12, 24);
        g.fillStyle = "#1f2a37"; g.fillText(txt, W - 34 - tw - 6, y + 1);
      }
    }
  }
  function drawBody(b, alpha) {
    const { kind, fill, off } = b.plugin;
    g.save();
    if (alpha) g.globalAlpha = alpha;
    g.translate(b.position.x, b.position.y); g.rotate(b.angle); g.translate(off.x, off.y);
    drawShape(g, kind, fill);
    g.restore();
  }
  function ghost() {
    if (!pointer || measuring) return;
    const gp = ghostPos(); if (!gp) return;
    const fill = paint || PIECES[current].fill;
    g.save();
    g.setLineDash([6, 8]); g.strokeStyle = "rgba(31,42,55,.35)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(gp.x, gp.y); g.lineTo(gp.x, GRASS_Y); g.stroke();
    g.setLineDash([]);
    g.globalAlpha = gp.blocked ? 0.25 : 0.6;
    g.translate(gp.x, gp.y); g.rotate(rot ? Math.PI / 2 : 0);
    drawShape(g, current, fill);
    g.restore();
  }
  function draw() {
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    const v0 = camY, v1 = camY + VIEW_H;
    g.save();
    g.translate(0, -camY);
    scenery(v0, v1);
    marks(v0, v1);
    for (const b of bodies) if (b.bounds.max.y > v0 && b.bounds.min.y < v1) drawBody(b);
    ghost();
    g.restore();
    // where the view is in the world
    const trackH = VIEW_H - 20;
    g.fillStyle = "rgba(31,42,55,.18)"; g.fillRect(W - 14, 10, 6, trackH);
    g.fillStyle = "rgba(31,42,55,.55)"; g.fillRect(W - 14, 10 + (camY / WORLD_H) * trackH, 6, (VIEW_H / WORLD_H) * trackH);
  }

  // ------------------------------------------------- pointer input
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * VIEW_H) / r.height };
  };
  canvas.addEventListener("pointerdown", (e) => {
    down = true; touchAim = e.pointerType !== "mouse";
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    pointer = toCanvas(e);
  });
  canvas.addEventListener("pointermove", (e) => { if (down || e.pointerType === "mouse") { touchAim = e.pointerType !== "mouse"; pointer = toCanvas(e); } });
  canvas.addEventListener("pointerup", (e) => {
    if (!down) return;
    down = false; pointer = toCanvas(e);
    drop();
    if (e.pointerType !== "mouse") pointer = null;
  });
  canvas.addEventListener("pointercancel", () => { down = false; pointer = null; });
  canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !down) pointer = null; });

  // ------------------------------------------------- text + board
  function refreshTray() {
    Object.entries(trayBtns).forEach(([k, b]) => b.classList.toggle("on", k === current));
    paintBtns.forEach((b, i) => { const on = PAINTS[i] === paint; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    rotateBtn.classList.toggle("on", rot);
    followBtn.classList.toggle("on", follow);
  }
  function updateHud() {
    el.count.textContent = String(bodies ? bodies.length : 0);
    el.height.textContent = `${liveHeight} m`;
    el.best.textContent = `${best} m`;
  }
  function relabel() {
    el.title.textContent = "🧱 " + t("towerTitle");
    el.help.textContent = t("towerHelp");
    root.querySelector('[data-k="count"]').textContent = t("piecesUsed") + ":";
    root.querySelector('[data-k="height"]').textContent = t("height") + ":";
    root.querySelector('[data-k="best"]').textContent = t("best") + ":";
    Object.entries(labels).forEach(([k, s]) => { s.textContent = t(PIECES[k].key); });
    el.paintLabel.textContent = "🎨 " + t("paint") + ":";
    paintBtns.forEach((b, i) => {
      const name = PAINTS[i] ? `${t("paint")} ${i}` : t("natural");
      b.setAttribute("aria-label", name); b.title = name;
      if (!PAINTS[i]) b.textContent = t("natural");
    });
    rotateBtn.textContent = "↻ " + t("rotate");
    undoBtn.textContent = "↩ " + t("undo");
    upBtn.textContent = "▲ " + t("lookUp");
    downBtn.textContent = "▼ " + t("lookDown");
    followBtn.textContent = "🎯 " + t("follow");
    measureBtn.textContent = "📏 " + t("measure");
    newBtn.textContent = "🔄 " + t("newGame");
    el.boardTitle.textContent = "🏆 " + t("leaderboard") + (className ? ` · ${className}` : "");
    if (el.status.classList.contains("done")) {
      el.fact.replaceChildren(h("b", {}, "💡 " + t("factTitle")), " ", t("factText"));
      el.status.textContent = `${t("measured")} ${liveHeight} m`;
    } else if (measuring) el.status.textContent = t("waitSettle");
    loadBoard(true);
  }
  let boardData = null;
  async function loadBoard(cached) {
    try {
      if (!cached || !boardData) boardData = await backend.getScores();
    } catch (_) { boardData = boardData || []; }
    const top = [...boardData].sort((a, b) => b.best - a.best).slice(0, 10);
    const mine = boardData.find((s) => s.username === username);
    if (mine && mine.best > best) { best = mine.best; updateHud(); }
    el.board.replaceChildren(...(top.length
      ? top.map((s) => h("li", { class: s.username === username ? "me" : "" },
          h("span", {}, pretty(s.username)), s.username === username ? h("em", {}, ` (${t("you")})`) : null, h("b", {}, ` ${s.best} m`)))
      : [h("li", { class: "muted" }, t("noScores"))]));
  }

  newGame();
  relabel();      // also loads the leaderboard
  refreshTray();
  raf = requestAnimationFrame(step);

  return {
    destroy() { dead = true; cancelAnimationFrame(raf); },
    relabel,
  };
}
