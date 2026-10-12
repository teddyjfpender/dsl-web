// Fig 5 · The repeated-step chip: a pallet line with one press.
// Every pallet is one row of the chip's trace (one round). Its cartridge holds
// four slugs, one per lane. The press squares and adds 7 in all four lanes at
// once; the pallet's output key then slides into the next pallet's input
// socket, which is how the chip's two LogUp constraints link row i's output
// tuple to row i+1's input tuple. A gate at the start stamps public x into the
// first pallet; a gate at the end feels the last pallet against public y.
import { k, bench, LIVE_HELPERS } from "./parts.mjs";
import MODEL from "../model/s31.mjs";

const WIDTH = 600;
const HEIGHT = 380;

const chip = MODEL.chip;
const TEACH = chip.teach; // 16 rows: { index, in: [4], out: [4] }
const ROUNDS = TEACH.length;
const P31 = MODEL.field.p;
const fmt = (n) => n.toLocaleString("en-US");

// ------------------------------------------------------------- world layout
const PLATE = { x: -172, y: -60, w: 344, d: 126, r: 8 };
const PITCH = 46; // one round of travel
const XE = 118; // the chain shows between the two housings
const HOUSE_W = 34;
const MOUTH = { y: 21, z0: 14, z1: 42 }; // the opening pallets leave the left housing through
const RAIL_Z = 16;
const BASE = { x: -19, y: -18, w: 38, d: 36, r: 2 }; // pallet base, z 16..20
const BASE_Z = RAIL_Z, BASE_H = 4;
const CART = { x: -12, y: -15.5, w: 24, d: 31, r: 1.6 }; // cartridge, z 20..28
const CART_Z = BASE_Z + BASE_H, CART_H = 8;
const ZC = CART_Z + CART_H; // cartridge top
const LANES = [-10.5, -3.5, 3.5, 10.5];
const SLUG_R = 2.2, HOLE_R = 2.8;
const HMAX = 10; // a slug can stand 10 above the cartridge
// Slug height: grows with the value's bit length (log scale), 0 = no value yet.
const heightOf = (v) => 0.6 + (HMAX - 0.6) * (Math.log2(v + 1) / 31);
// Key (tongue) on the trailing end and socket (cheeks) on the leading end.
const TONGUE = { x: -27, y: -3.2, w: 8, d: 6.4, r: 0.6 };
const TONGUE_Z = 16.4, TONGUE_H = 2.6;
const RETRACT = 6;
const CHEEK_Z = 16.4, CHEEK_H = 4.6;
const CHEEKS = [{ x: 19, y: -6.2, w: 4.6, d: 2.8, r: 0.5 }, { x: 19, y: 3.4, w: 4.6, d: 2.8, r: 0.5 }];
// Key profile: four teeth whose heights come from the row's output tuple.
const toothH = (v) => 0.3 + 0.2 * (v % 4); // ≤ 0.9, so a retracted key hides under the base

// Press at x = 0.
const POST_TOP = 72, CROWN_H = 10;
const HEAD = { x: -8, y: -15.5, w: 16, d: 31, r: 1.6 };
const HEAD_Z = 54, HEAD_H = 9, PIN_LEN = 5, STROKE = 10;
// Gates at x = ∓PITCH, cantilevered from columns on the far side.
const GATE = { load: -PITCH, unload: PITCH };
const COL_Y = -34, ARM_Z = 66, ARM_H = 6;
const GHEAD_Z = 46, GHEAD_H = 10, GPIN = 5;
const LOAD_STROKE = GHEAD_Z - GPIN - (ZC + 0.1);
const FEEL_STROKE = 2.5;
const FEEL_LEN = GPIN + 10; // feeler pins can reach 10 below the head's travel
// Console with the machine's displays on its front face.
const CON = { x: -84, y: 42, w: 168, d: 16, r: 2.4 };
const CON_H = 15;
const FACE_Y = CON.y + CON.d;
const COUNTER = { x: -78, w: 18 };
const WIN_W = 30, WIN_GAP = 4, WIN_X0 = -54;
const WIN_Z0 = 2.2, WIN_Z1 = 12.8;
const TEXT = 3.4; // 10 digits × 0.64 em = 21.8 < 26 inside a 30-wide window

