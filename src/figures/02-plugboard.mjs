// Fig 2 · Relation to circuit: a patch bay.
// Each wire of the circuit is a module in a fixed slot on a rail (its address).
// Gate modules read two input jacks and drive one output; an output fans out
// through a mult bar with one socket per read, so the socket count is the
// wire's multiplicity. Every patch cord is a flat 4-core ribbon: one QM31 wire
// carries the four M31 lanes side by side, and a pointwise gate works on each
// core alone. A lane selector picks which core the pulse runs along.
import { k, bench, LIVE_HELPERS } from "./parts.mjs";
import MODEL from "../model/s31.mjs";

const WIDTH = 600;
const HEIGHT = 380;
const AZIMUTH = 56;

const W = 32; // module width
const PITCH = 36; // slot pitch on the rail
const SLOTS = 10;
const X0 = -((SLOTS - 1) * PITCH + W) / 2; // left edge of slot 0
const Y_BACK = -24, Y_FRONT = 22; // module depth
const FP = 0.7; // faceplate thickness
const YF = Y_FRONT + FP; // the faceplate surface
const RAIL_H = 3;
const BODY_Z = RAIL_H, BODY_H = 24, TOP = BODY_Z + BODY_H;
const LANES = [-19, -14, -9, -4, 1, 6]; // cord planes, back to front
const ZONE_Y = 16; // centre of the front zone on each module top
const NUT_R = 2.3, NUT_H = 0.8;
const PLUG_R = 2.05, PLUG_H = 3.2;
const BOOT_R = 1.75, BOOT_H = 2.4;
const RIB_Z = TOP + NUT_H + PLUG_H + BOOT_H; // where the ribbon leaves the boot
const CORE = 0.9; // width of one core
const RIB_HALF = CORE * 2;
const RIB_T = 0.9; // ribbon thickness along y
const JACK = { in0: 8, in1: 15, out: W - 7 };
const WIN = { inset: 2.4, z1: TOP - 5, h: 7.6, depth: 0.8 };
const FONT = 3.7;

const PLATE = { x: -212, y: -40, w: 424, d: 92, r: 8 };

const SYMBOL = { x: "x", c3: "3", "c−7": "p−7", _s31_0: "x²", _s31_1: "x⁴", fifth: "x⁵", triple: "3x", combined: "x⁵+3x", result: "f" };

