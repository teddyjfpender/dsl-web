// Fig 6 · Commitment and FRI: a folding press.
// Ten perforated plates on two guide pillars, one per FRI layer (2^10 down to
// 2^1). Each plate is shorter than the one below and carries fewer holes; a
// round seal (the layer's Merkle root) is stamped on its end once committed.
// Three seals on the front rail are the three trace trees. A ratchet grinds the
// proof-of-work, then the probe drops pins through every layer: a query at
// position i on a layer of n points lands at i mod n/2 on the next.
import { k, bench, LIVE_HELPERS } from "./parts.mjs";
import MODEL from "../model/s31.mjs";

const WIDTH = 600;
const HEIGHT = 380;

const { stark, poly } = MODEL;
const FRI = stark.fri;
const LAYERS = stark.friLayers; // [{ log, size }] from 2^ldeLog down
const N = LAYERS.length;

// ------------------------------------------------------------ layout
const PLATE = { x: -150, y: -40, w: 292, d: 88, r: 8 };
const X0 = -110; // left end of every plate's hole field
const PT = 2.2; // plate thickness
const GAP = 10; // plate pitch
const Z0 = 14; // underside of the bottom plate
const PAD = 11; // seal pad at each plate's right end
const L0 = 200, LTOP = 24; // drawn hole-field lengths, bottom and top (a visual taper)
const Q = (LTOP / L0) ** (1 / (N - 1));
const LEN = LAYERS.map((_, i) => L0 * Q ** i);
const zOf = (i) => Z0 + i * GAP;
const topOf = (i) => zOf(i) + PT;
const PY = 9, PX = X0 - 8, PR = 2.6; // guide pillars at (PX, ±PY)
const LUG = { x: X0 - 16, y: -15, w: 16, d: 30, r: 1.6 };
const CH_Z = topOf(N - 1) + 20; // crosshead underside
const CH_H = 9;
const PROBE = { x: X0 + 3, y: -6, w: 24, d: 12, r: 1.2 };
const NEEDLE = 5;
const PROBE_Z = topOf(N - 1) + 3.8 + NEEDLE; // probe underside at rest
const PROBE_DROP = 3.6; // needle tips stop 0.2 above the top plate

// Drawn holes: the true count where it can be drawn, otherwise a fixed pitch.
const PITCH = 1.1;
const HOLES = LAYERS.map((layer, i) => Math.min(layer.size, Math.floor(LEN[i] / PITCH)));

// Seven of the queries, at fixed pseudo-random positions on the first layer.
const SHOWN = 7;
const QUERY0 = (() => {
  const out = [];
  let s = 0x5331;
  while (out.length < SHOWN) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const i = Math.floor((s / 2147483648) * LAYERS[0].size);
    if (!out.includes(i)) out.push(i);
  }
  return out;
})();
// fold: position i on a layer of n points maps to i mod n/2 on the next layer
const QUERIES = LAYERS.map((layer) => QUERY0.map((i) => i % layer.size));
const xAt = (layer, index) => X0 + LEN[layer] * ((index + 0.5) / LAYERS[layer].size);

const TREES = [
  { name: "preprocessed", cols: poly.columns.preprocessed.length },
  { name: "base trace", cols: poly.columns.main.length },
  { name: "interaction", cols: poly.columns.interaction },
];
const TREE_X = [-86, -60, -34], TREE_Y = 27;
const WHEEL = { x: 54, y: 27, r: 12, z: 3, h: 4 };
const BOX = { x: 80, y: 17, w: 44, d: 21, r: 2.4 };
const BOX_H = 8;
const WIN = { x: BOX.x + 17, y: BOX.y + 6, w: 23, d: 9, r: 1 };

