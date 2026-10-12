// Fig 7 · Native verification: a pin-tumbler lock in a bench test fixture.
// The lock is the native verifier built for one program. Its upper pins are
// set by the verification key, so only a key cut from the real circuit hash
// lifts them to the shear line. Its lower pins carry the public statement the
// verifier is asked about (x[0..3], result[0..3]); the key's lower edge
// carries the statement its proof binds. Only when both agree does every pin
// sit at a shear line, the plug turn and the bolt withdraw. Tamper replays the
// real trial: result[0] + 1 with the same proof adds a wafer to one lower pin,
// which then straddles the shear line and stops the plug.
import { k, bench, LIVE_HELPERS } from "./parts.mjs";
import * as G from "../../vendor/anatomy/kit/lathe.mjs";
import MODEL from "../model/s31.mjs";

const WIDTH = 600;
const HEIGHT = 380;

const PLATE = { x: -114, y: -50, w: 278, d: 100, r: 8 };

// Lock housing and plug (plug axis along x).
const HOUSE = { x: -30, y: -14, w: 80, d: 28, r: 2 };
const HZ0 = 8, HZ1 = 78;
const FRONT_X = HOUSE.x + HOUSE.w; // +x face: keyway end
const PLUG_Z = 40, PLUG_R = 12;
const SHEAR_U = PLUG_Z + PLUG_R; // 51
const SHEAR_L = PLUG_Z - PLUG_R; // 29

// Cutaway window on the +y face, milled back to just behind the key.
const WIN = { x0: -18, x1: 38, z0: 13, z1: 75 };
const FACE_Y = HOUSE.y + HOUSE.d; // 12
const BACK_Y = -1.4;
const KEYWAY = { z0: 30, z1: 50 };

// Pins.
const PIN_R = 1.8;
const BORE_R = 1.95;
const DRIVER = 7;
const CAP_U = 67; // top of the upper bores
const FLOOR_L = 14; // bottom of the lower bores
const UP_X = Array.from({ length: 6 }, (_, i) => -13 + 8.4 * i);
const LO_X = Array.from({ length: 8 }, (_, j) => -15 + 6.2 * j);

// The key blade, at full insertion (offset 0).
const TIP = -25, SHOULDER = FRONT_X + 1;
const TOP0 = 49, BOT0 = 31;
const TIP_TOP = 42, TIP_BOT = 40, TIP_SLOPE = 1.4;
const FLANK = 1.5, FLAT = 0.9;
const REST_U = 43, REST_L = 39; // where pins hang with no key
const KEY_T = 0.8; // half thickness
const BOW = { x0: SHOULDER, x1: SHOULDER + 16, z0: 29, z1: 53, r: 4, hole: [SHOULDER + 10.5, 41], holeR: 2.4 };
const KEY_OUT = 78; // withdrawn offset along +x

// Bolt, case and keeper on the -x end.
const CASE = { x: -62, y: -9, w: 32, d: 18, r: 1.5 };
const CASE_Z0 = 30, CASE_Z1 = 50;
const BOLT = { x: -90, y: -5, w: 44, d: 10, r: 1 };
const BOLT_Z0 = 35, BOLT_Z1 = 45;
const BOLT_TRAVEL = 16;
const FLAG_X = -57;

// Key carriage on a rail, +x side.
const RAIL = { x: 52, y: -3, w: 104, d: 6, r: 1 };
const RAIL_Z0 = 18, RAIL_Z1 = 21;
const CARRIAGE = { x: 56, y: -6, w: 14, d: 12, r: 1.2 };
const CAR_Z1 = BOW.z0;

// Console with display and verdict lamps.
const CON = { x: 72, y: 24, w: 62, d: 20, r: 2.4 };
const CON_H = 8;

// ------------------------------------------------------------- the truth
const KEYS = MODEL.stark.key;
if (!KEYS) throw new Error("fig-lock: MODEL.stark.key is missing");
const NIBBLES = KEYS.circuit.slice(0, UP_X.length).split("").map((c) => parseInt(c, 16));
const CUT_U = NIBBLES.map((n) => TOP0 - (n / 15) * 5); // top edge height under each upper pin

const NAMES = [...MODEL.poly.x.map((_, i) => `x[${i}]`), ...MODEL.poly.result.map((_, i) => `result[${i}]`)];
const HONEST = [...MODEL.poly.x, ...MODEL.poly.result];
const changed = MODEL.stark.changed;
if (!changed) throw new Error("fig-lock: MODEL.stark.changed is missing");
const CLAIMED = [...changed.public_inputs.x, ...changed.public_outputs.result];
const low2 = (v) => Number(BigInt(v) & 3n);
const STEP = 2.2;
const CUT_L = HONEST.map((v) => BOT0 + STEP * low2(v)); // bottom edge height over each lower pin
const WAFERS = CLAIMED.map((v, j) => low2(v) - low2(HONEST[j]));
const TAMPER_J = CLAIMED.findIndex((v, j) => v !== HONEST[j]);
if (TAMPER_J < 0) throw new Error("fig-lock: changed statement equals the honest one");
if (WAFERS.some((n) => n < 0)) throw new Error("fig-lock: wafer model needs a longer claimed pin");
const REJECTED = MODEL.stark.rejected.replace(/^public_(inputs|outputs)\./, "");
if (REJECTED !== NAMES[TAMPER_J]) throw new Error(`fig-lock: trial changed ${REJECTED}, statement diff is ${NAMES[TAMPER_J]}`);
const WAFER_H = WAFERS[TAMPER_J] * STEP;

