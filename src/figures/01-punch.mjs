// Fig 1 · Source to relation: a card punch.
// Each source line feeds blank cards through a punch; every punched card is one
// node of the normalized relation. pow<5> punches three cards; the signature
// and the return line punch none (they bind the public ABI instead).
import { k, bench, LIVE_HELPERS } from "./parts.mjs";
import MODEL from "../model/s31.mjs";

const WIDTH = 600;
const HEIGHT = 380;

const PLATE = { x: -152, y: -58, w: 300, d: 112, r: 8 };
const BED = { x: -92, y: -16, w: 166, d: 32, r: 1.5 };
const BED_Z = 12, BED_TOP = 14;
const CARD = { x: -19, y: -13, w: 38, d: 26, r: 1.2 };
const CARD_T = 1;
const CARD_Z = BED_TOP + 0.1;
const HOPPER_X = -116;
const HOPPER = { x: HOPPER_X - 23, y: -17, w: 46, d: 34, r: 2 };
const HOPPER_WALL = 2;
const SLOT_X = HOPPER.x + HOPPER.w; // the card leaves through a slot in this wall
const STATION_X = -12;
const POST_Y = 31, POST_R = 4, POST_TOP = 70;
const HEAD = { x: STATION_X - 7, y: -11, w: 14, d: 22, r: 1.6 };
const HEAD_H = 9, HEAD_REST = 34, HEAD_LOW = 20.2;
const PIN_LEN = 5;
const STACK_X = 104;
const TRAY = { x: STACK_X - 24, y: -18, w: 48, d: 36, r: 2 };
const TRAY_Z = 4;
const DECK_STEP = 1.2;
const BLANKS = 10;
const STACK_STEP = 1.2;

// Hole grid on a card: 3 rows (y) × 8 columns (x).
const COLS = 8, ROWS = 3;
const holeAt = (c, r) => [CARD.x + 4 + c * ((CARD.w - 8) / (COLS - 1)), CARD.y + 5 + r * ((CARD.d - 10) / (ROWS - 1))];

const ids = { x: 0 };
MODEL.poly.nodes.forEach((node, i) => (ids[node.name] = i + 1));
const OPS = ["mul", "mul_const", "add", "add_const"];
// Row 0: one-hot op (4 cols) + node id (4 bits). Row 1: lhs id. Row 2: rhs id or constant flag.
function pattern(node) {
  const bits = (v, n) => Array.from({ length: n }, (_, i) => (v >> (n - 1 - i)) & 1);
  const row0 = [...OPS.map((op) => (op === node.op ? 1 : 0)), ...bits(ids[node.name], 4)];
  const row1 = bits(ids[node.lhs], 8);
  const row2 = node.rhs ? bits(ids[node.rhs], 8) : [1, 0, 0, 0, 0, 0, 0, 1];
  return [row0, row1, row2];
}