export default function figure() {
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -17, 0), [PX, -16, CH_Z + CH_H + 10], [PX, 16, CH_Z + CH_H + 10], [X0 + 40, 0, CH_Z + CH_H + 10]],
    WIDTH,
    HEIGHT,
    { pad: 22, azimuth: 58 },
  );
  const B = bench(P);
  const { S, L, D, at } = B;

  // ---------------------------------------------------------- base
  function base() {
    const out = [B.plate(PLATE)];
    out.push(B.ruler({ x: PLATE.x + 22, y: PLATE.y + PLATE.d - 11, w: 150, d: 6, r: 1 }));
    out.push(B.labelPlate({ x: 108, y: PLATE.y + 8, w: 28, d: 14, r: 1.2 }));
    return out.join("");
  }

  // Bolsters that carry the bottom plate's free end and middle.
  function bolsters() {
    const out = [];
    for (const x of [X0 + L0 * 0.48, X0 + L0 + PAD / 2]) {
      const foot = { x: x - 6, y: -8, w: 12, d: 16, r: 1.4 };
      const post = { x: x - 3.5, y: -5, w: 7, d: 10, r: 1 };
      out.push(S(k.slabOf(foot, 0, 2.4, P, 3, 0.4), { tone: "mid" }));
      out.push(B.screwDots([[foot.x + 2, foot.y + 2.2], [foot.x + foot.w - 2, foot.y + foot.d - 2.2]], 2.4, 0.4));
      out.push(S(k.slabOf(post, 2.4, Z0 - 2.4, P, 3, 0.4), { tone: "mid" }));
      out.push(L(k.sideSeam(post, 8, P, 3), { tone: "faint" }));
    }
    return out.join("");
  }

  // ---------------------------------------------------------- pillars
  function pillarSeg(y, z0, z1) {
    if (z1 - z0 < 0.2) return "";
    return S(k.cylinder(PX, y, PR, z0, z1 - z0, P, 24), { tone: "mid", crease: "none" });
  }
  function pillarFoot(y) {
    return [
      S(k.cylinder(PX, y, PR + 2.4, 0, 2, P, 28), { tone: "mid" }),
      S(k.cylinder(PX, y, PR + 1.2, 2, 3, P, 24), { tone: "mid" }),
    ].join("");
  }
  const lugBottom = (i) => zOf(i) - 1;
  const lugTop = (i) => topOf(i) + 1;

  // ---------------------------------------------------------- plates
  function lug(i) {
    const out = [S(k.slabOf(LUG, lugBottom(i), lugTop(i) - lugBottom(i), P, 3, 0.5), { tone: "mid" })];
    out.push(L([k.ring(PX, -PY, PR + 1.2, lugTop(i), P, 20), k.ring(PX, PY, PR + 1.2, lugTop(i), P, 20)].join(""), { tone: "lo" }));
    out.push(B.screwDots([[LUG.x + 3, 0], [LUG.x + LUG.w - 3, -PY], [LUG.x + LUG.w - 3, PY]], lugTop(i), 0.4));
    return out.join("");
  }
  function plate(i) {
    const plan = { x: X0, y: -8, w: LEN[i] + PAD, d: 16, r: 1.2 };
    const field = { x: X0 + 1.4, y: -3, w: LEN[i] - 2.8, d: 6, r: 1.6 };
    const pad = { x: X0 + LEN[i] + 1.2, y: -6.4, w: PAD - 2.6, d: 12.8, r: 1.2 };
    const inner = L(k.sideSeam(plan, zOf(i) + 1, P, 3), { tone: "faint" });
    const out = [`<g data-plate="${i}">${S(k.slabOf(plan, zOf(i), PT, P, 3, 0.4), { tone: "mid", inner })}</g>`];
    out.push(L(k.planOutline(field, topOf(i), P, 3) + k.planOutline(pad, topOf(i), P, 3), { tone: "faint" }));
    return out.join("");
  }
  function holes(i) {
    const pts = [];
    for (let j = 0; j < HOLES[i]; j++) pts.push(at([X0 + LEN[i] * ((j + 0.5) / HOLES[i]), 0, topOf(i)]));
    return D(pts, { size: HOLES[i] > 40 ? 0.32 : 0.45, tone: "mid" });
  }
  // A spacer on plate i that carries the free end of plate i+1.
  function spacer(i) {
    const x = X0 + LEN[i + 1] + PAD / 2;
    const plan = { x: x - 3, y: -7.6, w: 6, d: 3.6, r: 0.8 };
    return S(k.slabOf(plan, topOf(i), zOf(i + 1) - topOf(i), P, 2, 0.3), { tone: "mid" });
  }
  function seal(cx, cy, z, r, attr) {
    const body = [
      S(k.cylinder(cx, cy, r, z, 1.4, P, 32, 0.3), { tone: "hi", crease: "lo", className: "fp-lit" }),
      L(k.ring(cx, cy, r * 0.62, z + 1.4, P, 24), { tone: "lo" }),
      D([at([cx, cy, z + 1.4])], { size: 0.45, tone: "hi" }),
    ].join("");
    return `<g ${attr} style="display:none">${body}</g>`;
  }
  function plateSeal(i) {
    return seal(X0 + LEN[i] + PAD / 2, 0, topOf(i), 3.2, `data-seal="${i}"`);
  }
  function pins(i) {
    const pts = B.byDepth([...new Set(QUERIES[i])].map((q) => [xAt(i, q), 0]));
    const body = pts.map(([x, y]) => S(k.cylinder(x, y, 1, topOf(i), 1.4, P, 16), { tone: "hi", lit: true, crease: "none" }) + D([at([x, y, topOf(i) + 1.4])], { size: 0.4, tone: "hi" })).join("");
    return `<g data-pins="${i}" style="display:none">${body}</g>`;
  }

  // ---------------------------------------------------------- crosshead and probe
  function probe() {
    const out = [];
    const rodTop = CH_Z + CH_H;
    out.push(S(k.cylinder(X0 + 15, 0, 1.6, PROBE_Z + 5, rodTop - PROBE_Z - 5, P, 18), { tone: "mid", crease: "none" }));
    const needles = [];
    for (let j = 0; j < SHOWN; j++) needles.push([PROBE.x + 3 + j * ((PROBE.w - 6) / (SHOWN - 1)), 0]);
    for (const [x, y] of B.byDepth(needles)) out.push(S(k.cylinder(x, y, 0.5, PROBE_Z - NEEDLE, NEEDLE, P, 12), { tone: "hi", crease: "none", className: "fp-lit" }));
    out.push(S(k.slabOf(PROBE, PROBE_Z, 5, P, 3, 0.5), { tone: "hi", crease: "lo", className: "fp-lit", inner: L(k.sideSeam(PROBE, PROBE_Z + 1.6, P, 3), { tone: "faint" }) }));
    out.push(L(k.planOutline(k.insetPlan(PROBE, 2), PROBE_Z + 5, P, 3), { tone: "faint" }));
    out.push(B.screwDots([[PROBE.x + 2.2, PROBE.y + 2.2], [PROBE.x + PROBE.w - 2.2, PROBE.y + PROBE.d - 2.2]], PROBE_Z + 5, 0.4));
    return `<g data-part="probe">${out.join("")}</g>`;
  }
  function crosshead() {
    const out = [];
    const head = { x: LUG.x - 1, y: -16, w: LUG.w + 2, d: 32, r: 2 };
    const arm = { x: head.x + head.w, y: -6, w: 30, d: 12, r: 1.2 };
    out.push(S(k.slabOf(head, CH_Z, CH_H, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(head, CH_Z + 3, P, 4), { tone: "faint" }) }));
    out.push(S(k.slabOf(arm, CH_Z + 1, CH_H - 2, P, 3, 0.5), { tone: "mid" }));
    out.push(L(k.planOutline(k.insetPlan(arm, 1.8), CH_Z + CH_H - 1, P, 3), { tone: "faint" }));
    // pillar nuts on top
    for (const y of [-PY, PY]) {
      out.push(S(k.cylinder(PX, y, PR + 1.4, CH_Z + CH_H, 2.2, P, 6), { tone: "mid" }));
      out.push(D([at([PX, y, CH_Z + CH_H + 2.2])], { size: 0.5 }));
    }
    // actuator over the probe
    const ax = X0 + 15;
    out.push(S(k.cylinder(ax, 0, 5.2, CH_Z + CH_H - 1, 6, P, 32), { tone: "mid" }));
    out.push(L(k.sideArc(ax, 0, 5.2, CH_Z + CH_H + 2, P, 24), { tone: "faint" }));
    out.push(S(k.cylinder(ax, 0, 3.2, CH_Z + CH_H + 5, 2.6, P, 24), { tone: "mid" }));
    out.push(L(k.knurl(ax, 0, 3.2, CH_Z + CH_H + 5, CH_Z + CH_H + 7.6, 16, P), { tone: "lo" }));
    return out.join("");
  }

  // ---------------------------------------------------------- front rail: trace trees
  function treeRail() {
    const out = [];
    const rail = { x: TREE_X[0] - 12, y: TREE_Y - 6, w: TREE_X[2] - TREE_X[0] + 24, d: 12, r: 1.6 };
    out.push(S(k.slabOf(rail, 0, 2.6, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(rail, 1, P, 3), { tone: "faint" }) }));
    out.push(B.screwDots([[rail.x + 3, TREE_Y], [rail.x + rail.w - 3, TREE_Y]], 2.6, 0.45));
    TREE_X.forEach((x, t) => {
      out.push(S(k.cylinder(x, TREE_Y, 6, 2.6, 2.4, P, 32), { tone: "mid" }));
      out.push(L(k.ring(x, TREE_Y, 5.2, 5, P, 32), { tone: "faint" }));
      out.push(seal(x, TREE_Y, 5, 4.2, `data-tree="${t}"`));
    });
    return out.join("");
  }

  // ---------------------------------------------------------- ratchet and counter
  function ratchet() {
    const { x, y, r, z, h } = WHEEL;
    const out = [];
    out.push(S(k.cylinder(x, y, r - 3, 0, z, P, 32), { tone: "mid" }));
    out.push(`<g data-part="wheel">${S(k.cylinder(x, y, r, z, h, P, 56, 0.4), { tone: "hi", crease: "lo", className: "fp-lit" })}</g>`);
    out.push(L(k.ring(x, y, r - 2.4, z + h, P, 48), { tone: "faint" }));
    const t = k.radialTicks(x, y, r - 0.35, 32, 4, z + h, [2.05, 2.05], P);
    out.push(L(t.minor + t.major, { tone: "lo", className: "fp-teeth" }));
    out.push(S(k.cylinder(x, y, 3.2, z + h, 2.6, P, 24), { tone: "mid" }));
    out.push(D([at([x, y, z + h + 2.6])], { size: 0.5, tone: "hi" }));
    // the pawl: a pivot post and a tongue whose tip rests on the rim
    const px = x + r + 4, py = y - 6;
    out.push(S(k.cylinder(px, py, 2, 0, z + h + 2.2, P, 18), { tone: "mid" }));
    out.push(S(k.slabOf({ x: x + r - 2.2, y: py - 1.2, w: px - (x + r - 2.2), d: 2.4, r: 0.6 }, z + h, 1.2, P, 2, 0.3), { tone: "mid" }));
    out.push(D([at([px, py, z + h + 2.2])], { size: 0.5 }));
    return out.join("");
  }
  function counter() {
    const out = [S(k.slabOf(BOX, 0, BOX_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(BOX, 2.4, P, 4), { tone: "faint" }) })];
    out.push(B.knob(BOX.x + 8.5, BOX.y + BOX.d / 2, 3.6, BOX_H, 3, { angle: -0.8 }));
    out.push(S(k.slabOf(WIN, BOX_H, 0.6, P, 3), { tone: "lo", crease: "none" }));
    out.push(L(k.planOutline(k.insetPlan(WIN, 1), BOX_H + 0.6, P, 3), { tone: "faint" }));
    out.push(`<g data-part="counter">${k.faceTextSvg(k.topMatrix([WIN.x + WIN.w / 2, WIN.y + WIN.d / 2 + 2.3], BOX_H + 0.6, P, "x"), String(LAYERS[0].size), { size: 6.2, tone: "hi", anchor: "middle" })}</g>`);
    out.push(B.screwDots(k.corners(BOX, 2.4), BOX_H, 0.4));
    return out.join("");
  }

  // ---------------------------------------------------------- assemble
  const stack = [];
  stack.push(pillarFoot(-PY), pillarSeg(-PY, 5, lugBottom(0)), pillarFoot(PY), pillarSeg(PY, 5, lugBottom(0)));
  for (let i = 0; i < N; i++) {
    stack.push(lug(i), plate(i));
    if (i < N - 1) stack.push(spacer(i));
    stack.push(holes(i), pins(i), plateSeal(i));
    const z1 = i < N - 1 ? lugBottom(i + 1) : CH_Z;
    stack.push(pillarSeg(-PY, lugTop(i), z1));
    if (i < N - 1) stack.push(pillarSeg(PY, lugTop(i), z1));
  }

  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: `A folding press on a bench. Ten perforated plates ride two guide pillars, each shorter than the one below, one per FRI layer from ${LAYERS[0].size} points down to ${LAYERS[N - 1].size}. A round seal, the layer's Merkle root, is stamped on each plate's end as it is committed; three seals on the front rail are the preprocessed, base and interaction trees. A ratchet grinds the ${FRI.pow_bits}-bit proof-of-work, then a probe drops pins through every plate at the sampled positions.`,
    body: [
      base(),
      bolsters(),
      ...stack,
      probe(),
      pillarSeg(PY, lugTop(N - 1), CH_Z),
      crosshead(),
      treeRail(),
      ratchet(),
      counter(),
    ],
  });

  // ------------------------------------------------------------ live
  const steps = [
    ...TREES.map((tree, t) => ({ kind: "commit", t, dwell: 1.5 })),
    ...LAYERS.map((layer, i) => ({ kind: "fold", i, dwell: 1.3 })),
    { kind: "grind", dwell: 3.2 },
    { kind: "query", dwell: 5.2 },
  ];
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const sup = (n) => String(n).split("").map((d) => SUP[+d]).join("");
  const readouts = steps.map((s) => {
    if (s.kind === "commit") return `commit · ${TREES[s.t].name} · ${TREES[s.t].cols} cols on 2${sup(stark.ldeLog)}`;
    if (s.kind === "fold") {
      const l = LAYERS[s.i];
      return `${s.i === 0 ? "layer 0" : "fold " + s.i} · 2${sup(l.log)} = ${l.size} points${s.i === N - 1 ? " · last" : ""}`;
    }
    if (s.kind === "grind") return `grind · ${FRI.pow_bits}-bit proof-of-work`;
    return `query · ${FRI.queries} positions · ${FRI.pow_bits}-bit grind`;
  });

  const live = `function (root, bus, chapter) {
${LIVE_HELPERS}
const P = ${JSON.stringify(P)};
const STEPS = ${JSON.stringify(steps)};
const READ = ${JSON.stringify(readouts)};
const SIZES = ${JSON.stringify(LAYERS.map((l) => l.size))};
const N = ${N}, BITS = ${FRI.pow_bits}, QN = ${FRI.queries}, LDE = ${2 ** stark.ldeLog};
const WHEEL = ${JSON.stringify(WHEEL)};
const PROBE_DROP = ${PROBE_DROP};
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const plates = [...svg.querySelectorAll("[data-plate] .iso-solid")];
const seals = [...svg.querySelectorAll("[data-seal]")];
const trees = [...svg.querySelectorAll("[data-tree]")];
const pins = [...svg.querySelectorAll("[data-pins]")];
const probe = svg.querySelector('[data-part="probe"]');
const probeLit = [...probe.querySelectorAll(".fp-lit")];
const wheel = svg.querySelector('[data-part="wheel"] .iso-solid');
const teeth = svg.querySelector(".fp-teeth");
const counter = svg.querySelector('[data-part="counter"] text');
const readout = root.querySelector("[data-readout]");
const ease = (u) => u * u * (3 - 2 * u);
const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
const lit = (el, on) => { if (!el) return; if (on) { if (!el.hasAttribute("data-lit")) el.setAttribute("data-lit", ""); } else if (el.hasAttribute("data-lit")) el.removeAttribute("data-lit"); };
const show = (el, on) => { const v = on ? "" : "none"; if (el.style.display !== v) el.style.display = v; };
const IDX = { grind: STEPS.findIndex((s) => s.kind === "grind"), query: STEPS.findIndex((s) => s.kind === "query") };
let step = 0, t = 0, touring = true, idle = 0, angle = 0;
// A seal or pin drops onto its face: hidden before, eased down from above.
function drop(el, u, height) {
  show(el, u > 0);
  if (u <= 0) return;
  const e = ease(u);
  el.setAttribute("transform", e >= 1 ? "" : translateAlong(P, [0, 0, height * (1 - e)]));
  el.style.opacity = e >= 1 ? "" : String(clamp(u * 3, 0, 1));
}
function apply(s, u) {
  const cur = STEPS[s];
  trees.forEach((el, j) => {
    const here = cur.kind === "commit" && cur.t === j;
    drop(el, s > j || (here && u >= 1) ? 1 : here ? seg(u, 0, 0.45) : 0, 9);
    lit(el.querySelector(".fp-lit"), here);
  });
  seals.forEach((el, i) => {
    const at = 3 + i;
    drop(el, s > at ? 1 : s === at ? seg(u, 0.25, 0.7) : 0, 9);
  });
  plates.forEach((el, i) => lit(el, cur.kind === "fold" && cur.i === i));
  lit(wheel, cur.kind === "grind");
  const q = cur.kind === "query";
  probeLit.forEach((el) => lit(el, q));
  const pd = q ? ease(seg(u, 0, 0.16)) : 0;
  probe.setAttribute("transform", pd > 0 ? translateAlong(P, [0, 0, -PROBE_DROP * pd]) : "");
  pins.forEach((el, i) => {
    const start = 0.18 + (N - 1 - i) * 0.06;
    drop(el, q ? seg(u, start, start + 0.14) : 0, 7);
  });
  let count;
  if (cur.kind === "commit") count = LDE;
  else if (cur.kind === "fold") count = SIZES[cur.i];
  else if (cur.kind === "grind") count = Math.round(BITS * ease(u));
  else count = Math.round(QN * seg(u, 0.18, 0.18 + (N + 1) * 0.06));
  const text = String(count);
  if (counter && counter.textContent !== text) counter.textContent = text;
  if (readout.textContent !== READ[s]) readout.textContent = READ[s];
}
function spin(dt, calm) {
  if (STEPS[step].kind === "grind" && !calm) angle += dt * 2.4;
  const tk = radialTicks(WHEEL.x, WHEEL.y, WHEEL.r - 0.35, 32, 4, WHEEL.z + WHEEL.h, [2.05, 2.05], P, angle);
  teeth.setAttribute("d", tk.minor + tk.major);
}
let lastFocus = "";
function tell(s, u) {
  apply(s, u);
  const cur = STEPS[s];
  const key = cur.kind + (cur.i ?? cur.t ?? "");
  if (key !== lastFocus) { lastFocus = key; bus.emit("focus", { chapter, refs: ["fact:" + cur.kind] }); }
}
const run = loop(root, (dt, calm) => {
  if (!touring) { idle += dt; if (idle > 6 && !calm) touring = true; else return false; }
  t += dt / STEPS[step].dwell;
  if (t >= 1) { t = 0; step = (step + 1) % STEPS.length; }
  spin(dt, calm);
  tell(step, calm ? 1 : clamp(t / 0.85, 0, 1));
  return true;
});
function jump(i) {
  touring = false; idle = 0; step = (i + STEPS.length) % STEPS.length; t = 0;
  tell(step, 1);
  run();
}
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") jump(step + 1);
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") jump(step - 1);
  else if (e.key === "Home") jump(0);
  else if (e.key === "End") jump(STEPS.length - 1);
  else return;
  e.preventDefault();
});
stage.addEventListener("click", () => { if (touring) { touring = false; idle = 0; } else { touring = true; run(); } });
if (stillQuery.matches) { touring = false; step = IDX.query; }
tell(step, stillQuery.matches ? 1 : 0);
run();
}`;

  return {
    id: "fig-press",
    fig: "Fig 6",
    title: "Folding press",
    hint: "← → step phases · click to pause",
    readout: readouts[0],
    stage: { role: "group", "aria-label": "Folding press: arrow keys step through commitment, the ten FRI layers, grinding and the queries" },
    keys: [
      { mark: "lit", label: "Active layer while folding; the probe and its pins while querying" },
      { mark: "raised", label: "Round seal: a committed Merkle root" },
    ],
    caption: `Each column is committed on 2${sup(stark.ldeLog)} = ${2 ** stark.ldeLog} points, ${FRI.blowup_factor}× the ${stark.paddedRows} padded trace rows, in three trees (preprocessed, base, interaction). FRI then commits ${N} layers from ${LAYERS[0].size} down to ${LAYERS[N - 1].size} points, halving each round (fold step ${FRI.fold_step}, last-layer degree bound ${FRI.last_layer_degree_bound}), grinds ${FRI.pow_bits} bits of proof-of-work and opens ${FRI.queries} positions; 7 are drawn, and a query at i on a layer of n points lands at i mod n/2 on the next. Plate lengths and hole counts are tapered to fit; Stwo's first fold maps a circle domain to a line, so read this as the folding schedule, not the ${stark.proofBytes.toLocaleString("en-US")}-byte proof format.`,
    svg,
    live,
  };
}
