// Fig 3 · Gates become rows of an AIR trace table: a tabulating machine.
// A pinned drum carries the fixed (preprocessed) columns: one row per index
// position, eight tracks (four opcode flags, three addresses and the output
// multiplicity as small binary pin groups). Feelers read the row on top of the
// drum. A reading carriage steps along a witness sheet (the main columns) and
// shows the row's lane-2 values A₂, B₂, C₂ on three number-wheel windows. A
// dial gauge reads the row's constraint residual: it rests on zero when the row
// holds. The forge lever adds 1 to C and the needle leaves zero.
import { k, bench, LIVE_HELPERS } from "./parts.mjs";
import * as G from "../../vendor/anatomy/kit/lathe.mjs";
import MODEL, { add as fadd } from "../model/s31.mjs";

const WIDTH = 600;
const AZ = 56;
const HEIGHT = 380;

const ROWS = MODEL.poly.rows;
const LANE = 2;
const FLAGS = MODEL.poly.flags; // add, sub, mul, pointwise_mul
const FIXED = MODEL.poly.columns.preprocessed;
const MAIN = MODEL.poly.columns.main;
const RAW = MODEL.stark.rawRows;
const PADDED = MODEL.stark.paddedRows;

// ------------------------------------------------------------ pin encoding
// Tracks in the order of the preprocessed columns: 4 flags (one pin), 3
// addresses and mults (binary pin groups wide enough for the largest value).
const bitsFor = (max) => Math.max(1, Math.ceil(Math.log2(max + 1)));
const ADDR_BITS = bitsFor(Math.max(...ROWS.flatMap((r) => [r.address.in0, r.address.in1, r.address.out])));
const MULT_BITS = bitsFor(Math.max(...ROWS.map((r) => r.mult)));
const TRACKS = [...FLAGS.map(() => 1), ADDR_BITS, ADDR_BITS, ADDR_BITS, MULT_BITS];
if (TRACKS.length !== FIXED.length) throw new Error("fig-tabulator: track count does not match the preprocessed columns");
const bits = (v, n) => Array.from({ length: n }, (_, i) => (v >> (n - 1 - i)) & 1);
const pinsOf = (r) => [...r.flags, ...bits(r.address.in0, ADDR_BITS), ...bits(r.address.in1, ADDR_BITS), ...bits(r.address.out, ADDR_BITS), ...bits(r.mult, MULT_BITS)];
const PINS = ROWS.map(pinsOf);

// ------------------------------------------------------------ world layout
const PLATE = { x: -156, y: -66, w: 304, d: 156, r: 8 };
const YD = -38, ZC = 32; // drum axis
const DR = 16, FR = 19; // drum and flange radius
const DX0 = -118, DX1 = 8; // drum ends (flange faces)
const FL = 3; // flange thickness
const PIN_LEN = 2.6;
const N_POS = 16; // index positions round the drum (rows per turn)
const STEP = (Math.PI * 2) / N_POS;
const ZT = ZC + DR + 11; // underside of the feeler comb bar
const FINGER_REST = ZC + DR + 0.9;
const FINGER_LIFT = DR + PIN_LEN + 0.3 - (DR + 0.9);
const STD_L = { x: -128, y: YD - 12, w: 6, d: 24, r: 1.2 };
const STD_R = { x: 10, y: YD - 12, w: 6, d: 24, r: 1.2 };
const WHEEL = { x0: -137, x1: -131, r: 15 };
const GEAR = { x: 22, y: -50, w: 18, d: 24, r: 2 };
const GEAR_H = 42;
const SCREW = { x: 31, z: 15, r: 2.2, y0: GEAR.y + GEAR.d, y1: 66 };
const BED = { x: -112, y: -14, w: 118, d: 80, r: 2 };
const BED_Z = 8, BED_TOP = 11;
const SHEET = { x: -106, y: -11, w: 106, d: 70, r: 0.6 };
const SHEET_TOP = BED_TOP + 0.3;
const ROW0 = -4, PITCH = 7;
const rowY = (i) => ROW0 + i * PITCH;
const RAIL_L = { x: -122, y: -24, w: 5, d: 90, r: 1 };
const RAIL_R = { x: 9, y: -24, w: 5, d: 90, r: 1 };
const RAIL_Z = 12;
const ROLL = { y: 59, z: SHEET_TOP + 5, r: 5, x0: -106, x1: 0 };
const GX = 82, GY = -30, GR = 22, GZ = 24, GH = 8; // dial gauge
const CON = { x: 62, y: 18, w: 66, d: 46, r: 3 };
const CON_H = 12;

// Carriage, built at row 0's y = 0 (moved by rowY(i)).
const BRIDGE = { x: -125, y: -15, w: 142, d: 9, r: 1.2 };
const BR_Z = 18, BR_H = 11;
const FACE_Y = BRIDGE.y + BRIDGE.d; // the bridge's front face
const NUT = { x: 26, y: -12, w: 10, d: 8, r: 1.2 };
const NUT_Z = 9, NUT_H = 12;

// Pin columns along the drum, grouped by track with a gap between tracks.
const COL_X = [];
const TRACK_OF = [];
{
  const pitch = 4.2, gap = 2.8;
  const span = (TRACKS.reduce((a, b) => a + b, 0) - 1) * pitch + (TRACKS.length - 1) * gap;
  let x = (DX0 + DX1) / 2 - span / 2;
  TRACKS.forEach((n, t) => {
    for (let i = 0; i < n; i++) {
      COL_X.push(+x.toFixed(2));
      TRACK_OF.push(t);
      if (i < n - 1) x += pitch;
    }
    x += pitch + gap;
  });
}
const GROOVES = TRACKS.slice(0, -1).map((_, t) => {
  const last = TRACK_OF.lastIndexOf(t);
  return (COL_X[last] + COL_X[last + 1]) / 2;
});