export default function figure() {
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -17, 0), [STATION_X, -POST_Y, 90], [STATION_X, POST_Y, 90], [-100, -50, 84], [-30, -50, 84]],
    WIDTH,
    HEIGHT,
    { pad: 22, azimuth: 36 },
  );
  const B = bench(P);
  const { S, L, D, at } = B;

  const nodes = MODEL.poly.nodes;
  const lines = MODEL.poly.lines;
  const patterns = nodes.map(pattern);

  const cardSolid = (z, { lit = false, tone = "hi" } = {}) =>
    S(k.slabOf(CARD, z, CARD_T, P, 3, 0.4), { tone, lit, crease: "lo" });
  const printed = (z) => {
    // Faint printed column guides: a rule along each hole row.
    return L(
      Array.from({ length: ROWS }, (_, r) => {
        const [, y] = holeAt(0, r);
        return k.lineOnTop([CARD.x + 1.6, y], [CARD.x + CARD.w - 1.6, y], z, P);
      }).join(""),
      { tone: "faint", free: true },
    );
  };
  const holesSvg = (pat, z) => {
    const pts = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (pat[r][c]) pts.push(at([...holeAt(c, r), z]));
    return D(pts, { size: 0.75, tone: "hi" });
  };

  // ------------------------------------------------------------ base
  function base() {
    const out = [B.plate(PLATE)];
    const strip = { x: PLATE.x + 24, y: PLATE.y + PLATE.d - 14, w: 196, d: 7, r: 1 };
    out.push(B.ruler(strip));
    out.push(B.labelPlate({ x: PLATE.x + PLATE.w - 64, y: PLATE.y + PLATE.d - 26, w: 40, d: 14, r: 1.2 }));
    return out.join("");
  }

  // The card bed: two pedestals, a bed plate and two rails.
  function bedBack() {
    const out = [];
    for (const x of [BED.x + 8, BED.x + BED.w - 34]) {
      const ped = { x, y: -12, w: 14, d: 24, r: 1.2 };
      out.push(S(k.slabOf(ped, 0, BED_Z, P, 3, 0.4), { tone: "mid" }));
      out.push(L(k.sideSeam(ped, 3, P, 3), { tone: "faint" }));
    }
    out.push(chadDrawer());
    out.push(S(k.slabOf(BED, BED_Z, BED_TOP - BED_Z, P, 4, 0.5), { tone: "mid" }));
    out.push(L(k.lineOnTop([BED.x, 0], [BED.x + BED.w, 0], BED_TOP, P), { tone: "faint" }));
    out.push(rail(-15));
    return out.join("");
  }
  // The chad drawer under the punch catches the punched-out bits.
  function chadDrawer() {
    const box = { x: STATION_X - 14, y: -13, w: 28, d: 26, r: 1.2 };
    const out = [S(k.slabOf(box, 1, BED_Z - 1.6, P, 3, 0.5), { tone: "mid" })];
    out.push(L(k.planOutline(k.insetPlan(box, 2.2), BED_Z - 0.6, P, 3), { tone: "faint" }));
    // the pull on the near face
    const pullY = box.y + box.d;
    out.push(S(k.slabOf({ x: STATION_X - 6, y: pullY, w: 12, d: 2.2, r: 0.8 }, 5, 2, P, 2, 0.3), { tone: "mid" }));
    out.push(B.screwDots([[STATION_X - 4.6, pullY + 1.1], [STATION_X + 4.6, pullY + 1.1]], 7, 0.35));
    return out.join("");
  }

  // The copy holder: one rule per real source line, lengths from the text.
  const SRC = MODEL.poly.source.trimEnd().split("\n");
  const BOARD = { x: -100, y: -50, w: 70, d: 3, r: 0.8 };
  const BOARD_Z0 = 26, BOARD_Z1 = 82;
  const ruleZ = (i) => BOARD_Z1 - 7 - i * ((BOARD_Z1 - BOARD_Z0 - 12) / (SRC.length - 1));
  function copyHolder() {
    const out = [];
    for (const x of [BOARD.x + 8, BOARD.x + BOARD.w - 8]) {
      out.push(S(k.cylinder(x, BOARD.y + 1.5, 4.4, 0, 2, P, 24), { tone: "mid" }));
      out.push(S(k.cylinder(x, BOARD.y + 1.5, 1.6, 2, BOARD_Z0 - 2, P, 16), { tone: "mid", crease: "none" }));
    }
    out.push(S(k.slabOf(BOARD, BOARD_Z0, BOARD_Z1 - BOARD_Z0, P, 2, 0.5), { tone: "mid" }));
    const face = BOARD.y + BOARD.d;
    const longest = Math.max(...SRC.map((line) => line.length));
    const rules = SRC.map((line, i) => {
      if (!line.trim()) return "";
      const indent = line.length - line.trimStart().length;
      const x0 = BOARD.x + 6 + (indent / longest) * (BOARD.w - 12);
      const x1 = BOARD.x + 6 + (line.length / longest) * (BOARD.w - 12);
      return k.segment([x0, face, ruleZ(i)], [x1, face, ruleZ(i)], P);
    }).join("");
    out.push(L(rules, { tone: "mid", free: true }));
    // two clips that hold the sheet
    for (const x of [BOARD.x + 14, BOARD.x + BOARD.w - 14]) out.push(S(k.slabOf({ x: x - 3, y: face, w: 6, d: 1.2, r: 0.4 }, BOARD_Z1 - 4, 5, P, 2), { tone: "mid" }));
    return out.join("");
  }
  // The line guide: a lit bar in front of the board that steps to the current line.
  function lineGuide() {
    const bar = { x: BOARD.x - 3, y: BOARD.y + BOARD.d, w: BOARD.w + 6, d: 1.6, r: 0.5 };
    const z = ruleZ(0) - 1.6;
    return `<g data-part="guide">${S(k.slabOf(bar, z, 1.2, P, 2, 0.3), { tone: "hi", lit: true })}</g>`;
  }

  function rail(y) {
    const plan = { x: BED.x, y: y < 0 ? y : y - 2.4, w: BED.w, d: 2.4, r: 0.6 };
    const out = [S(k.slabOf(plan, BED_TOP, 2.4, P, 2, 0.3), { tone: "mid" })];
    out.push(B.screwDots([[BED.x + 6, plan.y + 1.2], [BED.x + BED.w - 6, plan.y + 1.2], [STATION_X + 22, plan.y + 1.2]], BED_TOP + 2.4, 0.4));
    return out.join("");
  }

  // ---------------------------------------------------------- hopper
  const hopperFloor = BED_TOP;
  function hopperBack() {
    const out = [];
    const ped = { x: HOPPER.x + 3, y: HOPPER.y + 3, w: HOPPER.w - 6, d: HOPPER.d - 6, r: 1.5 };
    out.push(S(k.slabOf(ped, 0, hopperFloor - 1.5, P, 3, 0.5), { tone: "mid" }));
    out.push(S(k.slabOf(HOPPER, hopperFloor - 1.5, 1.5, P, 3, 0.5), { tone: "mid" }));
    // far wall (−y) and back wall (−x)
    out.push(S(k.slabOf({ x: HOPPER.x, y: HOPPER.y, w: HOPPER.w, d: HOPPER_WALL, r: 0.5 }, hopperFloor, 30, P, 2, 0.4), { tone: "mid" }));
    out.push(S(k.slabOf({ x: HOPPER.x, y: HOPPER.y, w: HOPPER_WALL, d: HOPPER.d, r: 0.5 }, hopperFloor, 30, P, 2, 0.4), { tone: "mid" }));
    return out.join("");
  }
  function hopperStack() {
    const out = [];
    for (let i = 0; i < BLANKS; i++) {
      const z = hopperFloor + i * STACK_STEP;
      out.push(`<g data-part="blank" data-index="${i}" transform="${k.translateAlong(P, [HOPPER_X, 0, 0])}">${cardSolid(z, { tone: "hi" })}</g>`);
    }
    // the follower weight rides on top of the stack
    const w = { x: HOPPER_X - 13, y: -9, w: 26, d: 18, r: 1.6 };
    const wz = hopperFloor + BLANKS * STACK_STEP;
    const weight = [
      S(k.slabOf(w, wz, 5, P, 3, 0.6), { tone: "mid" }),
      L(k.planOutline(k.insetPlan(w, 2.4), wz + 5, P, 3), { tone: "faint" }),
      S(k.cylinder(HOPPER_X, 0, 2.2, wz + 5, 7, P, 20), { tone: "mid" }),
      S(k.cylinder(HOPPER_X, 0, 3.6, wz + 12, 3, P, 28), { tone: "mid" }),
      L(k.knurl(HOPPER_X, 0, 3.6, wz + 12, wz + 15, 20, P), { tone: "lo" }),
    ].join("");
    out.push(`<g data-part="weight">${weight}</g>`);
    return out.join("");
  }
  function hopperFront() {
    const out = [];
    // near lip (+y), low so the stack shows
    out.push(S(k.slabOf({ x: HOPPER.x, y: HOPPER.y + HOPPER.d - HOPPER_WALL, w: HOPPER.w, d: HOPPER_WALL, r: 0.5 }, hopperFloor, 4, P, 2, 0.4), { tone: "mid" }));
    // slot wall (+x): open below z = floor + 3 so one card can leave
    const slotWall = { x: SLOT_X - HOPPER_WALL, y: HOPPER.y, w: HOPPER_WALL, d: HOPPER.d, r: 0.5 };
    out.push(S(k.slabOf(slotWall, hopperFloor + 2.6, 27.4, P, 2, 0.4), { tone: "mid" }));
    out.push(B.screwDots([[SLOT_X - 1, HOPPER.y + 4], [SLOT_X - 1, HOPPER.y + HOPPER.d - 4]], hopperFloor + 30, 0.4));
    // two corner posts tie the walls
    for (const y of [HOPPER.y + 1, HOPPER.y + HOPPER.d - 1]) out.push(S(k.cylinder(SLOT_X - 1, y, 1.3, hopperFloor + 30, 3, P, 14), { tone: "mid" }));
    return out.join("");
  }

  // --------------------------------------------------------- station
  function post(y) {
    const out = [];
    out.push(S(k.cylinder(STATION_X, y, POST_R + 2.4, 0, 3, P, 28), { tone: "mid" }));
    out.push(S(k.cylinder(STATION_X, y, POST_R, 3, POST_TOP - 3, P, 28), { tone: "mid", crease: "none" }));
    out.push(L([18, 36, 50].map((z) => k.sideArc(STATION_X, y, POST_R, z, P, 18)).join(""), { tone: "faint" }));
    return out.join("");
  }
  function bridge() {
    const plan = { x: STATION_X - 8, y: -POST_Y - 6, w: 16, d: POST_Y * 2 + 12, r: 2 };
    const out = [S(k.slabOf(plan, POST_TOP, 8, P, 4, 0.6), { tone: "mid" })];
    out.push(L(k.planOutline(k.insetPlan(plan, 2.2), POST_TOP + 8, P, 4), { tone: "faint" }));
    out.push(B.screwDots([[STATION_X, -POST_Y], [STATION_X, POST_Y]], POST_TOP + 8, 0.55));
    out.push(L([k.ring(STATION_X, -POST_Y, 2, POST_TOP + 8, P, 16), k.ring(STATION_X, POST_Y, 2, POST_TOP + 8, P, 16)].join(""), { tone: "lo" }));
    // the actuator on top that drives the head
    out.push(S(k.cylinder(STATION_X, 0, 6, POST_TOP + 8, 7, P, 32), { tone: "mid" }));
    out.push(L(k.sideArc(STATION_X, 0, 6, POST_TOP + 11, P, 24), { tone: "faint" }));
    out.push(S(k.cylinder(STATION_X, 0, 3.4, POST_TOP + 15, 3, P, 24), { tone: "mid" }));
    return out.join("");
  }
  function rod() {
    return S(k.cylinder(STATION_X, 0, 1.8, HEAD_REST + HEAD_H - 2, POST_TOP - (HEAD_REST + HEAD_H - 2), P, 18), { tone: "mid", crease: "none" });
  }
  function head() {
    const out = [];
    // punch pins under the head, eight in two rows
    const pins = [];
    for (const y of [-5, 5]) for (const x of [-4.5, -1.5, 1.5, 4.5]) pins.push([STATION_X + x, y]);
    for (const [x, y] of B.byDepth(pins)) out.push(S(k.cylinder(x, y, 0.8, HEAD_REST - PIN_LEN, PIN_LEN, P, 12), { tone: "hi", crease: "none" }));
    out.push(S(k.slabOf(HEAD, HEAD_REST, HEAD_H, P, 3, 0.6), { tone: "mid" }));
    out.push(L(k.sideSeam(HEAD, HEAD_REST + 3, P, 3), { tone: "faint" }));
    out.push(L(k.planOutline(k.insetPlan(HEAD, 2), HEAD_REST + HEAD_H, P, 3), { tone: "faint" }));
    out.push(B.screwDots([[HEAD.x + 2.4, HEAD.y + 2.4], [HEAD.x + HEAD.w - 2.4, HEAD.y + HEAD.d - 2.4]], HEAD_REST + HEAD_H, 0.4));
    return out.join("");
  }

  // ---------------------------------------------------------- stacker
  function trayBack() {
    const out = [];
    const ped = k.insetPlan(TRAY, 4);
    out.push(S(k.slabOf(ped, 0, TRAY_Z, P, 3, 0.4), { tone: "mid" }));
    out.push(S(k.slabOf(TRAY, TRAY_Z, 0.8, P, 3, 0.4), { tone: "mid" }));
    out.push(S(k.slabOf({ x: TRAY.x, y: TRAY.y, w: TRAY.w, d: 2, r: 0.5 }, TRAY_Z + 0.8, 14, P, 2, 0.4), { tone: "mid" }));
    // a guide fence at the entry side so cards drop square
    out.push(S(k.slabOf({ x: TRAY.x, y: TRAY.y, w: 2, d: 7, r: 0.5 }, TRAY_Z + 0.8, 14, P, 2, 0.3), { tone: "mid" }));
    return out.join("");
  }
  function deck() {
    return patterns
      .map((pat, i) => {
        const z = TRAY_Z + 0.8 + i * DECK_STEP;
        return `<g data-part="deck" data-index="${i}" style="display:none" transform="${k.translateAlong(P, [STACK_X, 0, 0])}">${cardSolid(z)}${printed(z + CARD_T)}${holesSvg(pat, z + CARD_T)}</g>`;
      })
      .join("");
  }
  function trayFront() {
    const out = [];
    const z = TRAY_Z + 0.8;
    out.push(S(k.slabOf({ x: TRAY.x, y: TRAY.y + TRAY.d - 2, w: TRAY.w, d: 2, r: 0.5 }, z, 4, P, 2, 0.4), { tone: "mid" }));
    out.push(S(k.slabOf({ x: TRAY.x + TRAY.w - 2, y: TRAY.y, w: 2, d: TRAY.d, r: 0.5 }, z, 4, P, 2, 0.4), { tone: "mid" }));
    out.push(B.screwDots([[TRAY.x + TRAY.w - 1, TRAY.y + 4], [TRAY.x + TRAY.w - 1, TRAY.y + TRAY.d - 4]], z + 4, 0.4));
    return out.join("");
  }

  // ---------------------------------------------------------- console
  const CON = { x: 26, y: 24, w: 58, d: 20, r: 2.4 };
  const CON_H = 8;
  function consoleBox() {
    const out = [S(k.slabOf(CON, 0, CON_H, P, 4, 0.8), { tone: "mid" })];
    out.push(L(k.sideSeam(CON, 2.4, P, 4), { tone: "faint" }));
    out.push(B.knob(CON.x + 11, CON.y + 10, 4.2, CON_H, 3.4, { angle: -0.6 }));
    out.push(B.lamp(CON.x + 25, CON.y + 10, CON_H, { r: 2.4, part: "lamp" }));
    // counter window: two digits the machine displays
    const win = { x: CON.x + 34, y: CON.y + 5, w: 18, d: 10, r: 1 };
    out.push(S(k.slabOf(win, CON_H, 0.6, P, 3), { tone: "lo", crease: "none" }));
    out.push(L(k.planOutline(k.insetPlan(win, 1), CON_H + 0.6, P, 3), { tone: "faint" }));
    out.push(`<g data-part="counter">${k.faceTextSvg(k.topMatrix([win.x + win.w / 2, win.y + win.d / 2 + 2.4], CON_H + 0.6, P, "x"), "0/6", { size: 6.2, tone: "hi", anchor: "middle" })}</g>`);
    out.push(B.screwDots(k.corners(CON, 2.4), CON_H, 0.4));
    return out.join("");
  }

  // ------------------------------------------------------- moving card
  // Clip: only the part of the moving card past the hopper's slot wall shows.
  const hull = (pts) => {
    const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
    for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
  };
  const clipPts = hull(k.boxCorners({ x: SLOT_X, y: -80, w: 400, d: 160, r: 0 }, -30, 120).map((p) => at(p)));
  const clip = `<clipPath id="punch-slot"><path d="M${clipPts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}Z"/></clipPath>`;

  // Slot positions of every hole on the moving card, at its rest place (x = 0).
  const slotPts = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) slotPts.push(at([...holeAt(c, r), CARD_Z + CARD_T]));
  const moving = `<g clip-path="url(#punch-slot)"><g data-part="card" transform="${k.translateAlong(P, [HOPPER_X, 0, 0])}">${cardSolid(CARD_Z, { lit: true })}${printed(CARD_Z + CARD_T)}<g class="iso-dots" data-tone="hi">${slotPts
    .map(([x, y], i) => `<circle data-hole="${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.75" opacity="0"/>`)
    .join("")}</g></g></g>`;

  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A card punch on a bench. Blank cards leave a hopper on the left, slide along a railed bed under a punch head held between two posts, and drop into a stacker on the right. Each punched card is one node of the program's normalized relation; a console counts the deck.",
    body: [
      `<defs>${clip}</defs>`,
      base(),
      copyHolder(),
      lineGuide(),
      bedBack(),
      hopperBack(),
      hopperStack(),
      hopperFront(),
      post(-POST_Y),
      trayBack(),
      deck(),
      moving,
      rail(15),
      rod(),
      `<g data-part="head">${head()}</g>`,
      bridge(),
      post(POST_Y),
      trayFront(),
      consoleBox(),
    ],
  });

  // ------------------------------------------------------------ live
  const plan = [];
  lines.forEach((line, li) => {
    if (!line.nodes.length) plan.push({ line: li, node: -1, dwell: 1.8 });
    else line.nodes.forEach((name) => plan.push({ line: li, node: nodes.findIndex((n) => n.name === name), dwell: 2.6 }));
  });

  const live = `function (root, bus, chapter) {
${LIVE_HELPERS}
const P = ${JSON.stringify(P)};
const PLAN = ${JSON.stringify(plan)};
const LINES = ${JSON.stringify(lines.map((l) => ({ line: l.line, note: l.note, nodes: l.nodes })))};
const NODES = ${JSON.stringify(nodes.map((n) => ({ name: n.name, op: n.op })))};
const PATTERNS = ${JSON.stringify(patterns.map((p) => p.flat()))};
const X = { hopper: ${HOPPER_X}, station: ${STATION_X}, stack: ${STACK_X} };
const Z = { card: ${CARD_Z}, deck: ${TRAY_Z + 0.8}, step: ${DECK_STEP}, rest: ${HEAD_REST}, low: ${HEAD_LOW} };
const GUIDE = ${JSON.stringify(Object.fromEntries(lines.map((l) => [l.line, +(ruleZ(l.line - 1) - ruleZ(0)).toFixed(2)])))};
let guideZ = 0, guideWant = 0;
const BLANKS = ${BLANKS}, STACK_STEP = ${STACK_STEP};
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const card = svg.querySelector('[data-part="card"]');
const holes = [...svg.querySelectorAll("[data-hole]")];
const head = svg.querySelector('[data-part="head"]');
const guide = svg.querySelector('[data-part="guide"]');
const deck = [...svg.querySelectorAll('[data-part="deck"]')];
const blanks = [...svg.querySelectorAll('[data-part="blank"]')];
const weight = svg.querySelector('[data-part="weight"]');
const lamp = svg.querySelector('[data-part="lamp"] .iso-solid');
const counter = svg.querySelector('[data-part="counter"] text');
const readout = root.querySelector("[data-readout]");
let step = 0, t = 0, touring = true, idle = 0, idleTimer = 0;
const resumeLater = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (!stillQuery.matches) { touring = true; run(); } }, 6000); };
let shown = { cardX: X.hopper, cardZ: Z.card, headZ: 0 };
const ease = (u) => u * u * (3 - 2 * u);
const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
function doneBefore(i) { return PLAN.slice(0, i).filter((p) => p.node >= 0).length; }
function apply(i, u) {
  const p = PLAN[i];
  const done = doneBefore(i) + (p.node >= 0 && u >= 0.9 ? 1 : 0);
  deck.forEach((el, j) => (el.style.display = j < done ? "" : "none"));
  const used = doneBefore(i) + (p.node >= 0 && u > 0.02 ? 1 : 0);
  blanks.forEach((el, j) => (el.style.display = j < BLANKS - used ? "" : "none"));
  weight.setAttribute("transform", translateAlong(P, [0, 0, -used * STACK_STEP]));
  let x = X.hopper, z = Z.card, hz = 0, punched = false, lit = false;
  if (p.node >= 0) {
    const a = ease(seg(u, 0.04, 0.36)), b = seg(u, 0.36, 0.58), c = ease(seg(u, 0.58, 0.84)), d = ease(seg(u, 0.84, 0.92));
    x = X.hopper + (X.station - X.hopper) * a + (X.stack - X.station) * c;
    const press = Math.sin(Math.PI * b);
    hz = -(Z.rest - Z.low) * press;
    punched = b > 0.5;
    lit = b > 0 && b < 1;
    const deckTop = Z.deck + doneBefore(i) * Z.step;
    z = Z.card + (deckTop - Z.card) * d;
  }
  card.style.display = p.node >= 0 && u > 0.02 && u < 0.92 ? "" : "none";
  card.setAttribute("transform", translateAlong(P, [x, 0, z - Z.card]));
  head.setAttribute("transform", translateAlong(P, [0, 0, hz]));
  const pat = p.node >= 0 ? PATTERNS[p.node] : [];
  holes.forEach((h, j) => h.setAttribute("opacity", punched && pat[j] ? "1" : "0"));
  if (lamp) lit ? lamp.setAttribute("data-lit", "") : lamp.removeAttribute("data-lit");
  const total = NODES.length;
  if (counter) counter.textContent = done + "/" + total;
  const line = LINES[p.line];
  guideWant = GUIDE[line.line] ?? 0;
  const text = p.node >= 0
    ? "line " + line.line + " · " + NODES[p.node].op + " → " + NODES[p.node].name + " · deck " + done + "/" + total
    : "line " + line.line + " · no node · " + (line.nodes.length ? "" : line.note.split(",")[0]);
  if (readout.textContent !== text) readout.textContent = text;
  return { line: line.line, node: p.node >= 0 ? NODES[p.node].name : null };
}
let lastKey = "";
function tell(i, u) {
  const s = apply(i, u);
  const key = s.line + ":" + s.node;
  if (key !== lastKey) {
    lastKey = key;
    bus.emit("focus", { chapter, refs: ["line:" + s.line, ...(s.node ? ["node:" + s.node] : [])] });
  }
}
const run = loop(root, (dt, calm) => {
  if (!touring) return false;
  const p = PLAN[step];
  t += dt / p.dwell;
  if (t >= 1) {
    t = 0;
    step = (step + 1) % PLAN.length;
  }
  tell(step, calm ? 0.95 : t);
  guideZ = follow(guideZ, guideWant, dt, 0.25, calm);
  guide.setAttribute("transform", translateAlong(P, [0, 0, guideZ]));
  return true;
});
function jump(i) {
  touring = false; idle = 0; step = (i + PLAN.length) % PLAN.length; t = 0.95; resumeLater();
  tell(step, 0.95);
  guideZ = guideWant;
  guide.setAttribute("transform", translateAlong(P, [0, 0, guideZ]));
}
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") jump(step + 1);
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") jump(step - 1);
  else if (e.key === "Home") jump(0);
  else if (e.key === "End") jump(PLAN.length - 1);
  else return;
  e.preventDefault();
});
stage.addEventListener("click", () => { if (touring) { touring = false; resumeLater(); } else { clearTimeout(idleTimer); touring = true; run(); } });
bus.on("pick", ({ chapter: c, ref }) => {
  if (c !== chapter) return;
  const [kind, value] = ref.split(":");
  const i = PLAN.findIndex((p) => (kind === "line" ? LINES[p.line].line === Number(value) : p.node >= 0 && NODES[p.node].name === value));
  if (i >= 0) jump(i);
});
if (stillQuery.matches) { touring = false; }
tell(0, 0.95);
run();
}`;

  return {
    id: "fig-punch",
    fig: "Fig 1",
    title: "Card punch",
    hint: "← → step lines · click to pause",
    readout: `line ${lines[1].line} · mul → _s31_0 · deck 1/${nodes.length}`,
    stage: { role: "group", "aria-label": "Card punch: arrow keys step through source lines and the cards they punch" },
    keys: [
      { mark: "lit", label: "The card being punched: one relation node" },
      { mark: "raised", label: "Deck in the stacker: the normalized relation, in order" },
    ],
    caption: `${MODEL.poly.name}.s31 has ${lines.length} meaningful lines and lowers to ${nodes.length} relation nodes. Holes encode each node's operation and operand IDs. std::math::pow<5> punches three cards (x², x⁴, x⁴·x); the signature and the return punch none, because they bind the public interface rather than add arithmetic.`,
    svg,
    live,
  };
}