export default function figure() {
  const poly = MODEL.poly;
  const p = MODEL.field.p;
  const wires = poly.wires;
  const wireOf = (name) => wires.find((w) => w.name === name);
  if (wireOf("c−7").lanes[0] !== p - 7 || wireOf("c3").lanes[0] !== 3) throw new Error("plugboard: constants changed");

  // ------------------------------------------------------------ the rack
  // Slots follow address order; the binding terminal takes the last slot.
  const byAddress = [...wires].sort((a, b) => a.address - b.address);
  const modules = byAddress.map((wire, slot) => ({
    slot,
    name: wire.name,
    kind: wire.kind,
    wire,
    gate: poly.gates.find((g) => g.out === wire.name) ?? null,
    x: X0 + slot * PITCH,
  }));
  modules.push({ slot: modules.length, name: "out", kind: "out", wire: null, gate: null, x: X0 + modules.length * PITCH });
  if (modules.length !== SLOTS) throw new Error("plugboard: slot count");
  const moduleOf = (name) => modules.find((m) => m.name === name);

  // Cords: every gate input reads a producer's output; the result is read once by the binding.
  const cords = [];
  for (const gate of poly.gates) {
    for (const port of ["in0", "in1"]) cords.push({ wire: gate[port], from: moduleOf(gate[port]), to: moduleOf(gate.out), port });
  }
  cords.push({ wire: "result", from: moduleOf("result"), to: moduleOf("out"), port: "in0" });
  for (const cord of cords) {
    cord.x1 = cord.from.x + JACK.out;
    cord.x2 = cord.to.x + JACK[cord.port];
  }
  // Each wire's multiplicity is the number of cords that leave it.
  for (const wire of wires) {
    const reads = cords.filter((c) => c.wire === wire.name).length;
    if (reads !== wire.mult) throw new Error(`plugboard: ${wire.name} has ${reads} cords but multiplicity ${wire.mult}`);
  }
  // Lanes: short cords in front, long ones behind; a lane never holds two cords that overlap.
  const order = cords.map((c, i) => i).sort((a, b) => cords[a].x2 - cords[a].x1 - (cords[b].x2 - cords[b].x1) || cords[a].x1 - cords[b].x1);
  for (const i of order) {
    const c = cords[i];
    for (let lane = LANES.length - 1; lane >= 0; lane--) {
      const clash = cords.some((o) => o !== c && o.lane === lane && o.x1 < c.x2 + 6 && c.x1 < o.x2 + 6);
      if (!clash) { c.lane = lane; break; }
    }
    if (c.lane === undefined) throw new Error("plugboard: out of lanes");
    c.y = LANES[c.lane];
    c.h = 9 + 0.16 * (c.x2 - c.x1) + (LANES.length - 1 - c.lane) * 1.6;
  }

  // ------------------------------------------------------------ camera
  const tallest = Math.max(...cords.map((c) => RIB_Z + c.h + RIB_HALF));
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -17, 0), [X0, LANES[0], tallest], [X0 + SLOTS * PITCH, LANES[0], tallest]],
    WIDTH,
    HEIGHT,
    { pad: 22, azimuth: AZIMUTH },
  );
  const B = bench(P);
  const { S, L, D, at } = B;
  const pt = (q) => q.map((v) => v.toFixed(1)).join(" ");
  const pathPts = (pts, closed = false) => (pts.length ? "M" + pts.map(pt).join("L") + (closed ? "Z" : "") : "");

  // ------------------------------------------------------------ base
  function base() {
    const out = [B.plate(PLATE)];
    // The address strip: one major tick under the centre of every slot.
    const strip = { x: X0 - 4, y: Y_FRONT + 9, w: SLOTS * PITCH - PITCH + W + 8, d: 7, r: 1 };
    out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
    const t = k.topTicks(X0 + W / 2, X0 + W / 2 + (SLOTS - 1) * PITCH, PITCH / 4, 4, strip.y + 0.8, 0.6, [1.8, 3.6], P);
    out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
    out.push(D([at([strip.x + 2, strip.y + strip.d / 2, 0.6]), at([strip.x + strip.w - 2, strip.y + strip.d / 2, 0.6])], { size: 0.45 }));
    return out.join("");
  }

  // The DIN-style rails the modules clip onto, with end stops.
  const RAIL_X0 = X0 - 14, RAIL_X1 = X0 + (SLOTS - 1) * PITCH + W + 14;
  function rails() {
    const out = [];
    for (const y of [-20, 12]) {
      const plan = { x: RAIL_X0, y, w: RAIL_X1 - RAIL_X0, d: 5, r: 0.8 };
      out.push(S(k.slabOf(plan, 0, RAIL_H, P, 2, 0.3), { tone: "mid" }));
      out.push(B.screwDots([[RAIL_X0 + 4, y + 2.5], [RAIL_X1 - 4, y + 2.5]], RAIL_H, 0.4));
    }
    return out.join("");
  }
  function endStop(x) {
    const plan = { x, y: -22, w: 6, d: 40, r: 1.2 };
    const out = [S(k.slabOf(plan, 0, 8, P, 3, 0.5), { tone: "mid" })];
    out.push(L(k.sideSeam(plan, 3, P, 3), { tone: "faint" }));
    out.push(B.screwDots([[x + 3, -17.5], [x + 3, 14.5]], 8, 0.45));
    return out.join("");
  }

  // ------------------------------------------------------------ modules
  const winOf = (m) => {
    const x0 = m.x + WIN.inset, x1 = m.x + W - WIN.inset;
    return { x0, x1, z0: WIN.z1 - WIN.h, z1: WIN.z1 };
  };
  const faceQuad = (x0, x1, z0, z1, y) => [at([x0, y, z1]), at([x1, y, z1]), at([x1, y, z0]), at([x0, y, z0])];
  const clips = [];

  // A recessed window in the front face: bottom and left walls, the glass behind, a bezel line.
  function windowSvg(m, inside) {
    const w = winOf(m);
    const yb = YF - WIN.depth;
    const id = `pb-win-${m.slot}`;
    const open = faceQuad(w.x0, w.x1, w.z0, w.z1, YF);
    clips.push(`<clipPath id="${id}"><path d="${pathPts(open, true)}"/></clipPath>`);
    const out = [];
    out.push(`<path class="iso-shade" data-shade="2" d="${pathPts(open, true)}"/>`);
    const back = faceQuad(w.x0, w.x1, w.z0, w.z1, yb);
    out.push(`<g clip-path="url(#${id})"><path class="iso-shade" data-shade="0" d="${pathPts(back, true)}"/>${inside}</g>`);
    out.push(L(pathPts(back, true), { tone: "faint" }));
    out.push(`<path class="iso-line iso-edge" data-tone="lo" d="${pathPts(open, true)}"/>`);
    return out.join("");
  }
  const textAt = (m) => {
    const w = winOf(m);
    return k.sideMatrix([w.x1 - 1.3, YF - WIN.depth], w.z0 + (WIN.h - FONT * 0.72) / 2, P, "left");
  };

  function moduleBody(m) {
    const plan = { x: m.x, y: Y_BACK, w: W, d: Y_FRONT - Y_BACK, r: 1.6 };
    const out = [];
    // latch tab that clips the module to the front rail
    const tab = { x: m.x + 6, y: Y_FRONT - 4, w: W - 12, d: 4.6, r: 0.8 };
    out.push(S(k.slabOf(tab, 0, BODY_Z, P, 2, 0.3), { tone: "lo" }));
    out.push(S(k.slabOf(plan, BODY_Z, BODY_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, BODY_Z + 4, P, 3), { tone: "faint" }) }));
    // top panel: inset groove and the front-zone divider
    const panel = k.insetPlan(plan, 1.8);
    out.push(L(k.planOutline(panel, TOP, P, 3), { tone: "faint" }));
    out.push(L(k.lineOnTop([panel.x, ZONE_Y - 6], [panel.x + panel.w, ZONE_Y - 6], TOP, P), { tone: "faint" }));
    out.push(B.screwDots([[m.x + 3.4, Y_BACK + 3.4], [m.x + W - 3.4, Y_BACK + 3.4]], TOP, 0.4));
    // faceplate with four screws and a row of vent slots
    const face = { x: m.x + 1.2, y: Y_FRONT, w: W - 2.4, d: FP, r: 0.3 };
    out.push(S(k.slabOf(face, BODY_Z + 1.2, BODY_H - 2.4, P, 2, 0.3), { tone: "mid" }));
    out.push(D([[3, BODY_Z + 3], [W - 3, BODY_Z + 3], [3, TOP - 3], [W - 3, TOP - 3]].map(([dx, z]) => at([m.x + dx, YF, z])), { size: 0.45 }));
    const vents = [BODY_Z + 4.4, BODY_Z + 6.6, BODY_Z + 8.8].map((z) => pathPts(faceQuad(m.x + 7, m.x + W - 7, z, z + 0.9, YF), true)).join("");
    out.push(L(vents, { tone: "lo" }));
    // front window
    if (m.kind === "out") {
      // the public statement behind glass: printed rules
      const w = winOf(m);
      const yb = YF - WIN.depth;
      const rules = [0.78, 0.5, 0.64]
        .map((share, i) => {
          const z = w.z1 - 2 - i * 1.9;
          return k.segment([w.x0 + 2, yb, z], [w.x0 + 2 + (w.x1 - w.x0 - 4) * share, yb, z], P);
        })
        .join("");
      out.push(windowSvg(m, `<g data-part="statement">${L(rules, { tone: "mid", free: true })}</g>`));
    } else {
      const value = String(m.wire.lanes[0]);
      out.push(windowSvg(m, `<g data-display="${m.name}">${k.faceTextSvg(textAt(m), value, { size: FONT, tone: "hi", anchor: "end" })}</g>`));
    }
    // the binding post that hands the result to the public statement
    if (m.kind === "out") {
      const [px, py] = [m.x + W - 9, Y_BACK + 9];
      out.push(S(k.cylinder(px, py, 3.2, TOP, 0.8, P, 24), { tone: "lo" }));
      out.push(S(k.cylinder(px, py, 1.5, TOP + 0.8, 3.4, P, 16), { tone: "mid", crease: "none" }));
      out.push(S(k.cylinder(px, py, 2.6, TOP + 4.2, 2.2, P, 24), { tone: "mid" }));
      out.push(L(k.knurl(px, py, 2.6, TOP + 4.2, TOP + 6.4, 14, P), { tone: "lo" }));
      out.push(D([at([px, py, TOP + 6.4])], { size: 0.5, tone: "mid" }));
    }
    // vents on the input module's back panel
    if (m.kind === "input") {
      for (let i = 0; i < 3; i++) out.push(L(k.planOutline({ x: m.x + 4 + i * 4.4, y: Y_BACK + 7, w: 2, d: 14, r: 1 }, TOP, P, 3), { tone: "lo" }));
    }
    // sockets: input jacks, then the output mult bar with one socket per read
    const jacks = cords.filter((c) => c.to === m);
    for (const c of jacks) out.push(nut(c.x2, c.y));
    const outs = cords.filter((c) => c.from === m);
    if (outs.length > 1) {
      const ys = outs.map((c) => c.y);
      const bar = { x: m.x + JACK.out - 1.8, y: Math.min(...ys) - 2.6, w: 3.6, d: Math.max(...ys) - Math.min(...ys) + 5.2, r: 1.2 };
      out.push(S(k.slabOf(bar, TOP, 0.5, P, 3), { tone: "lo", crease: "none" }));
    }
    const lift = outs.length > 1 ? 0.5 : 0;
    for (const c of outs) out.push(nut(c.x1, c.y, lift));
    return out.join("");
  }
  function nut(x, y, lift = 0) {
    return S(k.cylinder(x, y, NUT_R, TOP + lift, NUT_H, P, 20), { tone: "lo" });
  }

  // Front-zone hardware, drawn after the cords (it is nearer than every cord plane).
  const LED_X = (m, j) => m.x + 17 + j * 3.3;
  function frontZone(m) {
    const out = [];
    if (m.kind === "gate") {
      // op badge: ⊙ for a pointwise multiply, ⊕ for an add
      const cx = m.x + 8, cy = ZONE_Y;
      out.push(S(k.cylinder(cx, cy, 3, TOP, 0.5, P, 24), { tone: "lo", crease: "none" }));
      out.push(L(k.ring(cx, cy, 1.9, TOP + 0.5, P, 20), { tone: "mid" }));
      if (m.gate.opcode === "pointwise_mul") out.push(D([at([cx, cy, TOP + 0.5])], { size: 0.55, tone: "hi" }));
      else out.push(L(k.lineOnTop([cx - 1.9, cy], [cx + 1.9, cy], TOP + 0.5, P) + k.lineOnTop([cx, cy - 1.9], [cx, cy + 1.9], TOP + 0.5, P), { tone: "mid" }));
    } else if (m.kind === "const") {
      // a slotted set screw locks the constant
      const cx = m.x + 8, cy = ZONE_Y;
      out.push(S(k.cylinder(cx, cy, 3, TOP, 0.6, P, 24), { tone: "lo" }));
      out.push(S(k.cylinder(cx, cy, 2.1, TOP + 0.6, 1.2, P, 20), { tone: "mid" }));
      out.push(L(k.lineOnTop([cx - 1.5, cy - 1.5], [cx + 1.5, cy + 1.5], TOP + 1.8, P), { tone: "lo" }));
    } else if (m.kind === "out") {
      out.push(`<g data-part="lamp">${B.lamp(m.x + 8, ZONE_Y, TOP, { r: 2.4 })}</g>`);
    }
    if (m.kind === "input") {
      // the lane selector: a dial plate with four detents and a knurled knob
      const cx = m.x + 11, cy = ZONE_Y;
      out.push(S(k.cylinder(cx, cy, 5.4, TOP, 0.6, P, 32), { tone: "lo" }));
      const t = k.radialTicks(cx, cy, 5.2, 3, 1, TOP + 0.6, [1.1, 1.3], P, SEL.from, SEL.span);
      out.push(L(t.major, { tone: "mid" }));
      out.push(S(k.cylinder(cx, cy, 3.4, TOP + 0.6, 1, P, 28), { tone: "lo" }));
      out.push(S(k.cylinder(cx, cy, 2.8, TOP + 1.6, 3, P, 28), { tone: "mid" }));
      out.push(L(k.knurl(cx, cy, 2.8, TOP + 1.6, TOP + 4.6, 16, P), { tone: "lo" }));
      out.push(`<path class="iso-line" data-tone="hi" data-part="pointer" data-free="end" d="${pointer(0)}"/>`);
      out.push(D([at([cx, cy, TOP + 4.6])], { size: 0.45, tone: "hi" }));
    }
    if (m.kind !== "input") {
      out.push(L([0, 1, 2, 3].map((j) => k.ring(LED_X(m, j), ZONE_Y, 1.25, TOP, P, 14)).join(""), { tone: "faint" }));
    }
    return out.join("");
  }
  const SEL = { from: (125 * Math.PI) / 180, span: (110 * Math.PI) / 180 };
  const SEL_C = [modules[0].x + 11, ZONE_Y];
  const selAngle = (lane) => SEL.from + (lane / 3) * SEL.span;
  function pointer(lane) {
    const a = selAngle(lane);
    const [cx, cy] = SEL_C;
    const d = [Math.sin(a), -Math.cos(a)];
    return k.lineOnTop([cx - d[0] * 0.9, cy - d[1] * 0.9], [cx + d[0] * 2.5, cy + d[1] * 2.5], TOP + 4.6, P);
  }
  // Lane lamps: one group per lane, so the live code lights a whole lane at once.
  function leds() {
    return [0, 1, 2, 3]
      .map((j) => {
        const pts = modules.filter((m) => m.kind !== "input").map((m) => at([LED_X(m, j), ZONE_Y, TOP]));
        return `<g class="iso-dots" data-tone="${j === 0 ? "hi" : "lo"}" data-led="${j}">${pts.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.85"/>`).join("")}</g>`;
      })
      .join("");
  }

  // ------------------------------------------------------------ cords
  // A cord rises from the boot, arches in its own vertical plane and drops into the jack.
  function arch(c) {
    const n = 140, pts = [];
    const cx = (c.x1 + c.x2) / 2, hw = (c.x2 - c.x1) / 2, q = 0.62;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI;
      const co = Math.cos(t), si = Math.sin(t);
      pts.push([cx - hw * Math.sign(co) * Math.abs(co) ** q, RIB_Z + c.h * Math.abs(si) ** q]);
    }
    // resample by arc length
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = acc.at(-1), m = 72, out = [];
    let j = 0;
    for (let i = 0; i <= m; i++) {
      const s = (i / m) * total;
      while (j < acc.length - 2 && acc[j + 1] < s) j++;
      const u = (s - acc[j]) / (acc[j + 1] - acc[j] || 1);
      out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u]);
    }
    out[0] = [c.x1, RIB_Z];
    out[m] = [c.x2, RIB_Z];
    // outward normals (in the cord's plane)
    const normals = out.map((_, i) => {
      const a = out[Math.max(0, i - 1)], b = out[Math.min(m, i + 1)];
      const tx = b[0] - a[0], tz = b[1] - a[1], len = Math.hypot(tx, tz) || 1;
      return [-tz / len, tx / len];
    });
    normals[0] = [-1, 0];
    normals[m] = [1, 0];
    return { pts: out, normals };
  }
  const offset = (A, d, y) => A.pts.map((q, i) => at([q[0] + A.normals[i][0] * d, y, q[1] + A.normals[i][1] * d]));
  const coreOffset = (j) => (1.5 - j) * CORE; // lane 0 runs on the outside of the arch

  function plugAt(x, y, lift) {
    const out = [];
    out.push(S(k.cylinder(x, y, PLUG_R, TOP + NUT_H + lift, PLUG_H, P, 22), { tone: "mid" }));
    out.push(L(k.sideArc(x, y, PLUG_R, TOP + NUT_H + lift + PLUG_H * 0.55, P, 16), { tone: "faint" }));
    out.push(S(k.cylinder(x, y, BOOT_R, TOP + NUT_H + lift + PLUG_H, BOOT_H - lift, P, 20), { tone: "lo" }));
    return out.join("");
  }

  const corePaths = [];
  function cordSvg(c, i) {
    const A = arch(c);
    c.arch = A;
    const lift = cords.filter((o) => o.from === c.from).length > 1 ? 0.5 : 0;
    const out = [plugAt(c.x1, c.y, lift), plugAt(c.x2, c.y, 0)];
    const ring = (y) => [...offset(A, RIB_HALF, y), ...offset(A, -RIB_HALF, y).reverse()];
    const back = pathPts(ring(c.y - RIB_T), true);
    const front = pathPts(ring(c.y), true);
    out.push(`<path class="iso-shade" data-shade="0" d="${back}"/><path class="iso-line iso-edge" data-tone="lo" d="${back}"/>`);
    out.push(`<path class="iso-fill" d="${front}"/>`);
    const cores = [0, 1, 2, 3].map((j) => {
      const pts = offset(A, coreOffset(j), c.y);
      return { j, pts, d: pathPts(pts) };
    });
    corePaths.push(cores.map((core) => core.pts.map((q) => [+q[0].toFixed(1), +q[1].toFixed(1)])));
    out.push(cores.map((core) => `<path class="iso-line" data-tone="${core.j === 0 ? "hi" : "lo"}" data-core="${core.j}" d="${core.d}"/>`).join(""));
    out.push(`<path class="iso-line iso-edge" data-tone="mid" d="${front}"/>`);
    out.push(`<path class="iso-line pb-pulse" data-tone="lit" data-free="" data-pulse="${i}" d=""/>`);
    return out.join("");
  }

  // ------------------------------------------------------------ assemble
  const body = [base(), rails(), endStop(RAIL_X0), endStop(RAIL_X1 - 6)];
  for (const m of modules) body.push(`<g data-module="${m.name}">${moduleBody(m)}</g>`);
  const cordOrder = cords.map((c, i) => i).sort((a, b) => cords[a].y - cords[b].y || cords[a].x1 - cords[b].x1);
  const cordSvgs = [];
  for (const i of cordOrder) cordSvgs[i] = cordSvg(cords[i], i);
  for (const i of cordOrder) body.push(`<g data-cord="${i}" data-wire="${cords[i].wire}">${cordSvgs[i]}</g>`);
  for (const m of modules) body.push(frontZone(m));
  body.push(leds());
  body.push(cords.map((c, i) => `<circle class="pb-bead" data-bead="${i}" r="1.25" style="display:none"/>`).join(""));
  body.unshift(`<defs>${clips.join("")}<style>.pb-bead{fill:var(--anatomy-lit)}.pb-pulse{stroke-width:1.15}</style></defs>`);

  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A patch bay on a bench. Ten modules sit in fixed slots on a rail: the input x, two constants, six gates and a binding terminal. Flat four-core patch cords run from each module's output to the inputs that read it; an output with several readers has one socket per read on a bar. A lane selector on the input picks one of the four cores, a pulse runs along that core through the gates in order, and each module's window shows its value in that lane.",
    body,
  });

  // ------------------------------------------------------------ live
  // Topological schedule: inputs and constants first, then gates in relation order.
  const steps = ["x", "c3", "c−7", ...poly.gates.map((g) => g.out)];
  const plan = steps.map((name) => {
    const w = wireOf(name);
    return { name, symbol: SYMBOL[name] ?? name, address: w.address, mult: w.mult, lanes: w.lanes, cords: cords.map((c, i) => (c.wire === name ? i : -1)).filter((i) => i >= 0) };
  });
  const pointers = [0, 1, 2, 3].map(pointer);
  const xs = wireOf("x").lanes;

  const live = `function (root, bus, chapter) {
${LIVE_HELPERS}
const PLAN = ${JSON.stringify(plan)};
const CORES = ${JSON.stringify(corePaths)};
const POINTERS = ${JSON.stringify(pointers)};
const XS = ${JSON.stringify(xs)};
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = root.querySelector("[data-readout]");
const displays = Object.fromEntries([...svg.querySelectorAll("[data-display]")].map((g) => [g.dataset.display, g.querySelector("text")]));
const pulses = [...svg.querySelectorAll("[data-pulse]")];
const beads = [...svg.querySelectorAll("[data-bead]")];
const leds = [...svg.querySelectorAll("[data-led]")];
const cores = [...svg.querySelectorAll("[data-core]")];
const pointerEl = svg.querySelector('[data-part="pointer"]');
const lamp = svg.querySelector('[data-part="lamp"] .iso-solid:last-child');
const TRAVEL = 0.95, STEP = 1.25, HOLD = 2.6;
let lane = 0, step = 0, t = 0, touring = true, idle = 0, lastFocus = "";
const ease = (u) => u * u * (3 - 2 * u);
function lengthOf(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; }
const LENGTHS = CORES.map((cord) => cord.map(lengthOf));
function cut(pts, total, u) {
  const want = total * u, out = [pts[0]];
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (s + d >= want) { const f = (want - s) / (d || 1); out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]); return out; }
    s += d; out.push(pts[i]);
  }
  return out;
}
const dOf = (pts) => "M" + pts.map((q) => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L");
function setLane(j) {
  leds.forEach((g) => g.setAttribute("data-tone", Number(g.dataset.led) === j ? "hi" : "lo"));
  cores.forEach((c) => c.setAttribute("data-tone", Number(c.dataset.core) === j ? "hi" : "lo"));
  pointerEl.setAttribute("d", POINTERS[j]);
}
// s: current step index (PLAN.length = holding at the end), u: pulse progress 0..1
function draw(s, u) {
  const active = s < PLAN.length ? s : PLAN.length - 1;
  const travelling = s < PLAN.length;
  PLAN.forEach((w, i) => {
    const el = displays[w.name];
    if (!el) return;
    if (i <= active) { const v = String(w.lanes[lane]); if (el.textContent !== v) el.textContent = v; }
  });
  const lit = new Set(PLAN[active].cords);
  pulses.forEach((el, i) => {
    if (!lit.has(i)) { if (el.getAttribute("d")) el.setAttribute("d", ""); beads[i].style.display = "none"; return; }
    const pts = CORES[i][lane];
    const part = cut(pts, LENGTHS[i][lane], u);
    el.setAttribute("d", dOf(part));
    const head = part[part.length - 1];
    const b = beads[i];
    if (u < 1) { b.style.display = ""; b.setAttribute("cx", head[0].toFixed(1)); b.setAttribute("cy", head[1].toFixed(1)); }
    else b.style.display = "none";
  });
  const bound = !travelling || (active === PLAN.length - 1 && u >= 1);
  if (lamp) bound ? lamp.setAttribute("data-lit", "") : lamp.removeAttribute("data-lit");
  const w = PLAN[active];
  const fx = PLAN[PLAN.length - 1].lanes[lane];
  const text = bound
    ? "lane " + lane + " · f(" + XS[lane] + ") = " + fx + " · bound"
    : "lane " + lane + " · @" + w.address + " " + w.symbol + " = " + w.lanes[lane] + " · read ×" + w.mult;
  if (readout.textContent !== text) readout.textContent = text;
  const focus = "wire:" + w.name;
  if (focus !== lastFocus) { lastFocus = focus; bus.emit("focus", { chapter, refs: [focus] }); }
}
function restart(j) {
  lane = (j + 4) % 4; step = 0; t = 0;
  setLane(lane);
  if (stillQuery.matches) { step = PLAN.length; t = 1; }
  draw(step, stillQuery.matches ? 1 : 0);
  run();
}
const run = loop(root, (dt, calm) => {
  if (calm) { draw(PLAN.length, 1); return false; }
  if (!touring) { idle += dt; if (idle > 6) { touring = true; idle = 0; } }
  if (step < PLAN.length) {
    t += dt;
    const u = ease(clamp(t / TRAVEL, 0, 1));
    draw(step, u);
    if (t >= STEP) { step++; t = 0; }
  } else {
    draw(step, 1);
    t += dt;
    if (t >= HOLD) {
      if (touring) restart(lane + 1);
      else { t = HOLD; return touring || idle < 6.1; }
    }
  }
  return true;
});
function touch() { touring = false; idle = 0; }
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowUp") restart(lane + 1);
  else if (e.key === "ArrowLeft" || e.key === "ArrowDown") restart(lane - 1);
  else if (e.key === "Home") restart(0);
  else if (e.key === "End") restart(3);
  else return;
  touch();
  e.preventDefault();
});
stage.addEventListener("click", () => { touch(); restart(lane + 1); });
bus.on("pick", ({ chapter: c, ref }) => {
  if (c !== chapter) return;
  const [kind, name] = ref.split(":");
  if (kind !== "wire") return;
  const i = PLAN.findIndex((w) => w.name === name);
  if (i < 0) return;
  touch();
  step = i; t = TRAVEL;
  draw(step, 1);
  run();
});
setLane(0);
if (stillQuery.matches) { touring = false; step = PLAN.length; draw(step, 1); }
else draw(0, 0);
run();
}`;

  const gateCount = poly.gates.length;
  const pw = poly.gates.filter((g) => g.opcode === "pointwise_mul").length;
  return {
    id: "fig-plugboard",
    fig: "Fig 2",
    title: "Patch bay",
    hint: "← → lane · click next lane",
    readout: `lane 0 · @${wireOf("x").address} x = ${xs[0]} · read ×${wireOf("x").mult}`,
    stage: { role: "group", "aria-label": "Patch bay: arrow keys or a click choose which of the four lanes the pulse runs along" },
    keys: [
      { mark: "lit", label: "The pulse: the selected lane's core on the wire being driven" },
      { mark: "raised", label: "A module in its slot: one wire at one address" },
      { mark: "edge", label: "A patch cord: four cores, one per M31 lane" },
    ],
    caption: `${gateCount} gates (${pw} pointwise multiplies, ${gateCount - pw} adds) plus the input x and the constants 3 and p − 7 each own one wire in a fixed slot; slot order stands for address order, and the addresses themselves are illustrative. Every cord carries all four lanes side by side and a pointwise gate multiplies core by core, so lanes never mix. Sockets on an output count its reads: x has ${wireOf("x").mult}, x² has ${wireOf("_s31_0").mult}, and result has ${wireOf("result").mult}, the public output binding.`,
    svg,
    live,
  };
}