function topAt(u) {
  if (u < TIP || u > SHOULDER) return null;
  let v = Math.min(TOP0, TIP_TOP + (u - TIP) * TIP_SLOPE);
  UP_X.forEach((x, i) => (v = Math.min(v, CUT_U[i] + Math.max(0, Math.abs(u - x) - FLAT) * FLANK)));
  return v;
}
function bottomAt(u) {
  if (u < TIP || u > SHOULDER) return null;
  let v = Math.max(BOT0, TIP_BOT - (u - TIP) * TIP_SLOPE);
  LO_X.forEach((x, j) => (v = Math.max(v, CUT_L[j] - Math.max(0, Math.abs(u - x) - FLAT) * FLANK)));
  return v;
}

const fmt = (v) => String(v);

export default function figure() {
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -17, 0), [-24, -20, 84], [44, -20, 84], [-100, -12, 53], [-58, 0, 63], [BOW.x1 + KEY_OUT, 0, BOW.z1]],
    WIDTH,
    HEIGHT,
    { pad: 26, azimuth: 57 },
  );
  const B = bench(P);
  const { S, L, D, at } = B;
  const V = G.viewOf(P);
  const facing = (n) => G.dot3(n, V);
  const toneOf = (n) => G.toneOf(n, P);
  const f1 = (v) => (Math.round(v * 10) / 10).toString();
  const path = (pts, closed = true) => "M" + pts.map((p) => at(p).map(f1).join(" ")).join("L") + (closed ? "Z" : "");
  const toneAttr = (t) => (t >= 4 ? 'class="iso-top"' : `class="iso-shade" data-shade="${t}"`);
  const shade = (pts, n) => `<path ${toneAttr(toneOf(n))} d="${path(pts)}"/>`;
  const shadeN = (pts, s) => `<path class="iso-shade" data-shade="${s}" d="${path(pts)}"/>`;
  const rectY = (y, x0, x1, z0, z1) => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  const seg = (a, b) => k.segment(a, b, P);

  // A flat face in a world plane, as a solid with an outline.
  const faceSolid = (pts, n, { tone = "mid", lit = false } = {}) =>
    `<g class="iso-solid"${lit ? " data-lit" : ""}><path class="iso-fill" d="${path(pts)}"/>${shade(pts, n)}<path class="iso-line iso-edge" data-tone="${tone}" d="${path(pts)}"/></g>`;

  // --------------------------------------------------------------- base
  function base() {
    const out = [B.plate(PLATE)];
    out.push(B.ruler({ x: -50, y: 40, w: 112, d: 6, r: 1 }));
    out.push(B.labelPlate({ x: -102, y: 26, w: 40, d: 13, r: 1.2 }));
    return out.join("");
  }

  // -------------------------------------------------------------- keeper
  // The keeper: a block on a foot with a strike plate; the bolt enters its opening.
  const FOOT = { x: -104, y: -15, w: 22, d: 30, r: 1.5 };
  const KEEP = { x: -102, y: -12, w: 16, d: 24, r: 1.5 };
  const KEEP_Z1 = 56;
  const STRIKE_X = KEEP.x + KEEP.w; // -86, +x face
  const STRIKE = { x: STRIKE_X, y: -9, w: 1.2, d: 18, r: 0.4 };
  const SFX = STRIKE_X + STRIKE.w;
  const OPEN = { y0: BOLT.y - 1, y1: BOLT.y + BOLT.d + 1, z0: BOLT_Z0 - 1, z1: BOLT_Z1 + 1 };
  function keeper() {
    const out = [S(k.slabOf(FOOT, 0, 4, P, 3, 0.6), { tone: "lo" })];
    out.push(B.screwDots([[FOOT.x + 2.4, FOOT.y + 2.4], [FOOT.x + 2.4, FOOT.y + FOOT.d - 2.4], [FOOT.x + FOOT.w - 2, FOOT.y + 2.4], [FOOT.x + FOOT.w - 2, FOOT.y + FOOT.d - 2.4]], 4, 0.45));
    out.push(S(k.slabOf(KEEP, 4, KEEP_Z1 - 4, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(KEEP, 12, P, 3), { tone: "faint" }) }));
    out.push(L(k.planOutline(k.insetPlan(KEEP, 2.4), KEEP_Z1, P, 3), { tone: "faint" }));
    out.push(S(k.slabOf(STRIKE, 28, 24, P, 2, 0.3), { tone: "mid" }));
    const hole = [[SFX, OPEN.y0, OPEN.z0], [SFX, OPEN.y1, OPEN.z0], [SFX, OPEN.y1, OPEN.z1], [SFX, OPEN.y0, OPEN.z1]];
    out.push(`<path class="iso-shade" data-shade="0" d="${path(hole)}"/>`, L(path(hole), { tone: "lo" }));
    out.push(D([at([SFX, 0, 31]), at([SFX, 0, 49])], { size: 0.45 }));
    // an inspection cover on the near face
    const ky = KEEP.y + KEEP.d, cover = rectY(ky, KEEP.x + 3.5, KEEP.x + KEEP.w - 3.5, 18, 46);
    out.push(L(path(cover), { tone: "faint" }));
    out.push(D([[KEEP.x + 5.5, 20], [KEEP.x + KEEP.w - 5.5, 20], [KEEP.x + 5.5, 44], [KEEP.x + KEEP.w - 5.5, 44]].map(([x, z]) => at([x, ky, z])), { size: 0.45 }));
    return out.join("");
  }
  // Seen only through the strike opening or outside the keeper.
  const boltClipPts = (() => {
    const pts = [];
    for (const x of [SFX, SFX + 400]) for (const y of [OPEN.y0, OPEN.y1]) for (const z of [OPEN.z0, OPEN.z1]) pts.push(at([x, y, z]));
    return pts;
  })();

  // ---------------------------------------------------------------- bolt
  function bolt() {
    const out = [S(k.slabOf(BOLT, BOLT_Z0, BOLT_Z1 - BOLT_Z0, P, 2, 0.6), { tone: "hi" })];
    // two grooves across the bolt top, edge to edge
    out.push(L([BOLT.x + 6, BOLT.x + 9].map((x) => k.lineOnTop([x, BOLT.y], [x, BOLT.y + BOLT.d], BOLT_Z1, P)).join(""), { tone: "faint" }));
    return `<g data-part="bolt">${out.join("")}</g>`;
  }
  function boltCase() {
    const out = [];
    const flange = { x: HOUSE.x - 4, y: -16, w: 4, d: 32, r: 1 };
    out.push(S(k.slabOf(CASE, CASE_Z0, CASE_Z1 - CASE_Z0, P, 3, 0.6), { tone: "mid" }));
    out.push(L(k.sideSeam(CASE, CASE_Z0 + 4, P, 3), { tone: "faint" }));
    const slot = { x: FLAG_X - 1.5, y: -1.3, w: BOLT_TRAVEL + 3, d: 2.6, r: 1.2 };
    out.push(S(k.slabOf(slot, CASE_Z1 - 0.01, 0.01, P, 4), { tone: "lo", crease: "none" }));
    out.push(B.screwDots([[CASE.x + 2.6, CASE.y + 2.6], [CASE.x + 2.6, CASE.y + CASE.d - 2.6]], CASE_Z1, 0.45));
    const cy = CASE.y + CASE.d, cover = rectY(cy, CASE.x + 3, CASE.x + CASE.w - 3, CASE_Z0 + 6.5, CASE_Z1 - 3);
    out.push(L(path(cover), { tone: "faint" }), D([[CASE.x + 5, CASE_Z1 - 5], [CASE.x + CASE.w - 5, CASE_Z1 - 5]].map(([x, z]) => at([x, cy, z])), { size: 0.45 }));
    out.push(S(k.slabOf(flange, 26, 28, P, 2, 0.5), { tone: "mid" }));
    out.push(B.screwDots([[flange.x + 2, flange.y + 2.4], [flange.x + 2, flange.y + flange.d - 2.4]], 54, 0.45));
    return out.join("");
  }
  function flag() {
    const stem = { x: FLAG_X, y: -0.9, w: 2, d: 1.8, r: 0.4 };
    const plate = { x: FLAG_X - 7, y: -0.6, w: 7, d: 1.2, r: 0.3 };
    return `<g data-part="flag">${S(k.slabOf(stem, CASE_Z1, 13, P, 2), { tone: "mid" })}${S(k.slabOf(plate, CASE_Z1 + 7, 6, P, 2, 0.3), { tone: "hi" })}</g>`;
  }

  // -------------------------------------------------- cradles and straps
  const STRAP_X = [-24, 44];
  const cradles = () =>
    STRAP_X.map((cx) => {
      const plan = { x: cx - 8, y: -20, w: 16, d: 40, r: 1.5 };
      return S(k.slabOf(plan, 0, HZ0, P, 3, 0.6), { tone: "mid" }) + L(k.sideSeam(plan, 2.5, P, 3), { tone: "faint" });
    }).join("");
  const studLow = (y) => STRAP_X.map((cx) => S(k.cylinder(cx, y, 1.3, HZ0, HZ1 - HZ0, P, 16), { tone: "mid", crease: "none" })).join("");
  function straps() {
    const out = [];
    for (const cx of STRAP_X) {
      const plan = { x: cx - 4, y: -21, w: 8, d: 42, r: 1.2 };
      out.push(S(k.slabOf(plan, HZ1, 3, P, 2, 0.5), { tone: "mid" }));
    }
    for (const y of [-17, 17])
      for (const cx of STRAP_X) {
        out.push(S(k.cylinder(cx, y, 2.6, HZ1 + 3, 2.4, P, 6), { tone: "mid" }));
        out.push(S(k.cylinder(cx, y, 1.3, HZ1 + 5.4, 2, P, 16), { tone: "mid" }));
      }
    return out.join("");
  }

  // ------------------------------------------------------------- housing
  const WIN_FACE = rectY(FACE_Y, WIN.x0, WIN.x1, WIN.z0, WIN.z1);
  function housing() {
    const out = [S(k.slabOf(HOUSE, HZ0, HZ1 - HZ0, P, 3, 0.8), { tone: "mid" })];
    // chamber caps on top, one per upper pin
    for (const x of UP_X) out.push(S(k.cylinder(x, 0, 2.2, HZ1, 0.8, P, 18), { tone: "mid" }));
    out.push(B.screwDots(UP_X.map((x) => [x, 0]), HZ1 + 0.8, 0.4));
    // keyway end: plug face, bezel, keyway
    const face = FRONT_X;
    out.push(L(k.sideRing([face, 0, PLUG_Z], PLUG_R, "x", P, 40), { tone: "lo" }));
    out.push(L(k.sideRing([face, 0, PLUG_Z], PLUG_R + 1.8, "x", P, 44), { tone: "faint" }));
    const kw = [[-1.1, 30.4], [1.1, 30.4], [1.1, 37.5], [0.4, 38.6], [1.1, 39.8], [1.1, 49.6], [-1.1, 49.6], [-1.1, 44], [-0.4, 42.8], [-1.1, 41.6]];
    const kwPts = kw.map(([y, z]) => [face, y, z]);
    out.push(`<path class="iso-shade" data-shade="0" d="${path(kwPts)}"/>`, L(path(kwPts), { tone: "lo" }));
    // front face screws
    out.push(D([at([face, -8, 70]), at([face, 8, 70]), at([face, -8, 14]), at([face, 8, 14])], { size: 0.45 }));
    // +y face: screws in the corners and a frame line round the window
    out.push(D([[-26, 75], [46, 75], [-26, 12], [46, 12]].map(([x, z]) => at([x, FACE_Y, z])), { size: 0.45 }));
    out.push(L(path(rectY(FACE_Y, WIN.x0 - 2.4, WIN.x1 + 2.4, WIN.z0 - 2.4, WIN.z1 + 2.4)), { tone: "faint" }));
    return out.join("");
  }

  // ----------------------------------------------------- inside the window
  const winClipPts = WIN_FACE.map((p) => at(p));
  const winClip = `<clipPath id="lock-window"><path d="M${winClipPts.map((p) => p.map(f1).join(" ")).join("L")}Z"/></clipPath>`;

  function windowBack() {
    const out = [];
    const { x0, x1, z0, z1 } = WIN;
    // section: housing above and below, plug between the shear lines
    out.push(`<path class="iso-fill" d="${path(rectY(BACK_Y, x0, x1, z0, z1))}"/>`);
    out.push(shadeN(rectY(BACK_Y, x0, x1, SHEAR_U, z1), 1), shadeN(rectY(BACK_Y, x0, x1, z0, SHEAR_L), 1));
    out.push(`<path class="iso-top" d="${path(rectY(BACK_Y, x0, x1, SHEAR_L, SHEAR_U))}"/>`);
    out.push(shadeN(rectY(BACK_Y, x0, x1, KEYWAY.z0, KEYWAY.z1), 2));
    // bores: half cylinders cut through the back plane
    const bores = [];
    UP_X.forEach((x) => bores.push(rectY(BACK_Y, x - BORE_R, x + BORE_R, KEYWAY.z1, CAP_U)));
    LO_X.forEach((x) => bores.push(rectY(BACK_Y, x - BORE_R, x + BORE_R, FLOOR_L, KEYWAY.z0)));
    out.push(bores.map((b) => shadeN(b, 0)).join(""));
    out.push(L(bores.map((b) => path(b)).join(""), { tone: "lo" }));
    out.push(L([seg([x0, BACK_Y, KEYWAY.z0], [x1, BACK_Y, KEYWAY.z0]), seg([x0, BACK_Y, KEYWAY.z1], [x1, BACK_Y, KEYWAY.z1])].join(""), { tone: "faint" }));
    // shear lines, broken at every bore
    const shear = (z, xs) => {
      const cuts = [x0, ...xs.flatMap((x) => [x - BORE_R, x + BORE_R]), x1];
      let d = "";
      for (let i = 0; i < cuts.length; i += 2) d += seg([cuts[i], BACK_Y, z], [cuts[i + 1], BACK_Y, z]);
      return d;
    };
    out.push(L(shear(SHEAR_U, UP_X) + shear(SHEAR_L, LO_X), { tone: "hi" }));
    // sill and left wall of the recess
    const sill = [[x0, BACK_Y, z0], [x1, BACK_Y, z0], [x1, FACE_Y, z0], [x0, FACE_Y, z0]];
    out.push(`<path class="iso-top" d="${path(sill)}"/>`);
    const wall = [[x0, BACK_Y, z0], [x0, FACE_Y, z0], [x0, FACE_Y, z1], [x0, BACK_Y, z1]];
    out.push(shade(wall, [1, 0, 0]));
    // the plug's circle where the wall cuts it, plug lighter inside
    const arc = [];
    const a0 = Math.asin(BACK_Y / PLUG_R);
    for (let i = 0; i <= 40; i++) {
      const a = a0 + ((Math.PI - 2 * a0) * i) / 40; // from top (y = BACK_Y) round the +y side to the bottom
      arc.push([x0, PLUG_R * Math.sin(a), PLUG_Z + PLUG_R * Math.cos(a)]);
    }
    out.push(shadeN(arc, 2));
    out.push(L(path(arc, false), { tone: "mid" }));
    out.push(L([seg([x0, BACK_Y, z0], [x0, BACK_Y, z1]), seg([x0, BACK_Y, z0], [x1, BACK_Y, z0]), seg([x0, BACK_Y, z0], [x0, FACE_Y, z0]), seg([x1, BACK_Y, z0], [x1, BACK_Y, z1])].join(""), { tone: "lo" }));
    return out.join("");
  }

  // ---------------------------------------------------------------- pins
  const pin = (x, z0, h, tone, extra = {}) => S(k.cylinder(x, 0, PIN_R, z0, h, P, 18), { tone, crease: "lo", ...extra });
  const springDots = (part) => `<g class="iso-dots" data-tone="mid" data-spring-dots="${part}"><circle r="0.45"/><circle r="0.45"/></g>`;
  const springMarkup = (part) => `<g data-spring="${part}"><path class="iso-line" data-tone="lo" d=""/><path class="iso-line" data-tone="mid" d=""/>${springDots(part)}</g>`;
  function lowerStacks() {
    return LO_X.map((x, j) => {
      const b = CUT_L[j];
      const keyPin = pin(x, SHEAR_L, b - SHEAR_L, "hi");
      const driver = pin(x, SHEAR_L - DRIVER, DRIVER, "mid");
      const wafer = WAFERS[j] ? `<g data-wafer="${j}" opacity="0">${pin(x, SHEAR_L - WAFERS[j] * STEP, WAFERS[j] * STEP, "hi")}</g>` : "";
      return `${springMarkup("lo" + j)}<g data-lod="${j}">${driver}</g><g data-lo="${j}">${wafer}${keyPin}</g>`;
    }).join("");
  }
  function upperStacks() {
    return UP_X.map((x, i) => {
      const h = CUT_U[i];
      return `<g data-up="${i}">${pin(x, h, SHEAR_U - h, "hi")}${pin(x, SHEAR_U, DRIVER, "mid")}</g>${springMarkup("up" + i)}`;
    }).join("");
  }

  // ----------------------------------------------------------------- key
  const outline = [];
  {
    const tops = [], bots = [];
    for (let u = TIP; u <= SHOULDER + 1e-6; u += 0.25) {
      tops.push([u, topAt(u)]);
      bots.push([u, bottomAt(u)]);
    }
    const simplify = (pts) =>
      pts.filter((p, i) => {
        if (i === 0 || i === pts.length - 1) return true;
        const a = pts[i - 1], c = pts[i + 1];
        return Math.abs((p[1] - a[1]) * (c[0] - p[0]) - (c[1] - p[1]) * (p[0] - a[0])) > 1e-4;
      });
    const bow = [];
    const { x0, x1, z0, z1, r } = BOW;
    const corner = (cx, cz, a0) => {
      for (let i = 0; i <= 6; i++) {
        const a = a0 + (Math.PI / 2) * (i / 6);
        bow.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
      }
    };
    bow.push([x0, BOT0]);
    corner(x0 + r, z0 + r, Math.PI);
    corner(x1 - r, z0 + r, -Math.PI / 2);
    corner(x1 - r, z1 - r, 0);
    corner(x0 + r, z1 - r, Math.PI / 2);
    bow.push([x0, TOP0]);
    outline.push(...simplify(bots), ...bow, ...simplify(tops).reverse());
  }
  function keySvg(lit) {
    const n = outline.length;
    const front = outline.map(([x, z]) => [x, KEY_T, z]);
    const back = outline.map(([x, z]) => [x, -KEY_T, z]);
    const quads = [[], [], [], []], tops = [];
    let crease = "", edge = "";
    const vis = outline.map((p, i) => {
      const q = outline[(i + 1) % n];
      const dx = q[0] - p[0], dz = q[1] - p[1];
      const len = Math.hypot(dx, dz) || 1;
      const nrm = [dz / len, 0, -dx / len];
      return { nrm, on: facing(nrm) > 1e-6 };
    });
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const { nrm, on } = vis[i];
      if (on) {
        const quad = path([back[i], back[j], front[j], front[i]]);
        const t = toneOf(nrm);
        if (t >= 4) tops.push(quad);
        else quads[t].push(quad);
        crease += path([front[i], front[j]], false);
        edge += path([back[i], back[j]], false);
        if (!vis[(i - 1 + n) % n].on) edge += path([front[i], back[i]], false);
        if (!vis[j].on) edge += path([front[j], back[j]], false);
      } else edge += path([front[i], front[j]], false);
    }
    const hole = [];
    for (let i = 0; i <= 32; i++) {
      const a = (2 * Math.PI * i) / 32;
      hole.push([BOW.hole[0] + BOW.holeR * Math.cos(a), KEY_T, BOW.hole[1] + BOW.holeR * Math.sin(a)]);
    }
    const holeBack = hole.map(([x, , z]) => [x, -KEY_T, z]);
    const faceD = path(front) + path(hole);
    const frontTone = toneOf([0, 1, 0]);
    const parts = [
      `<path class="iso-fill" fill-rule="evenodd" d="${faceD}"/>`,
      `<path class="iso-fill" d="${[...quads.flat(), ...tops].join("")}"/>`,
      ...quads.map((list, s) => (list.length ? `<path class="iso-shade" data-shade="${s}" d="${list.join("")}"/>` : "")),
      tops.length ? `<path class="iso-top" d="${tops.join("")}"/>` : "",
      `<path ${toneAttr(frontTone)} fill-rule="evenodd" d="${faceD}"/>`,
      `<path class="iso-line iso-crease" data-tone="lo" d="${crease}"/>`,
      // the hole's far rim shows through it
      `<path class="iso-line" data-tone="faint" d="${path(holeBack.slice(8, 25), false)}"/>`,
      `<path class="iso-line iso-edge" data-tone="hi" d="${edge + path(hole)}"/>`,
    ];
    return `<g class="iso-solid" data-key${lit ? " data-lit" : ""}>${parts.join("")}</g>`;
  }

  // Outside the lock: only what lies beyond the keyway face shows.
  const hull = (pts) => {
    const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
    for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
  };
  const outPts = hull(k.boxCorners({ x: FRONT_X, y: -KEY_T, w: 400, d: 2 * KEY_T, r: 0 }, -60, 200).map((p) => at(p)));
  const outClip = `<clipPath id="lock-out"><path d="M${outPts.map((p) => p.map(f1).join(" ")).join("L")}Z"/></clipPath>`;

  // --------------------------------------------------- rail and carriage
  function rail() {
    const out = [];
    for (const x of [64, 146]) {
      out.push(S(k.cylinder(x, 0, 5, 0, 1.6, P, 28), { tone: "lo" }));
      out.push(S(k.cylinder(x, 0, 3, 1.6, RAIL_Z0 - 1.6, P, 24), { tone: "mid", crease: "none" }));
      out.push(L(k.sideArc(x, 0, 3, 8, P, 18), { tone: "faint" }));
    }
    out.push(S(k.slabOf(RAIL, RAIL_Z0, RAIL_Z1 - RAIL_Z0, P, 2, 0.4), { tone: "mid" }));
    out.push(L(k.lineOnTop([RAIL.x, 0], [RAIL.x + RAIL.w, 0], RAIL_Z1, P), { tone: "faint" }));
    for (const x of [RAIL.x, RAIL.x + RAIL.w - 3]) {
      const stop = { x, y: -5, w: 3, d: 10, r: 0.6 };
      out.push(S(k.slabOf(stop, RAIL_Z1, 4, P, 2, 0.4), { tone: "mid" }));
      out.push(B.screwDots([[x + 1.5, -3], [x + 1.5, 3]], RAIL_Z1 + 4, 0.4));
    }
    return out.join("");
  }
  function carriage(lit) {
    const out = [S(k.slabOf(CARRIAGE, RAIL_Z1, CAR_Z1 - RAIL_Z1, P, 3, 0.5), { tone: "mid" })];
    out.push(L(k.sideSeam(CARRIAGE, RAIL_Z1 + 2, P, 3), { tone: "faint" }));
    const jawB = { x: CARRIAGE.x + 2, y: -KEY_T - 3, w: 10, d: 3, r: 0.5 };
    const jawF = { x: CARRIAGE.x + 2, y: KEY_T, w: 10, d: 3, r: 0.5 };
    out.push(S(k.slabOf(jawB, CAR_Z1, 6, P, 2, 0.4), { tone: "mid" }));
    out.push(keySvg(lit));
    out.push(S(k.slabOf(jawF, CAR_Z1, 6, P, 2, 0.4), { tone: "mid" }));
    out.push(B.screwDots([[jawF.x + 2.2, jawF.y + 1.5], [jawF.x + jawF.w - 2.2, jawF.y + 1.5]], CAR_Z1 + 6, 0.45));
    return out.join("");
  }

  // ------------------------------------------------------------- console
  const DISPLAY = { x: CON.x + 4, y: CON.y + 5, w: 34, d: 9, r: 1 };
  const LAMPS = { green: [CON.x + 46, CON.y + 10], red: [CON.x + 55, CON.y + 10] };
  function consoleBox() {
    const out = [S(k.slabOf(CON, 0, CON_H, P, 4, 0.8), { tone: "mid" })];
    out.push(L(k.sideSeam(CON, 2.4, P, 4), { tone: "faint" }));
    out.push(S(k.slabOf(DISPLAY, CON_H, 0.6, P, 3), { tone: "lo", crease: "none" }));
    out.push(L(k.planOutline(k.insetPlan(DISPLAY, 1), CON_H + 0.6, P, 3), { tone: "faint" }));
    const clipPts = k.ringOf(k.insetPlan(DISPLAY, 1), 3).map(([x, y]) => at([x, y, CON_H + 0.6]));
    out.push(`<clipPath id="lock-display"><path d="M${clipPts.map((p) => p.map(f1).join(" ")).join("L")}Z"/></clipPath>`);
    const text = k.faceTextSvg(k.topMatrix([DISPLAY.x + DISPLAY.w / 2, DISPLAY.y + DISPLAY.d / 2 + 1.7], CON_H + 0.6, P, "x"), fmt(HONEST[TAMPER_J]), { size: 4.6, tone: "hi", anchor: "middle" });
    out.push(`<g clip-path="url(#lock-display)" data-part="display">${text}</g>`);
    for (const [name, [x, y]] of Object.entries(LAMPS)) {
      out.push(S(k.cylinder(x, y, 3.4, CON_H, 1.4, P, 28), { tone: "mid" }));
      const lens = k.cylinder(x, y, 2.3, CON_H + 1.4, 1.1, P, 24);
      out.push(S(lens, { tone: "hi", crease: "lo" }));
      out.push(`<path data-lamp="${name}" d="${lens.top}" style="fill:var(--anatomy-${name})" opacity="0"/>`);
    }
    out.push(B.screwDots(k.corners(CON, 2.4), CON_H, 0.4));
    return out.join("");
  }

  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A pin-tumbler lock clamped in a bench test fixture, cut away along its side so both rows of pins show. A key on a sliding carriage enters from the right; its top edge is cut from the program's circuit hash and its bottom edge from the statement the proof binds. When every pin sits at a shear line the plug turns, the bolt on the left withdraws from its keeper and a green lamp lights; with a changed public output one lower pin straddles the shear line, the bolt stays and a red lamp lights.",
    body: [
      `<defs>${winClip}${outClip}<clipPath id="lock-bolt"><path d="M${hull(boltClipPts).map((p) => p.map(f1).join(" ")).join("L")}Z"/></clipPath></defs>`,
      base(),
      keeper(),
      studLow(-17),
      cradles(),
      `<g clip-path="url(#lock-bolt)">${bolt()}</g>`,
      boltCase(),
      flag(),
      housing(),
      `<g clip-path="url(#lock-window)">${windowBack()}${lowerStacks()}<g data-part="key-in">${keySvg(true)}</g>${upperStacks()}</g>`,
      L(path(WIN_FACE), { tone: "lo" }),
      studLow(17),
      straps(),
      rail(),
      `<g clip-path="url(#lock-out)"><g data-part="key-out">${carriage(true)}</g></g>`,
      consoleBox(),
    ],
  });

  // ---------------------------------------------------------------- live
  const live = `function (root, bus, chapter) {
${LIVE_HELPERS}
const P = ${JSON.stringify(P)};
const UP = ${JSON.stringify(UP_X.map((x, i) => ({ x, h: CUT_U[i] })))};
const LO = ${JSON.stringify(LO_X.map((x, j) => ({ x, b: CUT_L[j], w: WAFERS[j] * STEP })))};
const K = ${JSON.stringify({ TIP, SHOULDER, TOP0, BOT0, TIP_TOP, TIP_BOT, TIP_SLOPE, FLANK, FLAT, REST_U, REST_L, KEY_OUT, SHEAR_U, SHEAR_L, DRIVER, CAP_U, FLOOR_L, PIN_R, BOLT_TRAVEL })};
const TJ = ${TAMPER_J};
const LABEL = ${JSON.stringify(REJECTED)};
const HONEST_V = ${JSON.stringify(fmt(HONEST[TAMPER_J]))}, CLAIMED_V = ${JSON.stringify(fmt(CLAIMED[TAMPER_J]))};
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const qa = (s) => [...svg.querySelectorAll(s)];
const keyGroups = [q('[data-part="key-in"]'), q('[data-part="key-out"]')];
const keySolids = qa("[data-key]");
const ups = qa("[data-up]"), los = qa("[data-lo]"), lods = qa("[data-lod]");
const wafer = q('[data-wafer="' + TJ + '"]');
const waferSolid = wafer && wafer.querySelector(".iso-solid");
const springs = {};
qa("[data-spring]").forEach((g) => (springs[g.dataset.spring] = { back: g.children[0], front: g.children[1], dots: [...g.querySelectorAll("circle")] }));
const boltEl = q('[data-part="bolt"]'), flagEl = q('[data-part="flag"]');
const lamp = { green: q('[data-lamp="green"]'), red: q('[data-lamp="red"]') };
const display = q('[data-part="display"] text');
const readout = root.querySelector("[data-readout]");
const button = root.querySelector("[data-tamper]");
const az = (P.azimuth ?? 45) * Math.PI / 180, tv = [Math.cos(az), Math.sin(az)];

function topAt(u) {
  if (u < K.TIP || u > K.SHOULDER) return null;
  let v = Math.min(K.TOP0, K.TIP_TOP + (u - K.TIP) * K.TIP_SLOPE);
  for (const p of UP) v = Math.min(v, p.h + Math.max(0, Math.abs(u - p.x) - K.FLAT) * K.FLANK);
  return v;
}
function bottomAt(u) {
  if (u < K.TIP || u > K.SHOULDER) return null;
  let v = Math.max(K.BOT0, K.TIP_BOT - (u - K.TIP) * K.TIP_SLOPE);
  for (const p of LO) v = Math.max(v, p.b - Math.max(0, Math.abs(u - p.x) - K.FLAT) * K.FLANK);
  return v;
}
const f1 = (v) => (Math.round(v * 10) / 10).toString();
function spring(name, x, z0, z1) {
  const s = springs[name];
  const turns = 6, n = 96;
  let back = "", front = "", run = null, prev = null;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * 2 * Math.PI + Math.PI / 2;
    const c = Math.cos(a), sn = Math.sin(a);
    const pt = iso([x + K.PIN_R * c, K.PIN_R * sn, z0 + (z1 - z0) * t], P);
    pts.push(pt);
    const isFront = c * tv[0] + sn * tv[1] >= 0;
    if (run === null || isFront !== run) {
      if (prev) { if (isFront) front += "M" + f1(prev[0]) + " " + f1(prev[1]); else back += "M" + f1(prev[0]) + " " + f1(prev[1]); }
      else { if (isFront) front += "M" + f1(pt[0]) + " " + f1(pt[1]); else back += "M" + f1(pt[0]) + " " + f1(pt[1]); }
      run = isFront;
    }
    const seg = "L" + f1(pt[0]) + " " + f1(pt[1]);
    if (isFront) front += seg; else back += seg;
    prev = pt;
  }
  s.back.setAttribute("d", back);
  s.front.setAttribute("d", front);
  const ends = [pts[0], pts[n]];
  s.dots.forEach((d, i) => { d.setAttribute("cx", f1(ends[i][0])); d.setAttribute("cy", f1(ends[i][1])); });
}

// state: key 0 = in, 1 = out; wafer 0..1; bolt 0..1 withdrawn
const key = { x: 0, v: 0 }, wafer01 = { x: 0, v: 0 }, boltS = { x: 0, v: 0 }, green = { x: 0, v: 0 }, red = { x: 0, v: 0 };
function settle(s, target, dt, T, calm) {
  if (calm) { s.x = target; s.v = 0; return false; }
  const w = 1 / T, h = dt / 4;
  for (let i = 0; i < 4; i++) { s.v += (w * w * (target - s.x) - 2 * w * s.v) * h; s.x += s.v * h; }
  if (Math.abs(target - s.x) < 1e-4 && Math.abs(s.v) < 1e-4) { s.x = target; s.v = 0; }
  return s.x !== target;
}
const want = { key: 0, turn: true, tamper: false };
let blockedAt = -1, clock = 0, lastKey = 0;
let touring = !stillQuery.matches, idle = 0, tourStep = 2, tourT = 0, cycle = 0;
const TOUR = [
  { key: 1, turn: false, dwell: 1.6, start: true },
  { key: 0, turn: false, dwell: 3.4 },
  { key: 0, turn: true, dwell: 3.6 },
  { key: 0, turn: false, dwell: 1.0 },
  { key: 1, turn: false, dwell: 2.6 },
];
function tour(dt) {
  tourT += dt;
  if (tourT >= TOUR[tourStep].dwell) {
    tourT = 0;
    tourStep = (tourStep + 1) % TOUR.length;
    if (TOUR[tourStep].start) { cycle++; setTamper(cycle % 3 === 2); }
  }
  want.key = TOUR[tourStep].key;
  want.turn = TOUR[tourStep].turn;
}
function setTamper(on) {
  want.tamper = on;
  if (button) button.setAttribute("aria-pressed", on ? "true" : "false");
}
function apply(dt, calm) {
  clock += dt;
  const moving = [
    settle(key, want.key, dt, 0.42, calm),
    settle(wafer01, want.tamper ? 1 : 0, dt, 0.25, calm),
  ].some(Boolean);
  const keyX = key.x * K.KEY_OUT;
  keyGroups.forEach((g) => g.setAttribute("transform", translateAlong(P, [keyX, 0, 0])));
  const w = wafer01.x;
  let upOk = true;
  UP.forEach((p, i) => {
    const t = topAt(p.x - keyX);
    const bottom = t === null ? K.REST_U : Math.max(K.REST_U, t);
    const dz = bottom - p.h;
    if (Math.abs(dz) > 0.02) upOk = false;
    ups[i].setAttribute("transform", translateAlong(P, [0, 0, dz]));
    spring("up" + i, p.x, K.SHEAR_U + K.DRIVER + dz, K.CAP_U);
  });
  LO.forEach((p, j) => {
    const t = bottomAt(p.x - keyX);
    const top = t === null ? K.REST_L : Math.min(K.REST_L, t);
    const dz = top - p.b;
    const shift = dz - p.w * w;
    los[j].setAttribute("transform", translateAlong(P, [0, 0, dz]));
    lods[j].setAttribute("transform", translateAlong(P, [0, 0, shift]));
    spring("lo" + j, p.x, K.FLOOR_L, K.SHEAR_L - K.DRIVER + shift);
  });
  if (wafer) wafer.setAttribute("opacity", w.toFixed(3));
  if (display) { const t = w > 0.5 ? CLAIMED_V : HONEST_V; if (display.textContent !== t) display.textContent = t; }
  const keyIn = key.x < 0.002 && want.key === 0;
  const lowOk = w < 0.02;
  const aligned = keyIn && upOk && lowOk;
  const attempt = want.turn && keyIn;
  const blocked = attempt && !aligned;
  if (blocked && blockedAt < 0) blockedAt = clock;
  if (!blocked) blockedAt = -1;
  const age = blockedAt < 0 ? -1 : clock - blockedAt;
  const jig = calm || age < 0 ? 0 : 0.08 * Math.sin(Math.PI * clamp(age / 0.5, 0, 1)) * Math.exp(-Math.max(0, age - 0.25) / 0.2);
  const boltMoving = settle(boltS, attempt && aligned ? 1 : 0, dt, 0.22, calm);
  const b = clamp(boltS.x + jig, 0, 1);
  boltEl.setAttribute("transform", translateAlong(P, [b * K.BOLT_TRAVEL, 0, 0]));
  flagEl.setAttribute("transform", translateAlong(P, [b * K.BOLT_TRAVEL, 0, 0]));
  const lampsMoving = [settle(green, boltS.x > 0.97 ? 1 : 0, dt, 0.12, calm), settle(red, blocked ? 1 : 0, dt, 0.12, calm)].some(Boolean);
  lamp.green.setAttribute("opacity", green.x.toFixed(3));
  lamp.red.setAttribute("opacity", red.x.toFixed(3));
  // one lit accent: the blocking wafer, else the key
  keySolids.forEach((s) => (blocked ? s.removeAttribute("data-lit") : s.setAttribute("data-lit", "")));
  if (waferSolid) blocked ? waferSolid.setAttribute("data-lit", "") : waferSolid.removeAttribute("data-lit");
  // readout from where the parts are
  let text;
  if (blocked) text = LABEL + " " + HONEST_V + " → " + CLAIMED_V + " · rejected";
  else if (b > 0.97) text = "statement matches · accepted";
  else if (b > 0.02) text = aligned ? "every pin at the shear line · plug turning" : "plug returning";
  else if (key.x > 0.998) text = w > 0.5 ? LABEL + " " + HONEST_V + " → " + CLAIMED_V + " · same proof" : "key out · statement x, result loaded";
  else if (key.x < 0.002) text = aligned ? "every pin at the shear line" : LABEL + " pin off the shear line";
  else text = key.x < lastKey ? "inserting key · pins rise to its cuts" : "withdrawing key";
  lastKey = key.x;
  if (readout.textContent !== text) readout.textContent = text;
  return moving || boltMoving || lampsMoving || age >= 0 && age < 1.5;
}
const run = loop(root, (dt, calm) => {
  if (touring) tour(dt);
  else idle += dt;
  if (!touring && idle > 4 && !calm) touring = true;
  const busy = apply(dt, calm);
  return touring || busy || (!calm && idle <= 4.5);
});
function takeOver() { touring = false; idle = 0; }
function stepTo(s) {
  takeOver();
  const st = clamp(s, 0, 2);
  want.key = st === 0 ? 1 : 0;
  want.turn = st === 2;
  run();
}
const stepNow = () => (want.key === 1 ? 0 : want.turn ? 2 : 1);
function tamper() {
  takeOver();
  if (want.turn) want.turn = false;
  setTamper(!want.tamper);
  run();
}
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowUp") stepTo(stepNow() + 1);
  else if (e.key === "ArrowLeft" || e.key === "ArrowDown") stepTo(stepNow() - 1);
  else if (e.key === "Home") stepTo(0);
  else if (e.key === "End") stepTo(2);
  else if (e.key === "t" || e.key === "T") tamper();
  else return;
  e.preventDefault();
});
stage.addEventListener("click", () => { if (touring) takeOver(); else { touring = true; run(); } });
if (button) button.addEventListener("click", () => { tamper(); });
if (stillQuery.matches) touring = false;
apply(1 / 60, true);
run();
}`;

  return {
    id: "fig-lock",
    fig: "Fig 7",
    title: "Verifier lock",
    hint: "← → key · T tamper · click to pause",
    readout: "every pin at the shear line",
    stage: { "aria-label": "Verifier lock: left and right arrows insert, turn and withdraw the key; T changes result[0] in the public statement" },
    keys: [
      { mark: "lit", label: "The key (a proof), or the pin that blocks it" },
      { mark: "raised", label: "Upper pins: set for this program" },
      { mark: "flat", label: "Lower pins: the public statement x, result" },
      { mark: "green", label: "accepted" },
      { mark: "red", label: "rejected" },
    ],
    caption: `The key's top edge is cut from the first six nibbles of the real circuit hash (${KEYS.circuit.slice(0, 6)}…), so only a proof for this program lifts the upper pins to the shear line. The lower pins hold the public statement, x = [${MODEL.poly.x.join(", ")}] and result = [${MODEL.poly.result.join(", ")}] (each word's low two bits set one pin); there is no pin for a private input. Tamper replays the real trial: ${REJECTED} ${HONEST[TAMPER_J]} → ${CLAIMED[TAMPER_J]} with the same proof, and the verifier rejected it. Acceptance means, except with the proof system's soundness error, that some trace satisfies this fixed circuit and binds this statement; it does not prove the compiler lowered the source as intended, and S31 does not currently promise zero knowledge.`,
    controls: `<div class="fig-controls"><button type="button" data-tamper aria-pressed="false">Tamper ${REJECTED} +1</button></div>`,
    svg,
    live,
  };
}
