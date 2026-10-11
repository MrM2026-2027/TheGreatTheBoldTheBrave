// Tower Builder: stack Greek building pieces (columns, beams, blocks, a roof) as high as you can.
// Physics by Matter.js (loaded on demand). Best heights go to a class leaderboard.
import { h, clamp } from "./dom.js";
import { t } from "./i18n.js";

const W = 900, H = 640;
const GROUND_Y = 590;      // top of the base platform
const PLATE_W = 260;
const MAX_PIECES = 10;
const PX_PER_M = 8;        // 8 pixels = 1 "metre" on the score
const MAX_SCORE = 200;     // keep in step with firestore.rules

const PIECES = {
  column: { w: 26, h: 110, key: "pieceColumn", fill: "#efe6d0" },
  beam:   { w: 150, h: 22, key: "pieceBeam",   fill: "#d9c9a3" },
  block:  { w: 70, h: 44,  key: "pieceBlock",  fill: "#c9b896" },
  roof:   { w: 150, h: 56, key: "pieceRoof",   fill: "#c0623a" },
};

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

export async function renderTower(root, { backend, username, className }) {
  root.replaceChildren(h("p", { class: "loading" }, t("loading")));
  let Matter;
  try { Matter = await loadMatter(); } catch (e) {
    root.replaceChildren(h("p", { class: "error" }, t("loadError")));
    return { destroy() {}, relabel() {} };
  }
  const { Engine, World, Bodies, Body, Composite } = Matter;

  // ---------------------------------------------------------------- UI
  const canvas = h("canvas", { class: "tower-canvas" });
  canvas.style.touchAction = "none";
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * ratio; canvas.height = H * ratio;
  const g = canvas.getContext("2d");
  g.scale(ratio, ratio);

  const el = {
    title: h("h2", {}), help: h("p", { class: "act-instr" }),
    left: h("b", {}), height: h("b", {}), best: h("b", {}),
    status: h("div", { class: "tower-status" }),
    fact: h("div", { class: "fact", hidden: true }),
    board: h("ol", { class: "board" }), boardTitle: h("h3", {}),
  };
  const labels = {};
  const trayBtns = {};
  const tray = h("div", { class: "tray" });
  Object.entries(PIECES).forEach(([kind, p]) => {
    const scale = 0.45;
    const icon = h("span", { class: "piece-icon" });
    const iw = Math.max(8, p.w * scale), ih = Math.max(8, p.h * scale);
    icon.style.cssText = `width:${iw}px;height:${ih}px;background:${p.fill};` +
      (kind === "roof" ? "clip-path:polygon(0 100%,100% 100%,50% 0);" : "border:1px solid #8a7650;");
    labels[kind] = h("span", {});
    const b = h("button", { type: "button", class: "piece", onclick: () => { current = kind; refreshTray(); } }, icon, labels[kind]);
    trayBtns[kind] = b;
    tray.append(b);
  });
  const rotateBtn = h("button", { type: "button", class: "btn", onclick: () => { rot = !rot; refreshTray(); } });
  const newBtn = h("button", { type: "button", class: "btn", onclick: () => newGame() });

  root.replaceChildren(
    h("section", { class: "tower" },
      el.title, el.help,
      h("div", { class: "hud" },
        h("span", {}, h("span", { class: "k", "data-k": "left" }), " ", el.left),
        h("span", {}, h("span", { class: "k", "data-k": "height" }), " ", el.height),
        h("span", {}, h("span", { class: "k", "data-k": "best" }), " ", el.best)),
      h("div", { class: "canvas-wrap tower-wrap" }, canvas),
      h("div", { class: "tower-controls" }, tray, rotateBtn, newBtn),
      el.status, el.fact,
      h("div", { class: "board-wrap" }, el.boardTitle, el.board)));

  // ------------------------------------------------------------ state
  let engine, bodies, left, current = "column", rot = false;
  let pointer = null, lastDrop = 0, settledFrames = 0, over = false, best = 0, raf = 0, dead = false;
  let loopHeight = 0, frame = 0;

  function newGame() {
    engine = Engine.create({ positionIterations: 10, velocityIterations: 8, enableSleeping: true });
    engine.gravity.y = 1;
    bodies = [];
    left = MAX_PIECES; over = false; settledFrames = 0; loopHeight = 0;
    const plate = Bodies.rectangle(W / 2, GROUND_Y + 11, PLATE_W, 22, { isStatic: true, friction: 1, frictionStatic: 1.5, label: "plate" });
    World.add(engine.world, plate);
    el.fact.hidden = true;
    el.status.textContent = "";
    el.status.className = "tower-status";
    updateHud();
  }

  function makeBody(kind, x, angle) {
    const p = PIECES[kind];
    const opts = { friction: 0.9, frictionStatic: 1.3, restitution: 0, density: 0.002, frictionAir: 0.02, slop: 0.04 };
    let b;
    if (kind === "roof") {
      b = Bodies.fromVertices(x, 36, [[{ x: -p.w / 2, y: p.h / 2 }, { x: p.w / 2, y: p.h / 2 }, { x: 0, y: -p.h / 2 }]], opts);
    } else {
      b = Bodies.rectangle(x, 36, p.w, p.h, opts);
    }
    Body.setAngle(b, angle);
    b.plugin = { kind };
    return b;
  }

  function drop(x) {
    if (over || left <= 0 || performance.now() - lastDrop < 350) return;
    lastDrop = performance.now();
    const b = makeBody(current, clamp(x, 40, W - 40), rot ? Math.PI / 2 : 0);
    World.add(engine.world, b);
    bodies.push(b);
    left -= 1;
    settledFrames = 0;
    updateHud();
  }

  const isSettled = (b) => b.isSleeping || (b.speed < 0.15 && b.angularSpeed < 0.02);
  function towerHeight() {
    let top = GROUND_Y;
    for (const b of bodies) if (b.position.y < H + 50 && b.bounds.min.y < top) top = b.bounds.min.y;
    return Math.max(0, Math.round(((GROUND_Y - top) / PX_PER_M) * 10) / 10);
  }

  // ----------------------------------------------------------- loop
  function step() {
    if (dead) return;
    Engine.update(engine, 1000 / 60);
    frame += 1;
    // pieces that fell off the platform are removed
    bodies = bodies.filter((b) => {
      if (b.position.y > H + 150) { World.remove(engine.world, b); return false; }
      return true;
    });
    const moving = bodies.some((b) => !isSettled(b));
    if (frame % 6 === 0) { loopHeight = towerHeight(); updateHud(); }
    if (!over && left === 0) {
      settledFrames = moving ? 0 : settledFrames + 1;
      el.status.textContent = t("waitSettle");
      if (settledFrames > 90) finish();
    }
    draw();
    raf = requestAnimationFrame(step);
  }

  async function finish() {
    over = true;
    const score = Math.min(MAX_SCORE, towerHeight());
    loopHeight = score;
    el.status.className = "tower-status done";
    el.status.textContent = `${t("roundOver")}  ${score} m`;
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
  function pathFor(vs) {
    g.beginPath();
    g.moveTo(vs[0].x, vs[0].y);
    for (let i = 1; i < vs.length; i++) g.lineTo(vs[i].x, vs[i].y);
    g.closePath();
  }
  function ghost() {
    if (!pointer || over || left <= 0) return;
    const p = PIECES[current];
    const x = clamp(pointer.x, 40, W - 40);
    g.save();
    g.setLineDash([6, 8]);
    g.strokeStyle = "rgba(31,42,55,.35)";
    g.beginPath(); g.moveTo(x, 40); g.lineTo(x, GROUND_Y); g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 0.55;
    g.translate(x, 36);
    g.rotate(rot ? Math.PI / 2 : 0);
    g.fillStyle = p.fill; g.strokeStyle = "#6b5b3a"; g.lineWidth = 2;
    if (current === "roof") {
      g.beginPath(); g.moveTo(-p.w / 2, p.h / 2); g.lineTo(p.w / 2, p.h / 2); g.lineTo(0, -p.h / 2); g.closePath();
    } else {
      g.beginPath(); g.rect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    g.fill(); g.stroke();
    g.restore();
  }
  function draw() {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#a9d4ee"); sky.addColorStop(1, "#f6efe0");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // hill + pedestal
    g.fillStyle = "#b9a77a";
    g.beginPath(); g.moveTo(W / 2 - 170, H); g.lineTo(W / 2 - 100, GROUND_Y + 22); g.lineTo(W / 2 + 100, GROUND_Y + 22); g.lineTo(W / 2 + 170, H); g.closePath(); g.fill();
    g.fillStyle = "#9c8c64"; g.fillRect(W / 2 - PLATE_W / 2, GROUND_Y, PLATE_W, 22);
    // height marks every 10 m
    g.fillStyle = "rgba(31,42,55,.45)"; g.font = "12px system-ui"; g.textAlign = "left";
    for (let m = 10; m * PX_PER_M < GROUND_Y - 30; m += 10) {
      const y = GROUND_Y - m * PX_PER_M;
      g.fillRect(10, y, 18, 1);
      g.fillText(m + " m", 32, y + 4);
    }
    for (const b of bodies) {
      const kind = b.plugin && b.plugin.kind;
      g.fillStyle = (PIECES[kind] || {}).fill || "#ddd";
      g.strokeStyle = "#6b5b3a"; g.lineWidth = 2; g.lineJoin = "round";
      pathFor(b.vertices);
      g.fill(); g.stroke();
    }
    ghost();
  }

  // ------------------------------------------------- pointer input
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };
  let down = false;
  canvas.addEventListener("pointerdown", (e) => { down = true; canvas.setPointerCapture(e.pointerId); pointer = toCanvas(e); });
  canvas.addEventListener("pointermove", (e) => { if (down || e.pointerType === "mouse") pointer = toCanvas(e); });
  canvas.addEventListener("pointerup", (e) => { if (down) { down = false; drop(toCanvas(e).x); if (e.pointerType !== "mouse") pointer = null; } });
  canvas.addEventListener("pointercancel", () => { down = false; pointer = null; });
  canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !down) pointer = null; });

  // ------------------------------------------------- text + board
  function refreshTray() {
    Object.entries(trayBtns).forEach(([k, b]) => b.classList.toggle("on", k === current));
    rotateBtn.classList.toggle("on", rot);
  }
  function updateHud() {
    el.left.textContent = String(left);
    el.height.textContent = `${loopHeight} m`;
    el.best.textContent = `${best} m`;
  }
  function relabel() {
    el.title.textContent = "🧱 " + t("towerTitle");
    el.help.textContent = t("towerHelp");
    root.querySelector('[data-k="left"]').textContent = t("piecesLeft") + ":";
    root.querySelector('[data-k="height"]').textContent = t("height") + ":";
    root.querySelector('[data-k="best"]').textContent = t("best") + ":";
    Object.entries(labels).forEach(([k, s]) => { s.textContent = t(PIECES[k].key); });
    rotateBtn.textContent = "↻ " + t("rotate");
    newBtn.textContent = "🔄 " + t("newGame");
    el.boardTitle.textContent = "🏆 " + t("leaderboard") + (className ? ` · ${className}` : "");
    if (over) {
      el.fact.replaceChildren(h("b", {}, "💡 " + t("factTitle")), " ", t("factText"));
      el.status.firstChild && (el.status.textContent = `${t("roundOver")}  ${loopHeight} m`);
    } else if (left === 0) el.status.textContent = t("waitSettle");
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