export default function figure() {
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -17, 0), [0, -54, 92], [0, 8, 92], [GATE.load, -39, 72], [GATE.unload, 7, 72], [-XE - HOUSE_W, -26, 46], [XE + HOUSE_W, 26, 46]],
    WIDTH,
    HEIGHT,
    { pad: 16, azimuth: 58 },
  );
  const B = bench(P);
  const { S, L, D, at } = B;
  const slab = (plan, z, h, steps = 3, bevel = 0.4) => k.slabOf(plan, z, h, P, steps, bevel);
  const cyl = (x, y, r, z, h, steps = 24) => k.cylinder(x, y, r, z, h, P, steps);
  const hull = (pts) => {
    const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
    for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
  };
  const polyD = (pts) => `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}Z`;
  const circlePts = (cx, cy, r, z, n = 28) => Array.from({ length: n }, (_, i) => at([cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI), z]));

  // ------------------------------------------------------------- base
  function base() {
    const out = [B.plate(PLATE)];
    out.push(B.labelPlate({ x: 100, y: 44, w: 44, d: 14, r: 1.2 }));
    out.push(B.ruler({ x: -160, y: PLATE.y + PLATE.d - 15, w: 66, d: 7, r: 1 }));
    return out.join("");
  }

  // Housings at both ends: the chain comes out of one and goes into the other.
  function housing(x0, { opening }) {
    const plan = { x: x0, y: -26, w: HOUSE_W, d: 52, r: 3 };
    const h = 46;
    const out = [S(slab(plan, 0, h, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, 8, P, 4), { tone: "faint" }) })];
    const lid = k.insetPlan(plan, 3);
    out.push(L(k.planOutline(lid, h, P, 4), { tone: "faint" }));
    out.push(B.screwDots(k.corners(plan, 6), h, 0.45));
    // a drive shaft cover on the near face
    const cx = x0 + plan.w / 2, cz = 26;
    out.push(L(k.sideRing([cx, plan.y + plan.d, cz], 9, "y", P, 48), { tone: "lo" }));
    out.push(L(k.sideRing([cx, plan.y + plan.d, cz], 4, "y", P, 32), { tone: "faint" }));
    out.push(D([at([cx, plan.y + plan.d, cz])], { size: 0.6, tone: "mid" }));
    // two closed vent slots under the cover
    const fy = plan.y + plan.d;
    const slot = (x, z) => {
      const pts = [[x - 9, z], [x + 9, z], [x + 9, z + 1.6], [x - 9, z + 1.6]].map(([sx, sz]) => at([sx, fy, sz]));
      return `M${pts.map((q) => q.map((v) => v.toFixed(1)).join(" ")).join("L")}Z`;
    };
    out.push(L([10.4, 13.4].map((z) => slot(cx, z)).join(""), { tone: "lo" }));
    if (opening) {
      // the mouth on the +x face the pallets come out of: a dark opening
      const fx = x0 + plan.w;
      const m = [[-MOUTH.y, MOUTH.z0], [MOUTH.y, MOUTH.z0], [MOUTH.y, MOUTH.z1], [-MOUTH.y, MOUTH.z1]].map(([y, z]) => at([fx, y, z]));
      out.push(`<path class="iso-fill" d="${polyD(m)}" style="fill:var(--anatomy-shade-0)"/>`);
      out.push(`<path class="iso-line" data-tone="lo" d="${polyD(m)}"/>`);
    }
    return out.join("");
  }

  // Two beams carry the rails; the near one has a pitch ruler, a major tick per round.
  function beams() {
    const out = [];
    const far = { x: -XE, y: -16, w: XE * 2, d: 8, r: 1 };
    const near = { x: -XE, y: 8, w: XE * 2, d: 16, r: 1 };
    for (const b of [far, near]) {
      out.push(S(slab(b, 0, 13, 3, 0.5), { tone: "lo", inner: L(k.sideSeam(b, 4, P, 3), { tone: "faint" }) }));
    }
    for (const y of [-12, 12]) {
      const rail = { x: -XE, y: y - 1.5, w: XE * 2, d: 3, r: 0.6 };
      out.push(S(slab(rail, 13, RAIL_Z - 13, 2, 0.3), { tone: "mid" }));
    }
    const strip = { x: -96, y: 17.5, w: 192, d: 5.5, r: 0.8 };
    out.push(S(slab(strip, 13, 0.6, 3), { tone: "lo", crease: "none" }));
    const t = k.topTicks(-92, 92, PITCH / 10, 10, strip.y + 0.6, 13.6, [1.6, 3.2], P);
    out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
    out.push(B.screwDots([[-XE + 5, -12], [XE - 5, -12], [-XE + 5, 12], [XE - 5, 12], [-XE + 5, 20], [XE - 5, 20]], RAIL_Z, 0.4));
    return out.join("");
  }

  // ------------------------------------------------------------ pallets
  // Built at x = 0; pallet i sits at x = (s − i)·PITCH where s is the round at the press.
  const holeClip = (j) => {
    const y = LANES[j];
    return `<clipPath id="chip-slug-${j}"><path d="${polyD(hull([...circlePts(0, y, HOLE_R, ZC), ...circlePts(0, y, HOLE_R, ZC + 30)]))}"/></clipPath>`;
  };
  const palletAt = (i) => k.translateAlong(P, [-i * PITCH, 0, 0]);
  const item = (i, part, body, extra = "") => `<g data-pallet="${i}" data-p="${part}"${extra} transform="${palletAt(i)}">${body}</g>`;

  // The key: a tongue whose four teeth are cut to the row's output tuple.
  function tongue(i) {
    const row = TEACH[i];
    const out = [S(slab(TONGUE, TONGUE_Z, TONGUE_H, 2, 0.3), { tone: "mid" })];
    row.out.forEach((v, j) => {
      const tooth = { x: TONGUE.x + 0.9 + j * 1.9, y: -1.7, w: 1.1, d: 3.4, r: 0.2 };
      out.push(S(slab(tooth, TONGUE_Z + TONGUE_H, toothH(v), 2), { tone: "hi", crease: "lo" }));
    });
    return item(i, "tongue", `<g data-key transform="${k.translateAlong(P, [RETRACT, 0, 0])}">${out.join("")}</g>`);
  }
  const cheek = (i, side) => item(i, "cheek", S(slab(CHEEKS[side], CHEEK_Z, CHEEK_H, 2, 0.3), { tone: "mid" }) + B.screwDots([[CHEEKS[side].x + 2.3, CHEEKS[side].y + 1.4]], CHEEK_Z + CHEEK_H, 0.35));
  function body(i) {
    const out = [];
    out.push(S(slab(BASE, BASE_Z, BASE_H, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(BASE, BASE_Z + 1.4, P, 3), { tone: "faint" }) }));
    out.push(B.screwDots(k.corners(BASE, 2.6), BASE_Z + BASE_H, 0.4));
    out.push(`<g data-cart>${S(slab(CART, CART_Z, CART_H, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(CART, CART_Z + 2.4, P, 3), { tone: "faint" }) })}</g>`);
    // the four wells and their slugs, far lane first
    LANES.forEach((y, j) => {
      out.push(`<path class="iso-fill" d="${polyD(circlePts(0, y, HOLE_R, ZC))}" style="fill:var(--anatomy-shade-0)"/>`);
      out.push(L(k.ring(0, y, HOLE_R, ZC, P, 24), { tone: "lo" }));
      const slug = S(cyl(0, y, SLUG_R, ZC - 12, 12 + HMAX, 20), { tone: "hi", crease: "lo" });
      out.push(`<g clip-path="url(#chip-slug-${j})"><g data-slug="${j}" transform="${k.translateAlong(P, [0, 0, -HMAX])}">${slug}</g></g>`);
      out.push(L(k.sideArc(0, y, HOLE_R, ZC, P, 16), { tone: "lo" }));
    });
    out.push(B.screwDots([[CART.x + 2.4, CART.y + 2.4], [CART.x + CART.w - 2.4, CART.y + CART.d - 2.4]], ZC, 0.4));
    return item(i, "body", out.join(""));
  }

  const chainItems = [];
  for (let i = ROUNDS - 1; i >= 0; i--) {
    chainItems.push(tongue(i));
    if (i + 1 < ROUNDS) chainItems.push(cheek(i + 1, 1));
    chainItems.push(body(i));
    chainItems.push(cheek(i, 0));
  }
  chainItems.push(cheek(0, 1));
  // The chain is clipped to a prism whose left end is the housing's mouth, so a
  // pallet inside the left housing shows only through the mouth. The right
  // housing is drawn after the chain and covers what has gone in.
  const clipPts = hull(k.boxCorners({ x: -XE, y: -MOUTH.y, w: XE * 2 + 60, d: MOUTH.y * 2, r: 0 }, MOUTH.z0, MOUTH.z1).map((p) => at(p)));
  const chain = `<g clip-path="url(#chip-chain)"><g data-part="chain-fade"><g data-part="chain">${chainItems.join("")}</g></g></g>`;

  // ------------------------------------------------------------- press
  // A C-frame press: a heavy column behind the line and a crown over the station.
  const COLUMN = { x: -11, y: -50, w: 22, d: 14, r: 2.4 };
  const CROWN = { x: -11, y: -50, w: 22, d: 58, r: 2.4 };
  function pressColumn() {
    const out = [];
    const foot = { x: -15, y: -54, w: 30, d: 22, r: 2 };
    out.push(S(slab(foot, 0, 4, 3, 0.6), { tone: "mid" }));
    out.push(B.screwDots([[foot.x + 3, foot.y + foot.d - 3], [foot.x + foot.w - 3, foot.y + foot.d - 3]], 4, 0.45));
    out.push(S(slab(COLUMN, 4, POST_TOP - 4, 3, 0.6), { tone: "mid", inner: L([20, 44].map((z) => k.sideSeam(COLUMN, z, P, 3)).join(""), { tone: "faint" }) }));
    const rib = { x: -3, y: COLUMN.y + COLUMN.d, w: 6, d: 4, r: 0.6 };
    out.push(S(slab(rib, 4, POST_TOP - 4, 2, 0.4), { tone: "mid" }));
    return out.join("");
  }
  function pressHead() {
    const out = [];
    out.push(S(cyl(0, 0, 2, HEAD_Z + HEAD_H, 18, 18), { tone: "mid", crease: "none" }));
    for (const [x, y] of B.byDepth(LANES.map((y) => [0, y]))) out.push(S(cyl(x, y, 1.1, HEAD_Z - PIN_LEN, PIN_LEN, 14), { tone: "hi", crease: "none" }));
    out.push(S(slab(HEAD, HEAD_Z, HEAD_H, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(HEAD, HEAD_Z + 3, P, 3), { tone: "faint" }) }));
    out.push(L(k.planOutline(k.insetPlan(HEAD, 2.2), HEAD_Z + HEAD_H, P, 3), { tone: "faint" }));
    out.push(B.screwDots([[HEAD.x + 2.6, HEAD.y + 2.6], [HEAD.x + HEAD.w - 2.6, HEAD.y + HEAD.d - 2.6], [HEAD.x + HEAD.w - 2.6, HEAD.y + 2.6], [HEAD.x + 2.6, HEAD.y + HEAD.d - 2.6]], HEAD_Z + HEAD_H, 0.4));
    return `<g data-part="press">${out.join("")}</g>`;
  }
  function crown() {
    const out = [S(cyl(0, 0, 3.4, 68, 4, 20), { tone: "mid" })]; // gland under the crown
    const top = POST_TOP + CROWN_H;
    out.push(S(slab(CROWN, POST_TOP, CROWN_H, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(CROWN, POST_TOP + 3, P, 4), { tone: "faint" }) }));
    out.push(L(k.planOutline(k.insetPlan(CROWN, 2.4), top, P, 4), { tone: "faint" }));
    out.push(B.screwDots([[CROWN.x + 3.4, CROWN.y + 3.4], [CROWN.x + CROWN.w - 3.4, CROWN.y + 3.4], [CROWN.x + 3.4, -26], [CROWN.x + CROWN.w - 3.4, -26]], top, 0.5));
    out.push(S(cyl(0, 0, 6.4, top, 7, 32), { tone: "mid", inner: L(k.sideArc(0, 0, 6.4, top + 3, P, 24), { tone: "faint" }) }));
    out.push(S(cyl(0, 0, 3.4, top + 7, 3, 24), { tone: "mid" }));
    out.push(L(k.knurl(0, 0, 3.4, top + 7, top + 10, 16, P), { tone: "lo" }));
    out.push(L(k.ring(0, 0, 4.6, top + 7, P, 24), { tone: "faint" }));
    return out.join("");
  }

  // ------------------------------------------------------------- gates
  function column(x) {
    const out = [S(cyl(x, COL_Y, 5.6, 0, 3, 24), { tone: "mid" })];
    out.push(S(cyl(x, COL_Y, 3.5, 3, ARM_Z - 3, 24), { tone: "mid", crease: "none", inner: L([20, 40].map((z) => k.sideArc(x, COL_Y, 3.5, z, P, 16)).join(""), { tone: "faint" }) }));
    return out.join("");
  }
  const gheadPlan = (x) => ({ x: x - 6, y: -14.5, w: 12, d: 29, r: 1.4 });
  function gateHead(x, kind) {
    const out = [];
    const plan = gheadPlan(x);
    out.push(S(cyl(x, 0, 1.6, GHEAD_Z + GHEAD_H, 15, 16), { tone: "mid", crease: "none" }));
    const pins = B.byDepth(LANES.map((y, j) => [x, y, j]));
    if (kind === "load") {
      for (const [px, py] of pins) out.push(S(cyl(px, py, 1.1, GHEAD_Z - GPIN, GPIN, 14), { tone: "hi", crease: "none" }));
    } else {
      for (const [px, py, , j] of pins.map((p) => [p[0], p[1], 0, p[2]]))
        out.push(`<g data-feel="${j}">${S(cyl(px, py, 0.9, GHEAD_Z - GPIN, FEEL_LEN, 12), { tone: "hi", crease: "none" })}</g>`);
    }
    out.push(S(slab(plan, GHEAD_Z, GHEAD_H, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, GHEAD_Z + 3.4, P, 3), { tone: "faint" }) }));
    out.push(B.screwDots([[x - 3.6, -11.5], [x + 3.6, 11.5]], GHEAD_Z + GHEAD_H, 0.4));
    return `<g data-part="${kind}">${out.join("")}</g>`;
  }
  function arm(x) {
    const out = [S(cyl(x, 0, 2.6, GHEAD_Z + GHEAD_H + 1, ARM_Z - (GHEAD_Z + GHEAD_H + 1), 18), { tone: "mid" })]; // sleeve
    const plan = { x: x - 5, y: COL_Y - 5, w: 10, d: 46, r: 1.6 };
    out.push(S(slab(plan, ARM_Z, ARM_H, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, ARM_Z + 2, P, 3), { tone: "faint" }) }));
    out.push(L(k.ring(x, COL_Y, 2.2, ARM_Z + ARM_H, P, 16), { tone: "lo" }));
    out.push(B.screwDots([[x, COL_Y], [x, 0]], ARM_Z + ARM_H, 0.5));
    return out.join("");
  }

  // ----------------------------------------------------------- console
  const winX = (j) => WIN_X0 + j * (WIN_W + WIN_GAP);
  const faceText = (cx, z, text, size, part, tone = "hi") =>
    `<g data-part="${part}">${k.faceTextSvg(k.sideMatrix([cx, FACE_Y + 0.8], z, P, "left"), text, { size, tone, anchor: "middle" })}</g>`;
  function consoleBox() {
    const out = [S(slab(CON, 0, CON_H, 4, 0.8), { tone: "mid" })];
    out.push(L(k.planOutline(k.insetPlan(CON, 2.4), CON_H, P, 4), { tone: "faint" }));
    out.push(B.screwDots(k.corners(CON, 4.6), CON_H, 0.4));
    // the index counter: two digits
    const cw = { x: COUNTER.x, y: FACE_Y, w: COUNTER.w, d: 0.8, r: 0.3 };
    out.push(S(slab(cw, WIN_Z0, WIN_Z1 - WIN_Z0, 2), { tone: "lo", crease: "none" }));
    out.push(faceText(COUNTER.x + COUNTER.w / 2, 5.2, "00", 6.4, "counter"));
    // four lane windows: in above, out below
    for (let j = 0; j < 4; j++) {
      const x0 = winX(j);
      const w = { x: x0, y: FACE_Y, w: WIN_W, d: 0.8, r: 0.3 };
      out.push(S(slab(w, WIN_Z0, WIN_Z1 - WIN_Z0, 2), { tone: "lo", crease: "none" }));
      const mid = (WIN_Z0 + WIN_Z1) / 2;
      out.push(L(k.segment([x0, FACE_Y + 0.8, mid], [x0 + WIN_W, FACE_Y + 0.8, mid], P), { tone: "faint" }));
      out.push(faceText(x0 + WIN_W / 2, mid + 1.4, "", TEXT, `in-${j}`));
      out.push(faceText(x0 + WIN_W / 2, WIN_Z0 + 1.4, "", TEXT, `out-${j}`));
    }
    // top: the relation tag engraved, a knob and a pilot lamp
    out.push(k.faceTextSvg(k.topMatrix([-60, CON.y + 9.6], CON_H, P, "x"), `D 0x${chip.tag.toString(16)}`, { size: 3.2, tone: "lo" }));
    out.push(B.knob(70, CON.y + 8, 3.6, CON_H, 3, { angle: -0.5 }));
    out.push(B.lamp(56, CON.y + 8, CON_H, { r: 2.2 }));
    return out.join("");
  }

  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A pallet line on a bench. Pallets carrying four-slug cartridges come out of a housing on the left, pass a loading gate, stop one at a time under a press, pass a checking gate and go into a housing on the right. Each pallet's key slides into the next pallet's socket. A console in front shows the round and the four lanes' input and output values.",
    body: [
      `<defs><clipPath id="chip-chain"><path d="${polyD(clipPts)}"/></clipPath>${LANES.map((_, j) => holeClip(j)).join("")}</defs>`,
      base(),
      housing(-XE - HOUSE_W, { opening: true }),
      column(GATE.load),
      pressColumn(),
      column(GATE.unload),
      beams(),
      chain,
      gateHead(GATE.load, "load"),
      arm(GATE.load),
      pressHead(),
      crown(),
      gateHead(GATE.unload, "unload"),
      arm(GATE.unload),
      housing(XE, { opening: false }),
      consoleBox(),
    ],
  });

  // ------------------------------------------------------------ live
  const rows = TEACH.map((r) => ({
    in: r.in,
    out: r.out,
    hin: r.in.map((v) => +heightOf(v).toFixed(3)),
    hout: r.out.map((v) => +heightOf(v).toFixed(3)),
    wraps: r.in.map((v) => BigInt(v) * BigInt(v) + 7n >= BigInt(P31)),
  }));
  const real = { rounds: chip.rounds };

  const live = `function (root, bus, chapter) {
${LIVE_HELPERS}
const P = ${JSON.stringify(P)};
const ROWS = ${JSON.stringify(rows)};
const N = ROWS.length, LAST = N + 1;
const PITCH = ${PITCH}, RETRACT = ${RETRACT}, HMAX = ${HMAX}, ZC = ${ZC};
const STROKE = ${STROKE}, LOAD_STROKE = ${+LOAD_STROKE.toFixed(3)}, FEEL_STROKE = ${FEEL_STROKE};
const PIN_TIP = ${GHEAD_Z - GPIN};
const REAL_ROUNDS = ${real.rounds};
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const chainEl = q('[data-part="chain"]');
const fadeEl = q('[data-part="chain-fade"]');
const items = [...svg.querySelectorAll("[data-pallet]")];
const byPallet = Array.from({ length: N }, () => []);
items.forEach((el) => byPallet[+el.dataset.pallet].push(el));
const keys = Array.from({ length: N }, (_, i) => byPallet[i].find((el) => el.dataset.p === "tongue").querySelector("[data-key]"));
const bodies = Array.from({ length: N }, (_, i) => byPallet[i].find((el) => el.dataset.p === "body"));
const slugs = bodies.map((b) => [...b.querySelectorAll("[data-slug]")]);
const litParts = bodies.map((b) => [b.querySelector("[data-cart] .iso-solid")]);
const press = q('[data-part="press"]');
const load = q('[data-part="load"]');
const unload = q('[data-part="unload"]');
const feelers = [...svg.querySelectorAll("[data-feel]")].sort((a, b) => a.dataset.feel - b.dataset.feel);
const counter = q('[data-part="counter"] text');
const inText = [0, 1, 2, 3].map((j) => q('[data-part="in-' + j + '"] text'));
const outText = [0, 1, 2, 3].map((j) => q('[data-part="out-' + j + '"] text'));
const readout = root.querySelector("[data-readout]");
const ease = (u) => u * u * (3 - 2 * u);
const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = (n) => String(n);
// Steps: 0 = load gate, 1..N = rounds 0..N-1, N+1 = check gate.
const DWELL = (k) => (k === 0 ? 2.4 : k === LAST ? 2.8 : 1.9);
const at = (k) => (k === 0 ? -1 : k - 1);
const from = (k) => (k === 0 ? -2.6 : at(k - 1));
const roundOf = (k) => (k === 0 ? 0 : k === LAST ? N - 1 : k - 1);
function slugH(i, j, k, u) {
  const r = ROWS[i];
  const recv = i === 0 ? 0 : i;
  if (k < recv) return 0;
  let h = r.hin[j];
  if (k === recv) {
    if (i === 0) {
      const b = seg(u, 0.38, 0.7);
      const tip = PIN_TIP - LOAD_STROKE * Math.sin(Math.PI * b);
      h = b < 0.5 ? 0 : Math.min(r.hin[j], Math.max(0, tip - ZC));
    } else h = lerp(0, r.hin[j], ease(seg(u, 0.7, 0.82)));
  }
  if (k === i + 1) h = lerp(r.hin[j], r.hout[j], ease(seg(u, 0.44, 0.54)));
  if (k > i + 1) h = r.hout[j];
  return h;
}
function keyAt(i, k, u) {
  if (i >= N - 1) return 0;
  if (k < i + 1) return 0;
  if (k === i + 1) return ease(seg(u, 0.62, 0.74));
  return 1;
}
const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
let litNow = -1;
function apply(k, u) {
  const s = lerp(from(k), at(k), ease(seg(u, 0.02, k === 0 ? 0.36 : 0.32)));
  chainEl.setAttribute("transform", translateAlong(P, [s * PITCH, 0, 0]));
  fadeEl.style.opacity = k === LAST ? String(1 - ease(seg(u, 0.88, 1))) : "";
  for (let i = 0; i < N; i++) {
    const x = (s - i) * PITCH;
    const show = x > -142 && x < 137;
    byPallet[i].forEach((el) => (el.style.display = show ? "" : "none"));
    if (!show) continue;
    slugs[i].forEach((el, j) => el.setAttribute("transform", translateAlong(P, [0, 0, slugH(i, j, k, u) - HMAX])));
    keys[i].setAttribute("transform", translateAlong(P, [RETRACT * (1 - keyAt(i, k, u)), 0, 0]));
  }
  const active = k === 0 ? 0 : k === LAST ? N - 1 : k - 1;
  if (active !== litNow) {
    if (litNow >= 0) litParts[litNow].forEach((el) => el && el.removeAttribute("data-lit"));
    litParts[active].forEach((el) => el && el.setAttribute("data-lit", ""));
    litNow = active;
  }
  // tools
  const pz = k >= 1 && k <= N ? -STROKE * Math.sin(Math.PI * seg(u, 0.34, 0.62)) : 0;
  press.setAttribute("transform", translateAlong(P, [0, 0, pz]));
  const lz = k === 0 ? -LOAD_STROKE * Math.sin(Math.PI * seg(u, 0.38, 0.7)) : 0;
  load.setAttribute("transform", translateAlong(P, [0, 0, lz]));
  let uz = 0;
  const reach = [0, 0, 0, 0];
  if (k === LAST) {
    const down = ease(seg(u, 0.34, 0.46)) * (1 - ease(seg(u, 0.72, 0.84)));
    const feel = ease(seg(u, 0.44, 0.58)) * (1 - ease(seg(u, 0.66, 0.76)));
    uz = -FEEL_STROKE * down;
    const tip = PIN_TIP - FEEL_STROKE;
    for (let j = 0; j < 4; j++) reach[j] = (tip - (ZC + ROWS[N - 1].hout[j])) * feel;
  }
  unload.setAttribute("transform", translateAlong(P, [0, 0, uz]));
  feelers.forEach((el, j) => el.setAttribute("transform", translateAlong(P, [0, 0, -reach[j]])));
  // displays
  const r = roundOf(k), row = ROWS[r];
  setText(counter, String(r).padStart(2, "0"));
  const showIn = k !== 0 || u >= 0.6;
  const showOut = (k >= 1 && k <= N && u >= 0.48) || k === LAST;
  for (let j = 0; j < 4; j++) {
    setText(inText[j], showIn ? fmt(row.in[j]) : "");
    setText(outText[j], showOut ? fmt(row.out[j]) : "");
  }
  let text;
  if (k === 0) text = showIn ? "load · round 0 in ← public x = " + row.in.join(", ") : "load · pallet 0 to the x gate";
  else if (k === LAST) text = "check · round " + (N - 1) + " out = y · real: " + REAL_ROUNDS + " rounds";
  else if (!showOut) text = "round " + r + " · in " + row.in.join(", ") + " · pressing";
  else {
    const full = "round " + r + " · in " + row.in.join(", ") + " → out " + row.out.join(", ");
    text = full.length <= 52 ? full : "round " + r + " · lane 0 · " + row.in[0] + "² + 7 " + (row.wraps[0] ? "≡ " : "= ") + row.out[0];
  }
  setText(readout, text);
  return r;
}
let step = 0, t = 0, touring = true, held = false, lastRef = "", resume = 0;
const U_REST = 0.8;
function tell(k, u) {
  const r = apply(k, u);
  const ref = "round:" + r;
  if (ref !== lastRef) { lastRef = ref; bus.emit("focus", { chapter, refs: [ref] }); }
}
const run = loop(root, (dt, calm) => {
  if (!touring || calm) return false;
  t += dt / DWELL(step);
  if (t >= 1) { t = 0; step = (step + 1) % (LAST + 1); }
  tell(step, t);
  return true;
});
// Interaction pauses the tour; it picks up again a few seconds later unless a click holds it.
function pause() {
  touring = false;
  clearTimeout(resume);
  if (!held && !stillQuery.matches) resume = setTimeout(() => { touring = true; run(); }, 5000);
}
function jump(k) {
  pause();
  step = (k + LAST + 1) % (LAST + 1); t = U_REST;
  tell(step, U_REST);
}
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") jump(step + 1);
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") jump(step - 1);
  else if (e.key === "Home") jump(0);
  else if (e.key === "End") jump(LAST);
  else return;
  e.preventDefault();
});
stage.addEventListener("click", () => { held = !held; if (held) pause(); else { clearTimeout(resume); if (!stillQuery.matches) { touring = true; run(); } } });
bus.on("pick", ({ chapter: c, ref }) => {
  if (c !== chapter) return;
  const [kind, value] = String(ref).split(":");
  const n = Number(value);
  if (kind === "round" && n >= 0 && n < N) jump(n + 1);
});
if (stillQuery.matches) { touring = false; step = 2; t = U_REST; }
tell(step, stillQuery.matches ? U_REST : 0);
stillQuery.addEventListener?.("change", () => { if (stillQuery.matches) { touring = false; tell(step, U_REST); } else if (!held) { touring = true; run(); } });
run();
}`;

  const first = TEACH[1];
  return {
    id: "fig-chip",
    fig: "Fig 5",
    title: "Pallet press",
    hint: "← → step rounds · click to pause",
    readout: `round 1 · in ${first.in.join(", ")} → out ${first.out.join(", ")}`,
    stage: { role: "group", "aria-label": "Pallet press: arrow keys step through the loading gate, the 16 rounds and the checking gate" },
    keys: [
      { mark: "lit", label: "Pallet under the press: the current row of the chip's trace" },
      { mark: "raised", label: "Four slugs per cartridge: the four lanes; height grows with each value's bit length" },
      { mark: "edge", label: "Key into the next pallet's socket: the LogUp link from row i's output to row i+1's input" },
    ],
    caption: `The drawn run is the ${ROUNDS}-round teaching instance with x = [${TEACH[0].in.join(", ")}]: one pallet per row, the press applying out[j] = in[j]² + 7 (mod p) to all four lanes at once, and each pallet's output key mating with the next pallet's input socket, the way the chip's two LogUp constraints link (D, index+1, out) to (D, index, in) under tag D = 0x${chip.tag.toString(16)}. The real build proves ${chip.rounds} rounds for x = [${chip.x.map(fmt).join(", ")}] with the same ${chip.columns.length} columns and ${chip.constraints} constraints, in a ${fmt(chip.trial?.proof_bytes ?? MODEL.stark.proofBytes)}-byte proof.`,
    svg,
    live,
  };
}