// Witness values the ledger shows: lane 2 of A, B, C; forge adds 1 to C.
const LEDGER = ROWS.map((r) => {
  const Cf = r.C.map((c) => fadd(c, 1));
  return {
    row: r.row,
    opcode: r.opcode,
    A: r.A[LANE],
    B: r.B[LANE],
    C: r.C[LANE],
    Cf: Cf[LANE],
    res: r.residual[LANE],
    resF: r.residualIf(Cf)[LANE],
  };
});
const WHEEL_DIGITS = 10;
if (LEDGER.some((r) => String(Math.max(r.A, r.B, r.C, r.Cf)).length > WHEEL_DIGITS)) throw new Error("fig-tabulator: a value does not fit the number wheels");

export default function figure() {
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -17, 0), [DX0, YD, ZT + 6], [DX1, YD, ZT + 6], [GX, GY, GZ + GH + 2]],
    WIDTH,
    HEIGHT,
    { pad: 20, azimuth: AZ },
  );
  const B = bench(P);
  const { S, L, D, at } = B;
  const V = G.viewOf(P);
  const AX = [1, 0, 0], AY = [0, 1, 0];
  const drumF = G.frameOf([DX0, YD, ZC], AX, [0, 0, 1], [0, 1, 0]);

  // ------------------------------------------------------------ base
  function base() {
    const out = [B.plate(PLATE)];
    out.push(B.ruler({ x: PLATE.x + 26, y: PLATE.y + PLATE.d - 14, w: 120, d: 7, r: 1 }));
    out.push(B.labelPlate({ x: PLATE.x + 154, y: PLATE.y + PLATE.d - 18, w: 36, d: 12, r: 1.2 }));
    return out.join("");
  }

  // ------------------------------------------------------------ drum
  function standard(plan, { boss = false } = {}) {
    const out = [S(k.slabOf(plan, 0, ZT, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, 6, P, 3), { tone: "faint" }) })];
    out.push(S(k.slabOf({ x: plan.x - 3, y: plan.y - 3, w: plan.w + 6, d: plan.d + 6, r: 1.6 }, 0, 3, P, 3, 0.4), { tone: "lo" }));
    out.push(B.screwDots([[plan.x + plan.w / 2, plan.y + 4], [plan.x + plan.w / 2, plan.y + plan.d - 4]], ZT, 0.4));
    if (boss) {
      const F = G.frameAlong([plan.x + plan.w, YD, ZC], AX);
      out.push(S(G.disc(0, 2, 7, F, P), { tone: "mid" }));
      out.push(D(G.dotsOf(F, 2, 5, 6, P, { all: true }), { size: 0.4 }));
      out.push(L(G.circleOf(F, 2, 2.6, P), { tone: "lo" }));
    }
    return out.join("");
  }
  function indexWheel() {
    const F = G.frameAlong([0, YD, ZC], AX);
    const out = [];
    out.push(S(G.disc(WHEEL.x1, STD_L.x, 3, F, P), { tone: "mid" }));
    out.push(S(G.disc(WHEEL.x0, WHEEL.x1, WHEEL.r, F, P), { tone: "mid" }));
    out.push(`<g data-part="notches"></g>`);
    out.push(L(G.circleOf(F, WHEEL.x1, 4, P), { tone: "lo" }));
    return out.join("");
  }
  // The detent pawl: pivots on a pin in the standard and drops into a notch.
  function pawl() {
    const F = G.frameOf([0, 0, 0], AX, [0, 1, 0], [0, 0, 1]);
    const piv = [YD - 12, ZC + 12];
    const tip = [YD - 3, ZC + WHEEL.r + 0.2];
    const poly = [
      [piv[0] - 2.2, piv[1] - 1.6],
      [piv[0] + 1, piv[1] - 2.4],
      [tip[0] + 1, tip[1] - 0.6],
      [tip[0] + 1.2, tip[1] + 1.4],
      [piv[0] - 1, piv[1] + 2.2],
    ];
    const out = [S(G.prismOf(F, poly, WHEEL.x0 + 1, WHEEL.x1 - 1, P), { tone: "mid" })];
    const pinF = G.frameAlong([0, piv[0], piv[1]], AX);
    out.push(S(G.disc(WHEEL.x0, STD_L.x, 1.2, pinF, P), { tone: "mid" }));
    return out.join("");
  }
  function drumBody() {
    // the far flange and the shaft stub through the left standard, then the body
    const out = [S(G.disc(STD_L.x + STD_L.w - DX0, 0, 3.2, drumF, P), { tone: "mid" })];
    out.push(S(G.disc(0, FL, FR, drumF, P), { tone: "hi", crease: "lo" }));
    const grooves = GROOVES.map((x) => G.arcOf(drumF, x - DX0, DR, P)).join("");
    out.push(S(G.disc(FL, DX1 - DX0 - FL, DR, drumF, P), { tone: "hi", crease: "lo", inner: L(grooves, { tone: "faint" }) }));
    return out.join("");
  }
  function drumNear() {
    const out = [S(G.disc(DX1 - DX0 - FL, DX1 - DX0, FR, drumF, P), { tone: "hi", crease: "lo" })];
    out.push(S(G.disc(DX1 - DX0, STD_R.x - DX0, 3.2, drumF, P), { tone: "mid" }));
    out.push(D(G.dotsOf(drumF, DX1 - DX0, FR - 2.6, 8, P, { all: true }), { size: 0.4 }));
    return out.join("");
  }
  // Sockets and pins are drawn by the page (they turn with the drum).
  function pinLayer() {
    const sockets = [];
    for (let j = 0; j < N_POS; j++) for (let c = 0; c < COL_X.length; c++) sockets.push(`<circle data-s="${j},${c}" r="0.42" cx="0" cy="0"/>`);
    const pins = [];
    PINS.forEach((row, j) => row.forEach((b, c) => b && pins.push(`<g data-p="${j},${c}"><path class="iso-line" data-tone="hi" d="M0 0"/><circle class="pin-head" r="0.7"/></g>`)));
    return `<g data-part="sockets" class="iso-dots" data-tone="lo">${sockets.join("")}</g><g data-part="pins" class="tab-pins">${pins.join("")}</g>`;
  }
  function fingers() {
    return COL_X.map((x, c) => {
      const plan = { x: x - 1.1, y: YD - 1.6, w: 2.2, d: 3.2, r: 0.4 };
      const body = S(k.slabOf(plan, FINGER_REST, ZT + 1 - FINGER_REST, P, 2, 0), { tone: "mid", crease: "none" });
      const shoe = S(k.slabOf({ x: x - 1.3, y: YD - 1.9, w: 2.6, d: 3.8, r: 0.5 }, FINGER_REST, 1.4, P, 2, 0), { tone: "mid" });
      return `<g data-finger="${c}">${body}${shoe}</g>`;
    }).join("");
  }
  function combBar() {
    const plan = { x: STD_L.x - 2, y: YD - 5, w: STD_R.x + STD_R.w - STD_L.x + 4, d: 10, r: 1.6 };
    const out = [S(k.slabOf(plan, ZT, 5, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, ZT + 1.6, P, 3), { tone: "faint" }) })];
    out.push(B.screwDots([[plan.x + 4, YD], [plan.x + plan.w - 4, YD]], ZT + 5, 0.5));
    // a guide strip on top with one slot per feeler
    const strip = { x: COL_X[0] - 3, y: YD - 2.4, w: COL_X.at(-1) - COL_X[0] + 6, d: 4.8, r: 1 };
    out.push(S(k.slabOf(strip, ZT + 5, 0.8, P, 3), { tone: "lo", crease: "none" }));
    out.push(L(COL_X.map((x) => k.planOutline({ x: x - 0.7, y: YD - 1.4, w: 1.4, d: 2.8, r: 0.5 }, ZT + 5.8, P, 2)).join(""), { tone: "lo" }));
    return out.join("");
  }
  function gearbox() {
    const out = [];
    const F = G.frameAlong([STD_R.x + STD_R.w, YD, ZC], AX);
    out.push(S(G.disc(2, 6, 3, F, P), { tone: "mid" }));
    out.push(S(G.disc(2.6, 4.6, 4.6, F, P), { tone: "mid" }));
    out.push(S(k.slabOf(GEAR, 0, GEAR_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(GEAR, GEAR_H - 6, P, 3), { tone: "faint" }) }));
    out.push(L(k.planOutline(k.insetPlan(GEAR, 2.4), GEAR_H, P, 3), { tone: "faint" }));
    out.push(B.screwDots(k.corners(GEAR, 2.6), GEAR_H, 0.45));
    // inspection cover on the near (+y) face
    const cover = { x: GEAR.x + 3, y: GEAR.y + GEAR.d, w: GEAR.w - 6, d: 0.8, r: 0.3 };
    out.push(S(k.slabOf(cover, 22, 14, P, 2, 0.2), { tone: "mid" }));
    out.push(D([[cover.x + 1.6, 34.4], [cover.x + cover.w - 1.6, 34.4], [cover.x + 1.6, 23.6], [cover.x + cover.w - 1.6, 23.6]].map(([x, z]) => at([x, cover.y + cover.d, z])), { size: 0.4 }));
    // bearing boss where the lead screw leaves (+y face)
    const sF = G.frameAlong([SCREW.x, SCREW.y0, SCREW.z], AY);
    out.push(S(G.disc(0, 2, 5, sF, P), { tone: "mid" }));
    out.push(D(G.dotsOf(sF, 2, 3.8, 6, P, { all: true }), { size: 0.35 }));
    // a breather cap on the lid
    out.push(S(k.cylinder(GEAR.x + GEAR.w / 2, GEAR.y + GEAR.d / 2, 3, GEAR_H, 2, P, 24), { tone: "mid" }));
    out.push(L(k.knurl(GEAR.x + GEAR.w / 2, GEAR.y + GEAR.d / 2, 3, GEAR_H, GEAR_H + 2, 16, P), { tone: "lo" }));
    return out.join("");
  }

  // ------------------------------------------------------------ gauge
  const ZERO = -(Math.PI / 2 - (AZ * Math.PI) / 180); // dial angle that points up the screen
  const GTOP = GZ + GH;
  function gauge() {
    const out = [];
    const baseP = { x: GX - 15, y: GY - 15, w: 30, d: 30, r: 3 };
    out.push(S(k.slabOf(baseP, 0, 4, P, 4, 0.6), { tone: "mid" }));
    out.push(B.screwDots(k.corners(baseP, 3.4), 4, 0.45));
    out.push(S(k.cylinder(GX, GY, 6, 4, 3, P, 32), { tone: "mid" }));
    out.push(S(k.cylinder(GX, GY, 4, 7, GZ - 7, P, 28), { tone: "mid", crease: "none" }));
    out.push(L([12, 17].map((z) => k.sideArc(GX, GY, 4, z, P, 18)).join(""), { tone: "faint" }));
    // crown on the far side
    out.push(S(k.slabOf({ x: GX - 2, y: GY - GR - 3, w: 4, d: 3.4, r: 0.6 }, GZ + 2.4, 3.2, P, 2), { tone: "mid" }));
    out.push(S(k.cylinder(GX, GY - GR - 4.4, 2.6, GZ + 1.6, 4.8, P, 20), { tone: "mid" }));
    out.push(S(k.cylinder(GX, GY, GR, GZ, GH, P, 72, 0.8), { tone: "hi", crease: "lo", inner: L(k.sideArc(GX, GY, GR, GTOP - 3.4, P, 48), { tone: "faint" }) }));
    out.push(L(k.knurl(GX, GY, GR, GTOP - 3.4, GTOP, 84, P, 0.3), { tone: "lo" }));
    out.push(L(k.ring(GX, GY, GR - 2.2, GTOP, P, 72), { tone: "lo" }));
    const t = k.radialTicks(GX, GY, GR - 2.2, 30, 5, GTOP, [1.3, 2.8], P, ZERO);
    out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
    const zx = Math.sin(ZERO), zy = -Math.cos(ZERO);
    out.push(L(k.lineOnTop([GX + zx * (GR - 2.2), GY + zy * (GR - 2.2)], [GX + zx * (GR - 6.4), GY + zy * (GR - 6.4)], GTOP, P), { tone: "hi" }));
    out.push(L(k.ring(GX, GY, GR - 9, GTOP, P, 48), { tone: "faint" }));
    out.push(`<path data-part="needle" class="iso-line" data-tone="lit" style="stroke-width:1.1" data-free="" d=""/>`);
    out.push(L(k.ring(GX, GY, 1.6, GTOP, P, 16), { tone: "mid" }));
    out.push(D([at([GX, GY, GTOP])], { size: 0.6, tone: "hi" }));
    return out.join("");
  }

  // ------------------------------------------------------------ ledger
  function bed() {
    const out = [];
    for (const y of [BED.y + 4, BED.y + BED.d - 12]) {
      const ped = { x: BED.x + 6, y, w: BED.w - 12, d: 8, r: 1 };
      out.push(S(k.slabOf(ped, 0, BED_Z, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(ped, 2.4, P, 3), { tone: "faint" }) }));
    }
    out.push(S(k.slabOf(BED, BED_Z, BED_TOP - BED_Z, P, 4, 0.5), { tone: "mid" }));
    return out.join("");
  }
  function rail(plan) {
    const out = [S(k.slabOf(plan, 0, RAIL_Z - 2, P, 3, 0.4), { tone: "mid" })];
    const top = { x: plan.x + 1, y: plan.y, w: plan.w - 2, d: plan.d, r: 0.6 };
    out.push(S(k.slabOf(top, RAIL_Z - 2, 2, P, 2, 0.3), { tone: "mid" }));
    out.push(B.screwDots([[plan.x + plan.w / 2, plan.y + 4], [plan.x + plan.w / 2, plan.y + plan.d / 2], [plan.x + plan.w / 2, plan.y + plan.d - 4]], RAIL_Z, 0.4));
    for (const y of [plan.y, plan.y + plan.d - 3]) out.push(S(k.slabOf({ x: plan.x - 1, y, w: plan.w + 2, d: 3, r: 0.6 }, RAIL_Z, 3, P, 2, 0.3), { tone: "mid" }));
    return out.join("");
  }
  // The witness sheet: ruled rows run on into the roll (the table goes on);
  // the six gate rows carry printed values, one rule per value, as long as its digits.
  const CELL = SHEET.w / 12;
  function sheet() {
    const out = [S(k.slabOf(SHEET, BED_TOP, 0.3, P, 2), { tone: "hi", flat: true })];
    const ruled = [];
    for (let y = ROW0 + PITCH / 2 - PITCH; y < ROLL.y - 1; y += PITCH) if (y > SHEET.y + 0.5) ruled.push(k.lineOnTop([SHEET.x, y], [SHEET.x + SHEET.w, y], SHEET_TOP, P));
    out.push(L(ruled.join(""), { tone: "faint" }));
    const groups = [1, 2].map((g) => k.lineOnTop([SHEET.x + g * 4 * CELL, SHEET.y], [SHEET.x + g * 4 * CELL, ROLL.y], SHEET_TOP, P)).join("");
    out.push(L(groups, { tone: "lo" }));
    const rules = [];
    ROWS.forEach((r, i) => {
      const vals = [...r.A, ...r.B, ...r.C];
      vals.forEach((v, c) => {
        const x0 = SHEET.x + c * CELL + 1.2;
        const len = (String(v).length / WHEEL_DIGITS) * (CELL - 2.4);
        rules.push(k.lineOnTop([x0, rowY(i)], [x0 + Math.max(0.9, len), rowY(i)], SHEET_TOP, P));
      });
    });
    out.push(L(rules.join(""), { tone: "mid", free: true }));
    return out.join("");
  }
  function screwPaths() {
    const F = G.frameAlong([SCREW.x, 0, SCREW.z], AY);
    const threads = [];
    for (let s = SCREW.y0 + 1.4; s < SCREW.y1 - 0.6; s += 1.6) threads.push(G.arcOf(F, s, SCREW.r, P));
    return S(G.disc(SCREW.y0, SCREW.y1, SCREW.r, F, P), { tone: "mid", inner: L(threads.join(""), { tone: "lo" }) });
  }
  function endBearing() {
    const plan = { x: SCREW.x - 6, y: SCREW.y1, w: 12, d: 6, r: 1.2 };
    const out = [S(k.slabOf(plan, 0, SCREW.z + 6, P, 3, 0.5), { tone: "mid" })];
    out.push(B.screwDots([[plan.x + 2.6, plan.y + 3], [plan.x + plan.w - 2.6, plan.y + 3]], SCREW.z + 6, 0.4));
    // the crank on the near end of the screw
    const F = G.frameAlong([SCREW.x, SCREW.y1 + plan.d, SCREW.z], AY);
    out.push(S(G.disc(0, 2.4, 3.2, F, P), { tone: "mid" }));
    out.push(L(G.circleOf(F, 2.4, 1.4, P), { tone: "lo" }));
    return out.join("");
  }

  // ------------------------------------------------------------ carriage
  // Number-wheel windows on the bridge's front face: A₂, B₂, C₂, ten wheels each.
  const WIN_W = 32, WIN_H = 7, WIN_Z = BR_Z + BR_H - 2;
  const WIN_X = [-110, -64, -18];
  const DIGIT = WIN_W / WHEEL_DIGITS;
  function windows() {
    return WIN_X.map((wx, w) => {
      const M = k.sideMatrix([wx, FACE_Y], WIN_Z, P, "left");
      const rect = (x, y, ww, hh) => `M${x} ${y}H${x + ww}V${y + hh}H${x}Z`;
      const dividers = Array.from({ length: WHEEL_DIGITS - 1 }, (_, i) => `M${((i + 1) * DIGIT).toFixed(2)} 0V${WIN_H}`).join("");
      const digits = Array.from({ length: WHEEL_DIGITS }, (_, i) => `<text class="iso-face-text" data-tone="hi" data-w="${w}" x="${((i + 0.5) * DIGIT).toFixed(2)}" y="${(WIN_H / 2 + 1.55).toFixed(2)}" font-size="4.3" text-anchor="middle">0</text>`).join("");
      return `<g transform="${M}"><path class="iso-line" data-tone="faint" d="${rect(-1, -1, WIN_W + 2, WIN_H + 2)}"/><path class="iso-shade" data-shade="0" d="${rect(0, 0, WIN_W, WIN_H)}"/><path class="iso-line" data-tone="faint" d="${dividers}"/>${digits}<path class="iso-line" data-tone="lo" d="${rect(0, 0, WIN_W, WIN_H)}"/></g>`;
    }).join("");
  }
  function carriage() {
    const out = [];
    for (const x of [RAIL_L.x - 2, RAIL_R.x - 2]) {
      const truck = { x, y: -16, w: 9, d: 12, r: 1.2 };
      out.push(S(k.slabOf(truck, RAIL_Z, BR_Z - RAIL_Z, P, 3, 0.4), { tone: "mid" }));
    }
    out.push(S(k.slabOf(BRIDGE, BR_Z, BR_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(BRIDGE, BR_Z + 2.4, P, 3), { tone: "faint" }) }));
    out.push(B.screwDots([[BRIDGE.x + 4.5, BRIDGE.y + 4.5], [BRIDGE.x + BRIDGE.w - 4.5, BRIDGE.y + 4.5], [-41, BRIDGE.y + 4.5]], BR_Z + BR_H, 0.45));
    out.push(windows());
    // the reading straightedge: rides just above the sheet, its front edge on the row
    const edge = { x: SHEET.x - 2, y: FACE_Y - 2, w: SHEET.w + 4, d: 2 - FACE_Y - 0.6, r: 0.4 };
    out.push(S(k.slabOf(edge, SHEET_TOP + 0.6, 1, P, 2, 0.3), { tone: "hi" }));
    for (const x of [SHEET.x - 1, SHEET.x + SHEET.w + 1]) out.push(S(k.slabOf({ x: x - 1, y: FACE_Y - 3, w: 2, d: 3, r: 0.4 }, SHEET_TOP + 1.6, BR_Z - SHEET_TOP - 1.6, P, 2), { tone: "mid" }));
    // arm from the right truck to the screw nut
    out.push(S(k.slabOf({ x: RAIL_R.x + 7, y: -12.5, w: NUT.x - RAIL_R.x - 7, d: 5, r: 0.6 }, 13, 4, P, 2, 0.3), { tone: "mid" }));
    out.push(S(k.slabOf(NUT, NUT_Z, NUT_H, P, 3, 0.5), { tone: "mid" }));
    out.push(B.screwDots([[NUT.x + 2.4, NUT.y + 2.4], [NUT.x + NUT.w - 2.4, NUT.y + NUT.d - 2.4]], NUT_Z + NUT_H, 0.4));
    const sF = G.frameAlong([SCREW.x, NUT.y + NUT.d, SCREW.z], AY);
    out.push(L(G.circleOf(sF, 0, SCREW.r + 0.6, P), { tone: "faint" }));
    return out.join("");
  }
  // The front piece of the screw, clipped from the nut's front face on.
  const TRAVEL = rowY(ROWS.length - 1) - rowY(0);
  const nutFace = NUT.y + NUT.d + rowY(0);
  function screwClip() {
    const F = G.frameAlong([SCREW.x, 0, SCREW.z], AY);
    const pts = [];
    for (const s of [nutFace, SCREW.y1 + TRAVEL + 4]) for (let i = 0; i < 48; i++) pts.push(at(G.pointOf(F, s, SCREW.r + 0.7, (i / 48) * Math.PI * 2)));
    const hull = G.hullOf(pts);
    return `<clipPath id="tab-screw"><path data-part="screw-clip" d="M${hull.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}Z"/></clipPath>`;
  }

  // ------------------------------------------------------------ roll
  function roll() {
    const F = G.frameAlong([0, ROLL.y, ROLL.z], AX);
    const out = [];
    const bracket = (x) => {
      const plan = { x: x - 2, y: ROLL.y - 4, w: 4, d: 8, r: 0.8 };
      return S(k.slabOf(plan, BED_TOP, ROLL.z + 3 - BED_TOP, P, 2, 0.4), { tone: "mid" });
    };
    out.push(bracket(ROLL.x0 - 4));
    out.push(S(G.disc(ROLL.x0 - 2, ROLL.x1 + 2, 1.5, F, P), { tone: "mid" }));
    out.push(S(G.disc(ROLL.x0, ROLL.x1, ROLL.r, F, P), { tone: "hi", crease: "lo" }));
    out.push(L([ROLL.r - 1.4, ROLL.r - 2.6].map((r) => G.circleOf(F, ROLL.x1, r, P)).join(""), { tone: "faint" }));
    out.push(bracket(ROLL.x1 + 4));
    const hub = G.frameAlong([ROLL.x1 + 6, ROLL.y, ROLL.z], AX);
    out.push(S(G.disc(0, 1.6, 2.4, hub, P), { tone: "mid" }));
    return out.join("");
  }

  // ------------------------------------------------------------ console
  const LEVER = { x0: CON.x + 40, x1: CON.x + 54, y: CON.y + 35 };
  const LAMP = [CON.x + 54, CON.y + 12];
  function consoleBox() {
    const out = [S(k.slabOf(CON, 0, CON_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CON, 3, P, 4), { tone: "faint" }) })];
    out.push(B.screwDots(k.corners(CON, 2.6), CON_H, 0.4));
    // counter window: current row of the padded table
    const win = { x: CON.x + 6, y: CON.y + 6, w: 32, d: 11, r: 1 };
    out.push(S(k.slabOf(win, CON_H, 0.6, P, 3), { tone: "lo", crease: "none" }));
    out.push(L(k.planOutline(k.insetPlan(win, 1), CON_H + 0.6, P, 3), { tone: "faint" }));
    out.push(`<g data-part="counter">${k.faceTextSvg(k.topMatrix([win.x + win.w / 2, win.y + win.d / 2 + 2], CON_H + 0.6, P, "x"), `000/${PADDED}`, { size: 5.4, tone: "hi", anchor: "middle" })}</g>`);
    // lane selector, set to lane 2 of 4
    const kx = CON.x + 16, ky = CON.y + 34;
    out.push(S(k.cylinder(kx, ky, 7.4, CON_H, 0.8, P, 40), { tone: "lo" }));
    const span = Math.PI / 2, from = ZERO - span / 2;
    const t = k.radialTicks(kx, ky, 7.1, 3, 1, CON_H + 0.8, [1.4, 1.4], P, from, span);
    out.push(L(t.major, { tone: "mid" }));
    out.push(B.knob(kx, ky, 3.8, CON_H + 0.8, 3, { angle: from + (span * LANE) / 3 - Math.PI / 2 }));
    // forge gate: a slot with the lever
    const slot = { x: LEVER.x0 - 2.4, y: LEVER.y - 1.6, w: LEVER.x1 - LEVER.x0 + 4.8, d: 3.2, r: 1.5 };
    out.push(S(k.slabOf({ x: slot.x - 2, y: slot.y - 2, w: slot.w + 4, d: slot.d + 4, r: 2 }, CON_H, 0.6, P, 3), { tone: "lo", crease: "none" }));
    out.push(L(k.planOutline(slot, CON_H + 0.6, P, 3), { tone: "lo" }));
    const lever = [
      S(k.cylinder(LEVER.x0, LEVER.y, 0.9, CON_H + 0.6, 6.4, P, 14), { tone: "mid", crease: "none" }),
      S(k.cylinder(LEVER.x0, LEVER.y, 2.2, CON_H + 7, 2.4, P, 24), { tone: "mid" }),
    ].join("");
    out.push(`<g data-part="lever">${lever}</g>`);
    // fail lamp
    out.push(B.lamp(LAMP[0], LAMP[1], CON_H, { r: 2.6, part: "lamp" }));
    return out.join("");
  }

  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A tabulating machine on a bench. A pinned drum at the back holds the fixed columns of the AIR table, one row per index position, read by a comb of feelers. In front, a carriage on a lead screw steps along a witness sheet and shows the row's values A, B and C on number wheels. A dial gauge at the right reads the row's constraint and rests on zero when the row holds; a console carries the row counter, a forge lever and a fail lamp.",
    body: [
      `<defs>${screwClip()}</defs>`,
      base(),
      indexWheel(),
      standard(STD_L),
      drumBody(),
      pinLayer(),
      fingers(),
      drumNear(),
      standard(STD_R, { boss: true }),
      combBar(),
      gearbox(),
      gauge(),
      bed(),
      rail(RAIL_L),
      rail(RAIL_R),
      sheet(),
      screwPaths(),
      `<g data-part="carriage">${carriage()}</g>`,
      `<g clip-path="url(#tab-screw)">${screwPaths()}</g>`,
      endBearing(),
      roll(),
      consoleBox(),
    ],
  });

  // ------------------------------------------------------------ live
  const live = `function (root, bus, chapter) {
${LIVE_HELPERS}
const P = ${JSON.stringify(P)};
const V = ${JSON.stringify(V.map((v) => +v.toFixed(5)))};
const D = { y: ${YD}, z: ${ZC}, r: ${DR}, pin: ${PIN_LEN}, n: ${N_POS}, step: ${STEP}, wx0: ${WHEEL.x0}, wx1: ${WHEEL.x1}, wr: ${WHEEL.r}, lift: ${FINGER_LIFT.toFixed(3)} };
const COL_X = ${JSON.stringify(COL_X)};
const PINS = ${JSON.stringify(PINS)};
const ROWS = ${JSON.stringify(LEDGER)};
const PADDED = ${PADDED};
const ROWY = ${JSON.stringify(ROWS.map((_, i) => rowY(i) - rowY(0)))};
const LEVER = { x0: ${LEVER.x0}, x1: ${LEVER.x1} };
const G = { x: ${GX}, y: ${GY}, r: ${GR}, z: ${GTOP + 0.2}, zero: ${ZERO}, perUnit: ${(Math.PI * 2) / 6} };
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const sockets = [...svg.querySelectorAll("[data-s]")].map((el) => { const [j, c] = el.dataset.s.split(",").map(Number); return { el, j, c }; });
const pins = [...svg.querySelectorAll("[data-p]")].map((el) => { const [j, c] = el.dataset.p.split(",").map(Number); return { el, j, c, line: el.querySelector("path"), head: el.querySelector("circle") }; });
const fingers = [...svg.querySelectorAll("[data-finger]")];
const notches = q('[data-part="notches"]');
const carriage = q('[data-part="carriage"]');
const screwClip = q('[data-part="screw-clip"]');
const needle = q('[data-part="needle"]');
const lever = q('[data-part="lever"]');
const lamp = [...svg.querySelectorAll('[data-part="lamp"] path:not(.iso-line):not(.iso-fill)')];
const counter = q('[data-part="counter"] text');
const wheels = [0, 1, 2].map((w) => [...svg.querySelectorAll('text[data-w="' + w + '"]')]);
const readout = root.querySelector("[data-readout]");
const forgeBtn = root.querySelector("[data-forge]");
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
for (const p of pins) p.head.setAttribute("style", "fill:var(--anatomy-dot)");
notches.innerHTML = Array.from({ length: D.n }, () => '<path class="iso-line" data-tone="lo" d=""/>').join("");
const notchEls = [...notches.children];

let target = 2, pos = 2, carY = ROWY[2], forged = false, leverX = 0;
let needleX = 0, needleV = 0, shown = -1, touring = !stillQuery.matches, idle = 0, dwell = 0;
const DWELL = 2.6;

function f2(v) { return v.toFixed(1); }
function drawDrum(a) {
  for (const s of sockets) {
    const th = (s.j - a) * D.step;
    const f = Math.sin(th) * V[1] + Math.cos(th) * V[2];
    if (f < 0.04) { s.el.style.display = "none"; continue; }
    const [x, y] = iso([COL_X[s.c], D.y + D.r * Math.sin(th), D.z + D.r * Math.cos(th)], P);
    s.el.style.display = "";
    s.el.setAttribute("cx", f2(x)); s.el.setAttribute("cy", f2(y));
    s.el.setAttribute("opacity", (0.22 * smooth(0.04, 0.35, f)).toFixed(2));
  }
  for (const p of pins) {
    const th = (p.j - a) * D.step;
    const f = Math.sin(th) * V[1] + Math.cos(th) * V[2];
    if (f < 0.04) { p.el.style.display = "none"; continue; }
    const s = Math.sin(th), c = Math.cos(th), x = COL_X[p.c];
    const b = iso([x, D.y + D.r * s, D.z + D.r * c], P);
    const t = iso([x, D.y + (D.r + D.pin) * s, D.z + (D.r + D.pin) * c], P);
    p.el.style.display = "";
    p.el.setAttribute("opacity", smooth(0.04, 0.3, f).toFixed(2));
    p.line.setAttribute("d", "M" + f2(b[0]) + " " + f2(b[1]) + "L" + f2(t[0]) + " " + f2(t[1]));
    p.head.setAttribute("cx", f2(t[0])); p.head.setAttribute("cy", f2(t[1]));
  }
  notchEls.forEach((el, j) => {
    const th = (j - a) * D.step;
    const f = Math.sin(th) * V[1] + Math.cos(th) * V[2];
    if (f < 0.08) { el.setAttribute("d", ""); return; }
    const s = Math.sin(th), c = Math.cos(th);
    const p0 = iso([D.wx0, D.y + D.wr * s, D.z + D.wr * c], P), p1 = iso([D.wx1, D.y + D.wr * s, D.z + D.wr * c], P);
    el.setAttribute("d", "M" + f2(p0[0]) + " " + f2(p0[1]) + "L" + f2(p1[0]) + " " + f2(p1[1]));
    el.setAttribute("opacity", smooth(0.08, 0.4, f).toFixed(2));
  });
  // feelers ride up on the pins passing the top
  const lift = COL_X.map(() => 0);
  PINS.forEach((row, j) => {
    const th = (j - a) * D.step;
    const bump = smooth(0, 1, 1 - Math.abs(th) / (0.55 * D.step));
    if (bump > 0) row.forEach((b, c) => { if (b) lift[c] = Math.max(lift[c], bump); });
  });
  fingers.forEach((el, c) => el.setAttribute("transform", translateAlong(P, [0, 0, lift[c] * D.lift])));
}
function drawNeedle() {
  const ang = G.zero + clamp(needleX, -3.6, 3.6) * G.perUnit;
  const sx = Math.sin(ang), sy = -Math.cos(ang);
  needle.setAttribute("d", lineOnTop([G.x - sx * 4.2, G.y - sy * 4.2], [G.x + sx * (G.r - 4), G.y + sy * (G.r - 4)], G.z, P));
}
function setWheel(w, value) {
  const s = String(value).padStart(10, "0");
  const lead = s.length - String(value).length;
  wheels[w].forEach((t, i) => {
    if (t.textContent !== s[i]) t.textContent = s[i];
    t.setAttribute("data-tone", i < lead ? "lo" : "hi");
  });
}
const hintEl = root.querySelector('[data-corner="hint"]');
function say(i) {
  const r = ROWS[i];
  const C = forged ? r.Cf : r.C;
  const res = forged ? r.resF : r.res;
  const lhs = r.opcode === "add" ? "C₂ − A₂ − B₂" : "C₂ − A₂·B₂";
  const nums = r.opcode === "add" ? C + " − " + r.A + " − " + r.B : C + " − " + r.A + "·" + r.B;
  const tail = res === 0 ? " = 0" : " = " + res + " ≠ 0 · fails";
  const forms = [
    "row " + i + " · " + (forged ? "" : r.opcode + " · ") + lhs + " = " + nums + tail,
    "row " + i + " · " + nums + tail,
  ];
  const room = (root.querySelector(".iso-plate")?.clientWidth ?? 600) - 48 - (hintEl?.offsetWidth ?? 0) - 20;
  const text = forms.find((t) => t.length * 6.5 <= room) ?? forms[1];
  if (readout.textContent !== text) readout.textContent = text;
}
function show(i) {
  const r = ROWS[i];
  setWheel(0, r.A); setWheel(1, r.B); setWheel(2, forged ? r.Cf : r.C);
  counter.textContent = String(i).padStart(3, "0") + "/" + PADDED;
  const fail = forged && r.resF !== 0;
  lamp.forEach((el) => (el.style.fill = fail ? "var(--anatomy-red)" : ""));
  say(i);
}
function residualTarget(i) { const r = ROWS[i]; const v = forged ? r.resF : r.res; return v > 1073741823 ? v - 2147483647 : v; }

const run = loop(root, (dt, calm) => {
  if (touring) {
    dwell += dt;
    if (dwell > DWELL) { dwell = 0; target = (target + 1) % ROWS.length; }
  } else if (!forged) {
    idle += dt;
    if (idle > 6 && !calm) { touring = true; dwell = 0; }
  }
  pos = follow(pos, target, dt, target < pos - 1.5 ? 0.45 : 0.28, calm);
  if (Math.abs(pos - target) < 1e-3) pos = target;
  carY = follow(carY, ROWY[target], dt, 0.3, calm);
  if (Math.abs(carY - ROWY[target]) < 1e-3) carY = ROWY[target];
  leverX = follow(leverX, forged ? LEVER.x1 - LEVER.x0 : 0, dt, 0.18, calm);
  const near = clamp(Math.round(pos), 0, ROWS.length - 1);
  if (near !== shown) {
    shown = near;
    if (!calm) needleV += 2.2;
    bus.emit("focus", { chapter, refs: ["row:" + near] });
  }
  show(near);
  // the needle is a real spring: k = 90 s⁻², c = 7 s⁻¹, sub-stepped at 240 Hz
  const goal = residualTarget(near);
  if (calm) { needleX = goal; needleV = 0; }
  else {
    const n = Math.max(1, Math.round(dt * 240)), h = dt / n;
    for (let s = 0; s < n; s++) { needleV += (-90 * (needleX - goal) - 7 * needleV) * h; needleX += needleV * h; }
    if (Math.abs(needleX - goal) < 5e-4 && Math.abs(needleV) < 5e-4) { needleX = goal; needleV = 0; }
  }
  drawDrum(pos);
  carriage.setAttribute("transform", translateAlong(P, [0, carY, 0]));
  screwClip.setAttribute("transform", translateAlong(P, [0, carY, 0]));
  lever.setAttribute("transform", translateAlong(P, [leverX, 0, 0]));
  drawNeedle();
  const settled = pos === target && carY === ROWY[target] && needleV === 0 && needleX === goal && Math.abs(leverX - (forged ? LEVER.x1 - LEVER.x0 : 0)) < 1e-3;
  return touring || !settled;
});
function hold() { touring = false; idle = 0; run(); }
function jump(i) { target = (i + ROWS.length) % ROWS.length; hold(); }
function setForge(on) {
  forged = on;
  if (forgeBtn) forgeBtn.setAttribute("aria-pressed", String(on));
  needleV += on ? 0 : -0.5;
  hold();
}
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") jump(target + 1);
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") jump(target - 1);
  else if (e.key === "Home") jump(0);
  else if (e.key === "End") jump(ROWS.length - 1);
  else if (e.key === "f" || e.key === "F") setForge(!forged);
  else return;
  e.preventDefault();
});
stage.addEventListener("click", () => { if (touring) { touring = false; idle = 0; } else if (!forged) { touring = true; dwell = 0; run(); } });
if (forgeBtn) forgeBtn.addEventListener("click", () => setForge(!forged));
bus.on("pick", ({ chapter: c, ref }) => {
  if (c !== chapter) return;
  const [kind, value] = ref.split(":");
  if (kind === "row" && ROWS[Number(value)]) jump(Number(value));
});
addEventListener("resize", () => say(shown < 0 ? target : shown));
if (stillQuery.matches) touring = false;
drawDrum(pos); drawNeedle(); show(target); shown = target;
carriage.setAttribute("transform", translateAlong(P, [0, carY, 0]));
screwClip.setAttribute("transform", translateAlong(P, [0, carY, 0]));
run();
}`;

  const r2 = LEDGER[2];
  return {
    id: "fig-tabulator",
    fig: "Fig 3",
    title: "Tabulator",
    hint: "← → rows · F forge",
    readout: `row 2 · ${r2.opcode} · C₂ − A₂·B₂ = ${r2.C} − ${r2.A}·${r2.B} = ${r2.res}`,
    stage: { role: "group", "aria-label": "Tabulating machine: arrow keys step through the trace rows, F forges the current row's C value" },
    keys: [
      { mark: "raised", label: `Pinned drum: the ${FIXED.length} fixed columns, set by the program` },
      { mark: "flat", label: `Witness sheet: the ${MAIN.length} prover columns (A, B, C × 4 lanes)` },
      { mark: "lit", label: "Gauge needle: the row's constraint, lane 2" },
      { mark: "red", label: "Fail lamp: the row's constraint is not zero" },
    ],
    caption: `Fixed columns are chosen by the program and committed in the key, so the drum is the same for every proof; witness columns are the prover's values and change with the inputs. Every row's constraint must come out zero. The real table for this program has ${RAW} rows, counting input, constant, binding and permutation rows, padded to ${PADDED}; ${FIXED.length} fixed columns of ${PADDED} rows make ${MODEL.stark.fixedCells.toLocaleString("en-US")} fixed cells.`,
    controls: `<div class="fig-controls"><button type="button" data-forge aria-pressed="false">Forge C + 1 · F</button></div>`,
    svg,
    live,
  };
}
